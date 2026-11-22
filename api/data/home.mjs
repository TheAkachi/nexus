import { slugify, byText } from '../lib/saneamento.mjs';
import { availableHomeGroups, matchesHomeCategory, categoryTree, homeGroupsForBusiness } from './categorias.mjs';
import { businessContext, byPlanFeaturedName } from './empresas.mjs';
import { activeCampaigns } from './campanhas.mjs';
import { adsFor } from './anuncios.mjs';
import { contentCardVM } from './conteudo.mjs';
import { currentOffers } from './paginas.mjs';
import { mapVM } from './mapa.mjs';
import { rota, MARCA } from './rota.mjs';

// Seleção editorial dos artigos da abertura (os destaques de lugar vêm de businesses.featured).
const CURATED=['roteiro-cafes-especiais-santa-teresa-e-ipanema','onde-ouvir-choro-e-jazz-ao-vivo-no-rio','guia-cinemas-de-rua-e-livrarias-independentes'];

// vm Colecao[]: coleções por necessidade publicadas, com até 6 empresas dos grupos (plano, destaque e nome).
async function collectionsVM(db,ctx) {
  const rows=(await db.query("SELECT * FROM collections WHERE status='published' ORDER BY position")).rows;
  return rows.map(c=>{
    const groups=c.groups||[],list=ctx.companies.filter(b=>homeGroupsForBusiness(b).some(g=>groups.includes(g))).sort(byPlanFeaturedName);
    return {slug:c.id,title:c.title,subtitle:c.subtitle,href:`/busca?${new URLSearchParams({category:groups[0]||''})}`,businesses:list.slice(0,6).map(ctx.card)};
  }).filter(c=>c.businesses.length);
}

// /: abertura com mapa, categorias, coleções, ofertas, artigos e empresas em destaque (filtradas por ?category=).
export async function loadHome({db,url,now,random}) {
  const ctx=await businessContext(db,now),companies=ctx.companies,campaigns=await activeCampaigns(db,now);
  const category=(url.searchParams.get('category')||'').slice(0,100);
  const categories=[...new Set(companies.flatMap(b=>b.details?.categories||[]))].sort(byText);
  const selected=companies.filter(b=>matchesHomeCategory(b,category));
  const sorted=[...selected].sort(byPlanFeaturedName);
  const articles=(await db.query("SELECT * FROM content WHERE status='published' AND kind='article' ORDER BY title")).rows;
  const curated=[...articles].sort((a,b)=>(CURATED.includes(a.slug)?CURATED.indexOf(a.slug):-1)<0?CURATED.includes(b.slug)?1:byText(a.title,b.title):CURATED.includes(b.slug)?CURATED.indexOf(a.slug)-CURATED.indexOf(b.slug):-1).slice(0,3);
  const groups=availableHomeGroups(companies),categorias=categoryTree(companies);
  const filtro=groups.find(g=>g.slug===category)?.label||categories.find(c=>slugify(c)===category);
  const districts=[...companies.reduce((m,b)=>b.district?m.set(b.district,(m.get(b.district)||0)+1):m,new Map())].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||byText(a.name,b.name));
  // home-grade entra depois do 6º destaque e nunca como o último card (contrato 11.3).
  const ads=adsFor('home',{campaigns,random,itens:Math.min(13,sorted.length)});
  return rota('home',{
    category,directCategory:categories.find(c=>slugify(c)===category)||'',categorias,
    companiesCount:companies.length,articlesCount:articles.length,selectedCount:selected.length,
    businesses:sorted.slice(0,13).map(ctx.card),articles:curated.map(contentCardVM),
    map:mapVM(companies),
    districts,collections:await collectionsVM(db,ctx),offers:await currentOffers(db,now,4),ads
  },filtro
    ?{title:`${filtro} no Rio de Janeiro | ${MARCA}`,description:`${selected.length} ${selected.length===1?'lugar':'lugares'} de ${filtro.toLowerCase()} no Nexus, com endereço, horário, cupons e mapa.`}
    :{title:`Nexus | Guia Gastronômico & Cultural do Rio de Janeiro`,description:`${companies.length} lugares gastronômicos e culturais no Rio de Janeiro em ${districts.length} bairros, com mapa interativo, cupons, eventos e roteiros.`});
}
