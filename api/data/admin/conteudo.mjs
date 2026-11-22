import { randomUUID } from 'node:crypto';
import { fail } from '../../lib/erros.mjs';
import { audit, diff } from '../../lib/auditoria.mjs';
import { slugify, oneLine, safeURL, withoutTracking } from '../../lib/saneamento.mjs';
import { sanitizeHtml, textoDoHtml } from '../../lib/html-seguro.mjs';
import { GRUPOS } from '../categorias.mjs';
import { validarItem, itemVM } from '../painel.mjs';
import { rejectExtra, needVersion, conflito, texto, imagem, iso, lista, casa, filtro, STATUS_PT, STATUS_DB } from './comum.mjs';

// Notícias, artigos, classificados, eventos, ofertas e coleções no admin (contrato 13.4).
// Tudo o que a equipe cria ou edita fica gerido (managed_at ou source 'admin'): o db:seed e a coleta não sobrescrevem.
// Sem notícia desde a v0.15.0 (contrato 15.3): as notícias ficam no banco, fora do admin.
export const TIPOS={artigo:'article',classificado:'classified'};
const TIPO_PT=Object.fromEntries(Object.entries(TIPOS).map(([k,v])=>[v,k]));
const words=s=>(s.match(/\S+/g)||[]).length;
// Data de publicação: aaaa-mm-dd ou aaaa-mm-ddThh:mm, no horário de São Paulo.
function quando(v,campo) {
  if(v===undefined)return undefined;if(v===''||v===null)return '';
  const m=typeof v==='string'&&/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(v);
  if(!m||Number.isNaN(Date.parse(`${m[1]}T${m[2]||'00:00'}:00-03:00`)))throw fail('Use aaaa-mm-dd ou aaaa-mm-ddThh:mm.',422,campo);
  return `${m[1]}T${m[2]||'00:00'}:00-03:00`;
}
const statusDe=(p,campo='status')=>{if(p.status===undefined)return undefined;if(!['rascunho','publicado','pausado'].includes(p.status))throw fail('Status: rascunho, publicado ou pausado.',422,campo);return STATUS_DB[p.status];};
const empresaExiste=async(db,id,campo='empresa')=>{if(id===null||id===undefined||id==='')return null;if(!(await db.query('SELECT 1 FROM businesses WHERE id=$1',[id])).rows.length)throw fail('Empresa não encontrada.',422,campo);return id;};

// Publicações --------------------------------------------------------------------------------------------------------------
export const conteudoVM=c=>{const m=c.metadata||{};return {id:c.id,tipo:TIPO_PT[c.kind],slug:c.slug,titulo:c.title,resumo:m.summary||'',html:c.body_html||'',autor:m.author||'',
  data:m.date||'',editorias:(m.editorias||[]).map(e=>e.label),imagem:m.image||'',galeria:m.gallery||[],fonte:c.source_url||'',status:STATUS_PT[c.status]||c.status,
  classificado:c.kind==='classified'?{preco:m.price||'',telefone:m.phone||'',empresa:m.business||null}:null,...(c.kind==='article'?{destaque:m.destaque===true}:{}),
  gerida:Boolean(c.managed_at),atualizada:iso(c.updated_at),version:c.version};};
// Destaque de /artigos (18.6): marcar um desmarca o anterior. Só artigo tem destaque.
async function marcarDestaque(tx,c,destaque) {
  if(destaque===undefined)return;
  if(typeof destaque!=='boolean')throw fail('Valor inválido.',422,'destaque');
  if(c.kind!=='article')throw fail('Só artigo tem destaque.',422,'destaque');
  if(destaque)await tx.query("UPDATE content SET metadata=metadata-'destaque' WHERE kind='article' AND id<>$1 AND metadata ? 'destaque'",[c.id]);
  await tx.query("UPDATE content SET metadata=CASE WHEN $2 THEN jsonb_set(metadata,'{destaque}','true') ELSE metadata-'destaque' END WHERE id=$1",[c.id,destaque]);
}
export async function listarConteudo(db,url) {
  const tipo=TIPOS[filtro(url,'tipo')||'artigo'];if(!tipo)throw fail('Tipo: artigo ou classificado.',422,'tipo');
  const q=filtro(url,'q'),status=STATUS_DB[filtro(url,'status')]||'',editoria=filtro(url,'editoria');
  const rows=(await db.query("SELECT * FROM content WHERE kind=$1 ORDER BY metadata->>'date' DESC NULLS LAST,title",[tipo])).rows;
  return lista(rows.filter(c=>casa(q,c.title,c.slug)&&(!status||c.status===status)&&(!editoria||(c.metadata?.editorias||[]).some(e=>e.slug===editoria))).map(conteudoVM),url);
}
async function publicacao(db,id,{lock=false}={}){const c=(await db.query(`SELECT * FROM content WHERE id=$1 AND kind=ANY($2)${lock?' FOR UPDATE':''}`,[id,Object.values(TIPOS)])).rows[0];if(!c)throw fail('Publicação não encontrada.',404);return c;}
export const obterConteudo=async(db,id)=>conteudoVM(await publicacao(db,id));
async function validarConteudo(db,p,{novo,kind}) {
  const v={};
  const titulo=texto(p.titulo,'titulo',200,{obrigatorio:novo,min:3});if(titulo!==undefined)v.title=oneLine(titulo);
  if(p.html!==undefined){if(typeof p.html!=='string'||p.html.length>60000)throw fail('O texto pode ter até 60 mil caracteres.',422,'html');v.body_html=sanitizeHtml(p.html);v.body=textoDoHtml(v.body_html);}
  else if(novo){v.body_html='';v.body='';}
  const resumo=texto(p.resumo,'resumo',300);if(resumo!==undefined)v.summary=oneLine(resumo);
  const autor=texto(p.autor,'autor',80);if(autor!==undefined)v.author=oneLine(autor);
  const data=quando(p.data,'data');if(data!==undefined)v.date=data;
  if(p.editorias!==undefined){if(!Array.isArray(p.editorias)||p.editorias.length>6||p.editorias.some(e=>typeof e!=='string'||!oneLine(e)||e.length>60))throw fail('Use até 6 editorias, de até 60 caracteres.',422,'editorias');
    v.editorias=[...new Map(p.editorias.map(e=>[slugify(e),{slug:slugify(e),label:oneLine(e)}])).values()];}
  const img=imagem(p.imagem,'imagem');if(img!==undefined)v.image=img;
  if(p.galeria!==undefined){if(!Array.isArray(p.galeria)||p.galeria.length>12)throw fail('Use até 12 fotos na galeria.',422,'galeria');v.gallery=p.galeria.map(g=>imagem(g,'galeria'));}
  if(p.fonte!==undefined){const f=p.fonte?withoutTracking(safeURL(p.fonte)):'';if(p.fonte&&!f)throw fail('Use um link https.',422,'fonte');v.source_url=f;}
  if(p.classificado!==undefined) {
    if(kind!=='classified')throw fail('Só classificado tem preço, telefone e empresa.',422,'classificado');
    const c=p.classificado||{};rejectExtra(c,['preco','telefone','empresa']);
    v.price=oneLine(texto(c.preco??'','preco',40));v.phone=oneLine(texto(c.telefone??'','telefone',40));v.business=await empresaExiste(db,c.empresa);
  }
  return v;
}
function metadados(atual,v) {
  const m={...atual};
  for(const k of ['summary','author','date','image','gallery','price','phone','business'])if(v[k]!==undefined)m[k]=v[k];
  if(v.editorias){m.editorias=v.editorias;m.category=v.editorias.map(e=>e.label).join(', ');}
  if(v.body!==undefined)m.words=words(v.body);
  if(!m.summary&&v.body)m.summary=oneLine(v.body).slice(0,160);
  return m;
}
export async function criarConteudo(db,{p,session,ip,now=new Date()}) {
  rejectExtra(p,['tipo','titulo','resumo','html','autor','data','editorias','imagem','galeria','fonte','classificado','destaque']);
  const kind=TIPOS[p.tipo];if(!kind)throw fail('Tipo: artigo ou classificado.',422,'tipo');
  const v=await validarConteudo(db,p,{novo:true,kind});
  let slug=slugify(v.title)||'publicacao';
  for(let n=2;(await db.query('SELECT 1 FROM content WHERE kind=$1 AND slug=$2',[kind,slug])).rows.length;n++)slug=`${slugify(v.title)}-${n}`;
  const id=`${kind}:${slug}`,m=metadados({author:'Equipe Nexus',editorias:[]},v);
  return db.transaction(async tx=>{
    const c=(await tx.query(`INSERT INTO content(id,kind,slug,title,body,source_url,metadata,body_html,status,managed_at,created_by,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'draft',$9,$10,$9) RETURNING *`,[id,kind,slug,v.title,v.body,v.source_url||'',JSON.stringify(m),v.body_html,now.toISOString(),session.user_id])).rows[0];
    await marcarDestaque(tx,c,p.destaque);
    const n=(await tx.query('SELECT * FROM content WHERE id=$1',[id])).rows[0];
    await audit(tx,{actor:session.user_id,action:'conteudo_criado',resource:id,after:conteudoVM(n),ip});
    return conteudoVM(n);
  });
}
export async function editarConteudo(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['titulo','resumo','html','autor','data','editorias','imagem','galeria','fonte','classificado','destaque','version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const c=await publicacao(tx,id,{lock:true});if(c.version!==version)throw conflito();
    const v=await validarConteudo(tx,p,{novo:false,kind:c.kind}),m=metadados(c.metadata||{},v);
    const n=(await tx.query(`UPDATE content SET title=$2,body=$3,body_html=$4,source_url=$5,metadata=$6::jsonb,managed_at=COALESCE(managed_at,$7),updated_at=$7,version=version+1 WHERE id=$1 RETURNING *`,
      [id,v.title??c.title,v.body??c.body,v.body_html??c.body_html,v.source_url??c.source_url,JSON.stringify(m),now.toISOString()])).rows[0];
    await marcarDestaque(tx,n,p.destaque);
    const depois=(await tx.query('SELECT * FROM content WHERE id=$1',[id])).rows[0];
    const mudou=diff(conteudoVM(c),conteudoVM(depois));
    await audit(tx,{actor:session.user_id,action:'conteudo_editado',resource:id,before:mudou.before,after:mudou.after,ip});
    return conteudoVM(depois);
  });
}
export async function statusConteudo(db,{id,acao,p,session,ip,now=new Date()}) {
  rejectExtra(p,['version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const c=await publicacao(tx,id,{lock:true});if(c.version!==version)throw conflito();
    if(acao==='publicar'&&!c.body.trim())throw fail('Escreva o texto antes de publicar.',422,'html');
    const m={...c.metadata};if(acao==='publicar'&&!m.date)m.date=now.toISOString();
    const n=(await tx.query('UPDATE content SET status=$2,metadata=$3::jsonb,managed_at=COALESCE(managed_at,$4),updated_at=$4,version=version+1 WHERE id=$1 RETURNING *',
      [id,acao==='publicar'?'published':'paused',JSON.stringify(m),now.toISOString()])).rows[0];
    await audit(tx,{actor:session.user_id,action:`conteudo_${acao}`,resource:id,before:{status:STATUS_PT[c.status]},after:{status:STATUS_PT[n.status]},ip});
    return conteudoVM(n);
  });
}

// Eventos ----------------------------------------------------------------------------------------------------------------
const local=d=>{if(!d)return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(d)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
const eventoVM=e=>({id:e.id,titulo:e.title,descricao:e.description,inicio:local(e.starts_at),fim:local(e.ends_at),local:e.place,endereco:e.address,imagem:e.image_url,link:e.url,empresa:e.business_id,status:STATUS_PT[e.status],version:e.version});
export async function listarEventos(db,url) {
  const q=filtro(url,'q'),status=STATUS_DB[filtro(url,'status')]||'';
  const rows=(await db.query('SELECT * FROM events ORDER BY starts_at DESC')).rows;
  return lista(rows.filter(e=>casa(q,e.title,e.place)&&(!status||e.status===status)).map(eventoVM),url);
}
async function evento(db,id,{lock=false}={}){const e=(await db.query(`SELECT * FROM events WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!e)throw fail('Evento não encontrado.',404);return e;}
export const obterEvento=async(db,id)=>eventoVM(await evento(db,id));
async function validarEvento(db,p,{novo,atual={}}) {
  const v={};const titulo=texto(p.titulo,'titulo',160,{obrigatorio:novo,min:3});if(titulo!==undefined)v.title=oneLine(titulo);
  // Descrição em HTML, com o saneamento do bodyHtml (13.9, item 10).
  if(p.descricao!==undefined){if(typeof p.descricao!=='string'||p.descricao.length>8000)throw fail('A descrição pode ter até 8 mil caracteres.',422,'descricao');v.description=sanitizeHtml(p.descricao);}
  for(const [k,c] of [['local','place'],['endereco','address']]){const t=texto(p[k],k,200);if(t!==undefined)v[c]=oneLine(t);}
  const inicio=p.inicio!==undefined?quando(p.inicio,'inicio'):undefined;if(novo&&!inicio)throw fail('Informe o início.',422,'inicio');if(inicio!==undefined)v.starts_at=inicio;
  const fim=quando(p.fim,'fim');if(fim!==undefined)v.ends_at=fim||null;
  const s=v.starts_at??atual.starts_at,e=v.ends_at!==undefined?v.ends_at:atual.ends_at;
  if(s&&e&&Date.parse(e)<Date.parse(s))throw fail('O fim vem depois do início.',422,'fim');
  const img=imagem(p.imagem,'imagem');if(img!==undefined)v.image_url=img;
  if(p.link!==undefined){const l=p.link?withoutTracking(safeURL(p.link)):'';if(p.link&&!l)throw fail('Use um link https.',422,'link');v.url=l;}
  if(p.empresa!==undefined)v.business_id=await empresaExiste(db,p.empresa);
  return v;
}
export async function criarEvento(db,{p,session,ip,now=new Date()}) {
  rejectExtra(p,['titulo','descricao','inicio','fim','local','endereco','imagem','link','empresa']);
  const v=await validarEvento(db,p,{novo:true});let id=slugify(`${v.title}-${v.starts_at.slice(0,10)}`);
  for(let n=2;(await db.query('SELECT 1 FROM events WHERE id=$1 OR slug=$1',[id])).rows.length;n++)id=`${slugify(`${v.title}-${v.starts_at.slice(0,10)}`)}-${n}`;
  const e=(await db.query(`INSERT INTO events(id,slug,title,description,starts_at,ends_at,place,address,image_url,url,business_id,status,source,updated_at)
    VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft','admin',$11) RETURNING *`,[id,v.title,v.description||'',v.starts_at,v.ends_at||null,v.place||'',v.address||'',v.image_url||'',v.url||'',v.business_id||null,now.toISOString()])).rows[0];
  await audit(db,{actor:session.user_id,business:e.business_id,action:'evento_criado',resource:id,after:eventoVM(e),ip});
  return eventoVM(e);
}
export async function editarEvento(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['titulo','descricao','inicio','fim','local','endereco','imagem','link','empresa','version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const e=await evento(tx,id,{lock:true});if(e.version!==version)throw conflito();
    const v=await validarEvento(tx,p,{novo:false,atual:e});const x={...e,...v};
    const n=(await tx.query(`UPDATE events SET title=$2,description=$3,starts_at=$4,ends_at=$5,place=$6,address=$7,image_url=$8,url=$9,business_id=$10,source='admin',updated_at=$11,version=version+1 WHERE id=$1 RETURNING *`,
      [id,x.title,x.description,x.starts_at,x.ends_at,x.place,x.address,x.image_url,x.url,x.business_id,now.toISOString()])).rows[0];
    const mudou=diff(eventoVM(e),eventoVM(n));
    await audit(tx,{actor:session.user_id,business:n.business_id,action:'evento_editado',resource:id,before:mudou.before,after:mudou.after,ip});
    return eventoVM(n);
  });
}
export async function statusEvento(db,{id,acao,p,session,ip,now=new Date()}) {
  rejectExtra(p,['version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const e=await evento(tx,id,{lock:true});if(e.version!==version)throw conflito();
    const n=(await tx.query("UPDATE events SET status=$2,source='admin',updated_at=$3,version=version+1 WHERE id=$1 RETURNING *",[id,acao==='publicar'?'published':'paused',now.toISOString()])).rows[0];
    await audit(tx,{actor:session.user_id,business:n.business_id,action:`evento_${acao}`,resource:id,before:{status:STATUS_PT[e.status]},after:{status:STATUS_PT[n.status]},ip});
    return eventoVM(n);
  });
}

// Ofertas de qualquer empresa (a criada pela equipe publica sem passar pela fila) ----------------------------------------
const ofertaVM=r=>{const i=itemVM(r);return {id:i.id,empresa:r.business_id,nome:i.nome,descricao:i.descricao,precoModo:i.precoModo,precoCentavos:i.precoCentavos,condicoes:i.condicoes,validade:i.validade,imagem:r.image_url||'',status:i.status,version:i.version};};
export async function listarOfertas(db,url) {
  const q=filtro(url,'q'),status=STATUS_DB[filtro(url,'status')]||'',empresa=filtro(url,'empresa');
  const rows=(await db.query("SELECT * FROM catalog_items WHERE kind='offer' ORDER BY updated_at DESC")).rows;
  return lista(rows.filter(r=>casa(q,r.name)&&(!status||r.status===status)&&(!empresa||r.business_id===empresa)).map(ofertaVM),url);
}
async function oferta(db,id,{lock=false}={}){const r=(await db.query(`SELECT * FROM catalog_items WHERE id=$1 AND kind='offer'${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!r)throw fail('Oferta não encontrada.',404);return r;}
export const obterOferta=async(db,id)=>ofertaVM(await oferta(db,id));
export async function criarOferta(db,{p,session,ip,now=new Date()}) {
  rejectExtra(p,['empresa','nome','descricao','precoModo','precoCentavos','condicoes','validade','imagem']);
  const empresa=await empresaExiste(db,p.empresa);if(!empresa)throw fail('Escolha a empresa da oferta.',422,'empresa');
  const {empresa:_e,imagem:img,...item}=p,v=validarItem({...item,tipo:'oferta'},{now}),image=imagem(img,'imagem')||'',id=randomUUID();
  const r=(await db.query(`INSERT INTO catalog_items(id,business_id,kind,name,description,price_cents,price_mode,conditions,valid_until,image_url,status,approved_version,created_by,created_at,updated_at)
    VALUES($1,$2,'offer',$3,$4,$5,$6,$7,$8,$9,'published',1,$10,$11,$11) RETURNING *`,[id,empresa,v.name,v.description,v.price_cents,v.price_mode,v.conditions,v.valid_until,image,session.user_id,now.toISOString()])).rows[0];
  await audit(db,{actor:session.user_id,business:empresa,action:'oferta_criada_equipe',resource:id,after:ofertaVM(r),ip});
  return ofertaVM(r);
}
export async function editarOferta(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['nome','descricao','precoModo','precoCentavos','condicoes','validade','imagem','version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const r=await oferta(tx,id,{lock:true});if(r.version!==version)throw conflito();
    const {imagem:img,version:_v,...item}=p,v=validarItem({...item,tipo:'oferta'},{now,atual:itemVM(r)}),image=img!==undefined?imagem(img,'imagem'):r.image_url;
    const n=(await tx.query(`UPDATE catalog_items SET name=$2,description=$3,price_cents=$4,price_mode=$5,conditions=$6,valid_until=$7,image_url=$8,version=version+1,
      approved_version=CASE WHEN status='published' THEN version+1 ELSE approved_version END,updated_at=$9 WHERE id=$1 RETURNING *`,
      [id,v.name,v.description,v.price_cents,v.price_mode,v.conditions,v.valid_until,image,now.toISOString()])).rows[0];
    const mudou=diff(ofertaVM(r),ofertaVM(n));
    await audit(tx,{actor:session.user_id,business:n.business_id,action:'oferta_editada_equipe',resource:id,before:mudou.before,after:mudou.after,ip});
    return ofertaVM(n);
  });
}
export async function statusOferta(db,{id,acao,p,session,ip,now=new Date()}) {
  rejectExtra(p,['version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const r=await oferta(tx,id,{lock:true});if(r.version!==version)throw conflito();
    if(acao==='publicar')validarItem({},{now,atual:itemVM(r)});
    const n=(await tx.query(`UPDATE catalog_items SET status=$2,version=version+1,approved_version=CASE WHEN $2='published' THEN version+1 ELSE approved_version END,rejection=NULL,updated_at=$3 WHERE id=$1 RETURNING *`,
      [id,acao==='publicar'?'published':'paused',now.toISOString()])).rows[0];
    await audit(tx,{actor:session.user_id,business:n.business_id,action:`oferta_${acao}_equipe`,resource:id,before:{status:STATUS_PT[r.status]},after:{status:STATUS_PT[n.status]},ip});
    return ofertaVM(n);
  });
}

// Coleções da home (por grupos de categorias) -------------------------------------------------------------------------------
const COLECAO_STATUS={rascunho:'draft',publicado:'published',pausado:'paused'};
const colecaoVM=c=>({id:c.id,titulo:c.title,subtitulo:c.subtitle,grupos:c.groups||[],posicao:c.position,status:STATUS_PT[c.status],version:c.version});
export async function listarColecoes(db,url){const rows=(await db.query('SELECT * FROM collections ORDER BY position,id')).rows;const q=filtro(url,'q');return lista(rows.filter(c=>casa(q,c.title)).map(colecaoVM),url);}
export async function obterColecao(db,id){const c=(await db.query('SELECT * FROM collections WHERE id=$1',[id])).rows[0];if(!c)throw fail('Coleção não encontrada.',404);return colecaoVM(c);}
function validarColecao(p,{novo}) {
  const v={};const titulo=texto(p.titulo,'titulo',80,{obrigatorio:novo,min:3});if(titulo!==undefined)v.title=oneLine(titulo);
  const sub=texto(p.subtitulo,'subtitulo',160);if(sub!==undefined)v.subtitle=oneLine(sub);
  if(p.grupos!==undefined){const ok=new Set(GRUPOS.map(g=>g.slug));if(!Array.isArray(p.grupos)||!p.grupos.length||p.grupos.some(g=>!ok.has(g)))throw fail('Escolha os grupos de categoria da coleção.',422,'grupos');v.groups=[...new Set(p.grupos)];}
  else if(novo)throw fail('Escolha os grupos de categoria da coleção.',422,'grupos');
  if(p.posicao!==undefined){if(!Number.isInteger(p.posicao)||p.posicao<0||p.posicao>100)throw fail('Use uma posição de 0 a 100.',422,'posicao');v.position=p.posicao;}
  if(p.status!==undefined){if(!COLECAO_STATUS[p.status])throw fail('Status: rascunho, publicado ou pausado.',422,'status');v.status=COLECAO_STATUS[p.status];}
  return v;
}
export async function criarColecao(db,{p,session,ip}) {
  rejectExtra(p,['titulo','subtitulo','grupos','posicao','status']);const v=validarColecao(p,{novo:true});let id=slugify(v.title);
  for(let n=2;(await db.query('SELECT 1 FROM collections WHERE id=$1',[id])).rows.length;n++)id=`${slugify(v.title)}-${n}`;
  const c=(await db.query("INSERT INTO collections(id,title,subtitle,groups,position,status,source) VALUES($1,$2,$3,$4::jsonb,$5,$6,'admin') RETURNING *",
    [id,v.title,v.subtitle||'',JSON.stringify(v.groups),v.position??50,v.status||'draft'])).rows[0];
  await audit(db,{actor:session.user_id,action:'colecao_criada',resource:id,after:colecaoVM(c),ip});
  return colecaoVM(c);
}
export async function editarColecao(db,{id,p,session,ip}) {
  rejectExtra(p,['titulo','subtitulo','grupos','posicao','status','version']);const version=needVersion(p),v=validarColecao(p,{novo:false});
  return db.transaction(async tx=>{
    const c=(await tx.query('SELECT * FROM collections WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!c)throw fail('Coleção não encontrada.',404);if(c.version!==version)throw conflito();
    const n=(await tx.query("UPDATE collections SET title=$2,subtitle=$3,groups=$4::jsonb,position=$5,status=$6,source='admin',version=version+1 WHERE id=$1 RETURNING *",
      [id,v.title??c.title,v.subtitle??c.subtitle,JSON.stringify(v.groups??c.groups),v.position??c.position,v.status??c.status])).rows[0];
    const mudou=diff(colecaoVM(c),colecaoVM(n));
    await audit(tx,{actor:session.user_id,action:'colecao_editada',resource:id,before:mudou.before,after:mudou.after,ip});
    return colecaoVM(n);
  });
}
