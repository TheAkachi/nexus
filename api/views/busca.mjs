import { escape as e } from '../lib/html.mjs';
import { businessCard, anuncio, comLateral, intercalar } from './componentes.mjs';
import { mapView } from './mapa.mjs';

// Filtros rápidos da busca (Fase 2): cada um é um parâmetro da URL (aberto=1, whatsapp=1, avaliacoes=1).
// v0.17.0 (18.3): Com cupom (?cupom=1), medido ao ligar (filter_used).
const FILTROS=[['aberto','Aberto agora'],['whatsapp','Com WhatsApp'],['avaliacoes','Com avaliações'],['cupom','Com cupom']];

// vm FormBusca. Cada categoria leva os bairros onde existe (data-districts) e cada bairro as categorias (data-categories):
// o site.js usa essas listas para que um filtro reduza as opções do outro. Filtros rápidos ativos seguem como campos ocultos.
export function searchForm(form,{q='',district='',category='',sort='name',location=''}={},ativos={}) {
  return `<form class="search" action="/busca" method="get"><label class="search-term">O que você procura?<input name="q" value="${e(q)}" maxlength="100" placeholder="Empresa, produto ou serviço"></label><label>Categoria<select name="category"><option value="">Todas as categorias</option>${form.categories.map(c=>`<option value="${e(c.value)}" data-districts="${e(c.districts.join('|'))}" ${category===c.value?'selected':''}>${e(c.label)}</option>`).join('')}</select></label><label>Bairro<select name="district"><option value="">Todos os bairros</option>${form.districts.map(d=>`<option data-categories="${e(d.categories.join('|'))}" ${district===d.name?'selected':''}>${e(d.name)}</option>`).join('')}</select></label>${location?`<label>Localização<input name="location" value="${e(location)}" maxlength="80" placeholder="Cidade ou bairro"></label>`:''}<input type="hidden" name="sort" value="${e(sort)}">${Object.keys(ativos).map(k=>`<input type="hidden" name="${k}" value="1">`).join('')}<button>Buscar empresas</button></form>`;
}

// Chips com contagem: ligar ou desligar um filtro mantém a busca, os outros filtros e a ordem.
function chips(vm,url,ativos) {
  if(!vm.counts)return '';
  return `<nav class="quick-filters" aria-label="Filtros rápidos">${FILTROS.map(([k,label])=>{
    const n=vm.counts[k]??0,on=Boolean(ativos[k]);
    const texto=`${label} <span class="chip-count">${n}</span>`;
    if(!on&&!n)return `<span class="filter-chip is-empty" aria-disabled="true">${texto}</span>`;
    const proximo={...ativos};if(on)delete proximo[k];else proximo[k]='1';
    return `<a class="filter-chip" href="${e(url(proximo))}"${on?' aria-current="true"':''}${k==='cupom'&&!on?' data-filtro-medido="cupom"':''}>${on?'<svg class="chip-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>':''}${texto}${on?'<span class="sr-only"> (remover filtro)</span>':''}</a>`;
  }).join('')}</nav>`;
}

// Busca sem resultado: sugestões de categorias e bairros do vm, além da dica de sempre.
function sugestoes(s) {
  if(!s)return '';
  const lista=(titulo,itens)=>itens.length?`<div class="suggestions"><h4>${titulo}</h4><div>${itens.join('')}</div></div>`:'';
  return lista('Experimente uma categoria',(s.categorias||[]).map(c=>`<a href="/busca?${new URLSearchParams({category:c.slug})}">${e(c.label)}${c.count?` <span>${c.count}</span>`:''}</a>`))
    +lista('Ou um bairro próximo',(s.bairros||[]).map(b=>{const nome=b.name??b;return `<a href="/busca?${new URLSearchParams({district:nome})}">${e(nome)}${b.count?` <span>${b.count}</span>`:''}</a>`;}));
}

// vm Busca: /busca (resultados paginados) e /favoritos (favorites=true; o site.js mostra só os salvos no navegador).
export function buscaView(vm) {
  const {favorites,q,district,category,sort,location,total,pages,current}=vm;
  const ativos=Object.fromEntries(FILTROS.filter(([k])=>vm.filters?.[k]).map(([k])=>[k,'1']));
  const url=(filtros=ativos,extra={})=>`/busca?${new URLSearchParams({q,district,category,location,sort,...filtros,...extra})}`;
  // Publicidade (contrato 11.2): busca-topo, busca-meio (uma linha da grade a cada 6 resultados), busca-lateral e busca-vazia
  // (sem resultado). Favoritos não têm anúncio: a grade mostra só as empresas salvas.
  const ads=favorites?{}:vm.ads||{};
  const topo=anuncio(ads['busca-topo'],{eager:true});
  const cards=intercalar(vm.results.map(businessCard),ads['busca-meio'],{variant:'linha'});
  // Mapa dos resultados (v0.17.0, 18.3): todos os resultados, não só a página. Ao lado da lista na tela larga; no celular, o
  // botão "Ver no mapa" (site.js) alterna lista e mapa. Sem JavaScript, o mapa fica embaixo da lista.
  const mapa=!favorites&&total&&vm.map?.pontos?.length?mapView(vm.map,{eyebrow:'RESULTADOS NO MAPA',from:'search',id:'search-map-title'}):'';
  return `<section class="discovery"><div class="hero-copy"><p class="eyebrow">NEXUS · RIO DE JANEIRO</p><h1>${favorites?'Seus lugares salvos.':'Explore o Rio de Janeiro.'}</h1><p>${favorites?'Uma seleção sua, salva apenas neste navegador. Não exige conta.':'Restaurantes, cafés especiais, bares, espaços culturais e experiências nos melhores bairros da cidade.'}</p></div>${favorites?'':searchForm(vm.form,vm,ativos)}</section>${topo}${comLateral(`<section class="results" ${favorites?'':`data-search-results="${total}"`}>${favorites?'':chips(vm,url,ativos)}<div class="heading"><div><p class="eyebrow">RESULTADOS</p><h2>${favorites?'Sua seleção':`${total} ${total===1?'empresa encontrada':'empresas encontradas'}`}</h2></div>${favorites?'':`<div class="sort"><span>Ordenar por</span><a ${sort==='name'?'aria-current="true"':''} href="${e(url(ativos,{sort:'name'}))}">Nome A–Z</a><a ${sort==='recent'?'aria-current="true"':''} href="${e(url(ativos,{sort:'recent'}))}">Atualização</a></div>`}</div>${mapa?`<div class="search-split" data-search-split><button type="button" class="button secondary map-toggle" data-alternar-mapa aria-pressed="false" hidden>Ver no mapa</button>`:''}<div class="business-grid" ${favorites?'id="saved-grid"':''}>${cards.join('')}</div>${mapa?`<aside class="search-map" aria-label="Mapa dos resultados">${mapa}</aside></div>`:''}${!total||favorites?`<div class="empty" ${favorites?'id="saved-empty" hidden':''}><h3>${favorites?'Sua seleção começa aqui.':'Não encontramos esse resultado.'}</h3><p>${favorites?'Toque no coração de uma empresa para guardá-la.':'Tente um termo mais curto, outra categoria ou um bairro próximo.'}</p>${favorites?'':sugestoes(vm.suggestions)}<a class="button" href="/busca">Explorar empresas</a></div>${total?'':anuncio(ads['busca-vazia'])}`:''}${!favorites&&pages>1?`<nav class="pagination" aria-label="Páginas de resultados">${Array.from({length:pages},(_,i)=>`<a ${i+1===current?'aria-current="page"':''} href="${e(url(ativos,{page:String(i+1)}))}">${i+1}</a>`).join('')}</nav>`:''}</section>`,ads['busca-lateral'])}`;
}
