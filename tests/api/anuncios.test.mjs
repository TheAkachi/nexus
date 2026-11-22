import {test,before,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {pageRoute} from '../../api/server.mjs';
import {ingestEvent} from '../../api/events.mjs';
import {adsFor,casaVM} from '../../api/data/anuncios.mjs';
import {ESPACOS,FORMATOS} from '../../api/data/espacos.mjs';

// Parte A: espaços de anúncio (contrato, seção 11). Banco real importado; relógio e sorteio fixos.
const NOW=new Date('2026-10-05T10:00:00-03:00');
const img=n=>`https://www.primigdivulgacao.com.br/custom/domain_1/image_files/teste_${n}.png`;
let db;
before(async()=>{db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);});
after(async()=>{if(db)await db.close();});
afterEach(async()=>{await db.query("DELETE FROM ad_daily");await db.query("DELETE FROM public_events");await db.query("DELETE FROM campaigns WHERE id LIKE 't-%'");await db.query("UPDATE businesses SET plan_id=NULL");await db.query("DELETE FROM plans WHERE id='ouro'");});
const vm=async(path,random=()=>0.5)=>{const url=new URL(path,'http://x');return (await pageRoute({db,path:url.pathname,url,now:NOW,random})).vm;};
// Banner pago de teste: espaço, formato, anunciante e empresa.
const banner=async(id,placement,format,{advertiser=id,business=null,weight=1,mobile=''}={})=>db.query(
  `INSERT INTO campaigns(id,title,source,status,destination,image_url,placement,format,advertiser,business_id,weight,image_mobile_url) VALUES($1,$1,'{}','published','/busca',$2,$3,$4,$5,$6,$7,$8)`,
  [id,img(id),placement,format,advertiser,business,weight,mobile]);
// Sorteio determinístico (mulberry32) para o rodízio.
const seeded=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

test('importação: página própria (27 pagantes até a D2), 6 anúncios da PRIMIG e os 24 banners do portal ainda desligados',async()=>{
 assert.equal((await db.query('SELECT count(*)::int AS n FROM businesses WHERE own_page')).rows[0].n,27);
 const casas=(await db.query("SELECT id,format,destination,advertiser FROM campaigns WHERE status='house' ORDER BY id")).rows;
 assert.deepEqual(casas.map(c=>c.id),Object.keys(FORMATOS).map(f=>`primig-${f}`).sort());
 assert.ok(casas.every(c=>c.advertiser==='PRIMIG'&&c.destination===`/cadastro?interesse=banner-${c.format}`));
 assert.equal((await db.query("SELECT count(*)::int AS n FROM campaigns WHERE status='published'")).rows[0].n,0);
 assert.deepEqual(casaVM('super-banner'),{id:'primig-super-banner',format:'super-banner',name:'Super Banner',size:'728 × 90',price:'R$ 99,00',period:'R$ 250,00 / 3 meses',interesse:'banner-super-banner',href:'/cadastro?interesse=banner-super-banner'});
 assert.deepEqual(Object.values(FORMATOS).map(f=>[f.id,f.width,f.height]),[['link-patrocinado',320,100],['quadrado',250,250],['super-banner',728,90],['ar-livre',970,250],['meia-pagina',300,600],['exibir-lateral',160,600]]);
});

test('sem banner pago: todo espaço mostra o anúncio da PRIMIG, até o limite da página (16.1)',async()=>{
 const home=(await vm('/')).ads;
 assert.deepEqual(Object.keys(home),['home-topo','home-destaques','home-comercial','home-grade']);
 assert.deepEqual(Object.values(home).map(e=>e.celular),[true,true,true,false],'3 no celular');
 assert.equal(home['home-grade'].house.format,'quadrado');
 assert.equal(home['home-topo'].house.id,'primig-super-banner');assert.equal(home['home-destaques'].house.format,'ar-livre');
 assert.deepEqual(home['home-topo'].banners,[]);assert.deepEqual(home['home-topo'].formatos,{computador:['super-banner'],celular:['link-patrocinado']});
 const longo=(await db.query("SELECT slug FROM content WHERE kind='article' AND body_html LIKE '%<p>%<p>%<p>%<p>%' ORDER BY slug LIMIT 1")).rows[0].slug;
 const leitura=(await vm('/artigos/'+longo)).ads;assert.deepEqual(Object.keys(leitura),['leitura-texto','leitura-lateral','leitura-fim']);
 assert.equal(leitura['leitura-lateral'].house.format,'meia-pagina');
 assert.deepEqual(Object.keys((await vm('/artigos/autocuidado-e-necessidade')).ads),['leitura-lateral','leitura-fim'],'3 parágrafos: sem o espaço do texto');
 const busca=(await vm('/busca')).ads;assert.deepEqual(Object.keys(busca),['busca-topo','busca-meio','busca-lateral']);assert.equal(busca['busca-meio'].house.format,'link-patrocinado');
 assert.deepEqual(Object.keys((await vm('/busca?q=Boreal')).ads),['busca-topo','busca-lateral'],'2 resultados: sem o meio da lista');
 const lista=(await vm('/artigos')).ads;assert.deepEqual(Object.keys(lista),['lista-topo','lista-meio']);assert.equal(lista['lista-meio'].aCada,6);
 assert.deepEqual(Object.keys((await vm('/classificados')).ads),['lista-topo'],'2 classificados: sem o meio');
 assert.deepEqual(Object.keys((await vm('/comercio/garcia-churrasco')).ads),['perfil-lateral'],'empresa não pagante: a PRIMIG no perfil');
 assert.deepEqual((await vm('/comercio/boreal-tintas')).ads,{},'pagante (página própria): nada');
 assert.deepEqual(Object.keys((await vm('/busca?q=zzzz')).ads),['busca-vazia'],'busca vazia: só o quadrado, sem o topo colado');
});

test('até 4 espaços por página e 3 no celular; laterais nunca no celular',async()=>{
 await banner('t-topo','busca-topo','super-banner');await banner('t-meio','busca-meio','link-patrocinado');
 await banner('t-lat','busca-lateral','meia-pagina');await banner('t-lat2','busca-lateral','exibir-lateral',{advertiser:'outro'});
 const busca=(await vm('/busca')).ads;
 assert.deepEqual(Object.keys(busca),['busca-topo','busca-meio','busca-lateral']);
 assert.deepEqual(Object.values(busca).map(e=>e.celular),[true,true,false]);assert.equal(busca['busca-meio'].aCada,6);
 assert.equal(busca['busca-lateral'].banners.length,1,'lateral gira 1');
 for(const [id,p,f] of [['t-h1','home-topo','super-banner'],['t-h2','home-destaques','ar-livre'],['t-h3','home-comercial','super-banner'],['t-h4','home-grade','quadrado']])await banner(id,p,f);
 const home=(await vm('/')).ads;
 assert.deepEqual(Object.keys(home),['home-topo','home-destaques','home-comercial','home-grade']);
 assert.deepEqual(Object.values(home).map(e=>e.celular),[true,true,true,false],'o 4º sai do celular');
 assert.ok(Object.values(home).every(e=>e.house===null));
 // Um 5º espaço seria cortado: o inventário de cada página é conferido aqui.
 for(const pagina of ['home','busca','conteudos','conteudo','empresa','ofertas','eventos'])assert.ok(ESPACOS.filter(e=>e.pagina===pagina).length>0,pagina);
 const many=Array.from({length:6},(_,i)=>({id:`x${i}`,placement:'home-topo',format:'super-banner',destination:'/busca',image_url:img(i),advertiser:`a${i}`}));
 assert.equal(adsFor('home',{campaigns:many,random:()=>0.5})['home-topo'].banners.length,3,'home-topo gira 3');
});

test('nunca colados: meio da lista só com 7 itens ou mais; texto só com 4 parágrafos ou mais',async()=>{
 await banner('t-meio','busca-meio','link-patrocinado');await banner('t-lista','lista-meio','quadrado');
 assert.ok((await vm('/busca')).ads['busca-meio']);
 assert.equal((await vm('/busca?q=Boreal')).ads['busca-meio'],undefined,'2 resultados');
 assert.ok((await vm('/artigos')).ads['lista-meio']);
 assert.equal((await vm('/classificados')).ads['lista-meio'],undefined,'2 classificados');
 assert.equal(adsFor('conteudo',{paragrafos:3})['leitura-texto'],undefined);assert.ok(adsFor('conteudo',{paragrafos:4})['leitura-texto']);
 assert.equal(adsFor('home',{campaigns:[{id:'g',placement:'home-grade',format:'quadrado',destination:'/busca',image_url:img('g')}],itens:6})['home-grade'],undefined,'grade com 6 destaques: o card seria o último');
});

test('cada anunciante aparece uma vez por página, no espaço de maior prioridade',async()=>{
 await banner('t-a1','home-topo','super-banner',{advertiser:'Loja A'});await banner('t-a2','home-destaques','ar-livre',{advertiser:'loja a'});
 await banner('t-b','home-destaques','ar-livre',{advertiser:'Loja B'});
 const home=(await vm('/')).ads;
 assert.deepEqual(home['home-topo'].banners.map(b=>b.id),['t-a1']);assert.deepEqual(home['home-destaques'].banners.map(b=>b.id),['t-b']);
});

test('rodízio por peso: o peso maior sai primeiro na proporção do peso',async()=>{
 const campaigns=[{id:'leve',placement:'home-topo',format:'super-banner',destination:'/busca',image_url:img('l'),advertiser:'L',weight:1},
  {id:'pesado',placement:'home-topo',format:'super-banner',destination:'/busca',image_url:img('p'),advertiser:'P',weight:3}];
 const random=seeded(42);let first=0;
 for(let i=0;i<4000;i++)if(adsFor('home',{campaigns,random})['home-topo'].banners[0].id==='pesado')first++;
 assert.ok(first/4000>0.72&&first/4000<0.78,`pesado primeiro em ${(first/40).toFixed(1)}% (esperado 75%)`);
 const order=new Set();for(let i=0;i<50;i++)order.add(adsFor('home',{campaigns,random})['home-topo'].banners.map(b=>b.id).join());
 assert.equal(order.size,2,'os dois giram');
});

test('perfil: sem concorrente da mesma categoria e sem anúncio na empresa pagante',async()=>{
 // Cebolinha e Rafael fazem ar-condicionado automotivo, nenhum dos dois tinha página própria; a Magnífico é de reformas.
 const cebolinha='cebolinha-gnv-e-ar-condicionado-automotivo',rafael='rafael-ar-condicionado-veicular';
 assert.deepEqual((await db.query('SELECT id FROM businesses WHERE own_page AND id = ANY($1)',[[cebolinha,rafael,'magnifico-reformas-e-acabamentos']])).rows,[]);
 await banner('t-rival','perfil-lateral','quadrado',{business:rafael,advertiser:'Rafael'});
 assert.equal((await vm('/comercio/'+cebolinha)).ads['perfil-lateral'].house?.id,'primig-quadrado','concorrente fora: entra o anúncio da PRIMIG');
 assert.deepEqual((await vm('/comercio/magnifico-reformas-e-acabamentos')).ads['perfil-lateral'].banners.map(b=>b.id),['t-rival'],'em outra categoria, aparece');
 await banner('t-outro','perfil-lateral','quadrado',{business:'magnifico-reformas-e-acabamentos',advertiser:'Magnífico'});
 assert.deepEqual((await vm('/comercio/'+cebolinha)).ads['perfil-lateral'].banners.map(b=>b.id),['t-outro']);
 assert.deepEqual((await vm('/comercio/'+rafael)).ads['perfil-lateral'].banners.map(b=>b.id),['t-outro'],'o próprio anúncio também não aparece no perfil');
 // Pagante: página própria no portal (27) enquanto não há plano real.
 assert.deepEqual((await vm('/comercio/funeraria-sao-salvador')).ads,{});
 // Com plano real (D2 ou admin), vale o plano: a Cebolinha com plano vira pagante e a Funerária sem plano deixa de ser.
 await db.query("INSERT INTO plans(id,name,status,rank,sponsored) VALUES('ouro','Ouro','active',3,false)");await db.query('UPDATE businesses SET plan_id=$1 WHERE id=$2',['ouro',cebolinha]);
 assert.deepEqual((await vm('/comercio/'+cebolinha)).ads,{});
 assert.ok((await vm('/comercio/funeraria-sao-salvador')).ads['perfil-lateral']);
});

test('formato e imagem do celular; banner fora do formato do espaço não entra',async()=>{
 await banner('t-ok','home-topo','super-banner',{mobile:img('m')});await banner('t-errado','home-destaques','super-banner');
 const home=(await vm('/')).ads;
 assert.deepEqual(home['home-topo'].banners[0],{id:'t-ok',placement:'home-topo',href:'/busca',image:img('t-ok'),title:'t-ok',advertiser:'t-ok',format:'super-banner',width:728,height:90,imageMobile:img('m')});
 assert.equal(home['home-destaques'].house.id,'primig-ar-livre','super-banner não entra no espaço de ar-livre');
});

test('sem anúncio em cadastro, contato, institucionais, para-empresas, favoritos e leitura de classificado; banners e bannersMeio saíram do vm (13.8)',async()=>{
 for(const path of ['/cadastro','/institucional/contato','/institucional/sobre','/institucional/termos','/institucional/privacidade','/institucional/faq','/para-empresas'])assert.equal((await vm(path)).ads,undefined,path);
 assert.deepEqual((await vm('/favoritos')).ads,{});assert.deepEqual((await vm('/classificados/wind-banner')).ads,{});
 await banner('t-topo','home-topo','super-banner');await banner('t-dest','home-destaques','ar-livre');await banner('t-fim','leitura-fim','super-banner');
 const home=await vm('/');assert.equal('banners' in home,false);assert.equal('bannersMeio' in home,false);
 assert.deepEqual(home.ads['home-topo'].banners.map(b=>b.id),['t-topo']);assert.deepEqual(home.ads['home-destaques'].banners.map(b=>b.id),['t-dest']);
 const leitura=await vm('/artigos/autocuidado-e-necessidade');assert.equal('banners' in leitura,false);assert.deepEqual(leitura.ads['leitura-fim'].banners.map(b=>b.id),['t-fim']);
 for(const path of ['/busca','/artigos'])assert.equal('banners' in (await vm(path)),false,path);
 assert.ok((await vm('/ofertas')).ads['ofertas-topo'].house);assert.ok((await vm('/eventos')).ads['eventos-topo'].house);
});

test('medição: impressões e cliques por dia, banner e espaço, com consentimento, sem duplicar; anúncio da PRIMIG também conta',async()=>{
 await banner('t-med','home-topo','super-banner');
 const ev=(name,campaign_id,slot,n)=>({event_id:`evento-teste-${name}-${n}-0000`,name,session_id:'sessao-teste-0000000001',campaign_id,consent:true,...(slot===undefined?{}:{slot})});
 const late=new Date('2026-10-06T01:30:00Z');// 22h30 do dia 05 em São Paulo
 await ingestEvent(db,ev('banner_viewed','t-med','home-topo',1),'10.0.0.1',late);
 await ingestEvent(db,ev('banner_viewed','t-med','home-topo',1),'10.0.0.1',late);// repetido
 await ingestEvent(db,ev('banner_viewed','t-med','home-topo',2),'10.0.0.1',late);
 await ingestEvent(db,ev('banner_clicked','t-med','home-topo',3),'10.0.0.1',late);
 await ingestEvent(db,ev('banner_viewed','primig-quadrado','busca-vazia',4),'10.0.0.1',late);
 await ingestEvent(db,ev('banner_viewed','t-med',undefined,5),'10.0.0.1',late);// sem slot (front antigo)
 const rows=(await db.query("SELECT to_char(day,'YYYY-MM-DD') AS day,campaign_id,slot,impressions,clicks FROM ad_daily ORDER BY campaign_id,slot")).rows;
 assert.deepEqual(rows,[{day:'2026-10-05',campaign_id:'primig-quadrado',slot:'busca-vazia',impressions:1,clicks:0},{day:'2026-10-05',campaign_id:'t-med',slot:'',impressions:1,clicks:0},{day:'2026-10-05',campaign_id:'t-med',slot:'home-topo',impressions:2,clicks:1}]);
 assert.equal((await db.query("SELECT slot FROM public_events WHERE event_id=$1",[ev('banner_clicked','t-med','home-topo',3).event_id])).rows[0].slot,'home-topo');
 for(const bad of [{...ev('banner_viewed','t-med','rodape',6)},{...ev('business_viewed',undefined,'home-topo',7),business_id:'boreal-tintas'},{...ev('banner_viewed','t-med','home-topo',8),consent:false},{...ev('banner_viewed','primig-inexistente','home-topo',9)}])
  await assert.rejects(ingestEvent(db,bad,'10.0.0.1',late),e=>e.status===422,JSON.stringify(bad));
 await db.query("UPDATE campaigns SET ends_at='2026-10-01T00:00:00Z' WHERE id='t-med'");
 await assert.rejects(ingestEvent(db,ev('banner_viewed','t-med','home-topo',10),'10.0.0.1',late),e=>e.status===422,'banner fora do período não mede');
});

test('proposta do banners.json (D3): desligada, e cada banner proposto entra no espaço sugerido quando ativado',async()=>{
 const {readFile}=await import('node:fs/promises');const {bannerState}=await import('../../api/import.mjs');
 const {banners}=JSON.parse(await readFile(new URL('../../conteudo-portal/banners.json',import.meta.url),'utf8'));
 const site=JSON.parse(await readFile(new URL('../../conteudo-portal/site.json',import.meta.url),'utf8')).banners;
 const imagem=Object.fromEntries(site.map(b=>[String(b.id),b.imagem||'']));
 assert.equal(banners.length,24);assert.ok(banners.every(b=>b.ativo===false&&!b.inicio&&!b.fim),'nada ativo nem período inventado');
 const slugs=new Set((await db.query('SELECT id FROM businesses')).rows.map(r=>r.id));
 const propostos=banners.filter(b=>b.posicao);assert.equal(propostos.length,14);
 const porPagina={};
 for(const b of propostos) {
  const e=ESPACOS.find(x=>x.id===b.posicao);assert.ok(e,b.id);assert.ok([...e.computador,...e.celular].includes(b.formato),`${b.id}: ${b.formato} em ${e.id}`);
  assert.ok(slugs.has(b.empresa),`${b.id}: empresa ${b.empresa}`);assert.notEqual(b.anunciante,'PRIMIG');
  if(b.imagemCelular){const m=banners.find(x=>x.id===b.imagemCelular);assert.ok(e.celular.includes(m.formato),`${b.id}: peça do celular ${m.formato}`);}
  const s=bannerState({...b,ativo:true,inicio:'2026-10-05',fim:'2026-12-31'},imagem[b.id],imagem);
  assert.equal(s.status,'published',b.id);assert.equal(s.placement,b.posicao);
  (porPagina[e.pagina]??=new Map()).set(b.anunciante,[...(porPagina[e.pagina].get(b.anunciante)||[]),b.posicao]);
 }
 // Sem banner morto: o mesmo anunciante não fica em dois espaços da mesma página (só o primeiro apareceria).
 for(const [pagina,m] of Object.entries(porPagina))for(const [quem,espacos] of m)assert.equal(new Set(espacos).size,1,`${pagina}: ${quem} em ${espacos}`);
 // A própria PRIMIG e os links de texto ficam de fora.
 assert.deepEqual(banners.filter(b=>!b.posicao).map(b=>b.id),['10','14','18','19','22','37','41','43','46','50']);
});
