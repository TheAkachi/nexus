import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Integração: servidor real sobre o acervo importado (PGlite; no CI também PostgreSQL 17 via DATABASE_URL).
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {createApp,pageRoute} from '../../api/server.mjs';
import {backup,restore,RESTORED_PASSWORD} from '../../api/backup.mjs';
import {safeURL} from '../../api/lib/saneamento.mjs';
import {mapa} from '../../api/mapa-baixada.mjs';
import {readFile} from 'node:fs/promises';

let db,server,base;
const origin='http://127.0.0.1:4180',business='funeraria-sao-salvador';
const call=(path,{method='GET',payload,originValue=origin}={})=>fetch(base+path,{method,redirect:'manual',headers:{Origin:originValue,'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
const html=async path=>(await call(path)).text();
before(async()=>{db=await openDB({path:':memory:'});await migrate(db);await importSnapshot(db);server=await createApp({db,origin});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.close();});

test('migrações e importação são idempotentes',async()=>{
 await migrate(db);assert.deepEqual({...await importSnapshot(db)},{businesses:43,content:160,campaigns:24,redirects:270});
});
test('conta e painel (Fase 3) e admin (Fase 4) abertos; pilotos seguem fora (contrato 12.5 e 13.2)',async()=>{
 const {views}=await import('../../api/views/index.mjs');
 for(const path of ['/conta','/recuperar','/pilotos','/experiencias'])assert.equal((await call(path)).status,404,path);
 for(const path of ['/assets/dashboard.js','/assets/admin.js','/assets/pilots.js','/assets/client.js'])assert.equal((await call(path)).status,404,path);
 // Sem sessão, o painel manda para /entrar; /entrar existe quando o front registrar a view (antes disso, 404).
 const painel=await call('/painel/'+business);assert.equal(painel.status,303);assert.equal(painel.headers.get('location'),'/entrar?next=%2Fpainel%2F'+business);
 assert.equal((await call('/entrar')).status,views.entrar?200:404);
 const login=await call('/api/auth/login',{method:'POST',payload:{email:'a@example.test',senha:'senha-errada-123'}});
 assert.equal(login.status,401);assert.deepEqual(await login.json(),{erro:'E-mail ou senha incorretos.'});
 for(const path of ['/api/me','/api/painel/empresas/'+business]){const r=await call(path);assert.equal(r.status,401,path);assert.ok((await r.json()).erro,path);}
 for(const path of ['/api/my/businesses/'+business,'/api/admin/summary','/api/admin/resumo'])assert.equal((await call(path)).status,404,path);
 const admin=await call('/admin/fila');assert.equal(admin.status,303);assert.equal(admin.headers.get('location'),'/entrar?next=%2Fadmin%2Ffila');
 assert.equal((await call('/',{method:'PATCH',payload:{}})).status,405);
});
test('arquivos do tema e logotipos são servidos (o visual do tema é testado em tests/views)',async()=>{
 for(const path of ['/assets/theme.js','/assets/logo-primig.png','/assets/logo-primig-branco.png','/assets/p2.css','/assets/site.js','/assets/favicon.svg'])assert.equal((await call(path)).status,200,path);
});
test('home, busca, filtros, perfis e estados vazios reais',async()=>{
 const home=await html('/');assert.match(home,/SUA CIDADE.<br><span>SUAS CONEXÕES.<\/span>/);assert.match(home,/name="category"/);const homeVM=(await pageRoute({db,path:'/',url:new URL(base+'/')})).vm;assert.equal(homeVM.businesses.length,13);
 for(const b of homeVM.businesses)assert.match(home,new RegExp(`href="/comercio/${b.slug}`),b.slug);
 assert.match(await html('/busca?q=Boreal&category=loja-de-tintas&district=Santa%20Rita'),/1 empresa encontrada/);
 assert.match(await html('/busca?q=naoexistezzzz'),/Não encontramos esse resultado/);
 const profile=await html('/comercio/'+business);assert.match(profile,/Funerária São Salvador/);assert.match(profile,/https:\/\/wa.me\/5521981330042/);assert.match(profile,/Horário informado/);assert.match(profile,/rel="canonical"/);assert.match(profile,/noindex,nofollow/);
 assert.equal((await call('/nao-existe')).status,404);
});
test('perfil: endereço limpo, rota pela coordenada e site sem parâmetros de rastreio',async()=>{
 const vm=async slug=>{const page=await html('/comercio/'+slug);return page;};
 const alvorada=await vm('alvorada-pet-racoes');assert.doesNotMatch(alvorada,/Rua ,|Brasil|26053170/);
 const row=async slug=>(await db.query('SELECT details FROM businesses WHERE id=$1',[slug])).rows[0].details;
 assert.deepEqual((({address,street,cep})=>({address,street,cep}))(await row('alvorada-pet-racoes')),{address:'Santa Rita, Nova Iguaçu',street:'',cep:'26053-170'});
 assert.equal((await row('boreal-tintas')).website,'https://linktr.ee/borealtintas');assert.doesNotMatch(await vm('boreal-tintas'),/utm_|fbclid/);
 const funeraria=await vm(business);assert.match(funeraria,/https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=-22\.75743,-43\.452798/);
 const buffet=(await db.query("SELECT count(*)::int AS n FROM businesses WHERE details->'categories' ?| array['Buffet','Serviços de Buffet','Buffets e Catering','Oficina mecênica']")).rows[0].n;assert.equal(buffet,0,'categorias normalizadas no seed');
});
test('todos os redirecionamentos (mapa do portal e categorias antigas) têm destino 200, sem cadeia',async()=>{
 for(const row of (await db.query('SELECT * FROM redirects')).rows){
  const r=await call(row.old_path);assert.equal(r.status,301,row.old_path);assert.equal(r.headers.get('location'),row.new_path);
  assert.equal((await call(row.new_path)).status,200,row.new_path);
 }
 for(const path of ['/artigos','/classificados','/para-empresas','/institucional/contato'])assert.equal((await call(path)).status,200,path);
});
test('URLs externas e scripts são bloqueados na renderização',async()=>{
 assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(safeURL('https://evil.test/a.jpg',{image:true}),'');
 await db.query("INSERT INTO content(id,kind,slug,title,body,source_url,status) VALUES('article:teste-script','article','teste-script','Artigo de teste','Texto <script>alert(1)</script>','https://www.primigdivulgacao.com.br/','published')");
 const page=await html('/artigos/teste-script');assert.match(page,/&lt;script&gt;/);assert.doesNotMatch(page,/<script>alert/);
});
test('campanha publicada respeita a janela de exibição',async()=>{
 assert.equal((await db.query("SELECT count(*)::int AS n FROM campaigns WHERE status='pending-review'")).rows[0].n,24);
 const id=randomUUID();
 await db.query("INSERT INTO campaigns(id,title,source,status,destination,image_url,business_id,placement,format) VALUES($1,'Banner teste','{}','published',$2,'https://www.primigdivulgacao.com.br/custom/domain_1/image_files/3_photo_35.png',$3,'home-topo','super-banner')",[id,'/comercio/'+business,business]);
 assert.match(await html('/'),new RegExp(`data-campaign="${id}"`));
 await db.query("UPDATE campaigns SET ends_at='2020-01-01T00:00:00Z' WHERE id=$1",[id]);
 assert.doesNotMatch(await html('/'),new RegExp(`data-campaign="${id}"`));
});
test('empresa pausada sai da busca, do perfil e do sitemap',async()=>{
 await db.query("INSERT INTO businesses(id,slug,name,district,summary,status) VALUES('teste-pausa','teste-pausa','Negócio sintético','Centro','Teste','published')");
 assert.equal((await call('/comercio/teste-pausa')).status,200);assert.match(await html('/sitemap.xml'),/teste-pausa/);
 await db.query("UPDATE businesses SET status='paused' WHERE id='teste-pausa'");
 assert.equal((await call('/comercio/teste-pausa')).status,404);assert.doesNotMatch(await html('/sitemap.xml'),/teste-pausa/);assert.doesNotMatch(await html('/busca?q=sintetico'),/Negócio sintético/);
});
test('métricas exigem consentimento, rejeitam dado pessoal e origem externa, e não duplicam',async()=>{
 const payload={event_id:randomUUID(),session_id:randomUUID(),name:'contact_clicked',business_id:business,channel:'whatsapp',consent:true};
 assert.equal((await call('/api/events',{method:'POST',payload:{...payload,consent:false}})).status,422);
 assert.equal((await call('/api/events',{method:'POST',payload:{...payload,phone:'21999999999'}})).status,422);
 assert.equal((await call('/api/events',{method:'POST',payload,originValue:'https://evil.test'})).status,403);
 for(let i=0;i<2;i++)assert.equal((await call('/api/events',{method:'POST',payload})).status,200);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public_events WHERE event_id=$1',[payload.event_id])).rows[0].n,1);
});
const form=(path,data,originValue=origin)=>fetch(base+path,{method:'POST',redirect:'manual',headers:{Origin:originValue,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)});
const totals=async()=>(await db.query('SELECT (SELECT count(*)::int FROM businesses) AS businesses,(SELECT count(*)::int FROM content) AS content,(SELECT count(*)::int FROM public_events) AS events')).rows[0];
test('cadastro monta a mensagem com as respostas e redireciona para o WhatsApp do Leandro sem gravar nada (17)',async()=>{
 const page=await html('/cadastro?interesse=plano-premium');assert.match(page,/method="post" action="\/cadastro"/);assert.match(page,/value="plano-premium"[^>]*checked/);
 assert.match(await html('/para-empresas'),/href="\/cadastro\?interesse=campanha-basica#signup-title"/);
 const before=await totals();
 // Caixas com a chave repetida (canais=instagram&canais=google), como o navegador manda.
 const respostas=new URLSearchParams([['ramo','alimentacao'],['local','nova-iguacu'],['canais','google'],['canais','instagram'],['plano','plano-premium'],['banner','nao']]);
 const r=await form('/cadastro',respostas);
 assert.equal(r.status,303);const location=new URL(r.headers.get('location'));assert.equal(location.origin+location.pathname,'https://wa.me/5521982155579');
 const text=location.searchParams.get('text');assert.match(text,/^Olá, Leandro! Tenho interesse em me tornar afiliado à PRIMIG\./);
 assert.match(text,/Meu negócio é do ramo de alimentação\. Ele fica em Nova Iguaçu\. Hoje os clientes me encontram pelo Instagram e pelo Google\./);
 assert.match(text,/Tenho interesse no Plano Premium \(R\$ 350,00\/mês\)\./);assert.doesNotMatch(text,/banner/i,'"Não, por enquanto" não vira frase');assert.doesNotMatch(text,/novidades/);
 assert.deepEqual(await totals(),before);
 const invalid=await form('/cadastro',{ramo:'<script>x</script>',local:'',plano:'plano-inexistente'});assert.equal(invalid.status,422);
 const body=await invalid.text();assert.match(body,/Escolha uma opção da lista/);assert.match(body,/Escolha onde fica o seu negócio/);assert.doesNotMatch(body,/<script>x<\/script>/);
 const sub=new URL((await form('/cadastro',{ramo:'automotivo',local:'so-online',plano:'conhecer',novidades:'sim'})).headers.get('location')).searchParams.get('text');
 assert.match(sub,/Meu negócio é do ramo automotivo\. Ele funciona só pela internet\./);assert.match(sub,/Quero receber novidades da PRIMIG pelo WhatsApp\./);
 assert.equal((await form('/cadastro',new URLSearchParams([['ramo','alimentacao'],['local','nova-iguacu'],['plano','conhecer'],['__proto__','x'],['constructor','y']]))).status,303,'nome de campo estranho não quebra');
 assert.equal((await form('/cadastro',{ramo:'alimentacao',local:'nova-iguacu',plano:'conhecer'},'https://evil.test')).status,403);
 assert.match((await call('/')).headers.get('content-security-policy'),/form-action 'self' https:\/\/wa\.me https:\/\/api\.whatsapp\.com$/);
});
test('mapa da região das empresas: um ponto por empresa localizada, sem inventar posição',async()=>{
 const {empresas,semLocal}=JSON.parse(await readFile(new URL('../../conteudo-portal/localizacoes.json',import.meta.url),'utf8'));
 const page=await html('/'),home=page.slice(page.indexOf('<figure class="future-map'),page.indexOf('</figure>')+9);
 const points=[...home.matchAll(/<a class="map-point( is-approx)?" href="\/comercio\/([^"?]+)\?from=home"><circle cx="([\d.]+)" cy="([\d.]+)"/g)];
 assert.equal(points.length,Object.keys(empresas).length);assert.equal(points.filter(p=>p[1]).length,Object.values(empresas).filter(e=>e.precisao==='bairro').length);
 assert.deepEqual(points.map(p=>p[2]).sort(),Object.keys(empresas).sort());
 for(const slug of semLocal)assert.doesNotMatch(home,new RegExp(`href="/comercio/${slug}\\?from=home"`));
 assert.match(home,new RegExp(`${points.length} empresas no mapa`));assert.match(home,new RegExp(`${semLocal.length} sem endereço no acervo`));
 // O quadro inicial contém todos os pontos; a área do SVG em volta dele só completa telas de outra proporção.
 const q=mapa.quadro;assert.ok(home.includes(`data-quadro="${q.x} ${q.y} ${q.w} ${q.h}" data-area="${mapa.largura} ${mapa.altura}"`));
 for(const p of points){assert.ok(+p[3]>=q.x&&+p[3]<=q.x+q.w&&+p[4]>=q.y&&+p[4]<=q.y+q.h,`${p[2]} dentro do quadro inicial`);}
 const geo=(await db.query("SELECT details->'geo' AS geo FROM businesses WHERE id='grupo-concreto-bombeado'")).rows[0].geo;assert.ok(geo.lat>-22.8&&geo.lng<-43.5,'coordenada do portal fora do município foi corrigida');
 // Camadas: cada <use> da página aponta para um caminho que existe no SVG, servido com gzip e revalidado por ETag.
 const svg=await fetch(base+'/assets/mapa-baixada.svg',{headers:{'Accept-Encoding':'gzip'}}),layers=await svg.text();
 assert.equal(svg.status,200);assert.match(svg.headers.get('content-type'),/image\/svg\+xml/);assert.equal(svg.headers.get('content-encoding'),'gzip');assert.match(layers,new RegExp(`viewBox="0 0 ${mapa.largura} ${mapa.altura}"`));
 const used=[...home.matchAll(/<use href="\/assets\/mapa-baixada\.svg#([\w-]+)"/g)].map(m=>m[1]);assert.ok(used.length>=10);
 for(const id of used)assert.ok(layers.includes(`<path id="${id}" d="m`),`camada ${id} existe no SVG`);
 assert.equal((await fetch(base+'/assets/mapa-baixada.svg',{headers:{'If-None-Match':svg.headers.get('etag')}})).status,304,'revalidação sem baixar de novo');
 const ratio=+(await html('/assets/p2.css')).match(/--map-r:([\d.]+)/)[1];assert.ok(Math.abs(ratio-q.w/q.h)<.005,'proporção do CSS igual à do quadro gerado');
});
test('busca relaciona categorias e bairros para os filtros dependentes',async()=>{
 const page=await html('/busca');
 const gnv=(await db.query("SELECT DISTINCT district FROM businesses WHERE status='published' AND district<>'' AND details->'categories' @> '[\"GNV\"]'::jsonb")).rows.map(r=>r.district).sort();
 assert.ok(gnv.length>0);
 const option=page.match(/<option value="gnv" data-districts="([^"]*)"/);assert.ok(option,'categoria GNV com bairros');assert.deepEqual(option[1].split('|').sort(),gnv);
 const districts=[...page.matchAll(/<option data-categories="([^"]*)"\s*>([^<]+)<\/option>/g)].map(([,categories,name])=>({name,categories:categories.split('|')}));
 assert.ok(districts.length>gnv.length,'há bairros sem GNV');
 for(const d of districts)assert.equal(d.categories.includes('gnv'),gnv.includes(d.name),d.name);
 assert.match(await html('/assets/site.js'),/select\[name=category\]/);
});
test('plano personalizado com valor a combinar segue para o cadastro',async()=>{
 const plans=await html('/para-empresas');assert.match(plans,/<h3>Personalizado<\/h3><p class="pricing-price"><strong>A combinar<\/strong><\/p>/);assert.match(plans,/href="\/cadastro\?interesse=plano-personalizado#signup-title">Quero um plano personalizado/);
 const r=await form('/cadastro',{ramo:'automotivo',local:'mesquita',plano:'plano-personalizado'});assert.equal(r.status,303);
 const text=new URL(r.headers.get('location')).searchParams.get('text');assert.match(text,/Tenho interesse no Plano Personalizado \(valor a combinar\)\./);
});
test('contato envia pelo WhatsApp do Leandro e valida a mensagem',async()=>{
 const r=await form('/institucional/contato',{nome:'João',assunto:'Dúvida',mensagem:'Como anuncio no guia?'});assert.equal(r.status,303);
 const text=new URL(r.headers.get('location')).searchParams.get('text');assert.match(text,/^Olá, Leandro! Vim pelo site/);assert.match(text,/\*Assunto:\* Dúvida/);assert.match(text,/Como anuncio no guia\?/);assert.match(text,/Enviado pelo site 127\.0\.0\.1:4180/);
 assert.match(text,/\*Aceita receber novidades:\* não/);
 const invalid=await form('/institucional/contato',{nome:'J',mensagem:'',novidades:'sim'});assert.equal(invalid.status,422);assert.match(await invalid.text(),/Informe seu nome com pelo menos 2 letras/);
});
test('backup criptografado restaura dados e rejeita senha errada, corrupção e banco preenchido',async()=>{
 await db.query("INSERT INTO users(id,email,password_hash) VALUES('usuario-teste','teste@example.test','scrypt$segredo-de-teste')");
 const archive=await backup(db,'passphrase-for-test-only');const target=await openDB({url:null,path:':memory:'});
 try{
  await migrate(target);await assert.rejects(restore(target,archive,'wrong-password'));
  await assert.rejects(restore(target,{...archive,data:'broken'},'passphrase-for-test-only'));
  const counts=await restore(target,archive,'passphrase-for-test-only');assert.equal(counts.businesses,44);assert.equal(counts.content,161);assert.equal(counts.users,1);
  assert.equal((await target.query("SELECT password_hash FROM users WHERE id='usuario-teste'")).rows[0].password_hash,RESTORED_PASSWORD,'o backup comum não leva o hash da senha');
  await assert.rejects(restore(target,archive,'passphrase-for-test-only'));
 }finally{await target.close();}
});
// v0.22.0: as categorias criadas pela equipe (22.1) vão no backup e voltam depois das contas, a quem criada_por aponta.
test('backup leva as categorias criadas pela equipe e as devolve na restauração, depois das contas',async()=>{
 const origem=await openDB({url:null,path:':memory:'}),destino=await openDB({url:null,path:':memory:'});
 try{
  await migrate(origem);await migrate(destino);
  await origem.query("INSERT INTO users(id,email,password_hash,staff_role,kind) VALUES('equipe-teste','equipe@example.test','scrypt$segredo-de-teste','admin','equipe')");
  await origem.query("INSERT INTO categories(nome,slug,grupo,criada_em,criada_por) VALUES('Banho e tosa','banho-e-tosa','pets','2026-10-29T12:00:00Z','equipe-teste')");
  const counts=await restore(destino,await backup(origem,'passphrase-for-test-only'),'passphrase-for-test-only');
  assert.deepEqual([counts.users,counts.categories],[1,1]);
  assert.deepEqual((await destino.query("SELECT nome,slug,grupo,criada_em::text AS em,criada_por FROM categories")).rows,
   [{nome:'Banho e tosa',slug:'banho-e-tosa',grupo:'pets',em:'2026-10-29 12:00:00+00',criada_por:'equipe-teste'}]);
 }finally{await origem.close();await destino.close();}
});
test('PostgreSQL local mantém dados depois de fechar e reabrir',{skip:!!process.env.DATABASE_URL},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'primig-persistencia-'));let local;
 try{local=await openDB({path:dir});await migrate(local);await local.query("INSERT INTO businesses(id,slug,name) VALUES('persist','persist','Persistência')");await local.close();local=await openDB({path:dir});assert.equal((await local.query("SELECT name FROM businesses WHERE id='persist'")).rows[0].name,'Persistência');}
 finally{if(local)await local.close();await rm(dir,{recursive:true,force:true});}
});
