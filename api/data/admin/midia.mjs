import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../../lib/erros.mjs';
import { audit } from '../../lib/auditoria.mjs';
import { salvarFoto } from '../../lib/imagens.mjs';
import { rejectExtra, needVersion, conflito, texto, iso, lista, casa, filtro } from './comum.mjs';

// Biblioteca de mídia da equipe (contrato 13.4): texto alternativo obrigatório, publicada na hora, a maior versão como url.
export function midiaVM(m) {
  const s=w=>(m.sizes||[]).find(x=>x.w===w)||{},maior=s(1600);
  return {id:m.id,url:`/midia/${m.id}/1600.webp`,largura:maior.largura??m.width,altura:maior.altura??m.height,
    tamanhos:{320:`/midia/${m.id}/320.webp`,800:`/midia/${m.id}/800.webp`,1600:`/midia/${m.id}/1600.webp`},alt:m.alt,criada:iso(m.created_at),version:m.version};
}
export async function listarMidia(db,url) {
  const q=filtro(url,'q');
  const rows=(await db.query("SELECT * FROM media WHERE kind='midia' AND status<>'removida' ORDER BY created_at DESC")).rows;
  return lista(rows.filter(m=>casa(q,m.alt)).map(midiaVM),url);
}
const legenda=v=>texto(v,'alt',200,{obrigatorio:true,min:3});
export async function enviarMidia(db,{buf,declarado,alt,session,ip,dir,now=new Date()}) {
  const texto=legenda(alt??'');
  const id=randomUUID().replace(/-/g,''),f=await salvarFoto(buf,{dir,id,declarado});
  try {
    const m=(await db.query(`INSERT INTO media(id,business_id,kind,mime,width,height,bytes,sha256,sizes,alt,status,created_by,created_at) VALUES($1,NULL,'midia',$2,$3,$4,$5,$6,$7::jsonb,$8,'aprovada',$9,$10) RETURNING *`,
      [id,f.mime,f.width,f.height,f.bytes,f.sha256,JSON.stringify(f.sizes),texto,session.user_id,now.toISOString()])).rows[0];
    await audit(db,{actor:session.user_id,action:'midia_enviada',resource:id,after:{alt:texto,largura:f.width,altura:f.height},ip});
    return midiaVM(m);
  } catch(e){await rm(join(dir,id),{recursive:true,force:true});throw e;}
}
async function item(db,id,{lock=false}={}){const m=(await db.query(`SELECT * FROM media WHERE id=$1 AND kind='midia' AND status<>'removida'${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!m)throw fail('Imagem não encontrada.',404);return m;}
export async function editarMidia(db,{id,p,session,ip}) {
  rejectExtra(p,['alt','version']);const version=needVersion(p),alt=legenda(p.alt);
  return db.transaction(async tx=>{
    const m=await item(tx,id,{lock:true});if(m.version!==version)throw conflito();
    const n=(await tx.query('UPDATE media SET alt=$2,version=version+1 WHERE id=$1 RETURNING *',[id,alt])).rows[0];
    await audit(tx,{actor:session.user_id,action:'midia_editada',resource:id,before:{alt:m.alt},after:{alt},ip});
    return midiaVM(n);
  });
}
// Tirar só a imagem que ninguém usa: publicações, banners, empresas, eventos, ofertas e as pessoas do Sobre nós.
export async function emUso(db,id) {
  const ref=`%/midia/${id}/%`;
  const usos=(await db.query(`SELECT 'conteudo' AS onde,id FROM content WHERE body_html LIKE $1 OR metadata::text LIKE $1
    UNION ALL SELECT 'banner',id FROM campaigns WHERE image_url LIKE $1 OR image_mobile_url LIKE $1
    UNION ALL SELECT 'empresa',id FROM businesses WHERE details::text LIKE $1
    UNION ALL SELECT 'evento',id FROM events WHERE image_url LIKE $1
    UNION ALL SELECT 'oferta',id FROM catalog_items WHERE image_url LIKE $1
    UNION ALL SELECT 'pessoa',name FROM about_people WHERE media_id=$2`,[ref,id])).rows;
  return usos.map(u=>`${u.onde} ${u.id}`);
}
export async function removerMidia(db,{id,session,ip,dir}) {
  const m=await item(db,id);
  const usos=await emUso(db,id);
  if(usos.length)throw fail(`Esta imagem está em uso (${usos.slice(0,3).join(', ')}${usos.length>3?'…':''}). Troque antes de tirar.`,422,'id');
  await db.query("UPDATE media SET status='removida',version=version+1 WHERE id=$1",[id]);
  await audit(db,{actor:session.user_id,action:'midia_removida',resource:id,before:{alt:m.alt},ip});
  try{await rm(join(dir,id),{recursive:true,force:true,maxRetries:3});}catch{}
  return {ok:true};
}
