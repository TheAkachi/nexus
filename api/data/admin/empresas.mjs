import { fail } from '../../lib/erros.mjs';
import { audit, diff } from '../../lib/auditoria.mjs';
import { slugify, normalize } from '../../lib/saneamento.mjs';
import { compararNomes } from '../../lib/parecidos.mjs';
import { matchesHomeCategory } from '../categorias.mjs';
import { validarPerfil, aplicarDetalhes } from '../painel.mjs';
import { rejectExtra, needVersion, conflito, texto, imagem, iso, lista, casa, filtro, STATUS_PT, STATUS_DB } from './comum.mjs';

// Empresas, redes (unidades) e planos no admin (contrato 13.4).
const CAMPOS=['nome','slug','status','bairro','cidade','rua','cep','referencia','pagamentos','telefone','whatsapp','email','site','redes','resumo','descricao','horario','categorias','rede','plano','destaque','imagem'];
async function horarioDe(db,id){return (await db.query('SELECT weekday,opens,closes FROM business_hours WHERE business_id=$1 ORDER BY weekday,opens',[id])).rows.map(r=>({dia:r.weekday,abre:r.opens,fecha:r.closes}));}
export async function empresaVM(db,b) {
  const d=b.details||{};
  return {id:b.id,slug:b.slug,nome:b.name,status:STATUS_PT[b.status]||b.status,bairro:b.district||'',cidade:d.city||'',rua:d.street||'',cep:d.cep||'',
    referencia:d.referencia||'',pagamentos:d.pagamentos||[],
    telefone:b.phone||'',whatsapp:d.whatsapp||'',email:d.email||'',site:d.website||'',redes:(d.socials||[]).map(s=>({rede:s.label,url:s.url})),
    resumo:b.summary||'',descricao:d.description||'',categorias:d.categories||[],rede:b.group_id||null,plano:b.plan_id||null,destaque:b.featured===true,
    imagem:d.image||'',horario:await horarioDe(db,b.id),gerida:Boolean(b.managed_at),planoGerido:b.plan_managed===true,atualizada:iso(b.updated_at),version:b.version};
}
const linhaVM=b=>({id:b.id,slug:b.slug,nome:b.name,status:STATUS_PT[b.status]||b.status,bairro:b.district||'',categorias:b.details?.categories||[],
  plano:b.plan_id?{id:b.plan_id,nome:b.plan_name||b.plan_id}:null,rede:b.group_id||null,destaque:b.featured===true,gerida:Boolean(b.managed_at),planoGerido:b.plan_managed===true,atualizada:iso(b.updated_at),version:b.version});

export async function listarEmpresas(db,url) {
  const q=filtro(url,'q'),status=STATUS_DB[filtro(url,'status')]||'',plano=filtro(url,'plano'),bairro=filtro(url,'bairro'),categoria=filtro(url,'categoria');
  const rows=(await db.query('SELECT b.*,p.name AS plan_name FROM businesses b LEFT JOIN plans p ON p.id=b.plan_id ORDER BY b.name')).rows;
  return lista(rows.filter(b=>casa(q,b.name,b.district,b.id)&&(!status||b.status===status)&&(!plano||b.plan_id===plano)
    &&(!bairro||normalize(b.district)===normalize(bairro))&&(!categoria||matchesHomeCategory(b,categoria))).map(linhaVM),url);
}
async function carregar(db,id,{lock=false}={}) {
  const b=(await db.query(`SELECT * FROM businesses WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
  if(!b)throw fail('Empresa não encontrada.',404);return b;
}
export const obterEmpresa=async(db,id)=>empresaVM(db,await carregar(db,id));

// Valida os campos próprios do admin; os do perfil (contatos, redes, textos, horário) seguem as regras do painel.
async function validar(db,p,{novo=false}={}) {
  const PERFIL=['nome','rua','bairro','cidade','cep','referencia','pagamentos','categorias','horario','telefone','whatsapp','email','site','redes','resumo','descricao'];
  const v=validarPerfil(Object.fromEntries(PERFIL.filter(k=>p[k]!==undefined||(k==='nome'&&novo)).map(k=>[k,p[k]])),{novo});
  if(p.status!==undefined){if(!STATUS_DB[p.status]||p.status==='validacao')throw fail('Status: rascunho, publicado ou pausado.',422,'status');v.status=STATUS_DB[p.status];}
  if(p.rede!==undefined){if(p.rede!==null&&!(await db.query('SELECT 1 FROM business_groups WHERE id=$1',[p.rede])).rows.length)throw fail('Rede não encontrada.',422,'rede');v.rede=p.rede;}
  if(p.plano!==undefined){if(p.plano!==null&&!(await db.query('SELECT 1 FROM plans WHERE id=$1',[p.plano])).rows.length)throw fail('Plano não encontrado.',422,'plano');v.plano=p.plano;}
  if(p.destaque!==undefined){if(typeof p.destaque!=='boolean')throw fail('Valor inválido.',422,'destaque');v.destaque=p.destaque;}
  const img=imagem(p.imagem,'imagem');if(img!==undefined)v.imagem=img;
  return v;
}
async function gravarHorario(tx,id,horario) {
  await tx.query('DELETE FROM business_hours WHERE business_id=$1',[id]);
  for(const h of horario)await tx.query('INSERT INTO business_hours(business_id,weekday,opens,closes) VALUES($1,$2,$3,$4)',[id,h.dia,h.abre,h.fecha]);
}
export async function criarEmpresa(db,{p,session,ip,now=new Date()}) {
  rejectExtra(p,CAMPOS);
  const v=await validar(db,p,{novo:true}),id=slugify(p.slug||v.nome);
  if(!id||id.length<3)throw fail('Use um identificador com letras e números.',422,'slug');
  if((await db.query('SELECT 1 FROM businesses WHERE id=$1 OR slug=$1',[id])).rows.length)throw fail('Já existe uma empresa com este identificador.',422,'slug');
  const d=aplicarDetalhes({district:'',details:{city:'Rio de Janeiro',photos:[]}},{cidade:'Rio de Janeiro',...v});
  return db.transaction(async tx=>{
    await tx.query(`INSERT INTO businesses(id,slug,name,district,summary,phone,website,source_url,group_id,featured,plan_id,status,details,enriched,managed_at,updated_at)
      VALUES($1,$1,$2,$3,$4,$5,$6,'',$7,$8,$9,$10,$11::jsonb,true,$12,$12)`,[id,v.nome,v.bairro||'',v.resumo||'',v.telefone||'',d.website||'',v.rede||null,v.destaque===true,v.plano||null,v.status||'draft',JSON.stringify(d),now.toISOString()]);
    if(v.horario)await gravarHorario(tx,id,v.horario);
    const vm=await empresaVM(tx,await carregar(tx,id));
    await audit(tx,{actor:session.user_id,business:id,action:'empresa_criada',resource:id,after:vm,ip});
    return vm;
  });
}
export async function editarEmpresa(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,[...CAMPOS.filter(k=>k!=='slug'),'version']);
  const version=needVersion(p),v=await validar(db,p);
  return db.transaction(async tx=>{
    const b=await carregar(tx,id,{lock:true});if(b.version!==version)throw conflito();
    // O plano da empresa atendida pela gestão comercial é definido por ela (contrato 19.4).
    if(b.plan_managed&&v.plano!==undefined&&v.plano!==b.plan_id)throw fail('O plano desta empresa é definido pela gestão.',422,'plano');
    const antes=await empresaVM(tx,b),d=aplicarDetalhes(b,v);
    await tx.query(`UPDATE businesses SET name=$2,district=$3,summary=$4,phone=$5,website=$6,group_id=$7,featured=$8,plan_id=$9,status=$10,details=$11::jsonb,
      managed_at=COALESCE(managed_at,$12),updated_at=$12,version=version+1 WHERE id=$1`,
      [id,v.nome??b.name,v.bairro??b.district,v.resumo??b.summary,v.telefone??b.phone,d.website||'',v.rede!==undefined?v.rede:b.group_id,v.destaque??b.featured,
       v.plano!==undefined?v.plano:b.plan_id,v.status??b.status,JSON.stringify(d),now.toISOString()]);
    if(v.horario)await gravarHorario(tx,id,v.horario);
    const depois=await empresaVM(tx,await carregar(tx,id)),mudou=diff(antes,depois);
    await audit(tx,{actor:session.user_id,business:id,action:'empresa_editada',resource:id,before:mudou.before,after:mudou.after,ip});
    return depois;
  });
}
export async function statusEmpresa(db,{id,acao,p,session,ip,now=new Date()}) {
  rejectExtra(p,['version']);const version=needVersion(p),novo=acao==='publicar'?'published':'paused';
  return db.transaction(async tx=>{
    const b=await carregar(tx,id,{lock:true});if(b.version!==version)throw conflito();
    if(novo==='published'&&!(b.name&&b.details?.categories?.length))throw fail('Antes de publicar, informe ao menos uma categoria.',422,'categorias');
    await tx.query('UPDATE businesses SET status=$2,managed_at=COALESCE(managed_at,$3),updated_at=$3,version=version+1 WHERE id=$1',[id,novo,now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:id,action:`empresa_${acao}`,resource:id,before:{status:STATUS_PT[b.status]},after:{status:STATUS_PT[novo]},ip});
    return empresaVM(tx,await carregar(tx,id));
  });
}

// Redes (unidades da mesma marca).
export async function listarRedes(db) {
  const rows=(await db.query('SELECT g.id,g.name,count(b.id)::int AS n FROM business_groups g LEFT JOIN businesses b ON b.group_id=g.id GROUP BY g.id,g.name ORDER BY g.name')).rows;
  return {itens:rows.map(r=>({id:r.id,nome:r.name,empresas:r.n})),total:rows.length,pagina:1,paginas:1};
}
// v0.22.0 (22.6): nome igual a uma rede é recusado; com redes parecidas, só cria com confirmar: true.
export async function criarRede(db,{p,session,ip}) {
  rejectExtra(p,['id','nome','confirmar']);const nome=texto(p.nome,'nome',80,{obrigatorio:true,min:2}),id=slugify(p.id||nome);
  if(p.confirmar!==undefined&&typeof p.confirmar!=='boolean')throw fail('Valor inválido.',422,'confirmar');
  const redes=(await listarRedes(db)).itens,{igual,parecidos}=compararNomes(nome,redes,r=>r.nome);
  if(igual)throw fail(`Já existe a rede "${igual.nome}".`,422,'nome',{igual:{id:igual.id,nome:igual.nome}});
  if(parecidos.length&&p.confirmar!==true)throw fail('Há redes parecidas: confira antes de criar.',422,'nome',{parecidas:parecidos});
  if((await db.query('SELECT 1 FROM business_groups WHERE id=$1',[id])).rows.length)throw fail('Já existe uma rede com este identificador.',422,'id');
  await db.query('INSERT INTO business_groups(id,name) VALUES($1,$2)',[id,nome]);
  await audit(db,{actor:session.user_id,action:'rede_criada',resource:id,after:{nome},ip});
  return {id,nome,empresas:0};
}

// Planos reais (D2 pelo admin).
const PLANO_STATUS={ativo:'active',pausado:'paused',rascunho:'draft'},PLANO_PT={active:'ativo',paused:'pausado',draft:'rascunho'};
const planoVM=r=>({id:r.id,nome:r.name,precoCentavos:r.price_cents,ordem:r.rank,patrocinado:r.sponsored,pago:r.paid,status:PLANO_PT[r.status],version:r.version});
export async function listarPlanos(db){const rows=(await db.query('SELECT * FROM plans ORDER BY rank DESC,name')).rows;return {itens:rows.map(planoVM),total:rows.length,pagina:1,paginas:1};}
function validarPlano(p,{novo=false}={}) {
  const v={};const nome=texto(p.nome,'nome',60,{obrigatorio:novo,min:2});if(nome!==undefined)v.name=nome;
  if(p.precoCentavos!==undefined){if(p.precoCentavos!==null&&(!Number.isSafeInteger(p.precoCentavos)||p.precoCentavos<0||p.precoCentavos>100000000))throw fail('Informe o preço, como 67,00.',422,'precoCentavos');v.price_cents=p.precoCentavos;}
  if(p.ordem!==undefined){if(!Number.isInteger(p.ordem)||p.ordem<0||p.ordem>100)throw fail('Use uma ordem de 0 a 100.',422,'ordem');v.rank=p.ordem;}
  for(const [k,c] of [['patrocinado','sponsored'],['pago','paid']])if(p[k]!==undefined){if(typeof p[k]!=='boolean')throw fail('Valor inválido.',422,k);v[c]=p[k];}
  if(p.status!==undefined){if(!PLANO_STATUS[p.status])throw fail('Status: ativo, pausado ou rascunho.',422,'status');v.status=PLANO_STATUS[p.status];}
  return v;
}
export async function criarPlano(db,{p,session,ip}) {
  rejectExtra(p,['id','nome','precoCentavos','ordem','patrocinado','pago','status']);
  const v=validarPlano(p,{novo:true}),id=slugify(p.id||v.name);
  if((await db.query('SELECT 1 FROM plans WHERE id=$1',[id])).rows.length)throw fail('Já existe um plano com este identificador.',422,'id');
  const r=(await db.query('INSERT INTO plans(id,name,price_cents,rank,sponsored,paid,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [id,v.name,v.price_cents??null,v.rank??0,v.sponsored??false,v.paid??true,v.status??'active'])).rows[0];
  await audit(db,{actor:session.user_id,action:'plano_criado',resource:id,after:planoVM(r),ip});
  return planoVM(r);
}
export async function editarPlano(db,{id,p,session,ip}) {
  rejectExtra(p,['nome','precoCentavos','ordem','patrocinado','pago','status','version']);const version=needVersion(p),v=validarPlano(p);
  return db.transaction(async tx=>{
    const r=(await tx.query('SELECT * FROM plans WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!r)throw fail('Plano não encontrado.',404);if(r.version!==version)throw conflito();
    const n=(await tx.query(`UPDATE plans SET name=$2,price_cents=$3,rank=$4,sponsored=$5,paid=$6,status=$7,version=version+1 WHERE id=$1 RETURNING *`,
      [id,v.name??r.name,v.price_cents!==undefined?v.price_cents:r.price_cents,v.rank??r.rank,v.sponsored??r.sponsored,v.paid??r.paid,v.status??r.status])).rows[0];
    const mudou=diff(planoVM(r),planoVM(n));
    await audit(tx,{actor:session.user_id,action:'plano_editado',resource:id,before:mudou.before,after:mudou.after,ip});
    return planoVM(n);
  });
}
