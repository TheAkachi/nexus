import { randomBytes, randomUUID, createHash, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fail } from './lib/erros.mjs';
import { audit } from './lib/auditoria.mjs';

// Contas, sessão, CSRF, limites de tentativa e links de uso único (contrato 12.2).
const scrypt=promisify(rawScrypt);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export const COOKIE='nexus_sessao';
export const INATIVIDADE_MS=60*60000,DURACAO_MS=12*3600000;
export const VALIDADE={convite:7*86400000,recuperacao:3600000};
export const SEM_SENHA='!sem-senha';
export const validEmail=v=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const validPassword=v=>typeof v==='string'&&v.length>=12&&v.length<=128;

// Senha com scrypt; os parâmetros ficam no próprio hash: scrypt$N$r$p$sal$chave (base64url).
const PARAMS={N:32768,r:8,p:1};
const derive=(password,salt,{N,r,p})=>scrypt(password,salt,64,{N,r,p,maxmem:256*N*r});
export async function hashPassword(password,params=PARAMS) {
  if(!validPassword(password))throw fail('A senha precisa ter de 12 a 128 caracteres.',422,'senha');
  const salt=randomBytes(16),key=await derive(password,salt,params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
// Aceita também o formato antigo do protótipo (sal hex:chave hex, com N=32768, r=8, p=1).
function parseHash(stored) {
  const m=/^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]+)\$([\w-]+)$/.exec(stored||'');
  if(m)return {params:{N:+m[1],r:+m[2],p:+m[3]},salt:Buffer.from(m[4],'base64url'),key:Buffer.from(m[5],'base64url'),current:+m[1]===PARAMS.N&&+m[2]===PARAMS.r&&+m[3]===PARAMS.p};
  const old=/^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored||'');
  return old?{params:PARAMS,salt:old[1],key:Buffer.from(old[2],'hex'),current:false}:null;
}
const DUMMY=`scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;
export async function verifyPassword(password,stored) {
  if(typeof password!=='string'||password.length>128)return {ok:false};
  const h=parseHash(stored);
  // Conta sem senha ou inexistente: calcula assim mesmo, para o tempo de resposta não revelar a conta.
  const key=await derive(password,h?.salt??Buffer.alloc(16),h?.params??PARAMS);
  const ok=Boolean(h)&&key.length===h.key.length&&timingSafeEqual(key,h.key);
  return {ok,rehash:ok&&!h.current};
}
export const sameSecret=(a,b)=>{const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);};

// Limite por chave (IP real, conta ou e-mail) numa janela; guarda só o hash da chave.
export async function hit(db,key,windowMs,now=new Date()) {
  await db.query('DELETE FROM rate_limits WHERE reset_at<$1',[now.toISOString()]);
  return (await db.query('INSERT INTO rate_limits(key_hash,count,reset_at) VALUES($1,1,$2) ON CONFLICT(key_hash) DO UPDATE SET count=rate_limits.count+1 RETURNING count',[digest(key),new Date(now.getTime()+windowMs).toISOString()])).rows[0].count;
}
const peek=async(db,key,now)=>(await db.query('SELECT count FROM rate_limits WHERE key_hash=$1 AND reset_at>=$2',[digest(key),now.toISOString()])).rows[0]?.count||0;
const clear=(db,key)=>db.query('DELETE FROM rate_limits WHERE key_hash=$1',[digest(key)]);
export async function limit(db,key,max,windowMs,now) {if(await hit(db,key,windowMs,now)>max)throw fail('Muitas tentativas. Tente de novo em alguns minutos.',429);}

// Sessão: o cookie leva o valor; o banco guarda só o hash, o csrf e um id público para listar e encerrar.
export async function newSession(db,userId,{userAgent='',now=new Date()}={}) {
  const value=token(),csrf=token(),id=randomUUID();
  await db.query('DELETE FROM sessions WHERE expires_at<=$1 OR last_seen_at<=$2',[now.toISOString(),new Date(now.getTime()-INATIVIDADE_MS).toISOString()]);
  await db.query('INSERT INTO sessions(token_hash,id,user_id,csrf,expires_at,created_at,last_seen_at,user_agent) VALUES($1,$2,$3,$4,$5,$6,$6,$7)',
    [digest(value),id,userId,csrf,new Date(now.getTime()+DURACAO_MS).toISOString(),now.toISOString(),String(userAgent).slice(0,160)]);
  return {value,csrf,id};
}
export function cookieValue(header='') {
  const value=String(header).split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  return value&&/^[a-f0-9]{64}$/.test(value)?value:null;
}
// Sessão válida: dentro das 12 h, usada nos últimos 60 min e de conta ativa. Renova o último uso a cada minuto.
export async function sessionFor(db,header,now=new Date()) {
  const value=cookieValue(header);if(!value)return null;
  const row=(await db.query(`SELECT s.id,s.user_id,s.csrf,s.token_hash,s.last_seen_at,u.email,u.name,u.staff_role,u.kind,
    EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.active) AS vinculo FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>$2 AND s.last_seen_at>$3 AND u.disabled=false`,[digest(value),now.toISOString(),new Date(now.getTime()-INATIVIDADE_MS).toISOString()])).rows[0];
  if(!row)return null;
  if(now.getTime()-new Date(row.last_seen_at).getTime()>60000)await db.query('UPDATE sessions SET last_seen_at=$1 WHERE token_hash=$2',[now.toISOString(),row.token_hash]);
  return {...row,tipo:tipoConta(row)};
}
// Tipo da conta (contrato 14.1): equipe, afiliado (conta de associado ou com vínculo ativo) ou usuário.
export const tipoConta=u=>u.staff_role?'equipe':u.kind==='associado'||u.vinculo?'afiliado':'usuario';
export const sessionCookie=(value,{secure=false,clear=false}={})=>`${COOKIE}=${clear?'':value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear?0:DURACAO_MS/1000}${secure?'; Secure':''}`;
export const endSessions=(db,userId,{except=null}={})=>db.query('DELETE FROM sessions WHERE user_id=$1 AND ($2::text IS NULL OR id<>$2)',[userId,except]);

// Login: até 20 tentativas por IP real e 5 falhas por conta em 15 min; mesma resposta para conta inexistente.
export async function login(db,{email,senha,ip,userAgent,now=new Date()}) {
  const mail=typeof email==='string'?email.trim().toLowerCase():'';
  await limit(db,`login-ip:${ip}`,20,15*60000,now);
  if(await peek(db,`login-conta:${mail}`,now)>=5){await audit(db,{action:'login_bloqueado',resource:mail,after:{email:mail},ip});throw fail('Muitas tentativas. Tente de novo em alguns minutos.',429);}
  const user=validEmail(mail)?(await db.query(`SELECT id,email,name,password_hash,staff_role,kind,EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=users.id AND m.active) AS vinculo
    FROM users WHERE email=$1 AND disabled=false`,[mail])).rows[0]:null;
  const {ok,rehash}=await verifyPassword(senha,user?.password_hash||DUMMY);
  if(!user||!ok) {
    await hit(db,`login-conta:${mail}`,15*60000,now);
    await audit(db,{actor:user?.id||null,action:'login_falha',resource:mail,after:{email:mail},ip});
    throw fail('E-mail ou senha incorretos.',401);
  }
  await clear(db,`login-conta:${mail}`);
  if(rehash)await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await hashPassword(senha),user.id]);
  const session=await newSession(db,user.id,{userAgent,now});
  await audit(db,{actor:user.id,action:'login',resource:user.id,ip});
  return {session,usuario:{id:user.id,email:user.email,nome:user.name,equipe:user.staff_role||null,tipo:tipoConta(user)}};
}

// Cadastro de usuário (14.4): a própria pessoa cria a conta e já sai logada. Até 5 contas por IP real em 1 hora.
export async function cadastrar(db,{nome,email,senha,aceite,ip,userAgent,now=new Date()}) {
  await limit(db,`cadastro-ip:${ip}`,5,3600000,now);
  const n=typeof nome==='string'?nome.trim().replace(/\s+/g,' '):'';
  if(n.length<2||n.length>80)throw fail('Informe o seu nome (de 2 a 80 caracteres).',422,'nome');
  const mail=typeof email==='string'?email.trim().toLowerCase():'';
  if(!validEmail(mail))throw fail('Informe um e-mail válido.',422,'email');
  if(aceite!==true)throw fail('Para criar a conta, aceite os termos e a política de privacidade.',422,'aceite');
  const hash=await hashPassword(senha),id=randomUUID();
  if((await db.query('SELECT 1 FROM users WHERE email=$1',[mail])).rows.length)throw fail('Este e-mail já tem conta. Entre ou recupere a senha.',422,'email');
  await db.query("INSERT INTO users(id,email,password_hash,name,kind,terms_accepted_at) VALUES($1,$2,$3,$4,'consumidor',$5)",[id,mail,hash,n,now.toISOString()]);
  await audit(db,{actor:id,action:'conta_criada',resource:id,after:{email:mail,tipo:'usuario'},ip});
  const session=await newSession(db,id,{userAgent,now});
  return {session,usuario:{id,email:mail,nome:n,equipe:null,tipo:'usuario'}};
}

// Excluir a própria conta (14.4): só a de usuário, com a senha. Apaga a conta e as coletas (sessões e coletas saem em cascata).
export async function excluirConta(db,{session,senha,ip,now=new Date()}) {
  if(session.tipo!=='usuario')throw fail('Para encerrar uma conta de afiliado ou da equipe, fale com o Nexus.',403);
  await limit(db,`excluir:${session.user_id}`,5,15*60000,now);
  const user=(await db.query('SELECT password_hash FROM users WHERE id=$1',[session.user_id])).rows[0];
  if(!(await verifyPassword(senha,user?.password_hash||DUMMY)).ok)throw fail('Senha incorreta.',422,'senha');
  await db.transaction(async tx=>{
    // As avaliações saem com a conta; os pedidos delas na fila deixam de esperar decisão (18.4).
    await tx.query("UPDATE approvals SET status='substituido' WHERE kind='avaliacao' AND status='pendente' AND resource_id IN (SELECT id FROM resident_reviews WHERE user_id=$1)",[session.user_id]);
    await tx.query('DELETE FROM users WHERE id=$1',[session.user_id]);
    await audit(tx,{actor:session.user_id,action:'conta_excluida',resource:session.user_id,ip});
  });
  return {ok:true};
}

// Conta sem senha (convite ou admin criado pelo CLI); o e-mail é a identidade.
export async function ensureUser(db,email,{kind='associado',name=''}={}) {
  const mail=String(email||'').trim().toLowerCase();
  if(!validEmail(mail))throw fail('Informe um e-mail válido.',422,'email');
  const found=(await db.query('SELECT id,email,name,password_hash,disabled FROM users WHERE email=$1',[mail])).rows[0];
  if(found)return found;
  const id=randomUUID();
  await db.query('INSERT INTO users(id,email,password_hash,name,kind) VALUES($1,$2,$3,$4,$5)',[id,mail,SEM_SENHA,String(name).slice(0,120),kind]);
  return {id,email:mail,name,password_hash:SEM_SENHA,disabled:false};
}
export const hasPassword=user=>Boolean(parseHash(user.password_hash));

// Link de uso único: convite (empresa e papel) ou recuperação. Um novo link de recuperação invalida os anteriores.
// validadeMs: prazo próprio (o convite da equipe vale 7 dias, como o de associado).
export async function issueToken(db,{kind,userId,businessId=null,role=null,createdBy=null,now=new Date(),validadeMs}) {
  const value=token(),expires=new Date(now.getTime()+(validadeMs||VALIDADE[kind]));
  if(kind==='recuperacao')await db.query("UPDATE access_tokens SET used_at=$2 WHERE user_id=$1 AND kind='recuperacao' AND used_at IS NULL",[userId,now.toISOString()]);
  await db.query('INSERT INTO access_tokens(token_hash,kind,user_id,business_id,role,created_by,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [digest(value),kind,userId,businessId,role,createdBy,now.toISOString(),expires.toISOString()]);
  return {value,expires};
}
export async function tokenInfo(db,value,now=new Date()) {
  if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))return null;
  return (await db.query(`SELECT t.kind,t.user_id,t.business_id,t.role,t.expires_at,u.email,b.name AS empresa,c.name AS criador_nome,c.email AS criador_email,c.staff_role AS criador_equipe,t.created_by
    FROM access_tokens t JOIN users u ON u.id=t.user_id LEFT JOIN businesses b ON b.id=t.business_id LEFT JOIN users c ON c.id=t.created_by
    WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>$2 AND u.disabled=false`,[digest(value),now.toISOString()])).rows[0]||null;
}
// Define a senha com o link: marca o link como usado (uma vez só), aceita o convite e encerra as sessões da conta.
export async function useToken(db,{value,senha,ip,now=new Date()}) {
  await limit(db,`senha-ip:${ip}`,10,15*60000,now);
  if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw fail('Este link não vale mais. Peça um novo.',422,'token');
  const hash=await hashPassword(senha);
  return db.transaction(async tx=>{
    const row=(await tx.query(`UPDATE access_tokens SET used_at=$2 WHERE token_hash=$1 AND used_at IS NULL AND expires_at>$2
      AND user_id IN (SELECT id FROM users WHERE disabled=false) RETURNING kind,user_id,business_id,role`,[digest(value),now.toISOString()])).rows[0];
    if(!row)throw fail('Este link não vale mais. Peça um novo.',422,'token');
    await tx.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,row.user_id]);
    await tx.query('DELETE FROM sessions WHERE user_id=$1',[row.user_id]);
    if(row.kind==='convite') {
      await tx.query(`INSERT INTO memberships(user_id,business_id,role,active) VALUES($1,$2,$3,true)
        ON CONFLICT(user_id,business_id) DO UPDATE SET role=excluded.role,active=true`,[row.user_id,row.business_id,row.role]);
      await audit(tx,{actor:row.user_id,business:row.business_id,action:'convite_aceito',resource:row.user_id,after:{papel:row.role},ip});
    }
    await audit(tx,{actor:row.user_id,action:'senha_definida',resource:row.user_id,after:{via:row.kind},ip});
    return {ok:true};
  });
}
