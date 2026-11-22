import { KIND_PATHS } from './conteudo.mjs';
import { currentOffers, upcomingEvents } from './paginas.mjs';
import { cuponsNoAr } from './cupons.mjs';
import { bairrosNoSitemap } from './bairros.mjs';

// Entradas do /sitemap.xml: só páginas indexáveis. lastmod é a atualização da empresa ou a data da publicação; as listas
// e a página inicial levam a data mais recente do que mostram. /ofertas só entra com oferta vigente e /eventos com evento
// futuro (o mesmo critério do menu). /busca fica de fora (não é indexável).
const day=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):'';};
const latest=list=>list.filter(Boolean).sort().at(-1)||'';
export async function sitemapEntries(db,now=new Date()) {
  const companies=(await db.query("SELECT slug,updated_at FROM businesses WHERE status='published' ORDER BY slug")).rows;
  const contents=(await db.query("SELECT kind,slug,metadata->>'date' AS date,updated_at FROM content WHERE status='published' AND kind=ANY($1) ORDER BY kind,slug",[Object.keys(KIND_PATHS)])).rows;
  const offers=(await currentOffers(db,now,1)).length,events=(await upcomingEvents(db,now)).length;
  // Cupons no ar (14.2): a lista sempre (é item do menu) e cada cupom com a data da última mudança.
  const cupons=(await cuponsNoAr(db,now)).map(c=>({path:`/cupons/${c.id}`,lastmod:day(c.updated_at)}));
  const bairros=await bairrosNoSitemap(db,now);
  const businessEntries=companies.map(b=>({path:`/comercio/${b.slug}`,lastmod:day(b.updated_at)}));
  const contentEntries=contents.map(c=>({path:`/${KIND_PATHS[c.kind]}/${c.slug}`,lastmod:day(c.date)||day(c.updated_at),kind:c.kind}));
  const lists=Object.entries(KIND_PATHS).filter(([kind])=>contentEntries.some(c=>c.kind===kind)).map(([kind,section])=>({path:`/${section}`,lastmod:latest(contentEntries.filter(c=>c.kind===kind).map(c=>c.lastmod))}));
  return [
    {path:'/',lastmod:latest([...businessEntries,...contentEntries].map(e=>e.lastmod))},...lists,...(offers?[{path:'/ofertas'}]:[]),...(events?[{path:'/eventos'}]:[]),
    {path:'/cupons',lastmod:latest(cupons.map(c=>c.lastmod))},...['/para-empresas','/institucional/sobre','/institucional/contato','/institucional/faq','/institucional/termos','/institucional/privacidade'].map(path=>({path})),
    ...(bairros.length?[{path:'/bairros'}]:[]),...businessEntries,...contentEntries.map(({path,lastmod})=>({path,lastmod})),...cupons,...bairros
  ];
}
