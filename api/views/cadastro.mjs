import { escape } from '../lib/html.mjs';
import { mensagemDoCadastro } from '../../p2/cadastro-mensagem.js';

// vm Cadastro e vm Contato: formulários que o servidor valida e transforma em mensagem para o WhatsApp da equipe Nexus.
// Com erro (422), values traz o que o visitante digitou e errors a lista de {campo, mensagem} (campo = name do input,
// '' para erro geral).
const normalizar = errors => errors.map(e => ({ campo: e.campo || '', mensagem: e.mensagem || String(e) }));

// Resumo no topo: cada erro de campo leva ao campo; site.js rola até ele e o anuncia.
const errorBox = errors => errors.length ? `<div class="form-errors" role="alert"><strong>Revise antes de continuar:</strong><ul>${errors.map(e => `<li>${e.campo ? `<a href="#campo-${escape(e.campo)}">${escape(e.mensagem)}</a>` : escape(e.mensagem)}</li>`).join('')}</ul></div>` : '';

// Campo com rótulo e, quando o servidor recusou o valor, aria-invalid e a mensagem logo abaixo (aria-describedby).
function campos(errors) {
  const erroDe = name => errors.find(e => e.campo === name);
  return (name, label, control, { full = false, extra = '' } = {}) => {
    const erro = erroDe(name);
    const attrs = `id="campo-${name}" name="${name}"${erro ? ` aria-invalid="true" aria-describedby="erro-${name}"` : ''}`;
    return `<div class="form-field${full ? ' full' : ''}${extra ? ' ' + extra : ''}${erro ? ' has-error' : ''}"><label>${label}${control(attrs)}</label>${erro ? `<p class="field-error" id="erro-${name}">${escape(erro.mensagem)}</p>` : ''}</div>`;
  };
}

// Aceite separado para novidades (demonstração): desmarcado por padrão; volta marcado só se o visitante marcou.
const novidades = (values, field) => field('novidades', '', attrs => `<input type="checkbox" value="sim" ${attrs}${values.novidades === 'sim' ? ' checked' : ''}><span>Quero receber novidades do Nexus (simulação).</span>`, { full: true, extra: 'form-check' });
const aviso = finalidade => `<p class="form-note">Ambiente demonstrativo: o formulário valida os dados no servidor e exibe um resumo ${finalidade} sem enviar mensagens externas. Saiba mais na <a href="/institucional/privacidade">Privacidade</a>.</p>`;

// Cadastro por escolhas (contrato, seção 17): cada pergunta é uma caixa de opções (rádio ou caixas de marcar), sem campo
// de texto. As respostas formam a mensagem para o WhatsApp da equipe Nexus, montada por mensagemDoCadastro, a mesma do servidor.
// Sem JavaScript, todas as caixas aparecem e o servidor monta a mensagem; com cadastro.js, elas surgem uma a uma e a prévia
// se escreve ao lado. Cada input leva o trecho (ou a frase própria) em data-*, para a prévia não depender de outra fonte.
const marcado = (values, p, o) => {
  const v = values[p.id];
  return (Array.isArray(v) ? v : v ? [v] : []).map(String).includes(String(o.valor));
};
function pergunta(p, i, total, values, erro) {
  const tipo = p.tipo === 'varias' ? 'checkbox' : 'radio';
  const dica = `${p.obrigatoria ? 'Obrigatória' : 'Opcional'} · ${p.tipo === 'varias' ? 'escolha quantas quiser' : 'escolha uma'}`;
  const opcoes = p.opcoes.map((o, j) => `<label class="quiz-chip"><input type="${tipo}" name="${escape(p.id)}" value="${escape(o.valor)}"${p.obrigatoria && tipo === 'radio' && j === 0 ? ' required' : ''}${marcado(values, p, o) ? ' checked' : ''}${typeof o.frase === 'string' ? ` data-frase="${escape(o.frase)}"` : ` data-trecho="${escape(o.trecho ?? o.rotulo)}"`}><span class="quiz-chip-rotulo">${escape(o.rotulo)}</span>${o.detalhe ? `<small>${escape(o.detalhe)}</small>` : ''}</label>`).join('');
  return `<li class="quiz-step${erro ? ' has-error' : ''}" data-pergunta="${escape(p.id)}" data-tipo="${tipo === 'radio' ? 'uma' : 'varias'}" data-bloco="${Number(p.bloco) || 1}" data-frase="${escape(p.frase)}"${p.obrigatoria ? ' data-obrigatoria' : ''}><fieldset id="campo-${escape(p.id)}" tabindex="-1"${erro ? ` aria-invalid="true" aria-describedby="erro-${escape(p.id)}"` : ''}><legend><span class="quiz-num">${i + 1} de ${total}</span><span class="quiz-q">${escape(p.titulo)}</span><span class="quiz-dica">${dica}</span></legend>${erro ? `<p class="field-error" id="erro-${escape(p.id)}">${escape(erro.mensagem)}</p>` : ''}<div class="quiz-options">${opcoes}</div></fieldset></li>`;
}

// O formulário de perguntas sozinho: o /cadastro e, compacto (v0.17.0, item 15), o topo de Para empresas.
export function formularioCadastro(vm, { compacto = false } = {}) {
  const { values = {}, perguntas = [], abertura = '', novidades: nov = {} } = vm;
  const errors = normalizar(vm.errors || []), field = campos(errors);
  const erroDe = id => errors.find(e => e.campo === id);
  // Na tela, o preço não se parte entre "R$" e o número (só a exibição; quem monta a mensagem enviada é o servidor).
  const texto = mensagemDoCadastro({ abertura, perguntas, novidades: nov }, values).replace(/R\$ /g, 'R$ ');
  const caixas = perguntas.map((p, i) => pergunta(p, i, perguntas.length, values, erroDe(p.id))).join('');
  const caixaNovidades = field('novidades', '', attrs => `<input type="checkbox" value="sim" ${attrs}${values.novidades === 'sim' ? ' checked' : ''}><span>Quero receber novidades do Nexus (simulação).</span>`, { full: true, extra: 'form-check' });
  const interesse = vm.origem ? `<input type="hidden" name="interesse" value="${escape(vm.origem)}">` : '';
  const confirmacao = vm.enviado ? `<div class="demo-confirm" role="status"><p class="eyebrow">ENVIO SIMULADO · AMBIENTE DEMO</p><h2>Solicitação registrada com sucesso</h2><p>Em produção, este resumo seria encaminhado à equipe comercial. Veja a mensagem gerada pelo servidor:</p><pre class="demo-summary">${escape(vm.enviado)}</pre><a class="button secondary" href="/entrar">Testar o Painel do Parceiro →</a></div>` : '';
  return `${confirmacao}<form class="signup-quiz${compacto ? ' is-compacto' : ''}" method="post" action="/cadastro" accept-charset="UTF-8" data-quiz data-abertura="${escape(abertura)}" data-novidades="${escape(nov.frase || '')}">${errorBox(errors)}${interesse}<div class="quiz-layout"><ol class="quiz-steps">${caixas}</ol><aside class="quiz-preview" aria-labelledby="quiz-preview-title" tabindex="-1"><h2 id="quiz-preview-title">Resumo do cadastro</h2><p class="quiz-progress" data-progresso aria-live="polite"></p><p class="quiz-message" data-mensagem${texto === abertura.replace(/R\$ /g, 'R$ ') ? ' data-vazia' : ''}>${escape(texto)}</p><p class="quiz-sem-js" data-sem-js>O resumo fica pronto com as suas respostas quando você toca em enviar.</p>${caixaNovidades}${aviso('deste cadastro')}<button type="submit">Simular envio</button></aside></div></form>`;
}

export const cadastroView = vm => `<section class="signup-quiz-page" aria-labelledby="signup-title"><div class="section-intro signup-intro"><p class="eyebrow">CADASTRO · NEXUS</p><h1 id="signup-title">Cadastre seu espaço</h1><p>Responda tocando nas opções para montar automaticamente o resumo de cadastro do seu restaurante, café, bar ou espaço cultural no Nexus.</p></div>
${formularioCadastro(vm)}</section>`;

export function contatoView(vm) {
  const { values } = vm;
  const errors = normalizar(vm.errors), field = campos(errors);
  const v = key => escape(values[key] || '');
  const confirmacao = vm.enviado ? `<div class="demo-confirm" role="status"><p class="eyebrow">MENSAGEM SIMULADA · AMBIENTE DEMO</p><h2>Mensagem validada pelo servidor</h2><pre class="demo-summary">${escape(vm.enviado)}</pre></div>` : '';
  return `<section class="contact-layout" aria-labelledby="contact-title"><div class="contact-copy"><p class="eyebrow">CONTATO · NEXUS</p><h1 id="contact-title">Vamos criar novas <span>conexões.</span></h1><p>Este é um projeto demonstrativo Full Stack criado para portfólio. Use o formulário ao lado para testar a validação server-side ou acesse o GitHub e o LinkedIn do autor.</p><div class="contact-channel"><span>AMBIENTE DEMONSTRATIVO</span><a href="/entrar">Testar contas demo (/painel e /admin) →</a><small>Quer simular o cadastro de um espaço? Use o <a href="/cadastro">formulário interativo</a>.</small></div></div>
<form class="contact-form" id="contato-form" method="post" action="/institucional/contato" accept-charset="UTF-8"><p class="eyebrow">MENSAGEM</p><h2>Envie uma mensagem de teste.</h2>${confirmacao}${errorBox(errors)}<div class="contact-fields">${field('nome', 'Seu nome', a => `<input ${a} value="${v('nome')}" autocomplete="name" required minlength="2" maxlength="80" placeholder="Nome e sobrenome">`, { full: true })}${field('assunto', 'Assunto (opcional)', a => `<input ${a} value="${v('assunto')}" maxlength="120" placeholder="Como podemos ajudar?">`, { full: true })}${field('mensagem', 'Mensagem', a => `<textarea ${a} rows="5" required minlength="5" maxlength="800" placeholder="Escreva sua mensagem">${v('mensagem')}</textarea>`, { full: true })}${novidades(values, field)}</div>${aviso('desta mensagem')}<button type="submit">Simular envio</button></form></section>`;
}
