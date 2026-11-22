import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {createApp} from '../../api/server.mjs';
import {assinar,chavesDoAmbiente} from '../../api/integracao-api.mjs';
import {editarEmpresa,obterEmpresa} from '../../api/data/admin/empresas.mjs';

// Integração com a gestão comercial (contrato 19): assinatura HMAC com carimbo e nonce, duas chaves, só pela rede interna,
// as três rotas, o plano somente leitura no admin e o db:seed que não mexe no plano gerido.
const k1=randomBytes(32),k2=randomBytes(32);let db,server,base;const agora=new Date('2026-10-20T15:00:00Z');
before(async()=>{
  db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);
  await db.query("INSERT INTO plans(id,name,status,price_cents,paid) VALUES('plano-premium','Premium','active',9900,true),('plano-antigo','Antigo','paused',5000,true)");
  server=await createApp({db,origin:'http://127.0.0.1:4180',clock:()=>agora,integracaoChaves:new Map([['k2',k2],['k1',k1]])});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.close();});
// Chamada assinada como a gestão assina; extra troca ou acrescenta cabeçalhos.
const nonce=()=>randomBytes(16).toString('hex');
async function chamar(metodo,caminho,{corpo,chave=k2,id='k2',carimbo=String(Math.floor(agora.getTime()/1000)),n=nonce(),extra={}}={}) {
  const texto=corpo===undefined?'':JSON.stringify(corpo);
  const headers={'X-Gestao-Chave':id,'X-Gestao-Carimbo':carimbo,'X-Gestao-Nonce':n,'X-Gestao-Assinatura':assinar({chave,metodo,caminho,carimbo,nonce:n,corpo:texto}),...extra};
  if(corpo!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(base+caminho,{method:metodo,headers,body:corpo===undefined?undefined:texto});
  const t=await r.text();let json=null;try{json=JSON.parse(t);}catch{}
  return {status:r.status,json};
}

test('assinatura: as duas chaves valem; chave, carimbo, nonce ou assinatura errados dão o mesmo 401',async()=>{
  assert.equal((await chamar('GET','/api/integracao/v1/planos')).status,200);
  assert.equal((await chamar('GET','/api/integracao/v1/planos',{chave:k1,id:'k1'})).status,200,'a chave anterior ainda vale');
  const ruins=[{chave:k1,id:'k2'},{id:'k9'},{carimbo:String(Math.floor(agora.getTime()/1000)-301)},{carimbo:String(Math.floor(agora.getTime()/1000)+301)},{carimbo:'agora'},{n:'curto'}];
  for(const r of ruins)assert.deepEqual(await chamar('GET','/api/integracao/v1/planos',r),{status:401,json:{erro:'Não autorizado.'}},JSON.stringify(Object.keys(r)));
  const n=nonce();
  assert.equal((await chamar('GET','/api/integracao/v1/planos',{n})).status,200);
  assert.equal((await chamar('GET','/api/integracao/v1/planos',{n})).status,401,'o mesmo nonce não vale duas vezes');
  assert.equal((await fetch(base+'/api/integracao/v1/planos')).status,401,'sem cabeçalhos');
  // A assinatura cobre a query e o corpo exatos.
  const c=String(Math.floor(agora.getTime()/1000)),m=nonce();
  const r=await fetch(`${base}/api/integracao/v1/empresas?q=boreal`,{headers:{'X-Gestao-Chave':'k2','X-Gestao-Carimbo':c,'X-Gestao-Nonce':m,'X-Gestao-Assinatura':assinar({chave:k2,metodo:'GET',caminho:'/api/integracao/v1/empresas?q=outra',carimbo:c,nonce:m})}});
  assert.equal(r.status,401);
  assert.equal((await chamar('GET','/api/integracao/v1/nada')).status,404,'a rota inexistente só aparece para quem assinou');
});

test('rede e configuração: pelo proxy ou sem chaves a rota não existe; PUT só aqui',async()=>{
  assert.equal((await chamar('GET','/api/integracao/v1/planos',{extra:{'X-Forwarded-For':'203.0.113.7'}})).status,404);
  const sem=await createApp({db,origin:'http://127.0.0.1:4180',clock:()=>agora,integracaoChaves:new Map()});await new Promise(r=>sem.listen(0,'127.0.0.1',r));
  try{assert.equal((await fetch(`http://127.0.0.1:${sem.address().port}/api/integracao/v1/planos`)).status,404);}finally{await new Promise(r=>sem.close(r));}
  assert.equal((await fetch(base+'/api/admin/empresas',{method:'PUT',headers:{Origin:'http://127.0.0.1:4180'}})).status,405);
  assert.deepEqual([...chavesDoAmbiente(`k2:${'ab'.repeat(32)}, k1:${'cd'.repeat(32)}`).keys()],['k2','k1']);
  assert.equal(chavesDoAmbiente('').size,0);
  assert.throws(()=>chavesDoAmbiente('k1:curta'),/INTEGRACAO_CHAVES/);
});

test('empresas e planos: busca, ids, paginação e a foto só quando é mídia aprovada',async()=>{
  const fotoOk='a'.repeat(32),fotoPendente='b'.repeat(32);
  for(const [id,status] of [[fotoOk,'aprovada'],[fotoPendente,'pendente']])
    await db.query("INSERT INTO media(id,business_id,mime,width,height,bytes,sha256,status) VALUES($1,'boreal-tintas','image/webp',800,600,1000,'x',$2)",[id,status]);
  const ids=(await db.query("SELECT id FROM businesses WHERE id LIKE 'boreal%' ORDER BY id")).rows.map(r=>r.id);
  await db.query("UPDATE businesses SET details=jsonb_set(details,'{image}',to_jsonb($2::text)) WHERE id=$1",[ids[0],`/midia/${fotoOk}/800.webp`]);
  if(ids[1])await db.query("UPDATE businesses SET details=jsonb_set(details,'{image}',to_jsonb($2::text)) WHERE id=$1",[ids[1],`/midia/${fotoPendente}/800.webp`]);
  const r=(await chamar('GET','/api/integracao/v1/empresas?q=BOREAL')).json;
  assert.deepEqual(r.itens.map(e=>e.id).sort(),ids);
  assert.deepEqual(Object.keys(r.itens[0]),['id','nome','slug','status','bairro','plano','foto']);
  assert.equal(r.itens.find(e=>e.id===ids[0]).foto,`/midia/${fotoOk}/320.webp`);
  if(ids[1])assert.equal(r.itens.find(e=>e.id===ids[1]).foto,null,'mídia pendente não vai');
  const porId=(await chamar('GET',`/api/integracao/v1/empresas?ids=${ids[0]},../x,funeraria-sao-salvador`)).json;
  assert.deepEqual(porId.itens.map(e=>e.id).sort(),[ids[0],'funeraria-sao-salvador'].sort());
  const todas=(await chamar('GET','/api/integracao/v1/empresas?page=2')).json;
  assert.equal(todas.pagina,2);assert.equal(todas.itens.length,Math.min(20,Math.max(0,todas.total-20)));
  assert.deepEqual((await chamar('GET','/api/integracao/v1/planos')).json.itens,[
    {id:'plano-antigo',nome:'Antigo',pago:true,status:'pausado',precoCentavos:5000},{id:'plano-premium',nome:'Premium',pago:true,status:'ativo',precoCentavos:9900}]);
});

test('PUT do plano: grava, audita com o ator gestao e não muda nada ao repetir',async()=>{
  const corpo={plano:'plano-premium',gerida:true,assinatura:'9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01',motivo:'pagamento'};
  const r=await chamar('PUT','/api/integracao/v1/empresas/boreal-tintas/plano',{corpo});
  assert.deepEqual(r,{status:200,json:{id:'boreal-tintas',plano:'plano-premium',alterado:true}});
  const b=(await db.query("SELECT plan_id,plan_managed FROM businesses WHERE id='boreal-tintas'")).rows[0];
  assert.deepEqual(b,{plan_id:'plano-premium',plan_managed:true});
  const a=(await db.query("SELECT * FROM audit_log WHERE action='plano_definido_gestao' AND resource_id='boreal-tintas'")).rows[0];
  assert.equal(a.actor_id,'gestao');assert.deepEqual(a.after,{plano:'plano-premium',planoGerido:true,assinatura:corpo.assinatura,motivo:'pagamento'});
  assert.equal((await chamar('PUT','/api/integracao/v1/empresas/boreal-tintas/plano',{corpo})).json.alterado,false);
  for(const [c,status] of [[{...corpo,plano:'nao-existe'},422],[{...corpo,gerida:'sim'},422],[{...corpo,extra:1},422],[{...corpo,motivo:'x'.repeat(41)},422]])
    assert.equal((await chamar('PUT','/api/integracao/v1/empresas/boreal-tintas/plano',{corpo:c})).status,status,JSON.stringify(c));
  assert.equal((await chamar('PUT','/api/integracao/v1/empresas/nao-existe/plano',{corpo})).status,404);
  assert.equal((await chamar('PUT','/api/integracao/v1/empresas/boreal-tintas/plano',{corpo:{...corpo,motivo:'x'.repeat(5000)}})).status,413);
});

test('plano gerido: somente leitura no admin e intocado pelo db:seed; desvincular devolve ao admin',async()=>{
  const session={user_id:'admin-teste',staff_role:'admin'};
  const e=await obterEmpresa(db,'boreal-tintas');assert.equal(e.planoGerido,true);
  await assert.rejects(editarEmpresa(db,{id:'boreal-tintas',p:{plano:null,version:e.version},session,ip:'10.0.0.1'}),err=>err.status===422&&err.campo==='plano');
  const ok=await editarEmpresa(db,{id:'boreal-tintas',p:{resumo:'Tintas e acabamentos.',version:e.version},session,ip:'10.0.0.1'});
  assert.equal(ok.plano,'plano-premium','os outros campos continuam editáveis');
  // O db:seed roda a cada deploy: com a empresa sem managed_at, ele regravaria o plan_id do acervo.
  await db.query("UPDATE businesses SET managed_at=NULL WHERE id='boreal-tintas'");
  await importSnapshot(db);
  assert.equal((await db.query("SELECT plan_id FROM businesses WHERE id='boreal-tintas'")).rows[0].plan_id,'plano-premium');
  await chamar('PUT','/api/integracao/v1/empresas/boreal-tintas/plano',{corpo:{plano:null,gerida:false,assinatura:null,motivo:'desvinculo'}});
  const livre=await obterEmpresa(db,'boreal-tintas');assert.deepEqual([livre.plano,livre.planoGerido],[null,false]);
  assert.equal((await editarEmpresa(db,{id:'boreal-tintas',p:{plano:'plano-premium',version:livre.version},session,ip:'10.0.0.1'})).plano,'plano-premium');
});
