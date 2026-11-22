import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {pageRoute} from '../../api/server.mjs';
import {ambiente} from './helpers-painel.mjs';

// Fase 4: fila de aprovação, auditoria, usuários, solicitações e relatórios (contrato 13); assinantes e receita saíram (14.8).
let t,admin,editor,operador,dono;
const A='boreal-tintas';
before(async()=>{
 t=await ambiente();
 await t.conta('admin@fila.test',{equipe:'admin'});await t.conta('editor@fila.test',{equipe:'editor'});await t.conta('operador@fila.test',{equipe:'operador'});
 await t.conta('dono@fila.test',{empresa:A});
 [admin,editor,operador,dono]=await Promise.all(['admin@fila.test','editor@fila.test','operador@fila.test','dono@fila.test'].map(e=>t.entrar(e)));
});
after(async()=>{await t?.fim();});
const api=(s,path,opts)=>t.com(s,`/api/admin${path}`,opts);
const painel=(path,opts)=>t.com(dono,`/api/painel/empresas/${A}${path}`,opts);
const publico=async path=>{const url=new URL(path,'http://x');return (await pageRoute({db:t.db,path:url.pathname,url,now:t.agora,random:()=>0.5})).vm;};

test('fila: o associado manda, a equipe vê o antes e o depois, aprova ou recusa com comentário (Pronto quando)',async()=>{
 const item=(await painel('/catalogo',{method:'POST',body:{tipo:'produto',nome:'Tinta acrílica 3,6L',precoModo:'fixo',precoCentavos:8990}})).json;
 const v=(await painel('/perfil')).json.version;await painel('',{method:'PATCH',body:{version:v,descricao:'Tintas para casa e para a sua obra.'}});
 const foto=(await painel('/fotos',{method:'POST',raw:await sharp({create:{width:600,height:400,channels:3,background:'#36c'}}).jpeg().toBuffer(),type:'image/jpeg'})).json;
 const fila=(await api(editor,'/fila')).json;
 assert.deepEqual(fila.itens.map(i=>i.tipo).sort(),['catalogo','descricao','foto']);
 const desc=fila.itens.find(i=>i.tipo==='descricao'),cat=fila.itens.find(i=>i.tipo==='catalogo'),fot=fila.itens.find(i=>i.tipo==='foto');
 assert.equal(desc.dados.descricao,'Tintas para casa e para a sua obra.');assert.ok('antes' in desc.dados&&desc.dados.antes.resumo);
 assert.equal(cat.dados.nome,'Tinta acrílica 3,6L');assert.equal(cat.dados.antes,null,'item novo');assert.equal(fot.dados.id,foto.id);
 assert.deepEqual(desc.empresa,{id:A,nome:'Boreal Tintas'});assert.equal(desc.enviado.por.email,'dono@fila.test');
 assert.equal((await api(operador,`/fila/${cat.id}/aprovar`,{method:'POST',body:{version:cat.version}})).status,403,'operador não decide');
 // Recusar exige comentário; o associado vê o motivo.
 assert.equal((await api(editor,`/fila/${desc.id}/recusar`,{method:'POST',body:{version:desc.version}})).json.campo,'comentario');
 const rec=(await api(editor,`/fila/${desc.id}/recusar`,{method:'POST',body:{version:desc.version,comentario:'Conte o horário de entrega.'}})).json;assert.equal(rec.status,'recusado');
 assert.ok((await painel('')).json.depende.some(d=>d.tipo==='recusado'&&d.texto.includes('Conte o horário de entrega.')));
 assert.equal((await api(editor,`/fila/${desc.id}/aprovar`,{method:'POST',body:{version:rec.version}})).status,409,'já decidido');
 // Foto aprovada vai para o perfil.
 await api(editor,`/fila/${fot.id}/aprovar`,{method:'POST',body:{version:fot.version}});
 assert.ok((await publico(`/comercio/${A}`)).photos.some(p=>p.src.includes(foto.id)));
 // O associado mudou o item depois de mandar: o pedido antigo responde 409 e o novo é aprovado.
 const ed=(await painel(`/catalogo/${item.id}`,{method:'PATCH',body:{version:item.version,precoCentavos:7990}})).json;
 assert.equal((await api(editor,`/fila/${cat.id}/aprovar`,{method:'POST',body:{version:cat.version}})).status,409);
 const novo=(await api(editor,'/fila?tipo=catalogo')).json.itens[0];assert.equal(novo.dados.precoCentavos,7990);
 const ap=(await api(editor,`/fila/${novo.id}/aprovar`,{method:'POST',body:{version:novo.version}})).json;assert.equal(ap.status,'aprovado');assert.equal(ap.decidido.por.email,'editor@fila.test');
 assert.ok((await publico(`/comercio/${A}`)).catalog.some(c=>c.name==='Tinta acrílica 3,6L'&&c.priceCents===7990),'item do associado no ar');
 assert.equal((await painel('/catalogo')).json.itens.find(i=>i.id===item.id).status,'publicado');
 // Alteração do item publicado: a fila mostra o antes.
 const pub=(await painel('/catalogo')).json.itens.find(i=>i.id===item.id);
 await painel(`/catalogo/${item.id}`,{method:'PATCH',body:{version:pub.version,nome:'Tinta acrílica premium 3,6L'}});
 const alt=(await api(editor,'/fila?tipo=catalogo')).json.itens[0];assert.equal(alt.dados.antes.nome,'Tinta acrílica 3,6L');assert.equal(ed.status,'validacao');
 assert.ok((await api(editor,'/fila?status=aprovado')).json.itens.length>=2);
});

test('auditoria consultável por ação, empresa e usuário',async()=>{
 const r=(await api(operador,`/auditoria?acao=fila_aprovada&empresa=${A}`)).json;
 assert.ok(r.total>=2);assert.ok(r.itens.every(i=>i.acao==='fila_aprovada'&&i.empresa===A));assert.equal(r.itens[0].por.email,'editor@fila.test');
 assert.ok(r.itens[0].depois.tipo);
 const doDono=(await api(operador,'/auditoria?usuario=dono@fila.test')).json;assert.ok(doDono.itens.length>0&&doDono.itens.every(i=>i.por?.email==='dono@fila.test'));
 assert.equal((await api(operador,'/auditoria?de=10/10/2026')).json.campo,'de');
});

test('usuários e acessos: convidar associado, equipe pelo admin, desativar encerra sessões, link de senha e revogar',async()=>{
 t.mailerAtivo=false;
 const c=await api(operador,'/usuarios/convite',{method:'POST',body:{email:'novo@fila.test',empresa:'funeraria-sao-salvador',papel:'dono'}});
 assert.equal(c.status,201);assert.match(c.json.link,/definir-senha\?token=/);
 assert.equal((await api(operador,'/equipe',{method:'POST',body:{email:'novo.editor@primig.test',papel:'editor'}})).status,403);
 const eq=(await api(admin,'/equipe',{method:'POST',body:{email:'novo.editor@primig.test',papel:'editor'}})).json;assert.equal(eq.ativo,false);
 assert.equal(new Date(eq.expira)-t.agora,7*86400000,'link da equipe vale 7 dias');
 const lista=(await api(operador,'/usuarios?tipo=equipe')).json;assert.ok(lista.itens.some(u=>u.email==='novo.editor@primig.test'&&u.equipe==='editor'));
 const u=(await api(admin,'/usuarios?q=dono@fila.test')).json.itens[0];assert.deepEqual(u.acessos,[{empresa:{id:A,nome:'Boreal Tintas'},papel:'dono',ativo:true}]);
 const me=(await api(admin,'/usuarios?q=admin@fila.test')).json.itens[0];
 assert.equal((await api(admin,`/usuarios/${me.id}`,{method:'PATCH',body:{version:me.version,desativado:true}})).status,403,'ninguém se desativa');
 const link=(await api(operador,`/usuarios/${u.id}/link-senha`,{method:'POST'})).json;assert.match(link.link,/token=/);
 const outro=await t.entrar('dono@fila.test');
 assert.equal((await api(admin,`/usuarios/${u.id}/sessoes/encerrar`,{method:'POST'})).status,200);assert.equal((await t.com(outro,'/api/me')).status,401);
 dono=await t.entrar('dono@fila.test');
 const des=(await api(admin,`/usuarios/${u.id}`,{method:'PATCH',body:{version:u.version,desativado:true}})).json;assert.equal(des.desativado,true);
 assert.equal((await t.com(dono,'/api/me')).status,401,'desativado: sessões encerradas');
 await api(admin,`/usuarios/${u.id}`,{method:'PATCH',body:{version:des.version,desativado:false}});dono=await t.entrar('dono@fila.test');
 const fin=await t.conta('fin@fila.test',{empresa:A,papel:'financeiro'});
 assert.equal((await api(operador,`/usuarios/${fin}/acessos/${A}`,{method:'DELETE'})).status,200);
 assert.equal((await t.db.query('SELECT active FROM memberships WHERE user_id=$1',[fin])).rows[0].active,false);
 t.mailerAtivo=true;
});

test('solicitações do lado da equipe: resposta e status por versão',async()=>{
 const s=(await painel('/solicitacoes',{method:'POST',body:{tipo:'alteracao',assunto:'Endereço novo',texto:'Mudamos para a Rua A, 10.'}})).json;
 const l=(await api(editor,'/solicitacoes?status=aberta')).json;assert.ok(l.itens.some(x=>x.id===s.id&&x.empresa.id===A));
 assert.equal((await api(editor,`/solicitacoes/${s.id}/mensagens`,{method:'POST',body:{texto:'Atualizamos, confira.'}})).status,201);
 const r=(await api(editor,`/solicitacoes/${s.id}`)).json;assert.equal(r.status,'respondida');assert.deepEqual(r.mensagens.map(m=>m.autor.lado),['associado','equipe']);
 const f=(await api(editor,`/solicitacoes/${s.id}`,{method:'PATCH',body:{version:r.version,status:'fechada'}})).json;assert.equal(f.status,'fechada');
 assert.equal((await api(editor,`/solicitacoes/${s.id}`,{method:'PATCH',body:{version:r.version,status:'aberta'}})).status,409);
});

test('assinantes e receita saíram do site (14.8): sem APIs, sem tabela; o plano da empresa é definido pela equipe',async()=>{
 for(const path of ['/assinantes','/receita','/assinantes/x'])assert.equal((await api(operador,path)).status,404,path);
 assert.equal((await api(operador,'/assinantes',{method:'POST',body:{empresa:A,valorCentavos:1,inicio:'2026-10-05'}})).status,404);
 assert.equal((await t.db.query("SELECT to_regclass('public.subscriptions') AS t")).rows[0].t,null,'a migração 009 tirou a tabela');
 const plano=await api(admin,'/planos',{method:'POST',body:{nome:'Premium',ordem:10,patrocinado:true}});assert.equal(plano.status,201);
 const e=(await api(operador,`/empresas/${A}`)).json;
 assert.equal((await api(operador,`/empresas/${A}`,{method:'PATCH',body:{version:e.version,plano:'premium'}})).json.plano,'premium');
 const r=(await pageRoute({db:t.db,path:'/busca',url:new URL('http://x/busca?q=tintas'),now:t.agora})).vm;
 assert.equal(r.results.find(x=>x.slug===A)?.sponsored,true,'o plano da equipe vale na busca, sem assinatura');
 await t.db.query('UPDATE businesses SET plan_id=NULL');await t.db.query("DELETE FROM plans WHERE id='premium'");
});

test('relatórios: buscas sem resultado contadas no servidor, mais vistas, cliques e banners; filtro por bairro e categoria',async()=>{
 await t.req('/busca?q=Vidra%C3%A7aria');await t.req('/busca?q=vidracaria');await t.req('/busca?q=Boreal');
 await fetch(`${t.base}/busca?q=robozinho`,{headers:{'User-Agent':'Googlebot'}});
 for(let i=0;i<3;i++)await t.req('/api/events',{method:'POST',body:{event_id:`rel-v-${i}-0000000000`,name:'business_viewed',session_id:'sessao-relatorio-01',business_id:A,consent:true}});
 await t.req('/api/events',{method:'POST',body:{event_id:'rel-c-0-0000000000',name:'contact_clicked',channel:'whatsapp',session_id:'sessao-relatorio-01',business_id:A,consent:true}});
 await t.req('/api/events',{method:'POST',body:{event_id:'rel-h-0-0000000000',name:'banner_viewed',campaign_id:'primig-super-banner',slot:'home-topo',session_id:'sessao-relatorio-01',consent:true}});
 const r=(await api(editor,'/relatorios')).json;
 assert.deepEqual(r.buscasSemResultado,[{termo:'vidracaria',vezes:2}],'acento e caixa não separam; robô não conta');
 assert.deepEqual(r.maisVistas[0],{empresa:{id:A,nome:'Boreal Tintas'},visitas:3,buscas:1});assert.equal(r.cliques.whatsapp,1);
 assert.deepEqual(r.espacos,[{id:'home-topo',impressoes:1,cliques:0,ctr:0}]);assert.equal(r.banners[0].id,'primig-super-banner');
 const centro=(await api(editor,'/relatorios?bairro=Centro')).json;assert.deepEqual([centro.buscasSemResultado,centro.maisVistas],[[],[]],'Boreal fica em Santa Rita');
 const tintas=(await api(editor,'/relatorios?categoria=loja-de-tintas&periodo=7d')).json;assert.equal(tintas.maisVistas[0].empresa.id,A);assert.equal(tintas.periodo,'7d');
 assert.equal((await api(editor,'/relatorios?periodo=1ano')).json.campo,'periodo');
});
