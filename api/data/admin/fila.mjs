import { fail } from '../../lib/erros.mjs';
import { audit } from '../../lib/auditoria.mjs';
import { oneLine } from '../../lib/saneamento.mjs';
import { fotoVM, itemVM } from '../painel.mjs';
import { nomesDaLista, normalizeCategory, carregarCategorias } from '../categorias.mjs';
import { grupoVM, validarCategoriaNova, compararCategoria, inserirCategoria } from '../categorias-novas.mjs';
import { rejectExtra, needVersion, texto, iso, lista, filtro } from './comum.mjs';

// Fila de aprovação da equipe (contrato 13.4 e 13.9): o que os associados mandam passa por aqui antes de ir ao ar.
const STATUS={pendente:'pendente',aprovado:'aprovado',recusado:'recusado'};
const quem=r=>r?{id:r.id,email:r.email,nome:r.name||''}:null;
async function dadosDe(db,a) {
  if(a.kind==='descricao') {
    const b=(await db.query('SELECT summary,details FROM businesses WHERE id=$1',[a.business_id])).rows[0]||{};
    const antes={resumo:b.summary||'',descricao:b.details?.description||''};
    return {resumo:a.payload.resumo??antes.resumo,descricao:a.payload.descricao??antes.descricao,antes};
  }
  if(a.kind==='foto'){const m=(await db.query('SELECT * FROM media WHERE id=$1',[a.resource_id])).rows[0];return m?fotoVM(m):null;}
  // Avaliação de morador (18.4): a nota, o texto enviado e o primeiro nome de quem avaliou.
  if(a.kind==='avaliacao') {
    const u=(await db.query('SELECT u.name FROM resident_reviews r JOIN users u ON u.id=r.user_id WHERE r.id=$1',[a.resource_id])).rows[0];
    return {nota:a.payload.nota,texto:a.payload.texto,autor:{nome:String(u?.name||'').trim().split(/\s+/)[0]||'Morador'}};
  }
  // Sugestão de categoria (22.5): o nome, o grupo e as parecidas da lista no momento da leitura.
  if(a.kind==='categoria')return {nome:a.payload.nome,grupo:grupoVM(a.payload.grupo),parecidas:(await compararCategoria(db,a.payload.nome)).parecidas};
  if(a.kind==='catalogo'||a.kind==='oferta') {
    // O antes é a última versão aprovada pela fila (o item publicado); item novo não tem antes.
    const antes=(await db.query("SELECT payload FROM approvals WHERE resource_id=$1 AND kind IN ('catalogo','oferta') AND status='aprovado' AND id<>$2 ORDER BY decided_at DESC NULLS LAST LIMIT 1",[a.resource_id,a.id])).rows[0]?.payload||null;
    return {...a.payload,antes};
  }
  return a.payload||{};
}
async function filaVM(db,a) {
  return {id:a.id,tipo:a.kind,empresa:{id:a.business_id,nome:a.business_name||a.business_id},recurso:a.resource_id,dados:await dadosDe(db,a),
    enviado:{por:quem(a.sub_id?{id:a.sub_id,email:a.sub_email,name:a.sub_name}:null),em:iso(a.submitted_at)},status:a.status,comentario:a.comment||'',
    decidido:a.decided_at?{por:quem(a.dec_id?{id:a.dec_id,email:a.dec_email,name:a.dec_name}:null),em:iso(a.decided_at)}:null,version:a.version};
}
const SELECT=`SELECT a.*,b.name AS business_name,s.id AS sub_id,s.email AS sub_email,s.name AS sub_name,d.id AS dec_id,d.email AS dec_email,d.name AS dec_name
  FROM approvals a JOIN businesses b ON b.id=a.business_id LEFT JOIN users s ON s.id=a.submitted_by LEFT JOIN users d ON d.id=a.decided_by`;
export async function listarFila(db,url) {
  const status=STATUS[filtro(url,'status')||'pendente'],tipo=filtro(url,'tipo'),empresa=filtro(url,'empresa');
  if(!status)throw fail('Status: pendente, aprovado ou recusado.',422,'status');
  const rows=(await db.query(`${SELECT} WHERE a.status=$1 AND ($2='' OR a.kind=$2) AND ($3='' OR a.business_id=$3) ORDER BY a.submitted_at,a.seq`,[status,tipo,empresa])).rows;
  const pagina=lista(rows,url);
  return {...pagina,itens:await Promise.all(pagina.itens.map(a=>filaVM(db,a)))};
}
export async function contarFila(db){return (await db.query("SELECT count(*)::int AS n FROM approvals WHERE status='pendente'")).rows[0].n;}

// Aprovar ou recusar (recusar exige comentário). O pedido que mudou depois do envio responde 409.
export async function decidir(db,{id,acao,p,session,ip,now=new Date()}) {
  // categoria, nome e grupo: só ao aprovar a sugestão de categoria (22.5).
  rejectExtra(p,acao==='recusar'?['comentario','version']:['version','categoria','nome','grupo']);
  const version=needVersion(p),comentario=acao==='recusar'?oneLine(texto(p.comentario,'comentario',600,{obrigatorio:true,min:3})):'';
  const aprovar=acao==='aprovar';let criou=false;
  const decidido=await db.transaction(async tx=>{
    const a=(await tx.query('SELECT * FROM approvals WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!a)throw fail('Pedido não encontrado.',404);
    if(a.status!=='pendente')throw fail(a.status==='substituido'?'O associado mandou uma versão mais nova. Abra a fila de novo.':'Este pedido já foi decidido.',409);
    if(a.version!==version)throw fail('Esta informação mudou desde que você abriu. Recarregue.',409);
    const extra=['categoria','nome','grupo'].find(k=>p[k]!==undefined);
    if(extra&&a.kind!=='categoria')throw fail('Campo não permitido.',422,extra);
    let antes=null,depois=null;
    if(a.kind==='categoria') {
      const b=(await tx.query('SELECT details FROM businesses WHERE id=$1 FOR UPDATE',[a.business_id])).rows[0],cats=b.details?.categories||[];
      antes={categorias:cats};
      if(aprovar) {
        let nome;
        if(p.categoria!==undefined) {
          // Troca por uma da lista: só escolhe, sem criar.
          nome=normalizeCategory(typeof p.categoria==='string'?p.categoria:'');
          if(!nomesDaLista().includes(nome))throw fail('Escolha uma categoria da lista.',422,'categoria');
        } else {
          const v=validarCategoriaNova({nome:p.nome??a.payload.nome,grupo:p.grupo??a.payload.grupo}),c=await compararCategoria(tx,v.nome);
          if(c.igual)throw fail(`Já existe a categoria "${c.igual.nome}": troque por ela.`,422,'nome',{igual:c.igual});
          await inserirCategoria(tx,{...v,session,ip,now});nome=v.nome;criou=true;
        }
        const novas=cats.includes(nome)?cats:[...cats,nome];
        if(novas.length>8)throw fail('A empresa já tem 8 categorias.',422,'categoria');
        await tx.query("UPDATE businesses SET details=jsonb_set(COALESCE(details,'{}'::jsonb),'{categories}',$2::jsonb),managed_at=COALESCE(managed_at,$3),updated_at=$3,version=version+1 WHERE id=$1",
          [a.business_id,JSON.stringify(novas),now.toISOString()]);
        depois={categorias:novas};
      }
    } else if(a.kind==='descricao') {
      const b=(await tx.query('SELECT summary,details FROM businesses WHERE id=$1 FOR UPDATE',[a.business_id])).rows[0];
      antes={resumo:b.summary,descricao:b.details?.description||''};
      if(aprovar) {
        const d={...b.details};if(a.payload.descricao!==undefined)d.description=a.payload.descricao;
        await tx.query('UPDATE businesses SET summary=$2,details=$3::jsonb,managed_at=COALESCE(managed_at,$4),updated_at=$4,version=version+1 WHERE id=$1',
          [a.business_id,a.payload.resumo??b.summary,JSON.stringify(d),now.toISOString()]);
        depois={resumo:a.payload.resumo??b.summary,descricao:d.description||''};
      }
    } else if(a.kind==='foto') {
      const m=(await tx.query("UPDATE media SET status=$2 WHERE id=$1 AND status='pendente' RETURNING id",[a.resource_id,aprovar?'aprovada':'recusada'])).rows[0];
      if(!m)throw fail('A foto não está mais esperando aprovação.',409);
      antes={status:'pendente'};depois={status:aprovar?'aprovada':'recusada'};
    } else if(a.kind==='catalogo'||a.kind==='oferta') {
      const i=(await tx.query('SELECT * FROM catalog_items WHERE id=$1 FOR UPDATE',[a.resource_id])).rows[0];
      if(!i||i.status!=='review'||i.version!==a.version){await tx.query("UPDATE approvals SET status='substituido' WHERE id=$1",[id]);throw fail('O item mudou depois do envio. Abra a fila de novo.',409);}
      const n=(await tx.query(`UPDATE catalog_items SET status=$2,version=version+1,approved_version=CASE WHEN $3 THEN version+1 ELSE approved_version END,rejection=$4::jsonb,updated_at=$5 WHERE id=$1 RETURNING *`,
        [i.id,aprovar?'published':'draft',aprovar,aprovar?null:JSON.stringify({comentario,em:now.toISOString()}),now.toISOString()])).rows[0];
      antes={status:itemVM(i).status};depois={status:itemVM(n).status};
    } else if(a.kind==='avaliacao') {
      const r=(await tx.query("UPDATE resident_reviews SET status=$2,decided_at=$3 WHERE id=$1 AND status='pendente' RETURNING id",[a.resource_id,aprovar?'publicada':'recusada',now.toISOString()])).rows[0];
      if(!r){await tx.query("UPDATE approvals SET status='substituido' WHERE id=$1",[id]);throw fail('A avaliação não está mais esperando aprovação.',409);}
      antes={status:'pendente'};depois={status:aprovar?'publicada':'recusada'};
    } else throw fail('Este tipo ainda não é decidido pela fila.',422,'tipo');
    await tx.query('UPDATE approvals SET status=$2,comment=$3,decided_by=$4,decided_at=$5,version=version+1 WHERE id=$1',[id,aprovar?'aprovado':'recusado',comentario,session.user_id,now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:a.business_id,action:aprovar?'fila_aprovada':'fila_recusada',resource:a.resource_id,before:antes,after:{...depois,tipo:a.kind,...(comentario?{comentario}:{})},ip});
    const r=(await tx.query(`${SELECT} WHERE a.id=$1`,[id])).rows[0];
    return filaVM(tx,r);
  });
  // A categoria criada na aprovação já vale na lista única deste processo (22.1).
  if(criou)await carregarCategorias(db,{forcar:true});
  return decidido;
}
