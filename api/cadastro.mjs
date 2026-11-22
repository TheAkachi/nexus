import { whatsappURL, cadastroVM, contatoVM, origemDe, CADASTRO, CONTATO, ABERTURA, NOVIDADES, PERGUNTAS, FALTA } from './data/cadastro.mjs';
import { mensagemDoCadastro } from '../p2/cadastro-mensagem.js';
import { rota } from './data/rota.mjs';

// POST de /cadastro e /institucional/contato: o servidor valida os campos, monta a mensagem e redireciona (303) para o
// WhatsApp da equipe Nexus. Nada é gravado no banco nem nos logs; quem envia a mensagem é o próprio visitante, dentro do WhatsApp.
// v0.23.0: com os leads ligados (contrato 23), o cadastro grava o pedido sem dado pessoal (api/data/pedidos.mjs).
// Com erro, devolve a mesma página (422) com os valores digitados e a lista de erros por campo.
const line = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const text = value => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
// Erro de um campo: {campo, mensagem}. Na transição para as views novas, String(erro) devolve a mensagem.
export const fieldError = (campo, mensagem) => Object.defineProperty({ campo, mensagem }, 'toString', { value: () => mensagem });
const siteName = origin => new URL(origin).host;
const compose = (intro, rows, message, origin) => [intro, '', ...rows.filter(([, v]) => v).map(([k, v]) => `*${k}:* ${v}`), ...(message ? ['', '*Mensagem:*', message] : []), '', `Enviado pelo site ${siteName(origin)}`].join('\n');
// Caixa opcional "quero receber novidades": só conta marcada (value="sim"); desmarcada nem vai no POST.
const novidades = fields => (line(fields.novidades) === 'sim' ? { novidades: 'sim' } : {});
const checkName = (errors, nome) => {
  if (nome.length < 2) errors.push(fieldError('nome', 'Informe seu nome com pelo menos 2 letras.'));
  else if (nome.length > 80) errors.push(fieldError('nome', 'Seu nome pode ter até 80 caracteres.'));
};

// Cadastro só com respostas de escolher (contrato 17.3): cada pergunta aceita só os valores da lista; o tipo 'varias' vem
// com a chave repetida. A mensagem sai do módulo do front (17.2), o mesmo da prévia.
const respostas = bruto => (Array.isArray(bruto) ? bruto : bruto === undefined ? [] : [bruto]).map(line).filter(Boolean);
// As respostas válidas e os erros por campo do POST /cadastro (17.3). Com os leads ligados (contrato 23.2), o servidor grava
// os values do envio válido e chama signupSubmission de novo com o codigo, que vira a última linha da mensagem.
export function respostasDoCadastro(fields) {
  const values = {}, errors = [];
  for (const p of PERGUNTAS) {
    const lista = [...new Set(respostas(fields[p.id]))], validos = new Set(p.opcoes.map(o => o.valor)), certas = lista.filter(v => validos.has(v));
    if (certas.length) values[p.id] = p.tipo === 'varias' ? certas : certas[0];
    if (certas.length < lista.length || (p.tipo === 'uma' && lista.length > 1)) errors.push(fieldError(p.id, 'Escolha uma opção da lista.'));
    else if (p.obrigatoria && !lista.length) errors.push(fieldError(p.id, FALTA[p.id] || 'Escolha uma opção.'));
  }
  Object.assign(values, novidades(fields));
  return { values, errors };
}
export function signupSubmission(fields, origin, { codigo = '' } = {}) {
  const { values, errors } = respostasDoCadastro(fields);
  if (errors.length) return rota('cadastro', cadastroVM({ values, errors, origem: origemDe(fields.interesse) }), { ...CADASTRO, status: 422 });
  return rota('cadastro', cadastroVM({ values, origem: origemDe(fields.interesse), enviado: textoDoCadastro(values, origin, codigo) }), CADASTRO);
}
// A mensagem do cadastro e, com o código do pedido, a linha "Pedido A7K3" no fim.
export const textoDoCadastro = (values, origin, codigo = '') =>
  mensagemDoCadastro({ abertura: ABERTURA, perguntas: PERGUNTAS, novidades: NOVIDADES }, values, siteName(origin)) + (codigo ? `\nPedido ${codigo}` : '');

export function contactSubmission(fields, origin) {
  const values = { nome: line(fields.nome), assunto: line(fields.assunto), mensagem: text(fields.mensagem), ...novidades(fields) };
  const errors = [];
  checkName(errors, values.nome);
  if (values.assunto.length > 120) errors.push(fieldError('assunto', 'Assunto: até 120 caracteres.'));
  if (values.mensagem.length < 5) errors.push(fieldError('mensagem', 'Escreva sua mensagem com pelo menos 5 caracteres.'));
  else if (values.mensagem.length > 800) errors.push(fieldError('mensagem', 'A mensagem pode ter até 800 caracteres.'));
  if (errors.length) return rota('contato', contatoVM({ values, errors }), { ...CONTATO, status: 422 });
  const resumo = compose('Mensagem recebida pelo Nexus (ambiente demonstrativo).', [['Nome', values.nome], ['Assunto', values.assunto], ['Novidades', values.novidades ? 'sim' : 'não']], values.mensagem, origin);
  return rota('contato', contatoVM({ values: {}, enviado: resumo }), CONTATO);
}
