import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {loadPainel,loadDefinirSenha} from '../../api/data/contas.mjs';
import {issueToken,ensureUser} from '../../api/auth.mjs';
import {ambiente,origin} from './helpers-painel.mjs';

// Pedidos do front para o painel (contrato 12.6, v0.12.1).
let t,dono;
const A='garcia-churrasco';
before(async()=>{t=await ambiente();await t.conta('dono@pedidos.test',{empresa:A});dono=await t.entrar('dono@pedidos.test');});
after(async()=>{await t?.fim();});
const api=(path,opts)=>t.com(dono,`/api/painel/empresas/${A}${path}`,opts);
const sessao=async s=>(await t.db.query('SELECT s.id,s.user_id,s.csrf,s.token_hash,u.email,u.name,u.staff_role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[s.csrf])).rows[0];
const ev=async(name,extra,n,diasAtras)=>{const salvo=t.agora;t.agora=new Date(salvo.getTime()-diasAtras*86400000);
 for(let i=0;i<n;i++)await t.req('/api/events',{method:'POST',body:{event_id:`ped-${name}-${diasAtras}-${i}-${Math.random().toString(36).slice(2,10)}`,name,session_id:'sessao-pedidos-00001',business_id:A,consent:true,...extra}});
 t.agora=salvo;};

test('resumo: card da busca e comparação com os 30 dias anteriores; métricas com o período anterior (null em 90d)',async()=>{
 await ev('business_viewed',{},4,2);await ev('business_viewed',{},6,40);await ev('contact_clicked',{channel:'whatsapp'},1,5);await ev('contact_clicked',{channel:'phone'},2,9);
 const r=(await api('')).json;
 assert.equal(r.aparece.card.slug,A);assert.deepEqual(Object.keys(r.aparece.card).slice(0,7),['slug','name','image','category','district','city','summary']);
 assert.deepEqual([r.aparece.visitas30,r.aparece.visitas30Antes,r.aparece.buscas30Antes],[4,6,0]);
 const m7=(await api('/metricas?periodo=7d')).json;assert.deepEqual(m7.anterior,{visitas:0,cliques:2,buscas:0,cupons:0},'dias 8 a 14 atrás: os 2 do telefone');assert.equal(m7.cliques.whatsapp,1,'o de 5 dias atrás fica no período atual');
 assert.deepEqual((await api('/metricas?periodo=30d')).json.anterior,{visitas:6,cliques:0,buscas:0,cupons:0});
 assert.equal((await api('/metricas?periodo=90d')).json.anterior,null);
 await t.db.query("UPDATE businesses SET status='paused' WHERE id=$1",[A]);
 assert.equal((await api('')).json.aparece.card,null,'pausada: sem prévia');
 await t.db.query("UPDATE businesses SET status='published' WHERE id=$1",[A]);
});

test('pendências com âncora para o campo, o item e a solicitação',async()=>{
 const ancora={foto:'/perfil#fotos',horario:'/perfil#horario',whatsapp:'/perfil#campo-whatsapp',descricao:'/perfil#campo-descricao',redes:'/perfil#redes',endereco:'/perfil#campo-rua'};
 const r=(await api('')).json,faltam=r.aparece.completo.filter(c=>!c.ok);
 assert.ok(faltam.length>0,'a empresa de teste tem campos faltando');
 assert.deepEqual(r.depende.filter(d=>d.tipo==='completar').map(d=>d.href),faltam.map(c=>`/painel/${A}${ancora[c.item]}`));
 const item=(await api('/catalogo',{method:'POST',body:{nome:'Rodízio',enviar:false}})).json;
 const sol=(await api('/solicitacoes',{method:'POST',body:{tipo:'suporte',assunto:'Dúvida',texto:'Como mudo o horário?'}})).json;
 await t.db.query("UPDATE requests SET status='respondida' WHERE id=$1",[sol.id]);
 const depende=(await api('')).json.depende;
 assert.ok(depende.some(d=>d.tipo==='rascunho'&&d.href===`/painel/${A}/catalogo#item-${item.id}`));
 assert.ok(depende.some(d=>d.tipo==='responder'&&d.href===`/painel/${A}/solicitacoes#sol-${sol.id}`));
});

test('título por módulo e WhatsApp de suporte no vm do painel',async()=>{
 const s=await sessao(dono);
 const perfil=await loadPainel({db:t.db,session:s,path:`/painel/${A}/perfil`,url:new URL(`${origin}/painel/${A}/perfil`),now:t.agora});
 assert.equal(perfil.title,'Minha empresa · Garcia Churrasco | Guia PRIMIG');
 assert.match(perfil.vm.suporte.whatsappUrl,/^https:\/\/wa\.me\/5521982155579\?text=/);
 assert.equal((await loadPainel({db:t.db,session:s,path:`/painel/${A}`,url:new URL(`${origin}/painel/${A}`),now:t.agora})).title,'Resumo · Garcia Churrasco | Guia PRIMIG');
 assert.equal((await loadPainel({db:t.db,session:s,path:`/painel/${A}/catalogo`,url:new URL(`${origin}/painel/${A}/catalogo`),now:t.agora})).title,'Produtos e serviços · Garcia Churrasco | Guia PRIMIG');
});

test('foto recusada traz o comentário e a data',async()=>{
 const jpg=await sharp({create:{width:400,height:300,channels:3,background:'#c33'}}).jpeg().toBuffer();
 const f=(await api('/fotos',{method:'POST',raw:jpg,type:'image/jpeg'})).json;assert.equal(f.recusa,null);
 await t.db.query("UPDATE media SET status='recusada' WHERE id=$1",[f.id]);
 await t.db.query("UPDATE approvals SET status='recusado',comment='Foto escura, mande outra.',decided_at=$2 WHERE resource_id=$1 AND kind='foto'",[f.id,t.agora.toISOString()]);
 const foto=(await api('/perfil')).json.fotos.find(x=>x.id===f.id);
 assert.deepEqual(foto.recusa,{comentario:'Foto escura, mande outra.',em:t.agora.toISOString()});
});

test('definir-senha: empresa e quem convidou; a equipe e o CLI aparecem como Equipe PRIMIG',async()=>{
 const pagina=async token=>(await loadDefinirSenha(t.db,new URL(`${origin}/entrar/definir-senha?token=${token}`),t.agora)).vm;
 t.mailerAtivo=false;
 const conv=(await api('/acessos',{method:'POST',body:{email:'garcom@pedidos.test',papel:'editor'}})).json;
 const vm=await pagina(conv.link.split('=')[1]);assert.deepEqual([vm.empresa,vm.convidadoPor,vm.tipo],['Garcia Churrasco','dono','convite']);
 const u=await ensureUser(t.db,'cli@pedidos.test');const cli=await issueToken(t.db,{kind:'convite',userId:u.id,businessId:A,role:'dono',now:t.agora});
 assert.equal((await pagina(cli.value)).convidadoPor,'Equipe PRIMIG');
 const rec=await issueToken(t.db,{kind:'recuperacao',userId:u.id,now:t.agora});assert.deepEqual([(await pagina(rec.value)).empresa,(await pagina(rec.value)).convidadoPor],['','']);
 assert.deepEqual([(await pagina('0'.repeat(64))).empresa,(await pagina('0'.repeat(64))).convidadoPor],['','']);
 t.mailerAtivo=true;
});

test('convite pendente: reenviar troca o link; cancelar invalida',async()=>{
 t.mailerAtivo=false;
 const primeiro=(await api('/acessos',{method:'POST',body:{email:'caixa@pedidos.test',papel:'leitura'}})).json;
 const novo=await api('/acessos/convites/reenviar',{method:'POST',body:{email:'Caixa@Pedidos.test'}});
 assert.equal(novo.status,201);assert.equal(novo.json.papel,'leitura');assert.notEqual(novo.json.link,primeiro.link);
 assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:primeiro.link.split('=')[1],senha:'senha-do-caixa-123'}})).status,422,'o link anterior não vale');
 assert.equal((await api('/acessos/convites/cancelar',{method:'POST',body:{email:'caixa@pedidos.test'}})).status,200);
 assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:novo.json.link.split('=')[1],senha:'senha-do-caixa-123'}})).status,422,'cancelado');
 assert.equal((await api('/acessos/convites/cancelar',{method:'POST',body:{email:'caixa@pedidos.test'}})).status,404);
 assert.ok(!(await api('/acessos')).json.convites.some(c=>c.email==='caixa@pedidos.test'));
 t.mailerAtivo=true;
});

test('rascunho só com o nome; tudo conferido ao enviar; só rascunho pode ser apagado',async()=>{
 const r=await api('/catalogo',{method:'POST',body:{nome:'Só o nome',enviar:false}});
 assert.equal(r.status,201);assert.deepEqual([r.json.tipo,r.json.precoModo,r.json.status],['produto','consulta','rascunho']);
 const oferta=(await api('/catalogo',{method:'POST',body:{tipo:'oferta',nome:'Combo de sábado',precoModo:'fixo',precoCentavos:8990,enviar:false}})).json;
 assert.equal(oferta.status,'rascunho','oferta em rascunho sem condições');
 const envio=await api(`/catalogo/${oferta.id}/enviar`,{method:'POST',body:{version:oferta.version}});assert.equal(envio.status,422);assert.equal(envio.json.campo,'condicoes');
 const preco=await api('/catalogo',{method:'POST',body:{nome:'Picanha',tipo:'produto',precoModo:'fixo'}});assert.deepEqual([preco.json.campo,preco.json.erro],['precoCentavos','Informe o preço, como 18,90.']);
 assert.equal((await api(`/catalogo/${r.json.id}`,{method:'DELETE'})).status,200);
 assert.ok(!(await api('/catalogo')).json.itens.some(i=>i.id===r.json.id));
 const enviado=(await api('/catalogo',{method:'POST',body:{nome:'Costela',tipo:'produto',precoModo:'consulta'}})).json;
 const apagar=await api(`/catalogo/${enviado.id}`,{method:'DELETE'});assert.equal(apagar.status,422);assert.equal(apagar.json.campo,'status');
 await t.conta('leitura@pedidos.test',{empresa:A,papel:'leitura'});const leitura=await t.entrar('leitura@pedidos.test');
 assert.equal((await t.com(leitura,`/api/painel/empresas/${A}/catalogo/${oferta.id}`,{method:'DELETE'})).status,403);
});
