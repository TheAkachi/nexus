import { randomUUID } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit } from '../lib/auditoria.mjs';
import { limit } from '../auth.mjs';

// Avaliações de moradores (contrato 18.4): uma por conta e empresa, publicadas só depois da fila da equipe. Ficam separadas
// das avaliações que vieram do portal (reviews). Nada de incentivo: a nota é livre e não vale nada em troca.
const br=d=>new Date(d).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
const primeiroNome=n=>String(n||'').trim().split(/\s+/)[0]||'Morador';

// Empresa.moradores: as publicadas, mais recentes primeiro; média com uma casa.
export async function moradoresDe(db,businessId) {
  const rows=(await db.query(`SELECT r.rating,r.body,r.created_at,u.name FROM resident_reviews r JOIN users u ON u.id=r.user_id
    WHERE r.business_id=$1 AND r.status='publicada' ORDER BY r.created_at DESC`,[businessId])).rows;
  const media=rows.length?Math.round(rows.reduce((t,r)=>t+r.rating,0)/rows.length*10)/10:null;
  return {media,total:rows.length,itens:rows.map(r=>({nome:primeiroNome(r.name),nota:r.rating,texto:r.body,data:br(r.created_at)}))};
}
// Empresa.avaliar: há sessão? a avaliação da pessoa e o bloqueio (quem cuida da empresa e a equipe não avaliam).
// csrf: o da sessão, para o formulário mandar no X-CSRF-Token (pedido do front).
export async function avaliarVM(db,businessId,{usuario=null,tipo=null,csrf=''}={}) {
  if(!usuario)return {conta:false,minha:null,bloqueio:''};
  const propria=(await db.query('SELECT 1 FROM memberships WHERE user_id=$1 AND business_id=$2 AND active',[usuario,businessId])).rows.length>0;
  const r=(await db.query('SELECT rating,body,status FROM resident_reviews WHERE business_id=$1 AND user_id=$2',[businessId,usuario])).rows[0];
  return {conta:true,csrf,minha:r?{nota:r.rating,texto:r.body,status:r.status}:null,bloqueio:tipo==='equipe'?'equipe':propria?'propria':''};
}

// POST /api/empresas/:slug/avaliacoes: entra pendente, com um pedido na fila (tipo avaliacao). A recusada pode ser trocada.
export async function avaliar(db,{slug,p,session,ip,now=new Date()}) {
  const extra=Object.keys(p).find(k=>!['nota','texto'].includes(k));if(extra)throw fail('Campo não permitido.',422,extra);
  const b=(await db.query("SELECT id,name FROM businesses WHERE slug=$1 AND status='published'",[slug])).rows[0];
  if(!b)throw fail('Empresa não encontrada.',404);
  if(session.staff_role)throw fail('A equipe do Nexus não avalia empresas do guia.',403);
  if((await db.query('SELECT 1 FROM memberships WHERE user_id=$1 AND business_id=$2 AND active',[session.user_id,b.id])).rows.length)throw fail('Quem cuida da empresa não pode avaliá-la.',403);
  if(!Number.isInteger(p.nota)||p.nota<1||p.nota>5)throw fail('Escolha uma nota de 1 a 5.',422,'nota');
  const texto=typeof p.texto==='string'?p.texto.replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim():'';
  if(texto.length<10||texto.length>600)throw fail('Conte como foi, de 10 a 600 caracteres.',422,'texto');
  await limit(db,`avaliacao:${session.user_id}`,10,3600000,now);
  return db.transaction(async tx=>{
    const atual=(await tx.query('SELECT id,status FROM resident_reviews WHERE business_id=$1 AND user_id=$2 FOR UPDATE',[b.id,session.user_id])).rows[0];
    if(atual&&atual.status!=='recusada')throw fail('Você já avaliou esta empresa.',409);
    const id=atual?.id||randomUUID();
    if(atual)await tx.query("UPDATE resident_reviews SET rating=$2,body=$3,status='pendente',created_at=$4,decided_at=NULL WHERE id=$1",[id,p.nota,texto,now.toISOString()]);
    else await tx.query("INSERT INTO resident_reviews(id,business_id,user_id,rating,body,created_at) VALUES($1,$2,$3,$4,$5,$6)",[id,b.id,session.user_id,p.nota,texto,now.toISOString()]);
    await tx.query("INSERT INTO approvals(id,business_id,kind,resource_id,payload,submitted_by,submitted_at) VALUES($1,$2,'avaliacao',$3,$4::jsonb,$5,$6)",
      [randomUUID(),b.id,id,JSON.stringify({nota:p.nota,texto}),session.user_id,now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:b.id,action:'avaliacao_enviada',resource:id,after:{nota:p.nota},ip});
    return {status:'pendente'};
  });
}
