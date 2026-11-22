import { randomUUID } from 'node:crypto';
import { fail } from '../../lib/erros.mjs';
import { audit, diff } from '../../lib/auditoria.mjs';
import { oneLine, destinationURL, safeURL } from '../../lib/saneamento.mjs';
import { localNow } from '../../lib/horario.mjs';
import { ESPACOS, FORMATOS } from '../espacos.mjs';
import { rejectExtra, needVersion, conflito, texto, imagem, dia, lista, casa, filtro } from './comum.mjs';

// Banners e ocupação dos espaços (contrato 13.4). O anúncio do Nexus (status 'house') não aparece nem é editado aqui.
const STATUS={'pending-review':'rascunho',draft:'rascunho',published:'publicado',paused:'pausado'};
const diaSP=d=>d?localNow(new Date(d)).date:'';
export const bannerAdminVM=c=>({id:c.id,titulo:c.title,anunciante:c.advertiser||'',empresa:c.business_id||null,espaco:c.placement,formato:c.format||'',
  inicio:diaSP(c.starts_at),fim:diaSP(c.ends_at),destino:c.destination||'',peso:c.weight,imagem:c.image_url||'',imagemCelular:c.image_mobile_url||'',status:STATUS[c.status]||c.status,version:c.version});
export async function listarBanners(db,url) {
  const q=filtro(url,'q'),espaco=filtro(url,'espaco'),anunciante=filtro(url,'anunciante'),status=filtro(url,'status');
  const rows=(await db.query("SELECT * FROM campaigns WHERE status<>'house' ORDER BY placement,starts_at NULLS LAST,id")).rows;
  return lista(rows.filter(c=>casa(q,c.title,c.advertiser)&&(!espaco||c.placement===espaco)&&casa(anunciante,c.advertiser)&&(!status||STATUS[c.status]===status)).map(bannerAdminVM),url);
}
async function banner(db,id,{lock=false}={}){const c=(await db.query(`SELECT * FROM campaigns WHERE id=$1 AND status<>'house'${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!c)throw fail('Banner não encontrado.',404);return c;}
export const obterBanner=async(db,id)=>bannerAdminVM(await banner(db,id));

async function validar(db,p,{novo}) {
  const v={};const titulo=texto(p.titulo,'titulo',120,{obrigatorio:novo,min:2});if(titulo!==undefined)v.title=oneLine(titulo);
  const anunciante=texto(p.anunciante,'anunciante',120);if(anunciante!==undefined)v.advertiser=oneLine(anunciante);
  if(p.empresa!==undefined){if(p.empresa&&!(await db.query('SELECT 1 FROM businesses WHERE id=$1',[p.empresa])).rows.length)throw fail('Empresa não encontrada.',422,'empresa');v.business_id=p.empresa||null;}
  if(p.espaco!==undefined){if(!ESPACOS.some(e=>e.id===p.espaco))throw fail('Escolha um espaço do inventário.',422,'espaco');v.placement=p.espaco;}
  if(p.formato!==undefined){if(!FORMATOS[p.formato])throw fail('Escolha um dos 6 formatos.',422,'formato');v.format=p.formato;}
  const ini=dia(p.inicio,'inicio');if(ini!==undefined)v.starts_at=ini?`${ini}T00:00:00-03:00`:null;
  const fim=dia(p.fim,'fim');if(fim!==undefined)v.ends_at=fim?`${fim}T23:59:59-03:00`:null;
  if(p.destino!==undefined){const d=p.destino?destinationURL(p.destino):'';if(p.destino&&!d)throw fail('Use um caminho do site ou um link https.',422,'destino');v.destination=d;}
  if(p.peso!==undefined){if(!Number.isInteger(p.peso)||p.peso<1||p.peso>100)throw fail('Use um peso de 1 a 100.',422,'peso');v.weight=p.peso;}
  const img=imagem(p.imagem,'imagem');if(img!==undefined)v.image_url=img;
  const cel=imagem(p.imagemCelular,'imagemCelular');if(cel!==undefined)v.image_mobile_url=cel;
  return v;
}
// Pronto para o ar: espaço, formato aceito pelo espaço, destino, imagem e período válido (contrato 11.3 e 13.4).
function prontoParaPublicar(c,now) {
  const e=ESPACOS.find(x=>x.id===c.placement);
  if(!e)throw fail('Escolha o espaço.',422,'espaco');
  if(!FORMATOS[c.format]||![...e.computador,...e.celular].includes(c.format))throw fail('Este espaço não aceita esse formato.',422,'formato');
  if(!destinationURL(c.destination))throw fail('Informe o destino.',422,'destino');
  if(!safeURL(c.image_url,{image:true}))throw fail('Escolha a imagem.',422,'imagem');
  if(!c.starts_at||!c.ends_at)throw fail('Informe o início e o fim.',422,c.starts_at?'fim':'inicio');
  if(Date.parse(c.ends_at)<Date.parse(c.starts_at))throw fail('O fim vem depois do início.',422,'fim');
  if(Date.parse(c.ends_at)<now.getTime())throw fail('O período já terminou.',422,'fim');
}
export async function criarBanner(db,{p,session,ip,now=new Date()}) {
  rejectExtra(p,['titulo','anunciante','empresa','espaco','formato','inicio','fim','destino','peso','imagem','imagemCelular']);
  const v=await validar(db,p,{novo:true}),id=randomUUID();
  if(v.starts_at&&v.ends_at&&Date.parse(v.ends_at)<Date.parse(v.starts_at))throw fail('O fim vem depois do início.',422,'fim');
  const c=(await db.query(`INSERT INTO campaigns(id,title,source,status,advertiser,business_id,placement,format,starts_at,ends_at,destination,weight,image_url,image_mobile_url,managed_at)
    VALUES($1,$2,'{}','draft',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [id,v.title,v.advertiser||'',v.business_id||null,v.placement||'home-topo',v.format||'',v.starts_at||null,v.ends_at||null,v.destination||'',v.weight||1,v.image_url||'',v.image_mobile_url||'',now.toISOString()])).rows[0];
  await audit(db,{actor:session.user_id,business:c.business_id,action:'banner_criado',resource:id,after:bannerAdminVM(c),ip});
  return bannerAdminVM(c);
}
export async function editarBanner(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['titulo','anunciante','empresa','espaco','formato','inicio','fim','destino','peso','imagem','imagemCelular','version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const c=await banner(tx,id,{lock:true});if(c.version!==version)throw conflito();
    const v=await validar(tx,p,{novo:false}),x={...c,...v};
    if(x.starts_at&&x.ends_at&&Date.parse(x.ends_at)<Date.parse(x.starts_at))throw fail('O fim vem depois do início.',422,'fim');
    // No ar, a mudança só vale se o banner continuar pronto para publicar.
    if(c.status==='published')prontoParaPublicar(x,now);
    const n=(await tx.query(`UPDATE campaigns SET title=$2,advertiser=$3,business_id=$4,placement=$5,format=$6,starts_at=$7,ends_at=$8,destination=$9,weight=$10,image_url=$11,image_mobile_url=$12,
      managed_at=COALESCE(managed_at,$13),version=version+1 WHERE id=$1 RETURNING *`,
      [id,x.title,x.advertiser,x.business_id,x.placement,x.format,x.starts_at,x.ends_at,x.destination,x.weight,x.image_url,x.image_mobile_url,now.toISOString()])).rows[0];
    const mudou=diff(bannerAdminVM(c),bannerAdminVM(n));
    await audit(tx,{actor:session.user_id,business:n.business_id,action:'banner_editado',resource:id,before:mudou.before,after:mudou.after,ip});
    return bannerAdminVM(n);
  });
}
export async function statusBanner(db,{id,acao,p,session,ip,now=new Date()}) {
  rejectExtra(p,['version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const c=await banner(tx,id,{lock:true});if(c.version!==version)throw conflito();
    if(acao==='publicar')prontoParaPublicar(c,now);
    const n=(await tx.query('UPDATE campaigns SET status=$2,managed_at=COALESCE(managed_at,$3),version=version+1 WHERE id=$1 RETURNING *',[id,acao==='publicar'?'published':'paused',now.toISOString()])).rows[0];
    await audit(tx,{actor:session.user_id,business:n.business_id,action:`banner_${acao}`,resource:id,before:{status:STATUS[c.status]},after:{status:STATUS[n.status]},ip});
    return bannerAdminVM(n);
  });
}

// Ocupação: por espaço e por dia (de 'de' a 'ate', até 92 dias), os banners no ar e quantas vagas sobram.
const proximo=(d,n)=>new Date(Date.parse(`${d}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
export async function ocupacao(db,url,now=new Date()) {
  const hoje=localNow(now).date,de=dia(filtro(url,'de')||hoje,'de'),ate=dia(filtro(url,'ate')||proximo(de,29),'ate');
  if(ate<de)throw fail('O fim vem depois do início.',422,'ate');
  const dias=Math.round((Date.parse(`${ate}T12:00:00Z`)-Date.parse(`${de}T12:00:00Z`))/86400000)+1;
  if(dias>92)throw fail('Escolha até 92 dias.',422,'ate');
  const rows=(await db.query("SELECT id,title,advertiser,placement,starts_at,ends_at FROM campaigns WHERE status='published'")).rows;
  const datas=Array.from({length:dias},(_,i)=>proximo(de,i));
  return {de,ate,espacos:ESPACOS.map(e=>({id:e.id,pagina:e.pagina,onde:e.onde,giram:e.giram,casa:e.casa,dias:datas.map(d=>{
    const ini=Date.parse(`${d}T00:00:00-03:00`),fim=Date.parse(`${d}T23:59:59-03:00`);
    const no=rows.filter(c=>c.placement===e.id&&(!c.starts_at||Date.parse(c.starts_at)<=fim)&&(!c.ends_at||Date.parse(c.ends_at)>=ini));
    return {dia:d,banners:no.map(c=>({id:c.id,titulo:c.title,anunciante:c.advertiser||''})),livres:Math.max(0,e.giram-no.length)};
  })}))};
}
