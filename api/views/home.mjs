import { escape as e } from '../lib/html.mjs';
import { businessCard, contentCard, offerCard, anuncio } from './componentes.mjs';
import { mapView } from './mapa.mjs';

// Bairros com empresas no mapa, do que tem mais empresas para o que tem menos (empate em ordem alfabética).
// O mesmo nome em cidades diferentes (Centro) conta separado.
const bairrosDoGuia=pontos=>{
 const count=new Map();
 for(const p of pontos)if(p.district){const k=p.district+'|'+(p.city||'');const c=count.get(k)||{district:p.district,city:p.city||'',n:0};c.n++;count.set(k,c);}
 return [...count.values()].sort((a,b)=>b.n-a.n||a.district.localeCompare(b.district,'pt-BR'));
};

// Busca da abertura (v0.17.0, item 1): o terceiro campo traz os grupos da lista única de categorias, que a /busca já
// entende por slug (?category=alimentacao).
const categoriaBusca=(categorias=[])=>categorias.length?`<label class="search-field search-field-category"><span>CATEGORIA</span><select name="category"><option value="">Todas</option>${categorias.map(c=>`<option value="${e(c.slug)}">${e(c.label)}</option>`).join('')}</select></label>`:'';

// Atalhos de categoria (v0.17.0, item 2, em teste): um por grupo com empresas, com o ícone do sprite próprio e a contagem
// real (Categoria.count). Para tirar: a linha de atalhosCategoria no return, o bloco "Atalhos" no CSS e no site.js e o
// sprite p2/icones-categorias.svg. O clique é medido (shortcut_clicked, ref = slug do grupo). v0.17.1: uma faixa só, sem quebra, com
// título, setas (site.js) e a barra de rolagem.
const ICONES_GRUPO=new Set(['restaurantes','cafes-e-padarias','bares-e-botecos','arte-e-cultura','livrarias-e-cinema','musica-e-palcos','parques-e-lazer','experiencias']);
const atalhosCategoria=(categorias=[])=>{
 const grupos=categorias.filter(c=>c.count>0);
 if(!grupos.length)return '';
 return `<section class="category-shortcuts" aria-labelledby="atalhos-titulo" data-atalhos><div class="shortcuts-head"><h2 id="atalhos-titulo">Explore por categoria</h2><div class="shortcuts-arrows"><button type="button" class="shortcuts-arrow" data-atalhos-ir="-1" aria-label="Categorias anteriores" hidden><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg></button><button type="button" class="shortcuts-arrow" data-atalhos-ir="1" aria-label="Mais categorias" hidden><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg></button></div></div><ul class="shortcuts-track" data-atalhos-trilha>${grupos.map(c=>`<li><a href="/busca?category=${e(c.slug)}" data-atalho="${e(c.slug)}"><svg class="shortcut-icon" aria-hidden="true" focusable="false"><use href="/assets/icones-categorias.svg#${ICONES_GRUPO.has(c.slug)?c.slug:'outros'}"></use></svg><span class="shortcut-text"><span class="shortcut-label">${e(c.label)}</span><span class="shortcut-count">${c.count} ${c.count===1?'lugar':'lugares'}</span></span></a></li>`).join('')}</ul></section>`;
};

// vm Home, na ordem do PDF1: busca e bairro → empresas (com filtro por categoria) e coleções → ofertas → artigos → área
// comercial (a seção de notícias saiu do site em 2026-10-15). Os bairros entram como sugestões do campo "Onde?" e na contagem da abertura.
// Bloco sem conteúdo não aparece. Campos da Fase 2 (categorias, collections, offers) são opcionais.
export function homeView(vm){
 const {category}=vm;
 const categorias=vm.categorias;
 const direct=vm.directCategory&&!categorias.some(g=>g.slug===category);
 const categoryLinks=categorias.map(c=>`<a href="/?category=${e(c.slug)}#empresas" ${category===c.slug?'aria-current="true"':''}>${e(c.label)}</a>`).join('')+(direct?`<a href="/?category=${e(category)}#empresas" aria-current="true">${e(vm.directCategory)}</a>`:'');
 const categoryOptions=categorias.map(c=>`<option value="${e(c.slug)}" ${category===c.slug?'selected':''}>${e(c.label)}</option>`).join('')+(direct?`<option value="${e(category)}" selected>${e(vm.directCategory)}</option>`:'');
 const businessCards=vm.businesses.map(b=>businessCard(b).replaceAll('from=search','from=home'));
 // Publicidade (contrato 11.2): home-topo depois da abertura, home-grade como card depois do 6º destaque (nunca o último),
 // home-destaques entre os destaques e as coleções e home-comercial antes da área comercial.
 const ads=vm.ads||{};
 const cardAnuncio=businessCards.length>6?anuncio(ads['home-grade'],{variant:'card'}):'';
 if(cardAnuncio)businessCards.splice(6,0,cardAnuncio);
 // Sem filtro, um cartão "ver todas" fecha a última linha da grade (data-resto: casas vazias em 4 e em 2 colunas).
 const n=businessCards.length;
 if(n&&!category)businessCards.push(`<a class="more-tile" href="/busca" data-resto4="${(4-n%4)%4||4}" data-resto2="${(2-n%2)%2||2}"><strong>Ver as ${vm.companiesCount} empresas do guia</strong><span>Busque por nome, categoria ou bairro <span aria-hidden="true">→</span></span></a>`);
 // Bairros: districts do vm (Fase 2) ou, sem ele, os pontos do mapa.
 const bairros=vm.districts?vm.districts.map(d=>({district:d.name,city:'',n:d.count})):bairrosDoGuia(vm.map.pontos);
 const collections=(vm.collections||[]).filter(c=>c.businesses?.length);
 const offers=vm.offers||[];

 let indice=0;
 const index=texto=>`<p class="section-index">${String(++indice).padStart(2,'0')} / ${texto}</p>`;

 const hero=`<section class="reference-hero">
  <div class="reference-copy">
   <p class="eyebrow">NEXUS · GUIA GASTRONÔMICO &amp; CULTURAL · RIO DE JANEIRO</p>
   <h1>SEU RIO.<br><span>SUAS CONEXÕES.</span></h1>
   <p class="hero-question">Descubra restaurantes, cafés, bares, espaços culturais, eventos e cupons nos melhores bairros do Rio.</p>
   <form class="hero-search" action="/busca" method="get" role="search" aria-label="Buscar no guia Nexus">
    <label class="search-field search-field-term"><span>O QUE VOCÊ PROCURA?</span><input name="q" type="search" placeholder="Restaurante, café, jazz, cinema..." maxlength="100" autocomplete="off"></label>
    <label class="search-field search-field-place"><span>ONDE?</span><input name="location" type="search" placeholder="Bairro (ex: Botafogo, Lapa...)" maxlength="80" autocomplete="off"${bairros.length?' list="bairros-guia"':''}></label>
    ${categoriaBusca(vm.categorias)}
    <button type="submit">Buscar</button>
   </form>
   ${bairros.length?`<datalist id="bairros-guia">${bairros.map(b=>`<option value="${e(b.district)}">`).join('')}</datalist>`:''}
   <div class="impact-strip" aria-label="O guia em números">
    <div><strong>${vm.companiesCount}</strong><span>lugares no guia</span></div>
    <div><strong>${bairros.length}</strong><span>${bairros.length===1?'bairro no mapa':'bairros no mapa'}</span></div>
    <div><strong>${vm.articlesCount}</strong><span>roteiros e artigos</span></div>
   </div>
  </div>
  ${mapView(vm.map)}
 </section>`;

 const colecoes=collections.map(c=>`<div class="collection" aria-labelledby="colecao-${e(c.slug)}"><div class="heading"><div><h3 id="colecao-${e(c.slug)}">${e(c.title)}</h3>${c.subtitle?`<p class="muted">${e(c.subtitle)}</p>`:''}</div>${c.href?`<a class="more" href="${e(c.href)}">Ver mais <span aria-hidden="true">→</span></a>`:''}</div><div class="business-grid featured-grid collection-grid">${c.businesses.slice(0,4).map(b=>businessCard(b).replaceAll('from=search','from=home')).join('')}</div></div>`).join('');
 const featuredSection=`<section class="results featured-section" id="empresas">${index('CURADORIA CARIOCA')}<div class="heading"><div><h2>Lugares em destaque</h2><p class="muted">Uma seleção gastronômica e cultural nos bairros do Rio.</p></div><a class="more" href="/busca">Ver todos os lugares →</a></div><div class="category-carousel"><nav class="category-filters" aria-label="Filtrar lugares por categoria"><a href="/#empresas" ${!category?'aria-current="true"':''}>Todas</a>${categoryLinks}</nav></div><form class="category-select" action="/" method="get"><label>Categoria<select name="category"><option value="">Todas as categorias</option>${categoryOptions}</select></label><button>Filtrar lugares</button></form><p class="muted" role="status">${vm.selectedCount} ${vm.selectedCount===1?'lugar encontrado':'lugares encontrados'}${category?' nesta categoria':''}.</p><div class="business-grid featured-grid${category?' is-filtered':''}">${businessCards.join('')}${!vm.selectedCount?'<div class="empty"><h3>Nenhum lugar nesta categoria.</h3><p>Selecione outra categoria ou veja todos.</p><a href="/#empresas">Ver todas as categorias</a></div>':''}</div>${anuncio(ads['home-destaques'])}${category?'':colecoes}</section>`;

 const offersSection=offers.length?`<section class="home-offers" aria-labelledby="ofertas-title">${index('EXPERIÊNCIAS E OFERTAS')}<div class="heading"><h2 id="ofertas-title">Ofertas da semana</h2><a class="more" href="/ofertas">Todas as ofertas →</a></div><div class="offer-grid">${offers.slice(0,4).map(offerCard).join('')}</div></section>`:'';

 // Artigos da seleção editorial.
 const artigos=vm.articles||[];
 const newsSection=artigos.length?`<section class="editorial home-articles">${index('ROTEIROS PELA CIDADE')}<div class="heading"><h2>Roteiros e artigos</h2><a class="more" href="/artigos">Mais roteiros →</a></div><div class="news-grid">${artigos.map(contentCard).join('')}</div></section>`:'';

 // Área institucional e demonstração.
 const comercial=`<section class="bairros-band commercial-band" id="sobre" aria-labelledby="about-title">
  <div class="bairros-copy"><p class="eyebrow">SOBRE O NEXUS</p><h2 id="about-title">Conectamos pessoas, sabores e cultura no Rio de Janeiro.</h2><p class="bairros-support">O Nexus é uma aplicação web Full Stack demonstrativa que reúne mapa interativo, busca hiperlocal, cupons, painel do parceiro e administração.</p><a class="band-link" href="/institucional/sobre">Conheça o projeto <span aria-hidden="true">→</span></a></div>
  <div class="bairros-copy commercial-copy"><p class="eyebrow">PARA PARCEIROS &amp; RECRUTADORES</p><h3>Teste o fluxo completo no painel e no admin.</h3><p class="bairros-support">Experimente as contas de demonstração prontas em Entrar ou simule o cadastro de um novo espaço gastronômico ou cultural.</p><a class="band-link" href="/entrar">Testar contas demo <span aria-hidden="true">→</span></a></div>
 </section>`;

 return hero+atalhosCategoria(categorias)+anuncio(ads['home-topo'])+featuredSection+offersSection+newsSection+anuncio(ads['home-comercial'])+comercial;
}
