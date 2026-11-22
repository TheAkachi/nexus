import { createHash } from 'node:crypto';
import { fail } from './lib/erros.mjs';
import { localNow } from './lib/horario.mjs';
import { ESPACO_IDS } from './data/espacos.mjs';
import { somarEvento } from './data/metricas.mjs';

// Métrica pública e anônima: só registra eventos com consentimento explícito do visitante.
const digest=value=>createHash('sha256').update(value).digest('hex');
const rejectExtra=(p,keys)=>{if(Object.keys(p).some(k=>!keys.includes(k)))throw fail('Campo não permitido');};

// Eventos da v0.17.0 (contrato 18.8): cópia do código do cupom, atalho de categoria, filtro usado e mapa da busca aberto.
const NOMES=['business_viewed','contact_clicked','search_submitted','banner_viewed','banner_clicked','coupon_copied','shortcut_clicked','filter_used','map_opened'];
export async function ingestEvent(db,p,ip,now=new Date()) {
  rejectExtra(p,['event_id','name','session_id','business_id','campaign_id','channel','source','result_count','consent','slot','ref']);
  if(p.consent!==true||!NOMES.includes(p.name)||!/^[-a-zA-Z0-9_]{16,80}$/.test(p.event_id||'')||!/^[-a-zA-Z0-9_]{16,80}$/.test(p.session_id||''))throw fail('Evento inválido');
  if(p.source&&!['search','home','content','direct','campaign'].includes(p.source))throw fail('Origem inválida');
  if(p.channel&&!['phone','whatsapp','website','map','waze'].includes(p.channel))throw fail('Canal inválido');
  // ref: só no atalho (o slug do grupo) e no filtro (cupom).
  if(p.ref!==undefined&&(!['shortcut_clicked','filter_used'].includes(p.name)||typeof p.ref!=='string'||!/^[-a-z0-9]{1,60}$/.test(p.ref)))throw fail('Referência inválida');
  if(p.name==='shortcut_clicked'&&(!p.ref||p.source!=='home'))throw fail('Atalho inválido');
  if(p.name==='filter_used'&&p.ref!=='cupom')throw fail('Filtro inválido');
  if(p.name==='map_opened'&&p.source!=='search')throw fail('Origem inválida');
  if(p.name==='contact_clicked'&&!p.channel)throw fail('Canal obrigatório');
  if(p.name==='search_submitted'&&(!Number.isInteger(p.result_count)||p.result_count<0||p.result_count>100000))throw fail('Quantidade inválida');
  const needsBusiness=['business_viewed','contact_clicked','coupon_copied'].includes(p.name),needsCampaign=p.name.startsWith('banner_');
  if(needsBusiness&&!p.business_id||needsCampaign&&!p.campaign_id)throw fail('Referência obrigatória');
  // slot: o espaço do banner (contrato 11.5), só nos eventos de banner.
  if(p.slot!==undefined&&(!needsCampaign||!ESPACO_IDS.has(p.slot)))throw fail('Espaço inválido');
  if(p.business_id&&!(await db.query("SELECT id FROM businesses WHERE id=$1 AND status='published'",[p.business_id])).rows.length)throw fail('Empresa indisponível');
  // Banner publicado no período ou anúncio do Nexus (status 'house').
  if(p.campaign_id&&!(await db.query("SELECT id FROM campaigns WHERE id=$1 AND (status='house' OR status='published' AND (starts_at IS NULL OR starts_at<=$2) AND (ends_at IS NULL OR ends_at>$2))",[p.campaign_id,now.toISOString()])).rows.length)throw fail('Campanha indisponível');
  // Limitador curto por IP; não guarda o IP nem o relaciona à sessão de medição.
  const key=digest(`events:${ip}:${Math.floor(Date.now()/60000)}`);
  await db.query('DELETE FROM rate_limits WHERE reset_at<now()');
  const count=(await db.query('INSERT INTO rate_limits(key_hash,count,reset_at) VALUES($1,1,$2) ON CONFLICT(key_hash) DO UPDATE SET count=rate_limits.count+1 RETURNING count',[key,new Date(Date.now()+60000).toISOString()])).rows[0].count;
  if(count>120)throw fail('Limite de eventos por minuto',429);
  await db.query('DELETE FROM public_events WHERE occurred_at < $1',[new Date(now.getTime()-90*86400000).toISOString()]);
  const novo=(await db.query('INSERT INTO public_events(event_id,name,business_id,campaign_id,session_id,channel,source,result_count,slot,ref,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(event_id) DO NOTHING RETURNING event_id',[p.event_id,p.name,p.business_id||null,p.campaign_id||null,p.session_id,p.channel||null,p.source||null,p.result_count??null,p.slot||null,p.ref||null,now.toISOString()])).rows.length;
  // Visitas e contatos por empresa e dia (19.6), para as métricas da gestão: ficam depois dos 90 dias dos eventos.
  if(novo)await somarEvento(db,p,now);
  // Soma diária por banner e espaço (fuso de São Paulo), sem sessão: fica depois dos 90 dias dos eventos.
  if(novo&&needsCampaign) {
    const col=p.name==='banner_viewed'?'impressions':'clicks';
    await db.query(`INSERT INTO ad_daily(day,campaign_id,slot,${col}) VALUES($1,$2,$3,1) ON CONFLICT(day,campaign_id,slot) DO UPDATE SET ${col}=ad_daily.${col}+1`,[localNow(now).date,p.campaign_id,p.slot||'']);
  }
  return {ok:true};
}
