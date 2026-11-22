import { slugify, byText, oneLine } from '../lib/saneamento.mjs';
import { businessContext, byPlanFeaturedName } from './empresas.mjs';
import { mapVM } from './mapa.mjs';
import { rota, titulo, naoEncontrada } from './rota.mjs';

// Bairros do guia (contrato 18.2): uma página por bairro com empresa publicada. O slug é o nome em slug; se dois bairros de
// cidades diferentes derem o mesmo slug, os dois viram <bairro>-<cidade>.
export function slugsDeBairros(lista) {
  const porSlug=new Map();for(const b of lista)(porSlug.get(slugify(b.name))||porSlug.set(slugify(b.name),[]).get(slugify(b.name))).push(b);
  return lista.map(b=>({...b,slug:porSlug.get(slugify(b.name)).length>1?slugify(`${b.name}-${b.city}`):slugify(b.name)}));
}
// Bairros com empresa publicada, com a contagem, a partir das empresas (quem não tem bairro fica de fora).
export function bairrosDe(companies) {
  const m=new Map();
  for(const b of companies){const name=oneLine(b.district);if(!name)continue;const city=oneLine(b.details?.city)||'Rio de Janeiro',k=`${name}|${city}`;
    const atual=m.get(k)||m.set(k,{name,city,count:0}).get(k);atual.count++;}
  return slugsDeBairros([...m.values()]);
}
const alfabetica=(a,b)=>byText(a.name,b.name);
const maisEmpresas=(a,b)=>b.count-a.count||byText(a.name,b.name);

// Rodapé (18.2): "Bairros com mais empresas", até 8. Uma consulta curta por página (o layout recebe no renderPage).
export async function rodapeBairros(db) {
  const rows=(await db.query("SELECT district,details->>'city' AS city FROM businesses WHERE status='published' AND district<>''")).rows;
  const itens=bairrosDe(rows.map(r=>({district:r.district,details:{city:r.city}}))).sort(maisEmpresas).slice(0,8).map(b=>({slug:b.slug,name:b.name}));
  return {titulo:'Bairros com mais empresas',itens};
}
export async function bairrosNoSitemap(db,now) {return bairrosDe((await businessContext(db,now)).companies).map(b=>({path:`/bairros/${b.slug}`}));}

// /bairros: o mapa e a lista em ordem alfabética.
export async function loadBairros({db,now}) {
  const ctx=await businessContext(db,now),bairros=bairrosDe(ctx.companies).sort(alfabetica);
  return rota('bairros',{map:mapVM(ctx.companies),bairros:bairros.map(({slug,name,city,count})=>({slug,name,city,count}))},
    {title:titulo('Bairros de Rio de Janeiro'),description:`Empresas do Nexus em ${bairros.length} bairros de Rio de Janeiro, com o mapa e a lista de cada bairro.`});
}

// /bairros/<slug>: as empresas do bairro, 12 por página, na ordem da busca; o mapa só com elas; outros bairros da mesma cidade.
export async function loadBairro({db,path,url,now}) {
  const slug=/^\/bairros\/([a-z0-9-]+)$/.exec(path)?.[1];
  const ctx=await businessContext(db,now),bairros=bairrosDe(ctx.companies),b=bairros.find(x=>x.slug===slug);
  if(!b)return naoEncontrada();
  const lista=ctx.companies.filter(x=>oneLine(x.district)===b.name&&(oneLine(x.details?.city)||'Rio de Janeiro')===b.city).sort(byPlanFeaturedName);
  const total=lista.length,pages=Math.max(1,Math.ceil(total/12)),requested=parseInt(url.searchParams.get('page')||'1',10)||1;
  if(requested>pages)return naoEncontrada();
  const current=Math.max(1,requested);
  const outros=bairros.filter(x=>x.city===b.city&&x.slug!==b.slug).sort(maisEmpresas).slice(0,6).map(({slug,name,count})=>({slug,name,count}));
  const pagina=current>1?` · página ${current}`:'';
  return rota('bairro',{slug:b.slug,name:b.name,city:b.city,total,pages,current,results:lista.slice((current-1)*12,current*12).map(ctx.card),map:mapVM(lista),outros},
    {title:titulo(`Empresas em ${b.name}, ${b.city}${pagina}`),
     description:`${total} ${total===1?'empresa':'empresas'} em ${b.name}, ${b.city}, no Nexus: endereço, telefone, WhatsApp, horário e mapa.${current>1?` Página ${current} de ${pages}.`:''}`});
}
