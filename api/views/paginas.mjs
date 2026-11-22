import { escape as e } from '../lib/html.mjs';
import { offerCard, eventCard, anuncio } from './componentes.mjs';

// vm Ofertas: ofertas vigentes dos parceiros, com condições e validade.
export function ofertasView(vm) {
  return `<section class="section-intro"><h1>Ofertas gastronômicas e culturais</h1><p>Confira menus especiais, degustações e condições diretamente com cada espaço.</p></section>${anuncio(vm.ads?.['ofertas-topo'],{eager:true})}<section class="offer-grid offers-page">${vm.items.map(offerCard).join('')||'<div class="empty"><h2>Nenhuma oferta publicada no momento.</h2><p>Explore o guia para conhecer os lugares do Rio.</p><a class="button" href="/busca">Explorar lugares</a></div>'}</section>`;
}

// vm Eventos: agenda cultural e gastronômica.
export const eventosView=(vm={})=>{
  const items=vm.items||[];
  return `<section class="section-intro"><h1>Agenda cultural e gastronômica</h1><p>${items.length?'Mostras, rodas de música, degustações e oficinas pelo Rio de Janeiro. Confirme data, horário e ingressos com o espaço.':'A agenda de eventos ainda não tem datas publicadas.'}</p>${items.length?'':'<a class="button" href="/busca">Explorar lugares</a>'}</section>${anuncio(vm.ads?.['eventos-topo'],{eager:true})}${items.length?`<section class="event-list">${items.map(eventCard).join('')}</section>`:''}`;
};

// Sobre o Nexus: projeto demonstrativo Full Stack de portfólio.
const PILARES=[
  ['Mapa & Descoberta','Exploração hiperlocal do Rio de Janeiro','O Nexus reúne restaurantes, cafés, bares, galerias, cinemas de rua e oficinas em um mapa SVG interativo gerado com malhas do IBGE e ruas do OpenStreetMap, com busca cruzada por categoria, bairro e status "aberto agora".'],
  ['Arquitetura Full Stack','SSR em Node.js, PostgreSQL e segurança','Construído sem frameworks pesados no servidor: data loaders desacoplados de views puras, migrações SQL, autenticação com scrypt + CSRF + RBAC (visitante, parceiro e equipe), CSP estrita e suíte automatizada de testes.'],
  ['Projeto de Portfólio','Dados públicos reais + recursos demo','Desenvolvido por Pedro Siqueira (com apoio de IA). Os 40 espaços culturais e gastronômicos são locais públicos reais do Rio de Janeiro (endereços, sites oficiais e fotos da Wikimedia Commons). Cupons, ofertas e contas de parceiro/admin são demonstrativos para teste técnico.']
];
const equipeSobre=(equipe=[])=>equipe.length?`<section class="about-team" aria-labelledby="about-team-title"><h2 id="about-team-title">Curadoria Nexus</h2><ul class="about-team-grid">${equipe.map(p=>`<li><figure class="about-person"><img src="${e(p.foto)}" alt="" width="400" height="400" loading="lazy" decoding="async"><figcaption><strong>${e(p.nome)}</strong>${p.funcao?`<span>${e(p.funcao)}</span>`:''}</figcaption></figure></li>`).join('')}</ul></section>`:'';
export const sobreView=(vm={})=>{
  const cards=PILARES.map(([etapa,titulo,texto],i)=>`<article class="card"><p class="eyebrow">0${i+1} · ${e(etapa.toUpperCase())}</p><h2>${e(titulo)}</h2><p>${e(texto)}</p></article>`).join('');
  return `<section class="section-intro about-intro"><p class="eyebrow">SOBRE O NEXUS</p><h1>Gastronomia, cultura e tecnologia no mesmo mapa.</h1><p>O Nexus é uma aplicação web Full Stack demonstrativa pensada para conectar moradores e visitantes à cena gastronômica e cultural do Rio de Janeiro.</p></section><section class="catalog-grid about-pillars" aria-label="Pilares do projeto">${cards}</section>${equipeSobre(vm.equipe)}<section class="about-cta" aria-labelledby="about-cta-title"><h2 id="about-cta-title">Explore o fluxo completo</h2><p>Navegue pelo guia público ou entre com uma das contas demonstrativas prontas para testar o Painel do Parceiro e o Admin.</p><div class="about-cta-actions"><a class="button" href="/entrar">Testar contas demo</a><a class="button secondary" href="/busca">Explorar lugares</a></div></section>`;
};

// Textos das páginas institucionais do ambiente demonstrativo Nexus.
const INSTITUCIONAL={
  faq:{title:'Perguntas frequentes',lead:'Respostas rápidas sobre como explorar o Nexus e testar os recursos da demonstração.',items:[
    ['Como encontro um lugar no Rio?','Busque por nome, categoria ou bairro na página inicial ou em <a href="/busca">Explorar</a>. O mapa interativo mostra os 20 espaços distribuídos pela cidade.'],
    ['Os estabelecimentos e cupons são reais?','Não. O Nexus é um projeto demonstrativo de portfólio: nomes, endereços comerciais, cupons, eventos e contatos são fictícios para teste das funcionalidades.'],
    ['Como testo o Painel do Parceiro e o Admin?','Acesse <a href="/entrar">Entrar</a> e clique em um dos botões de <strong>Acesso demonstrativo</strong> (Visitante, Parceiro ou Admin) para entrar com um clique.'],
    ['Como salvo meus lugares favoritos?','Toque no coração do card ou em “Salvar lugar” no perfil. A lista fica salva no navegador em <a href="/favoritos">Lugares salvos</a>.'],
    ['Como funciona a coleta de cupons?','Entre como Visitante em <a href="/entrar">Entrar</a>, acesse <a href="/cupons">Cupons</a> e clique em coletar. Seus códigos ficam guardados em <a href="/minha-conta">Minha conta</a>.']]},
  privacidade:{title:'Privacidade',lead:'Como o Nexus trata dados no ambiente demonstrativo.',items:[
    ['Medição de visitas','Opcional e ativada apenas se você aceitar no aviso de consentimento. Registra visitas, buscas agregadas e cliques sem dados pessoais identificáveis. Você pode alterar em “Preferências de medição”, no rodapé.'],
    ['Lugares salvos e tema','Favoritos, tema claro/escuro e escolha de consentimento ficam armazenados apenas no navegador local (localStorage).'],
    ['Sessões e segurança','Contas utilizam hash scrypt, cookie HttpOnly SameSite=Lax, proteção CSRF em escritas autenticadas e cabeçalho CSP estrito.'],
    ['Formulários de cadastro e contato','Neste ambiente de portfólio, os envios são validados no servidor apenas para demonstração, sem envio de mensagens externas.']]},
  termos:{title:'Termos de uso',lead:'Condições de uso da aplicação demonstrativa Nexus.',items:[
    ['Caráter demonstrativo','O Nexus é um projeto de portfólio Full Stack sem operação comercial. Todos os estabelecimentos, valores, ofertas, cupons e eventos são fictícios.'],
    ['Contas de teste','As contas demonstrativas disponibilizadas em /entrar destinam-se exclusivamente à avaliação técnica das áreas pública, do parceiro e administrativa.'],
    ['Dados cartográficos','Limites municipais fornecidos pelo IBGE e malha viária pelos colaboradores do OpenStreetMap (ODbL).'],
    ['Código e autoria','Desenvolvido por Pedro Siqueira como projeto demonstrativo de desenvolvimento Full Stack.']]}
};

// vm Institucional {title, key}: FAQ, termos e privacidade (key em faq, termos ou privacidade).
export const institucionalView=vm=>{
  const page=INSTITUCIONAL[vm.key]||INSTITUCIONAL.faq;
  return `<section class="hero institucional"><h1>${e(page.title)}</h1><p>${page.lead}</p><dl class="info-list">${page.items.map(([q,a])=>`<div><dt>${q}</dt><dd>${a}</dd></div>`).join('')}</dl><a class="more" href="/">← Voltar ao guia</a></section>`;
};

const buscaRapida='<form class="inline-search" action="/busca" method="get" role="search"><label>O que você procura?<input name="q" maxlength="100" placeholder="Restaurante, café, jazz, cinema..."></label><button>Buscar</button></form>';

// 404 genérico (caminho desconhecido) e 404 de lugar ou publicação indisponível.
export const naoEncontradaView=()=>`<section class="hero"><h1>Página não encontrada.</h1><p>O endereço pode ter mudado. Busque um lugar ou roteiro:</p>${buscaRapida}<a class="more" href="/">← Voltar à página inicial</a></section>`;
export const indisponivelView=()=>`<section class="section-intro"><h1>Página não encontrada.</h1><p>Esta publicação pode estar pausada ou indisponível. Explore outros lugares do guia:</p>${buscaRapida}<a class="button" href="/busca">Explorar lugares</a></section>`;
