import { $, api, limparErros, mostrarErros, ocupar } from './formulario.js';

// Avaliação de morador no perfil (v0.17.0, contrato 18.4): nota de 1 a 5 (nenhuma marcada) e texto de 10 a 600 caracteres.
// POST /api/empresas/:slug/avaliacoes com o X-CSRF-Token do data-csrf. Enviada, o formulário dá lugar ao aviso de que a
// avaliação aparece depois de lida pelo Nexus. Sem sessão (401), a tela leva ao login e volta para cá.
const NOTAS = ['Muito ruim', 'Ruim', 'Regular', 'Boa', 'Ótima'];
const form = $('[data-avaliacao]');
if (form) {
  const rotulo = $('[data-nota-rotulo]', form), contador = $('[data-contador]', form), texto = form.elements.texto;
  form.addEventListener('change', ev => {
    if (ev.target.name === 'nota') rotulo.textContent = `${ev.target.value} de 5 · ${NOTAS[ev.target.value - 1]}`;
  });
  texto.addEventListener('input', () => {
    const n = texto.value.trim().length;
    contador.textContent = n < 10 ? `De 10 a 600 caracteres · faltam ${10 - n}` : `${n} de 600 caracteres`;
  });
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    limparErros(form);
    const nota = Number(form.elements.nota.value), corpo = texto.value.trim(), erros = [];
    if (!nota) erros.push({ campo: 'nota', mensagem: 'Escolha uma nota de 1 a 5.' });
    if (corpo.length < 10) erros.push({ campo: 'texto', mensagem: 'Escreva pelo menos 10 caracteres sobre como foi.' });
    if (erros.length) return mostrarErros(form, erros);
    const pronto = ocupar(form.querySelector('[type=submit]'), 'Enviando…');
    const r = await api('POST', `/api/empresas/${encodeURIComponent(form.dataset.avaliacao)}/avaliacoes`, { corpo: { nota, texto: corpo }, csrf: form.dataset.csrf });
    pronto();
    if (r.ok) {
      const aviso = document.createElement('p');
      aviso.className = 'resident-status';
      aviso.setAttribute('role', 'status');
      aviso.tabIndex = -1;
      aviso.textContent = 'Sua avaliação foi enviada. Ela aparece aqui depois de lida pelo Nexus.';
      form.replaceWith(aviso);
      aviso.focus();
      return;
    }
    if (r.status === 401) return location.assign(`/entrar?next=${encodeURIComponent(location.pathname + '#moradores')}`);
    const mensagem = r.status === 409 ? 'Você já tem uma avaliação desta empresa.' : r.status === 403 ? 'Esta conta não pode avaliar esta empresa.' : r.erro;
    mostrarErros(form, [{ campo: r.campo, mensagem }]);
  });
}
