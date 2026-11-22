import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from './lib/erros.mjs';
import { audit } from './lib/auditoria.mjs';
import { textoConvite, textoConviteWhatsapp, textoRecuperacao } from './lib/email.mjs';
import { MAX_BYTES, LARGURAS } from './lib/imagens.mjs';
import { login, cadastrar, excluirConta, sessionCookie, endSessions, issueToken, ensureUser, hasPassword, useToken, limit, sameSecret, validEmail, digest, isDemoEmail, DEMO_PROTECTED_MSG } from './auth.mjs';
import { acessoA, exigir, PAPEIS } from './permissoes.mjs';
import * as P from './data/painel.mjs';
import { avaliar } from './data/avaliacoes.mjs';
import { coletar, meusCupons, cuponsEmpresa, criarCupom, editarCupom, pausarCupom, removerCupom } from './data/cupons.mjs';

// APIs de conta e do painel (contrato 12.4). Devolve true quando a rota é daqui.
const rejectExtra=(p,keys)=>{const extra=Object.keys(p).find(k=>!keys.includes(k));if(extra)throw fail('Campo não permitido.',422,extra);};
const ESCRITA=['POST','PATCH','DELETE'];

export async function contaAPI(ctx) {
  const {db,req,res,path,method,ip,now,origin,secure,mailer,send}=ctx;
  if(path==='/api/auth/login'&&method==='POST') {
    const p=await ctx.body();rejectExtra(p,['email','senha']);
    const r=await login(db,{email:p.email,senha:p.senha,ip,userAgent:req.headers['user-agent']||'',now});
    res.setHeader('Set-Cookie',sessionCookie(r.session.value,{secure}));
    return send(200,{csrf:r.session.csrf,usuario:r.usuario}),true;
  }
  // Pedido de link: resposta sempre igual, exista a conta ou não. Sem provedor de e-mail, nada é enviado.
  if(path==='/api/auth/reset'&&method==='POST') {
    const p=await ctx.body();rejectExtra(p,['email']);
    await limit(db,`reset-ip:${ip}`,5,15*60000,now);
    const mail=typeof p.email==='string'?p.email.trim().toLowerCase():'';
    if(!validEmail(mail))throw fail('Informe um e-mail válido.',422,'email');
    if(isDemoEmail(mail))throw fail(DEMO_PROTECTED_MSG,403);
    const user=(await db.query('SELECT id,email FROM users WHERE email=$1 AND disabled=false',[mail])).rows[0];
    let enviado=false;
    if(user&&mailer) {
      const {value}=await issueToken(db,{kind:'recuperacao',userId:user.id,now});
      enviado=await mailer({to:user.email,subject:'Sua nova senha no Nexus',text:textoRecuperacao({link:`${origin}/entrar/definir-senha?token=${value}`})});
    }
    await audit(db,{actor:user?.id||null,action:'recuperacao_pedida',resource:mail,after:{email:mail,enviado},ip});
    return send(200,{ok:true}),true;
  }
  if(path==='/api/auth/senha'&&method==='POST') {
    const p=await ctx.body();rejectExtra(p,['token','senha']);
    return send(200,await useToken(db,{value:p.token,senha:p.senha,ip,now})),true;
  }
  // Conta de usuário (14.4): a pessoa cria a conta e já sai logada.
  if(path==='/api/auth/cadastro'&&method==='POST') {
    const p=await ctx.body();rejectExtra(p,['nome','email','senha','aceite']);
    const r=await cadastrar(db,{...p,ip,userAgent:req.headers['user-agent']||'',now});
    res.setHeader('Set-Cookie',sessionCookie(r.session.value,{secure}));
    return send(201,{csrf:r.session.csrf,usuario:r.usuario}),true;
  }
  if(!/^\/api\/(auth\/logout|me(\/sessoes|\/cupons)?|painel\/.*|cupons\/[^/]+\/coletar|empresas\/[^/]+\/avaliacoes)$/.test(path))return false;
  const session=await ctx.session();
  if(!session)throw fail('Sua sessão terminou. Entre de novo.',401);
  if(ESCRITA.includes(method)&&!sameSecret(req.headers['x-csrf-token'],session.csrf))throw fail('Verificação da sessão falhou. Recarregue a página.',403);
  if(path==='/api/auth/logout'&&method==='POST') {
    await db.query('DELETE FROM sessions WHERE token_hash=$1',[session.token_hash]);
    await audit(db,{actor:session.user_id,action:'logout',resource:session.user_id,ip});
    res.setHeader('Set-Cookie',sessionCookie('',{secure,clear:true}));
    return send(200,{ok:true}),true;
  }
  if(path==='/api/me'&&method==='GET')return send(200,await meVM(db,session)),true;
  if(path==='/api/me'&&method==='PATCH') {
    const p=await ctx.body();rejectExtra(p,['nome']);
    const nome=typeof p.nome==='string'?p.nome.trim().replace(/\s+/g,' '):'';
    if(nome.length<2||nome.length>80)throw fail('Informe o seu nome (de 2 a 80 caracteres).',422,'nome');
    if(isDemoEmail(session.email))throw fail(DEMO_PROTECTED_MSG,403);
    await db.query('UPDATE users SET name=$2,version=version+1 WHERE id=$1',[session.user_id,nome]);
    await audit(db,{actor:session.user_id,action:'nome_alterado',resource:session.user_id,before:{nome:session.name},after:{nome},ip});
    return send(200,{usuario:{id:session.user_id,email:session.email,nome,tipo:session.tipo}}),true;
  }
  if(path==='/api/me'&&method==='DELETE') {
    const p=await ctx.body();rejectExtra(p,['senha']);
    await excluirConta(db,{session,senha:p.senha,ip,now});
    res.setHeader('Set-Cookie',sessionCookie('',{secure,clear:true}));
    return send(200,{ok:true}),true;
  }
  if(path==='/api/me/cupons'&&method==='GET')return send(200,await meusCupons(db,session.user_id,now)),true;
  // Avaliação de morador (18.4): com sessão e CSRF; entra pendente na fila.
  const av=/^\/api\/empresas\/([a-z0-9][a-z0-9-]{0,99})\/avaliacoes$/.exec(path);
  if(av&&method==='POST')return send(201,await avaliar(db,{slug:av[1],p:await ctx.body(),session,ip,now})),true;
  if(path.startsWith('/api/empresas/'))throw fail('Endpoint não encontrado.',404);
  const col=/^\/api\/cupons\/([a-f0-9]{12})\/coletar$/.exec(path);
  if(col&&method==='POST')return send(200,await coletar(db,{id:col[1],session,now})),true;
  if(path.startsWith('/api/cupons/'))throw fail('Cupom não encontrado.',404);
  if(path==='/api/me/sessoes'&&method==='GET') {
    const rows=(await db.query('SELECT id,created_at,last_seen_at,user_agent FROM sessions WHERE user_id=$1 AND expires_at>$2 ORDER BY last_seen_at DESC',[session.user_id,now.toISOString()])).rows;
    return send(200,rows.map(r=>({id:r.id,atual:r.id===session.id,criada:new Date(r.created_at).toISOString(),ultimoUso:new Date(r.last_seen_at).toISOString(),navegador:resumoNavegador(r.user_agent)}))),true;
  }
  if(path==='/api/me/sessoes'&&method==='DELETE') {
    await endSessions(db,session.user_id,{except:session.id});
    await audit(db,{actor:session.user_id,action:'sessoes_encerradas',resource:session.user_id,ip});
    return send(200,{ok:true}),true;
  }
  const m=/^\/api\/painel\/empresas\/([a-z0-9][a-z0-9-]*)(?:\/(.+))?$/.exec(path);
  if(!m)throw fail('Endpoint não encontrado.',404);
  const [,id,resto='']=m,acesso=await acessoA(db,session,id);
  exigir(acesso,'ver');
  const op={id,session,ip,now};
  const ver=()=>exigir(acesso,'ver'),precisa=acao=>exigir(acesso,acao);
  let x;
  if(resto===''&&method==='GET'){ver();return send(200,await P.resumoEmpresa(db,acesso,now)),true;}
  if(resto===''&&method==='PATCH'){precisa('perfil');return send(200,await P.atualizarPerfil(db,{...op,p:await ctx.body()})),true;}
  if(resto==='perfil'&&method==='GET')return send(200,await P.perfilEmpresa(db,id)),true;
  if(resto==='fotos'&&method==='POST') {
    precisa('perfil');
    const alt=ctx.url.searchParams.get('alt')||'';
    return send(201,await P.enviarFoto(db,{...op,buf:await ctx.raw(MAX_BYTES),declarado:req.headers['content-type']||'',alt,dir:ctx.mediaDir})),true;
  }
  if((x=/^fotos\/([a-z0-9-]+)$/.exec(resto))&&method==='DELETE'){precisa('perfil');return send(200,await P.removerFoto(db,{...op,foto:x[1],dir:ctx.mediaDir})),true;}
  if(resto==='catalogo'&&method==='GET')return send(200,await P.catalogoEmpresa(db,id)),true;
  if(resto==='catalogo'&&method==='POST'){precisa('catalogo');return send(201,await P.criarItem(db,{...op,p:await ctx.body()})),true;}
  if((x=/^catalogo\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,79})$/.exec(resto))&&method==='DELETE'){precisa('catalogo');return send(200,await P.removerItem(db,{...op,itemId:x[1]})),true;}
  if((x=/^catalogo\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,79})$/.exec(resto))&&method==='PATCH'){precisa('catalogo');return send(200,await P.editarItem(db,{...op,itemId:x[1],p:await ctx.body()})),true;}
  if((x=/^catalogo\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,79})\/(enviar|pausar|reativar)$/.exec(resto))&&method==='POST'){precisa('catalogo');return send(200,await P.transicaoItem(db,{...op,itemId:x[1],acao:x[2],p:await ctx.body()})),true;}
  if(resto==='cupons'&&method==='GET')return send(200,await cuponsEmpresa(db,id,now)),true;
  if(resto==='cupons'&&method==='POST'){precisa('cupons');return send(201,await criarCupom(db,{...op,p:await ctx.body()})),true;}
  if((x=/^cupons\/([a-f0-9]{12})$/.exec(resto))&&method==='PATCH'){precisa('cupons');return send(200,await editarCupom(db,{...op,cupom:x[1],p:await ctx.body()})),true;}
  if((x=/^cupons\/([a-f0-9]{12})$/.exec(resto))&&method==='DELETE'){precisa('cupons');return send(200,await removerCupom(db,{...op,cupom:x[1]})),true;}
  if((x=/^cupons\/([a-f0-9]{12})\/(pausar|reativar)$/.exec(resto))&&method==='POST'){precisa('cupons');return send(200,await pausarCupom(db,{...op,cupom:x[1],acao:x[2],p:await ctx.body()})),true;}
  if(resto==='metricas'&&method==='GET')return send(200,await P.metricasEmpresa(db,id,ctx.url.searchParams.get('periodo')||'30d',now)),true;
  if(resto==='relatorio'&&method==='GET')return send(200,await P.relatorioEmpresa(db,id,ctx.url.searchParams.get('mes')||'',now)),true;
  if(resto==='solicitacoes'&&method==='GET')return send(200,await P.solicitacoesEmpresa(db,id)),true;
  if(resto==='solicitacoes'&&method==='POST'){precisa('solicitar');return send(201,await P.abrirSolicitacao(db,{...op,p:await ctx.body()})),true;}
  if((x=/^solicitacoes\/([a-f0-9-]{36})$/.exec(resto))&&method==='GET')return send(200,await P.solicitacaoEmpresa(db,id,x[1])),true;
  if((x=/^solicitacoes\/([a-f0-9-]{36})\/mensagens$/.exec(resto))&&method==='POST'){precisa('solicitar');return send(201,await P.responderSolicitacao(db,{...op,sol:x[1],p:await ctx.body()})),true;}
  if((x=/^solicitacoes\/([a-f0-9-]{36})\/fechar$/.exec(resto))&&method==='POST'){precisa('solicitar');return send(200,await P.fecharSolicitacao(db,{...op,sol:x[1]})),true;}
  if(resto==='acessos'&&method==='GET'){precisa('acessos');return send(200,await P.acessosEmpresa(db,id,now)),true;}
  if(resto==='acessos'&&method==='POST'){precisa('acessos');return send(201,await convidar(db,{...op,p:await ctx.body(),empresa:acesso.empresa,mailer,origin})),true;}
  if((x=/^acessos\/convites\/(cancelar|reenviar)$/.exec(resto))&&method==='POST') {
    precisa('acessos');const p=await ctx.body();
    if(x[1]==='cancelar')return send(200,await cancelarConvite(db,{...op,p})),true;
    return send(201,await reenviarConvite(db,{...op,p,empresa:acesso.empresa,mailer,origin,comWhatsapp:Boolean(acesso.equipe)})),true;
  }
  if((x=/^acessos\/([a-f0-9-]{36})$/.exec(resto))&&method==='PATCH'){precisa('acessos');return send(200,await mudarPapel(db,{...op,usuario:x[1],p:await ctx.body()})),true;}
  if((x=/^acessos\/([a-f0-9-]{36})$/.exec(resto))&&method==='DELETE'){precisa('acessos');return send(200,await revogar(db,{...op,usuario:x[1]})),true;}
  throw fail('Endpoint não encontrado.',404);
}

export async function meVM(db,session) {
  const empresas=(await db.query('SELECT b.id,b.slug,b.name,m.role FROM memberships m JOIN businesses b ON b.id=m.business_id WHERE m.user_id=$1 AND m.active=true ORDER BY b.name',[session.user_id])).rows;
  return {usuario:{id:session.user_id,email:session.email,nome:session.name||'',tipo:session.tipo},csrf:session.csrf,empresas:empresas.map(e=>({id:e.id,slug:e.slug,name:e.name,papel:e.role})),equipe:session.staff_role||null};
}
const resumoNavegador=ua=>{
  const s=String(ua||''),nav=/Edg\//.test(s)?'Edge':/OPR\//.test(s)?'Opera':/Chrome\//.test(s)?'Chrome':/Firefox\//.test(s)?'Firefox':/Safari\//.test(s)?'Safari':'Navegador';
  const so=/Android/.test(s)?'Android':/iPhone|iPad/.test(s)?'iOS':/Windows/.test(s)?'Windows':/Mac OS X/.test(s)?'macOS':/Linux/.test(s)?'Linux':'';
  return so?`${nav} no ${so}`:nav;
};

// Sem o e-mail, a equipe manda o convite pelo WhatsApp da empresa (contrato 21.3): o link da conversa com a mensagem pronta e
// o link do convite. Ele é uma credencial: só volta na resposta, para quem tem a ação acessos, e não vai para a auditoria.
const validadeDe=expires=>expires.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
async function whatsappConvite(db,{id,empresa,papel,link,expires}) {
  const numero=(await db.query("SELECT details->>'whatsapp' AS w FROM businesses WHERE id=$1",[id])).rows[0]?.w||'';
  if(!/^\d{10,15}$/.test(numero))return '';
  return `https://wa.me/${numero}?text=${encodeURIComponent(textoConviteWhatsapp({empresa:empresa.name,papel,link,validade:validadeDe(expires)}))}`;
}
// Convite: conta nova (ou sem senha) recebe link de uso único; conta com senha ganha o acesso na hora. comWhatsapp: o
// convite da equipe (v0.21.0), que ganha o whatsapp quando o e-mail não sai.
export async function convidar(db,{id,p,session,ip,now,empresa,mailer,origin,comWhatsapp=false}) {
  rejectExtra(p,['email','papel']);
  if(!PAPEIS.includes(p.papel))throw fail('Escolha o papel: dono, editor, financeiro ou leitura.',422,'papel');
  await limit(db,`convite:${session.user_id}`,30,3600000,now);
  const u=await ensureUser(db,p.email);
  if(u.disabled)throw fail('Esta conta está desativada. Fale com o Nexus.',422,'email');
  if((await db.query('SELECT 1 FROM memberships WHERE user_id=$1 AND business_id=$2 AND active=true',[u.id,id])).rows.length)throw fail('Esta pessoa já tem acesso a esta empresa.',422,'email');
  if(hasPassword(u)) {
    await db.query(`INSERT INTO memberships(user_id,business_id,role,active,invited_by) VALUES($1,$2,$3,true,$4)
      ON CONFLICT(user_id,business_id) DO UPDATE SET role=excluded.role,active=true,invited_by=excluded.invited_by`,[u.id,id,p.papel,session.user_id]);
    await audit(db,{actor:session.user_id,business:id,action:'acesso_concedido',resource:u.id,after:{email:u.email,papel:p.papel},ip});
    const enviado=mailer?await mailer({to:u.email,subject:`Você agora cuida de ${empresa.name} no Nexus`,text:`Olá!\n\nVocê recebeu acesso à empresa ${empresa.name} no Nexus, com o papel "${p.papel}".\n\nEntre em ${origin}/entrar para ver o painel.\n\nNexus`}):false;
    return {email:u.email,papel:p.papel,expira:null,link:'',enviado,ativo:true,whatsapp:''};
  }
  const {value,expires}=await issueToken(db,{kind:'convite',userId:u.id,businessId:id,role:p.papel,createdBy:session.user_id,now});
  const link=`${origin}/entrar/definir-senha?token=${value}`;
  const enviado=mailer?await mailer({to:u.email,subject:`Convite para cuidar de ${empresa.name} no Nexus`,
    text:textoConvite({empresa:empresa.name,papel:p.papel,link,validade:validadeDe(expires)})}):false;
  await audit(db,{actor:session.user_id,business:id,action:'convite_criado',resource:u.id,after:{email:u.email,papel:p.papel,enviado},ip});
  return {email:u.email,papel:p.papel,expira:expires.toISOString(),link:enviado?'':link,enviado,ativo:false,
    whatsapp:!enviado&&comWhatsapp?await whatsappConvite(db,{id,empresa,papel:p.papel,link,expires}):''};
}
// Convite pendente (link não usado e no prazo) de um e-mail nesta empresa.
async function convitePendente(db,{id,p,now}) {
  rejectExtra(p,['email']);
  const mail=typeof p.email==='string'?p.email.trim().toLowerCase():'';
  const row=(await db.query(`SELECT t.token_hash,t.role,t.user_id,u.email FROM access_tokens t JOIN users u ON u.id=t.user_id WHERE t.business_id=$1 AND t.kind='convite' AND u.email=$2
    AND t.used_at IS NULL AND t.expires_at>$3 ORDER BY t.created_at DESC LIMIT 1`,[id,mail,now.toISOString()])).rows[0];
  if(!row)throw fail('Não há convite pendente para este e-mail.',404);
  return row;
}
async function cancelarConvite(db,{id,p,session,ip,now}) {
  const c=await convitePendente(db,{id,p,now});
  await db.query("UPDATE access_tokens SET used_at=$3 WHERE business_id=$1 AND user_id=$2 AND kind='convite' AND used_at IS NULL",[id,c.user_id,now.toISOString()]);
  await audit(db,{actor:session.user_id,business:id,action:'convite_cancelado',resource:c.user_id,before:{email:c.email,papel:c.role},ip});
  return {ok:true};
}
// Reenviar: o link anterior deixa de valer e sai um novo, de 7 dias, com o mesmo papel. comWhatsapp: quem reenvia é da equipe.
async function reenviarConvite(db,{id,p,session,ip,now,empresa,mailer,origin,comWhatsapp=false}) {
  const c=await convitePendente(db,{id,p,now});
  await db.query("UPDATE access_tokens SET used_at=$3 WHERE business_id=$1 AND user_id=$2 AND kind='convite' AND used_at IS NULL",[id,c.user_id,now.toISOString()]);
  const {value,expires}=await issueToken(db,{kind:'convite',userId:c.user_id,businessId:id,role:c.role,createdBy:session.user_id,now});
  const link=`${origin}/entrar/definir-senha?token=${value}`;
  const enviado=mailer?await mailer({to:c.email,subject:`Convite para cuidar de ${empresa.name} no Nexus`,
    text:textoConvite({empresa:empresa.name,papel:c.role,link,validade:validadeDe(expires)})}):false;
  await audit(db,{actor:session.user_id,business:id,action:'convite_reenviado',resource:c.user_id,after:{email:c.email,papel:c.role,enviado},ip});
  return {email:c.email,papel:c.role,expira:expires.toISOString(),link:enviado?'':link,enviado,ativo:false,
    whatsapp:!enviado&&comWhatsapp?await whatsappConvite(db,{id,empresa,papel:c.role,link,expires}):''};
}
const donosAtivos=async(tx,id)=>(await tx.query("SELECT user_id FROM memberships WHERE business_id=$1 AND role='dono' AND active=true",[id])).rows.map(r=>r.user_id);
async function mudarPapel(db,{id,usuario,p,session,ip}) {
  rejectExtra(p,['papel']);
  if(!PAPEIS.includes(p.papel))throw fail('Escolha o papel: dono, editor, financeiro ou leitura.',422,'papel');
  if(usuario===session.user_id)throw fail('Você não pode mudar o próprio papel.',403);
  return db.transaction(async tx=>{
    const atual=(await tx.query('SELECT m.role,u.email,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.user_id=$1 AND m.business_id=$2 AND m.active=true FOR UPDATE',[usuario,id])).rows[0];
    if(!atual)throw fail('Pessoa não encontrada nesta empresa.',404);
    if(isDemoEmail(atual.email))throw fail(DEMO_PROTECTED_MSG,403);
    if(atual.role==='dono'&&p.papel!=='dono'&&(await donosAtivos(tx,id)).length<2)throw fail('A empresa precisa de pelo menos um dono.',422,'papel');
    await tx.query('UPDATE memberships SET role=$3 WHERE user_id=$1 AND business_id=$2',[usuario,id,p.papel]);
    await audit(tx,{actor:session.user_id,business:id,action:'papel_alterado',resource:usuario,before:{papel:atual.role},after:{papel:p.papel},ip});
    return {usuario:{id:usuario,email:atual.email,nome:atual.name},papel:p.papel,ativo:true};
  });
}
// Revogar: tira o vínculo e encerra todas as sessões da pessoa (ela entra de novo só com os acessos que restarem).
export async function revogar(db,{id,usuario,session,ip}) {
  if(usuario===session.user_id)throw fail('Você não pode revogar o próprio acesso.',403);
  return db.transaction(async tx=>{
    const atual=(await tx.query('SELECT role FROM memberships WHERE user_id=$1 AND business_id=$2 AND active=true FOR UPDATE',[usuario,id])).rows[0];
    if(!atual)throw fail('Pessoa não encontrada nesta empresa.',404);
    if(isDemoEmail(atual.email))throw fail(DEMO_PROTECTED_MSG,403);
    if(atual.role==='dono'&&(await donosAtivos(tx,id)).length<2)throw fail('A empresa precisa de pelo menos um dono.',422,'usuario');
    await tx.query('UPDATE memberships SET active=false WHERE user_id=$1 AND business_id=$2',[usuario,id]);
    await tx.query("UPDATE access_tokens SET used_at=now() WHERE user_id=$1 AND business_id=$2 AND kind='convite' AND used_at IS NULL",[usuario,id]);
    await tx.query('DELETE FROM sessions WHERE user_id=$1',[usuario]);
    await audit(tx,{actor:session.user_id,business:id,action:'acesso_revogado',resource:usuario,before:{papel:atual.role},after:{ativo:false},ip});
    return {ok:true};
  });
}

// /midia/<id>/<largura>.webp: aprovada é pública; pendente ou recusada só para quem cuida da empresa e para a equipe.
export async function midia(db,{path,session,dir}) {
  const m=/^\/midia\/([a-f0-9]{32})\/(\d+)\.webp$/.exec(path);
  if(!m||!LARGURAS.includes(Number(m[2])))return null;
  const row=(await db.query("SELECT id,business_id,status FROM media WHERE id=$1 AND status<>'removida'",[m[1]])).rows[0];
  if(!row)return null;
  const publica=row.status==='aprovada';
  if(!publica){const a=session&&row.business_id?await acessoA(db,session,row.business_id):null;if(!a&&!session?.staff_role)return null;}
  try{return {bytes:await readFile(join(dir,m[1],`${m[2]}.webp`)),publica,etag:`"${digest(m[1]+m[2]).slice(0,20)}"`};}catch{return null;}
}
