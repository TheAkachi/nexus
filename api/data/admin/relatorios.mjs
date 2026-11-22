import { fail } from '../../lib/erros.mjs';
import { normalize } from '../../lib/saneamento.mjs';
import { localNow } from '../../lib/horario.mjs';
import { matchesHomeCategory } from '../categorias.mjs';
import { ESPACOS } from '../espacos.mjs';
import { contarFila } from './fila.mjs';
import { resumoCupons } from '../cupons.mjs';
import { filtro } from './comum.mjs';

// Relatórios da equipe (contrato 13.6) e o resumo do /admin (13.2).
const PERIODOS={'7d':7,'30d':30,'90d':90};
const addDays=(d,n)=>new Date(Date.parse(`${d}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
const ctr=(c,i)=>i?Math.round(c/i*10000)/10000:0;

// Busca sem resultado: o termo normalizado (sem acento, minúsculo, até 60 caracteres) conta por dia; guardado 90 dias.
export async function contarBuscaVazia(db,q,now=new Date()) {
  const termo=normalize(q).replace(/\s+/g,' ').trim().slice(0,60);
  if(termo.length<2)return;
  const hoje=localNow(now).date;
  await db.query('DELETE FROM search_misses WHERE day<$1',[addDays(hoje,-90)]);
  await db.query('INSERT INTO search_misses(day,term,count) VALUES($1,$2,1) ON CONFLICT(day,term) DO UPDATE SET count=search_misses.count+1',[hoje,termo]);
}

export async function relatorios(db,url,now=new Date()) {
  const periodo=filtro(url,'periodo')||'30d',dias=PERIODOS[periodo];
  if(!dias)throw fail('Escolha 7d, 30d ou 90d.',422,'periodo');
  const ate=localNow(now).date,de=addDays(ate,-(dias-1)),desde=`${de}T00:00:00-03:00`,limite=`${addDays(ate,1)}T00:00:00-03:00`;
  const bairro=filtro(url,'bairro'),categoria=filtro(url,'categoria'),filtrado=Boolean(bairro||categoria);
  const empresas=(await db.query('SELECT id,name,district,details FROM businesses')).rows;
  const alvo=empresas.filter(b=>(!bairro||normalize(b.district)===normalize(bairro))&&(!categoria||matchesHomeCategory(b,categoria)));
  const ids=alvo.map(b=>b.id),nome=new Map(empresas.map(b=>[b.id,b.name]));
  const vistas=(await db.query(`SELECT business_id,count(*)::int AS n FROM public_events WHERE name='business_viewed' AND occurred_at>=$1 AND occurred_at<$2 AND business_id=ANY($3) GROUP BY 1`,[desde,limite,ids])).rows;
  const buscas=(await db.query('SELECT business_id,sum(search_impressions)::int AS n FROM business_daily WHERE day BETWEEN $1 AND $2 AND business_id=ANY($3) GROUP BY 1',[de,ate,ids])).rows;
  const nBuscas=new Map(buscas.map(r=>[r.business_id,r.n]));
  const maisVistas=vistas.sort((a,b)=>b.n-a.n||String(nome.get(a.business_id)).localeCompare(String(nome.get(b.business_id)),'pt-BR')).slice(0,10)
    .map(r=>({empresa:{id:r.business_id,nome:nome.get(r.business_id)||r.business_id},visitas:r.n,buscas:nBuscas.get(r.business_id)||0}));
  const canais=(await db.query(`SELECT channel,count(*)::int AS n FROM public_events WHERE name='contact_clicked' AND occurred_at>=$1 AND occurred_at<$2 AND business_id=ANY($3) GROUP BY 1`,[desde,limite,ids])).rows;
  const tipo={whatsapp:'whatsapp',phone:'telefone',map:'rota',website:'site'},cliques={whatsapp:0,telefone:0,rota:0,site:0};
  for(const c of canais)if(tipo[c.channel])cliques[tipo[c.channel]]+=c.n;
  const semResultado=filtrado?[]:(await db.query('SELECT term,sum(count)::int AS n FROM search_misses WHERE day BETWEEN $1 AND $2 GROUP BY term ORDER BY 2 DESC,term LIMIT 20',[de,ate])).rows.map(r=>({termo:r.term,vezes:r.n}));
  const porBanner=(await db.query(`SELECT a.campaign_id,c.title,c.placement,sum(a.impressions)::int AS i,sum(a.clicks)::int AS c FROM ad_daily a JOIN campaigns c ON c.id=a.campaign_id
    WHERE a.day BETWEEN $1 AND $2 GROUP BY 1,2,3 ORDER BY 4 DESC,1`,[de,ate])).rows;
  const porEspaco=(await db.query("SELECT slot,sum(impressions)::int AS i,sum(clicks)::int AS c FROM ad_daily WHERE day BETWEEN $1 AND $2 AND slot<>'' GROUP BY 1 ORDER BY 2 DESC,1",[de,ate])).rows;
  return {periodo,de,ate,buscasSemResultado:semResultado,maisVistas,cliques,
    banners:porBanner.map(b=>({id:b.campaign_id,titulo:b.title,espaco:b.placement||'',impressoes:b.i,cliques:b.c,ctr:ctr(b.c,b.i)})),
    espacos:porEspaco.map(e=>({id:e.slot,impressoes:e.i,cliques:e.c,ctr:ctr(e.c,e.i)}))};
}

// Resumo do /admin (13.2). Com ?bairro= ou ?categoria= (13.9, item 13), empresas, fila, solicitações e cupons contam só as
// empresas do recorte; banners no ar e espaços livres são sempre do guia todo.
export async function resumoAdmin(db,now=new Date(),url=null) {
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
  const agora=now.toISOString(),bairro=filtro(url,'bairro'),categoria=filtro(url,'categoria');
  const recorte=bairro||categoria?{bairro,categoria}:null;
  const ids=recorte?(await db.query('SELECT id,district,details FROM businesses')).rows
    .filter(b=>(!bairro||normalize(b.district)===normalize(bairro))&&(!categoria||matchesHomeCategory(b,categoria))).map(b=>b.id):null;
  const so=(col,n)=>ids?` AND ${col}=ANY($${n})`:'',args=ids?[ids]:[];
  const empresas=await q(`SELECT count(*) FILTER (WHERE status='published')::int AS p,count(*) FILTER (WHERE status='paused')::int AS z FROM businesses WHERE true${so('id',1)}`,args);
  const noAr=(await db.query("SELECT placement FROM campaigns WHERE status='published' AND (starts_at IS NULL OR starts_at<=$1) AND (ends_at IS NULL OR ends_at>$1)",[agora])).rows;
  const ocupados=new Set(noAr.map(c=>c.placement));
  return {recorte,
    fila:ids?(await q(`SELECT count(*)::int AS n FROM approvals WHERE status='pendente'${so('business_id',1)}`,args)).n:await contarFila(db),
    solicitacoes:(await q(`SELECT count(*)::int AS n FROM requests WHERE status IN ('aberta','em-andamento')${so('business_id',1)}`,args)).n,
    empresas:{publicadas:empresas.p,pausadas:empresas.z},cupons:await resumoCupons(db,now,ids),
    bannersNoAr:noAr.length,espacosLivres:ESPACOS.filter(e=>!ocupados.has(e.id)).length};
}
