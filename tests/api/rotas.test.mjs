import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {createApp} from '../../api/server.mjs';

// Fase 1: redirecionamentos (com e sem barra, categorias do portal antigo), ordem e busca, 404 além da última página,
// sitemap, favicon e HSTS. Servidor real sobre o acervo importado (PGlite).
let db,server,base;
const origin='http://127.0.0.1:4180';
before(async()=>{db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);server=await createApp({db,origin,indexable:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.close();});
const get=(path,init={})=>fetch(base+path,{redirect:'manual',...init});
const html=async path=>(await get(path)).text();
const location=async path=>{const r=await get(path);assert.equal(r.status,301,path);return r.headers.get('location');};

test('301 dos caminhos antigos com e sem barra no final, e das páginas do site com barra',async()=>{
 for(const [from,to] of [['/anunciar','/para-empresas'],['/contato','/institucional/contato'],['/termos','/institucional/termos'],['/privacidade','/institucional/privacidade'],['/faq','/institucional/faq'],['/oferta','/ofertas'],['/evento','/eventos']]) {
  assert.equal(await location(from),to,from);assert.equal(await location(from+'/'),to,from+'/');
  assert.equal((await get(to)).status,200,to);
 }
 const old=(await db.query("SELECT old_path,new_path FROM redirects WHERE old_path LIKE '/guia-comercial/%.html' LIMIT 1")).rows[0];
 assert.equal(await location(old.old_path+'/'),old.new_path,'qualquer rota antiga aceita a barra');
 assert.equal(await location('/busca/?q=tinta&district=Centro'),'/busca?q=tinta&district=Centro');
 assert.equal(await location('/noticias/'),'/artigos','a lista de notícias saiu (15.1)');assert.equal(await location('/institucional/sobre/'),'/institucional/sobre');
 assert.equal((await get('/')).status,200,'a raiz não redireciona');
});

test('páginas de categoria, editoria e local do portal antigo vão para a busca ou a lista filtrada',async()=>{
 assert.equal(await location('/guia-comercial/loja-de-tintas'),'/busca?category=loja-de-tintas');
 assert.equal(await location('/guia-comercial/alimentacao'),'/busca?category=alimentacao');
 assert.equal(await location('/guia-comercial/buffet'),'/busca?category=buffets-e-catering');
 assert.equal(await location('/guia-comercial/oficina-mecenica'),'/busca?category=oficina-mecanica');
 assert.equal(await location('/guia-comercial/santa-rita'),'/bairros/santa-rita','bairro com empresa vai para a página dele (18.2)');
 assert.equal(await location('/guia-comercial/nova-iguacu'),'/busca?location=Nova+Igua%C3%A7u');
 // As editorias de notícia do portal antigo vão para os artigos (15.1).
 assert.equal(await location('/noticias/baixada-fluminense'),'/artigos');
 assert.equal(await location('/noticias/esportes-45-45'),'/artigos');
 assert.equal(await location('/artigo/empreendedorismo'),'/artigos?editoria=empreendedorismo');
 assert.equal(await location('/classificados/moveis-63-63'),'/classificados');assert.equal(await location('/oferta/santa-rita'),'/ofertas');
 // Toda categoria leva a uma página que existe e não esconde publicação atual com o mesmo caminho.
 const rows=(await db.query("SELECT old_path,new_path FROM redirects WHERE new_path LIKE '%?%' OR new_path LIKE '/bairros/%' OR new_path IN ('/busca','/classificados','/ofertas','/artigos')")).rows;
 assert.ok(rows.length>=150);
 for(const r of rows){assert.equal((await get(r.new_path)).status,200,`${r.old_path} → ${r.new_path}`);}
 const news=(await db.query("SELECT slug FROM content WHERE kind='news'")).rows.map(r=>`/noticias/${r.slug}`);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM redirects WHERE old_path = ANY($1)',[news])).rows[0].n,0);
});

test('ordem alfabética pt-BR, busca de texto no bairro e 404 além da última página',async()=>{
 const names=[...(await html('/busca')).matchAll(/<h2><a href="\/comercio\/[^"]+\?from=search">([^<]+)<\/a>/g)].map(m=>m[1]);
 assert.ok(names.indexOf('Alô Tintas')>=0&&names.indexOf('Alô Tintas')<names.indexOf('Alvorada Pet Rações'),names.slice(0,4).join(' | '));
 const santaRita=await html('/busca?q=Santa%20Rita');
 const total=+santaRita.match(/data-search-results="(\d+)"/)[1];
 const expected=(await db.query("SELECT count(*)::int AS n FROM businesses WHERE status='published' AND district='Santa Rita'")).rows[0].n;
 assert.ok(total>=expected&&expected>5,`q=Santa Rita acha as ${expected} empresas do bairro (achou ${total})`);
 assert.equal((await get('/busca?page=4')).status,200);assert.equal((await get('/busca?page=5')).status,404);
 assert.equal((await get('/busca?q=zzzz&page=2')).status,404);assert.equal((await get('/busca?page=0')).status,200);
 assert.equal((await get('/artigos?page=4')).status,200);assert.equal((await get('/artigos?page=5')).status,404);
});

test('sitemap com lastmod, páginas institucionais e só o que é indexável',async()=>{
 const xml=await html('/sitemap.xml');
 for(const path of ['/','/artigos','/classificados','/para-empresas','/institucional/sobre','/institucional/contato','/institucional/faq','/institucional/termos','/institucional/privacidade','/comercio/boreal-tintas'])assert.match(xml,new RegExp(`<loc>${origin}${path}</loc>`),path);
 assert.doesNotMatch(xml,/<loc>[^<]*\/busca<\/loc>/);assert.doesNotMatch(xml,/\/ofertas<\/loc>/,'sem oferta publicada');assert.doesNotMatch(xml,/\/eventos<\/loc>/);
 assert.match(xml,/<loc>[^<]*\/comercio\/boreal-tintas<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
 assert.match(xml,/<loc>[^<]*\/artigos\/[^<]+<\/loc><lastmod>20\d\d-\d{2}-\d{2}<\/lastmod>/);
 assert.doesNotMatch(xml,/\/noticias/,'as notícias saíram do sitemap (15.1)');
 await db.query("INSERT INTO catalog_items(id,business_id,kind,name,price_mode,status,conditions,valid_until) VALUES('oferta-sitemap','boreal-tintas','offer','Oferta','inquiry','published','Enquanto durar o estoque',current_date+30)");
 try{assert.match(await html('/sitemap.xml'),/<loc>[^<]*\/ofertas<\/loc>/);}finally{await db.query("DELETE FROM catalog_items WHERE id='oferta-sitemap'");}
 for(const path of ['/para-empresas','/institucional/contato'])assert.match(await html(path),/<meta name="robots" content="index,follow">/,path);
 for(const path of ['/busca','/favoritos','/cadastro'])assert.match(await html(path),/<meta name="robots" content="noindex,nofollow">/,path);
});

test('favicon, HSTS só com origem https e ogImage absoluta',async()=>{
 const icon=await get('/favicon.ico');assert.equal(icon.status,200);assert.equal(icon.headers.get('content-type'),'image/svg+xml');assert.match(await icon.text(),/<svg/);
 assert.equal((await get('/')).headers.get('strict-transport-security'),null);
 const secure=await createApp({db,origin:'https://guia.example'});await new Promise(r=>secure.listen(0,'127.0.0.1',r));
 try{const r=await fetch(`http://127.0.0.1:${secure.address().port}/`);assert.equal(r.headers.get('strict-transport-security'),'max-age=31536000');}
 finally{await new Promise(r=>secure.close(r));}
});

test('notícias saíram do site (15.1): a lista vai para os artigos; a notícia responde 410, sem cadeia',async()=>{
 for(const p of ['/noticias','/noticias?editoria=esportes&page=2'])assert.equal(await location(p),'/artigos',p);
 const slug=(await db.query("SELECT slug FROM content WHERE kind='news' LIMIT 1")).rows[0].slug;
 for(const p of [`/noticias/${slug}`,`/noticias/${slug}.html`]){const r=await get(p);assert.equal(r.status,410,p);assert.match(await r.text(),/<meta name="robots" content="noindex,nofollow">/);}
 assert.equal((await db.query("SELECT count(*)::int AS n FROM redirects WHERE new_path LIKE '/noticias%'")).rows[0].n,0,'nenhum 301 leva para notícia');
 assert.doesNotMatch(await html('/'),/href="\/noticias\/[^"]+"/,'a home não liga para notícia');
});
