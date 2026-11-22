import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {createApp} from '../../api/server.mjs';
import {assinar} from '../../api/integracao-api.mjs';
import {ingestEvent} from '../../api/events.mjs';
import {resumoEmpresa,assinaturaGestao} from '../../api/data/painel.mjs';

// Fase 2 da gestão (contrato 19.6): a "Minha assinatura" no PUT e no painel, as somas diárias e a rota de métricas.
const k1=randomBytes(32);let db,server,base;let agora=new Date('2026-10-20T15:00:00Z');
const E='boreal-tintas';
before(async()=>{
  db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);
  await db.query("INSERT INTO plans(id,name,status,price_cents,paid) VALUES('plano-premium','Premium','active',9900,true)");
  server=await createApp({db,origin:'http://127.0.0.1:4180',clock:()=>agora,integracaoChaves:new Map([['k1',k1]])});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.close();});
async function chamar(metodo,caminho,corpo) {
  const texto=corpo===undefined?'':JSON.stringify(corpo),carimbo=String(Math.floor(agora.getTime()/1000)),n=randomBytes(16).toString('hex');
  const headers={'X-Gestao-Chave':'k1','X-Gestao-Carimbo':carimbo,'X-Gestao-Nonce':n,'X-Gestao-Assinatura':assinar({chave:k1,metodo,caminho,carimbo,nonce:n,corpo:texto})};
  if(corpo!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(base+caminho,{method:metodo,headers,body:corpo===undefined?undefined:texto});
  const t=await r.text();let json=null;try{json=JSON.parse(t);}catch{}
  return {status:r.status,json};
}
const minha={plano:{id:'plano-premium',nome:'Premium'},valorCentavos:9900,ciclo:'mensal',venceEm:'2026-11-15',status:'ativa',
  ultimosPagamentos:[{pagoEm:'2026-10-15',valorCentavos:9900,forma:'pix',referencia:{de:'2026-10-15',ate:'2026-11-14'}}],comoPagar:{chavePix:'pix@exemplo.test',whatsapp:'5521900000000'}};
const put=corpo=>chamar('PUT',`/api/integracao/v1/empresas/${E}/plano`,{plano:'plano-premium',gerida:true,assinatura:'a1',motivo:'pagamento',...corpo});
const guardada=async()=>(await db.query('SELECT gestao_assinatura,gestao_assinatura_em FROM businesses WHERE id=$1',[E])).rows[0];
const acesso={empresa:{id:E},pode:{plano:true,perfil:false,catalogo:false,acessos:false}};

test('Minha assinatura: o PUT guarda, repete sem mudar, apaga com null e não mexe sem o campo',async()=>{
  let r=await put({minhaAssinatura:minha});
  assert.deepEqual(r,{status:200,json:{id:E,plano:'plano-premium',alterado:true}});
  assert.deepEqual((await guardada()).gestao_assinatura,minha);
  r=await put({minhaAssinatura:minha});
  assert.equal(r.json.alterado,false,'a mesma assinatura de novo não muda nada');
  r=await put({minhaAssinatura:{...minha,venceEm:'2026-12-15'}});
  assert.equal(r.json.alterado,true,'só a assinatura mudou');
  const a=(await db.query("SELECT after FROM audit_log WHERE action='plano_definido_gestao' AND resource_id=$1 ORDER BY created_at DESC LIMIT 1",[E])).rows[0].after;
  assert.equal(a.minhaAssinatura,true,'a auditoria diz que veio, sem o conteúdo');assert.equal(JSON.stringify(a).includes('pix@exemplo.test'),false);
  r=await put({});
  assert.equal(r.json.alterado,false);assert.equal((await guardada()).gestao_assinatura.venceEm,'2026-12-15','sem o campo, fica o que estava');
  r=await put({plano:null,gerida:false,minhaAssinatura:null});
  assert.equal(r.json.alterado,true);assert.deepEqual(await guardada(),{gestao_assinatura:null,gestao_assinatura_em:null});
});

test('Minha assinatura: campo a campo, o desconhecido recusado em qualquer nível',async()=>{
  const ruins=[{...minha,extra:1},{...minha,ciclo:'bimestral'},{...minha,status:'inadimplente'},{...minha,venceEm:'2026-02-30'},{...minha,valorCentavos:-1},
    {...minha,plano:{id:'plano-premium'}},{...minha,plano:{id:'x',nome:'y',preco:1}},{...minha,ultimosPagamentos:Array(4).fill(minha.ultimosPagamentos[0])},
    {...minha,ultimosPagamentos:[{...minha.ultimosPagamentos[0],forma:'cheque'}]},{...minha,ultimosPagamentos:[{...minha.ultimosPagamentos[0],obs:'nota'}]},
    {...minha,comoPagar:{chavePix:'linha\nquebrada',whatsapp:''}},{...minha,comoPagar:{chavePix:'',whatsapp:'21900000000'}},{...minha,comoPagar:{chavePix:'',whatsapp:'',nome:'x'}},
    {...minha,cliente:{nome:'Fulano'}},'texto',[]];
  for(const m of ruins)assert.deepEqual(await put({minhaAssinatura:m}),{status:422,json:{erro:'A assinatura enviada pela gestão é inválida.',campo:'minhaAssinatura'}},JSON.stringify(m).slice(0,80));
  assert.equal((await put({minhaAssinatura:{...minha,plano:null,ultimosPagamentos:[],comoPagar:{chavePix:'',whatsapp:''}}})).status,200,'sem plano, sem pagamentos e sem como pagar vale');
});

test('painel: a Minha assinatura no contratado, com a situação do dia e só para a ação plano',async()=>{
  await put({minhaAssinatura:{...minha,venceEm:'2026-10-25'}});
  const r=await resumoEmpresa(db,acesso,agora);
  const {status,...semStatus}=minha;
  assert.deepEqual({...r.contratado.assinatura,atualizadaEm:typeof r.contratado.assinatura.atualizadaEm},
    {...semStatus,venceEm:'2026-10-25',dias:5,situacao:'a-vencer',atualizadaEm:'string'},'o status vira a situação');
  assert.equal((await resumoEmpresa(db,{...acesso,pode:{...acesso.pode,plano:false}},agora)).contratado,null);
  const b={gestao_assinatura:{...minha,venceEm:'2026-10-25'},gestao_assinatura_em:agora};
  assert.deepEqual(['2026-10-10T15:00:00Z','2026-10-25T15:00:00Z','2026-10-26T15:00:00Z'].map(d=>assinaturaGestao(b,new Date(d)).situacao),['a-vencer','a-vencer','vencida']);
  assert.equal(assinaturaGestao({...b,gestao_assinatura:{...minha,venceEm:'2026-12-31'}},agora).situacao,'em-dia');
  assert.equal(assinaturaGestao({...b,gestao_assinatura:{...minha,status:'suspensa'}},agora).situacao,'suspensa');
  assert.equal(assinaturaGestao({gestao_assinatura:null},agora),null);
});

test('somas diárias: visitas e contatos por empresa, e a busca contada pelo servidor (sem robôs, só a página 1)',async()=>{
  const ev=(name,n,extra={})=>({event_id:`fase2-${name}-${n}-000000000`,name,session_id:'sessao-fase2-00000001',business_id:E,consent:true,...extra});
  const dia=new Date('2026-10-19T02:00:00Z');// 23h do dia 18 em São Paulo
  await ingestEvent(db,ev('business_viewed',1),'10.0.0.2',dia);await ingestEvent(db,ev('business_viewed',1),'10.0.0.2',dia);// repetido
  await ingestEvent(db,ev('contact_clicked',2,{channel:'whatsapp'}),'10.0.0.2',dia);await ingestEvent(db,ev('contact_clicked',3,{channel:'waze'}),'10.0.0.2',dia);
  assert.deepEqual((await db.query("SELECT views,contact_whatsapp,contact_phone,contact_map,contact_website FROM business_daily WHERE business_id=$1 AND day='2026-10-18'",[E])).rows,
    [{views:1,contact_whatsapp:1,contact_phone:0,contact_map:1,contact_website:0}]);
  const busca=(q,ua='Mozilla/5.0')=>fetch(`${base}/busca?${q}`,{headers:{'User-Agent':ua}});
  await busca('q=Tintas');await busca('q=tintas&district=Centro');await busca('q=xyzsemresultado');await busca('q=tintas','Googlebot/2.1');await busca('q=tintas&page=2');
  // "tintas" no Centro e o termo inventado não têm resultado.
  assert.deepEqual((await db.query("SELECT searches,searches_empty FROM site_daily WHERE day='2026-10-20'")).rows,[{searches:3,searches_empty:2}]);
  assert.deepEqual((await db.query("SELECT kind,value,count FROM search_daily WHERE day='2026-10-20' ORDER BY kind,value")).rows,
    [{kind:'bairro',value:'Centro',count:1},{kind:'termo',value:'tintas',count:2},{kind:'termo',value:'xyzsemresultado',count:1}]);
});

test('rota de métricas: período, meses sem medição em null, listas com 3 ou mais, empresas paginadas e banners',async()=>{
  for(const [q,campo] of [['de=2026-13&ate=2026-10','de'],['de=2026-01','ate'],['de=2026-10&ate=2026-09','de'],['de=2026-10&ate=2026-11','ate'],['de=2025-09&ate=2026-10','de']])
    assert.equal((await chamar('GET',`/api/integracao/v1/metricas?${q}`)).json.campo,campo,q);
  await db.query("UPDATE metric_starts SET since=CASE serie WHEN 'contatos' THEN '2026-09-10'::date ELSE '2026-10-01'::date END");
  // Um grupo da home, uma categoria do acervo e um identificador que o site não conhece.
  for(const cat of ['alimentacao','loja-de-tintas','zz-desconhecida'])for(let i=0;i<3;i++)
    await db.query("INSERT INTO search_daily(day,kind,value,count) VALUES($1,'categoria',$2,1) ON CONFLICT(day,kind,value) DO UPDATE SET count=search_daily.count+1",[`2026-10-0${i+1}`,cat]);
  await db.query("INSERT INTO search_misses(day,term,count) VALUES('2026-10-02','chaveiro 24 horas',4),('2026-10-03','raro',1)");
  await db.query("INSERT INTO campaigns(id,title,source,status,business_id) VALUES('banner-boreal','Tintas em promoção','{}','published',$1)",[E]);
  await db.query("INSERT INTO ad_daily(day,campaign_id,slot,impressions,clicks) VALUES('2026-10-05','banner-boreal','home-topo',120,3)");
  const r=(await chamar('GET','/api/integracao/v1/metricas?de=2026-08&ate=2026-10')).json;
  assert.deepEqual([r.de,r.ate,r.medidoDesde],['2026-08','2026-10',{contatos:'2026-09-10',buscas:'2026-10-01'}]);
  assert.deepEqual(r.site.meses.map(m=>[m.mes,m.visitas,m.buscas]),[['2026-08',null,null],['2026-09',0,null],['2026-10',1,3]]);
  assert.deepEqual(r.site.meses[2].contatos,{whatsapp:1,telefone:0,rota:1,site:0});
  assert.deepEqual(r.site.buscasMaisFeitas,[],'tintas só teve 2 buscas');
  assert.deepEqual(r.site.categorias,[{categoria:'alimentacao',nome:'Alimentação',vezes:3},{categoria:'loja-de-tintas',nome:'Loja de Tintas',vezes:3},
    {categoria:'zz-desconhecida',nome:'zz-desconhecida',vezes:3}]);
  assert.deepEqual(r.site.buscasSemResultado,[{termo:'chaveiro 24 horas',vezes:4}]);
  const publicadas=(await db.query("SELECT count(*)::int AS n FROM businesses WHERE status='published'")).rows[0].n;
  assert.deepEqual([r.empresas.total,r.empresas.pagina,r.empresas.paginas,r.empresas.itens.length],[publicadas,1,Math.ceil(publicadas/100),Math.min(100,publicadas)]);
  const b=r.empresas.itens.find(x=>x.id===E);
  assert.deepEqual(b.ultimos30,{visitas:1,contatos:{whatsapp:1,telefone:0,rota:1,site:0}});
  assert.deepEqual(b.meses.map(m=>m.visitas),[null,0,1]);
  assert.ok(r.empresas.itens.some(x=>x.id!==E&&x.ultimos30.visitas===0),'as empresas com zero também vêm');
  assert.deepEqual(r.banners,[{id:'banner-boreal',titulo:'Tintas em promoção',empresa:{id:E,nome:b.nome},impressoes:120,cliques:3}]);
  assert.equal((await chamar('GET','/api/integracao/v1/metricas?de=2026-10&ate=2026-10&page=99')).json.empresas.itens.length,0);
  assert.equal((await fetch(`${base}/api/integracao/v1/metricas?de=2026-10&ate=2026-10`)).status,401,'sem assinatura');
});

test('migração 012: os eventos com consentimento já guardados entram nas somas por empresa e dia de São Paulo',async()=>{
  const {readFile}=await import('node:fs/promises');
  const sql=(await readFile(new URL('../../db/migrations/012_fase2_gestao.sql',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const soma=sql.slice(sql.indexOf('INSERT INTO business_daily'),sql.indexOf(';',sql.indexOf('INSERT INTO business_daily'))+1);
  await db.query("INSERT INTO public_events(event_id,name,business_id,session_id,channel,occurred_at) VALUES('antigo-1','business_viewed',$1,'s','',$2),('antigo-2','contact_clicked',$1,'s','phone',$2),('antigo-3','contact_clicked',$1,'s','website','2026-09-01T12:00:00Z')",[E,'2026-09-01T02:30:00Z']);
  await db.query("DELETE FROM business_daily WHERE day IN ('2026-08-31','2026-09-01')");
  await db.exec(soma);
  assert.deepEqual((await db.query("SELECT to_char(day,'YYYY-MM-DD') AS d,views,contact_phone,contact_website FROM business_daily WHERE business_id=$1 AND day IN ('2026-08-31','2026-09-01') ORDER BY day",[E])).rows,
    [{d:'2026-08-31',views:1,contact_phone:1,contact_website:0},{d:'2026-09-01',views:0,contact_phone:0,contact_website:1}],'02h30 UTC de 01/09 ainda é 31/08 em São Paulo');
});
