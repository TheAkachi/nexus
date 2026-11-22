import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {loadAdmin} from '../../api/data/admin/pagina.mjs';
import {loadEntrar} from '../../api/data/contas.mjs';
import {textoConviteWhatsapp} from '../../api/lib/email.mjs';
import {ambiente} from './helpers-painel.mjs';

// Acessos dos anunciantes ao painel (contrato 21, v0.21.0): a lista com a situação de cada empresa, o convite pela rota do
// admin com o WhatsApp da empresa quando o e-mail não sai, o reenvio e o cancelamento pelas rotas do painel, e o link do
// convite só na resposta. Só empresas de teste em rascunho e o e-mail de teste; o banco é de memória e some no fim.
const EMAIL='pedrosiqueira14122005+convite-teste@gmail.com',ZAP='5521900000000';
const T1='teste-acessos-convite',T2='teste-acessos-vencido',T3='teste-acessos-membro';
let t,admin,operador,editor,membro;
const lista=(s,q='')=>t.com(s,`/api/admin/acessos?q=apagar${q}`).then(r=>r.json);
const item=async(s,id)=>(await t.com(s,`/api/admin/acessos?empresa=${id}`)).json.itens[0];
const convidar=(s,empresa)=>t.com(s,'/api/admin/usuarios/convite',{method:'POST',body:{email:EMAIL,empresa,papel:'dono'}});
const sessaoDe=async s=>(await t.db.query('SELECT s.id,s.user_id,s.csrf,s.token_hash,u.email,u.name,u.staff_role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[s.csrf])).rows[0];
before(async()=>{
  t=await ambiente();t.mailerAtivo=false;
  for(const [id,nome,details] of [[T1,'Empresa de teste dos acessos (apagar)',{email:EMAIL,whatsapp:ZAP}],[T2,'Empresa de teste dos acessos vencidos (apagar)',{}],
    [T3,'Empresa de teste dos acessos com membro (apagar)',{email:'Contato@Membro.test'}]])
    await t.db.query("INSERT INTO businesses(id,slug,name,status,details) VALUES($1,$1,$2,'draft',$3)",[id,nome,JSON.stringify(details)]);
  await t.conta('admin@acessos.test',{equipe:'admin'});await t.conta('operador@acessos.test',{equipe:'operador'});await t.conta('editor@acessos.test',{equipe:'editor'});
  await t.conta('membro@acessos.test',{empresa:T3,papel:'dono'});
  await entrarTodos();
});
async function entrarTodos() {
  [admin,operador,editor,membro]=[await t.entrar('admin@acessos.test'),await t.entrar('operador@acessos.test'),await t.entrar('editor@acessos.test'),await t.entrar('membro@acessos.test')];
}
after(async()=>{await t?.fim();});

test('lista: a situação de cada empresa, o contato, a sugestão do convite, a contagem e o que cada papel pode fazer',async()=>{
  const r=await lista(admin);
  assert.deepEqual(r.itens.map(i=>i.empresa.nome),r.itens.map(i=>i.empresa.nome).sort(new Intl.Collator('pt-BR').compare),'ordem alfabética');
  const [um,tres]=[r.itens.find(i=>i.empresa.id===T1),r.itens.find(i=>i.empresa.id===T3)];
  assert.deepEqual(um,{empresa:{id:T1,nome:'Empresa de teste dos acessos (apagar)',status:'rascunho',bairro:''},situacao:'sem-conta',contato:{email:EMAIL,whatsapp:ZAP},
    membros:[],convites:[],convite:{email:EMAIL,papel:'dono'}});
  assert.deepEqual([tres.situacao,tres.membros.map(m=>[m.usuario.email,m.papel]),tres.convite],['com-acesso',[['membro@acessos.test','dono']],{email:'contato@membro.test',papel:'dono'}]);
  assert.deepEqual(r.contagem,{semConta:2,convitePendente:0,conviteVencido:0,comAcesso:1});
  assert.deepEqual([r.acoes,(await lista(operador)).acoes],[{convidar:true,reenviar:true,cancelar:true},{convidar:true,reenviar:false,cancelar:false}]);
  assert.deepEqual((await lista(admin,'&situacao=com-acesso')).itens.map(i=>i.empresa.id),[T3]);
  assert.equal((await lista(admin,'&situacao=outra')).itens.length,3,'situação desconhecida é ignorada');
});

test('convidar pela lista: sem e-mail, o link e o WhatsApp da empresa com a mensagem pronta; o link não aparece na lista nem na auditoria',async()=>{
  const r=await convidar(operador,T1);
  assert.equal(r.status,201);
  assert.deepEqual([r.json.email,r.json.papel,r.json.enviado,r.json.ativo],[EMAIL,'dono',false,false]);
  assert.match(r.json.link,/\/entrar\/definir-senha\?token=[A-Za-z0-9_-]+$/);
  assert.ok(r.json.whatsapp.startsWith(`https://wa.me/${ZAP}?text=`));
  assert.equal(decodeURIComponent(r.json.whatsapp.split('?text=')[1]),textoConviteWhatsapp({empresa:'Empresa de teste dos acessos (apagar)',papel:'dono',link:r.json.link,validade:'12/10/2026'}));
  const i=await item(admin,T1);
  assert.deepEqual([i.situacao,i.convites],['convite-pendente',[{email:EMAIL,papel:'dono',expira:r.json.expira,vencido:false}]]);
  const token=r.json.link.split('token=')[1];
  assert.doesNotMatch(JSON.stringify((await t.com(admin,'/api/admin/acessos')).json),new RegExp(`${token}|definir-senha|token`));
  assert.doesNotMatch(JSON.stringify((await t.db.query('SELECT before,after FROM audit_log WHERE business_id=$1',[T1])).rows),new RegExp(`${token}|definir-senha`));
  // A página do admin já aberta na empresa traz a mesma lista, sem o link.
  const p=await loadAdmin({db:t.db,session:await sessaoDe(admin),path:'/admin/acessos',url:new URL(`http://x/admin/acessos?empresa=${T1}`),now:t.agora});
  assert.deepEqual([p.status,p.vm.modulo,p.vm.filtros,p.vm.dados.itens.map(x=>x.empresa.id)],[200,'acessos',{empresa:T1},[T1]]);
  assert.match(p.title,/^Acessos ao painel · Admin \| Guia PRIMIG$/);
  assert.doesNotMatch(JSON.stringify(p.vm),new RegExp(token));
});

test('reenviar e cancelar pelas rotas do painel: o admin sim, o operador não; o reenvio da equipe traz o WhatsApp',async()=>{
  const reenviar=s=>t.com(s,`/api/painel/empresas/${T1}/acessos/convites/reenviar`,{method:'POST',body:{email:EMAIL}});
  assert.equal((await reenviar(operador)).status,403);
  const r=await reenviar(admin);
  assert.deepEqual([r.status,r.json.enviado],[201,false]);
  assert.ok(r.json.whatsapp.includes(encodeURIComponent(r.json.link)),'o WhatsApp leva o link novo');
  assert.equal((await t.com(admin,`/api/painel/empresas/${T1}/acessos/convites/cancelar`,{method:'POST',body:{email:EMAIL}})).json.ok,true);
  assert.deepEqual([(await item(admin,T1)).situacao,(await item(admin,T1)).convites],['sem-conta',[]],'o cancelado não conta');
});

test('convite vencido: depois de 7 dias vira vencido, não se reenvia e um convite novo volta a pendente; sem WhatsApp na empresa, sem o link dele',async()=>{
  const r=await convidar(admin,T2);
  assert.deepEqual([r.status,r.json.whatsapp,Boolean(r.json.link)],[201,'',true],'a empresa não tem WhatsApp');
  // Oito dias depois: as sessões venceram, então a equipe entra de novo (o relógio segue adiante nos próximos testes).
  t.agora=new Date(t.agora.getTime()+8*86400000);await entrarTodos();
  const i=await item(admin,T2);
  assert.deepEqual([i.situacao,i.convites.map(c=>c.vencido)],['convite-vencido',[true]]);
  assert.equal((await t.com(admin,`/api/painel/empresas/${T2}/acessos/convites/reenviar`,{method:'POST',body:{email:EMAIL}})).status,404);
  assert.equal((await convidar(admin,T2)).status,201);
  assert.equal((await item(admin,T2)).situacao,'convite-pendente');
});

test('com o e-mail ligado, o link e o WhatsApp não voltam; aceito o convite, a empresa passa a ter acesso',async()=>{
  t.mailerAtivo=true;
  try {
    const r=await convidar(admin,T1);
    assert.deepEqual([r.json.enviado,r.json.link,r.json.whatsapp],[true,'','']);
  } finally {t.mailerAtivo=false;}
  const link=(await convidar(admin,T1)).json.link;
  assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:link.split('token=')[1],senha:'senha-do-convite-123'}})).status,200);
  const i=await item(admin,T1);
  assert.deepEqual([i.situacao,i.membros.map(m=>[m.usuario.email,m.papel]),i.convites],['com-acesso',[[EMAIL,'dono']],[]]);
});

test('quem vê: o editor da equipe recebe 403 na API e na página, quem não é da equipe 404, e sem sessão vai para o login',async()=>{
  assert.equal((await t.com(editor,'/api/admin/acessos')).status,403);
  const p=await loadAdmin({db:t.db,session:await sessaoDe(editor),path:'/admin/acessos',url:new URL('http://x/admin/acessos'),now:t.agora});
  assert.deepEqual([p.status,p.vm.dados],[403,null]);
  assert.equal((await t.com(membro,'/api/admin/acessos')).status,404);
  assert.equal((await loadAdmin({db:t.db,session:await sessaoDe(admin),path:'/admin/acessos/x',url:new URL('http://x/admin/acessos/x'),now:t.agora})).status,404);
  // Sem sessão, o login volta para a lista já na empresa; outra consulta não passa pelo next.
  const sem=await t.req(`/admin/acessos?empresa=${T1}`);
  assert.deepEqual([sem.status,sem.location],[303,`/entrar?next=${encodeURIComponent(`/admin/acessos?empresa=${T1}`)}`]);
  assert.equal((await t.req('/admin/acessos?empresa=Fora%20do%20formato')).location,`/entrar?next=${encodeURIComponent('/admin/acessos')}`);
  const next=async v=>(await loadEntrar(new URL(`http://x/entrar?next=${encodeURIComponent(v)}`))).vm.next;
  assert.equal(await next(`/admin/acessos?empresa=${T1}`),`/admin/acessos?empresa=${T1}`);
  for(const v of [`/admin/acessos?empresa=${T1}&volta=https://exemplo.test`,'/admin/empresas?empresa=x','/painel?empresa=x','//exemplo.test/admin/acessos?empresa=x'])assert.equal(await next(v),'',v);
});
