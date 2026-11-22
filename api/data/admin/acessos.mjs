import { collator } from '../../lib/saneamento.mjs';
import { PODE_EQUIPE } from '../../admin-api.mjs';
import { pode } from '../../permissoes.mjs';
import { iso, lista, filtro, casa, STATUS_PT } from './comum.mjs';

// Acessos dos anunciantes ao painel (contrato 21, v0.21.0): cada empresa com a situação de acesso, os membros ativos e os
// convites, para a equipe convidar a partir da lista. A lista nunca traz o link nem o token de um convite: só a validade.
export const SITUACOES=['sem-conta','convite-pendente','convite-vencido','com-acesso'];
const CONTAGEM={'sem-conta':'semConta','convite-pendente':'convitePendente','convite-vencido':'conviteVencido','com-acesso':'comAcesso'};
const whatsappDe=v=>/^\d{10,15}$/.test(v||'')?v:'';

export async function listarAcessos(db,url,{equipe,now=new Date()}) {
  const q=filtro(url,'q'),empresa=filtro(url,'empresa'),pedida=filtro(url,'situacao'),situacao=SITUACOES.includes(pedida)?pedida:'';
  const empresas=(await db.query('SELECT id,name,status,district,details FROM businesses')).rows
    .filter(b=>(!empresa||b.id===empresa)&&casa(q,b.name,b.id)).sort((a,b)=>collator.compare(a.name,b.name)||a.id.localeCompare(b.id));
  // Membros ativos com a conta ativa; convites não usados (o cancelado e o aceito já têm used_at).
  const membros=(await db.query(`SELECT m.business_id,m.role,m.created_at,u.id,u.email,u.name FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE m.active=true AND NOT u.disabled ORDER BY u.email`)).rows;
  const tokens=(await db.query(`SELECT t.business_id,t.role,t.expires_at,u.email FROM access_tokens t JOIN users u ON u.id=t.user_id
    WHERE t.kind='convite' AND t.used_at IS NULL ORDER BY t.created_at DESC`)).rows;
  const agora=now.getTime();
  const itens=empresas.map(b=>{
    const m=membros.filter(r=>r.business_id===b.id),vistos=new Set(m.map(r=>r.email));
    // O último convite não usado de cada e-mail, do mais novo para o mais velho; o de quem já é membro não diz mais nada.
    const convites=tokens.filter(t=>t.business_id===b.id&&!vistos.has(t.email)&&vistos.add(t.email))
      .map(t=>({email:t.email,papel:t.role,expira:iso(t.expires_at),vencido:new Date(t.expires_at).getTime()<=agora}));
    const situacaoDe=m.length?'com-acesso':convites.some(c=>!c.vencido)?'convite-pendente':convites.length?'convite-vencido':'sem-conta';
    const d=b.details||{},email=typeof d.email==='string'?d.email.trim().toLowerCase():'';
    return {empresa:{id:b.id,nome:b.name,status:STATUS_PT[b.status]||b.status,bairro:b.district||''},situacao:situacaoDe,
      contato:{email,whatsapp:whatsappDe(d.whatsapp)},
      membros:m.map(r=>({usuario:{id:r.id,email:r.email,nome:r.name||''},papel:r.role,desde:iso(r.created_at)})),
      convites,convite:{email,papel:'dono'}};
  });
  const contagem=Object.fromEntries(SITUACOES.map(s=>[CONTAGEM[s],itens.filter(i=>i.situacao===s).length]));
  // Convidar é a ação acessos do admin; reenviar e cancelar usam as rotas do painel (12.6), que na equipe são só do admin.
  const painel=pode(null,equipe,'acessos'),acoes={convidar:PODE_EQUIPE.acessos.includes(equipe),reenviar:painel,cancelar:painel};
  return {...lista(situacao?itens.filter(i=>i.situacao===situacao):itens,url),contagem,acoes};
}
