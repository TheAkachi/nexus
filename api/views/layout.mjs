import { escape } from '../lib/html.mjs';

// Imagem de compartilhamento padrão (p2/og-padrao.png, 1200 × 630). O servidor já manda ogImage absoluta;
// sem ela, o layout monta a URL a partir da origem do canonical.
const OG_PADRAO='/assets/og-padrao.png';
const OG_PADRAO_ALT='Nexus: Guia Gastronômico & Cultural do Rio de Janeiro';
const origemDe=url=>{try{return new URL(url).origin;}catch{return '';}};

// Open Graph e Twitter Card a partir do título, da descrição, da imagem e do canonical da rota.
function compartilhamento({title,description,canonical,ogImage,ogType}) {
  const image=ogImage||origemDe(canonical)+OG_PADRAO;
  const padrao=image.endsWith(OG_PADRAO);
  const alt=padrao?OG_PADRAO_ALT:title;
  const meta=(attr,key,value)=>`<meta ${attr}="${key}" content="${escape(value)}">`;
  return [
    meta('property','og:site_name','Nexus · Guia Gastronômico & Cultural'),meta('property','og:locale','pt_BR'),meta('property','og:type',ogType),
    meta('property','og:title',title),meta('property','og:description',description),meta('property','og:url',canonical),
    meta('property','og:image',image),meta('property','og:image:alt',alt),
    ...(padrao?[meta('property','og:image:width','1200'),meta('property','og:image:height','630')]:[]),
    meta('name','twitter:card','summary_large_image'),meta('name','twitter:title',title),meta('name','twitter:description',description),
    meta('name','twitter:image',image),meta('name','twitter:image:alt',alt)
  ].join('');
}

const CONTA={usuario:['/minha-conta','Minha conta'],afiliado:['/painel','Painel'],equipe:['/admin','Admin']};
export function layout({title,description='Descubra restaurantes, cafés, bares, eventos e espaços culturais no Rio de Janeiro com o Nexus.',canonical,indexable=false,path='/',ogImage='',ogType='website',menu={},script='',acao=null,trabalho=false,conta=null},body) {
  const [contaHref,contaRotulo]=conta?CONTA[conta.tipo]||CONTA.usuario:['/entrar','Entrar'];
  const entrada=`<a class="nav-account" href="${contaHref}"${path===contaHref?' aria-current="page"':''}>${contaRotulo}</a>`;
  const tema=`<button type="button" class="icon-button theme-toggle" data-theme-toggle aria-pressed="false" aria-label="Ativar tema escuro" title="Ativar tema escuro"><svg class="icon-lua" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z"/></svg><svg class="icon-sol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg></button>`;
  const cabecalhoTrabalho=`<header class="site-header reference-header work-header"><a class="brand-logo" href="/admin" aria-label="Nexus · Admin do guia"><img src="/assets/logo-nexus.svg" class="logo-claro" alt="" width="220" height="56"><img src="/assets/logo-nexus-branco.svg" class="logo-escuro" alt="" width="220" height="56"></a><p class="work-title">Admin do guia</p><div class="nav-actions">${tema}<a class="work-exit" href="/" target="_blank" rel="noopener">Ver o guia <span aria-hidden="true">↗</span><span class="sr-only"> (abre em outra aba)</span></a></div></header>`;
  const item=(href,label)=>`<a href="${href}" ${path===href?'aria-current="page"':''}>${label}</a>`;
  const desc=description.slice(0,170);
  return `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(desc)}"><meta name="robots" content="${indexable?'index,follow':'noindex,nofollow'}"><link rel="canonical" href="${escape(canonical)}">${compartilhamento({title,description:desc,canonical,ogImage,ogType})}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><script src="/assets/theme.js"></script><link rel="stylesheet" href="/assets/p2.css"><script type="module" src="/assets/site.js"></script>${script?`<script type="module" src="/assets/${escape(script)}"></script>`:''}</head><body><a class="skip" href="#main">Pular para conteúdo</a>${trabalho?cabecalhoTrabalho:`<header class="site-header reference-header"><a class="brand-logo" href="/" aria-label="Nexus · Página Inicial"><img src="/assets/logo-nexus.svg" class="logo-claro" alt="" width="220" height="56"><img src="/assets/logo-nexus-branco.svg" class="logo-escuro" alt="" width="220" height="56"></a><button id="menu-toggle" class="icon-button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menu">☰</button><nav id="main-nav" aria-label="Principal"><div class="nav-links"><a href="/" ${path==='/'?'aria-current="page"':''}>Início</a><a href="/busca" ${path==='/busca'?'aria-current="page"':''}>Explorar</a><a href="/cupons" ${path==='/cupons'||path.startsWith('/cupons/')?'aria-current="page"':''}>Cupons</a>${menu.eventos?item('/eventos','Eventos'):''}${menu.ofertas?item('/ofertas','Ofertas'):''}</div><div class="nav-actions">${tema}${entrada}${acao?`<a class="button nav-cta" href="${escape(acao.href)}">${escape(acao.label)}</a>`:'<a class="button nav-cta" href="/para-empresas">Divulgue aqui</a>'}</div></nav></header>`}<main id="main">${body}</main>${trabalho?'':`<footer><div><a class="brand" href="/" aria-label="Nexus · Página Inicial"><img src="/assets/logo-nexus.svg" class="logo-claro" alt="" width="220" height="56"><img src="/assets/logo-nexus-branco.svg" class="logo-escuro" alt="" width="220" height="56"><span>SEU RIO. SUAS CONEXÕES.</span></a><p>Gastronomia, cultura, eventos e descobertas<br>nos melhores bairros do Rio de Janeiro.</p></div><div><h2>Explore</h2><a href="/busca">Lugares</a><a href="/cupons">Cupons</a><a href="/eventos">Eventos</a><a href="/artigos">Roteiros e artigos</a><a href="/classificados">Classificados</a><a href="/favoritos">Lugares salvos</a></div><div><h2>Nexus</h2><a href="/cadastro">Cadastre seu espaço</a><a href="/institucional/sobre">Sobre o projeto</a><a href="/institucional/contato">Contato</a><a href="/institucional/faq">Perguntas frequentes</a><a href="/entrar?tipo=afiliado">Área do parceiro</a></div><div><h2>Transparência</h2><a href="/institucional/privacidade">Privacidade</a><a href="/institucional/termos">Termos</a><button id="privacy-settings" class="text-button">Preferências de medição</button></div></footer><section id="consent" class="consent" aria-label="Preferências de medição" hidden><div><strong>Você escolhe o que compartilhar.</strong><p>A medição opcional registra visitas e cliques, sem nome, telefone ou texto da busca. Sem aceitar, o guia continua funcionando.</p></div><div class="actions"><button id="consent-no" class="secondary">Recusar</button><button id="consent-yes">Permitir medição</button></div></section>`}</body></html>`;
}
