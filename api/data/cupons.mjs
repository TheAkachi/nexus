import { randomBytes, randomInt } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit, diff } from '../lib/auditoria.mjs';
import { localNow } from '../lib/horario.mjs';
import { normalize, oneLine, safeURL, clip } from '../lib/saneamento.mjs';
import { limit } from '../auth.mjs';
import { categoryTree, matchesHomeCategory } from './categorias.mjs';
import { rota, titulo, indisponivel, naoEncontrada } from './rota.mjs';
import { activeCampaigns, empresaAnunciante } from './campanhas.mjs';
import { adsFor } from './anuncios.mjs';
import { rejectExtra, needVersion, conflito, texto, dia, lista, casa, filtro } from './admin/comum.mjs';

// Cupons das empresas (contrato, seção 14): página pública, coleta com login, minha conta, painel do afiliado e admin.
const POR_PAGINA=24,EM_VIGOR_MAX=10;
const hojeEm=now=>localNow(now).date;
const addDays=(day,n)=>new Date(Date.parse(`${day}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
const iso=d=>d?new Date(d).toISOString():null;
const image=src=>safeURL(src,{image:true})?src:'';
const SELECT=`SELECT c.*,c.starts_on::text AS inicio,c.ends_on::text AS validade,b.slug,b.name AS business_name,b.district,b.details,b.status AS business_status
  FROM coupons c JOIN businesses b ON b.id=c.business_id`;
// No ar: ativo, de empresa publicada, já começou e não venceu (o esgotado continua no ar, mas sai das listas).
const PUBLICO="c.status='ativo' AND b.status='published' AND c.ends_on>=$1::date AND (c.starts_on IS NULL OR c.starts_on<=$1::date)";
const restantesDe=c=>c.quantity==null?null:Math.max(0,c.quantity-c.claimed);
const esgotado=c=>restantesDe(c)===0;

// vm CupomCard (14.3). coleta: a coleta de quem está logado; sem ela, o código não sai do servidor.
export function cupomCardVM(c,coleta=null) {
  const d=c.details||{};
  return {id:c.id,titulo:c.title,condicoes:c.conditions,validade:c.validade,restantes:restantesDe(c),esgotado:esgotado(c),href:`/cupons/${c.id}`,
    empresa:{id:c.business_id,slug:c.slug,name:c.business_name,image:image(d.image),district:c.district||'',category:d.categories?.[0]||''},
    coletado:Boolean(coleta),codigo:coleta?c.code:''};
}
async function coletasDe(db,userId) {
  if(!userId)return new Map();
  return new Map((await db.query('SELECT coupon_id,claimed_at FROM coupon_claims WHERE user_id=$1',[userId])).rows.map(r=>[r.coupon_id,r.claimed_at]));
}
const recentes=(a,b)=>new Date(b.created_at)-new Date(a.created_at)||a.title.localeCompare(b.title,'pt-BR');
// Cupons no ar (também o sitemap): ativos, de empresa publicada, entre o início e a validade.
export async function cuponsNoAr(db,now,{empresa=null}={}) {
  const args=[hojeEm(now)];if(empresa)args.push(empresa);
  return (await db.query(`${SELECT} WHERE ${PUBLICO}${empresa?' AND c.business_id=$2':''}`,args)).rows.sort(recentes);
}

// /cupons: os mais novos primeiro, 24 por página, sem os esgotados; ?q= e ?categoria=. conta: {tipo, csrf} ou null.
export async function loadCupons({db,url,now,random=Math.random,usuario=null,conta=null}) {
  const p=url.searchParams,q=(p.get('q')||'').slice(0,100),categoria=(p.get('categoria')||'').slice(0,100);
  const todos=(await cuponsNoAr(db,now)).filter(c=>!esgotado(c));
  const empresas=[...new Map(todos.map(c=>[c.business_id,{id:c.business_id,details:c.details}])).values()];
  const lista=todos.filter(c=>(!q||normalize(`${c.title} ${c.conditions} ${c.business_name}`).includes(normalize(q)))&&matchesHomeCategory({details:c.details},categoria));
  const total=lista.length,pages=Math.max(1,Math.ceil(total/POR_PAGINA)),requested=parseInt(p.get('page')||'1',10)||1;
  if(requested>pages)return naoEncontrada();
  const current=Math.max(1,requested),coletas=await coletasDe(db,usuario);
  const items=lista.slice((current-1)*POR_PAGINA,current*POR_PAGINA).map(c=>cupomCardVM(c,coletas.get(c.id)));
  const pagina=current>1?` · página ${current}`:'';
  const ads=adsFor('cupons',{campaigns:await activeCampaigns(db,now),random,itens:items.length});
  return rota('cupons',{items,total,pages,current,q,categoria,categorias:categoryTree(empresas),conta,ads},
    {title:titulo(`Cupons de desconto do comércio local${pagina}`),
     description:`Cupons de desconto das empresas do Nexus em Rio de Janeiro. Entre na sua conta, pegue o cupom e use na loja.${current>1?` Página ${current}.`:''}`});
}

// /cupons/<id>: o cupom no ar (esgotado também) e até 4 outros da mesma empresa. Fora do ar: indisponível.
export async function loadCupom({db,path,now,random=Math.random,usuario=null,conta=null}) {
  const id=/^\/cupons\/([a-f0-9]{12})$/.exec(path)?.[1];
  if(!id)return naoEncontrada();
  const c=(await db.query(`${SELECT} WHERE c.id=$2 AND ${PUBLICO}`,[hojeEm(now),id])).rows[0];
  if(!c)return indisponivel();
  const coletas=await coletasDe(db,usuario);
  const outros=(await cuponsNoAr(db,now,{empresa:c.business_id})).filter(o=>o.id!==c.id&&!esgotado(o)).slice(0,4).map(o=>cupomCardVM(o,coletas.get(o.id)));
  // Regra do perfil (16.2): sem concorrente e nada na empresa pagante.
  const ads=adsFor('cupom',{campaigns:await activeCampaigns(db,now),random,empresa:await empresaAnunciante(db,c.business_id)});
  return rota('cupom',{cupom:cupomCardVM(c,coletas.get(c.id)),outros,conta,ads},
    {title:titulo(`${oneLine(c.title)} · ${c.business_name}`),description:clip(`Cupom da ${c.business_name} no Nexus: ${c.conditions}`),ogImage:image(c.details?.image)});
}

// Cupons no ar de uma empresa, para o perfil (Empresa.cupons).
export async function cuponsDaEmpresa(db,empresa,now,usuario=null) {
  const coletas=await coletasDe(db,usuario);
  return (await cuponsNoAr(db,now,{empresa})).filter(c=>!esgotado(c)).map(c=>cupomCardVM(c,coletas.get(c.id)));
}

// Coletar (14.4): uma vez por conta; coletar de novo devolve o mesmo. A trava da linha impede passar da quantidade.
export async function coletar(db,{id,session,now=new Date()}) {
  await limit(db,`coleta:${session.user_id}`,60,3600000,now);
  return db.transaction(async tx=>{
    const c=(await tx.query(`SELECT c.* FROM coupons c JOIN businesses b ON b.id=c.business_id WHERE c.id=$2 AND ${PUBLICO} FOR UPDATE OF c`,[hojeEm(now),id])).rows[0];
    if(!c)throw fail('Cupom não encontrado.',404);
    const ja=(await tx.query('SELECT claimed_at FROM coupon_claims WHERE coupon_id=$1 AND user_id=$2',[id,session.user_id])).rows[0];
    if(ja)return {coletado:true,codigo:c.code,coletadoEm:iso(ja.claimed_at)};
    if(esgotado(c))throw fail('Este cupom esgotou.',422);
    await tx.query('INSERT INTO coupon_claims(coupon_id,user_id,claimed_at) VALUES($1,$2,$3)',[id,session.user_id,now.toISOString()]);
    await tx.query('UPDATE coupons SET claimed=claimed+1 WHERE id=$1',[id]);
    return {coletado:true,codigo:c.code,coletadoEm:now.toISOString()};
  });
}

// Cupons coletados pela conta, do mais recente ao mais antigo, com a situação de hoje (14.3).
export async function meusCupons(db,userId,now=new Date()) {
  const hoje=hojeEm(now);
  const rows=(await db.query(`SELECT c.*,c.starts_on::text AS inicio,c.ends_on::text AS validade,b.slug,b.name AS business_name,b.district,b.details,b.status AS business_status,k.claimed_at
    FROM coupon_claims k JOIN coupons c ON c.id=k.coupon_id JOIN businesses b ON b.id=c.business_id WHERE k.user_id=$1 ORDER BY k.claimed_at DESC,c.title`,[userId])).rows;
  return rows.map(c=>({...cupomCardVM(c,c.claimed_at),coletadoEm:iso(c.claimed_at),
    situacao:c.status!=='ativo'||c.business_status!=='published'?'encerrado':c.validade<hoje?'vencido':'valido'}));
}

// Painel do afiliado (14.6) -------------------------------------------------------------------------------------------------
export function statusCupom(c,hoje) {
  if(c.status==='removido'||c.status==='suspenso')return c.status;
  if(c.validade<hoje)return 'vencido';
  if(c.status==='pausado')return 'pausado';
  if(esgotado(c))return 'esgotado';
  return c.inicio&&c.inicio>hoje?'agendado':'ativo';
}
export const cupomPainelVM=(c,hoje)=>({id:c.id,titulo:c.title,condicoes:c.conditions,codigo:c.code,inicio:c.inicio||null,validade:c.validade,quantidade:c.quantity??null,
  coletados:c.claimed,status:statusCupom(c,hoje),suspensao:c.status==='suspenso'&&c.suspension?{motivo:c.suspension.motivo||'',em:c.suspension.em||''}:null,
  url:`/cupons/${c.id}`,criado:iso(c.created_at),version:c.version});
const SELECT_PAINEL='SELECT c.*,c.starts_on::text AS inicio,c.ends_on::text AS validade FROM coupons c';
const SELECT_ADMIN='SELECT c.*,c.starts_on::text AS inicio,c.ends_on::text AS validade,b.name AS business_name FROM coupons c JOIN businesses b ON b.id=c.business_id';
export async function cuponsEmpresa(db,empresa,now=new Date()) {
  const hoje=hojeEm(now);
  return {cupons:(await db.query(`${SELECT_PAINEL} WHERE c.business_id=$1 AND c.status<>'removido'`,[empresa])).rows.sort(recentes).map(c=>cupomPainelVM(c,hoje))};
}
async function cupomDaEmpresa(db,empresa,cupom,{lock=false}={}) {
  const c=(await db.query(`${SELECT_PAINEL} WHERE c.id=$1 AND c.business_id=$2 AND c.status<>'removido'${lock?' FOR UPDATE':''}`,[cupom,empresa])).rows[0];
  if(!c)throw fail('Cupom não encontrado.',404);
  return c;
}
// Código gerado: 8 caracteres sem 0, O, 1 nem I (fácil de ditar no balcão).
const LETRAS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const gerarCodigo=()=>Array.from({length:8},()=>LETRAS[randomInt(LETRAS.length)]).join('');
function validarCupom(p,{novo,atual,hoje}) {
  const v={};
  const t=texto(p.titulo,'titulo',80,{obrigatorio:novo,min:4});if(t!==undefined)v.title=oneLine(t);
  const cond=texto(p.condicoes,'condicoes',600,{obrigatorio:novo,min:10});if(cond!==undefined)v.conditions=cond.replace(/\n{3,}/g,'\n\n');
  const fim=dia(p.validade,'validade',{obrigatorio:novo});
  if(fim!==undefined) {
    if(fim===null)throw fail('Informe a validade do cupom.',422,'validade');
    if(fim<hoje)throw fail('A validade vai de hoje em diante.',422,'validade');
    if(fim>addDays(hoje,366))throw fail('A validade pode ir até 1 ano à frente.',422,'validade');
    v.ends_on=fim;
  }
  const ini=dia(p.inicio,'inicio');
  if(ini!==undefined) {
    if(ini&&ini<hoje&&ini!==atual?.inicio)throw fail('O início vai de hoje em diante.',422,'inicio');
    v.starts_on=ini||null;
  }
  const inicio=v.starts_on!==undefined?v.starts_on:atual?.inicio,validade=v.ends_on??atual?.validade;
  if(inicio&&validade&&inicio>validade)throw fail('O início vem antes da validade.',422,'inicio');
  if(p.quantidade!==undefined) {
    if(p.quantidade!==null&&(!Number.isInteger(p.quantidade)||p.quantidade<1||p.quantidade>100000))throw fail('A quantidade vai de 1 a 100000, ou fica sem limite.',422,'quantidade');
    if(p.quantidade!==null&&atual&&p.quantidade<atual.claimed)throw fail(`Já foram coletados ${atual.claimed}: a quantidade não pode ficar abaixo disso.`,422,'quantidade');
    v.quantity=p.quantidade;
  }
  if(p.codigo!==undefined&&p.codigo!==null&&p.codigo!=='') {
    const cod=typeof p.codigo==='string'?p.codigo.trim().toUpperCase():'';
    if(!/^[A-Z0-9-]{4,20}$/.test(cod))throw fail('Use de 4 a 20 letras, números ou hífen no código.',422,'codigo');
    v.code=cod;
  } else if(novo)v.code=gerarCodigo();
  // Depois da primeira coleta, quem coletou guardou as condições: só a validade e a quantidade mudam.
  if(atual?.claimed>0) {
    const atuais={title:atual.title,conditions:atual.conditions,code:atual.code,starts_on:atual.inicio||null};
    const campos={title:'titulo',conditions:'condicoes',code:'codigo',starts_on:'inicio'};
    const mudou=Object.keys(atuais).find(k=>v[k]!==undefined&&v[k]!==atuais[k]);
    if(mudou)throw fail('Este cupom já foi coletado: só a validade e a quantidade mudam. Para mudar o resto, crie outro cupom.',422,campos[mudou]);
  }
  return v;
}
export async function criarCupom(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['titulo','condicoes','validade','inicio','quantidade','codigo']);
  const hoje=hojeEm(now),v=validarCupom(p,{novo:true,hoje}),cupom=randomBytes(6).toString('hex');
  return db.transaction(async tx=>{
    await tx.query('SELECT id FROM businesses WHERE id=$1 FOR UPDATE',[id]);
    const emVigor=(await tx.query("SELECT count(*)::int AS n FROM coupons WHERE business_id=$1 AND status<>'removido' AND ends_on>=$2::date",[id,hoje])).rows[0].n;
    if(emVigor>=EM_VIGOR_MAX)throw fail(`A empresa pode ter até ${EM_VIGOR_MAX} cupons em vigor. Tire um deles ou espere vencer.`,422);
    await tx.query(`INSERT INTO coupons(id,business_id,title,conditions,code,starts_on,ends_on,quantity,created_by,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,[cupom,id,v.title,v.conditions,v.code,v.starts_on||null,v.ends_on,v.quantity??null,session.user_id,now.toISOString()]);
    const vm=cupomPainelVM(await cupomDaEmpresa(tx,id,cupom),hoje);
    await audit(tx,{actor:session.user_id,business:id,action:'cupom_criado',resource:cupom,after:vm,ip});
    return vm;
  });
}
export async function editarCupom(db,{id,cupom,p,session,ip,now=new Date()}) {
  rejectExtra(p,['titulo','condicoes','validade','inicio','quantidade','codigo','version']);
  const version=needVersion(p),hoje=hojeEm(now);
  return db.transaction(async tx=>{
    const c=await cupomDaEmpresa(tx,id,cupom,{lock:true});
    if(c.version!==version)throw conflito();
    const v=validarCupom(p,{novo:false,atual:c,hoje}),antes=cupomPainelVM(c,hoje);
    const novo={...c,...v};
    await tx.query('UPDATE coupons SET title=$2,conditions=$3,code=$4,starts_on=$5,ends_on=$6,quantity=$7,updated_at=$8,version=version+1 WHERE id=$1',
      [cupom,novo.title,novo.conditions,novo.code,v.starts_on!==undefined?v.starts_on:c.inicio||null,v.ends_on??c.validade,v.quantity!==undefined?v.quantity:c.quantity,now.toISOString()]);
    const depois=cupomPainelVM(await cupomDaEmpresa(tx,id,cupom),hoje),mudou=diff(antes,depois);
    await audit(tx,{actor:session.user_id,business:id,action:'cupom_editado',resource:cupom,before:mudou.before,after:mudou.after,ip});
    return depois;
  });
}
// Pausar e reativar pelo painel. O cupom suspenso pela equipe só volta pelo admin.
export async function pausarCupom(db,{id,cupom,acao,p,session,ip,now=new Date()}) {
  rejectExtra(p,['version']);const version=needVersion(p),hoje=hojeEm(now);
  return db.transaction(async tx=>{
    const c=await cupomDaEmpresa(tx,id,cupom,{lock:true});
    if(c.version!==version)throw conflito();
    if(c.status==='suspenso')throw fail('Este cupom foi suspenso pelo Nexus. Fale com a equipe para reativar.',422,'status');
    const novo=acao==='pausar'?'pausado':'ativo';
    if(c.status!==novo) {
      await tx.query('UPDATE coupons SET status=$2,updated_at=$3,version=version+1 WHERE id=$1',[cupom,novo,now.toISOString()]);
      await audit(tx,{actor:session.user_id,business:id,action:acao==='pausar'?'cupom_pausado':'cupom_reativado',resource:cupom,before:{status:c.status},after:{status:novo},ip});
    }
    return cupomPainelVM(await cupomDaEmpresa(tx,id,cupom),hoje);
  });
}
// Tirar do site: quem coletou passa a ver o cupom como encerrado.
export async function removerCupom(db,{id,cupom,session,ip,now=new Date()}) {
  return db.transaction(async tx=>{
    const c=await cupomDaEmpresa(tx,id,cupom,{lock:true});
    await tx.query("UPDATE coupons SET status='removido',updated_at=$2,version=version+1 WHERE id=$1",[cupom,now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:id,action:'cupom_removido',resource:cupom,before:{titulo:c.title,status:c.status,coletados:c.claimed},ip});
    return {ok:true};
  });
}

// Admin da equipe (14.7) ------------------------------------------------------------------------------------------------------
export async function listarCuponsAdmin(db,url,now=new Date()) {
  const hoje=hojeEm(now),q=filtro(url,'q'),empresa=filtro(url,'empresa'),status=filtro(url,'status');
  const rows=(await db.query(SELECT_ADMIN)).rows.sort(recentes);
  return lista(rows.filter(c=>casa(q,c.title,c.code,c.business_name)&&(!empresa||c.business_id===empresa)&&(!status||statusCupom(c,hoje)===status))
    .map(c=>({...cupomPainelVM(c,hoje),empresa:{id:c.business_id,nome:c.business_name}})),url);
}
async function cupomAdmin(tx,id,hoje) {
  const c=(await tx.query(`${SELECT_ADMIN} WHERE c.id=$1`,[id])).rows[0];
  return {...cupomPainelVM(c,hoje),empresa:{id:c.business_id,nome:c.business_name}};
}
export async function suspenderCupom(db,{id,acao,p,session,ip,now=new Date()}) {
  rejectExtra(p,acao==='suspender'?['motivo','version']:['version']);
  const version=needVersion(p),hoje=hojeEm(now),motivo=acao==='suspender'?texto(p.motivo,'motivo',300,{obrigatorio:true,min:4}):'';
  return db.transaction(async tx=>{
    const c=(await tx.query("SELECT * FROM coupons WHERE id=$1 AND status<>'removido' FOR UPDATE",[id])).rows[0];
    if(!c)throw fail('Cupom não encontrado.',404);
    if(c.version!==version)throw conflito();
    if(acao==='suspender') {
      await tx.query("UPDATE coupons SET status='suspenso',suspension=$2::jsonb,updated_at=$3,version=version+1 WHERE id=$1",[id,JSON.stringify({motivo,em:now.toISOString(),por:session.user_id}),now.toISOString()]);
      await audit(tx,{actor:session.user_id,business:c.business_id,action:'cupom_suspenso',resource:id,before:{status:c.status},after:{status:'suspenso',motivo},ip});
    } else {
      if(c.status!=='suspenso')throw fail('Só o cupom suspenso pela equipe volta por aqui.',422,'status');
      await tx.query("UPDATE coupons SET status='ativo',suspension=NULL,updated_at=$2,version=version+1 WHERE id=$1",[id,now.toISOString()]);
      await audit(tx,{actor:session.user_id,business:c.business_id,action:'cupom_reativado',resource:id,before:{status:'suspenso'},after:{status:'ativo'},ip});
    }
    return cupomAdmin(tx,id,hoje);
  });
}
// ResumoAdmin.cupons: no ar hoje (sem os esgotados) e coletas dos últimos 30 dias. empresas: o recorte do resumo, ou null.
export async function resumoCupons(db,now=new Date(),empresas=null) {
  const filtro=empresas?' AND c.business_id=ANY($2)':'',args=empresas?[hojeEm(now),empresas]:[hojeEm(now)];
  const ativos=(await db.query(`SELECT count(*)::int AS n FROM coupons c JOIN businesses b ON b.id=c.business_id WHERE ${PUBLICO} AND (c.quantity IS NULL OR c.claimed<c.quantity)${filtro}`,args)).rows[0].n;
  const desde=new Date(now.getTime()-30*86400000).toISOString();
  const coletas=(await db.query(`SELECT count(*)::int AS n FROM coupon_claims k JOIN coupons c ON c.id=k.coupon_id WHERE k.claimed_at>=$1${empresas?' AND c.business_id=ANY($2)':''}`,
    empresas?[desde,empresas]:[desde])).rows[0].n;
  return {ativos,coletas30:coletas};
}
