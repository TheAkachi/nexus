import { escape as e } from '../lib/html.mjs';

// Fase 3 (contrato 12.3) e v0.14.0 (14.1 e 14.2): entrada do usuário (quem coleta cupons), do afiliado (quem cuida de uma
// empresa) e da equipe, e a conta nova do usuário. Os formulários falam com as APIs /api/auth/* pelo p2/conta.js (JSON com
// Origin); sem JavaScript, a página avisa.

// Campo com rótulo, controle e dica opcional. O erro do servidor ({erro, campo}) entra pelo JS (p2/formulario.js) logo abaixo
// do controle, com aria-invalid e aria-describedby, no mesmo padrão do cadastro.
export function campo(name,label,control,{full=false,dica='',extra='',id=`campo-${name}`}={}) {
  const ajuda=dica?`<p class="field-hint" id="dica-${id}">${dica}</p>`:'';
  return `<div class="form-field${full?' full':''}${extra?' '+extra:''}"><label for="${id}">${label}</label>${control(`id="${id}" name="${name}"${dica?` aria-describedby="dica-${id}"`:''}`)}${ajuda}</div>`;
}

// Senha com o botão de mostrar e ocultar (o p2/formulario.js alterna o tipo do campo).
export const senha=(attrs,autocomplete)=>`<div class="password-field"><input type="password" ${attrs} autocomplete="${autocomplete}" maxlength="128" required><button type="button" class="reveal secondary" data-revelar aria-pressed="false">Mostrar</button></div>`;

// Caixa de erros do formulário, preenchida pelo JS (a lista leva a cada campo).
const errosDoForm='<div class="form-errors" role="alert" tabindex="-1" hidden></div>';
const semJs='<noscript><p class="form-note">Para entrar na sua conta, ative o JavaScript do navegador.</p></noscript>';
const icone=d=>`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d}"/></svg>`;
const ok=icone('M4.5 10.5l3.5 3.5 7.5-8');

// Página da conta: título, o cartão com o formulário e o que a conta oferece. No celular, o formulário vem logo abaixo do título.
// tipo: 'afiliado' (área de quem cuida de uma empresa), 'usuario' (cupons) ou '' (as duas, na recuperação do acesso).
const INTRO={
  afiliado:[`<h1>Área do parceiro</h1><p class="account-lead">Gerencie seu espaço gastronômico ou cultural no Nexus, publique cupons e acompanhe o engajamento.</p>`,
    `<ul class="account-perks"><li>${ok}<span>Endereço, horário, telefone e redes atualizam no guia na hora.</span></li><li>${ok}<span>Cupons e ofertas publicados direto no perfil e no mapa.</span></li><li>${ok}<span>Visitas, cliques e aparições em buscas dos últimos 30 dias.</span></li></ul><p class="account-note">Quer divulgar um espaço no Nexus? <a href="/para-empresas">Conheça os formatos <span aria-hidden="true">→</span></a></p>`],
  usuario:[`<h1>Sua conta no Nexus</h1><p class="account-lead">Colete cupons de restaurantes, cafés e espaços culturais do Rio e guarde os códigos para usar na visita.</p>`,
    `<ul class="account-perks"><li>${ok}<span>Cupons de desconto nos lugares parceiros do guia.</span></li><li>${ok}<span>Os códigos ficam guardados em Minha conta.</span></li><li>${ok}<span>Grátis, só com nome, e-mail e senha.</span></li></ul><p class="account-note">Gerencia um espaço do guia? <a href="/entrar?tipo=afiliado">Entre na área do parceiro <span aria-hidden="true">→</span></a></p>`],
  '':[`<h1>Sua conta no Nexus</h1><p class="account-lead">Para visitantes que coletam cupons, parceiros que gerenciam espaços e a equipe de curadoria.</p>`,'']
};
function pagina(cartao,tipo='afiliado') {
  const [titulo,mais]=INTRO[tipo]??INTRO.afiliado;
  return `<section class="account-page"><div class="account-intro">${titulo}</div><div class="account-card">${cartao}</div>${mais?`<div class="account-more">${mais}</div>`:''}</section>`;
}
const comNext=(caminho,next,extra={})=>{const q=new URLSearchParams({...(next?{next}:{}),...extra}).toString();return `${caminho}${q?`?${q}`:''}`;};

const DEMO_ACESSO=`<div class="demo-access" aria-label="Contas de demonstração para portfólio">
  <p class="eyebrow">ACESSO DEMONSTRATIVO (PORTFÓLIO)</p>
  <p class="muted">Escolha um perfil para preencher e entrar automaticamente:</p>
  <div class="demo-buttons">
    <button type="button" class="secondary demo-btn" data-demo-email="visitante@nexus.demo" data-demo-senha="NexusDemo2026!"><strong>Visitante</strong><span>Cupons e avaliações</span></button>
    <button type="button" class="secondary demo-btn" data-demo-email="parceiro@nexus.demo" data-demo-senha="NexusDemo2026!"><strong>Parceiro</strong><span>Painel (/painel)</span></button>
    <button type="button" class="secondary demo-btn" data-demo-email="admin@nexus.demo" data-demo-senha="NexusDemo2026!"><strong>Admin</strong><span>Gestão (/admin)</span></button>
  </div>
</div>`;

// vm {next, motivo, tipo}: next é o caminho para voltar depois de entrar; motivo é '', 'expirou' ou 'saiu'; tipo ('usuario' ou
// 'afiliado') escolhe a aba aberta. O login é o mesmo para os dois e para a equipe: o destino depende da conta (p2/conta.js).
export function entrarView(vm={}) {
  const tipo=vm.tipo==='usuario'?'usuario':'afiliado';
  const aviso={expirou:'Sua sessão terminou por falta de uso. Entre de novo para continuar.',saiu:'Você saiu da sua conta.'}[vm.motivo]||'';
  const aba=(t,rotulo)=>`<a href="${e(comNext('/entrar',vm.next,{tipo:t}))}"${tipo===t?' aria-current="page"':''}>${rotulo}</a>`;
  const abas=`<nav class="account-switch" aria-label="Tipo de conta">${aba('usuario','Sou visitante')}${aba('afiliado','Sou parceiro')}</nav>`;
  const depois=tipo==='usuario'?`<p class="form-note">Ainda não tem conta? <a href="${e(comNext('/entrar/criar-conta',vm.next))}">Criar conta</a>. É grátis.</p>`:'<p class="form-note">Recebeu um convite do Nexus? Abra o link do convite para criar sua senha.</p>';
  return pagina(`${abas}${aviso?`<p class="account-flash" role="status">${aviso}</p>`:''}<h2>Entrar</h2><form class="account-form" data-conta="entrar" novalidate>${errosDoForm}${campo('email','E-mail',a=>`<input type="email" ${a} autocomplete="username" inputmode="email" maxlength="160" required>`)}${campo('senha','Senha',a=>senha(a,'current-password'))}<input type="hidden" name="next" value="${e(vm.next||'')}"><div class="account-actions"><button type="submit" class="button">Entrar</button><a href="/entrar/recuperar">Esqueci minha senha</a></div></form>${DEMO_ACESSO}${semJs}${depois}`,tipo);
}

// vm {next}: conta nova de usuário (14.4). A pessoa já sai logada e vai para next ou para os cupons.
export function criarContaView(vm={}) {
  const termos='Li e aceito os <a href="/institucional/termos" target="_blank" rel="noopener">termos de uso<span class="sr-only"> (abre em outra aba)</span></a> e a <a href="/institucional/privacidade" target="_blank" rel="noopener">política de privacidade<span class="sr-only"> (abre em outra aba)</span></a>.';
  return pagina(`<h2>Criar conta</h2><p>Com a conta, você coleta cupons e guarda os códigos para usar nas lojas do guia.</p><form class="account-form" data-conta="criar-conta" novalidate>${errosDoForm}${campo('nome','Nome',a=>`<input type="text" ${a} autocomplete="name" maxlength="80" required>`)}${campo('email','E-mail',a=>`<input type="email" ${a} autocomplete="username" inputmode="email" maxlength="160" required>`)}${campo('senha','Senha',a=>senha(a,'new-password'),{dica:'De 12 a 128 caracteres. Uma frase fácil de lembrar funciona bem.'})}<div class="form-field" data-campo="aceite"><label class="toggle accept"><input type="checkbox" name="aceite" required><span>${termos}</span></label></div><input type="hidden" name="next" value="${e(vm.next||'')}"><div class="account-actions"><button type="submit" class="button">Criar conta</button><a href="${e(comNext('/entrar',vm.next,{tipo:'usuario'}))}">Já tenho conta</a></div></form>${semJs}`,'usuario');
}

// vm {}: pedido do link de recuperação. A resposta é sempre a mesma, exista a conta ou não.
export function recuperarView() {
  return pagina(`<div data-conta-form><h2>Recuperar o acesso</h2><p>Informe o e-mail da sua conta. Se ele estiver cadastrado, mandamos um link para você criar uma nova senha. O link vale 1 hora.</p><form class="account-form" data-conta="recuperar" novalidate>${errosDoForm}${campo('email','E-mail',a=>`<input type="email" ${a} autocomplete="username" inputmode="email" maxlength="160" required>`)}<div class="account-actions"><button type="submit" class="button">Enviar o link</button><a href="/entrar">Voltar para entrar</a></div></form>${semJs}</div><div class="account-done" data-conta-feito tabindex="-1" hidden><h2>Confira seu e-mail</h2><p>Se houver uma conta com <strong data-conta-email></strong>, o link chega em alguns minutos. Olhe também a caixa de spam.</p><p>Não chegou? Fale com a equipe pelo <a href="/institucional/contato">contato</a> e pedimos um link novo para você.</p><a class="button secondary" href="/entrar">Voltar para entrar</a></div>`,'');
}

// vm {token, tipo, valido, email}: tipo é 'convite' ou 'recuperacao'; com o link vencido, usado ou inválido, valido é false.
export function definirSenhaView(vm={}) {
  if(!vm.valido)return pagina(`<h2>Este link não vale mais</h2><p>O link do convite vale 7 dias, o de recuperação vale 1 hora, e cada um funciona uma vez só.</p><div class="account-actions"><a class="button" href="/entrar/recuperar">Pedir um link novo</a><a href="/entrar">Entrar</a></div><p class="form-note">Se o convite venceu, peça um novo a quem convidou você ou à equipe Nexus.</p>`,'');
  const convite=vm.tipo==='convite';
  const titulo=convite?'Crie sua senha':'Defina uma nova senha';
  const texto=convite?`Seu acesso ao painel do Nexus${vm.empresa?`, para gerenciar <strong>${e(vm.empresa)}</strong>,`:''} está pronto${vm.convidadoPor?` (convite de ${e(vm.convidadoPor)})`:''}. Crie a senha da conta <strong>${e(vm.email)}</strong>.`:`Para a conta <strong>${e(vm.email)}</strong>. Ao salvar, as outras sessões abertas desta conta são encerradas.`;
  return pagina(`<div data-conta-form><h2>${titulo}</h2><p>${texto}</p><form class="account-form" data-conta="definir-senha" novalidate>${errosDoForm}<input type="hidden" name="token" value="${e(vm.token)}"><input type="email" name="usuario" value="${e(vm.email)}" autocomplete="username" hidden>${campo('senha','Nova senha',a=>senha(a,'new-password'),{dica:'De 12 a 128 caracteres. Uma frase fácil de lembrar funciona bem.'})}${campo('confirmar','Repita a senha',a=>senha(a,'new-password'))}<div class="account-actions"><button type="submit" class="button">Salvar a senha</button></div></form>${semJs}</div><div class="account-done" data-conta-feito tabindex="-1" hidden><h2>Senha salva</h2><p>Agora é só entrar com o seu e-mail e a senha nova.</p><a class="button" href="/entrar">Entrar</a></div>`,convite?'afiliado':'');
}
