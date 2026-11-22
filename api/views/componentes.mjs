import { escape as e } from '../lib/html.mjs';

// Peças usadas por mais de uma página. As URLs chegam aprovadas pelo loader; vazio ('') significa "não mostrar".
export const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export const image=(src,alt,cls='',eager=false)=>src?`<img class="${cls}" src="${e(src)}" alt="${e(alt)}" loading="${eager?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer">`:'';
export const link=(url,label,cls='')=>url?`<a class="${cls}" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>`:'';

// Situação do horário (Horario, contrato da Fase 2), calculada pelo back no fuso de São Paulo. openNow null: sem horário
// estruturado ou feriado nacional (holiday). opensDay é 'hoje', 'amanhã' ou o dia da semana. Sem o campo, nada aparece.
export function horario(b) {
  const selo=(cls,texto)=>`<span class="hours-badge${cls}"><span class="hours-dot" aria-hidden="true"></span>${texto}</span>`;
  if(b.openNow===true)return selo(' is-open',`Aberto agora${b.closesAt?` · fecha às ${e(b.closesAt)}`:''}`);
  if(b.openNow===false)return selo(' is-closed',`Fechado${b.opensAt?` · abre ${b.opensDay&&b.opensDay!=='hoje'?`${e(b.opensDay)} `:''}às ${e(b.opensAt)}`:''}`);
  if(b.openNow===null)return selo('',b.holiday?`Feriado (${e(b.holiday)}) · horário: consulte`:'Horário: consulte');
  return '';
}

// Nota média com estrela desenhada (sem glifo), só quando há avaliação: "4,8 · 12 avaliações".
const estrela='<svg class="star" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>';
export const decimal=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
export function nota(rating,count) {
  if(!rating||!count)return '';
  return `<span class="rating">${estrela}<span class="sr-only">Nota </span><strong>${decimal(rating)}</strong><span class="rating-count">· ${count} ${count===1?'avaliação':'avaliações'}</span></span>`;
}

// Rótulo de anúncio pago: só quando o vm diz sponsored = true (nunca deduzido de plano ou posição).
export const patrocinado=b=>b.sponsored===true?'<span class="card-selo">Patrocinado</span>':'';

// vm CardEmpresa. Os campos da Fase 2 (whatsappUrl, openNow, rating, sponsored...) são opcionais: sem eles, o card fica como antes.
export function businessCard(b) {
  const status=[horario(b),nota(b.rating,b.reviewsCount)].filter(Boolean).join('');
  const whatsapp=b.whatsappUrl?`<a class="card-whatsapp is-whatsapp" href="${e(b.whatsappUrl)}" target="_blank" rel="noopener noreferrer"><svg class="wa-icone" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2.6a7.4 7.4 0 0 0-6.4 11.1L2.6 17.4l3.8-1a7.4 7.4 0 1 0 3.6-13.8z"/><path class="wa-fone" d="M7.3 6.2c.3-.3.7-.3.9 0l.9 1.4c.2.3.1.6-.1.8l-.5.5c.5 1 1.3 1.8 2.3 2.3l.5-.5c.2-.2.6-.3.8-.1l1.4.9c.3.2.3.6 0 .9l-.6.6c-.5.5-1.3.7-2 .4-2-.8-3.6-2.4-4.4-4.4-.3-.7-.1-1.5.4-2z"/></svg><span class="wa-texto">WhatsApp</span><span class="sr-only"> de ${e(b.name)}</span><span class="wa-seta" aria-hidden="true">↗</span></a>`:'';
  return `<article class="business-card"><a class="card-picture" href="/comercio/${e(b.slug)}?from=search" tabindex="-1" aria-hidden="true">${image(b.image,'')}<span class="picture-fallback">${e(b.name.split(' ').slice(0,2).map(s=>s[0]).join(''))}</span></a><div class="card-body">${patrocinado(b)}<p class="eyebrow">${e(b.category||'Negócio local')}</p><h2><a href="/comercio/${e(b.slug)}?from=search">${e(b.name)}</a></h2><p class="location">${e(b.district||'Bairro não informado')} · ${e(b.city||'Rio de Janeiro')}</p>${status?`<div class="card-status">${status}</div>`:''}<p>${e(b.summary.slice(0,160))}</p><div class="card-actions"><a class="more" href="/comercio/${e(b.slug)}?from=search">Ver detalhes <span aria-hidden="true">→</span></a>${whatsapp}<button class="favorite icon-button" data-favorite="${e(b.slug)}" aria-label="Salvar ${e(b.name)}" aria-pressed="false" title="Salvar neste dispositivo">♡</button></div></div></article>`;
}

// Oferta (Fase 2): condições e validade reais, sempre com a empresa. Também usada em /ofertas.
export function offerCard(o) {
  return `<article class="offer-card">${o.image?`<img src="${e(o.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}<div><h3>${e(o.name)}</h3>${o.description?`<p>${e(o.description)}</p>`:''}${o.conditions?`<p class="offer-conditions">${e(o.conditions)}</p>`:''}${o.priceLabel?`<p class="offer-price">${e(o.priceLabel)}</p>`:''}<p class="offer-meta">${o.validUntil?`<span class="offer-valid">Válida até ${e(o.validUntil.slice(0,5))}</span>`:''}<a href="/comercio/${e(o.businessSlug)}">${e(o.businessName)} <span aria-hidden="true">→</span></a></p></div></article>`;
}

// Evento (Fase 2): data (ou período), horário, local e endereço; link do evento (fora do site) e a empresa, quando houver.
// descriptionHtml (13.9, item 10) chega saneado como o bodyHtml e entra sem escape; sem ele, o texto corrido.
export function eventCard(ev) {
  const quando=`${e(ev.date||'Data a confirmar')}${ev.endDate&&ev.endDate!==ev.date?` a ${e(ev.endDate)}`:''}${ev.time?` · ${e(ev.time)}`:''}`;
  const titulo=ev.href?`<a href="${e(ev.href)}" target="_blank" rel="noopener noreferrer">${e(ev.title)} <span aria-hidden="true">↗</span></a>`:e(ev.title);
  const local=[ev.place,ev.address].filter(Boolean).map(e).join(' · ');
  return `<article class="event-card">${ev.image?`<img src="${e(ev.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}<div><p class="event-when">${quando}</p><h2>${titulo}</h2>${local?`<p class="event-place">${local}</p>`:''}${ev.descriptionHtml?`<div class="event-description">${ev.descriptionHtml}</div>`:ev.description?`<p>${e(ev.description)}</p>`:''}${ev.business?`<a class="more" href="/comercio/${e(ev.business.slug)}">${e(ev.business.name)} <span aria-hidden="true">→</span></a>`:''}</div></article>`;
}

// vm CardConteudo
export function contentCard(c) {
  return `<article class="news-card">${image(c.image,c.title)}<div><p class="eyebrow">${e(c.category||({article:'Artigos',classified:'Classificados'}[c.kind]))}</p><h2><a href="${e(c.href)}">${e(c.title)}</a></h2>${c.price?`<p class="card-price">${e(c.price)}</p>`:''}<p>${e(c.excerpt)}…</p><span class="muted">${e(c.author||'Equipe Nexus')}${c.readingMinutes?` · ${c.readingMinutes} min de leitura`:''}</span></div></article>`;
}

// Formatos de anúncio (contrato 11.1): largura × altura da peça, com os nomes da tabela de banners do "Anuncie aqui".
export const FORMATOS={'link-patrocinado':[320,100],quadrado:[250,250],'super-banner':[728,90],'ar-livre':[970,250],'meia-pagina':[300,600],'exibir-lateral':[160,600]};
const formato=f=>FORMATOS[f]?f:'quadrado';
// Nome da classe de cada formato, sem "banner" nem "patrocinado", que as regras genéricas dos bloqueadores escondem.
export const CLASSE_FORMATO={'link-patrocinado':'link',quadrado:'quadrado','super-banner':'faixa','ar-livre':'painel','meia-pagina':'meia','exibir-lateral':'coluna'};
const icone=(d,cls='')=>`<svg class="${cls}" viewBox="0 0 20 20" aria-hidden="true"><path d="${d}"/></svg>`;

// Espaço de anúncio (EspacoAnuncio, contrato 11.4): banners pagos em rodízio ou, sem eles, o anúncio da próprio Nexus (house),
// que leva ao cadastro com o formato marcado. Cada peça reserva a proporção do seu formato (aspect-ratio) antes de a imagem
// chegar e, até 700px, troca para o formato do celular: imageMobile no 1º formato de formatos.celular ou, sem ela, a própria
// peça quando o formato dela também vale no celular; senão a peça some no celular (e o espaço, quando nenhuma aparece lá ou
// quando celular é false). Cada peça diz "Publicidade" e o anunciante, numa borda própria que não se confunde com os cards.
// variant: 'faixa' (topo e entre seções), 'card' (célula de grade), 'linha' (linha inteira de uma grade), 'texto' (no meio da
// leitura) ou 'lateral' (coluna fixa em tela larga). O site.js faz o rodízio (data-rotate) e mede só a peça que aparece na
// tela (data-campaign, com o espaço em data-placement); a do Nexus também é medida. eager: só no topo das páginas internas.
// banners: troca a lista do espaço (repetições de aCada).
export function anuncio(espaco,{variant='faixa',eager=false,banners:lista}={}) {
  if(!espaco)return '';
  const pecas=lista||espaco.banners||[],house=pecas.length?null:espaco.house;
  if(!pecas.length&&!house)return '';
  const cel=espaco.formatos?.celular||[],doEspaco=formato(espaco.formatos?.computador?.[0]||house?.format),noCelular=cel[0]?formato(cel[0]):'';
  const tag=(quem,fora)=>`<span class="vitrine-tag"><span>Publicidade<span class="vitrine-by"> · ${e(quem)}</span></span>${fora?'<span aria-hidden="true">↗</span>':''}</span>`;
  const classes=(f,m)=>`vitrine-piece is-${CLASSE_FORMATO[f]}${m?` m-${CLASSE_FORMATO[m]}`:' sem-celular'}`;
  const medida=id=>`data-campaign="${e(id)}" data-placement="${e(espaco.id)}"`;
  let semCelular=0;
  const html=pecas.length?pecas.map((a,i)=>{
    const f=formato(a.format||doEspaco),[w,h]=FORMATOS[f],m=a.imageMobile&&noCelular?noCelular:cel.includes(f)?f:'';
    if(!m)semCelular++;
    const fora=/^https?:\/\//.test(a.href);
    const fonte=a.imageMobile&&m?`<source media="(max-width: 700px)" srcset="${e(a.imageMobile)}">`:'';
    return `<a class="${classes(f,m)}" ${medida(a.id)} href="${e(a.href)}" rel="sponsored noopener noreferrer"${fora?' target="_blank"':''}${i?' hidden':''}>${tag(a.advertiser||'Nexus',fora)}<span class="vitrine-frame"><picture>${fonte}<img src="${e(a.image)}" alt="${e(a.title)}" width="${w}" height="${h}" loading="${eager?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer"></picture></span>${fora?'<span class="sr-only"> (abre em outra aba)</span>':''}</a>`;
  }).join(''):(()=>{
    if(!noCelular)semCelular++;
    return `<a class="${classes(formato(house.format||doEspaco),noCelular)} vitrine-house" ${medida(house.id)} href="${e(house.href||`/cadastro?interesse=${house.interesse}`)}">${tag('Nexus',false)}<span class="vitrine-frame"><span class="vitrine-house-body"><strong>Este espaço pode ser seu</strong><span class="vitrine-house-meta"><span>${e(house.name)}</span> · <span>${e(house.size)}</span> · <span>${e(house.price)}/mês</span></span><span class="vitrine-house-cta">Anunciar aqui <span aria-hidden="true">→</span></span></span></span></a>`;
  })();
  const n=pecas.length;
  const controles=n>1?`<div class="vitrine-controls"><button type="button" class="secondary" data-rotate="previous" aria-label="Anúncio anterior">${icone('M12.5 4.5L7 10l5.5 5.5')}</button><button type="button" class="secondary" data-rotate="toggle" aria-label="Pausar rodízio" aria-pressed="false">${icone('M7 4.5v11M13 4.5v11','i-pause')}${icone('M7 4.5l8 5.5-8 5.5z','i-play')}</button><button type="button" class="secondary" data-rotate="next" aria-label="Próximo anúncio">${icone('M7.5 4.5L13 10l-5.5 5.5')}</button><span class="vitrine-count">1 de ${n}</span></div>`:'';
  const some=espaco.celular===false||semCelular===Math.max(n,1)?' sem-celular':'';
  return `<aside class="vitrine-slot vitrine-${variant}${some}" aria-label="Vitrine" data-vitrine="${e(espaco.id)}"><div class="vitrine-stage">${html}</div>${controles}</aside>`;
}

// Espaço que se repete numa lista (aCada, contrato 11.4): depois de cada aCada itens, nunca depois do último, com o banner
// seguinte a cada repetição.
export function intercalar(itens,espaco,opcoes={}) {
  const n=espaco?.aCada||0,lista=espaco?.banners||[];
  if(!n||(!lista.length&&!espaco.house))return itens;
  return itens.flatMap((x,i)=>(i+1)%n||i===itens.length-1?[x]:[x,anuncio(espaco,{...opcoes,banners:lista.length?[lista[((i+1)/n-1)%lista.length]]:undefined})]);
}

// Coluna lateral de anúncio ao lado do conteúdo (fixa a partir de 1280px). Sem anúncio, só o conteúdo.
export function comLateral(conteudo,espaco) {
  const lado=anuncio(espaco,{variant:'lateral'});
  return lado?`<div class="vitrine-rail-layout"><div class="vitrine-rail-main">${conteudo}</div><div class="vitrine-rail">${lado}</div></div>`:conteudo;
}

// Formas de pagamento da empresa (v0.17.0, contrato 18.4), na ordem do contrato: perfil, painel e admin.
export const PAGAMENTOS={pix:'Pix',dinheiro:'Dinheiro',credito:'Cartão de crédito',debito:'Cartão de débito','vale-refeicao':'Vale-refeição','vale-alimentacao':'Vale-alimentação',boleto:'Boleto'};
