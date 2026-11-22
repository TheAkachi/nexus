// Mensagem do cadastro (contrato, seção 17): a mesma montagem na prévia do navegador (cadastro.js), na view e no servidor.
// Para cada pergunta respondida, na ordem: a frase própria da opção ou a frase da pergunta com os trechos no lugar de {}.
// Frases do mesmo bloco se juntam com espaço; blocos, com uma linha em branco. Abertura no início e o site no fim.
export const juntar = itens => itens.length < 2 ? (itens[0] || '') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;

// values: {id: 'valor'} ou {id: ['valor', ...]} no tipo 'varias'; novidades: 'sim' quando marcada.
export const respostas = (pergunta, values) => {
  const v = values?.[pergunta.id];
  const marcados = new Set((Array.isArray(v) ? v : v ? [v] : []).map(String));
  return pergunta.opcoes.filter(o => marcados.has(String(o.valor)));
};

export const fraseDa = (pergunta, escolhidas) => {
  if (!escolhidas.length) return '';
  const propria = escolhidas.find(o => typeof o.frase === 'string');
  if (propria) return propria.frase;
  return pergunta.frase.replace('{}', juntar(escolhidas.map(o => o.trecho ?? o.rotulo)));
};

export function mensagemDoCadastro({ abertura, perguntas, novidades }, values = {}, host = '') {
  const blocos = new Map();
  const somar = (bloco, frase) => { if (frase) blocos.set(bloco, [...(blocos.get(bloco) || []), frase]); };
  for (const p of perguntas) somar(p.bloco || 1, fraseDa(p, respostas(p, values)));
  if (values.novidades === 'sim' && novidades?.frase) somar(3, novidades.frase);
  const corpo = [...blocos.keys()].sort((a, b) => a - b).map(b => blocos.get(b).join(' '));
  return [abertura, ...corpo, ...(host ? [`Enviado pelo site ${host}`] : [])].filter(Boolean).join('\n\n');
}
