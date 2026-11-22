import { escape as e } from '../lib/html.mjs';
import { data } from './painel.mjs';
import { anuncio as espacoAnuncio, intercalar, comLateral } from './componentes.mjs';

// v0.14.0 (contrato 14): cupons das empresas do guia, a página de cada cupom e a conta de quem coleta. O código só chega ao HTML
// de quem já coletou (o vm manda '' para os outros). Coletar exige login e sai pelo p2/cupons.js, com o X-CSRF-Token de
// conta.csrf no data-csrf do bloco; o perfil da empresa (sem conta no vm) leva à página do cupom. Publicidade (vm.ads, como nas
// outras páginas): cupons-topo, cupons-meio (um card a cada N cupons) e cupom-lateral; sem anúncio no vm, nada aparece.

const iniciais=n=>e(String(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase());
const entrarPara=id=>`/entrar?${new URLSearchParams({tipo:'usuario',next:`/cupons/${id}`})}`;
const numero=n=>Number(n||0).toLocaleString('pt-BR');

// Código coletado: o p2/cupons.js monta o mesmo bloco depois de coletar.
export const codigoCupom=cod=>`<div class="coupon-code"><span class="coupon-code-label">Seu código</span><strong class="coupon-code-value">${e(cod)}</strong><button type="button" class="link-button text-button" data-copiar-codigo="${e(cod)}">Copiar código</button></div>`;

// O que o cupom oferece agora: o código para quem coletou; "Coletar cupom" para quem está logado; "Entrar para coletar" para os
// outros; no perfil da empresa (conta undefined), o caminho para a página do cupom.
function acao(c,conta,titulo) {
  if(c.coletado&&c.codigo)return codigoCupom(c.codigo);
  if(c.esgotado)return '<p class="coupon-out">Este cupom esgotou.</p>';
  if(conta===undefined)return `<a class="button secondary" href="${e(c.href)}">Ver e coletar<span class="sr-only">: ${titulo}</span></a>`;
  if(!conta)return `<a class="button secondary" href="${e(entrarPara(c.id))}">Entrar para coletar<span class="sr-only">: ${titulo}</span></a>`;
  return `<button type="button" class="button" data-coletar="${e(c.id)}">Coletar cupom<span class="sr-only">: ${titulo}</span></button>`;
}

// CupomCard (14.3). nivel: o título do cartão (h2 na lista, h3 dentro de uma seção). empresa: false quando a página já é dela.
export function cupomCard(c,{conta,nivel=2,empresa=true}={}) {
  const emp=c.empresa||{},titulo=e(c.titulo),h=`h${nivel}`;
  const restam=c.esgotado?'<span class="state-tag is-pausado">Esgotado</span>':c.restantes==null?'':`<span>${c.restantes===1?'Resta 1':`Restam ${numero(c.restantes)}`}</span>`;
  const quem=empresa?`<p class="coupon-business"><span class="coupon-logo" aria-hidden="true">${emp.image?`<img src="${e(emp.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:iniciais(emp.name)}</span><span><a href="/comercio/${e(emp.slug)}">${e(emp.name)}</a>${emp.category||emp.district?`<small>${[emp.category,emp.district].filter(Boolean).map(e).join(' · ')}</small>`:''}</span></p>`:'';
  return `<article class="coupon-card${c.esgotado?' is-out':''}" data-cupom="${e(c.id)}"${emp.id?` data-cupom-empresa="${e(emp.id)}"`:''}><div class="coupon-main">${quem}<${h} class="coupon-title">${nivel===1?titulo:`<a href="${e(c.href)}">${titulo}</a>`}</${h}><p class="coupon-conditions">${e(c.condicoes)}</p><p class="coupon-meta"><span>Válido até ${data(c.validade)}</span>${restam}</p></div><div class="coupon-stub" data-cupom-acao>${acao(c,conta,titulo)}</div></article>`;
}
const anuncio='<p class="sr-only" data-cupom-anuncio aria-live="polite"></p>';
const bloco=(conta,html,cls)=>`<div class="${cls}"${conta?` data-cupons data-csrf="${e(conta.csrf)}"`:''}>${html}</div>`;

// vm Cupons (14.3): 24 por página, os mais novos primeiro, sem os esgotados. categorias traz só as que têm cupom.
export function cuponsView(vm={}) {
  const items=vm.items||[],q=vm.q||'',cat=vm.categoria||'',conta=vm.conta||null,pages=Number(vm.pages)||1,current=Number(vm.current)||1;
  const url=params=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(params))if(v&&!(k==='page'&&String(v)==='1'))p.set(k,String(v));const s=p.toString();return `/cupons${s?`?${s}`:''}`;};
  const grupos=vm.categorias||[],sub=grupos.flatMap(g=>g.subcategorias||[]).find(s=>s.slug===cat);
  const chips=grupos.length?`<nav class="quick-filters coupon-filters" aria-label="Filtrar por categoria"><a class="filter-chip" href="${e(url({q}))}"${cat?'':' aria-current="true"'}>Todos</a>${grupos.map(g=>`<a class="filter-chip" href="${e(url({q,categoria:g.slug}))}"${cat===g.slug?' aria-current="true"':''}>${e(g.label)}</a>`).join('')}${sub?`<a class="filter-chip" href="${e(url({q,categoria:sub.slug}))}" aria-current="true">${e(sub.label)}</a>`:''}</nav>`:'';
  const convite=conta?'':`<p class="coupon-login">Para coletar, <a href="${e(`/entrar?${new URLSearchParams({tipo:'usuario',next:'/cupons'})}`)}">entre na sua conta</a> ou <a href="${e(`/entrar/criar-conta?${new URLSearchParams({next:'/cupons'})}`)}">crie uma conta</a>. É grátis.</p>`;
  const intro=`<section class="section-intro"><h1>Cupons</h1><p>Descontos das empresas do guia. Colete o cupom e mostre o código na loja.</p>${convite}<form class="inline-search" action="/cupons"><label>Buscar cupom<input name="q" value="${e(q)}" maxlength="100" placeholder="Pizza, corte de cabelo, nome da loja…"></label>${cat?`<input type="hidden" name="categoria" value="${e(cat)}">`:''}<button>Buscar</button></form></section>`;
  const filtrado=q||cat;
  const lista=items.length?bloco(conta,intercalar(items.map(c=>cupomCard(c,{conta})),vm.ads?.['cupons-meio'],{variant:'card'}).join(''),'coupon-grid')
    :`<div class="empty"><h2>${filtrado?'Nenhum cupom com essa busca.':'Ainda não há cupons no ar.'}</h2><p>${filtrado?'Tente outro termo ou outra categoria.':'Quando as empresas do guia publicarem cupons, eles aparecem aqui.'}</p><a class="button" href="${filtrado?'/cupons':'/busca'}">${filtrado?'Ver todos os cupons':'Explorar empresas'}</a></div>`;
  const paginas=pages>1?`<nav class="pagination" aria-label="Páginas de cupons">${Array.from({length:pages},(_,i)=>`<a ${i+1===current?'aria-current="page"':''} href="${e(url({q,categoria:cat,page:i+1}))}">${i+1}</a>`).join('')}</nav>`:'';
  return `${intro}${espacoAnuncio(vm.ads?.['cupons-topo'],{eager:true})}${chips}${anuncio}${lista}${paginas}`;
}

// vm Cupom (14.3): o cupom, como usar, onde usar e até 4 outros cupons da mesma empresa.
export function cupomView(vm={}) {
  const c=vm.cupom||{},emp=c.empresa||{},conta=vm.conta||null,outros=vm.outros||[];
  const passos=`<section class="coupon-steps" aria-labelledby="como-usar"><h2 id="como-usar">Como usar</h2><ol><li><strong>Colete o cupom</strong> com a sua conta do guia.</li><li><strong>Mostre o código</strong> na loja, no celular ou anotado.</li><li><strong>Confira as condições</strong> e a validade antes de ir.</li></ol></section>`;
  const onde=`<section class="coupon-where" aria-labelledby="onde-usar"><h2 id="onde-usar">Onde usar</h2><p class="coupon-business"><span class="coupon-logo" aria-hidden="true">${emp.image?`<img src="${e(emp.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:iniciais(emp.name)}</span><span><strong>${e(emp.name)}</strong>${emp.category||emp.district?`<small>${[emp.category,emp.district].filter(Boolean).map(e).join(' · ')}</small>`:''}</span></p><a class="button secondary" href="/comercio/${e(emp.slug)}">Ver a empresa, o endereço e o WhatsApp <span aria-hidden="true">→</span></a></section>`;
  const mais=outros.length?`<section class="coupon-more" aria-labelledby="outros-cupons"><h2 id="outros-cupons">Outros cupons de ${e(emp.name)}</h2>${bloco(conta,outros.map(o=>cupomCard(o,{conta,nivel:3,empresa:false})).join(''),'coupon-grid')}</section>`:'';
  const convite=conta||c.coletado?'':`<p class="coupon-login">Ainda não tem conta? <a href="${e(`/entrar/criar-conta?${new URLSearchParams({next:`/cupons/${c.id}`})}`)}">Crie uma conta</a> para coletar. É grátis.</p>`;
  return `<p class="coupon-back"><a href="/cupons"><span aria-hidden="true">←</span> Todos os cupons</a></p>${comLateral(`<div class="coupon-detail">${bloco(conta,cupomCard(c,{conta,nivel:1}),'coupon-hero')}${convite}${anuncio}<div class="coupon-aside">${passos}${onde}</div></div>${mais}`,vm.ads?.['cupom-lateral'])}`;
}

// vm MinhaConta (14.3): os cupons coletados (com o código), os dados e, para a conta de usuário, sair e excluir a conta.
const SITUACAO={valido:['publicado','Válido'],vencido:['pausado','Vencido'],encerrado:['pausado','Encerrado']};
export function minhaContaView(vm={}) {
  const u=vm.usuario||{},cupons=vm.cupons||[],usuario=(u.tipo||'usuario')==='usuario';
  const item=c=>{
    const [cls,rot]=SITUACAO[c.situacao]||['pausado',e(c.situacao||'')],emp=c.empresa||{};
    const nota=c.situacao==='encerrado'?'<p class="my-coupon-note">A empresa ou o Nexus encerrou este cupom.</p>':c.situacao==='vencido'?`<p class="my-coupon-note">Venceu em ${data(c.validade)}.</p>`:`<p class="my-coupon-note">Válido até ${data(c.validade)}. Mostre o código na loja.</p>`;
    const titulo=c.situacao==='valido'?`<a href="${e(c.href)}">${e(c.titulo)}</a>`:e(c.titulo);
    return `<li class="my-coupon${c.situacao==='valido'?'':' is-past'}"><div class="my-coupon-info"><span class="state-tag is-${cls}">${rot}</span><h3>${titulo}</h3><p class="my-coupon-business"><a href="/comercio/${e(emp.slug)}">${e(emp.name)}</a></p>${nota}</div>${codigoCupom(c.codigo)}</li>`;
  };
  const meus=`<section class="panel-section" aria-labelledby="meus-cupons"><h2 id="meus-cupons">Meus cupons</h2>${cupons.length?`<ul class="my-coupons">${cupons.map(item).join('')}</ul>`:`<div class="panel-empty-state"><h3>Você ainda não coletou cupons</h3><p>Os cupons que você coletar ficam guardados aqui, com o código para mostrar na loja.</p><a class="button" href="/cupons">Ver os cupons</a></div>`}</section>`;
  const dados=`<section class="panel-section" aria-labelledby="seus-dados"><h2 id="seus-dados">Seus dados</h2><form class="account-form my-data" data-form="nome" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><div class="form-field"><label for="campo-nome">Nome</label><input type="text" id="campo-nome" name="nome" value="${e(u.nome||'')}" autocomplete="name" maxlength="80" required></div><p class="form-note">E-mail da conta: <strong>${e(u.email||'')}</strong></p><div class="account-actions"><button type="submit" class="button secondary">Salvar o nome</button></div></form></section>`;
  const outra=u.tipo==='afiliado'?`<p class="panel-readonly">Esta conta também cuida de uma empresa. <a href="/painel">Abrir o painel <span aria-hidden="true">→</span></a></p>`:u.tipo==='equipe'?`<p class="panel-readonly">Esta conta é da equipe Nexus. <a href="/admin">Abrir o admin <span aria-hidden="true">→</span></a></p>`:'';
  const excluir=usuario?`<details class="account-delete"><summary class="link-button text-button danger">Excluir minha conta</summary><form class="account-form" data-form="excluir" novalidate><p>A conta e os cupons coletados são apagados, e você sai do guia em todos os aparelhos. Não dá para desfazer.</p><div class="form-errors" role="alert" tabindex="-1" hidden></div><div class="form-field"><label for="campo-senha-excluir">Confirme com a sua senha</label><input type="password" id="campo-senha-excluir" name="senha" autocomplete="current-password" maxlength="128" required></div><div class="account-actions"><button type="submit" class="button secondary">Excluir a conta</button></div></form></details>`:'<p class="form-note">Contas de afiliado e da equipe são encerradas pelo Nexus.</p>';
  return `<section class="my-account" data-minha-conta data-csrf="${e(vm.csrf||'')}"><header class="my-account-head"><div><h1>Minha conta</h1><p>Olá${u.nome?`, ${e(u.nome)}`:''}. Aqui ficam os seus cupons e os seus dados.</p></div><button type="button" class="button secondary" data-sair>Sair</button></header><div class="panel-flash" data-conta-aviso role="status" tabindex="-1" hidden></div>${outra}${meus}${dados}<section class="panel-section" aria-labelledby="sair-conta"><h2 id="sair-conta" class="sr-only">Excluir a conta</h2>${excluir}</section></section>`;
}
