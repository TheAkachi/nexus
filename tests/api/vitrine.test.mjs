import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot,applyCorrections,bannerState,acervoReviews,classifiedPrice,reviewDate} from '../../api/import.mjs';
import {createApp,pageRoute} from '../../api/server.mjs';
import {menuState} from '../../api/data/paginas.mjs';

// Fase 2: avaliações, horários, filtros, coleções, ofertas, eventos, publicações em HTML e os mecanismos de D2 e D3.
// Relógio fixo: segunda-feira, 5 de outubro de 2026, 10h em São Paulo.
const NOW=new Date('2026-10-05T10:00:00-03:00');
let db,server,base;
const origin='http://127.0.0.1:4180';
before(async()=>{db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);server=await createApp({db,origin,indexable:true,clock:()=>NOW});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.close();});
const route=(path,now=NOW)=>{const url=new URL(path,'http://x');return pageRoute({db,path:decodeURIComponent(url.pathname),url,now});};
const vm=async(path,now)=>(await route(path,now)).vm;

test('avaliações do acervo: 17 em 6 empresas, sem a assinada pela própria PRIMIG',async()=>{
 const rows=(await db.query("SELECT business_id,count(*)::int AS n FROM reviews WHERE status='published' GROUP BY 1 ORDER BY 1")).rows;
 assert.deepEqual(rows.map(r=>`${r.business_id}:${r.n}`),['atelie-rosiane-oliveira:2','atelie-spa-fabiana-goudinho:1','grupo-concreto-bombeado:1','l-marinho-baterias:2','lamata-horto:1','medic-saude-unidade-vila-de-cava:10']);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM reviews WHERE author ILIKE '%primig%' OR business_id='pr-materiais-de-construcao'")).rows[0].n,0);
 const medic=await vm('/comercio/medic-saude-unidade-vila-de-cava');
 assert.equal(medic.rating,5);assert.equal(medic.reviewsCount,10);assert.equal(medic.reviews.length,10);assert.equal(medic.reviewsSource,'portal PRIMIG');
 assert.match(medic.reviews[0].date,/^\d{2}\/\d{2}\/\d{4}$/);assert.ok(medic.reviews.every(r=>r.author&&r.rating===5));
 const marinho=await vm('/comercio/l-marinho-baterias');assert.deepEqual(marinho.reviews.map(r=>[r.author,r.date]),[['Daniel Paz','23/01/2026'],['Guilherme Marinho','27/10/2025']],'mais recente primeiro');
 assert.equal(reviewDate('23 de janeiro, 2026'),'2026-01-23');assert.equal(reviewDate('sem data'),null);
 assert.deepEqual(acervoReviews({slug:'x',avaliacoes:{itens:[{autor:'PRIMIG Guia Comercial',estrelas:5,texto:'a'},{autor:'Ana',estrelas:4,texto:'b',data:'1 de março, 2026'}]}}).map(r=>r.author),['Ana']);
 const sem=await vm('/comercio/pr-materiais-de-construcao');assert.equal(sem.rating,null);assert.equal(sem.reviewsCount,0);
});

test('perfil: aberto agora no fuso de São Paulo, semana, rede, WhatsApp com mensagem, e-mail, vídeo e características',async()=>{
 const boreal=await vm('/comercio/boreal-tintas');
 assert.equal(typeof boreal.openNow,'boolean');assert.equal(boreal.week.length,7);assert.equal(boreal.week.find(d=>d.today).day,'segunda-feira');
 assert.deepEqual(boreal.units,[{slug:'boreal-tintas-filial-tres-coracoes',name:'Boreal Tintas - Filial Três Corações',district:'Três Corações'}]);
 assert.equal(boreal.videoUrl,'https://www.youtube.com/watch?v=gSVY1hbX6ws');assert.equal(boreal.email,'borealtintas@yahoo.com.br');
 assert.equal(new URL(boreal.whatsappUrl).searchParams.get('text'),'Olá! Vi a Boreal Tintas no Guia PRIMIG.');
 assert.equal(boreal.plan,null);assert.equal(boreal.sponsored,false);
 assert.equal((await vm('/comercio/medic-saude-unidade-centro')).units.length,4);assert.equal((await vm('/comercio/super-kibarato-unidade-farrula')).units.length,5);
 const features=(await db.query("SELECT id FROM businesses WHERE jsonb_array_length(details->'features')>0 LIMIT 1")).rows[0].id;assert.deepEqual((await vm('/comercio/'+features)).features,['Estacionamento']);
 const natal=await vm('/comercio/boreal-tintas',new Date('2026-12-25T10:00:00-03:00'));assert.equal(natal.openNow,null);assert.equal(natal.holiday,'Natal');
 const semHorario=(await db.query("SELECT id FROM businesses WHERE id NOT IN (SELECT business_id FROM business_hours) LIMIT 1")).rows[0].id;
 const s=await vm('/comercio/'+semHorario);assert.equal(s.openNow,null);assert.deepEqual(s.week,[]);
});

test('busca: filtros aberto, whatsapp e avaliacoes com contagem, sugestões na busca vazia e destaques primeiro',async()=>{
 const all=await vm('/busca');
 assert.deepEqual(all.filters,{aberto:false,whatsapp:false,avaliacoes:false,cupom:false});assert.equal(all.counts.cupom,0,'sem cupom no acervo');assert.equal(all.counts.avaliacoes,6);
 for(const filtro of ['aberto','whatsapp','avaliacoes']) {
  const f=await vm(`/busca?${filtro}=1`);assert.equal(f.total,all.counts[filtro],filtro);assert.equal(f.filters[filtro],true);
  for(const card of f.results)assert.ok(filtro==='aberto'?card.openNow===true:filtro==='whatsapp'?card.whatsappUrl.startsWith('https://wa.me/'):card.reviewsCount>0,`${filtro}: ${card.slug}`);
 }
 const both=await vm('/busca?whatsapp=1&avaliacoes=1');assert.equal(both.total,both.counts.avaliacoes);assert.equal(both.total,both.counts.whatsapp);
 assert.ok(all.counts.aberto>0&&all.counts.aberto<all.total,'segunda às 10h: parte das empresas aberta');
 assert.equal((await vm('/busca?aberto=1',new Date('2026-12-25T10:00:00-03:00'))).total,0,'no feriado ninguém aparece como aberto');
 assert.deepEqual(all.results.slice(0,3).map(r=>r.slug),['boreal-tintas','funeraria-sao-salvador','medic-saude-unidade-comendador-soares'],'destaques primeiro, em ordem alfabética');
 const empty=await vm('/busca?q=zzzz');assert.equal(empty.total,0);assert.ok(empty.suggestions.categorias.length>0&&empty.suggestions.bairros.length>0);
 assert.deepEqual(all.suggestions,{categorias:[],bairros:[]});
 const tinta=await vm('/busca?q=tinta&district=Centro');assert.equal(tinta.total,0);assert.ok(tinta.suggestions.bairros.some(b=>b.name==='Santa Rita'),'bairros com resultado para o mesmo texto');
 assert.match(await (await fetch(base+'/busca?aberto=1')).text(),/data-search-results="\d+"/);
});

test('home: coleções, ofertas vigentes, sem notícias (15.2), bairros e banners entre seções',async()=>{
 const home=await vm('/');
 assert.ok(home.collections.length>=3);assert.ok(home.collections.every(c=>c.businesses.length>0&&c.businesses.length<=6&&c.href.startsWith('/busca?category=')));
 assert.equal(home.collections[0].title,'Vai reunir a família?');
 assert.equal('news' in home,false,'as notícias saíram da home');assert.equal(home.articles.length,3);
 assert.ok(home.districts[0].count>=home.districts.at(-1).count);assert.equal(home.districts.reduce((s,d)=>s+d.count,0),(await db.query("SELECT count(*)::int AS n FROM businesses WHERE status='published' AND district<>''")).rows[0].n);
 assert.deepEqual(home.offers,[]);assert.deepEqual(home.ads['home-destaques'].banners,[],'sem banner pago: só o anúncio da PRIMIG');
 await db.query(`INSERT INTO catalog_items(id,business_id,kind,name,description,price_mode,price_cents,status,conditions,valid_until) VALUES
  ('oferta-vigente','boreal-tintas','offer','Tinta 18L','Cor branca','fixed',19990,'published','Pagamento à vista','2026-10-31'),
  ('oferta-vencida','boreal-tintas','offer','Tinta antiga','','fixed',100,'published','Até acabar','2026-10-04'),
  ('oferta-sem-condicao','boreal-tintas','offer','Sem condição','','inquiry',NULL,'published','','2026-12-31')`);
 await db.query("INSERT INTO campaigns(id,title,source,status,destination,image_url,placement,advertiser,format) VALUES('meio','Banner do meio','{}','published','/busca','https://www.primigdivulgacao.com.br/custom/domain_1/image_files/3_photo_35.png','home-destaques','Anunciante X','ar-livre')");
 try{
  const again=await vm('/');assert.deepEqual(again.offers.map(o=>[o.id,o.validUntil,o.priceLabel,o.conditions]),[['oferta-vigente','31/10/2026','R$ 199,90','Pagamento à vista']]);
  assert.deepEqual(again.ads['home-destaques'].banners.map(b=>[b.id,b.advertiser]),[['meio','Anunciante X']]);
  assert.deepEqual((await vm('/ofertas')).items.map(o=>o.id),['oferta-vigente']);
  assert.equal((await vm('/ofertas',new Date('2026-11-01T10:00:00-03:00'))).items.length,0,'depois da validade a oferta sai');
  assert.deepEqual(await menuState(db,NOW),{ofertas:true,eventos:false});assert.match(await (await fetch(base+'/sitemap.xml')).text(),/\/ofertas<\/loc>/);
 }finally{await db.query("DELETE FROM catalog_items WHERE id LIKE 'oferta-%'");await db.query("DELETE FROM campaigns WHERE id='meio'");}
});

test('eventos: só os futuros publicados; menu e sitemap acompanham',async()=>{
 assert.deepEqual((await vm('/eventos')).items,[]);assert.deepEqual(await menuState(db,NOW),{ofertas:false,eventos:false});
 await db.query(`INSERT INTO events(id,slug,title,starts_at,ends_at,place,status,url,business_id) VALUES
  ('feira','feira','Feira do bairro','2026-10-10T09:00:00-03:00','2026-10-11T18:00:00-03:00','Praça de Santa Rita','published','https://exemplo.com.br/feira','boreal-tintas'),
  ('passado','passado','Evento passado','2026-09-01T09:00:00-03:00',NULL,'','published','',NULL),
  ('rascunho','rascunho','Rascunho','2026-10-20T09:00:00-03:00',NULL,'','draft','',NULL)`);
 try{
  assert.deepEqual((await vm('/eventos')).items,[{slug:'feira',title:'Feira do bairro',date:'10/10/2026',endDate:'11/10/2026',time:'9h',place:'Praça de Santa Rita',address:'',description:'',descriptionHtml:'',image:'',href:'https://exemplo.com.br/feira',business:{slug:'boreal-tintas',name:'Boreal Tintas'}}]);
  assert.equal((await menuState(db,NOW)).eventos,true);assert.match(await (await fetch(base+'/sitemap.xml')).text(),/\/eventos<\/loc>/);
 }finally{await db.query("DELETE FROM events");}
});

test('publicações: HTML saneado, editoria, tempo de leitura, galeria, filtro por editoria e classificados completos',async()=>{
 const article=(await db.query("SELECT slug FROM content WHERE kind='article' AND jsonb_array_length(metadata->'gallery')>0 LIMIT 1")).rows[0].slug;
 const a=await vm('/artigos/'+article);
 assert.ok(a.bodyHtml.length>100);assert.doesNotMatch(a.bodyHtml,/<script|style=|class=|on[a-z]+=/i);assert.ok(a.readingMinutes>=1);assert.ok(a.gallery.length>0&&a.gallery[0].alt.includes('foto 1'));assert.ok(a.editoria?.slug);
 // Editorias são as categorias do portal: um artigo com várias categorias conta em todas.
 const acervo=JSON.parse(await readFile(new URL('../../conteudo-portal/artigos.json',import.meta.url),'utf8')).artigos;
 const bem=acervo.filter(n=>(n.categorias||[]).some(c=>c.nome==='Bem estar')).map(n=>n.slug);assert.ok(bem.length>1);
 const list=await vm('/artigos');assert.ok(list.editorias.length>3);assert.equal(list.editorias.find(e=>e.slug==='bem-estar').count,bem.length);
 const nomes=list.editorias.map(e=>e.label);assert.deepEqual(nomes,[...nomes].sort((a,b)=>a.localeCompare(b,'pt-BR')),'ordem alfabética');
 const filtered=await vm('/artigos?editoria=bem-estar');assert.equal(filtered.editoria,'bem-estar');
 if(bem.length<=12)assert.deepEqual(filtered.items.map(i=>i.href.split('/').pop()).sort(),[...bem].sort());
 const varias=acervo.find(n=>(n.categorias||[]).length>2);
 const tres=await vm('/artigos/'+varias.slug);assert.equal(tres.editorias.length,varias.categorias.length);assert.deepEqual(tres.editoria,tres.editorias[0]);
 // O 301 da editoria de artigo do portal antigo cai num filtro que existe; as de notícia vão para os artigos (15.1).
 const to=(await db.query('SELECT new_path FROM redirects WHERE old_path=$1',['/artigo/empreendedorismo'])).rows[0].new_path;assert.notEqual((await vm(to)).editoria,'',to);
 for(const old of ['/noticias/esportes-45-45','/noticias/baixada-fluminense'])assert.equal((await db.query('SELECT new_path FROM redirects WHERE old_path=$1',[old])).rows[0].new_path,'/artigos',old);
 assert.equal((await vm('/artigos?editoria=nao-existe')).editoria,'');
 assert.ok((await route('/artigos?editoria=bem-estar')).title.includes(list.editorias.find(e=>e.slug==='bem-estar').label));
 const wind=await vm('/classificados/wind-banner');assert.deepEqual([wind.price,wind.phone,wind.phoneUrl,wind.business],['R$ 199,00','21982294570','tel:21982294570',{slug:'dara-personalizados',name:'Dara Personalizados'}]);assert.match(wind.whatsappUrl,/^https:\/\/wa\.me\/5521982294570\?text=/);
 assert.equal((await vm('/classificados')).items.find(i=>i.href==='/classificados/wind-banner').price,'R$ 199,00');
 assert.equal(classifiedPrice({linhas:['x','R$ 5.200, 00']}),'R$ 5.200,00');assert.equal(classifiedPrice({linhas:['sem preço']}),'');
 // Os links do corpo para o portal antigo já apontam para as páginas novas.
 const portalLinks=(await db.query("SELECT count(*)::int AS n FROM content WHERE body_html LIKE '%href=\"https://www.primigdivulgacao.com.br/guia-comercial/%.html%'")).rows[0].n;assert.equal(portalLinks,0);
});

test('reimportar atualiza o texto de artigo já existente e não mexe no que não mudou',async()=>{
 const id=(await db.query("SELECT id FROM content WHERE kind='article' ORDER BY id LIMIT 1")).rows[0].id;
 await db.query("UPDATE content SET title='Título antigo',body='texto antigo',body_html='<p>texto antigo</p>',updated_at='2020-01-01' WHERE id=$1",[id]);
 const untouched=(await db.query("SELECT id,updated_at FROM content WHERE id<>$1 ORDER BY id LIMIT 1",[id])).rows[0];
 await db.query("INSERT INTO events(id,slug,title,starts_at,status) VALUES('fora-da-agenda','fora-da-agenda','Saiu do arquivo','2026-12-01T10:00:00-03:00','published')");
 await importSnapshot(db);
 assert.equal((await db.query("SELECT status FROM events WHERE id='fora-da-agenda'")).rows[0].status,'paused','evento fora do eventos.json sai do site');await db.query('DELETE FROM events');
 const row=(await db.query('SELECT title,body,body_html,updated_at FROM content WHERE id=$1',[id])).rows[0];
 assert.notEqual(row.title,'Título antigo');assert.notEqual(row.body,'texto antigo');assert.notEqual(row.body_html,'<p>texto antigo</p>');assert.ok(new Date(row.updated_at)>new Date('2021-01-01'));
 assert.equal(String((await db.query('SELECT updated_at FROM content WHERE id=$1',[untouched.id])).rows[0].updated_at),String(untouched.updated_at),'sem mudança, sem escrita');
});

test('marca de citação publicada por engano no portal (<Cite refs=.../>) sai do texto, do HTML e do resumo',async()=>{
 assert.equal((await db.query("SELECT count(*)::int AS n FROM content WHERE body LIKE '%Cite refs%' OR body_html LIKE '%Cite refs%' OR metadata->>'summary' LIKE '%Cite refs%'")).rows[0].n,0);
 // A notícia saiu do site (15.1), mas o texto guardado no banco continua limpo.
 const moto=(await db.query("SELECT body,body_html FROM content WHERE kind='news' AND slug='por-que-os-acidentes-de-moto-estao-pressionando-o-atendimento-de-emergencia-em-nova-iguacu'")).rows[0];
 assert.doesNotMatch(moto.body_html+moto.body,/Cite|turn\d+view/);assert.match(moto.body_html,/realizada de 18 a 25 de setembro\.<\/p>/);
});

test('v0.10.1: Home.groups e Cadastro.categories saíram do vm; Empresa.categories e FormBusca.categories continuam',async()=>{
 const home=await vm('/'),cadastro=await vm('/cadastro'),busca=await vm('/busca'),empresa=await vm('/comercio/boreal-tintas');
 assert.equal('groups' in home,false);assert.equal('categories' in cadastro,false);assert.ok(home.categorias.length>0);
 // v0.16.0: o cadastro passa a ter perguntas de escolher, e o ramo vem dos grupos da lista única (17.4).
 assert.equal('categorias' in cadastro,false);assert.equal(cadastro.perguntas.find(p=>p.id==='ramo').opcoes.length,12,'os 10 grupos, com ou sem empresa, mais on-line e outro');
 assert.ok(busca.form.categories.length>0);assert.ok(empresa.categories.length>0);
 assert.match((await route('/?category=alimentacao')).title,/Alimentação/,'o filtro por grupo da home continua');
});

test('nenhuma notícia ou artigo perde imagem ou link no saneamento',async()=>{
 const read=async f=>JSON.parse(await readFile(new URL(`../../conteudo-portal/${f}`,import.meta.url),'utf8'));
 const items=[...(await read('noticias.json')).noticias.map(c=>['news',c]),...(await read('artigos.json')).artigos.map(c=>['article',c])];
 for(const [kind,c] of items) {
  const html=(await db.query('SELECT body_html FROM content WHERE id=$1',[`${kind}:${c.slug}`])).rows[0].body_html;
  for(const m of c.html.matchAll(/<img\b[^>]*src=["']([^"']+)/gi))assert.ok(html.includes(m[1].replace(/^http:/,'https:').replace(/&/g,'&amp;')),`${c.slug}: imagem ${m[1]}`);
  const links=[...c.html.matchAll(/<a\b[^>]*href=["']([^"']+)/gi)].filter(m=>/^(https?:|\/)/i.test(m[1])).length;
  assert.ok((html.match(/<a href=/g)||[]).length>=links,`${c.slug}: links`);
 }
});

test('mecanismos de D2 (correções e plano) e D3 (banners) prontos e desligados até a lista da PRIMIG',async()=>{
 assert.deepEqual(applyCorrections({nome:'A',bairro:'X',telefone:'1'},{bairro:'Centro',plano:'ouro'}),{nome:'A',bairro:'Centro',telefone:'1'});
 assert.deepEqual(applyCorrections({nome:'A'},{_motivo:'só registro'}),{nome:'A'},'_motivo não é aplicado');
 // Correção já em uso: o Instagram da Alvorada no portal antigo é o da Boreal Tintas e sai; as unidades da Boreal mantêm o delas.
 assert.deepEqual((await vm('/comercio/alvorada-pet-racoes')).socials,[]);
 for(const slug of ['boreal-tintas','boreal-tintas-filial-tres-coracoes'])assert.ok((await vm('/comercio/'+slug)).socials.some(r=>r.url.includes('instagram.com/borealtintasrj')),slug);
 const insta=[{rede:'Instagram',url:'https://www.instagram.com/alvoradapet/'}];assert.deepEqual(applyCorrections({redes:[{rede:'Instagram',url:'https://www.instagram.com/borealtintasrj/'}]},{redes:insta}).redes,insta,'a rede errada da Alvorada pode ser corrigida pela lista');
 assert.equal((await db.query("SELECT count(*)::int AS n FROM campaigns WHERE status='published'")).rows[0].n,0,'os 24 banners seguem desligados');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM businesses WHERE plan_id IS NOT NULL')).rows[0].n,0,'nenhum plano estimado');
 const img='https://www.primigdivulgacao.com.br/media/cache/leaderboard/custom/domain_1/image_files/3_photo_35.png';
 assert.equal(bannerState({},img).status,'pending-review');
 const ready={anunciante:'L. Marinho',posicao:'home',formato:'super-banner',destino:'/comercio/l-marinho-baterias',inicio:'2026-10-01',fim:'2026-12-31',ativo:true};
 assert.deepEqual(bannerState(ready,img),{advertiser:'L. Marinho',placement:'home-topo',format:'super-banner',image_mobile_url:'',weight:1,business:'',destination:'/comercio/l-marinho-baterias',image_url:img,starts_at:'2026-10-01T00:00:00-03:00',ends_at:'2026-12-31T23:59:59-03:00',status:'published'},'posição antiga home vira home-topo');
 assert.equal(bannerState({...ready,formato:'quadrado'},img).status,'pending-review','formato que o espaço não aceita');
 for(const broken of [{...ready,ativo:false},{...ready,destino:'javascript:x'},{...ready,fim:'2026-09-01'},{...ready,posicao:'rodape'}])assert.equal(bannerState(broken,img).status,'pending-review');
 // Plano real (simulado aqui): patrocinado e ordem da busca.
 await db.query("INSERT INTO plans(id,name,status,rank,sponsored) VALUES('ouro','Ouro','active',3,true)");await db.query("UPDATE businesses SET plan_id='ouro' WHERE id='alo-tintas'");
 try{const busca=await vm('/busca');assert.equal(busca.results[0].slug,'alo-tintas');assert.equal(busca.results[0].sponsored,true);assert.equal((await vm('/comercio/alo-tintas')).plan,'Ouro');}
 finally{await db.query("UPDATE businesses SET plan_id=NULL");await db.query("DELETE FROM plans WHERE id='ouro'");}
});
