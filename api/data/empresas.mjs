import { normalize, slugify, safeURL, withoutTracking, byText, clip, oneLine } from '../lib/saneamento.mjs';
import { hoursStatus, weekLabels, localNow } from '../lib/horario.mjs';
import { matchesHomeCategory, categoryTree, homeGroupsForBusiness } from './categorias.mjs';
import { activeCampaigns } from './campanhas.mjs';
import { adsFor } from './anuncios.mjs';
import { cuponsDaEmpresa, cuponsNoAr } from './cupons.mjs';
import { mapVM } from './mapa.mjs';
import { moradoresDe, avaliarVM } from './avaliacoes.mjs';
import { rota, titulo, indisponivel, naoEncontrada } from './rota.mjs';

const image=src=>safeURL(src,{image:true})?src:'';
const byName=list=>[...list].sort(byText);
const br=d=>d?d.split('-').reverse().join('/'):'';
// Ordem alfabética pt-BR feita aqui: o ORDER BY do banco põe "Alvorada" antes de "Alô". Plano real (D2) vem junto.
export async function publishedBusinesses(db) {
  return (await db.query(`SELECT b.*,p.name AS plan_name,p.rank AS plan_rank,p.sponsored AS plan_sponsored,p.paid AS plan_paid FROM businesses b
    LEFT JOIN plans p ON p.id=b.plan_id AND p.status='active' WHERE b.status='published'`)).rows.sort((a,b)=>byText(a.name,b.name));
}
// Categoria em minúsculas para títulos ("Loja de Tintas" → "loja de tintas"), mantendo siglas como GNV.
export const lowerCategory=c=>oneLine(c).split(' ').map(w=>/^[A-ZÀ-Ý0-9]{2,}$/.test(w)?w:w.toLowerCase()).join(' ');
const labelOf=(tree,slug)=>{for(const g of tree){if(g.slug===slug)return g.label;const s=g.subcategorias.find(x=>x.slug===slug);if(s)return s.label;}return '';};
// WhatsApp com a mensagem pronta "Olá! Vi a [empresa] no Nexus."
export const whatsappLink=(number,name)=>/^\d{10,15}$/.test(number||'')?`https://wa.me/${number}?text=${encodeURIComponent(`Olá! Vi a ${name} no Nexus.`)}`:'';
// Ordem padrão: plano real (quando houver a lista do Nexus) → destaque → nome.
export const byPlanFeaturedName=(a,b)=>(b.plan_rank??-1)-(a.plan_rank??-1)||Number(b.featured)-Number(a.featured)||byText(a.name,b.name);

// Contexto das empresas publicadas: horário estruturado, nota das avaliações e o card de cada uma, no instante now.
export async function businessContext(db,now=new Date()) {
  const companies=await publishedBusinesses(db);
  const hours=new Map(),ratings=new Map();
  for(const h of (await db.query('SELECT business_id,weekday,opens,closes FROM business_hours')).rows)(hours.get(h.business_id)||hours.set(h.business_id,[]).get(h.business_id)).push(h);
  for(const r of (await db.query("SELECT business_id,count(*)::int AS n,avg(rating)::float AS media FROM reviews WHERE status='published' GROUP BY business_id")).rows)ratings.set(r.business_id,{rating:Math.round(r.media*10)/10,reviewsCount:r.n});
  const rowsOf=b=>hours.get(b.id)||[];
  const statusOf=b=>hoursStatus(rowsOf(b),now);
  const ratingOf=b=>ratings.get(b.id)||{rating:null,reviewsCount:0};
  return {companies,now,rowsOf,statusOf,ratingOf,card:b=>businessCardVM(b,{...statusOf(b),...ratingOf(b)})};
}

// vm CardEmpresa. status: horário de agora e nota (businessContext calcula); sem eles, horário null e sem nota.
export function businessCardVM(b,{openNow=null,closesAt='',opensAt='',opensDay='',rating=null,reviewsCount=0}={}) {
  const d=b.details||{};
  return {slug:b.slug,name:b.name,image:image(d.image),category:d.categories?.[0]||'',district:b.district||'',city:d.city||'',summary:b.summary,
    whatsappUrl:whatsappLink(d.whatsapp,b.name),openNow,closesAt,opensAt,opensDay,rating,reviewsCount,sponsored:b.plan_sponsored===true};
}

// vm FormBusca: categorias e bairros do acervo, cada um com a lista do outro para os filtros dependentes do site.js.
export function searchFormVM(companies) {
  const byCategory=new Map(),byDistrict=new Map(),add=(map,key,value)=>(map.get(key)||map.set(key,new Set()).get(key)).add(value);
  for(const b of companies)if(b.district)for(const c of b.details?.categories||[]){add(byCategory,slugify(c),b.district);add(byDistrict,b.district,slugify(c));}
  const cats=byName(new Set(companies.flatMap(b=>b.details?.categories||[]))),districts=byName(new Set(companies.map(b=>b.district).filter(Boolean)));
  return {
    categories:cats.map(c=>({value:slugify(c),label:c,districts:byName(byCategory.get(slugify(c))||[])})),
    districts:districts.map(d=>({name:d,categories:byName(byDistrict.get(d)||[])}))
  };
}

// Filtros da busca (?aberto=1, ?whatsapp=1, ?avaliacoes=1): o que cada um exige de uma empresa.
// cupom (18.3): cupom no ar e não esgotado, o mesmo critério de /cupons.
const FILTROS={aberto:(ctx,b)=>ctx.statusOf(b).openNow===true,whatsapp:(ctx,b)=>Boolean(whatsappLink(b.details?.whatsapp,b.name)),avaliacoes:(ctx,b)=>ctx.ratingOf(b).reviewsCount>0,
  cupom:(ctx,b)=>ctx.comCupom.has(b.id)};
const countBy=(list,key)=>{const m=new Map();for(const b of list)for(const k of key(b))if(k)m.set(k,(m.get(k)||0)+1);return m;};

// /busca e /favoritos: filtros por texto (nome, resumo, categoria e bairro), categoria, bairro, localização e os filtros
// aberto, whatsapp e avaliacoes; 12 por página (favoritos lista todos). Página além da última é 404.
export async function loadBusca({db,path,url,now,random}) {
  const ctx=await businessContext(db,now),companies=ctx.companies,campaigns=await activeCampaigns(db,now),favorites=path==='/favoritos',p=url.searchParams;
  ctx.comCupom=new Set((await cuponsNoAr(db,now)).filter(c=>c.quantity==null||c.claimed<c.quantity).map(c=>c.business_id));
  const location=(p.get('location')||'').slice(0,80),q=(p.get('q')||'').slice(0,100),district=(p.get('district')||'').slice(0,80),category=(p.get('category')||'').slice(0,100),sort=p.get('sort')==='recent'?'recent':'name';
  const filters=Object.fromEntries(Object.keys(FILTROS).map(k=>[k,p.get(k)==='1']));
  const matchesText=b=>normalize(`${b.name} ${b.summary} ${(b.details.categories||[]).join(' ')} ${b.district}`).includes(normalize(q));
  const base=companies.filter(b=>matchesText(b)&&(!location||normalize(b.district+' '+(b.details.city||'')).includes(normalize(location)))&&(!district||normalize(b.district)===normalize(district))&&matchesHomeCategory(b,category));
  // Contagem de cada filtro sobre os resultados com os demais filtros ligados.
  const counts=Object.fromEntries(Object.keys(FILTROS).map(k=>[k,base.filter(b=>FILTROS[k](ctx,b)&&Object.keys(FILTROS).every(o=>o===k||!filters[o]||FILTROS[o](ctx,b))).length]));
  let results=base.filter(b=>Object.keys(FILTROS).every(k=>!filters[k]||FILTROS[k](ctx,b)));
  results.sort(sort==='recent'?(a,b)=>new Date(b.updated_at)-new Date(a.updated_at)||byText(a.name,b.name):byPlanFeaturedName);
  const total=results.length,pages=Math.max(1,Math.ceil(total/12)),requested=parseInt(p.get('page')||'1')||1,map=mapVM(results);
  if(!favorites&&requested>pages)return naoEncontrada();
  const current=Math.max(1,requested);
  if(!favorites)results=results.slice((current-1)*12,current*12);
  const categorias=categoryTree(companies);
  // Busca vazia: categorias e bairros com resultado para o mesmo texto (ou os mais comuns do guia).
  let suggestions={categorias:[],bairros:[]};
  if(!total) {
    const pool=companies.filter(matchesText).length?companies.filter(matchesText):companies;
    const top=m=>[...m].sort((a,b)=>b[1]-a[1]||byText(a[0],b[0])).slice(0,6);
    suggestions={categorias:top(countBy(pool,b=>homeGroupsForBusiness(b))).map(([slug,count])=>({slug,label:labelOf(categorias,slug),count})),
      bairros:top(countBy(pool,b=>[b.district])).map(([name,count])=>({name,count}))};
  }
  const where=[labelOf(categorias,category),district&&`em ${district}`,location&&!district&&`em ${location}`].filter(Boolean).join(' ');
  const subject=where||(q?`Busca por “${oneLine(q)}”`:'Buscar empresas em Rio de Janeiro');
  const page=current>1?` · página ${current}`:'';
  const meta=favorites
    ?{title:titulo('Empresas salvas'),description:'As empresas que você salvou neste navegador no Nexus, para encontrar de novo sem precisar de cadastro.'}
    :{title:titulo(subject+page),description:clip(`${total} ${total===1?'empresa':'empresas'}${where?` de ${where}`:''}${q?` para “${oneLine(q)}”`:''} no Nexus, com endereço, telefone, WhatsApp e horário.${current>1?` Página ${current} de ${pages}.`:''}`)};
  // Favoritos não têm anúncio (contrato 11.2).
  const ads=favorites?{}:adsFor('busca',{campaigns,random,itens:results.length});
  return rota('busca',{favorites,q,district,category,sort,location,total,pages,current,results:results.map(ctx.card),form:searchFormVM(companies),categorias,ads,filters,counts,suggestions,map},meta);
}

// Rota até a empresa: pela coordenada quando ela é do endereço (não do centro do bairro), senão pelo endereço com rua.
function mapLinks(d) {
  const geo=d.geo&&Number.isFinite(d.geo.lat)&&Number.isFinite(d.geo.lng)&&d.geo.precisao!=='bairro'?`${d.geo.lat},${d.geo.lng}`:'';
  const waze=geo?`https://waze.com/ul?ll=${geo}&navigate=yes`:'';
  const place=geo||(d.street&&d.address?encodeURIComponent(`${d.address}, RJ`):'');
  return {...(place?{mapUrl:`https://www.google.com/maps/search/?api=1&query=${place}`,directionsUrl:`https://www.google.com/maps/dir/?api=1&destination=${place}`}:{mapUrl:'',directionsUrl:''}),wazeUrl:waze};
}

// /comercio/<slug>: perfil com catálogo publicado, horário, avaliações e outras unidades da rede.
export async function loadEmpresa({db,path,now,random,usuario=null,conta=null}) {
  const ctx=await businessContext(db,now),b=ctx.companies.find(x=>path===`/comercio/${x.slug}`);
  if(!b)return indisponivel();
  const d=b.details||{},catalog=(await db.query("SELECT * FROM catalog_items WHERE business_id=$1 AND status='published' ORDER BY updated_at DESC",[b.id])).rows;
  const reviews=(await db.query("SELECT author,rating,title,body,to_char(reviewed_on,'YYYY-MM-DD') AS day FROM reviews WHERE business_id=$1 AND status='published' ORDER BY reviewed_on DESC NULLS LAST,created_at DESC",[b.id])).rows;
  const place=b.district||d.city||'Rio de Janeiro',category=d.categories?.[0];
  // Fotos do acervo e, depois delas, as enviadas pelo painel e aprovadas pela equipe (no próprio site, /midia/).
  const enviadas=(await db.query("SELECT id FROM media WHERE business_id=$1 AND kind='foto' AND status='aprovada' ORDER BY position,created_at",[b.id])).rows;
  const photos=[...(d.photos||[]).map(p=>({href:safeURL(p,{image:true}),src:image(p)})),...enviadas.map(m=>({href:`/midia/${m.id}/1600.webp`,src:`/midia/${m.id}/800.webp`}))];
  const units=b.group_id?ctx.companies.filter(x=>x.group_id===b.group_id&&x.id!==b.id).map(x=>({slug:x.slug,name:x.name,district:x.district||''})):[];
  // Pagante: plano real ativo e pago; enquanto nenhuma empresa tem plano real (D2 ou admin), quem tinha página própria no portal (11.3).
  const pagante=ctx.companies.some(x=>x.plan_name)?Boolean(b.plan_name&&b.plan_paid):b.own_page===true;
  const ads=adsFor('empresa',{campaigns:await activeCampaigns(db,now),random,empresa:{id:b.id,categories:d.categories||[],pagante}});
  return rota('empresa',{
    id:b.id,slug:b.slug,name:b.name,summary:b.summary,district:b.district,city:d.city||'',categories:d.categories||[],image:image(d.image),
    description:(d.description||b.summary).split('\n').filter(Boolean),
    socials:(d.socials||[]).filter(s=>safeURL(s.url)).map(s=>({label:s.label,url:withoutTracking(safeURL(s.url))})),
    whatsappUrl:whatsappLink(d.whatsapp,b.name),
    phoneUrl:b.phone?'tel:'+b.phone.replace(/[^0-9+]/g,''):'',
    address:d.address||'',street:d.street||'',cep:d.cep||'',...mapLinks(d),
    hours:d.hours||'',website:withoutTracking(safeURL(d.website)),
    catalog:catalog.map(c=>({kind:c.kind,name:c.name,description:c.description,priceMode:c.price_mode,priceCents:c.price_cents})),
    // Mesma posição de cada foto do acervo: href é a URL normalizada, src a original aprovada ('' quando reprovada).
    photos,
    ...ctx.statusOf(b),week:weekLabels(ctx.rowsOf(b),localNow(now).weekday),...ctx.ratingOf(b),
    reviews:reviews.map(r=>({author:r.author,date:br(r.day),rating:r.rating,title:r.title,text:r.body})),reviewsSource:'guia Nexus',
    units,email:d.email||'',videoUrl:d.video||'',features:d.features||[],sponsored:b.plan_sponsored===true,plan:b.plan_name||null,ads,
    // Cupons no ar da empresa (14.3); o código só para quem já coletou.
    cupons:await cuponsDaEmpresa(db,b.id,now,usuario),
    referencia:d.referencia||'',pagamentos:d.pagamentos||[],
    moradores:await moradoresDe(db,b.id),avaliar:await avaliarVM(db,b.id,{usuario,tipo:conta?.tipo||null,csrf:conta?.csrf||''})
  },{title:titulo(`${b.name} · ${category?`${lowerCategory(category)} em `:''}${place}`),
    description:clip(b.summary)||`${b.name} em ${place}: endereço, telefone e horário no Nexus.`,
    ogImage:image(d.image)||photos.find(p=>p.src)?.src||''});
}
