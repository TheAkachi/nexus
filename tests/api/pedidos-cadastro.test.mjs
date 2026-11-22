import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {createApp} from '../../api/server.mjs';
import {assinar} from '../../api/integracao-api.mjs';
import {PERGUNTAS,loadCadastro} from '../../api/data/cadastro.mjs';
import {gerarCodigo,guardarPedido} from '../../api/data/pedidos.mjs';

// Pedidos do cadastro para a gestão, os leads (contrato 23, v0.23.0), só com dados de teste. Dois servidores sobre o mesmo
// banco: um com a chave desligada (o padrão) e outro com ela ligada.
const k1=randomBytes(32),ORIGEM='http://127.0.0.1:4180',CODIGO=/^[ACDEFHJKMNPRTUVWXY3479]{4,5}$/;
let db,desligado,ligado;let agora=new Date('2026-10-29T15:00:00Z');
const plano=PERGUNTAS.find(p=>p.id==='plano').opcoes[0].valor;
async function servidor(leads) {
  const s=await createApp({db,origin:ORIGEM,clock:()=>agora,integracaoChaves:new Map([['k1',k1]]),leads});
  await new Promise(r=>s.listen(0,'127.0.0.1',r));return {s,base:`http://127.0.0.1:${s.address().port}`};
}
const cadastrar=(srv,campos)=>fetch(srv.base+'/cadastro',{method:'POST',redirect:'manual',headers:{Origin:ORIGEM,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(campos)});
const textoDo=r=>new URL(r.headers.get('location')).searchParams.get('text');
async function pedidos(srv,query) {
  const caminho=`/api/integracao/v1/pedidos${query}`,carimbo=String(Math.floor(agora.getTime()/1000)),n=randomBytes(16).toString('hex');
  const r=await fetch(srv.base+caminho,{headers:{'X-Gestao-Chave':'k1','X-Gestao-Carimbo':carimbo,'X-Gestao-Nonce':n,'X-Gestao-Assinatura':assinar({chave:k1,metodo:'GET',caminho,carimbo,nonce:n,corpo:''})}});
  return {status:r.status,json:await r.json()};
}
before(async()=>{
  db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);
  [desligado,ligado]=[await servidor(false),await servidor(true)];
});
after(async()=>{for(const x of [desligado,ligado])if(x)await new Promise(r=>x.s.close(r));if(db)await db.close();});

test('chave desligada (o padrão): o cadastro segue como antes, sem código e sem gravar, e a rota não existe',async()=>{
  const r=await cadastrar(desligado,{ramo:'alimentacao',local:'nova-iguacu',plano,interesse:plano});
  assert.equal(r.status,303);
  assert.match(textoDo(r),/Enviado pelo site 127\.0\.0\.1:4180$/);
  assert.doesNotMatch(textoDo(r),/Pedido/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM signup_requests')).rows[0].n,0);
  assert.equal((await pedidos(desligado,'?desde=2026-10-01T00:00:00.000Z')).status,404);
  assert.equal(loadCadastro(new URL(`http://x/cadastro?interesse=${plano}`)).vm.origem,plano);
  assert.equal(loadCadastro(new URL('http://x/cadastro?interesse=<script>')).vm.origem,'');
});

test('chave ligada: o código no fim da mensagem, e o site guarda só o código, as respostas, a origem e a hora',async()=>{
  const r=await cadastrar(ligado,{ramo:'alimentacao',local:'nova-iguacu',plano,canais:'instagram',novidades:'sim',interesse:plano});
  const texto=textoDo(r),codigo=texto.split('\n').at(-1).replace('Pedido ','');
  assert.match(texto,/Enviado pelo site 127\.0\.0\.1:4180\nPedido [A-Z0-9]+$/);
  assert.match(codigo,CODIGO);
  const colunas=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='signup_requests' ORDER BY column_name")).rows.map(x=>x.column_name);
  assert.deepEqual(colunas,['codigo','criado_em','origem','respostas'],'nada de nome, telefone, IP ou sessão');
  const linha=(await db.query('SELECT codigo,respostas,origem,criado_em FROM signup_requests')).rows[0];
  assert.deepEqual([linha.codigo,linha.respostas,linha.origem,new Date(linha.criado_em).toISOString()],
    [codigo,{ramo:'alimentacao',local:'nova-iguacu',plano,canais:['instagram'],novidades:'sim'},plano,agora.toISOString()]);
  // Com erro, nada é gravado e a página volta com a origem para o campo escondido.
  const erro=await cadastrar(ligado,{local:'nova-iguacu',interesse:plano});
  assert.equal(erro.status,422);
  assert.match(await erro.text(),new RegExp(plano));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM signup_requests')).rows[0].n,1);
});

test('rota dos pedidos: assinada, desde inclusive, com o texto da mensagem; o pedido com mais de 30 dias sai',async()=>{
  await db.query("INSERT INTO signup_requests(codigo,respostas,origem,criado_em) VALUES('ACDE','{\"ramo\":\"pets\"}','','2026-09-20T12:00:00Z')");
  assert.deepEqual([(await pedidos(ligado,'')).status,(await pedidos(ligado,'?desde=ontem')).json.campo],[422,'desde']);
  const r=await pedidos(ligado,`?desde=${encodeURIComponent(agora.toISOString())}`);
  assert.equal(r.status,200);
  assert.deepEqual([r.json.total,r.json.pagina,r.json.paginas],[1,1,1]);
  const [p]=r.json.itens;
  assert.deepEqual(Object.keys(p),['codigo','texto','respostas','origem','criadoEm']);
  assert.equal(p.criadoEm,agora.toISOString(),'o pedido do mesmo instante volta (desde inclusive)');
  assert.match(p.texto,new RegExp(`^Olá, Leandro![^]*\\nPedido ${p.codigo}$`));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM signup_requests WHERE codigo='ACDE'")).rows[0].n,0,'o de 39 dias saiu na leitura');
  assert.equal((await pedidos(ligado,'?desde=2026-10-30T00:00:00.000Z')).json.itens.length,0);
});

test('código: só letras e números sem ambiguidade, sorteado de novo quando repete, e a falha de gravação não para o visitante',async()=>{
  for(let i=0;i<200;i++)assert.match(gerarCodigo(),CODIGO);
  // O primeiro sorteio repete um código guardado: sai outro.
  const seq=[0,0,0,0,0.99,0.99,0.99,0.99];let i=0;const random=()=>seq[i++%seq.length];
  await db.query("INSERT INTO signup_requests(codigo,respostas,criado_em) VALUES('AAAA','{}',$1)",[agora.toISOString()]);
  assert.equal(await guardarPedido(db,{values:{ramo:'pets'},origem:'',now:agora,random}),'9999');
  const logs=[];
  const quebrado={query:async()=>{throw new Error('banco fora');}};
  assert.equal(await guardarPedido(quebrado,{values:{ramo:'pets'},origem:'',now:agora,logger:x=>logs.push(x)}),'');
  assert.deepEqual(logs,[{error:'pedido_nao_gravado'}],'o log não leva as respostas');
});
