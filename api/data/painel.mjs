import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { safeURL, withoutTracking, oneLine, addressParts, byText } from '../lib/saneamento.mjs';
import { allCategoryLabels, normalizeCategory, categoryTree } from './categorias.mjs';
import { grupoVM, validarCategoriaNova, compararCategoria } from './categorias-novas.mjs';
import { weekLabels, localNow } from '../lib/horario.mjs';
import { fail } from '../lib/erros.mjs';
import { audit, diff } from '../lib/auditoria.mjs';
import { salvarFoto } from '../lib/imagens.mjs';
import { validEmail } from '../auth.mjs';
import { businessContext } from './empresas.mjs';

// Dados do painel do anunciante (contrato 12.4). As funções servem às APIs e às páginas /painel (o vm usa o mesmo JSON).
const rejectExtra=(p,keys)=>{const extra=Object.keys(p).find(k=>!keys.includes(k));if(extra)throw fail('Campo não permitido.',422,extra);};
const needVersion=p=>{if(!Number.isInteger(p.version)||p.version<1)throw fail('Informe a versão que você abriu.',422,'version');return p.version;};
const conflito=()=>fail('Esta informação mudou desde que você abriu. Recarregue.',409);
const texto=(v,campo,max,{obrigatorio=false,min=0}={})=>{
  if(v===undefined&&!obrigatorio)return undefined;
  if(typeof v!=='string')throw fail('Valor inválido.',422,campo);
  const t=v.trim();if(t.length>max)throw fail(`Use até ${max} caracteres.`,422,campo);
  if((obrigatorio||min)&&t.length<Math.max(1,min))throw fail(min>1?`Use pelo menos ${min} caracteres.`:'Preencha este campo.',422,campo);
  return t;
};
const br=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'';
const iso=d=>d?new Date(d).toISOString():null;
// Dia anterior/seguinte em aaaa-mm-dd (calendário, sem fuso).
const addDays=(day,n)=>new Date(Date.parse(`${day}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);

// Perfil ------------------------------------------------------------------------------------------------------------------
const HORA=/^([01]\d|2[0-3]):[0-5]\d$/;
export const REDES=['Instagram','Facebook','TikTok','YouTube','LinkedIn','X','Kwai','Pinterest'];
// Formas de pagamento aceitas (18.4), na ordem em que aparecem no perfil.
export const PAGAMENTOS=['pix','dinheiro','credito','debito','vale-refeicao','vale-alimentacao','boleto'];
const portalFotos=d=>(d.photos||[]).map((url,i)=>({id:`portal-${i}`,url,largura:null,altura:null,alt:'',status:'aprovada'}));
export const fotoVM=m=>{const s=(m.sizes||[]).find(x=>x.w===800)||{};return {id:m.id,url:`/midia/${m.id}/800.webp`,largura:s.largura??null,altura:s.altura??null,alt:m.alt,status:m.status,
  recusa:m.status==='recusada'&&m.recusa?{comentario:m.recusa.comentario||'',em:m.recusa.em?new Date(m.recusa.em).toISOString():''}:null};};
async function mediaFotos(db,id){return (await db.query(`SELECT m.*,(SELECT jsonb_build_object('comentario',a.comment,'em',a.decided_at) FROM approvals a WHERE a.resource_id=m.id AND a.kind='foto' AND a.status='recusado' ORDER BY a.decided_at DESC NULLS LAST LIMIT 1) AS recusa
  FROM media m WHERE m.business_id=$1 AND m.kind='foto' AND m.status<>'removida' ORDER BY m.position,m.created_at`,[id])).rows;}

// Listas para as caixas do perfil (14.5, pedido do front): a lista única de categorias, com todos os grupos, e os bairros do guia.
async function opcoesPerfil(db) {
  const empresas=(await db.query('SELECT district,details FROM businesses')).rows;
  return {categorias:categoryTree(empresas,{all:true}),bairros:[...new Set(empresas.map(b=>b.district).filter(Boolean))].sort(byText)};
}
export async function perfilEmpresa(db,id) {
  const b=(await db.query('SELECT * FROM businesses WHERE id=$1',[id])).rows[0],d=b.details||{};
  const horario=(await db.query('SELECT weekday,opens,closes FROM business_hours WHERE business_id=$1 ORDER BY weekday,opens',[id])).rows.map(r=>({dia:r.weekday,abre:r.opens,fecha:r.closes}));
  const desc=(await db.query("SELECT payload FROM approvals WHERE business_id=$1 AND kind='descricao' AND status='pendente'",[id])).rows[0]?.payload||null;
  const media=await mediaFotos(db,id);
  // Sugestão de categoria (22.4): a última pendente ou recusada; a aprovada e a retirada não aparecem.
  const s=(await db.query("SELECT payload,status,comment,submitted_at,decided_at FROM approvals WHERE business_id=$1 AND kind='categoria' ORDER BY submitted_at DESC,seq DESC LIMIT 1",[id])).rows[0];
  const sugestaoCategoria=s&&['pendente','recusado'].includes(s.status)?{nome:s.payload.nome,grupo:grupoVM(s.payload.grupo),status:s.status==='pendente'?'pendente':'recusada',
    comentario:s.comment||'',em:iso(s.status==='pendente'?s.submitted_at:s.decided_at)}:null;
  return {version:b.version,nome:b.name,rua:d.street||'',bairro:b.district||'',cidade:d.city||'',cep:d.cep||'',categorias:d.categories||[],imagem:d.image||'',
    referencia:d.referencia||'',pagamentos:d.pagamentos||[],horario,telefone:b.phone||'',whatsapp:d.whatsapp||'',email:d.email||'',site:d.website||'',
    redes:(d.socials||[]).map(s=>({rede:s.label,url:s.url})),resumo:desc?.resumo??b.summary??'',descricao:desc?.descricao??d.description??'',
    fotos:[...portalFotos(d),...media.map(fotoVM)],
    emAnalise:[...(desc?Object.keys(desc):[]),...(media.some(m=>m.status==='pendente')?['fotos']:[]),...(sugestaoCategoria?.status==='pendente'?['sugestaoCategoria']:[])],
    sugestaoCategoria,opcoes:await opcoesPerfil(db)};
}
// Validação dos campos da empresa, a mesma no painel e no admin (12.4, 13.4 e 14.5). novo: o admin está criando a empresa.
export function validarPerfil(p,{novo=false}={}) {
  const out={};
  const nome=texto(p.nome===null?'':p.nome,'nome',120,{obrigatorio:novo,min:2});if(nome!==undefined)out.nome=oneLine(nome);
  for(const [k,max] of [['rua',160],['bairro',80],['cidade',80]]){const t=texto(p[k]===null?'':p[k],k,max);if(t!==undefined)out[k]=oneLine(t);}
  if(p.cep!==undefined){const c=String(p.cep||'').replace(/\D/g,'');if(c&&c.length!==8)throw fail('Use o CEP com 8 números.',422,'cep');out.cep=c?`${c.slice(0,5)}-${c.slice(5)}`:'';}
  const ref=texto(p.referencia===null?'':p.referencia,'referencia',120);if(ref!==undefined)out.referencia=oneLine(ref);
  if(p.pagamentos!==undefined) {
    if(!Array.isArray(p.pagamentos)||p.pagamentos.some(v=>!PAGAMENTOS.includes(v)))throw fail('Escolha as formas de pagamento da lista.',422,'pagamentos');
    out.pagamentos=PAGAMENTOS.filter(v=>p.pagamentos.includes(v));
  }
  if(p.categorias!==undefined) {
    const validas=new Set(allCategoryLabels());
    if(!Array.isArray(p.categorias)||p.categorias.length>8)throw fail('Escolha até 8 categorias.',422,'categorias');
    out.categorias=[...new Set(p.categorias.map(c=>normalizeCategory(String(c))))];
    if(out.categorias.some(c=>!validas.has(c)))throw fail('Use as categorias da lista.',422,'categorias');
  }
  if(p.horario!==undefined) {
    if(!Array.isArray(p.horario)||p.horario.length>21)throw fail('Horário inválido.',422,'horario');
    const vistos=new Set();
    out.horario=p.horario.map(h=>{
      if(!h||!Number.isInteger(h.dia)||h.dia<0||h.dia>6||!HORA.test(h.abre)||!(HORA.test(h.fecha)||h.fecha==='24:00')||h.abre===h.fecha)throw fail('Confira os horários: use HH:MM, de domingo (0) a sábado (6).',422,'horario');
      const k=`${h.dia}-${h.abre}`;if(vistos.has(k))throw fail('Há dois horários iguais no mesmo dia.',422,'horario');vistos.add(k);
      return {dia:h.dia,abre:h.abre,fecha:h.fecha};
    }).sort((a,b)=>a.dia-b.dia||a.abre.localeCompare(b.abre));
  }
  const tel=texto(p.telefone,'telefone',40);
  if(tel!==undefined){const n=tel.replace(/\D/g,'');if(tel&&(n.length<10||n.length>11))throw fail('Informe o telefone com DDD.',422,'telefone');out.telefone=tel;}
  const zap=texto(p.whatsapp,'whatsapp',20);
  if(zap!==undefined){const n=zap.replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');if(zap&&!/^\d{2}9\d{8}$/.test(n))throw fail('Informe o WhatsApp com DDD (celular).',422,'whatsapp');out.whatsapp=zap?`55${n}`:'';}
  const mail=texto(p.email,'email',254);
  if(mail!==undefined){if(mail&&!validEmail(mail))throw fail('Informe um e-mail válido.',422,'email');out.email=mail.toLowerCase();}
  const site=texto(p.site,'site',500);
  if(site!==undefined){const esquema=/^[a-z][a-z0-9+.-]*:/i.test(site),u=site&&(!esquema||/^https?:/i.test(site))&&withoutTracking(safeURL(esquema?site:`https://${site}`));if(site&&!u)throw fail('Informe um endereço https válido.',422,'site');out.site=u||'';}
  if(p.redes!==undefined) {
    if(!Array.isArray(p.redes)||p.redes.length>8)throw fail('Redes inválidas.',422,'redes');
    out.redes=p.redes.map(r=>{const url=r&&typeof r.url==='string'&&withoutTracking(safeURL(r.url));if(!r||!REDES.includes(r.rede)||!url)throw fail('Confira as redes: escolha a rede e use um link https.',422,'redes');return {rede:r.rede,url};});
  }
  const resumo=texto(p.resumo,'resumo',300);if(resumo!==undefined)out.resumo=oneLine(resumo);
  const descricao=texto(p.descricao,'descricao',4000);if(descricao!==undefined)out.descricao=descricao;
  return out;
}
export const linhasHorario=rows=>weekLabels(rows.map(h=>({weekday:h.dia,opens:h.abre,closes:h.fecha}))).map(d=>`${d.day}: ${d.label}`).join('\n');

// details da empresa com os campos validados (painel e admin). Rua, CEP ou bairro novos: a rota passa a usar o endereço e a
// posição no mapa fica aproximada; com bairro novo, a posição sai até o Nexus conferir (14.5).
export function aplicarDetalhes(b,v) {
  const d={...(b.details||{})};
  if(v.whatsapp!==undefined)d.whatsapp=v.whatsapp;if(v.email!==undefined)d.email=v.email;if(v.site!==undefined)d.website=v.site;
  if(v.redes)d.socials=v.redes.map(r=>({label:r.rede,url:r.url}));if(v.descricao!==undefined)d.description=v.descricao;
  if(v.categorias)d.categories=v.categorias;if(v.imagem!==undefined)d.image=v.imagem;if(v.horario)d.hours=linhasHorario(v.horario);
  if(v.cidade!==undefined)d.city=v.cidade;
  if(v.referencia!==undefined)d.referencia=v.referencia;if(v.pagamentos)d.pagamentos=v.pagamentos;
  if(['rua','bairro','cidade','cep'].some(k=>v[k]!==undefined)) {
    const bairro=v.bairro??b.district??'',novoBairro=bairro!==(b.district||'');
    const a=addressParts({street:v.rua??d.street,district:bairro,city:v.cidade??d.city,cep:v.cep??d.cep});
    const mudou=novoBairro||(a.street||'')!==(d.street||'')||(a.cep||'')!==(d.cep||'');
    Object.assign(d,{address:a.address,street:a.street,cep:a.cep});
    if(mudou&&d.geo){if(novoBairro)delete d.geo;else d.geo={...d.geo,precisao:'bairro'};}
  }
  return d;
}
// Foto principal escolhida no painel: uma foto aprovada da empresa, uma do portal ou nenhuma.
async function imagemDaEmpresa(db,id,b,valor) {
  if(valor===''||valor===null)return '';
  if(typeof valor!=='string')throw fail('Valor inválido.',422,'imagem');
  const v=valor.trim(),d=b.details||{};
  if(v===d.image||(d.photos||[]).includes(v))return v;
  const m=/^\/midia\/([a-f0-9]{32})\/(320|800|1600)\.webp$/.exec(v);
  if(m&&(await db.query("SELECT 1 FROM media WHERE id=$1 AND business_id=$2 AND kind='foto' AND status='aprovada'",[m[1],id])).rows.length)return `/midia/${m[1]}/800.webp`;
  throw fail('Escolha uma das fotos aprovadas da empresa.',422,'imagem');
}

// Nome, endereço, categorias, foto principal, horário, contatos e redes publicam na hora (14.5); resumo e descrição vão para a
// fila de aprovação da equipe.
const IMEDIATOS=['nome','rua','bairro','cidade','cep','referencia','pagamentos','categorias','imagem','horario','telefone','whatsapp','email','site','redes'];
export async function atualizarPerfil(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,[...IMEDIATOS,'resumo','descricao','sugestaoCategoria','version']);
  const version=needVersion(p),v=validarPerfil(p);
  // "Outra" (22.4): a sugestão de categoria vai para a fila; null retira a pendente.
  const sugestao=p.sugestaoCategoria===undefined||p.sugestaoCategoria===null?p.sugestaoCategoria:validarCategoriaNova(p.sugestaoCategoria,'sugestaoCategoria');
  return db.transaction(async tx=>{
    const b=(await tx.query('SELECT * FROM businesses WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(b.version!==version)throw conflito();
    if(p.imagem!==undefined)v.imagem=await imagemDaEmpresa(tx,id,b,p.imagem);
    if(v.categorias&&!v.categorias.length&&b.status==='published')throw fail('A empresa publicada precisa de ao menos uma categoria.',422,'categorias');
    const atual=await perfilEmpresa(tx,id);
    const imediato=Object.fromEntries(IMEDIATOS.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
    const mudou=diff(atual,imediato);
    if(mudou.keys.length) {
      if(imediato.horario) {
        await tx.query('DELETE FROM business_hours WHERE business_id=$1',[id]);
        for(const h of imediato.horario)await tx.query('INSERT INTO business_hours(business_id,weekday,opens,closes) VALUES($1,$2,$3,$4)',[id,h.dia,h.abre,h.fecha]);
      }
      const d=aplicarDetalhes(b,imediato);
      await tx.query('UPDATE businesses SET name=$2,district=$3,phone=$4,details=$5::jsonb,managed_at=COALESCE(managed_at,$6),updated_at=$6 WHERE id=$1',
        [id,imediato.nome??b.name,imediato.bairro??b.district,imediato.telefone??b.phone,JSON.stringify(d),now.toISOString()]);
      await audit(tx,{actor:session.user_id,business:id,action:'perfil_atualizado',resource:id,before:mudou.before,after:mudou.after,ip});
    }
    // Resumo e descrição: o pedido novo substitui o pendente; igual ao que está no ar, não entra na fila.
    const publico={resumo:b.summary||'',descricao:b.details?.description||''};
    const fila=Object.fromEntries(['resumo','descricao'].filter(k=>v[k]!==undefined&&v[k]!==atual[k]).map(k=>[k,v[k]]));
    let emAnalise=[];
    if(Object.keys(fila).length) {
      const pendente=(await tx.query("UPDATE approvals SET status='substituido' WHERE business_id=$1 AND kind='descricao' AND status='pendente' RETURNING payload",[id])).rows[0]?.payload||{};
      const payload=Object.fromEntries(Object.entries({...pendente,...fila}).filter(([k,val])=>val!==publico[k]));
      if(Object.keys(payload).length) {
        await tx.query("INSERT INTO approvals(id,business_id,kind,resource_id,payload,submitted_by,submitted_at) VALUES($1,$2,'descricao',$2,$3::jsonb,$4,$5)",[randomUUID(),id,JSON.stringify(payload),session.user_id,now.toISOString()]);
        await audit(tx,{actor:session.user_id,business:id,action:'descricao_enviada',resource:id,before:{resumo:publico.resumo,descricao:publico.descricao},after:payload,ip});
        emAnalise=Object.keys(payload);
      }
    }
    // A sugestão nova substitui a pendente; igual a uma da lista, a pessoa escolhe a da lista. Ela não entra nas categorias.
    if(sugestao!==undefined) {
      if(sugestao){const c=await compararCategoria(tx,sugestao.nome);if(c.igual)throw fail(`Essa categoria já existe: escolha "${c.igual.nome}" na lista.`,422,'sugestaoCategoria',{igual:c.igual});}
      await tx.query("UPDATE approvals SET status='substituido' WHERE business_id=$1 AND kind='categoria' AND status='pendente'",[id]);
      if(sugestao) {
        await tx.query("INSERT INTO approvals(id,business_id,kind,resource_id,payload,submitted_by,submitted_at) VALUES($1,$2,'categoria',$2,$3::jsonb,$4,$5)",[randomUUID(),id,JSON.stringify(sugestao),session.user_id,now.toISOString()]);
        await audit(tx,{actor:session.user_id,business:id,action:'categoria_sugerida',resource:id,after:sugestao,ip});
        emAnalise=[...emAnalise,'sugestaoCategoria'];
      }
    }
    const nova=(await tx.query('UPDATE businesses SET version=version+1 WHERE id=$1 RETURNING version',[id])).rows[0].version;
    return {version:nova,publicado:mudou.keys,emAnalise};
  });
}

// Fotos: entram pendentes (a equipe aprova na Fase 4); a foto do portal pode ser tirada do perfil na hora.
export async function enviarFoto(db,{id,buf,declarado,alt='',session,ip,dir,now=new Date()}) {
  const legenda=texto(alt,'alt',200)||'';
  if((await mediaFotos(db,id)).length>=12)throw fail('O limite é de 12 fotos enviadas. Tire uma antes de mandar outra.',422,'arquivo');
  const mid=randomUUID().replace(/-/g,''),f=await salvarFoto(buf,{dir,id:mid,declarado});
  try {
    await db.transaction(async tx=>{
      await tx.query("INSERT INTO media(id,business_id,kind,mime,width,height,bytes,sha256,sizes,alt,status,position,created_by,created_at) VALUES($1,$2,'foto',$3,$4,$5,$6,$7,$8::jsonb,$9,'pendente',(SELECT COALESCE(max(position),0)+1 FROM media WHERE business_id=$2),$10,$11)",
        [mid,id,f.mime,f.width,f.height,f.bytes,f.sha256,JSON.stringify(f.sizes),legenda,session.user_id,now.toISOString()]);
      await tx.query("INSERT INTO approvals(id,business_id,kind,resource_id,payload,submitted_by,submitted_at) VALUES($1,$2,'foto',$3,$4::jsonb,$5,$6)",[randomUUID(),id,mid,JSON.stringify({alt:legenda}),session.user_id,now.toISOString()]);
      await audit(tx,{actor:session.user_id,business:id,action:'foto_enviada',resource:mid,after:{alt:legenda,largura:f.width,altura:f.height},ip});
    });
  } catch(e){await rm(join(dir,mid),{recursive:true,force:true});throw e;}
  return fotoVM((await db.query('SELECT * FROM media WHERE id=$1',[mid])).rows[0]);
}
export async function removerFoto(db,{id,foto,session,ip,dir,now=new Date()}) {
  const portal=/^portal-(\d+)$/.exec(foto);
  if(portal) return db.transaction(async tx=>{
    const b=(await tx.query('SELECT details FROM businesses WHERE id=$1 FOR UPDATE',[id])).rows[0],photos=[...(b.details.photos||[])],i=Number(portal[1]);
    if(!photos[i])throw fail('Foto não encontrada.',404);
    const [url]=photos.splice(i,1);
    // A foto tirada deixa de ser a principal (14.5).
    const d={...b.details,photos};if(d.image===url)d.image='';
    await tx.query("UPDATE businesses SET details=$2::jsonb,managed_at=COALESCE(managed_at,$3),updated_at=$3,version=version+1 WHERE id=$1",[id,JSON.stringify(d),now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:id,action:'foto_removida',resource:foto,before:{url},ip});
    return {ok:true};
  });
  const m=(await db.query("SELECT id,status,alt FROM media WHERE id=$1 AND business_id=$2 AND status<>'removida'",[foto,id])).rows[0];
  if(!m)throw fail('Foto não encontrada.',404);
  await db.transaction(async tx=>{
    await tx.query("UPDATE media SET status='removida' WHERE id=$1",[foto]);
    await tx.query("UPDATE approvals SET status='substituido' WHERE resource_id=$1 AND kind='foto' AND status='pendente'",[foto]);
    await tx.query("UPDATE businesses SET details=jsonb_set(details,'{image}','\"\"'),updated_at=$3,version=version+1 WHERE id=$1 AND details->>'image' LIKE $2",[id,`/midia/${foto}/%`,now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:id,action:'foto_removida',resource:foto,before:{status:m.status,alt:m.alt},ip});
  });
  try{await rm(join(dir,foto),{recursive:true,force:true,maxRetries:3});}catch{}
  return {ok:true};
}

// Catálogo e ofertas --------------------------------------------------------------------------------------------------------
const TIPOS={produto:'product',servico:'service',oferta:'offer'},PRECOS={fixo:'fixed','a-partir':'from',consulta:'inquiry'},STATUS={draft:'rascunho',review:'validacao',published:'publicado',paused:'pausado'};
const inv=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[v,k]));
export const itemVM=r=>({id:r.id,tipo:inv(TIPOS)[r.kind],nome:r.name,descricao:r.description,precoModo:inv(PRECOS)[r.price_mode],precoCentavos:r.price_cents,
  condicoes:r.conditions||'',validade:r.valid_until?String(r.valid_until instanceof Date?r.valid_until.toISOString():r.valid_until).slice(0,10):'',status:STATUS[r.status],version:r.version,
  recusa:r.rejection?{comentario:r.rejection.comentario||'',em:r.rejection.em||''}:null});
export async function catalogoEmpresa(db,id){return {itens:(await db.query('SELECT * FROM catalog_items WHERE business_id=$1 ORDER BY updated_at DESC',[id])).rows.map(itemVM)};}
// rascunho: sem tipo vale produto e sem precoModo vale consulta; oferta em rascunho pode ficar sem condições e validade.
export function validarItem(p,{now,rascunho=false,atual={}}) {
  const tipo=p.tipo??atual.tipo??(rascunho?'produto':undefined),precoModo=p.precoModo??atual.precoModo??(rascunho?'consulta':undefined);
  if(!TIPOS[tipo])throw fail('Escolha produto, serviço ou oferta.',422,'tipo');
  if(!PRECOS[precoModo])throw fail('Escolha como o preço aparece.',422,'precoModo');
  const nome=texto(p.nome??atual.nome,'nome',120,{obrigatorio:true,min:2}),descricao=texto(p.descricao??atual.descricao??'','descricao',2000);
  const preco=p.precoCentavos!==undefined?p.precoCentavos:atual.precoCentavos;
  if(precoModo!=='consulta'&&(!Number.isSafeInteger(preco)||preco<0||preco>100000000))throw fail('Informe o preço, como 18,90.',422,'precoCentavos');
  const condicoes=texto(p.condicoes??atual.condicoes??'','condicoes',600),validade=p.validade??atual.validade??'';
  if(tipo==='oferta'&&!rascunho) {
    if(!condicoes)throw fail('Toda oferta precisa das condições (o que vale, para quem, até quando).',422,'condicoes');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(validade)||Number.isNaN(Date.parse(validade))||validade<localNow(now).date)throw fail('Informe a validade da oferta, de hoje em diante.',422,'validade');
  } else if(validade&&(!/^\d{4}-\d{2}-\d{2}$/.test(validade)||Number.isNaN(Date.parse(validade))))throw fail('Data inválida.',422,'validade');
  return {kind:TIPOS[tipo],name:nome,description:descricao,price_mode:PRECOS[precoModo],price_cents:precoModo==='consulta'?null:preco,conditions:condicoes,valid_until:validade||null};
}
async function paraFila(tx,item,{session,now}) {
  await tx.query("UPDATE approvals SET status='substituido' WHERE resource_id=$1 AND kind IN ('catalogo','oferta') AND status='pendente'",[item.id]);
  await tx.query('INSERT INTO approvals(id,business_id,kind,resource_id,payload,submitted_by,submitted_at,version) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)',
    [randomUUID(),item.business_id,item.kind==='offer'?'oferta':'catalogo',item.id,JSON.stringify(itemVM(item)),session.user_id,now.toISOString(),item.version]);
}
export async function criarItem(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['tipo','nome','descricao','precoModo','precoCentavos','condicoes','validade','enviar']);
  const enviar=p.enviar!==false,v=validarItem(p,{now,rascunho:!enviar}),itemId=randomUUID();
  return db.transaction(async tx=>{
    const item=(await tx.query(`INSERT INTO catalog_items(id,business_id,kind,name,description,price_cents,price_mode,conditions,valid_until,status,created_by,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,[itemId,id,v.kind,v.name,v.description,v.price_cents,v.price_mode,v.conditions,v.valid_until,enviar?'review':'draft',session.user_id,now.toISOString()])).rows[0];
    if(enviar)await paraFila(tx,item,{session,now});
    await audit(tx,{actor:session.user_id,business:id,action:enviar?'item_enviado':'item_criado',resource:itemId,after:itemVM(item),ip});
    return itemVM(item);
  });
}
async function itemPara(tx,id,itemId,version) {
  const r=(await tx.query('SELECT * FROM catalog_items WHERE id=$1 AND business_id=$2 FOR UPDATE',[itemId,id])).rows[0];
  if(!r)throw fail('Item não encontrado.',404);if(r.version!==version)throw conflito();return r;
}
// Item publicado ou pausado que muda volta para a validação; rascunho e validação continuam onde estão.
export async function editarItem(db,{id,itemId,p,session,ip,now=new Date()}) {
  rejectExtra(p,['tipo','nome','descricao','precoModo','precoCentavos','condicoes','validade','version']);
  const version=needVersion(p);
  return db.transaction(async tx=>{
    const r=await itemPara(tx,id,itemId,version),antes=itemVM(r),v=validarItem(p,{now,atual:antes,rascunho:r.status==='draft'});
    const status=['published','paused'].includes(r.status)?'review':r.status;
    const item=(await tx.query(`UPDATE catalog_items SET kind=$2,name=$3,description=$4,price_cents=$5,price_mode=$6,conditions=$7,valid_until=$8,status=$9,version=version+1,updated_at=$10,rejection=NULL
      WHERE id=$1 RETURNING *`,[itemId,v.kind,v.name,v.description,v.price_cents,v.price_mode,v.conditions,v.valid_until,status,now.toISOString()])).rows[0];
    if(status==='review')await paraFila(tx,item,{session,now});
    const mudou=diff(antes,itemVM(item));
    await audit(tx,{actor:session.user_id,business:id,action:'item_editado',resource:itemId,before:mudou.before,after:mudou.after,ip});
    return itemVM(item);
  });
}
export async function transicaoItem(db,{id,itemId,acao,p,session,ip,now=new Date()}) {
  rejectExtra(p,['version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const r=await itemPara(tx,id,itemId,version);
    const regra={enviar:{de:['draft'],para:'review'},pausar:{de:['published'],para:'paused'},reativar:{de:['paused'],para:r.approved_version===r.version?'published':'review'}}[acao];
    if(!regra.de.includes(r.status))throw fail(`Este item está em ${STATUS[r.status]} e não pode ${acao==='enviar'?'ser enviado':acao==='pausar'?'ser pausado':'ser reativado'}.`,422,'status');
    // Enviar para a aprovação confere o item inteiro, com as regras do item novo.
    if(acao==='enviar')validarItem({},{now,atual:itemVM(r)});
    // Pausar e reativar sem mudança mantêm a versão aprovada (reativar não volta para a fila).
    const bump=regra.para==='review';
    const item=(await tx.query(`UPDATE catalog_items SET status=$2,version=version+1,approved_version=CASE WHEN $3 THEN approved_version ELSE CASE WHEN approved_version=version THEN version+1 ELSE approved_version END END,updated_at=$4,rejection=NULL WHERE id=$1 RETURNING *`,
      [itemId,regra.para,bump,now.toISOString()])).rows[0];
    if(regra.para==='review')await paraFila(tx,item,{session,now});
    await audit(tx,{actor:session.user_id,business:id,action:`item_${acao}`,resource:itemId,before:{status:STATUS[r.status]},after:{status:STATUS[item.status]},ip});
    return itemVM(item);
  });
}

// Só rascunho pode ser apagado (o resto tem histórico na fila ou no ar).
export async function removerItem(db,{id,itemId,session,ip}) {
  return db.transaction(async tx=>{
    const r=(await tx.query('SELECT * FROM catalog_items WHERE id=$1 AND business_id=$2 FOR UPDATE',[itemId,id])).rows[0];
    if(!r)throw fail('Item não encontrado.',404);
    if(r.status!=='draft')throw fail('Só um rascunho pode ser apagado. Pause o item, se quiser tirá-lo do ar.',422,'status');
    await tx.query('DELETE FROM catalog_items WHERE id=$1',[itemId]);
    await audit(tx,{actor:session.user_id,business:id,action:'item_apagado',resource:itemId,before:itemVM(r),ip});
    return {ok:true};
  });
}

// Métricas (contrato 12.4) ------------------------------------------------------------------------------------------------
export const PERIODOS={'7d':7,'30d':30,'90d':90};
async function totais(db,id,de,ate) {
  const ev=(await db.query("SELECT count(*) FILTER (WHERE name='business_viewed')::int AS v,count(*) FILTER (WHERE name='contact_clicked')::int AS c FROM public_events WHERE business_id=$1 AND occurred_at>=$2 AND occurred_at<$3",
    [id,`${de}T00:00:00-03:00`,`${addDays(ate,1)}T00:00:00-03:00`])).rows[0];
  const buscas=(await db.query('SELECT COALESCE(sum(search_impressions),0)::int AS n FROM business_daily WHERE business_id=$1 AND day BETWEEN $2 AND $3',[id,de,ate])).rows[0].n;
  return {visitas:ev.v,cliques:ev.c,buscas,cupons:await coletas(db,id,de,ate)};
}
// Coletas dos cupons da empresa entre dois dias (fuso de São Paulo), inclusive (14.6).
const coletas=async(db,id,de,ate)=>(await db.query('SELECT count(*)::int AS n FROM coupon_claims k JOIN coupons c ON c.id=k.coupon_id WHERE c.business_id=$1 AND k.claimed_at>=$2 AND k.claimed_at<$3',
  [id,`${de}T00:00:00-03:00`,`${addDays(ate,1)}T00:00:00-03:00`])).rows[0].n;
export async function metricasEmpresa(db,id,periodo,now=new Date()) {
  const dias=PERIODOS[periodo];if(!dias)throw fail('Escolha 7d, 30d ou 90d.',422,'periodo');
  const ate=localNow(now).date,de=addDays(ate,-(dias-1)),desde=`${de}T00:00:00-03:00`;
  const eventos=(await db.query(`SELECT ((occurred_at AT TIME ZONE 'America/Sao_Paulo')::date)::text AS dia,name,channel,count(*)::int AS n FROM public_events
    WHERE business_id=$1 AND occurred_at>=$2 AND occurred_at<$3 AND name IN ('business_viewed','contact_clicked') GROUP BY 1,2,3`,[id,desde,`${addDays(ate,1)}T00:00:00-03:00`])).rows;
  const buscas=(await db.query('SELECT day::text AS dia,search_impressions AS n FROM business_daily WHERE business_id=$1 AND day BETWEEN $2 AND $3',[id,de,ate])).rows;
  const banners=(await db.query(`SELECT c.id,c.title,c.placement,COALESCE(sum(a.impressions),0)::int AS impressoes,COALESCE(sum(a.clicks),0)::int AS cliques FROM campaigns c
    LEFT JOIN ad_daily a ON a.campaign_id=c.id AND a.day BETWEEN $2 AND $3 WHERE c.business_id=$1 AND c.status<>'house' GROUP BY c.id,c.title,c.placement ORDER BY c.id`,[id,de,ate])).rows;
  const canal={whatsapp:'whatsapp',phone:'telefone',map:'rota',website:'site'},cliques={whatsapp:0,telefone:0,rota:0,site:0},serie=new Map();
  for(let d=de;d<=ate;d=addDays(d,1))serie.set(d,{dia:d,visitas:0,cliques:0,buscas:0});
  for(const e of eventos){const s=serie.get(e.dia);if(!s)continue;if(e.name==='business_viewed')s.visitas+=e.n;else{s.cliques+=e.n;if(canal[e.channel])cliques[canal[e.channel]]+=e.n;}}
  for(const b of buscas){const s=serie.get(b.dia);if(s)s.buscas+=b.n;}
  const pontos=[...serie.values()];
  // Período anterior do mesmo tamanho; em 90d ele cairia fora dos 90 dias guardados dos eventos, então não vem.
  const anterior=dias<90?await totais(db,id,addDays(de,-dias),addDays(de,-1)):null;
  return {periodo,de,ate,visitas:pontos.reduce((t,s)=>t+s.visitas,0),cliques,buscas:pontos.reduce((t,s)=>t+s.buscas,0),cupons:await coletas(db,id,de,ate),anterior,
    banners:banners.map(b=>({id:b.id,titulo:b.title,espaco:b.placement,impressoes:b.impressoes,cliques:b.cliques})),serie:pontos,
    nota:'Visitas e cliques contam só os visitantes que aceitaram a medição. As aparições na busca são contadas pelo servidor, sem dado pessoal.'};
}
// Aparições na busca: uma por empresa em cada página de resultado servida (robôs não contam).
export async function contarBusca(db,slugs,now=new Date()) {
  if(!slugs.length)return;
  await db.query(`INSERT INTO business_daily(day,business_id,search_impressions) SELECT $1::date,id,1 FROM businesses WHERE slug=ANY($2)
    ON CONFLICT(day,business_id) DO UPDATE SET search_impressions=business_daily.search_impressions+1`,[localNow(now).date,slugs]);
}

// Relatório do mês (contrato 20) -------------------------------------------------------------------------------------------
// Um mês fechado comparado com o mês antes dele, das somas diárias (sem dado pessoal). Cada série tem o dia em que começou a
// ser medida (metric_starts): o mês que acaba antes dele vem null, e o mês em que ela começou depois do dia 1º é parcial.
const NOMES_MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MES=/^\d{4}-(0[1-9]|1[0-2])$/,SERIES=['contatos','aparicoes','banners'];
export const rotuloMes=mes=>`${NOMES_MES[+mes.slice(5,7)-1]} de ${mes.slice(0,4)}`;
const mesAntes=mes=>addDays(`${mes}-01`,-1).slice(0,7);
const fimDoMes=mes=>addDays(`${addDays(`${mes}-28`,7).slice(0,7)}-01`,-1);
// O mês anterior ao atual (São Paulo): o último mês fechado e o padrão do relatório.
export const mesAnterior=(now=new Date())=>mesAntes(localNow(now).date.slice(0,7));
// Os meses aceitos vão do último fechado até o mês da primeira série medida; o último fechado é sempre aceito.
async function mesesAceitos(db,now) {
  const desde=Object.fromEntries((await db.query('SELECT serie,since::text AS d FROM metric_starts WHERE serie=ANY($1)',[SERIES])).rows.map(r=>[r.serie,r.d]));
  const ultimo=mesAnterior(now),inicio=Object.values(desde).sort()[0]?.slice(0,7);
  return {desde,ultimo,primeiro:inicio&&inicio<ultimo?inicio:ultimo};
}
const SOMA_MES=`to_char(day,'YYYY-MM') AS mes,COALESCE(sum(views),0)::int AS v,COALESCE(sum(contact_whatsapp),0)::int AS w,COALESCE(sum(contact_phone),0)::int AS t,
  COALESCE(sum(contact_map),0)::int AS r,COALESCE(sum(contact_website),0)::int AS s,COALESCE(sum(search_impressions),0)::int AS a`;
export async function relatorioEmpresa(db,id,mesPedido,now=new Date()) {
  const {desde,ultimo,primeiro}=await mesesAceitos(db,now),mes=mesPedido||ultimo;
  if(!MES.test(mes)||mes>ultimo||mes<primeiro)throw fail('Escolha um mês fechado, desde o primeiro mês medido no guia.',422,'mes');
  const ant=mesAntes(mes),de=`${ant}-01`,ate=fimDoMes(mes);
  const dias=(await db.query(`SELECT ${SOMA_MES} FROM business_daily WHERE business_id=$1 AND day BETWEEN $2 AND $3 GROUP BY 1`,[id,de,ate])).rows;
  const ads=(await db.query(`SELECT c.id,c.title,to_char(a.day,'YYYY-MM') AS mes,sum(a.impressions)::int AS i,sum(a.clicks)::int AS k FROM ad_daily a
    JOIN campaigns c ON c.id=a.campaign_id WHERE c.business_id=$1 AND c.status<>'house' AND a.day BETWEEN $2 AND $3 GROUP BY 1,2,3`,[id,de,ate])).rows;
  const medido=(serie,m)=>Boolean(desde[serie])&&fimDoMes(m)>=desde[serie];
  const parcial=(serie,m)=>Boolean(desde[serie])&&desde[serie].slice(0,7)===m&&desde[serie].slice(8)!=='01';
  // Comparação de um número: null sem medição; a diferença só com os dois meses medidos e inteiros.
  const comparar=(serie,valor)=>{
    const atual=medido(serie,mes)?valor(mes):null,anterior=medido(serie,ant)?valor(ant):null;
    return {atual,anterior,diferenca:atual!==null&&anterior!==null&&!parcial(serie,mes)&&!parcial(serie,ant)?atual-anterior:null};
  };
  const soma=col=>m=>dias.find(r=>r.mes===m)?.[col]??0;
  const canais={whatsapp:'w',telefone:'t',rota:'r',site:'s'},contatos=Object.fromEntries(Object.entries(canais).map(([k,col])=>[k,comparar('contatos',soma(col))]));
  contatos.total=comparar('contatos',m=>['w','t','r','s'].reduce((t,col)=>t+soma(col)(m),0));
  const campanhas=[...new Map(ads.map(a=>[a.id,a.title])).entries()].map(([cid,titulo])=>{
    const total=(m,col)=>ads.filter(a=>a.id===cid&&a.mes===m).reduce((t,a)=>t+a[col],0);
    return {id:cid,titulo,impressoes:comparar('banners',m=>total(m,'i')),cliques:comparar('banners',m=>total(m,'k'))};
  }).filter(b=>[b.impressoes,b.cliques].some(x=>(x.atual||0)+(x.anterior||0)>0))
    .sort((a,b)=>(b.cliques.atual??-1)-(a.cliques.atual??-1)||(b.impressoes.atual??-1)-(a.impressoes.atual??-1)||byText(a.titulo,b.titulo));
  const url=m=>`/painel/${id}/relatorio/${m}`,disponiveis=[];
  for(let m=ultimo;m>=primeiro&&disponiveis.length<12;m=mesAntes(m))disponiveis.push({mes:m,rotulo:rotuloMes(m),url:url(m)});
  return {mes,rotulo:rotuloMes(mes),anterior:{mes:ant,rotulo:rotuloMes(ant)},url:url(mes),disponiveis,
    series:Object.fromEntries(SERIES.map(s=>[s,{medidoDesde:desde[s]||null,parcial:{atual:parcial(s,mes),anterior:parcial(s,ant)}}])),
    visitas:comparar('contatos',soma('v')),contatos,aparicoes:comparar('aparicoes',soma('a')),banners:campanhas,
    nota:'Visitas e contatos contam só os visitantes que aceitaram a medição. As aparições na busca são contadas pelo servidor, sem dado pessoal. Mês sem medição aparece em branco, e o mês em que a medição começou no meio aparece como parcial.'};
}

// Solicitações e suporte ---------------------------------------------------------------------------------------------------
const TIPOS_SOL=['suporte','criacao','alteracao'];
const solVM=(r,mensagens)=>({id:r.id,tipo:r.kind,assunto:r.subject,status:r.status,criada:iso(r.created_at),atualizada:iso(r.updated_at),briefing:r.briefing||null,...(mensagens?{mensagens}:{})});
export async function solicitacoesEmpresa(db,id){return {solicitacoes:(await db.query('SELECT * FROM requests WHERE business_id=$1 ORDER BY updated_at DESC',[id])).rows.map(r=>solVM(r))};}
export async function solicitacaoEmpresa(db,id,sol) {
  const r=(await db.query('SELECT * FROM requests WHERE id=$1 AND business_id=$2',[sol,id])).rows[0];if(!r)throw fail('Solicitação não encontrada.',404);
  const msgs=(await db.query('SELECT m.*,u.name,u.email FROM request_messages m LEFT JOIN users u ON u.id=m.author_id WHERE m.request_id=$1 ORDER BY m.created_at,m.seq',[sol])).rows;
  return solVM(r,msgs.map(m=>({id:m.id,autor:{nome:m.side==='equipe'?'Equipe Nexus':(m.name||m.email||''),lado:m.side},texto:m.body,em:iso(m.created_at)})));
}
export async function abrirSolicitacao(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['tipo','assunto','texto','briefing']);
  if(!TIPOS_SOL.includes(p.tipo))throw fail('Escolha o tipo da solicitação.',422,'tipo');
  const assunto=texto(p.assunto,'assunto',120,{obrigatorio:true,min:3}),corpo=texto(p.texto,'texto',4000,{obrigatorio:true,min:2});
  let briefing=null;
  if(p.tipo==='criacao') {
    const b=p.briefing||{};if(typeof b!=='object'||Array.isArray(b))throw fail('Briefing inválido.',422,'briefing');
    rejectExtra(b,['objetivo','formato','prazo','referencias']);
    briefing={objetivo:texto(b.objetivo??'','objetivo',600,{obrigatorio:true,min:3}),formato:texto(b.formato??'','formato',120)||'',prazo:texto(b.prazo??'','prazo',60)||'',referencias:texto(b.referencias??'','referencias',1000)||''};
  } else if(p.briefing!==undefined)throw fail('Briefing só na solicitação de criação.',422,'briefing');
  const sol=randomUUID();
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO requests(id,business_id,kind,subject,briefing,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$7)',[sol,id,p.tipo,assunto,briefing&&JSON.stringify(briefing),session.user_id,now.toISOString()]);
    await tx.query("INSERT INTO request_messages(id,request_id,author_id,side,body,created_at) VALUES($1,$2,$3,'associado',$4,$5)",[randomUUID(),sol,session.user_id,corpo,now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:id,action:'solicitacao_aberta',resource:sol,after:{tipo:p.tipo,assunto},ip});
  });
  return solicitacaoEmpresa(db,id,sol);
}
// Mensagem do associado reabre a conversa (status "aberta"); a resposta da equipe (Fase 4) deixa "respondida".
export async function responderSolicitacao(db,{id,sol,p,session,ip,lado='associado',now=new Date()}) {
  rejectExtra(p,['texto']);const corpo=texto(p.texto,'texto',4000,{obrigatorio:true,min:2});
  const r=(await db.query('SELECT id FROM requests WHERE id=$1 AND business_id=$2',[sol,id])).rows[0];if(!r)throw fail('Solicitação não encontrada.',404);
  const mid=randomUUID();
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO request_messages(id,request_id,author_id,side,body,created_at) VALUES($1,$2,$3,$4,$5,$6)',[mid,sol,session.user_id,lado,corpo,now.toISOString()]);
    await tx.query('UPDATE requests SET status=$2,updated_at=$3 WHERE id=$1',[sol,lado==='equipe'?'respondida':'aberta',now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:id,action:'solicitacao_mensagem',resource:sol,after:{lado},ip});
  });
  return (await solicitacaoEmpresa(db,id,sol)).mensagens.find(m=>m.id===mid);
}
export async function fecharSolicitacao(db,{id,sol,session,ip,now=new Date()}) {
  const r=(await db.query("UPDATE requests SET status='fechada',updated_at=$3 WHERE id=$1 AND business_id=$2 RETURNING status",[sol,id,now.toISOString()])).rows[0];
  if(!r)throw fail('Solicitação não encontrada.',404);
  await audit(db,{actor:session.user_id,business:id,action:'solicitacao_fechada',resource:sol,ip});
  return solicitacaoEmpresa(db,id,sol);
}

// Acessos (só dono e admin) -------------------------------------------------------------------------------------------------
export async function acessosEmpresa(db,id,now=new Date()) {
  const membros=(await db.query('SELECT m.role,m.active,m.created_at,u.id,u.email,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.business_id=$1 ORDER BY m.active DESC,u.email',[id])).rows;
  const convites=(await db.query("SELECT u.email,t.role,t.expires_at FROM access_tokens t JOIN users u ON u.id=t.user_id WHERE t.business_id=$1 AND t.kind='convite' AND t.used_at IS NULL AND t.expires_at>$2 ORDER BY t.created_at DESC",[id,now.toISOString()])).rows;
  return {membros:membros.map(m=>({usuario:{id:m.id,email:m.email,nome:m.name},papel:m.role,ativo:m.active,desde:iso(m.created_at)})),
    convites:convites.map(c=>({email:c.email,papel:c.role,expira:iso(c.expires_at)}))};
}

// Resumo: as 4 perguntas do PDF1 -----------------------------------------------------------------------------------------
// Âncoras das pendências (contrato 12.6): o painel tem os ids.
const ANCORAS={foto:b=>`${b}/perfil#fotos`,horario:b=>`${b}/perfil#horario`,whatsapp:b=>`${b}/perfil#campo-whatsapp`,descricao:b=>`${b}/perfil#campo-descricao`,
  redes:b=>`${b}/perfil#redes`,endereco:b=>`${b}/perfil#campo-rua`};
const STATUS_EMPRESA={published:'publicado',paused:'pausado',draft:'rascunho',review:'em análise'};
// "Minha assinatura" (19.6): o que a gestão mandou, com a situação calculada no dia de São Paulo a cada leitura.
export function assinaturaGestao(b,now=new Date()) {
  const a=b.gestao_assinatura;if(!a)return null;
  const dias=Math.round((Date.parse(`${a.venceEm}T12:00:00Z`)-Date.parse(`${localNow(now).date}T12:00:00Z`))/86400000);
  const situacao=a.status==='suspensa'?'suspensa':dias>30?'em-dia':dias>=0?'a-vencer':'vencida';
  return {plano:a.plano,valorCentavos:a.valorCentavos,ciclo:a.ciclo,venceEm:a.venceEm,dias,situacao,ultimosPagamentos:a.ultimosPagamentos,comoPagar:a.comoPagar,
    atualizadaEm:b.gestao_assinatura_em?new Date(b.gestao_assinatura_em).toISOString():null};
}
export async function resumoEmpresa(db,acesso,now=new Date()) {
  const id=acesso.empresa.id,b=(await db.query('SELECT b.*,p.name AS plan_name FROM businesses b LEFT JOIN plans p ON p.id=b.plan_id AND p.status=$2 WHERE b.id=$1',[id,'active'])).rows[0],d=b.details||{};
  const perfil=await perfilEmpresa(db,id),m30=await metricasEmpresa(db,id,'30d',now);
  // Prévia "como o morador vê": o card da busca, só com a empresa publicada.
  const ctx=await businessContext(db,now),publicada=ctx.companies.find(x=>x.id===id),card=publicada?ctx.card(publicada):null;
  const completo=[{item:'foto',ok:Boolean(d.image||perfil.fotos.some(f=>f.status==='aprovada'))},{item:'horario',ok:perfil.horario.length>0},{item:'whatsapp',ok:Boolean(d.whatsapp)},
    {item:'descricao',ok:Boolean(d.description||b.summary)},{item:'endereco',ok:Boolean(d.street||d.address)},{item:'redes',ok:(d.socials||[]).length>0}];
  const textos={foto:'Envie uma foto da empresa.',horario:'Informe o horário de funcionamento.',whatsapp:'Informe o WhatsApp.',descricao:'Escreva a descrição da empresa.',endereco:'Informe o endereço.',redes:'Informe as redes sociais.'};
  const itens=(await db.query('SELECT * FROM catalog_items WHERE business_id=$1',[id])).rows;
  const sols=(await db.query("SELECT id,subject,status FROM requests WHERE business_id=$1 AND status<>'fechada' ORDER BY updated_at DESC",[id])).rows;
  const fila=(await db.query("SELECT kind,payload,resource_id,submitted_at FROM approvals WHERE business_id=$1 AND status='pendente' ORDER BY submitted_at,seq",[id])).rows;
  const banners=(await db.query("SELECT title,placement,ends_at FROM campaigns WHERE business_id=$1 AND status='published' AND (ends_at IS NULL OR ends_at>$2) ORDER BY ends_at NULLS LAST",[id,now.toISOString()])).rows
    .map(c=>({titulo:c.title,espaco:c.placement,ate:c.ends_at?br(new Date(c.ends_at).toISOString()):''}));
  const base=`/painel/${id}`;
  const depende=[
    ...(acesso.pode.perfil?completo.filter(c=>!c.ok).map(c=>({tipo:'completar',texto:textos[c.item],href:ANCORAS[c.item](base)})):[]),
    ...(acesso.pode.catalogo?itens.filter(i=>i.status==='draft'&&i.rejection).map(i=>({tipo:'recusado',texto:`"${i.name}" voltou para ajuste: ${i.rejection.comentario||'veja o comentário do Nexus'}`,href:`${base}/catalogo#item-${i.id}`})):[]),
    ...(acesso.pode.catalogo?itens.filter(i=>i.status==='draft'&&!i.rejection).map(i=>({tipo:'rascunho',texto:`"${i.name}" está em rascunho: envie para publicar.`,href:`${base}/catalogo#item-${i.id}`})):[]),
    // Descrição recusada pela equipe (13.4): aparece com o comentário por 30 dias, até o associado mandar outra.
    ...(acesso.pode.perfil?(await db.query(`SELECT comment FROM approvals WHERE business_id=$1 AND kind='descricao' AND status='recusado' AND decided_at>$2
      AND NOT EXISTS (SELECT 1 FROM approvals x WHERE x.business_id=$1 AND x.kind='descricao' AND x.status='pendente') ORDER BY decided_at DESC LIMIT 1`,
      [id,new Date(now.getTime()-30*86400000).toISOString()])).rows.map(r=>({tipo:'recusado',texto:`A descrição voltou para ajuste: ${r.comment}`,href:`${base}/perfil#campo-descricao`})):[]),
    ...sols.filter(s=>s.status==='respondida').map(s=>({tipo:'responder',texto:`A Nexus respondeu: ${s.subject}`,href:`${base}/solicitacoes#sol-${s.id}`})),
    ...(acesso.pode.acessos?(await db.query("SELECT u.email FROM access_tokens t JOIN users u ON u.id=t.user_id WHERE t.business_id=$1 AND t.kind='convite' AND t.used_at IS NULL AND t.expires_at<=$2 AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id=t.user_id AND m.business_id=t.business_id AND m.active)",[id,now.toISOString()])).rows
      .map(c=>({tipo:'convite',texto:`O convite para ${c.email} venceu. Convide de novo.`,href:`${base}/acessos`})):[])
  ];
  const titulos={descricao:'Descrição da empresa',foto:'Foto nova'};
  return {
    aparece:{status:STATUS_EMPRESA[b.status]||b.status,url:b.status==='published'?`/comercio/${b.slug}`:'',card,completo,visitas30:m30.visitas,buscas30:m30.buscas,
      visitas30Antes:m30.anterior.visitas,buscas30Antes:m30.anterior.buscas},
    depende,
    primig:{emAnalise:fila.map(f=>({tipo:f.kind,titulo:f.kind==='categoria'?`Categoria sugerida: ${f.payload?.nome||''}`:titulos[f.kind]||f.payload?.nome||'Item do catálogo',desde:iso(f.submitted_at)})),
      solicitacoes:sols.map(s=>({id:s.id,assunto:s.subject,status:s.status})),banners},
    contratado:acesso.pode.plano?{plano:b.plan_name||null,banners,assinatura:assinaturaGestao(b,now)}:null
  };
}
