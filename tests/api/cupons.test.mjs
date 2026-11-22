import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {pageRoute} from '../../api/server.mjs';
import {loadEntrar,loadPainel,loadMinhaConta} from '../../api/data/contas.mjs';
import {loadAdmin} from '../../api/data/admin/pagina.mjs';
import {sitemapEntries} from '../../api/data/sitemap.mjs';
import {ambiente} from './helpers-painel.mjs';

// v0.14.0 (contrato, seção 14): contas de usuário, cupons no painel, coleta só com login, minha conta e admin.
let t,dono,leitura,editorEquipe,adminEquipe,ana,bia;
const A='boreal-tintas',B='funeraria-sao-salvador',SENHA_ANA='senha-da-ana-123';
const cadastro=(body,opts={})=>t.req('/api/auth/cadastro',{method:'POST',body,...opts});
const sessao=r=>({cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.json.csrf,usuario:r.json.usuario});
const painel=(s,path='',opts={})=>t.com(s,`/api/painel/empresas/${A}${path}`,opts);
const pagina=async(path,s=null)=>{const url=new URL(path,'http://x');const sess=s?(await t.db.query('SELECT user_id FROM sessions WHERE csrf=$1',[s.csrf])).rows[0]:null;
  return pageRoute({db:t.db,path:url.pathname,url,now:t.agora,usuario:sess?.user_id||null,conta:s?{tipo:s.usuario.tipo,csrf:s.csrf}:null});};
const novoCupom=async(body={},s=dono)=>(await painel(s,'/cupons',{method:'POST',body:{titulo:'10% em tintas',condicoes:'Vale para tintas acrílicas, na loja de Santa Rita.',validade:'2026-10-31',...body}}));
before(async()=>{
 t=await ambiente();
 await t.conta('dono@cupom.test',{empresa:A});await t.conta('leitura@cupom.test',{empresa:A,papel:'leitura'});
 await t.conta('editor@cupom.test',{equipe:'editor'});await t.conta('admin@cupom.test',{equipe:'admin'});
 [dono,leitura,editorEquipe,adminEquipe]=await Promise.all(['dono@cupom.test','leitura@cupom.test','editor@cupom.test','admin@cupom.test'].map(e=>t.entrar(e)));
});
after(async()=>{await t?.fim();});

test('usuário cria a própria conta e já sai logado; o tipo vem no login e em /api/me',async()=>{
 const r=await cadastro({nome:'  Ana   Souza ',email:'Ana@Cupom.test',senha:SENHA_ANA,aceite:true});
 assert.equal(r.status,201);assert.deepEqual({...r.json.usuario,id:undefined},{id:undefined,email:'ana@cupom.test',nome:'Ana Souza',equipe:null,tipo:'usuario'});
 ana=sessao(r);assert.equal((await t.com(ana,'/api/me')).json.usuario.tipo,'usuario');
 assert.ok((await t.db.query("SELECT terms_accepted_at FROM users WHERE email='ana@cupom.test' AND kind='consumidor'")).rows[0].terms_accepted_at,'guarda a data do aceite');
 const repetido=await cadastro({nome:'Ana',email:'ana@cupom.test',senha:SENHA_ANA,aceite:true});
 assert.deepEqual([repetido.status,repetido.json.campo],[422,'email']);assert.match(repetido.json.erro,/já tem conta/);
 for(const [body,campo] of [[{nome:'A',email:'x@cupom.test',senha:SENHA_ANA,aceite:true},'nome'],[{nome:'Xis',email:'x@cupom.test',senha:'curta',aceite:true},'senha'],
   [{nome:'Xis',email:'x@cupom.test',senha:SENHA_ANA,aceite:false},'aceite'],[{nome:'Xis',email:'sem-arroba',senha:SENHA_ANA,aceite:true},'email']])
  assert.equal((await cadastro(body)).json.campo,campo,campo);
 assert.equal((await cadastro({nome:'Xis',email:'x@cupom.test',senha:SENHA_ANA,aceite:true,papel:'admin'})).json.campo,'papel','campo extra recusado');
 // Limite: 5 contas por IP real em 1 hora.
 for(let i=0;i<5;i++)assert.equal((await cadastro({nome:'Lote',email:`lote${i}@cupom.test`,senha:SENHA_ANA,aceite:true},{ip:'10.20.30.40'})).status,201);
 assert.equal((await cadastro({nome:'Lote',email:'lote9@cupom.test',senha:SENHA_ANA,aceite:true},{ip:'10.20.30.40'})).status,429);
 bia=sessao(await cadastro({nome:'Bia',email:'bia@cupom.test',senha:SENHA_ANA,aceite:true}));
 assert.equal(dono.usuario.tipo,'afiliado');assert.equal(editorEquipe.usuario.tipo,'equipe');
 assert.equal((await t.entrar('ana@cupom.test',SENHA_ANA)).usuario.tipo,'usuario');
 // Nome na minha conta.
 const n=await t.com(ana,'/api/me',{method:'PATCH',body:{nome:'Ana S.'}});assert.equal(n.json.usuario.nome,'Ana S.');
 assert.equal((await t.com(ana,'/api/me',{method:'PATCH',body:{nome:'Ana'},csrf:'x'})).status,403,'CSRF');
});

test('entrar: a opção certa e a volta para os cupons; usuário no painel vai para minha conta; sem acesso ao admin',async()=>{
 assert.deepEqual(loadEntrar(new URL('http://x/entrar')).vm,{next:'',motivo:'',tipo:'usuario'});
 assert.equal(loadEntrar(new URL('http://x/entrar?next=/painel/boreal-tintas')).vm.tipo,'afiliado');
 assert.equal(loadEntrar(new URL('http://x/entrar?next=/cupons&tipo=afiliado')).vm.tipo,'afiliado');
 assert.equal(loadEntrar(new URL('http://x/entrar?next=/cupons/abcdef123456')).vm.next,'/cupons/abcdef123456');
 assert.equal(loadEntrar(new URL('http://x/entrar?next=/minha-conta')).vm.next,'/minha-conta');
 assert.equal(loadEntrar(new URL('http://x/entrar?next=https://mal.test')).vm.next,'');
 const r=await t.com(ana,'/painel');assert.deepEqual([r.status,r.location],[303,'/minha-conta']);
 assert.equal((await t.com(ana,'/api/admin/resumo')).status,404);
 assert.equal((await t.com(ana,`/api/painel/empresas/${A}`)).status,404,'usuário não vê empresa');
 const m=await t.req('/minha-conta');assert.deepEqual([m.status,m.location],[303,'/entrar?next=%2Fminha-conta']);
});

let cupom;
test('afiliado cria cupom com regras; só dono e editor; código gerado legível; até 10 em vigor',async()=>{
 for(const [body,campo] of [[{titulo:'Oi'},'titulo'],[{condicoes:'curta'},'condicoes'],[{validade:'2026-10-04'},'validade'],[{validade:'2027-12-01'},'validade'],
   [{inicio:'2026-11-05'},'inicio'],[{quantidade:0},'quantidade'],[{quantidade:1.5},'quantidade'],[{codigo:'com espaço'},'codigo'],[{validade:'31/10/2026'},'validade']]) {
  const r=await novoCupom(body);assert.deepEqual([r.status,r.json.campo],[422,campo],JSON.stringify(body));
 }
 assert.equal((await novoCupom({},leitura)).status,403,'leitura não cria');
 assert.equal((await t.com(ana,`/api/painel/empresas/${A}/cupons`,{method:'POST',body:{}})).status,404);
 const r=await novoCupom({quantidade:2});assert.equal(r.status,201);cupom=r.json;
 assert.match(cupom.codigo,/^[A-HJ-NP-Z2-9]{8}$/);assert.equal(cupom.url,`/cupons/${cupom.id}`);
 assert.deepEqual({...cupom,id:0,codigo:0,criado:0},{id:0,titulo:'10% em tintas',condicoes:'Vale para tintas acrílicas, na loja de Santa Rita.',codigo:0,inicio:null,validade:'2026-10-31',
  quantidade:2,coletados:0,status:'ativo',suspensao:null,url:cupom.url,criado:0,version:1});
 t.agora=new Date(t.agora.getTime()+60000);
 const proprio=await novoCupom({titulo:'Frete grátis',codigo:'frete-boreal',inicio:'2026-10-10'});assert.equal(proprio.json.codigo,'FRETE-BOREAL');assert.equal(proprio.json.status,'agendado');
 const lista=(await painel(leitura,'/cupons')).json.cupons;assert.deepEqual(lista.map(c=>c.titulo),['Frete grátis','10% em tintas'],'leitura vê, os mais novos primeiro');
 const auditoria=(await t.db.query("SELECT action FROM audit_log WHERE resource_id=$1",[cupom.id])).rows.map(r=>r.action);assert.deepEqual(auditoria,['cupom_criado']);
 for(let i=0;i<8;i++)assert.equal((await novoCupom({titulo:`Cupom ${i}`})).status,201);
 const decimo=await novoCupom({titulo:'Cupom demais'});assert.equal(decimo.status,422);assert.match(decimo.json.erro,/até 10 cupons/);
 await t.db.query("UPDATE coupons SET status='removido' WHERE business_id=$1 AND title LIKE 'Cupom %'",[A]);
 // Módulo do painel: dados é o GET da lista; pode.cupons.
 const sess=(await t.db.query('SELECT s.*,u.email,u.name,u.staff_role,u.kind FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[dono.csrf])).rows[0];
 const vm=(await loadPainel({db:t.db,session:{...sess,tipo:'afiliado'},path:`/painel/${A}/cupons`,url:new URL(`http://x/painel/${A}/cupons`),now:t.agora})).vm;
 assert.equal(vm.modulo,'cupons');assert.equal(vm.pode.cupons,true);assert.equal(vm.dados.cupons.length,2);
});

test('público vê o cupom sem o código; coletar exige login e CSRF; coletar de novo não conta; esgota',async()=>{
 const lista=(await pagina('/cupons')).vm;
 assert.deepEqual(lista.items.map(c=>c.titulo),['10% em tintas'],'o agendado não aparece');
 assert.deepEqual(lista.items[0],{id:cupom.id,titulo:'10% em tintas',condicoes:cupom.condicoes,validade:'2026-10-31',restantes:2,esgotado:false,href:`/cupons/${cupom.id}`,
  empresa:{id:A,slug:A,name:'Boreal Tintas',image:lista.items[0].empresa.image,district:'Santa Rita',category:'Loja de Tintas'},coletado:false,codigo:''});
 assert.ok(!JSON.stringify(lista).includes(cupom.codigo),'o código não sai para quem não coletou');
 assert.deepEqual([lista.total,lista.pages,lista.current,lista.conta],[1,1,1,null]);
 assert.deepEqual(Object.keys(lista.ads),['cupons-topo'],'1 cupom: sem o meio da lista (16.2)');assert.equal(lista.ads['cupons-topo'].house.id,'primig-super-banner');
 assert.ok(lista.categorias.some(g=>g.subcategorias.some(c=>c.label==='Loja de Tintas')));
 assert.equal((await pagina('/cupons?categoria=alimentacao')).vm.total,0);assert.equal((await pagina('/cupons?q=acrilicas')).vm.total,1);
 assert.equal((await pagina('/cupons?page=2')).status,404);
 const detalhe=await pagina(`/cupons/${cupom.id}`);assert.equal(detalhe.status,200);assert.equal(detalhe.view,'cupom');
 assert.deepEqual(detalhe.vm.ads,{},'Boreal é pagante (página própria): nada no cupom (16.2)');assert.match(detalhe.title,/10% em tintas · Boreal Tintas/);
 assert.equal((await pagina('/cupons/000000000000')).status,404);
 // Coletar.
 const url=`/api/cupons/${cupom.id}/coletar`;
 assert.equal((await t.req(url,{method:'POST'})).status,401,'sem login');
 assert.equal((await t.req(url,{method:'POST',cookie:ana.cookie})).status,403,'sem CSRF');
 const c1=await t.com(ana,url,{method:'POST'});assert.equal(c1.status,200);assert.deepEqual([c1.json.coletado,c1.json.codigo],[true,cupom.codigo]);
 const c2=await t.com(ana,url,{method:'POST'});assert.deepEqual(c2.json,c1.json,'de novo: o mesmo, sem contar');
 assert.equal((await t.db.query('SELECT claimed FROM coupons WHERE id=$1',[cupom.id])).rows[0].claimed,1);
 const comAna=(await pagina('/cupons',ana)).vm;assert.deepEqual([comAna.items[0].coletado,comAna.items[0].codigo,comAna.conta.tipo],[true,cupom.codigo,'usuario']);
 assert.equal((await pagina(`/comercio/${A}`,ana)).vm.cupons[0].codigo,cupom.codigo,'o perfil da empresa mostra o cupom, com o código para quem coletou');
 assert.equal((await pagina(`/comercio/${A}`)).vm.cupons[0].codigo,'');
 assert.equal((await t.com(dono,url,{method:'POST'})).status,200,'qualquer conta logada coleta');
 const esgotou=await t.com(bia,url,{method:'POST'});assert.deepEqual([esgotou.status,esgotou.json.erro],[422,'Este cupom esgotou.']);
 assert.equal((await pagina('/cupons')).vm.total,0,'esgotado sai da lista');
 const esg=await pagina(`/cupons/${cupom.id}`);assert.deepEqual([esg.status,esg.vm.cupom.esgotado,esg.vm.cupom.restantes],[200,true,0]);
 assert.equal((await painel(dono,'/cupons')).json.cupons.find(c=>c.id===cupom.id).status,'esgotado');
 assert.equal((await t.com(ana,'/api/cupons/zzz/coletar',{method:'POST'})).status,404);
});

test('depois da coleta só mudam validade e quantidade; pausar e tirar encerram para quem coletou',async()=>{
 const atual=(await painel(dono,'/cupons')).json.cupons.find(c=>c.id===cupom.id);
 const mudou=await painel(dono,`/cupons/${cupom.id}`,{method:'PATCH',body:{version:atual.version,titulo:'20% em tintas'}});assert.deepEqual([mudou.status,mudou.json.campo],[422,'titulo']);
 assert.equal((await painel(dono,`/cupons/${cupom.id}`,{method:'PATCH',body:{version:atual.version,titulo:atual.titulo,condicoes:atual.condicoes}})).status,200,'o mesmo texto passa');
 const v2=(await painel(dono,'/cupons')).json.cupons.find(c=>c.id===cupom.id);
 assert.equal((await painel(dono,`/cupons/${cupom.id}`,{method:'PATCH',body:{version:v2.version,quantidade:1}})).json.campo,'quantidade','não fica abaixo dos coletados');
 assert.equal((await painel(dono,`/cupons/${cupom.id}`,{method:'PATCH',body:{version:1,validade:'2026-11-30'}})).status,409);
 const ok=await painel(dono,`/cupons/${cupom.id}`,{method:'PATCH',body:{version:v2.version,validade:'2026-11-30',quantidade:null}});
 assert.deepEqual([ok.json.validade,ok.json.quantidade,ok.json.status],['2026-11-30',null,'ativo']);
 const editado=(await t.db.query("SELECT before,after FROM audit_log WHERE action='cupom_editado' AND resource_id=$1 ORDER BY created_at DESC LIMIT 1",[cupom.id])).rows[0];
 assert.deepEqual([editado.before.validade,editado.after.validade],['2026-10-31','2026-11-30']);
 // Minha conta.
 let meus=(await t.com(ana,'/api/me/cupons')).json;assert.deepEqual(meus.map(c=>[c.id,c.codigo,c.situacao]),[[cupom.id,cupom.codigo,'valido']]);assert.ok(meus[0].coletadoEm);
 const sAna=(await t.db.query('SELECT s.*,u.email,u.name,u.staff_role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[ana.csrf])).rows[0];
 const conta=(await loadMinhaConta({db:t.db,session:{...sAna,tipo:'usuario'},now:t.agora})).vm;
 assert.deepEqual([conta.usuario.email,conta.usuario.tipo,conta.csrf,conta.cupons.length],['ana@cupom.test','usuario',ana.csrf,1]);
 const p=await painel(dono,`/cupons/${cupom.id}/pausar`,{method:'POST',body:{version:ok.json.version}});assert.equal(p.json.status,'pausado');
 meus=(await t.com(ana,'/api/me/cupons')).json;assert.equal(meus[0].situacao,'encerrado');
 assert.equal((await pagina(`/cupons/${cupom.id}`)).status,404,'pausado sai do ar');
 assert.equal((await t.com(bia,`/api/cupons/${cupom.id}/coletar`,{method:'POST'})).status,404);
 const re=await painel(dono,`/cupons/${cupom.id}/reativar`,{method:'POST',body:{version:p.json.version}});assert.equal(re.json.status,'ativo');
 // Vencido.
 // Vencido (sem mexer no relógio, que expiraria as sessões): validade de ontem.
 await t.db.query("UPDATE coupons SET ends_on='2026-10-04' WHERE id=$1",[cupom.id]);
 assert.equal((await t.com(ana,'/api/me/cupons')).json[0].situacao,'vencido');
 assert.equal((await painel(dono,'/cupons')).json.cupons.find(c=>c.id===cupom.id).status,'vencido');
 await t.db.query("UPDATE coupons SET ends_on='2026-11-30' WHERE id=$1",[cupom.id]);
 // Tirar do site.
 assert.equal((await painel(leitura,`/cupons/${cupom.id}`,{method:'DELETE'})).status,403);
 assert.deepEqual((await painel(dono,`/cupons/${cupom.id}`,{method:'DELETE'})).json,{ok:true});
 assert.ok(!(await painel(dono,'/cupons')).json.cupons.some(c=>c.id===cupom.id));
 assert.equal((await t.com(ana,'/api/me/cupons')).json[0].situacao,'encerrado');
 assert.equal((await painel(dono,`/cupons/${cupom.id}`,{method:'DELETE'})).status,404);
});

test('a equipe suspende e reativa; o afiliado não reativa o suspenso; resumo com cupons e recorte',async()=>{
 const c=(await novoCupom({titulo:'Leve 3 pague 2'})).json;
 await t.com(bia,`/api/cupons/${c.id}/coletar`,{method:'POST'});
 const admin=(path,opts)=>t.com(editorEquipe,`/api/admin${path}`,opts);
 const lista=(await admin(`/cupons?q=leve&empresa=${A}`)).json;assert.equal(lista.total,1);assert.deepEqual(lista.itens[0].empresa,{id:A,nome:'Boreal Tintas'});
 assert.equal((await admin('/cupons?status=removido')).json.total,9,'os 8 do limite e o tirado');
 assert.equal((await admin(`/cupons/${c.id}/suspender`,{method:'POST',body:{version:c.version}})).json.campo,'motivo');
 const s=await admin(`/cupons/${c.id}/suspender`,{method:'POST',body:{version:c.version,motivo:'Condição enganosa'}});
 assert.deepEqual([s.json.status,s.json.suspensao.motivo],['suspenso','Condição enganosa']);
 assert.equal((await t.com(bia,'/api/me/cupons')).json.find(x=>x.id===c.id).situacao,'encerrado');
 const p=await painel(dono,`/cupons/${c.id}/reativar`,{method:'POST',body:{version:s.json.version}});assert.deepEqual([p.status,p.json.campo],[422,'status']);
 assert.equal((await painel(dono,'/cupons')).json.cupons.find(x=>x.id===c.id).suspensao.motivo,'Condição enganosa','o afiliado vê o motivo');
 const r=await admin(`/cupons/${c.id}/reativar`,{method:'POST',body:{version:s.json.version}});assert.deepEqual([r.json.status,r.json.suspensao],['ativo',null]);
 assert.equal((await admin(`/cupons/${c.id}/reativar`,{method:'POST',body:{version:r.json.version}})).json.campo,'status','só o suspenso volta por aqui');
 // Resumo: cupons no ar e coletas de 30 dias; recorte por bairro e categoria (13.9, item 13).
 const resumo=(await admin('/resumo')).json;assert.equal(resumo.recorte,null);assert.deepEqual(resumo.cupons,{ativos:1,coletas30:3});
 const centro=(await admin('/resumo?bairro=Centro')).json;
 assert.deepEqual([centro.recorte,centro.cupons.ativos,centro.cupons.coletas30],[{bairro:'Centro',categoria:''},0,0]);
 assert.ok(centro.empresas.publicadas<resumo.empresas.publicadas);assert.equal(centro.bannersNoAr,resumo.bannersNoAr,'banners do guia todo');
 const sess=(await t.db.query('SELECT s.*,u.email,u.name,u.staff_role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[editorEquipe.csrf])).rows[0];
 const vm=(await loadAdmin({db:t.db,session:sess,path:'/admin',url:new URL('http://x/admin?bairro=Santa%20Rita'),now:t.agora})).vm;
 assert.deepEqual([vm.filtros.bairro,vm.dados.recorte,vm.dados.cupons.ativos,vm.pode.cupons],['Santa Rita',{bairro:'Santa Rita',categoria:''},1,true]);
 // Métricas do afiliado: coletas no período.
 assert.equal((await painel(dono,'/metricas?periodo=30d')).json.cupons,3);
 // Sitemap: a lista e o cupom no ar.
 const mapa=(await sitemapEntries(t.db,t.agora)).map(e=>e.path);assert.ok(mapa.includes('/cupons'));assert.ok(mapa.includes(`/cupons/${c.id}`));
});

test('afiliado edita nome, endereço, categorias e foto principal na hora; foto tirada deixa de ser a principal',async()=>{
 const v=(await painel(dono,'/perfil')).json;
 assert.deepEqual([v.nome,v.rua,v.bairro,v.cep,v.categorias],['Boreal Tintas','Estrada de Adrianopolis, 2600','Santa Rita',v.cep,['Loja de Tintas']]);
 assert.ok(v.opcoes.categorias.length>=10&&v.opcoes.categorias.every(g=>g.slug&&Array.isArray(g.subcategorias)),'todos os grupos da lista única');
 assert.ok(v.opcoes.bairros.includes('Santa Rita')&&v.opcoes.bairros.includes('Centro'));
 // Foto do portal como principal: vem em Perfil.fotos, aprovada.
 const portal=v.fotos.find(f=>f.id.startsWith('portal-'));
 if(portal){assert.equal(portal.status,'aprovada');assert.equal((await painel(dono,'',{method:'PATCH',body:{version:v.version,imagem:portal.url}})).status,200);}
 Object.assign(v,(await painel(dono,'/perfil')).json);
 assert.equal((await painel(dono,'',{method:'PATCH',body:{version:v.version,categorias:[]}})).json.campo,'categorias','publicada precisa de categoria');
 const r=await painel(dono,'',{method:'PATCH',body:{version:v.version,nome:'Boreal Tintas e Vernizes',rua:'Estrada de Adrianópolis, 2700',cep:'26041-000',categorias:['Loja de Tintas','Materiais de construção']}});
 assert.equal(r.status,200);assert.deepEqual(r.json.publicado.sort(),['categorias','cep','nome','rua']);assert.deepEqual(r.json.emAnalise,[]);
 const perfil=(await pagina(`/comercio/${A}`)).vm;
 assert.deepEqual([perfil.name,perfil.street,perfil.cep,perfil.categories],['Boreal Tintas e Vernizes','Estrada de Adrianópolis, 2700','26041-000',['Loja de Tintas','Materiais de construção']]);
 assert.match(perfil.directionsUrl,/Adrian%C3%B3polis/,'a rota usa o endereço novo');
 assert.equal((await t.db.query('SELECT details FROM businesses WHERE id=$1',[A])).rows[0].details.geo.precisao,'bairro','a posição fica aproximada');
 // Bairro novo: a posição sai.
 const v2=(await painel(dono,'/perfil')).json;await painel(dono,'',{method:'PATCH',body:{version:v2.version,bairro:'Centro'}});
 assert.equal((await t.db.query('SELECT district,details FROM businesses WHERE id=$1',[A])).rows[0].details.geo,undefined);
 // Foto principal: só foto aprovada da empresa.
 const mid='c'.repeat(32);
 await t.db.query("INSERT INTO media(id,business_id,kind,mime,width,height,bytes,sha256,sizes,status) VALUES($1,$2,'foto','image/webp',800,600,1,'x','[]','aprovada')",[mid,A]);
 const v3=(await painel(dono,'/perfil')).json;
 const img=await painel(dono,'',{method:'PATCH',body:{version:v3.version,imagem:`/midia/${mid}/1600.webp`}});assert.equal(img.status,200);
 assert.equal((await painel(dono,'/perfil')).json.imagem,`/midia/${mid}/800.webp`);assert.equal((await pagina(`/comercio/${A}`)).vm.image,`/midia/${mid}/800.webp`);
 await painel(dono,`/fotos/${mid}`,{method:'DELETE'});
 assert.equal((await painel(dono,'/perfil')).json.imagem,'','a foto tirada deixa de ser a principal');
 const aud=(await t.db.query("SELECT after FROM audit_log WHERE action='perfil_atualizado' AND business_id=$1 ORDER BY created_at",[A])).rows;assert.equal(aud[0].after.nome,'Boreal Tintas e Vernizes');
});

test('excluir a conta: só usuário, com a senha; apaga as coletas e encerra a sessão',async()=>{
 assert.equal((await t.com(dono,'/api/me',{method:'DELETE',body:{senha:'senha-de-teste-123'}})).status,403,'afiliado sai pela PRIMIG');
 assert.equal((await t.com(ana,'/api/me',{method:'DELETE',body:{senha:'errada-errada-1'}})).json.campo,'senha');
 const id=(await t.db.query("SELECT id FROM users WHERE email='ana@cupom.test'")).rows[0].id;
 assert.ok((await t.db.query('SELECT count(*)::int AS n FROM coupon_claims WHERE user_id=$1',[id])).rows[0].n>0);
 const r=await t.com(ana,'/api/me',{method:'DELETE',body:{senha:SENHA_ANA}});assert.deepEqual(r.json,{ok:true});assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await t.com(ana,'/api/me')).status,401);
 assert.equal((await t.db.query('SELECT count(*)::int AS n FROM coupon_claims WHERE user_id=$1',[id])).rows[0].n,0);
 assert.equal((await t.db.query("SELECT count(*)::int AS n FROM users WHERE email='ana@cupom.test'")).rows[0].n,0);
 assert.equal((await t.db.query("SELECT count(*)::int AS n FROM audit_log WHERE action='conta_excluida' AND resource_id=$1",[id])).rows[0].n,1);
});

test('anúncios nos cupons (16.2): topo e meio da lista; lateral no cupom de empresa não pagante, sem concorrente',async()=>{
 const G='garcia-churrasco';await t.conta('dono@garcia.test',{empresa:G});const g=await t.entrar('dono@garcia.test');
 const ids=[];for(let i=0;i<7;i++){const r=await t.com(g,`/api/painel/empresas/${G}/cupons`,{method:'POST',body:{titulo:`Churrasco ${i}`,condicoes:'Vale no salão, de segunda a sexta.',validade:'2026-10-31'}});assert.equal(r.status,201);ids.push(r.json.id);}
 const lista=(await pagina('/cupons')).vm;assert.ok(lista.items.length>=7);
 assert.deepEqual(Object.keys(lista.ads),['cupons-topo','cupons-meio']);assert.equal(lista.ads['cupons-meio'].aCada,6);assert.equal(lista.ads['cupons-meio'].house.format,'quadrado');
 assert.equal((await pagina(`/cupons/${ids[0]}`)).vm.ads['cupom-lateral'].house.format,'meia-pagina','não pagante: a PRIMIG na lateral');
 // Banner pago de um concorrente (mesma categoria) não entra no cupom; o de outra categoria entra.
 const cat=(await t.db.query('SELECT details->\'categories\'->>0 AS c FROM businesses WHERE id=$1',[G])).rows[0].c;
 const rival=(await t.db.query("SELECT id FROM businesses WHERE id<>$1 AND details->'categories' ? $2 LIMIT 1",[G,cat])).rows[0]?.id;
 const ins=(id,emp)=>t.db.query(`INSERT INTO campaigns(id,title,source,status,destination,image_url,placement,format,advertiser,business_id) VALUES($1,$1,'{}','published','/busca',$2,'cupom-lateral','meia-pagina',$1,$3)`,[id,'https://www.primigdivulgacao.com.br/custom/domain_1/image_files/teste.png',emp]);
 if(rival){await ins('t-rival',rival);assert.equal((await pagina(`/cupons/${ids[0]}`)).vm.ads['cupom-lateral'].banners.length,0,'concorrente fora');}
 await ins('t-outro','boreal-tintas');assert.deepEqual((await pagina(`/cupons/${ids[0]}`)).vm.ads['cupom-lateral'].banners.map(b=>b.id),['t-outro']);
 await t.db.query("DELETE FROM campaigns WHERE id IN ('t-rival','t-outro')");
});
