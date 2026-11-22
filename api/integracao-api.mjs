import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { fail } from './lib/erros.mjs';
import { audit } from './lib/auditoria.mjs';
import { normalize, collator } from './lib/saneamento.mjs';
import { STATUS_PT, rejectExtra, lista, filtro } from './data/admin/comum.mjs';
import { metricasGestao } from './data/metricas.mjs';
import { pedidosDesde } from './data/pedidos.mjs';

// Integração com a gestão comercial (contrato 19): API de máquina, só pela rede interna do Docker, autenticada por HMAC.
// A gestão lê empresas, planos e métricas e grava o plano da empresa com a "Minha assinatura" (19.6); nada além.
const JANELA_S=300,NONCE_MS=10*60000,MAX_CORPO=4096;
const sha256=b=>createHash('sha256').update(b).digest('hex');
export const assinar=({chave,metodo,caminho,carimbo,nonce,corpo=''})=>createHmac('sha256',chave).update([metodo,caminho,carimbo,nonce,sha256(corpo)].join('\n')).digest('hex');

// INTEGRACAO_CHAVES=k2:<hex>,k1:<hex> — a atual e a anterior, para trocar sem parar (19.2). Vazia: integração desligada.
export function chavesDoAmbiente(valor=process.env.INTEGRACAO_CHAVES) {
  const chaves=new Map();
  for(const par of String(valor||'').split(',').map(s=>s.trim()).filter(Boolean)) {
    const m=/^([\w-]{1,20}):([0-9a-f]{64})$/i.exec(par);
    if(!m)throw new Error('INTEGRACAO_CHAVES: use id:hex (32 bytes), separados por vírgula.');
    chaves.set(m[1],Buffer.from(m[2],'hex'));
  }
  return chaves;
}

const naoAutorizado=()=>fail('Não autorizado.',401);
async function lerCorpo(req) {
  const partes=[];let tamanho=0;
  for await(const p of req){tamanho+=p.length;if(tamanho>MAX_CORPO)throw fail('O corpo pode ter até 4 KB.',413);partes.push(p);}
  return Buffer.concat(partes);
}
// Confere chave, carimbo, nonce e assinatura; qualquer falha é o mesmo 401, sem dizer qual.
async function autenticar(db,{req,corpo,chaves,now}) {
  const h=req.headers,chave=chaves.get(String(h['x-gestao-chave']||'')),carimbo=String(h['x-gestao-carimbo']||''),nonce=String(h['x-gestao-nonce']||''),recebida=String(h['x-gestao-assinatura']||'');
  if(!chave||!/^\d{1,12}$/.test(carimbo)||Math.abs(now.getTime()/1000-Number(carimbo))>JANELA_S||!/^[a-f0-9]{32}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(recebida))throw naoAutorizado();
  const esperada=Buffer.from(assinar({chave,metodo:req.method,caminho:req.url,carimbo,nonce,corpo}),'hex');
  if(!timingSafeEqual(esperada,Buffer.from(recebida,'hex')))throw naoAutorizado();
  await db.query('DELETE FROM integration_nonces WHERE seen_at<$1',[new Date(now.getTime()-NONCE_MS).toISOString()]);
  if(!(await db.query('INSERT INTO integration_nonces(nonce,seen_at) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING nonce',[nonce,now.toISOString()])).rows.length)throw naoAutorizado();
}

const ID=/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;
const PLANO_PT={active:'ativo',paused:'pausado',draft:'rascunho'};
// Foto principal só quando é uma mídia aprovada da biblioteca, na largura de 320 px (a gestão só exibe imagens do site).
const midiaDe=img=>/^\/midia\/([a-f0-9]{32})\/(?:320|800|1600)\.webp$/.exec(img||'')?.[1]||null;
async function empresas(db,url) {
  const q=normalize(filtro(url,'q')),ids=(url.searchParams.get('ids')||'').split(',').map(s=>s.trim()).filter(s=>ID.test(s)).slice(0,50);
  const rows=(await db.query('SELECT id,slug,name,status,district,plan_id,details FROM businesses')).rows
    .filter(b=>(!q||normalize(b.name).includes(q))&&(!url.searchParams.has('ids')||ids.includes(b.id))).sort((a,b)=>collator.compare(a.name,b.name));
  const p=lista(rows,url);
  const fotos=p.itens.map(b=>midiaDe(b.details?.image)).filter(Boolean);
  const aprovadas=new Set(fotos.length?(await db.query("SELECT id FROM media WHERE id=ANY($1) AND status='aprovada'",[fotos])).rows.map(r=>r.id):[]);
  return {...p,itens:p.itens.map(b=>{const m=midiaDe(b.details?.image);
    return {id:b.id,nome:b.name,slug:b.slug,status:STATUS_PT[b.status]||b.status,bairro:b.district||'',plano:b.plan_id||null,foto:m&&aprovadas.has(m)?`/midia/${m}/320.webp`:null};})};
}
async function planos(db) {
  const rows=(await db.query('SELECT id,name,paid,status,price_cents FROM plans')).rows.sort((a,b)=>collator.compare(a.name,b.name));
  return {itens:rows.map(p=>({id:p.id,nome:p.name,pago:p.paid,status:PLANO_PT[p.status]||p.status,precoCentavos:p.price_cents??null}))};
}
// "Minha assinatura" (19.6): cada campo conferido, o desconhecido recusado em qualquer nível. null apaga.
const CICLOS=['mensal','trimestral','semestral','anual'],FORMAS=['pix','dinheiro','cartao','boleto','transferencia','mercado-pago'];
const invalida=()=>fail('A assinatura enviada pela gestão é inválida.',422,'minhaAssinatura');
const objeto=(v,chaves)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!chaves.includes(k))||chaves.some(k=>!(k in v)))throw invalida();return v;};
const DIA=/^\d{4}-\d{2}-\d{2}$/,QUEBRA=/[\r\n]/;
const dia=v=>{if(typeof v!=='string'||!DIA.test(v)||new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)!==v)throw invalida();return v;};
const centavos=(v,min)=>{if(!Number.isSafeInteger(v)||v<min||v>100000000)throw invalida();return v;};
const textoCurto=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max||QUEBRA.test(v))throw invalida();return v.trim();};
export function validarMinhaAssinatura(v) {
  if(v===null)return null;
  const a=objeto(v,['plano','valorCentavos','ciclo','venceEm','status','ultimosPagamentos','comoPagar']);
  const plano=a.plano===null?null:(p=>({id:textoCurto(p.id,120),nome:textoCurto(p.nome,120)}))(objeto(a.plano,['id','nome']));
  if(!CICLOS.includes(a.ciclo)||!['ativa','suspensa'].includes(a.status)||!Array.isArray(a.ultimosPagamentos)||a.ultimosPagamentos.length>3)throw invalida();
  const pagamentos=a.ultimosPagamentos.map(x=>{const p=objeto(x,['pagoEm','valorCentavos','forma','referencia']),r=objeto(p.referencia,['de','ate']);
    if(!FORMAS.includes(p.forma))throw invalida();return {pagoEm:dia(p.pagoEm),valorCentavos:centavos(p.valorCentavos,1),forma:p.forma,referencia:{de:dia(r.de),ate:dia(r.ate)}};});
  const c=objeto(a.comoPagar,['chavePix','whatsapp']);
  if(typeof c.chavePix!=='string'||c.chavePix.length>140||QUEBRA.test(c.chavePix)||typeof c.whatsapp!=='string'||(c.whatsapp!==''&&!/^55\d{10,11}$/.test(c.whatsapp)))throw invalida();
  return {plano,valorCentavos:centavos(a.valorCentavos,0),ciclo:a.ciclo,venceEm:dia(a.venceEm),status:a.status,ultimosPagamentos:pagamentos,comoPagar:{chavePix:c.chavePix.trim(),whatsapp:c.whatsapp}};
}
// Comparação sem depender da ordem das chaves (o jsonb reordena).
const canon=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(c=>[c,x[c]])):x);
async function definirPlano(db,{id,corpo,ip,now}) {
  let p;try{p=JSON.parse(corpo.toString()||'null');}catch{throw fail('JSON inválido.',400);}
  if(!p||typeof p!=='object'||Array.isArray(p))throw fail('Envie um objeto JSON.',400);
  rejectExtra(p,['plano','gerida','assinatura','motivo','minhaAssinatura']);
  if(p.plano!==null&&typeof p.plano!=='string')throw fail('Informe o plano ou null.',422,'plano');
  if(typeof p.gerida!=='boolean')throw fail('Informe gerida (true ou false).',422,'gerida');
  if(p.assinatura!==undefined&&p.assinatura!==null&&(typeof p.assinatura!=='string'||p.assinatura.length>64))throw fail('Valor inválido.',422,'assinatura');
  if(p.motivo!==undefined&&(typeof p.motivo!=='string'||p.motivo.length>40))throw fail('Use até 40 caracteres.',422,'motivo');
  const minha=p.minhaAssinatura===undefined?undefined:validarMinhaAssinatura(p.minhaAssinatura);
  return db.transaction(async tx=>{
    const b=(await tx.query('SELECT id,plan_id,plan_managed,gestao_assinatura FROM businesses WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!b)throw fail('Empresa não encontrada.',404);
    if(p.plano!==null&&!(await tx.query('SELECT 1 FROM plans WHERE id=$1',[p.plano])).rows.length)throw fail('Plano não encontrado.',422,'plano');
    const mudouAssinatura=minha!==undefined&&canon(b.gestao_assinatura??null)!==canon(minha);
    const alterado=b.plan_id!==p.plano||b.plan_managed!==p.gerida||mudouAssinatura;
    if(minha!==undefined)await tx.query('UPDATE businesses SET gestao_assinatura=$2,gestao_assinatura_em=$3 WHERE id=$1',[id,minha===null?null:JSON.stringify(minha),minha===null?null:now.toISOString()]);
    if(alterado) {
      await tx.query('UPDATE businesses SET plan_id=$2,plan_managed=$3,updated_at=$4,version=version+1 WHERE id=$1',[id,p.plano,p.gerida,now.toISOString()]);
      await audit(tx,{actor:'gestao',business:id,action:'plano_definido_gestao',resource:id,before:{plano:b.plan_id,planoGerido:b.plan_managed},
        after:{plano:p.plano,planoGerido:p.gerida,assinatura:p.assinatura??null,motivo:p.motivo||'',...(minha!==undefined?{minhaAssinatura:minha!==null}:{})},ip});
    }
    return {id,plano:p.plano,alterado};
  });
}

export async function integracaoAPI({db,req,path,method,url,now,ip,chaves,send,origin,leads=false}) {
  if(!path.startsWith('/api/integracao/'))return false;
  // Sem chaves, ou chegando pelo proxy (X-Forwarded-For), a rota não existe (19.3).
  if(!chaves?.size||req.headers['x-forwarded-for']!==undefined)throw fail('Endpoint não encontrado.',404);
  const corpo=await lerCorpo(req);
  await autenticar(db,{req,corpo,chaves,now});
  const ok=v=>(send(200,v),true);
  if(method==='GET'&&path==='/api/integracao/v1/empresas')return ok(await empresas(db,url));
  if(method==='GET'&&path==='/api/integracao/v1/planos')return ok(await planos(db));
  if(method==='GET'&&path==='/api/integracao/v1/metricas')return ok(await metricasGestao(db,url,now));
  // Pedidos do cadastro (23.3): só de leitura; com a chave dos leads desligada, a rota não existe.
  if(method==='GET'&&path==='/api/integracao/v1/pedidos'){if(!leads)throw fail('Endpoint não encontrado.',404);return ok(await pedidosDesde(db,url,{now,origin}));}
  const m=/^\/api\/integracao\/v1\/empresas\/([^/]+)\/plano$/.exec(path);
  if(method==='PUT'&&m){if(!ID.test(m[1]))throw fail('Empresa não encontrada.',404);return ok(await definirPlano(db,{id:m[1],corpo,ip,now}));}
  throw fail('Endpoint não encontrado.',404);
}
