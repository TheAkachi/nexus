import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {pageRoute} from '../../api/server.mjs';
import {coletar,PORTAL} from '../../api/coleta.mjs';

// Coleta diária do portal antigo (contrato 13.7), só de artigos desde a v0.15.0 (15.4), contra um portal falso: sem rede, sem espera.
const NOW=new Date('2026-10-05T04:30:00-03:00');
let db,existente,gerida,pedidos;
before(async()=>{
 db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);
 const rows=(await db.query("SELECT id,source_url FROM content WHERE kind='article' AND source_url<>'' ORDER BY id LIMIT 2")).rows;
 [existente,gerida]=rows;
 await db.query("UPDATE content SET managed_at=now(),title='Editado pela equipe' WHERE id=$1",[gerida.id]);
});
after(async()=>{await db?.close();});
const artigo=({titulo,texto='Texto do artigo novo.',data='2026-10-03T08:00:00-03:00'})=>`<html><head><meta name="description" content="Resumo de ${titulo}">
<script type="application/ld+json">{"@type":"Article","headline":"${titulo}","datePublished":"${data}","image":"${PORTAL}/media/cache/large/custom/domain_1/image_files/a1.jpg"}</script></head>
<body><h1 class="article-title">${titulo}</h1><div class="article-categories"><a href="/artigo/empreendedorismo">Empreendedorismo</a></div><div class="author-name">Equipe</div>
<div class="article-description"><p style="color:red">${texto} Veja a <a href="${PORTAL}/guia-comercial/boreal-tintas.html?utm_source=x">Boreal</a>.</p><script>alert(1)</script><p>Segundo parágrafo.</p></div>
<div class="detail-gallery-main-image"><a href="${PORTAL}/custom/domain_1/image_files/g1.jpg">foto</a></div></body></html>`;
// Portal falso: robots, índice de sitemaps, os sitemaps e as páginas. lastmod controla o que mudou.
function portal({lastmodExistente='2026-10-04',tituloExistente='Artigo revisto no portal'}={}) {
 pedidos=[];
 const caminho=u=>new URL(u).pathname;
 const paginas={'/robots.txt':'User-Agent: *\nDisallow: /custom/domain*\nAllow : /custom/domain*/sitemap*\nDisallow: /artigo/bloqueado\nAllow: /',
  '/sitemap.xml':`<sitemapindex><sitemap><loc>${PORTAL}/custom/domain_1/sitemap/postdetail0.xml</loc></sitemap><sitemap><loc>${PORTAL}/custom/domain_1/sitemap/articledetail0.xml</loc></sitemap><sitemap><loc>${PORTAL}/custom/domain_1/sitemap/listingdetail0.xml</loc></sitemap></sitemapindex>`,
  '/custom/domain_1/sitemap/postdetail0.xml':`<urlset><url><loc>${PORTAL}/noticias/feira-de-outubro.html</loc><lastmod>2026-10-04</lastmod></url></urlset>`,
  '/custom/domain_1/sitemap/articledetail0.xml':`<urlset><url><loc>${PORTAL}/artigo/artigo-novo.html</loc><lastmod>2026-10-03</lastmod></url>
   <url><loc>${existente.source_url}</loc><lastmod>${lastmodExistente}</lastmod></url><url><loc>${gerida.source_url}</loc><lastmod>2026-10-04</lastmod></url>
   <url><loc>${PORTAL}/artigo/bloqueado.html</loc></url></urlset>`,
  '/noticias/feira-de-outubro.html':'<html><body>notícia</body></html>',
  '/artigo/artigo-novo.html':artigo({titulo:'Artigo novo'}),
  [caminho(existente.source_url)]:artigo({titulo:tituloExistente,texto:'Texto revisto.'}),
  [caminho(gerida.source_url)]:artigo({titulo:'Não deveria ser buscado'})};
 return async url=>{const p=caminho(url);pedidos.push(p);return paginas[p]!==undefined?{ok:true,status:200,text:async()=>paginas[p]}:{ok:false,status:404,text:async()=>''};};
}
const vm=async path=>{const url=new URL(path,'http://x');return (await pageRoute({db,path:url.pathname,url,now:NOW})).vm;};

test('coleta só artigos novos e alterados, respeita o robots.txt, não lê as notícias e não toca no que a equipe editou',async()=>{
 const r=await coletar(db,{fetchImpl:portal(),espera:0,now:NOW});
 assert.deepEqual([r.parada,r.novas,r.atualizadas,r.erros],[false,1,1,[]]);
 assert.ok(!pedidos.some(p=>p.includes('postdetail')||p.startsWith('/noticias/')),'as notícias saíram do site (15.4): nem o sitemap delas é lido');
 assert.ok(!pedidos.includes('/artigo/bloqueado.html'),'bloqueado pelo robots.txt');
 assert.ok(!pedidos.includes(new URL(gerida.source_url).pathname),'o editado no admin não é buscado');
 assert.ok(!pedidos.some(p=>p.includes('listingdetail')),'só artigos');
 const art=(await db.query("SELECT * FROM content WHERE id='article:artigo-novo'")).rows[0];
 assert.equal(art.title,'Artigo novo');assert.equal(art.metadata.date,'2026-10-03T08:00:00-03:00');assert.equal(art.metadata.coletado,true);
 assert.deepEqual(art.metadata.gallery,[`${PORTAL}/custom/domain_1/image_files/g1.jpg`]);
 assert.equal(art.metadata.image,`${PORTAL}/custom/domain_1/image_files/a1.jpg`,'imagem original, não a do cache');
 assert.match(art.body_html,/<a href="\/comercio\/boreal-tintas">Boreal<\/a>/,'link do portal antigo vira a página nova');
 assert.doesNotMatch(art.body_html,/script|style=/);assert.match(art.body,/Texto do artigo novo\./);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM content WHERE id='news:feira-de-outubro'")).rows[0].n,0,'nenhuma notícia nova');
 const lista=await vm('/artigos');assert.ok([lista.destaque,...lista.items].some(i=>i?.href==='/artigos/artigo-novo'),'o artigo novo aparece (como destaque, por ser o mais recente com foto)');
 assert.equal((await db.query('SELECT title FROM content WHERE id=$1',[existente.id])).rows[0].title,'Artigo revisto no portal');
 assert.equal((await db.query('SELECT title FROM content WHERE id=$1',[gerida.id])).rows[0].title,'Editado pela equipe');
});

test('sem mudança, a coleta seguinte não busca nada; o db:seed não volta ao texto antigo do repositório',async()=>{
 const r=await coletar(db,{fetchImpl:portal(),espera:0,now:NOW});
 assert.deepEqual([r.novas,r.atualizadas],[0,0]);assert.deepEqual(pedidos.filter(p=>p.endsWith('.html')),[],'só robots e sitemaps');
 await importSnapshot(db);
 assert.equal((await db.query('SELECT title FROM content WHERE id=$1',[existente.id])).rows[0].title,'Artigo revisto no portal');
 const outra=await coletar(db,{fetchImpl:portal({lastmodExistente:'2026-10-05',tituloExistente:'Revisto de novo'}),espera:0,now:NOW});
 assert.equal(outra.atualizadas,1);assert.equal((await db.query('SELECT title FROM content WHERE id=$1',[existente.id])).rows[0].title,'Revisto de novo');
});

test('COLETA_ATE desliga a coleta a partir da data',async()=>{
 const r=await coletar(db,{fetchImpl:portal(),espera:0,now:NOW,ate:'2026-10-04'});
 assert.deepEqual([r.parada,r.ate],[true,'2026-10-04']);assert.deepEqual(pedidos,[],'nenhum pedido ao portal');
 assert.equal((await coletar(db,{fetchImpl:portal(),espera:0,now:NOW,ate:'2026-10-05'})).parada,false,'no próprio dia ainda roda');
});
