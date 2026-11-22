import { fail } from '../../lib/erros.mjs';
import { audit } from '../../lib/auditoria.mjs';
import { oneLine } from '../../lib/saneamento.mjs';
import { ensureUser, hasPassword, issueToken, endSessions, validEmail } from '../../auth.mjs';
import { convidar, revogar } from '../../painel-api.mjs';
import { solicitacaoEmpresa, responderSolicitacao } from '../painel.mjs';
import { textoRecuperacao } from '../../lib/email.mjs';
import { rejectExtra, needVersion, conflito, texto, iso, lista, casa, filtro, POR_PAGINA, pagina } from './comum.mjs';

// Usuários e acessos, equipe, auditoria e solicitações do lado da equipe (contrato 13.4).
const EQUIPE=['admin','editor','operador'];
async function usuarioVM(db,u) {
  const acessos=(await db.query('SELECT m.role,m.active,b.id,b.name FROM memberships m JOIN businesses b ON b.id=m.business_id WHERE m.user_id=$1 ORDER BY b.name',[u.id])).rows;
  return {id:u.id,email:u.email,nome:u.name||'',tipo:u.kind,equipe:u.staff_role||null,desativado:u.disabled,
    acessos:acessos.map(a=>({empresa:{id:a.id,nome:a.name},papel:a.role,ativo:a.active})),version:u.version};
}
export async function listarUsuarios(db,url) {
  const q=filtro(url,'q'),tipo=filtro(url,'tipo');
  const rows=(await db.query('SELECT * FROM users ORDER BY email')).rows.filter(u=>casa(q,u.email,u.name)&&(!tipo||(tipo==='equipe'?u.staff_role:!u.staff_role&&u.kind!=='consumidor')));
  const p=lista(rows,url);
  return {...p,itens:await Promise.all(p.itens.map(u=>usuarioVM(db,u)))};
}
async function usuario(db,id,{lock=false}={}){const u=(await db.query(`SELECT * FROM users WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!u)throw fail('Usuário não encontrado.',404);return u;}
export const obterUsuario=async(db,id)=>usuarioVM(db,await usuario(db,id));

// Convite de associado pela equipe: mesmas regras do painel (12.4). v0.21.0: sem o e-mail, a resposta traz também o
// WhatsApp da empresa com a mensagem pronta (21.3).
export async function convidarAssociado(db,{p,session,ip,now,mailer,origin}) {
  rejectExtra(p,['email','empresa','papel']);
  const e=(await db.query('SELECT id,name FROM businesses WHERE id=$1',[p.empresa])).rows[0];
  if(!e)throw fail('Empresa não encontrada.',422,'empresa');
  return convidar(db,{id:e.id,p:{email:p.email,papel:p.papel},session,ip,now,empresa:e,mailer,origin,comWhatsapp:true});
}
// Conta da equipe: quem já tem senha passa a ser da equipe na hora; quem não tem recebe um link de 7 dias.
export async function definirEquipe(db,{p,session,ip,now=new Date(),mailer,origin}) {
  rejectExtra(p,['email','papel']);
  if(!EQUIPE.includes(p.papel))throw fail('Papel da equipe: admin, editor ou operador.',422,'papel');
  if(!validEmail(p.email))throw fail('Informe um e-mail válido.',422,'email');
  const u=await ensureUser(db,p.email,{kind:'equipe'});
  if(u.id===session.user_id)throw fail('Você não pode mudar o próprio papel.',403);
  const antes=(await db.query('SELECT staff_role FROM users WHERE id=$1',[u.id])).rows[0].staff_role;
  await db.query("UPDATE users SET staff_role=$2,kind='equipe',disabled=false,version=version+1 WHERE id=$1",[u.id,p.papel]);
  await audit(db,{actor:session.user_id,action:'equipe_definida',resource:u.id,before:{equipe:antes},after:{email:u.email,equipe:p.papel},ip});
  if(hasPassword(u))return {email:u.email,papel:p.papel,expira:null,link:'',enviado:false,ativo:true};
  const {value,expires}=await issueToken(db,{kind:'recuperacao',userId:u.id,createdBy:session.user_id,now,validadeMs:7*86400000});
  const link=`${origin}/entrar/definir-senha?token=${value}`;
  const enviado=mailer?await mailer({to:u.email,subject:'Seu acesso à equipe do Nexus',text:`Olá!\n\nVocê agora faz parte da equipe do Nexus (${p.papel}).\n\nPara criar sua senha, abra o link abaixo (vale 7 dias):\n${link}\n\nNexus`}):false;
  return {email:u.email,papel:p.papel,expira:expires.toISOString(),link:enviado?'':link,enviado,ativo:false};
}
export async function editarUsuario(db,{id,p,session,ip}) {
  rejectExtra(p,['equipe','desativado','nome','version']);const version=needVersion(p);
  if(id===session.user_id&&(p.equipe!==undefined||p.desativado!==undefined))throw fail('Você não pode mudar o próprio papel nem se desativar.',403);
  if(p.equipe!==undefined&&p.equipe!==null&&!EQUIPE.includes(p.equipe))throw fail('Papel da equipe: admin, editor, operador ou nenhum.',422,'equipe');
  if(p.desativado!==undefined&&typeof p.desativado!=='boolean')throw fail('Valor inválido.',422,'desativado');
  const nome=texto(p.nome,'nome',120);
  return db.transaction(async tx=>{
    const u=await usuario(tx,id,{lock:true});if(u.version!==version)throw conflito();
    const equipe=p.equipe!==undefined?p.equipe:u.staff_role,desativado=p.desativado??u.disabled;
    await tx.query('UPDATE users SET staff_role=$2,kind=$3,disabled=$4,name=$5,version=version+1 WHERE id=$1',
      [id,equipe,equipe?'equipe':(u.kind==='equipe'?'associado':u.kind),desativado,nome!==undefined?oneLine(nome):u.name]);
    if(desativado&&!u.disabled)await endSessions(tx,id);
    await audit(tx,{actor:session.user_id,action:'usuario_editado',resource:id,before:{equipe:u.staff_role,desativado:u.disabled,nome:u.name},after:{equipe,desativado,nome:nome!==undefined?oneLine(nome):u.name},ip});
    return usuarioVM(tx,await usuario(tx,id));
  });
}
export async function linkSenha(db,{id,session,ip,now=new Date(),mailer,origin}) {
  const u=await usuario(db,id);if(u.disabled)throw fail('Esta conta está desativada.',422,'id');
  const {value,expires}=await issueToken(db,{kind:'recuperacao',userId:id,createdBy:session.user_id,now});
  const link=`${origin}/entrar/definir-senha?token=${value}`;
  const enviado=mailer?await mailer({to:u.email,subject:'Sua nova senha no Nexus',text:textoRecuperacao({link})}):false;
  await audit(db,{actor:session.user_id,action:'link_senha_equipe',resource:id,after:{email:u.email,enviado},ip});
  return {email:u.email,expira:expires.toISOString(),link:enviado?'':link,enviado};
}
export async function revogarAcesso(db,{id,empresa,session,ip}) {
  if(!(await db.query('SELECT 1 FROM businesses WHERE id=$1',[empresa])).rows.length)throw fail('Empresa não encontrada.',404);
  return revogar(db,{id:empresa,usuario:id,session,ip});
}
export async function encerrarSessoes(db,{id,session,ip}) {
  await usuario(db,id);await endSessions(db,id);
  await audit(db,{actor:session.user_id,action:'sessoes_encerradas_equipe',resource:id,ip});
  return {ok:true};
}

// Auditoria consultável (só leitura; a tabela não aceita UPDATE nem DELETE).
export async function listarAuditoria(db,url) {
  const acao=filtro(url,'acao'),empresa=filtro(url,'empresa'),quem=filtro(url,'usuario'),q=filtro(url,'q'),de=filtro(url,'de'),ate=filtro(url,'ate');
  for(const [k,v] of [['de',de],['ate',ate]])if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw fail('Use a data no formato aaaa-mm-dd.',422,k);
  const where=`WHERE ($1='' OR a.action=$1) AND ($2='' OR a.business_id=$2) AND ($3='' OR a.actor_id=$3 OR u.email ILIKE $3)
    AND ($4='' OR a.resource_id ILIKE '%'||$4||'%' OR a.action ILIKE '%'||$4||'%') AND ($5='' OR a.created_at>=($5||'T00:00:00-03:00')::timestamptz) AND ($6='' OR a.created_at<=($6||'T23:59:59-03:00')::timestamptz)`;
  const args=[acao,empresa,quem,q,de,ate],p=pagina(url);
  const total=(await db.query(`SELECT count(*)::int AS n FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ${where}`,args)).rows[0].n;
  const rows=(await db.query(`SELECT a.*,u.email FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ${where} ORDER BY a.created_at DESC,a.id LIMIT ${POR_PAGINA} OFFSET ${(p-1)*POR_PAGINA}`,args)).rows;
  return {itens:rows.map(a=>({id:a.id,em:iso(a.created_at),acao:a.action,empresa:a.business_id,recurso:a.resource_id,por:a.actor_id?{id:a.actor_id,email:a.email||''}:null,antes:a.before,depois:a.after,ip:a.ip})),
    total,pagina:p,paginas:Math.max(1,Math.ceil(total/POR_PAGINA))};
}

// Solicitações do lado da equipe.
const solLinha=r=>({id:r.id,tipo:r.kind,assunto:r.subject,status:r.status,criada:iso(r.created_at),atualizada:iso(r.updated_at),briefing:r.briefing||null,empresa:{id:r.business_id,nome:r.business_name},version:r.version});
export async function listarSolicitacoes(db,url) {
  const status=filtro(url,'status'),empresa=filtro(url,'empresa'),q=filtro(url,'q');
  const rows=(await db.query('SELECT r.*,b.name AS business_name FROM requests r JOIN businesses b ON b.id=r.business_id ORDER BY r.updated_at DESC')).rows;
  return lista(rows.filter(r=>(!status||r.status===status)&&(!empresa||r.business_id===empresa)&&casa(q,r.subject,r.business_name)).map(solLinha),url);
}
async function pedido(db,id){const r=(await db.query('SELECT r.*,b.name AS business_name FROM requests r JOIN businesses b ON b.id=r.business_id WHERE r.id=$1',[id])).rows[0];if(!r)throw fail('Solicitação não encontrada.',404);return r;}
export async function obterSolicitacao(db,id){const r=await pedido(db,id);return {...await solicitacaoEmpresa(db,r.business_id,id),empresa:{id:r.business_id,nome:r.business_name},version:r.version};}
export async function responderEquipe(db,{id,p,session,ip,now=new Date()}) {
  const r=await pedido(db,id);
  const m=await responderSolicitacao(db,{id:r.business_id,sol:id,p,session,ip,lado:'equipe',now});
  await db.query('UPDATE requests SET version=version+1 WHERE id=$1',[id]);
  return m;
}
export async function statusSolicitacao(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['status','version']);const version=needVersion(p);
  if(!['aberta','em-andamento','respondida','fechada'].includes(p.status))throw fail('Status: aberta, em-andamento, respondida ou fechada.',422,'status');
  return db.transaction(async tx=>{
    const r=(await tx.query('SELECT * FROM requests WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!r)throw fail('Solicitação não encontrada.',404);if(r.version!==version)throw conflito();
    await tx.query('UPDATE requests SET status=$2,updated_at=$3,version=version+1 WHERE id=$1',[id,p.status,now.toISOString()]);
    await audit(tx,{actor:session.user_id,business:r.business_id,action:'solicitacao_status',resource:id,before:{status:r.status},after:{status:p.status},ip});
    return obterSolicitacao(tx,id);
  });
}
