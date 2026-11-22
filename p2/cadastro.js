import { mensagemDoCadastro } from './cadastro-mensagem.js';

// Cadastro por escolhas em cartões (16/10, pedido do usuário): uma pergunta por vez, no mesmo espaço. Responder troca o cartão pela
// próxima pergunta; "Voltar" leva à anterior; o último cartão mostra a mensagem para a equipe Nexus, a caixa de novidades e o envio.
// Sem este script, todas as perguntas e a mensagem aparecem de uma vez e o servidor monta a mesma mensagem (cadastro-mensagem.js).
// Um toque ou clique numa opção única passa sozinho para o próximo cartão; pelo teclado, as setas só mudam a escolha (o evento
// change dispara a cada seta), e quem avança é "Continuar". Opcionais têm "Pular". O cartão novo recebe o foco.
const form = document.querySelector('[data-quiz]');
if (form) {
  form.noValidate = true;
  form.classList.add('is-cartoes');
  form.querySelector('[data-sem-js]')?.setAttribute('hidden', '');
  const perguntasEl = [...form.querySelectorAll('.quiz-step')];
  const final = form.querySelector('.quiz-preview');
  const cartoes = [...perguntasEl, final];
  const caixaMensagem = form.querySelector('[data-mensagem]');
  const progresso = form.querySelector('[data-progresso]');
  const calmo = matchMedia('(prefers-reduced-motion: reduce)');
  const opcao = i => ({ valor: i.value, rotulo: i.closest('label')?.querySelector('.quiz-chip-rotulo')?.textContent || i.value, ...(i.hasAttribute('data-frase') ? { frase: i.dataset.frase } : { trecho: i.dataset.trecho }) });
  const perguntas = perguntasEl.map(li => ({ id: li.dataset.pergunta, tipo: li.dataset.tipo, bloco: Number(li.dataset.bloco) || 1, frase: li.dataset.frase, obrigatoria: li.hasAttribute('data-obrigatoria'), opcoes: [...li.querySelectorAll('input')].map(opcao) }));
  const definicao = { abertura: form.dataset.abertura, perguntas, novidades: { frase: form.dataset.novidades } };
  const valores = () => {
    const dados = new FormData(form), v = {};
    for (const p of perguntas) v[p.id] = p.tipo === 'varias' ? dados.getAll(p.id) : dados.get(p.id) || '';
    if (dados.get('novidades') === 'sim') v.novidades = 'sim';
    return v;
  };
  const respondida = li => !!li.querySelector('input:checked');
  const atualizar = () => {
    // O preço não se parte entre "R$" e o número na tela.
    caixaMensagem.textContent = mensagemDoCadastro(definicao, valores(), location.host).replace(/R\$ /g, 'R$ ');
    const n = perguntasEl.filter(respondida).length;
    progresso.textContent = `${n} de ${perguntasEl.length} perguntas respondidas`;
  };
  const erro = (li, texto) => {
    const fs = li.querySelector('fieldset'), id = `erro-${li.dataset.pergunta}`;
    let p = li.querySelector('.field-error');
    li.classList.toggle('has-error', !!texto);
    if (!texto) { p?.remove(); fs.removeAttribute('aria-invalid'); fs.removeAttribute('aria-describedby'); return; }
    if (!p) { p = document.createElement('p'); p.className = 'field-error'; p.id = id; fs.querySelector('legend').after(p); }
    p.textContent = texto;
    fs.setAttribute('aria-invalid', 'true');
    fs.setAttribute('aria-describedby', id);
  };

  // Mostra só o cartão i; o foco vai para ele (o título da pergunta ou "Sua mensagem"), e a página rola só se ele saiu da tela.
  let atual = 0;
  const mostrar = (i, { foco = true } = {}) => {
    atual = Math.max(0, Math.min(i, cartoes.length - 1));
    cartoes.forEach((c, k) => { c.hidden = k !== atual; c.classList.toggle('is-atual', k === atual); });
    if (cartoes[atual] === final) atualizar();
    if (!foco) return;
    const alvo = cartoes[atual] === final ? final : cartoes[atual].querySelector('fieldset');
    alvo.focus({ preventScroll: true });
    const r = cartoes[atual].getBoundingClientRect();
    if (r.top < 90 || r.top > innerHeight - 160) cartoes[atual].scrollIntoView({ behavior: calmo.matches ? 'auto' : 'smooth', block: 'start' });
  };
  const avancar = li => {
    if (li.hasAttribute('data-obrigatoria') && !respondida(li)) { erro(li, 'Escolha uma opção para continuar.'); li.querySelector('fieldset').focus(); return; }
    mostrar(cartoes.indexOf(li) + 1);
  };

  const botao = (texto, cls, acao) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = texto;
    b.addEventListener('click', acao);
    return b;
  };
  const voltar = cartao => botao('← Voltar', 'text-button quiz-back', () => mostrar(cartoes.indexOf(cartao) - 1));

  perguntasEl.forEach((li, i) => {
    const acoes = document.createElement('div');
    acoes.className = 'quiz-step-actions';
    if (i > 0) acoes.append(voltar(li));
    if (!li.hasAttribute('data-obrigatoria')) acoes.append(botao('Pular', 'text-button quiz-skip', () => { for (const x of li.querySelectorAll('input:checked')) x.checked = false; erro(li, ''); atualizar(); mostrar(i + 1); }));
    acoes.append(botao(i === perguntasEl.length - 1 ? 'Ver a mensagem' : 'Continuar', 'button secondary quiz-next', () => avancar(li)));
    li.querySelector('fieldset').append(acoes);
    let toque = 0;
    li.addEventListener('pointerdown', () => { toque = Date.now(); });
    li.addEventListener('change', e => {
      erro(li, '');
      atualizar();
      // Só a escolha única feita com toque ou clique troca o cartão sozinha, depois de mostrar a marcação.
      if (e.target.type === 'radio' && Date.now() - toque < 1500) setTimeout(() => { if (cartoes[atual] === li) avancar(li); }, 280);
    });
  });
  final.tabIndex = -1;
  final.querySelector('h2')?.after(voltar(final));
  form.querySelector('#campo-novidades')?.addEventListener('change', atualizar);

  form.addEventListener('submit', e => {
    const faltando = perguntasEl.find(li => li.hasAttribute('data-obrigatoria') && !respondida(li));
    if (!faltando) return;
    e.preventDefault();
    erro(faltando, 'Escolha uma opção para continuar.');
    mostrar(cartoes.indexOf(faltando));
  });

  // Começa na primeira pergunta; se o servidor devolveu erro (422), na primeira com erro, já com o foco nela.
  const comErro = perguntasEl.findIndex(li => li.classList.contains('has-error'));
  atualizar();
  mostrar(comErro >= 0 ? comErro : 0, { foco: comErro >= 0 });
}
