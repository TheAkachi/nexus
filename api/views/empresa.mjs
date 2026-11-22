import { escape as e } from '../lib/html.mjs';
import { image, link, money, horario, nota, decimal, anuncio, PAGAMENTOS } from './componentes.mjs';
import { cupomCard } from './cupons.mjs';

// Número legível a partir do link tel: (com ou sem 55 na frente).
const telefone=url=>{let d=url.replace(/\D/g,'');if(d.length>11&&d.startsWith('55'))d=d.slice(2);return d.length===11?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:d.length===10?`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`:d;};

// Cinco estrelas desenhadas, cheias até a nota arredondada; o texto ao lado diz a nota para quem não vê.
const estrela='<path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.7-4.2-4.1 5.8-.8z"/>';
const estrelas=n=>`<span class="stars" aria-hidden="true">${[1,2,3,4,5].map(i=>`<svg viewBox="0 0 20 20" class="${i<=Math.round(n)?'is-on':''}">${estrela}</svg>`).join('')}</span>`;

// Avaliações (Fase 2): média, quantidade, lista e a origem. Só aparecem quando o vm traz avaliação.
// Avaliações de moradores (v0.17.0, 18.4): separadas das do portal, só as aprovadas. O formulário aparece para quem tem conta e
// não tem vínculo com a empresa nem é da equipe; sem conta, o convite para entrar. Nenhuma nota vem marcada, nada em troca.
// O envio é do p2/avaliacao.js (X-CSRF-Token de data-csrf).
const NOTAS=['Muito ruim','Ruim','Regular','Boa','Ótima'];
function moradores(b) {
  const m=b.moradores||{total:0,itens:[]},av=b.avaliar;
  if(!m.total&&(!av||av.bloqueio))return '';
  const resumo=m.total?`<div class="reviews-summary"><strong class="reviews-avg">${decimal(m.media)}</strong><div>${estrelas(m.media)}<p><span class="sr-only">Nota ${decimal(m.media)} de 5, </span>${m.total} ${m.total===1?'avaliação de morador':'avaliações de moradores'}</p></div></div><ol class="reviews-list">${m.itens.map(r=>`<li class="review"><div class="review-head"><strong>${e(r.nome)}</strong><span class="review-badge">Morador</span>${r.data?`<span>${e(r.data)}</span>`:''}${estrelas(r.nota)}<span class="sr-only">Nota ${r.nota} de 5</span></div><p>${e(r.texto)}</p></li>`).join('')}</ol>`:'<p class="muted">Ainda não há avaliações de moradores.</p>';
  const volta=encodeURIComponent(`/comercio/${b.slug}#moradores`);
  let acao='';
  if(av&&!av.bloqueio){
    const minha=av.minha;
    if(!av.conta)acao=`<p class="resident-invite">Conhece este lugar? <a href="/entrar?next=${volta}">Entre</a> ou <a href="/entrar/criar-conta?next=${volta}">crie uma conta</a> para avaliar.</p>`;
    else if(minha?.status==='pendente')acao='<p class="resident-status" role="status">Sua avaliação foi enviada. Ela aparece aqui depois de aprovada pela curadoria Nexus.</p>';
    else if(minha?.status==='publicada')acao='<p class="resident-status">Você já avaliou este lugar. Obrigado por contar como foi.</p>';
    else acao=`<form class="resident-form" data-avaliacao="${e(b.slug)}" data-csrf="${e(av.csrf||'')}" novalidate><h3>Avalie sua visita</h3>${minha?.status==='recusada'?'<p class="muted">Sua avaliação anterior não foi publicada. Você pode enviar outra.</p>':''}<div class="form-errors" role="alert" tabindex="-1" hidden></div><fieldset class="resident-stars" id="campo-nota" data-campo="nota"><legend>Sua nota</legend><div class="resident-stars-row">${NOTAS.map((rotulo,i)=>`<label><input type="radio" name="nota" value="${i+1}" required><svg viewBox="0 0 20 20" aria-hidden="true">${estrela}</svg><span class="sr-only">${i+1} de 5: ${rotulo}</span></label>`).join('')}</div><p class="resident-star-label" data-nota-rotulo aria-hidden="true"></p></fieldset><div class="form-field"><label for="campo-texto">Conte como foi</label><textarea id="campo-texto" name="texto" rows="4" minlength="10" maxlength="600" required aria-describedby="texto-dica"></textarea><p class="field-hint" id="texto-dica" data-contador>De 10 a 600 caracteres.</p></div><p class="form-note">Seu primeiro nome aparece com a avaliação, depois de lida pela curadoria Nexus.</p><button type="submit">Enviar avaliação</button></form>`;
  }
  return `<section id="moradores" class="profile-section resident-reviews"><h2>Avaliações da comunidade</h2><p class="muted">Escritas por quem tem conta no Nexus.</p>${resumo}${acao}</section>`;
}

function avaliacoes(b) {
  const reviews=b.reviews||[];
  if(!b.reviewsCount||!reviews.length)return '';
  const origem=b.reviewsSource||'guia Nexus';
  return `<section id="avaliacoes" class="profile-section"><h2>Avaliações</h2><div class="reviews-summary"><strong class="reviews-avg">${decimal(b.rating)}</strong><div>${estrelas(b.rating)}<p><span class="sr-only">Nota ${decimal(b.rating)} de 5, </span>${b.reviewsCount} ${b.reviewsCount===1?'avaliação':'avaliações'} publicadas no ${e(origem)}</p></div></div><ol class="reviews-list">${reviews.map(r=>`<li class="review"><div class="review-head"><strong>${e(r.author||'Cliente')}</strong>${r.date?`<span>${e(r.date)}</span>`:''}${r.rating?`${estrelas(r.rating)}<span class="sr-only">Nota ${r.rating} de 5</span>`:''}</div>${r.title?`<p class="review-title">${e(r.title)}</p>`:''}${r.text?`<p>${e(r.text)}</p>`:''}</li>`).join('')}</ol></section>`;
}

// vm Empresa: perfil /comercio/<slug>. Os botões de contato levam data-contact e data-business para a medição do site.js
// (canais phone, whatsapp, website e map). Seções sem conteúdo não aparecem. No celular, a barra fixa repete WhatsApp,
// Ligar e Como chegar. Campos da Fase 2 (openNow, rating, reviews, directionsUrl, units, email, videoUrl) são opcionais.
// Formas de pagamento (v0.17.0, 18.4), na ordem do contrato; só aparecem quando a empresa preencheu.
const pagamentos=lista=>{const itens=(lista||[]).filter(p=>PAGAMENTOS[p]);return itens.length?`<h3>Formas de pagamento</h3><ul class="payment-list">${itens.map(p=>`<li>${PAGAMENTOS[p]}</li>`).join('')}</ul>`:'';};

export function empresaView(b) {
  // v0.17.0: o que abre o WhatsApp leva is-whatsapp (o verde, só nesses botões).
  const contact=(channel,href,label,cls='button secondary')=>`<a class="${cls}${channel==='whatsapp'?' is-whatsapp':''}" data-contact="${channel}" data-business="${e(b.id)}" href="${e(href)}"${channel==='phone'?'':' target="_blank" rel="noopener noreferrer"'}>${label}${channel==='phone'?'':' <span aria-hidden="true">↗</span>'}</a>`;
  const catalog=b.catalog,photos=b.photos.filter(p=>p.src),units=b.units||[];
  const phone=b.phoneUrl?telefone(b.phoneUrl):'';
  const rota=b.directionsUrl||b.mapUrl||'';
  const reviews=avaliacoes(b),residentes=moradores(b);
  const bar=b.whatsappUrl||b.phoneUrl?`<div class="contact-bar" role="group" aria-label="Falar com ${e(b.name)}" data-contact-bar>${b.whatsappUrl?contact('whatsapp',b.whatsappUrl,'WhatsApp','contact-bar-main'):''}${b.phoneUrl?contact('phone',b.phoneUrl,'Ligar','contact-bar-item'):''}${rota?contact('map',rota,'Como chegar','contact-bar-item'):''}</div>`:'';
  // Cupons no ar da empresa (v0.14.0, Empresa.cupons): coletar fica na página de cada cupom, que tem a conta de quem visita.
  const cupons=b.cupons||[];
  const couponSection=cupons.length?`<section id="cupons" class="profile-section"><div class="heading"><h2>Cupons</h2><span>${cupons.length} ${cupons.length===1?'cupom':'cupons'}</span></div><div class="coupon-grid">${cupons.map(c=>cupomCard(c,{nivel:3,empresa:false})).join('')}</div></section>`:'';
  const nav=[['sobre','Sobre'],cupons.length&&['cupons','Cupons'],catalog.length&&['catalogo','Catálogo'],photos.length&&['fotos','Fotos'],reviews&&['avaliacoes','Avaliações'],residentes&&['moradores','Moradores'],['localizacao','Como chegar']].filter(Boolean).map(([id,label])=>`<a href="#${id}">${label}</a>`).join('');
  const status=[horario(b),b.reviewsCount&&(b.reviews||[]).length?`<a class="rating-link" href="#avaliacoes">${nota(b.rating,b.reviewsCount)}</a>`:nota(b.rating,b.reviewsCount)].filter(Boolean).join('');
  const catalogSection=catalog.length?`<section id="catalogo" class="profile-section"><div class="heading"><h2>Produtos, serviços e ofertas</h2><span>${catalog.length} ${catalog.length===1?'item':'itens'}</span></div><div class="catalog-grid">${catalog.map(c=>`<article class="card"><p class="eyebrow">${{product:'Produto',service:'Serviço',offer:'Oferta'}[c.kind]}</p><h3>${e(c.name)}</h3><p>${e(c.description)}</p><strong class="price">${c.priceMode==='inquiry'?'Sob consulta':(c.priceMode==='from'?'A partir de ':'')+money(c.priceCents)}</strong><p class="muted">Consulte condições e disponibilidade com a empresa.</p></article>`).join('')}</div></section>`:'';
  const photoSection=photos.length?`<section id="fotos" class="profile-section"><h2>Um pouco mais de perto</h2><div class="gallery">${photos.map((p,i)=>`<a href="${e(p.href)}" target="_blank" rel="noopener noreferrer">${image(p.src,`Foto ${i+1} de ${b.name}`)}</a>`).join('')}</div></section>`:'';
  const extras=[b.email?`<a class="profile-email" href="mailto:${e(b.email)}">${e(b.email)}</a>`:'',b.videoUrl?link(b.videoUrl,'Assistir ao vídeo','profile-video'):''].filter(Boolean).join('');
  const endereco=b.address?`${e(b.address)}${b.cep?`<br><span class="muted">CEP ${e(b.cep)}</span>`:''}`:'Endereço não informado';
  // Horário da semana em linhas prontas (week); sem ele, o texto livre do acervo.
  const semana=(b.week||[]).length?`<table class="week-hours"><caption class="sr-only">Horário de funcionamento na semana</caption><tbody>${b.week.map(d=>`<tr${d.today?' class="is-today"':''}><th scope="row">${e(d.day)}${d.today?' <span class="today-tag">hoje</span>':''}</th><td>${e(d.label)}</td></tr>`).join('')}</tbody></table>`:`<p class="preserve">${e(b.hours||'Consulte a empresa')}</p>`;
  const caracteristicas=(b.features||[]).length?`<h3 class="features-title">Características</h3><ul class="feature-list">${b.features.map(f=>`<li>${e(f)}</li>`).join('')}</ul>`:'';
  const unidades=units.length?`<section class="info-card units-card"><h2>Outras unidades</h2><ul class="units-list">${units.map(u=>`<li><a href="/comercio/${e(u.slug)}">${e(u.name)}</a>${u.district?`<span>${e(u.district)}</span>`:''}</li>`).join('')}</ul></section>`:'';
  return `<nav class="breadcrumbs" aria-label="Caminho"><a href="/">Início</a><span aria-hidden="true">/</span><a href="/busca">Empresas</a><span aria-hidden="true">/</span><span>${e(b.name)}</span></nav><article data-profile="${e(b.id)}"><section class="profile-head"><div class="profile-image">${image(b.image,b.name,'',true)}</div><div class="profile-intro"><p class="eyebrow">${e(b.categories.join(' · ')||'NEGÓCIO LOCAL')}</p><h1>${e(b.name)}</h1><p class="location">${e(b.district||'Bairro não informado')} · ${e(b.city||'Rio de Janeiro')}</p>${status?`<div class="profile-status">${status}</div>`:''}<p>${e(b.summary)}</p><div class="actions">${b.whatsappUrl?contact('whatsapp',b.whatsappUrl,'Conversar no WhatsApp','button'):''}${b.phoneUrl?contact('phone',b.phoneUrl,`Ligar <span class="phone-number">${e(phone)}</span>`):''}${b.directionsUrl?contact('map',b.directionsUrl,'Como chegar'):''}${b.wazeUrl?contact('waze',b.wazeUrl,'Abrir no Waze'):''}<button class="favorite secondary" data-favorite="${e(b.slug)}" aria-pressed="false">♡ Salvar empresa</button></div><p class="muted">Confirme horários e disponibilidade direto com a empresa.</p></div></section><nav class="profile-nav" aria-label="Seções do perfil">${nav}</nav><div class="profile-columns"><div><section id="sobre" class="profile-section"><p class="eyebrow">CONHEÇA O NEGÓCIO</p><h2>Sobre ${e(b.name)}</h2>${b.description.map(p=>`<p>${e(p)}</p>`).join('')}${caracteristicas}<div class="socials">${b.socials.map(s=>link(s.url,s.label)).join('')}${extras}</div></section>${couponSection}${catalogSection}${photoSection}${reviews}${residentes}</div><aside><section id="localizacao" class="info-card"><p class="eyebrow">PLANEJE SUA VISITA</p><h2>Endereço e horário</h2><p>${endereco}</p>${b.referencia?`<p class="profile-reference"><span>Ponto de referência</span>${e(b.referencia)}</p>`:''}${b.mapUrl?contact('map',b.mapUrl,'Abrir no mapa'):''}<h3>Horário informado</h3>${horario(b)?`<p>${horario(b)}</p>`:''}${semana}${pagamentos(b.pagamentos)}${b.website?contact('website',b.website,'Visitar site'):''}<p class="muted">Horários podem mudar em feriados.</p></section>${unidades}${anuncio(b.ads?.['perfil-lateral'],{variant:'lateral'})}</aside></div></article>${bar}`;
}
