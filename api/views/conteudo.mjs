import { escape as e } from '../lib/html.mjs';
import { image, link, contentCard, anuncio, comLateral, intercalar } from './componentes.mjs';

// Subtítulo de cada lista: artigos e classificados têm propósitos diferentes.
const INTRO={
  artigos:'Dicas e ideias para quem compra e vende na região.',
  classificados:'Produtos e serviços anunciados na região. Combine preço, entrega e pagamento direto com quem anunciou.'
};

// vm ListaConteudo: /artigos e /classificados, com busca por título e páginas de 12.
export function conteudosView(vm) {
  const {section,label,q,pages,current}=vm;
  const editoria=vm.editoria||'';
  // Muitas editorias têm uma publicação só: os chips mostram as 10 maiores com 2 ou mais (e a escolhida, se estiver fora delas),
  // das maiores para as menores. As outras continuam acessíveis pelos atalhos no fim de cada leitura.
  const maiores=(vm.editorias||[]).filter(ed=>ed.count>=2).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'pt-BR')).slice(0,10);
  const atual=(vm.editorias||[]).find(ed=>ed.slug===editoria);
  const lista=atual&&!maiores.includes(atual)?[...maiores,atual]:maiores;
  const editorias=lista.length?`<nav class="quick-filters editoria-filters" aria-label="Filtrar por editoria"><a class="filter-chip" href="/${section}${q?`?${new URLSearchParams({q})}`:''}"${editoria?'':' aria-current="true"'}>Todas</a>${lista.map(ed=>`<a class="filter-chip" href="/${section}?${e(String(new URLSearchParams({q,editoria:ed.slug})))}"${editoria===ed.slug?' aria-current="true"':''}>${e(ed.label)} <span class="chip-count">${ed.count}</span></a>`).join('')}</nav>`:'';
  // Publicidade (contrato 11.2): lista-topo e lista-meio (um card a cada 6 itens).
  const topo=anuncio(vm.ads?.['lista-topo'],{eager:true});
  const cards=intercalar(vm.items.map(contentCard),vm.ads?.['lista-meio'],{variant:'card'});
  // Artigo em destaque (v0.17.0, 18.6): só em /artigos, página 1, sem busca nem editoria; foto grande no topo. O vm já o tira de items.
  const d=vm.destaque;
  const destaque=d?`<article class="featured-article"><a class="featured-article-image" href="${e(d.href)}" tabindex="-1" aria-hidden="true">${image(d.image,'','',true)}</a><div class="featured-article-body"><p class="eyebrow">EM DESTAQUE${d.category?` · ${e(d.category.toUpperCase())}`:''}</p><h2><a href="${e(d.href)}">${e(d.title)}</a></h2><p>${e(d.excerpt)}…</p><p class="muted">${e(d.author||'Equipe Nexus')}${d.readingMinutes?` · ${d.readingMinutes} min de leitura`:''}</p><a class="more" href="${e(d.href)}">Ler o artigo <span aria-hidden="true">→</span></a></div></article>`:'';
  return `<section class="section-intro"><p class="eyebrow">GUIA COMERCIAL Nexus</p><h1>${label}</h1><p>${INTRO[section]||'Informação local para acompanhar a cidade.'}</p><form class="inline-search"><label>Buscar conteúdo<input name="q" value="${e(q)}" maxlength="100" placeholder="Qual assunto você procura?"></label>${editoria?`<input type="hidden" name="editoria" value="${e(editoria)}">`:''}<button>Buscar</button></form></section>${topo}${destaque}${editorias}<div class="news-grid">${vm.items.length?cards.join(''):'<p>Nenhuma publicação encontrada. Tente outro assunto.</p>'}</div><nav class="pagination" aria-label="Páginas">${Array.from({length:pages},(_,i)=>`<a ${current===i+1?'aria-current="page"':''} href="/${section}?${new URLSearchParams({q,...(editoria?{editoria}:{}),page:String(i+1)})}">${i+1}</a>`).join('')}</nav>`;
}

// Tempo de leitura: o do vm ou, sem ele, 200 palavras por minuto (no mínimo 1).
const palavras=texto=>texto.replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;
const minutosDeLeitura=c=>c.readingMinutes||Math.max(1,Math.round(palavras(c.bodyHtml||c.paragraphs.join(' '))/200));

// Classificado (Fase 2): preço, contato com quem anunciou e a empresa, quando o vm traz.
function classificado(c) {
  const preco=c.price||'';
  const whatsapp=c.whatsappUrl?`<a class="button is-whatsapp" href="${e(c.whatsappUrl)}" target="_blank" rel="noopener noreferrer">Conversar no WhatsApp <span aria-hidden="true">↗</span></a>`:'';
  const ligar=c.phoneUrl?`<a class="button secondary" href="${e(c.phoneUrl)}">Ligar${c.phone?` <span class="phone-number">${e(c.phone)}</span>`:''}</a>`:'';
  const contato=whatsapp+ligar;
  const empresa=c.business?`<a class="more" href="/comercio/${e(c.business.slug)}">${e(c.business.name)} <span aria-hidden="true">→</span></a>`:'';
  return preco||contato||empresa?`<div class="classified-box">${preco?`<p class="classified-price"><span>Preço</span><strong>${e(preco)}</strong></p>`:''}<div class="classified-actions">${contato}${empresa}</div></div>`:'';
}

// Corpo da leitura com o anúncio do meio (leitura-texto) depois do 3º parágrafo de primeiro nível (parágrafos dentro de
// citações, listas, tabelas e figuras não contam). Texto com menos parágrafos: o anúncio vem logo depois dele.
function corpoComAnuncio(corpo,espaco) {
  const peca=anuncio(espaco,{variant:'texto'});
  if(!peca)return `<div class="reading-body">${corpo}</div>`;
  let nivel=0,vistos=0,corte=corpo.length;
  for(const t of corpo.matchAll(/<(\/?)(p|blockquote|ul|ol|table|figure)\b[^>]*>/gi)){
    const fecha=t[1]==='/',tag=t[2].toLowerCase();
    if(tag!=='p'){nivel+=fecha?-1:1;continue;}
    if(fecha&&nivel===0&&++vistos===3){corte=t.index+t[0].length;break;}
  }
  const resto=corpo.slice(corte).trim();
  return `<div class="reading-body">${corpo.slice(0,corte)}</div>${peca}${resto?`<div class="reading-body">${resto}</div>`:''}`;
}

// vm Conteudo: leitura de um artigo ou classificado. bodyHtml chega saneado pelo back (lista branca de tags);
// sem ele, os parágrafos de texto puro. A galeria vem depois do texto.
export function conteudoView(c) {
  const corpo=c.bodyHtml||c.paragraphs.map(p=>`<p>${e(p)}</p>`).join('');
  const galeria=(c.gallery||[]).filter(g=>g.src).map((g,i)=>`<a href="${e(g.src)}" target="_blank" rel="noopener noreferrer">${image(g.src,g.alt||`Foto ${i+1} de ${c.title}`)}</a>`).join('');
  return comLateral(`<article class="reading"><a class="more" href="/${c.section}">← ${c.label}</a>${c.editoria?`<p class="eyebrow"><a href="/${c.section}?${new URLSearchParams({editoria:c.editoria.slug})}">${e(c.editoria.label)}</a></p>`:`<p class="eyebrow">${e(c.category||'GUIA COMERCIAL Nexus')}</p>`}<h1>${e(c.title)}</h1><div class="reading-meta"><p class="byline">${e(c.author||'Equipe Nexus')} · ${e(c.date||'Data não informada')}</p><span class="reading-time">${minutosDeLeitura(c)} min de leitura</span></div>${image(c.image,c.title,'article-image',true)}${c.section==='classificados'?classificado(c):''}${corpoComAnuncio(corpo,c.ads?.['leitura-texto'])}${galeria?`<div class="reading-gallery" aria-label="Galeria de fotos">${galeria}</div>`:''}${anuncio(c.ads?.['leitura-fim'])}${(c.editorias||[]).length>1?`<nav class="reading-tags" aria-label="Editorias desta publicação"><span>Mais em</span>${c.editorias.map(ed=>`<a href="/${c.section}?${new URLSearchParams({editoria:ed.slug})}">${e(ed.label)}</a>`).join('')}</nav>`:''}<div class="source-note">${link(c.sourceUrl,'Consultar publicação de origem')}<p>Informações, ofertas e prazos podem ter mudado desde a publicação.</p></div></article>`,c.ads?.['leitura-lateral']);
}
