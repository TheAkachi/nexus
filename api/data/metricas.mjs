import { fail } from '../lib/erros.mjs';
import { normalize, collator } from '../lib/saneamento.mjs';
import { localNow } from '../lib/horario.mjs';
import { nomesDasCategorias } from './categorias.mjs';

// Métricas para a gestão comercial (contrato 19.6): somas diárias sem dado pessoal e a rota que a gestão lê para os
// Indicadores. Visitas e contatos vêm dos eventos com consentimento (seção 8); as buscas são contadas pelo servidor.
const addDays=(day,n)=>new Date(Date.parse(`${day}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
const COLUNA={whatsapp:'contact_whatsapp',phone:'contact_phone',map:'contact_map',waze:'contact_map',website:'contact_website'};

// Cada business_viewed e contact_clicked novo soma 1 no dia de São Paulo da empresa.
export async function somarEvento(db,{name,business_id,channel},now=new Date()) {
  const col=name==='business_viewed'?'views':name==='contact_clicked'?COLUNA[channel]:null;
  if(!col||!business_id)return;
  await db.query(`INSERT INTO business_daily(day,business_id,${col}) VALUES($1,$2,1) ON CONFLICT(day,business_id) DO UPDATE SET ${col}=business_daily.${col}+1`,[localNow(now).date,business_id]);
}

// A página 1 da busca com termo, bairro ou categoria (servida a quem não é robô) conta uma busca; sem resultado, uma busca
// vazia. O termo normalizado, o bairro e a categoria contam por dia e ficam 400 dias.
export async function contarProcura(db,{q,district,category,total,pagina},now=new Date()) {
  const termo=normalize(q||'').replace(/\s+/g,' ').trim().slice(0,60),bairro=String(district||'').replace(/\s+/g,' ').trim().slice(0,80),categoria=String(category||'').trim().slice(0,100);
  if(pagina!==1||(!termo&&!bairro&&!categoria))return;
  const hoje=localNow(now).date;
  await db.query(`INSERT INTO site_daily(day,searches,searches_empty) VALUES($1,1,$2) ON CONFLICT(day) DO UPDATE SET searches=site_daily.searches+1,searches_empty=site_daily.searches_empty+$2`,[hoje,total===0?1:0]);
  await db.query('DELETE FROM search_daily WHERE day<$1',[addDays(hoje,-400)]);
  for(const [kind,value] of [['termo',termo.length>=2?termo:''],['bairro',bairro],['categoria',categoria]])
    if(value)await db.query('INSERT INTO search_daily(day,kind,value,count) VALUES($1,$2,$3,1) ON CONFLICT(day,kind,value) DO UPDATE SET count=search_daily.count+1',[hoje,kind,value]);
}

// GET /api/integracao/v1/metricas?de=aaaa-mm&ate=aaaa-mm&page= (19.6).
const MES=/^\d{4}-(0[1-9]|1[0-2])$/,POR_PAGINA=100,MINIMO=3,LISTA=20;
const mesesEntre=(de,ate)=>{const r=[];for(let m=de;m<=ate;m=addDays(`${m}-28`,7).slice(0,7))r.push(m);return r;};
const fimDoMes=mes=>addDays(addDays(`${mes}-28`,7).slice(0,7)+'-01',-1);
const contatos=r=>({whatsapp:r?.w??0,telefone:r?.t??0,rota:r?.r??0,site:r?.s??0});
const SOMA=`COALESCE(sum(views),0)::int AS v,COALESCE(sum(contact_whatsapp),0)::int AS w,COALESCE(sum(contact_phone),0)::int AS t,
  COALESCE(sum(contact_map),0)::int AS r,COALESCE(sum(contact_website),0)::int AS s`;
async function topo(db,sql,params) {
  return (await db.query(sql,params)).rows.filter(r=>r.n>=MINIMO).sort((a,b)=>b.n-a.n||collator.compare(a.valor,b.valor)).slice(0,LISTA);
}
export async function metricasGestao(db,url,now=new Date()) {
  const de=url.searchParams.get('de')||'',ate=url.searchParams.get('ate')||'',atual=localNow(now).date.slice(0,7);
  if(!MES.test(de))throw fail('Informe o mês inicial como aaaa-mm.',422,'de');
  if(!MES.test(ate))throw fail('Informe o mês final como aaaa-mm.',422,'ate');
  if(de>ate)throw fail('O mês inicial vem antes do final.',422,'de');
  if(ate>atual)throw fail('O mês final não pode passar do mês atual.',422,'ate');
  const meses=mesesEntre(de,ate);if(meses.length>12)throw fail('Peça até 12 meses.',422,'de');
  const pagina=Math.max(1,parseInt(url.searchParams.get('page')||'1',10)||1),inicio=`${de}-01`,fim=fimDoMes(ate),hoje=localNow(now).date;
  const desde=Object.fromEntries((await db.query('SELECT serie,since::text AS d FROM metric_starts')).rows.map(r=>[r.serie,r.d]));
  const medido=(mes,serie)=>Boolean(desde[serie])&&fimDoMes(mes)>=desde[serie];
  const porMes=(await db.query(`SELECT to_char(day,'YYYY-MM') AS mes,${SOMA} FROM business_daily WHERE day BETWEEN $1 AND $2 GROUP BY 1`,[inicio,fim])).rows;
  const buscas=(await db.query(`SELECT to_char(day,'YYYY-MM') AS mes,sum(searches)::int AS b,sum(searches_empty)::int AS e FROM site_daily WHERE day BETWEEN $1 AND $2 GROUP BY 1`,[inicio,fim])).rows;
  const lista=kind=>topo(db,'SELECT value AS valor,sum(count)::int AS n FROM search_daily WHERE kind=$1 AND day BETWEEN $2 AND $3 GROUP BY value',[kind,inicio,fim]);
  const site={
    meses:meses.map(mes=>{const r=porMes.find(x=>x.mes===mes),b=buscas.find(x=>x.mes===mes),c=medido(mes,'contatos'),s=medido(mes,'buscas');
      return {mes,visitas:c?r?.v??0:null,contatos:c?contatos(r):null,buscas:s?b?.b??0:null,buscasSemResultado:s?b?.e??0:null};}),
    buscasMaisFeitas:(await lista('termo')).map(r=>({termo:r.valor,vezes:r.n})),
    buscasSemResultado:(await topo(db,'SELECT term AS valor,sum(count)::int AS n FROM search_misses WHERE day BETWEEN $1 AND $2 GROUP BY term',[inicio,fim])).map(r=>({termo:r.valor,vezes:r.n})),
    bairros:(await lista('bairro')).map(r=>({bairro:r.valor,vezes:r.n})),
    // v0.19.1: com o nome que o guia mostra; o identificador que o site não conhece vai com ele mesmo no nome.
    categorias:await (async()=>{const l=await lista('categoria');if(!l.length)return [];
      const nomes=nomesDasCategorias((await db.query('SELECT details FROM businesses')).rows);
      return l.map(r=>({categoria:r.valor,nome:nomes.get(r.valor)||r.valor,vezes:r.n}));})()
  };
  const publicadas=(await db.query("SELECT id,name FROM businesses WHERE status='published'")).rows.sort((a,b)=>collator.compare(a.name,b.name));
  const nesta=publicadas.slice((pagina-1)*POR_PAGINA,pagina*POR_PAGINA),ids=nesta.map(b=>b.id);
  const mesEmp=ids.length?(await db.query(`SELECT business_id AS id,to_char(day,'YYYY-MM') AS mes,${SOMA} FROM business_daily WHERE business_id=ANY($1) AND day BETWEEN $2 AND $3 GROUP BY 1,2`,[ids,inicio,fim])).rows:[];
  const trinta=ids.length?(await db.query(`SELECT business_id AS id,${SOMA} FROM business_daily WHERE business_id=ANY($1) AND day BETWEEN $2 AND $3 GROUP BY 1`,[ids,addDays(hoje,-29),hoje])).rows:[];
  const empresas={itens:nesta.map(b=>({id:b.id,nome:b.name,
      meses:meses.map(mes=>{const r=mesEmp.find(x=>x.id===b.id&&x.mes===mes),c=medido(mes,'contatos');return {mes,visitas:c?r?.v??0:null,contatos:c?contatos(r):null};}),
      ultimos30:(r=>({visitas:r?.v??0,contatos:contatos(r)}))(trinta.find(x=>x.id===b.id))})),
    total:publicadas.length,pagina,paginas:Math.max(1,Math.ceil(publicadas.length/POR_PAGINA))};
  const banners=(await db.query(`SELECT c.id,c.title,b.id AS empresa_id,b.name AS empresa_nome,sum(a.impressions)::int AS i,sum(a.clicks)::int AS k FROM ad_daily a
    JOIN campaigns c ON c.id=a.campaign_id LEFT JOIN businesses b ON b.id=c.business_id WHERE c.status<>'house' AND a.day BETWEEN $1 AND $2
    GROUP BY c.id,c.title,b.id,b.name HAVING sum(a.impressions)+sum(a.clicks)>0`,[inicio,fim])).rows
    .sort((a,b)=>b.k-a.k||b.i-a.i||collator.compare(a.title,b.title))
    .map(c=>({id:c.id,titulo:c.title,empresa:c.empresa_id?{id:c.empresa_id,nome:c.empresa_nome}:null,impressoes:c.i,cliques:c.k}));
  return {de,ate,medidoDesde:{contatos:desde.contatos||null,buscas:desde.buscas||null},site,empresas,banners};
}
