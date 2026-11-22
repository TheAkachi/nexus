import { escape as e } from '../lib/html.mjs';
import { campo } from './conta.mjs';
import { businessCard, PAGAMENTOS } from './componentes.mjs';

// Fase 3 (contrato 12.3): painel do anunciante. Uma view só, com o módulo em vm.modulo e os dados do GET da API do módulo em
// vm.dados. O servidor confere a permissão de cada ação; aqui o vm.pode só decide o que mostrar como editável. As escritas
// saem pelo p2/painel.js (fetch com X-CSRF-Token, lido de data-csrf) e, quando dão certo, a página recarrega com a confirmação.

const MODULOS=[['resumo','Resumo'],['perfil','Minha empresa'],['catalogo','Produtos e serviços'],['cupons','Cupons'],['resultados','Resultados'],['relatorio','Relatório do mês'],['solicitacoes','Solicitações e suporte'],['acessos','Acessos']];
const EM_BREVE=[['conteudo','Conteúdo'],['canais','Canais'],['plano','Plano'],['conecta','CONECTA']];
const TITULOS={
  resumo:['Resumo','Como a sua empresa está no guia e o que fazer agora.'],
  perfil:['Minha empresa','Nome, endereço, categorias, foto principal, horário, contatos e redes aparecem no guia assim que você salva. Textos e fotos novos passam pela aprovação do Nexus.'],
  catalogo:['Produtos e serviços','Cada item novo ou alterado passa pela aprovação do Nexus antes de aparecer no seu perfil.'],
  cupons:['Cupons','Descontos que o morador coleta no guia e mostra na sua loja. O cupom entra no ar na hora, sem passar pela aprovação.'],
  resultados:['Resultados','Visitas ao perfil, cliques para contato e aparições da sua empresa nas buscas do guia.'],
  relatorio:['Relatório do mês','Os números da sua empresa no guia num mês fechado, comparados com o mês anterior.'],
  solicitacoes:['Solicitações e suporte','Peça ajuda, uma alteração ou que o Nexus crie um anúncio para você.'],
  acessos:['Acessos','Quem cuida desta empresa no painel e o que cada pessoa pode fazer.'],
  empresas:['Suas empresas','Escolha a empresa que você quer cuidar agora.']
};
const PAPEIS={dono:'Dono',editor:'Editor',financeiro:'Financeiro',leitura:'Leitura'};
const PAPEL_AJUDA={dono:'tudo, inclusive convidar e tirar pessoas',editor:'perfil, produtos e solicitações',financeiro:'o que foi contratado e solicitações',leitura:'só vê, sem alterar'};
const STATUS_EMPRESA={published:'Publicada no guia',paused:'Pausada: fora do guia',draft:'Ainda não publicada'};
const STATUS_ITEM={rascunho:'Rascunho',validacao:'Aguardando aprovação',publicado:'Publicado',pausado:'Pausado'};
const TIPO_ITEM={produto:'Produto',servico:'Serviço',oferta:'Oferta'};
// Situação da solicitação dita como "de quem é a vez": respondida pede a resposta do associado.
const STATUS_SOL={aberta:'Enviada ao Nexus','em-andamento':'Com o Nexus',respondida:'Sua vez: o Nexus respondeu',fechada:'Encerrada'};
// WhatsApp da equipe Nexus: Painel.suporte.whatsappUrl (contrato 12.6); sem ele, o número do cadastro e do contato.
const SUPORTE_LINK='/institucional/contato';
const whatsappSuporte=(vm,texto='Falar com a equipe Nexus')=>{const url=vm.suporte?.whatsappUrl||SUPORTE_LINK;return `<a class="whatsapp-link" href="${e(url)}">${texto}</a>`;};
const TIPO_SOL={suporte:'Suporte',criacao:'Criação pelo Nexus',alteracao:'Alteração'};
const STATUS_FOTO={pendente:'Em análise',aprovada:'No perfil',recusada:'Recusada'};
const ANALISE={descricao:'Texto do perfil',foto:'Foto',catalogo:'Item do catálogo',oferta:'Oferta',banner:'Banner',avaliacao:'Avaliação',categoria:'Categoria nova'};
// O que depende do associado (Resumo.depende): o ícone diz se falta algo, se está parado ou se há resposta.
const PENDENCIA={completar:'falta',recusado:'falta',rascunho:'relogio',responder:'chat',convite:'relogio'};
export const DIAS=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
// Redes aceitas pelo servidor (painel.mjs do back, REDES): o valor é o próprio nome.
const REDES=[['Instagram','Instagram'],['Facebook','Facebook'],['TikTok','TikTok'],['YouTube','YouTube'],['LinkedIn','LinkedIn'],['X','X (Twitter)'],['Kwai','Kwai'],['Pinterest','Pinterest']];
const ESPACOS={'home-topo':'Topo da página inicial','home-destaques':'Página inicial, entre os destaques','home-comercial':'Página inicial, antes da área comercial','home-grade':'Página inicial, na grade',
  'busca-topo':'Topo da busca','busca-meio':'No meio dos resultados','busca-lateral':'Lateral da busca','busca-vazia':'Busca sem resultado','lista-topo':'Topo das listas de artigos e classificados','lista-meio':'No meio das listas de artigos e classificados',
  'leitura-texto':'No meio da leitura','leitura-lateral':'Lateral da leitura','leitura-fim':'Fim da leitura','perfil-lateral':'Perfis de outras empresas','ofertas-topo':'Topo das ofertas','eventos-topo':'Topo dos eventos'};

// Datas das APIs em aaaa-mm-dd (ou ISO completo): na tela, dd/mm/aaaa. Outro formato passa como veio.
export const data=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||'');return m?`${m[3]}/${m[2]}/${m[1]}`:e(v||'');};
export const numero=v=>Number(v||0).toLocaleString('pt-BR');
export const reais=c=>c==null?'':(c/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const preco=i=>i.precoModo==='consulta'||i.precoCentavos==null?'Sob consulta':`${i.precoModo==='a-partir'?'A partir de ':''}R$ ${reais(i.precoCentavos)}`;
export const opcoes=(lista,atual)=>lista.map(([v,l])=>`<option value="${e(v)}"${v===atual?' selected':''}>${e(l)}</option>`).join('');
const caminho=id=>`/painel/${e(encodeURIComponent(id))}`;

// Ícones desenhados (traço de 1,6), um por módulo e por ação.
const svg=(d,cls='')=>`<svg class="ico${cls?` ${cls}`:''}" viewBox="0 0 20 20" aria-hidden="true"><path d="${d}"/></svg>`;
export const ICONES={
  resumo:'M3.5 9.2L10 4l6.5 5.2V16a.8.8 0 0 1-.8.8H12v-4.6H8v4.6H4.3a.8.8 0 0 1-.8-.8z',perfil:'M3.2 7.6L4.6 3.8h10.8l1.4 3.8M3.2 7.6v8.6h13.6V7.6M3.2 7.6h13.6M8 16.2v-4h4v4',
  catalogo:'M10.6 3.2h5.8V9l-7.2 7.2-5.8-5.8zM13.4 6.2h.01',cupons:'M3 6h14v2.4a1.6 1.6 0 0 0 0 3.2V14H3v-2.4a1.6 1.6 0 0 0 0-3.2zM12 6v1.6M12 9.2v1.6M12 12.4V14',resultados:'M4 16.5v-6M10 16.5V4M16 16.5v-8.5',solicitacoes:'M3.5 4.5h13v8.6H9l-4 3.2v-3.2H3.5z',
  acessos:'M7.5 9.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 16.8c0-2.9 2.3-4.8 5-4.8s5 1.9 5 4.8M13.2 9.1a2.6 2.6 0 1 0 0-5.2M14.4 12.1c1.9.4 3.3 2 3.3 4.7',
  conteudo:'M5.2 3h7l3.3 3.3V17H5.2zM8.2 9.4h4.6M8.2 12.4h4.6',canais:'M3.4 8.2v3.6h3l5.8 3.9V4.3L6.4 8.2zM15 7.6a3.3 3.3 0 0 1 0 4.8',
  plano:'M3 5.2h14v9.6H3zM3 8.4h14',conecta:'M8.3 11.7l3.4-3.4M7.1 9.2l-1.9 1.9a2.9 2.9 0 0 0 4.1 4.1l1.9-1.9M12.9 10.8l1.9-1.9a2.9 2.9 0 0 0-4.1-4.1L8.8 6.7',
  ok:'M4.5 10.4l3.5 3.5 7.5-8',falta:'M10 6.2v4.6M10 13.8h.01M10 2.8l7.6 13.6H2.4z',mais:'M10 4.5v11M4.5 10h11',fechar:'M5.5 5.5l9 9M14.5 5.5l-9 9',
  seta:'M6.2 8l3.8 3.8L13.8 8',sair:'M8 4H4.5v12H8M12 6.8L15.2 10 12 13.2M15 10H8',fora:'M8.2 4.5H4.5v11h11v-3.7M11.5 4.5h4v4M15.2 4.8L9.5 10.5',
  relogio:'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6v4.2l2.8 1.7',copiar:'M7 7V4.5h8.5V13H13M4.5 7H13v8.5H4.5z',chat:'M3.5 4.5h13v8.6H9l-4 3.2v-3.2H3.5z',cadeado:'M5.5 9h9v7.5h-9zM7.2 9V6.8a2.8 2.8 0 0 1 5.6 0V9',
  relatorio:'M5 3h10v14H5zM8 13.6v-2.4M10 13.6V8.4M12 13.6v-3.6',imprimir:'M6 7.5V3.5h8v4M6 13.5H4.2V8.2h11.6v5.3H14M6 11.5h8v5H6z'
};
const icone=(nome,cls)=>svg(ICONES[nome]||'',cls);
export const fora='<span aria-hidden="true">↗</span><span class="sr-only"> (abre em outra aba)</span>';

// Seletor de empresa, sempre visível: com uma empresa só, o nome; com várias, uma lista que funciona sem JavaScript.
function seletor(vm) {
  const atual=vm.empresa,modulo=vm.modulo;
  const destino=x=>`${caminho(x.id)}${['perfil','catalogo','cupons','resultados','relatorio','solicitacoes'].includes(modulo)?`/${modulo}`:''}`;
  const nome=atual?e(atual.name):'Escolha a empresa';
  const troca=vm.empresas.length>1||!atual?`<details class="company-switch"><summary><span class="company-current">${nome}</span>${icone('seta','ico-chevron')}<span class="sr-only">: trocar de empresa</span></summary><ul>${vm.empresas.map(x=>`<li><a href="${destino(x)}"${atual&&x.id===atual.id?' aria-current="true"':''}><span>${e(x.name)}</span><small>${PAPEIS[x.papel]||e(x.papel)}</small></a></li>`).join('')}</ul></details>`:`<p class="company-current">${nome}</p>`;
  const meta=atual?`<div class="company-meta"><span class="company-status${atual.status==='published'?' is-live':''}">${STATUS_EMPRESA[atual.status]||e(atual.status)}</span>${atual.url?`<a href="${e(atual.url)}" target="_blank" rel="noopener">Ver página pública ${fora}</a>`:''}</div>`:'';
  return `<div class="panel-company"><p class="panel-label" id="empresa-atual">Empresa</p>${troca}${meta}</div>`;
}

function navegacao(vm) {
  if(!vm.empresa)return '';
  const base=caminho(vm.empresa.id);
  const itens=MODULOS.filter(([m])=>m!=='acessos'||vm.pode.acessos).map(([m,l])=>`<li><a href="${base}${m==='resumo'?'':`/${m}`}"${vm.modulo===m?' aria-current="page"':''}>${icone(m)}<span>${l}</span></a></li>`).join('');
  const breve=EM_BREVE.map(([m,l])=>`<li class="is-soon" aria-disabled="true">${icone(m)}<span>${l}</span><small>em breve</small></li>`).join('');
  return `<nav class="panel-nav" aria-label="Painel"><ul>${itens}${breve}</ul></nav><p class="panel-soon-note">Em breve no painel: Conteúdo, Canais, Plano e CONECTA.</p>`;
}

const conta=vm=>`<div class="panel-user"><p><strong>${e(vm.usuario.nome||vm.usuario.email)}</strong>${vm.usuario.nome?`<span>${e(vm.usuario.email)}</span>`:''}</p><button type="button" class="panel-logout secondary" data-sair>${icone('sair')}<span>Sair</span></button></div>`;

// Aviso para quem só pode ver: o servidor recusaria a escrita de qualquer jeito.
const leitura=(vm,oque)=>`<p class="panel-readonly">${icone('cadeado')}<span>Seu acesso nesta empresa é de ${(PAPEIS[vm.papel]||'leitura').toLowerCase()}: você vê ${oque}, mas não altera.</span></p>`;
export const vazio=texto=>`<p class="panel-empty">${texto}</p>`;

// Resumo: as 4 perguntas do PDF1.
function resumo(vm) {
  const r=vm.dados||{},a=r.aparece||{},base=caminho(vm.empresa.id);
  const completo=a.completo||[],feitos=completo.filter(c=>c.ok).length;
  // Comparação com os 30 dias anteriores, quando o vm traz (pedido ao back): "+12" ou "−3".
  const variacao=(agora,antes)=>typeof antes==='number'?` <span class="trend">${agora>=antes?'+':'−'}${numero(Math.abs(agora-antes))} em relação aos 30 dias anteriores</span>`:'';
  // O card que o morador vê na busca (CardEmpresa, quando o vm traz), inerte: é uma prévia, não um link.
  const previa=a.card?`<div class="appearance-preview" inert>${businessCard(a.card)}</div>`:'';
  const aparece=`<section class="panel-block block-aparece" aria-labelledby="q-aparece"><h2 id="q-aparece">Como minha empresa aparece?</h2>${previa?`<p class="panel-sentence">É assim que o morador vê a sua empresa na busca do guia:</p>${previa}`:''}<p class="panel-sentence"><strong>${numero(a.visitas30)}</strong> ${a.visitas30===1?'visita':'visitas'} ao perfil${variacao(a.visitas30,a.visitas30Antes)} e <strong>${numero(a.buscas30)}</strong> ${a.buscas30===1?'aparição':'aparições'} em buscas nos últimos 30 dias.</p><p class="panel-links">${vm.empresa.url?`<a href="${e(vm.empresa.url)}" target="_blank" rel="noopener">Ver página pública ${fora}</a>`:''}<a href="${base}/resultados">Ver resultados <span aria-hidden="true">→</span></a></p>${completo.length?`<h3>Perfil preenchido: ${feitos} de ${completo.length}</h3><svg class="progress" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect class="track" width="100" height="6"/><rect class="fill" width="${Math.round(feitos/completo.length*100)}" height="6"/></svg>${feitos<completo.length?`<p class="panel-empty">O que falta está em “O que depende de mim?”.</p>`:''}`:''}</section>`;
  const tarefas=r.depende||[];
  // A pergunta que pede ação vem primeiro e com destaque; o número de pendências vai no título.
  const depende=`<section class="panel-block block-depende${tarefas.length?' has-items':''}" aria-labelledby="q-depende"><h2 id="q-depende">O que depende de mim?${tarefas.length?` <span class="count-tag">${tarefas.length}</span>`:''}</h2>${tarefas.length?`<ul class="todo-list">${tarefas.map(t=>`<li>${icone(PENDENCIA[t.tipo]||'falta')}<a href="${e(t.href)}">${e(t.texto)}</a></li>`).join('')}</ul>`:vazio('Nada pendente agora. Quando faltar algo no perfil, um item voltar da aprovação ou o Nexus responder uma solicitação, aparece aqui.')}</section>`;
  const p=r.primig||{},analise=p.emAnalise||[],pedidos=p.solicitacoes||[],banners=p.banners||[];
  const partes=[
    analise.length&&`<h3>Em análise pelo Nexus</h3><ul class="plain-list">${analise.map(x=>`<li><span>${e(x.titulo)}</span><small>${ANALISE[x.tipo]||e(x.tipo)} · desde ${data(x.desde)}</small></li>`).join('')}</ul>`,
    pedidos.length&&`<h3>Suas solicitações</h3><ul class="plain-list">${pedidos.map(s=>`<li><a href="${base}/solicitacoes#sol-${e(s.id)}">${e(s.assunto)}</a><span class="state-tag is-${e(s.status)}">${STATUS_SOL[s.status]||e(s.status)}</span></li>`).join('')}</ul>`,
    banners.length&&`<h3>Banners no ar</h3><ul class="plain-list">${banners.map(b=>`<li><span>${e(b.titulo)}</span><small>${ESPACOS[b.espaco]||e(b.espaco)}${b.ate?` · até ${data(b.ate)}`:''}</small></li>`).join('')}</ul>`
  ].filter(Boolean).join('');
  const primig=`<section class="panel-block" aria-labelledby="q-primig"><h2 id="q-primig">O que o Nexus está fazendo?</h2>${partes||vazio('Nenhum pedido em andamento. Para o Nexus criar um banner ou um post para o seu espaço, use “Solicitar criação ao Nexus”.')}<p class="panel-links">${whatsappSuporte(vm)}</p></section>`;
  const c=r.contratado;
  const nomePlano=c?.plano&&(typeof c.plano==='string'?c.plano:c.plano.nome||c.plano.name||'');
  const bannersContratados=(c?.banners||[]).length?`<h3>Banners contratados</h3><ul class="plain-list">${c.banners.map(b=>`<li><span>${e(b.titulo||b.name||'')}</span><small>${ESPACOS[b.espaco]||e(b.espaco||'')}${b.ate?` · até ${data(b.ate)}`:''}</small></li>`).join('')}</ul>`:'';
  // Com a "Minha assinatura" da gestão (19.6), ela toma o lugar do "O que contratei?".
  if(c?.assinatura)return `<div class="summary-grid">${depende}${aparece}${primig}${minhaAssinatura(vm,c.assinatura,bannersContratados)}</div>`;
  const contrato=c===null||c===undefined?vazio('Só o dono e o financeiro da empresa veem o que foi contratado.'):`${nomePlano?`<dl class="panel-dl"><div><dt>Plano</dt><dd>${e(nomePlano)}</dd></div></dl>`:vazio('O plano desta empresa ainda não está no painel: o Nexus está cadastrando os planos.')}${bannersContratados}<p class="panel-links">${whatsappSuporte(vm,'Dúvidas sobre o plano? Fale com a equipe Nexus')}</p>`;
  const contratado=`<section class="panel-block" aria-labelledby="q-contratado"><h2 id="q-contratado">O que contratei?</h2>${contrato}</section>`;
  return `<div class="summary-grid">${depende}${aparece}${primig}${contratado}</div>`;
}

// "Minha assinatura" (19.6): o que a gestão do Nexus mandou desta empresa. O plano, o valor e o ciclo, o vencimento com a
// situação (calculada pelo site no dia de São Paulo), os últimos pagamentos e como pagar: a chave Pix, com o botão de copiar
// (p2/painel.js), e o WhatsApp do atendimento. Nada do cliente nem da equipe vem aqui.
const POR_CICLO={mensal:'por mês',trimestral:'por trimestre',semestral:'por semestre',anual:'por ano'};
const FORMA={pix:'Pix',dinheiro:'Dinheiro',cartao:'Cartão',boleto:'Boleto',transferencia:'Transferência','mercado-pago':'Mercado Pago'};
const quando=v=>{const d=new Date(v||'');if(!v||Number.isNaN(d.getTime()))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;};
const zap=d=>{const m=/^55(\d{2})(\d{4,5})(\d{4})$/.exec(String(d||''));return m?`(${m[1]}) ${m[2]}-${m[3]}`:e(d||'');};
function situacaoAssinatura(a) {
  const d=Number(a.dias);
  if(a.situacao==='suspensa')return ['suspensa','Suspensa'];
  if(a.situacao==='vencida')return ['vencida',d===-1?'Venceu ontem':`Venceu há ${numero(-d)} dias`];
  if(a.situacao==='a-vencer')return ['a-vencer',d===0?'Vence hoje':d===1?'Vence amanhã':`Vence em ${numero(d)} dias`];
  return ['em-dia','Em dia'];
}
function minhaAssinatura(vm,a,bannersContratados) {
  const [sit,rotulo]=situacaoAssinatura(a),pix=a.comoPagar?.chavePix||'',whats=a.comoPagar?.whatsapp||'',pagamentos=a.ultimosPagamentos||[];
  const valor=a.valorCentavos!=null?`R$ ${reais(a.valorCentavos)} ${POR_CICLO[a.ciclo]||''}`.trim():'';
  // Vencida ou perto de vencer: a frase diz o que fazer. Suspensa: quem resolve é o atendimento.
  const pedido=sit==='vencida'?'O pagamento está atrasado. Faça o Pix e mande o comprovante pelo WhatsApp do atendimento.'
    :sit==='a-vencer'&&Number(a.dias)<=7?'O vencimento está perto. Faça o Pix e mande o comprovante pelo WhatsApp do atendimento.'
    :sit==='suspensa'?'A assinatura está suspensa. Fale com o atendimento para voltar.':'';
  const dados=`<dl class="panel-dl"><div><dt>Plano</dt><dd>${e(a.plano?.nome||'Sem plano')}</dd></div>${valor?`<div><dt>Valor</dt><dd>${valor}</dd></div>`:''}<div><dt>Vencimento</dt><dd class="subscription-due"><span class="state-tag is-${sit}">${rotulo}</span>${a.venceEm?`<span>${data(a.venceEm)}</span>`:''}</dd></div></dl>`;
  const lista=pagamentos.length?`<ul class="plain-list">${pagamentos.map(p=>`<li><span>R$ ${reais(p.valorCentavos)} · ${FORMA[p.forma]||e(p.forma||'')}</span><small>pago em ${data(p.pagoEm)}${p.referencia?.de?` · de ${data(p.referencia.de)} a ${data(p.referencia.ate)}`:''}</small></li>`).join('')}</ul>`:vazio('Nenhum pagamento registrado ainda.');
  const empresa=vm.empresa?.name||'empresa',texto=`Olá! Sou da ${empresa} e quero falar sobre a minha assinatura do Nexus.`;
  // Sem o WhatsApp do atendimento, vai o da equipe Nexus: o número de suporte.whatsappUrl (12.6), com a mensagem da assinatura no
  // lugar da mensagem geral do painel.
  const suporteUrl=vm.suporte?.whatsappUrl||SUPORTE_LINK;
  const pagar=[
    pix&&`<div class="pix-key"><p><span class="panel-label">Chave Pix</span><code>${e(pix)}</code></p><button type="button" class="secondary" data-copiar-pix="${e(pix)}">${icone('copiar')}<span>Copiar a chave</span></button></div>`,
    whats?`<p class="panel-links"><a class="whatsapp-link" href="${e(`https://wa.me/${whats}?${new URLSearchParams({text:texto})}`)}" target="_blank" rel="noopener">Falar com o atendimento no WhatsApp, ${zap(whats)} ${fora}</a></p>`
      :`<p class="panel-links"><a class="whatsapp-link" href="${e(suporteUrl)}">Dúvidas sobre a assinatura? Fale com a equipe Nexus</a></p>`
  ].filter(Boolean).join('');
  const atualizada=quando(a.atualizadaEm);
  return `<section class="panel-block block-assinatura${sit==='vencida'?' is-late':''}" aria-labelledby="q-contratado"><h2 id="q-contratado">Minha assinatura</h2>${dados}${pedido?`<p class="panel-sentence subscription-ask">${pedido}</p>`:''}<h3>Últimos pagamentos</h3>${lista}<h3>Como pagar</h3>${pix?'':vazio('A Nexus ainda não informou a chave Pix. Fale com o atendimento.')}${pagar}${bannersContratados}${atualizada?`<p class="panel-note">Atualizado pelo Nexus em ${atualizada}.</p>`:''}</section>`;
}

// Minha empresa: horário da semana, contatos, redes e textos num formulário; fotos com envio e prévia à parte.
export const intervalo=(d,h={})=>`<div class="hours-interval"><label><span class="sr-only">${DIAS[d]}, abre às</span><input type="time" data-abre value="${e(h.abre||'08:00')}" required></label><span class="hours-sep" aria-hidden="true">às</span><label><span class="sr-only">${DIAS[d]}, fecha às</span><input type="time" data-fecha value="${e(h.fecha==='24:00'?'00:00':h.fecha||'18:00')}" required></label><button type="button" class="icon-button small" data-tirar-intervalo aria-label="Tirar este horário de ${DIAS[d].toLowerCase()}">${icone('fechar')}</button></div>`;
export const rede=(r={},i)=>`<div class="social-row"><label><span class="sr-only">Rede ${i+1}</span><select data-rede>${opcoes(REDES,r.rede||'Instagram')}</select></label><label class="social-url"><span class="sr-only">Endereço da rede ${i+1}</span><input type="text" data-url value="${e(r.url||'')}" placeholder="@suaempresa ou o link" maxlength="300" inputmode="url" autocapitalize="off" spellcheck="false"></label><button type="button" class="icon-button small" data-tirar-rede aria-label="Tirar esta rede">${icone('fechar')}</button></div>`;

// Semana de horários (Minha empresa e o cadastro da empresa no admin): dias abertos com um ou mais intervalos.
export const semana=horario=>[1,2,3,4,5,6,0].map(d=>{
  const lista=(horario||[]).filter(h=>h.dia===d),aberto=lista.length>0;
  return `<div class="hours-day" data-dia="${d}"><div class="hours-head"><span class="hours-name" id="dia-${d}">${DIAS[d]}</span><label class="toggle"><input type="checkbox" data-aberto${aberto?' checked':''}><span>Aberto</span><span class="sr-only"> na ${DIAS[d].toLowerCase()}</span></label></div><div class="hours-list" data-intervalos>${lista.map(h=>intervalo(d,h)).join('')}</div><button type="button" class="link-button text-button" data-mais-intervalo${aberto?'':' hidden'}>${icone('mais')}Outro horário no dia</button></div>`;
}).join('');

function perfil(vm) {
  const p=vm.dados||{},pode=vm.pode.perfil,analise=new Set(p.emAnalise||[]),dis=pode?'':' disabled';
  const emAnalise=c=>analise.has(c)?' <span class="review-tag">Em análise</span>':'';
  const horario=semana(p.horario);
  // Nome, endereço, categorias e foto principal (v0.14.0, 14.5): publicam na hora, como o horário. As categorias vêm da lista
  // única (Perfil.opcoes), até 8; a foto principal é uma das fotos aprovadas, inclusive as que vieram do portal.
  const o=p.opcoes||{},marcadas=new Set(p.categorias||[]),vistas=new Set();
  const grupos=(o.categorias||[]).map(g=>{
    const subs=(g.subcategorias||[]).filter(s=>!vistas.has(s.label)&&vistas.add(s.label));if(!subs.length)return '';
    const n=subs.filter(s=>marcadas.has(s.label)).length;
    return `<details class="category-group"${n?' open':''}><summary>${e(g.label)}${n?` <span class="count-tag">${n}</span>`:''}</summary><div class="check-options">${subs.map(s=>`<label class="toggle"><input type="checkbox" name="categorias" value="${e(s.label)}"${marcadas.has(s.label)?' checked':''}><span>${e(s.label)}</span></label>`).join('')}</div></details>`;
  }).join('');
  const foraDaLista=[...marcadas].filter(c=>!vistas.has(c)).map(c=>`<label class="toggle"><input type="checkbox" name="categorias" value="${e(c)}" checked><span>${e(c)}</span></label>`).join('');
  // Categoria fora da lista (v0.22.0, 22.4): a sugestão vai junto do "Salvar" para a fila do Nexus, e a empresa continua nas
  // categorias marcadas até a equipe decidir. A pendente aparece em análise, com o retirar; a recusada, com o comentário.
  const s=p.sugestaoCategoria,pendente=s?.status==='pendente';
  const sugestao=pendente?`<div class="category-suggestion"><p><span class="review-tag">Em análise</span> Você sugeriu a categoria <strong>${e(s.nome)}</strong>${s.grupo?.label?`, em ${e(s.grupo.label)}`:''}${s.em?`, em ${data(s.em)}`:''}. Ela entra na empresa quando o Nexus aprovar.</p>${pode?'<button type="button" class="link-button text-button" data-retirar-sugestao>Retirar a sugestão</button>':''}</div>`
    :s?.status==='recusada'?`<div class="category-suggestion is-refused"><p>A Nexus não aprovou a categoria <strong>${e(s.nome)}</strong>${s.comentario?`: “${e(s.comentario)}”`:'.'} Você pode sugerir outra.</p></div>`:'';
  const sugerir=pode?`<details class="category-new" data-campo="sugestaoCategoria"><summary class="link-button text-button">${icone('mais')}${pendente?'Sugerir outra no lugar…':'Outra categoria…'}</summary><div class="category-new-body"><p class="field-hint">Não achou a categoria da sua empresa? Sugira uma: ela passa pela equipe do Nexus antes de aparecer no guia. Até lá, a empresa continua nas categorias marcadas.</p><div class="form-grid">${campo('sugestaoNome','Nome da categoria',a=>`<input type="text" ${a} maxlength="60" autocomplete="off" placeholder="Ex.: Pizzarias">`)}${campo('sugestaoGrupo','Grupo',a=>`<select ${a}><option value="">Escolha o grupo</option>${opcoes((o.categorias||[]).map(g=>[g.slug,g.label]),'')}</select>`)}</div><p class="form-note">A sugestão vai junto quando você salvar.</p></div></details>`:'';
  const aprovadas=(p.fotos||[]).filter(f=>f.status==='aprovada');
  const opcaoFoto=(url,rotulo,img='')=>`<label class="main-photo"><input type="radio" name="imagem" value="${e(url)}"${(p.imagem||'')===url?' checked':''}>${img}<span>${rotulo}</span></label>`;
  const miniatura=url=>`<img src="${e(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  const principal=`<div class="form-field full main-photos" data-campo="imagem"><span class="field-label">Foto principal</span><p class="field-hint">A foto do card na busca e do topo do perfil. Escolha entre as fotos aprovadas.</p><div class="main-photo-grid">${aprovadas.map(f=>opcaoFoto(f.url,f.alt?e(f.alt):'Sem descrição',miniatura(f.url))).join('')}${p.imagem&&!aprovadas.some(f=>f.url===p.imagem)?opcaoFoto(p.imagem,'Foto atual',miniatura(p.imagem)):''}${opcaoFoto('','Sem foto principal')}</div></div>`;
  const empresa=`<fieldset class="panel-fieldset" id="empresa-dados"${dis}><legend>Empresa</legend><p class="fieldset-note">Aparecem no guia assim que você salva. Mudou o endereço? A posição no mapa fica aproximada até o Nexus conferir.</p><div class="form-grid">${campo('nome','Nome da empresa',a=>`<input type="text" ${a} value="${e(p.nome||'')}" maxlength="120" required>`,{full:true,dica:'O endereço da página no guia não muda.'})}${campo('rua','Endereço',a=>`<input type="text" ${a} value="${e(p.rua||'')}" maxlength="160" autocomplete="street-address" placeholder="Rua, número e complemento">`,{full:true})}${campo('bairro','Bairro',a=>`<input type="text" ${a} value="${e(p.bairro||'')}" maxlength="80" list="lista-bairros">`)}${campo('cidade','Cidade',a=>`<input type="text" ${a} value="${e(p.cidade||'')}" maxlength="80">`)}${campo('cep','CEP',a=>`<input type="text" ${a} value="${e(p.cep||'')}" inputmode="numeric" maxlength="9" autocomplete="postal-code" placeholder="26000-000">`)}${campo('referencia','Ponto de referência',a=>`<input type="text" ${a} value="${e(p.referencia||'')}" maxlength="120" placeholder="Ex.: em frente à praça da matriz">`,{full:true,dica:'Opcional. Aparece no perfil, junto do endereço.'})}<div class="form-field full" data-campo="pagamentos"><span class="field-label">Formas de pagamento</span><p class="field-hint">Opcional. Aparecem no perfil quando você marca alguma.</p><div class="check-options">${Object.entries(PAGAMENTOS).map(([v,l])=>`<label class="toggle"><input type="checkbox" name="pagamentos" value="${v}"${(p.pagamentos||[]).includes(v)?' checked':''}><span>${l}</span></label>`).join('')}</div></div><div class="form-field full" data-campo="categorias"><span class="field-label">Categorias <small>até 8</small></span><p class="field-hint">Onde a empresa aparece na busca. Abra o grupo para marcar.</p><div class="category-groups">${grupos}</div>${foraDaLista?`<p class="field-hint">Fora da lista única (desmarque para tirar):</p><div class="check-options">${foraDaLista}</div>`:''}${sugestao}${sugerir}</div>${principal}</div><datalist id="lista-bairros">${(o.bairros||[]).map(b=>`<option value="${e(b)}">`).join('')}</datalist></fieldset>`;
  const textos=`<fieldset class="panel-fieldset" id="textos"${dis}><legend>Textos do perfil</legend><p class="fieldset-note">Passam pela aprovação do Nexus. Até lá, o público vê o texto anterior.</p>${campo('resumo',`Resumo${emAnalise('resumo')}`,a=>`<textarea ${a} rows="2" maxlength="300">${e(p.resumo||'')}</textarea>`,{dica:'Até 300 caracteres. Os cards da busca mostram os primeiros 160.',full:true})}${campo('descricao',`Sobre a empresa${emAnalise('descricao')}`,a=>`<textarea ${a} rows="7" maxlength="6000">${e(p.descricao||'')}</textarea>`,{dica:'Separe os parágrafos com uma linha em branco.',full:true})}</fieldset>`;
  const form=`<form class="panel-form" data-form="perfil"${vm.empresa?.status==='published'?' data-publicada':''} novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><input type="hidden" name="version" value="${e(p.version??'')}">${empresa}<fieldset class="panel-fieldset" id="horario" data-campo="horario"${dis}><legend>Horário da semana</legend><p class="fieldset-note">Marque os dias em que a empresa abre e informe o horário. Se fecha para o almoço, use “Outro horário no dia”. Até meia-noite: feche às 00:00.</p>${pode?`<button type="button" class="link-button text-button" data-copiar-segunda>${icone('copiar')}Repetir o horário de segunda de terça a sexta</button>`:''}<div class="hours-week">${horario}</div></fieldset><fieldset class="panel-fieldset" id="contatos"${dis}><legend>Contatos</legend><div class="form-grid">${campo('whatsapp','WhatsApp',a=>`<input type="tel" ${a} value="${e(p.whatsapp||'')}" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="(21) 90000-0000">`)}${campo('telefone','Telefone',a=>`<input type="tel" ${a} value="${e(p.telefone||'')}" autocomplete="tel" inputmode="tel" maxlength="20">`)}${campo('email','E-mail',a=>`<input type="email" ${a} value="${e(p.email||'')}" autocomplete="email" inputmode="email" maxlength="160">`)}${campo('site','Site',a=>`<input type="text" ${a} value="${e(p.site||'')}" inputmode="url" autocapitalize="off" spellcheck="false" maxlength="300" placeholder="suaempresa.com.br">`)}</div></fieldset><fieldset class="panel-fieldset" id="redes" data-campo="redes"${dis}><legend>Redes sociais</legend><div class="social-list" data-redes>${(p.redes||[]).map(rede).join('')}</div><button type="button" class="link-button text-button" data-mais-rede>${icone('mais')}Adicionar rede</button></fieldset>${textos}${pode?'<div class="panel-actions"><button type="submit" class="button">Salvar alterações</button><p class="form-note">Nome, endereço, categorias, foto principal, horário, contatos e redes aparecem no guia na hora.</p></div>':''}<template data-modelo-intervalo>${intervalo(1)}</template><template data-modelo-rede>${rede({},0)}</template></form>`;
  const fotos=p.fotos||[];
  const cartao=f=>`<li class="photo-card" data-foto="${e(f.id)}"><img src="${e(f.url)}" alt="${e(f.alt||'')}" width="${Number(f.largura)||800}" height="${Number(f.altura)||600}" loading="lazy" decoding="async"><div class="photo-meta"><span class="state-tag is-${e(f.status)}">${STATUS_FOTO[f.status]||e(f.status)}</span><span class="photo-alt">${f.alt?e(f.alt):'Sem descrição'}</span>${f.status==='recusada'&&f.recusa?.comentario?`<span class="photo-refusal">Motivo: ${e(f.recusa.comentario)}</span>`:''}${pode?`<button type="button" class="link-button text-button danger" data-excluir-foto="${e(f.id)}">Excluir<span class="sr-only"> a foto ${e(f.alt||'')}</span></button>`:''}</div></li>`;
  const envio=pode?`<form class="photo-upload" data-form="foto" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${campo('arquivo','Escolher foto',a=>`<input type="file" ${a} accept="image/jpeg,image/png,image/webp">`,{dica:'JPG, PNG ou WebP, até 8 MB. A foto passa pela aprovação do Nexus.'})}<figure class="photo-preview" data-previa hidden><figcaption data-previa-nome></figcaption></figure>${campo('alt','Descreva a foto',a=>`<input type="text" ${a} maxlength="200" placeholder="Fachada da padaria com o toldo azul">`,{dica:'Ajuda quem usa leitor de tela.'})}<div class="panel-actions"><button type="submit" class="button">Enviar foto</button></div></form>`:'';
  const secaoFotos=`<section class="panel-section" id="fotos" aria-labelledby="fotos-titulo"><h2 id="fotos-titulo">Fotos</h2>${fotos.length?`<ul class="photo-grid">${fotos.map(cartao).join('')}</ul>`:vazio('Nenhuma foto ainda. Uma boa foto da fachada ajuda o cliente a reconhecer a sua empresa.')}${envio}</section>`;
  return `${pode?'':leitura(vm,'o perfil')}${form}${secaoFotos}`;
}

// Produtos e serviços: lista com a situação da aprovação, novo item e edição no próprio item.
function camposItem(i,prefixo) {
  const id=n=>`${prefixo}-${n}`,oferta=i.tipo==='oferta';
  return `<div class="form-grid">${campo('tipo','Tipo',a=>`<select ${a} data-tipo>${opcoes([['produto','Produto'],['servico','Serviço'],['oferta','Oferta']],i.tipo||'produto')}</select>`,{id:id('tipo')})}${campo('nome','Nome',a=>`<input type="text" ${a} value="${e(i.nome||'')}" maxlength="120" required>`,{id:id('nome')})}${campo('descricao','Descrição',a=>`<textarea ${a} rows="3" maxlength="600">${e(i.descricao||'')}</textarea>`,{id:id('descricao'),full:true})}${campo('precoModo','Preço',a=>`<select ${a} data-preco-modo>${opcoes([['fixo','Preço fixo'],['a-partir','A partir de'],['consulta','Sob consulta']],i.precoModo||'fixo')}</select>`,{id:id('precoModo')})}${campo('precoCentavos','Valor (R$)',a=>`<input type="text" ${a} value="${reais(i.precoCentavos)}" inputmode="decimal" maxlength="12" placeholder="0,00">`,{id:id('precoCentavos'),extra:`preco-valor${i.precoModo==='consulta'?' is-hidden':''}`})}<div class="offer-fields full${oferta?'':' is-hidden'}" data-oferta>${campo('condicoes','Condições da oferta',a=>`<textarea ${a} rows="2" maxlength="300">${e(i.condicoes||'')}</textarea>`,{id:id('condicoes'),dica:'Obrigatório na oferta: quando vale, para quem, limites.',full:true})}${campo('validade','Válida até',a=>`<input type="date" ${a} value="${e(i.validade||'')}">`,{id:id('validade')})}</div></div>`;
}
function catalogo(vm) {
  const itens=vm.dados?.itens||[],pode=vm.pode.catalogo;
  const acao=(i,nome,rotulo,cls='secondary')=>`<button type="button" class="button ${cls}" data-acao-item="${nome}" data-item="${e(i.id)}" data-version="${e(i.version)}">${rotulo}</button>`;
  // Item recusado volta a rascunho com o comentário: a ação principal é corrigir e reenviar, com o motivo no topo da edição.
  const linha=i=>{
    const ajuste=i.status==='rascunho'&&i.recusa;
    const motivo=i.recusa?`<p class="item-refusal">${icone('falta')}<span><strong>Voltou da aprovação em ${data(i.recusa.em)}:</strong> ${e(i.recusa.comentario)}</span></p>`:'';
    const situacao=ajuste?'<span class="state-tag is-ajuste">Voltou para ajuste</span>':`<span class="state-tag is-${e(i.status)}">${STATUS_ITEM[i.status]||e(i.status)}</span>`;
    const principal=ajuste?`<button type="button" class="button" data-corrigir="${e(i.id)}">Corrigir e reenviar</button>`:i.status==='rascunho'?acao(i,'enviar','Enviar para aprovação',''):'';
    const edicao=`<details class="item-edit"><summary class="button secondary">Editar<span class="sr-only"> ${e(i.nome)}</span></summary><form class="panel-form" data-form="item" data-item="${e(i.id)}"${ajuste?' data-reenviar':''} novalidate>${ajuste?motivo:''}<div class="form-errors" role="alert" tabindex="-1" hidden></div><input type="hidden" name="version" value="${e(i.version)}">${camposItem(i,`item-${i.id}`)}<div class="panel-actions"><button type="submit" class="button">${ajuste?'Salvar e reenviar para aprovação':'Salvar alterações'}</button><p class="form-note">${ajuste?'O item volta para a fila do Nexus com a correção.':'O item alterado volta para a aprovação do Nexus.'}</p></div></form></details>`;
    return `<li class="item-row" id="item-${e(i.id)}"><div class="item-info"><div class="item-tags"><span class="type-tag">${TIPO_ITEM[i.tipo]||e(i.tipo)}</span>${situacao}</div><h3>${e(i.nome)}</h3>${i.descricao?`<p>${e(i.descricao)}</p>`:''}<p class="item-price">${preco(i)}${i.tipo==='oferta'&&i.validade?` · válida até ${data(i.validade)}`:''}</p>${motivo}</div>${pode?`<div class="item-actions">${principal}${i.status==='rascunho'?`<button type="button" class="link-button text-button danger" data-excluir-item="${e(i.id)}">Excluir rascunho<span class="sr-only"> ${e(i.nome)}</span></button>`:''}${i.status==='publicado'?acao(i,'pausar','Pausar'):''}${i.status==='pausado'?acao(i,'reativar','Reativar'):''}${edicao}</div>`:''}</li>`;
  };
  const novo=pode?`<details class="item-new" id="novo-item"><summary class="button">${icone('mais')}Novo item</summary><form class="panel-form" data-form="item-novo" novalidate><h2 data-titulo-item>Novo produto</h2><div class="form-errors" role="alert" tabindex="-1" hidden></div>${camposItem({tipo:'produto'},'novo')}<div class="panel-actions"><button type="submit" class="button" data-enviar="true">Enviar para aprovação</button><button type="submit" class="button secondary" data-enviar="false">Salvar como rascunho</button></div></form></details>`:'';
  const lista=itens.length?`<ul class="item-list">${itens.map(linha).join('')}</ul>`:`<div class="panel-empty-state"><h2>Nenhum produto ou serviço ainda</h2><p>Cadastre o que a sua empresa vende. Cada item aparece no perfil depois da aprovação do Nexus; ofertas precisam de condições e validade.</p></div>`;
  return `${pode?'':leitura(vm,'os produtos e serviços')}${novo}${lista}`;
}

// Resultados: período, totais, gráficos de barras em SVG por dia (com a tabela para leitor de tela), cliques por tipo e banners.
function barras(serie,chave,titulo,id) {
  if(!serie.some(p=>p[chave]))return `<figure class="chart"><figcaption id="${id}"><span>${titulo} por dia</span></figcaption><p class="chart-empty">Nenhum registro neste período.</p></figure>`;
  const W=600,H=120,max=Math.max(1,...serie.map(p=>p[chave]||0)),passo=W/Math.max(serie.length,1);
  const rects=serie.map((p,i)=>{const v=p[chave]||0,h=v?Math.max(2,Math.round(v/max*H)):0;return `<rect x="${(i*passo+passo*.18).toFixed(1)}" y="${H-h}" width="${(passo*.64).toFixed(1)}" height="${h}"><title>${data(p.dia)}: ${v}</title></rect>`;}).join('');
  const linhas=serie.map(p=>`<tr><th scope="row">${data(p.dia)}</th><td>${p[chave]||0}</td></tr>`).join('');
  return `<figure class="chart"><figcaption id="${id}"><span>${titulo} por dia</span><small>máximo ${numero(max)}</small></figcaption><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-labelledby="${id}">${rects}<line x1="0" y1="${H}" x2="${W}" y2="${H}"/></svg><div class="chart-axis" aria-hidden="true"><span>${data(serie[0]?.dia)}</span><span>${data(serie.at(-1)?.dia)}</span></div><table class="sr-only"><caption>${titulo} por dia</caption><thead><tr><th scope="col">Dia</th><th scope="col">${titulo}</th></tr></thead><tbody>${linhas}</tbody></table></figure>`;
}
function resultados(vm) {
  const m=vm.dados||{},base=caminho(vm.empresa.id),serie=m.serie||[];
  const c=m.cliques||{},canais=[['whatsapp','WhatsApp'],['telefone','Telefone'],['rota','Como chegar'],['site','Site']];
  const total=canais.reduce((s,[k])=>s+(c[k]||0),0),maior=Math.max(1,...canais.map(([k])=>c[k]||0));
  // Período anterior do mesmo tamanho (Metricas.anterior, quando o vm traz): "+12" ou "−3" ao lado do número.
  const antes=(k,agora)=>{const v=m.anterior?.[k];return typeof v==='number'?`<small class="trend">${agora>=v?'+':'−'}${numero(Math.abs(agora-v))} em relação ao período anterior</small>`:'';};
  const periodos=[['7d','7 dias'],['30d','30 dias'],['90d','90 dias']].map(([p,l])=>`<a class="filter-chip" href="${base}/resultados?periodo=${p}"${m.periodo===p?' aria-current="true"':''}>${l}</a>`).join('');
  const porCanal=total?`<ul class="channel-list">${canais.map(([k,l])=>`<li><span>${l}</span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="track" width="100" height="8"/><rect class="fill" width="${Math.round((c[k]||0)/maior*100)}" height="8"/></svg><strong>${numero(c[k])}</strong></li>`).join('')}</ul>`:vazio('Nenhum clique para contato neste período.');
  const banners=(m.banners||[]).length?`<section class="panel-section" aria-labelledby="res-banners"><h2 id="res-banners">Banners da empresa</h2><div class="table-wrap"><table class="panel-table"><thead><tr><th scope="col">Banner</th><th scope="col">Espaço</th><th scope="col" class="num">Impressões</th><th scope="col" class="num">Cliques</th></tr></thead><tbody>${m.banners.map(b=>`<tr><th scope="row">${e(b.titulo)}</th><td>${ESPACOS[b.espaco]||e(b.espaco)}</td><td class="num">${numero(b.impressoes)}</td><td class="num">${numero(b.cliques)}</td></tr>`).join('')}</tbody></table></div></section>`:'';
  return `<div class="results-head"><nav class="quick-filters" aria-label="Período">${periodos}</nav><p class="muted">De ${data(m.de)} a ${data(m.ate)}</p></div><dl class="stats-row${m.cupons!=null?' has-4':''}"><div><dt>Visitas ao perfil</dt><dd>${numero(m.visitas)}${antes('visitas',m.visitas)}</dd></div><div><dt>Cliques para contato</dt><dd>${numero(total)}${antes('cliques',total)}</dd></div><div><dt>Aparições em buscas</dt><dd>${numero(m.buscas)}${antes('buscas',m.buscas)}</dd></div>${m.cupons!=null?`<div><dt>Coletas de cupons</dt><dd>${numero(m.cupons)}${antes('cupons',m.cupons)}</dd></div>`:''}</dl>${m.nota?`<p class="form-note results-note">${e(m.nota)}</p>`:''}<div class="results-grid"><section class="panel-section" aria-labelledby="res-dia"><h2 id="res-dia">Dia a dia</h2>${serie.length?`${barras(serie,'visitas','Visitas ao perfil','graf-visitas')}${barras(serie,'cliques','Cliques para contato','graf-cliques')}${barras(serie,'buscas','Aparições em buscas','graf-buscas')}`:vazio('Ainda não há dados neste período.')}</section><section class="panel-section" aria-labelledby="res-canal"><h2 id="res-canal">Cliques por tipo</h2>${porCanal}</section></div>${banners}`;
}

// Relatório do mês (v0.20.0, contrato 20): um mês fechado comparado com o anterior, das somas diárias do guia. O número sem
// medição aparece como "sem medição", nunca zero; o mês em que a série começou no meio diz desde quando; a diferença só sai
// com os dois meses medidos inteiros. A página é feita para o "Imprimir" do navegador, que também salva em PDF: o título
// leva o mês e a empresa, e o CSS de impressão tira o menu, o cabeçalho, o rodapé e os botões.
const maiuscula=t=>t?t[0].toUpperCase()+t.slice(1):'';
const CANAIS_REL=[['whatsapp','WhatsApp'],['telefone','Telefone'],['rota','Como chegar'],['site','Site']];
const SERIES_REL=[['contatos','as visitas e os contatos'],['aparicoes','as aparições na busca'],['banners','os banners']];
const lista=itens=>itens.length>1?`${itens.slice(0,-1).join(', ')} e ${itens.at(-1)}`:itens.join('');
const titulosRelatorio=vm=>{const r=vm.dados;return [`Relatório de ${e(r.rotulo)}`,`${e(vm.empresa.name)}, comparado com ${e(r.anterior?.rotulo||'o mês anterior')}.`];};
function relatorio(vm) {
  const r=vm.dados;
  if(!r?.mes)return vazio('O relatório deste mês não está disponível.');
  // Os dois meses pelo nome, sem o ano quando são do mesmo ano ("outubro"); de anos diferentes, com o ano.
  const mesmoAno=r.mes.slice(0,4)===(r.anterior?.mes||'').slice(0,4);
  const nome=rotulo=>e(mesmoAno?String(rotulo||'').replace(/ de \d{4}$/,''):rotulo||'');
  const atualNome=nome(r.rotulo),antNome=nome(r.anterior?.rotulo);
  const serie=s=>r.series?.[s]||{};
  // O mês em que a série começou no meio: "desde 15/10", com o espaço fixo para "desde" e a data não se separarem.
  const desde=(s,qual)=>serie(s).parcial?.[qual]&&serie(s).medidoDesde?`desde ${data(serie(s).medidoDesde).slice(0,5)}`:'';
  const parcialEm=s=>serie(s).parcial?.anterior?antNome:serie(s).parcial?.atual?atualNome:'';
  const SEM='<span class="report-none">sem medição</span>';
  const valor=v=>typeof v==='number'?numero(v):SEM;
  const sinal=d=>d>0?`+${numero(d)}`:d<0?`−${numero(-d)}`:'0';
  const diferenca=c=>typeof c?.diferenca==='number'?sinal(c.diferenca):'<span aria-hidden="true">—</span><span class="sr-only">sem comparação</span>';
  // A frase da diferença no cartão; com os dois números e um mês parcial, diz por que não compara.
  const frase=(c,s)=>{
    if(typeof c?.diferenca==='number')return c.diferenca===0?`O mesmo que em ${antNome}`:`${numero(Math.abs(c.diferenca))} a ${c.diferenca>0?'mais':'menos'} que em ${antNome}`;
    return typeof c?.atual==='number'&&typeof c?.anterior==='number'&&parcialEm(s)?`Sem comparação: ${parcialEm(s)} foi medido só em parte`:'';
  };
  const cartao=(titulo,c,s)=>{const f=frase(c,s),parte=desde(s,'atual'),antes=desde(s,'anterior');
    return `<div><dt>${titulo}</dt><dd><strong class="report-value">${valor(c?.atual)}</strong>${parte?`<span class="report-part">${parte}</span>`:''}<span class="report-before">${maiuscula(antNome)}: ${valor(c?.anterior)}${antes?`, ${antes}`:''}</span>${f?`<span class="report-diff">${f}</span>`:''}</dd></div>`;};
  const cabeca=(s,primeira)=>`<thead><tr><th scope="col">${primeira}</th>${[['atual',atualNome],['anterior',antNome]].map(([q,n])=>`<th scope="col" class="num">${maiuscula(n)}${desde(s,q)?`<small>${desde(s,q)}</small>`:''}</th>`).join('')}<th scope="col" class="num">Diferença</th></tr></thead>`;
  const linha=(rotulo,c)=>`<tr><th scope="row">${rotulo}</th><td class="num">${valor(c?.atual)}</td><td class="num">${valor(c?.anterior)}</td><td class="num">${diferenca(c)}</td></tr>`;
  // Só quando a diferença faltaria pelo mês parcial: com um dos meses sem medição, o "sem medição" já explica.
  const comparavel=c=>typeof c?.atual==='number'&&typeof c?.anterior==='number';
  const notaParcial=(s,cs)=>parcialEm(s)&&cs.some(comparavel)?`<p class="report-table-note">Sem a diferença: ${parcialEm(s)} foi medido só a partir de ${data(serie(s).medidoDesde).slice(0,5)}.</p>`:'';
  const ct=r.contatos||{};
  const canais=`<section class="panel-section report-section" aria-labelledby="rel-canais"><h2 id="rel-canais">Contatos por canal</h2><div class="table-wrap"><table class="panel-table report-table"><caption class="sr-only">Contatos por canal em ${e(r.rotulo)} e em ${e(r.anterior?.rotulo||'')}</caption>${cabeca('contatos','Canal')}<tbody>${CANAIS_REL.map(([k,l])=>linha(l,ct[k])).join('')}</tbody><tfoot>${linha('Total',ct.total)}</tfoot></table></div>${notaParcial('contatos',[ct.total])}</section>`;
  const medeBanners=Boolean(serie('banners').medidoDesde)&&serie('banners').medidoDesde.slice(0,7)<=r.mes;
  const banners=(r.banners||[]).length?`<div class="table-wrap"><table class="panel-table report-table"><caption class="sr-only">Impressões e cliques dos banners da empresa em ${e(r.rotulo)} e em ${e(r.anterior?.rotulo||'')}</caption>${cabeca('banners','Banner')}${r.banners.map(b=>`<tbody><tr class="report-group"><th scope="rowgroup" colspan="4">${e(b.titulo)}</th></tr>${linha('Impressões',b.impressoes)}${linha('Cliques',b.cliques)}</tbody>`).join('')}</table></div>${notaParcial('banners',r.banners.flatMap(b=>[b.impressoes,b.cliques]))}`
    :vazio(medeBanners?'Nenhum banner da empresa teve impressão ou clique nestes dois meses.':'O guia ainda não media os banners nestes dois meses.');
  const medidas=SERIES_REL.filter(([s])=>serie(s).medidoDesde).map(([s,n])=>`${n} desde ${data(serie(s).medidoDesde)}`);
  return `<dl class="report-stats">${cartao('Visitas ao perfil',r.visitas,'contatos')}${cartao('Contatos',ct.total,'contatos')}${cartao('Aparições na busca',r.aparicoes,'aparicoes')}</dl>${canais}<section class="panel-section report-section" aria-labelledby="rel-banners"><h2 id="rel-banners">Banners da empresa</h2>${banners}</section><div class="report-foot">${r.nota?`<p class="form-note">${e(r.nota)}</p>`:''}${medidas.length?`<p class="form-note">O guia mede ${lista(medidas)}.</p>`:''}<p class="report-source">Nexus · painel do anunciante</p></div>`;
}
// A troca de mês (os meses aceitos, do mais recente ao mais antigo) e o "Imprimir", que o p2/painel.js mostra e liga.
function acoesRelatorio(vm) {
  const r=vm.dados||{},meses=r.disponiveis||[];
  const trocar=meses.length>1?`<details class="report-switch"><summary class="button secondary">Trocar de mês${icone('seta','ico-chevron')}</summary><ul>${meses.map(d=>`<li><a href="${e(d.url)}"${d.mes===r.mes?' aria-current="page"':''}>${e(maiuscula(d.rotulo))}</a></li>`).join('')}</ul></details>`:'';
  return `<div class="panel-shortcuts report-actions">${trocar}<button type="button" class="button secondary" data-imprimir hidden>${icone('imprimir')}<span>Imprimir</span></button></div>`;
}

// Solicitações e suporte: nova solicitação (com o briefing da criação pelo Nexus) e a lista, com a conversa carregada ao abrir.
function solicitacoes(vm) {
  const lista=vm.dados?.solicitacoes||[],pode=vm.pode.solicitar;
  const tipo=(v,titulo,texto)=>`<label class="choice"><input type="radio" name="tipo" value="${v}"${v==='suporte'?' checked':''}><span><strong>${titulo}</strong><small>${texto}</small></span></label>`;
  const nova=pode?`<details class="request-new" id="nova-solicitacao"${lista.length?'':' open'}><summary class="button">${icone('mais')}Nova solicitação</summary><form class="panel-form" data-form="solicitacao" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><fieldset class="panel-fieldset choice-group" data-campo="tipo"><legend>Do que você precisa?</legend>${tipo('suporte','Ajuda','Uma dúvida sobre o painel ou o guia.')}${tipo('alteracao','Alteração','Mudar algo que você não edita aqui, como endereço, categoria ou nome.')}${tipo('criacao','Criação pelo Nexus','Um banner, um post ou um anúncio feito pela equipe.')}</fieldset><div class="form-grid">${campo('assunto','Assunto',a=>`<input type="text" ${a} maxlength="120" required>`,{full:true})}${campo('texto','Mensagem',a=>`<textarea ${a} rows="4" maxlength="2000" required></textarea>`,{full:true})}</div><fieldset class="panel-fieldset briefing is-hidden" data-briefing><legend>Briefing da criação</legend><div class="form-grid">${campo('objetivo','Objetivo',a=>`<textarea ${a} rows="2" maxlength="600" placeholder="O que você quer divulgar e para quem?"></textarea>`,{full:true})}${campo('formato','Formato',a=>`<select ${a}>${opcoes([['banner','Banner no guia'],['post','Post para redes sociais'],['anuncio','Anúncio no perfil'],['outro','Outro']],'banner')}</select>`)}${campo('prazo','Para quando',a=>`<input type="date" ${a}>`)}${campo('referencias','Referências',a=>`<textarea ${a} rows="2" maxlength="600" placeholder="Cores, fotos, links ou exemplos de que você gosta."></textarea>`,{full:true})}</div></fieldset><div class="panel-actions"><button type="submit" class="button">Enviar solicitação</button><p class="form-note">A equipe do Nexus responde por aqui.</p></div></form></details>`:leitura(vm,'as solicitações');
  const conversa=`<p class="panel-links">Prefere conversar? ${whatsappSuporte(vm)}</p>`;
  const briefing=b=>b?`<dl class="panel-dl">${[['Objetivo',b.objetivo],['Formato',b.formato],['Para quando',b.prazo&&data(b.prazo)],['Referências',b.referencias]].filter(([,v])=>v).map(([k,v])=>`<div><dt>${k}</dt><dd>${k==='Para quando'?v:e(v)}</dd></div>`).join('')}</dl>`:'';
  const item=s=>`<li id="sol-${e(s.id)}"><details class="request" data-solicitacao="${e(s.id)}"><summary><span class="request-subject">${e(s.assunto)}</span><span class="state-tag is-${e(s.status)}">${STATUS_SOL[s.status]||e(s.status)}</span><small>${TIPO_SOL[s.tipo]||e(s.tipo)} · atualizada em ${data(s.atualizada)}</small></summary><div class="request-body">${briefing(s.briefing)}<div class="request-thread" data-conversa aria-busy="false"><p class="muted">A conversa aparece aqui.</p></div>${pode&&s.status!=='fechada'?`<form class="panel-form request-reply" data-form="mensagem" data-solicitacao="${e(s.id)}" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${campo('texto','Responder',a=>`<textarea ${a} rows="3" maxlength="2000" required></textarea>`,{id:`resposta-${s.id}`})}<div class="panel-actions"><button type="submit" class="button">Enviar resposta</button><button type="button" class="button secondary" data-fechar-solicitacao="${e(s.id)}">Encerrar solicitação</button></div></form>`:''}</div></details></li>`;
  return `${nova}${conversa}<section class="panel-section" aria-labelledby="sol-lista"><h2 id="sol-lista">Suas solicitações</h2>${lista.length?`<ul class="request-list">${lista.map(item).join('')}</ul>`:vazio('Nenhuma solicitação ainda. Use “Nova solicitação” para falar com a equipe do Nexus.')}</section>`;
}

// Acessos: pessoas, papéis e convites. Ninguém muda o próprio papel (o servidor também confere). Mudar o papel é uma edição
// com botão próprio, e tornar alguém dono pede a confirmação em palavras simples antes de salvar.
function acessos(vm) {
  const a=vm.dados||{},eu=vm.usuario.id,papeis=Object.entries(PAPEIS);
  const papel=(m,nome)=>`<form class="role-form" data-form="papel" data-usuario="${e(m.usuario.id)}" novalidate><label><span class="sr-only">Papel de ${nome}</span><select name="papel" data-papel-atual="${e(m.papel)}">${opcoes(papeis,m.papel)}</select></label><button type="submit" class="button secondary" data-salvar-papel hidden>Salvar papel<span class="sr-only"> de ${nome}</span></button><p class="role-confirm" data-confirmar-dono hidden>${nome} vai poder convidar e tirar pessoas desta empresa, inclusive você.</p></form>`;
  const linha=m=>{const u=m.usuario,proprio=u.id===eu,nome=e(u.nome||u.email);return `<tr><th scope="row"><span class="person"><strong>${nome}${proprio?' <small>(você)</small>':''}</strong><span>${e(u.email)}</span>${m.ativo===false?'<span class="state-tag is-pausado">Inativo</span>':''}</span></th><td data-rotulo="Papel">${proprio?(PAPEIS[m.papel]||e(m.papel)):papel(m,nome)}</td><td data-rotulo="Desde">${data(m.desde)}</td><td class="num">${proprio?'':`<button type="button" class="link-button text-button danger" data-revogar="${e(u.id)}">Tirar acesso<span class="sr-only"> de ${nome}</span></button>`}</td></tr>`;};
  const convites=(a.convites||[]).length?`<h3>Convites pendentes</h3><ul class="plain-list">${a.convites.map(c=>`<li class="invite-row"><span class="person"><strong>${e(c.email)}</strong><span>${PAPEIS[c.papel]||e(c.papel)}${c.expira?` · vale até ${data(c.expira)}`:''}</span></span><span class="invite-actions"><button type="button" class="link-button text-button" data-reenviar-convite="${e(c.email)}">Reenviar<span class="sr-only"> o convite de ${e(c.email)}</span></button><button type="button" class="link-button text-button danger" data-cancelar-convite="${e(c.email)}">Cancelar<span class="sr-only"> o convite de ${e(c.email)}</span></button></span></li>`).join('')}</ul>`:'';
  const convidar=`<section class="panel-section" aria-labelledby="ac-convidar"><h2 id="ac-convidar">Convidar uma pessoa</h2><form class="panel-form" data-form="convite" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><div class="form-grid">${campo('email','E-mail',a=>`<input type="email" ${a} maxlength="160" inputmode="email" required>`)}${campo('papel','Papel',a=>`<select ${a}>${opcoes(papeis,'editor')}</select>`)}</div><div class="panel-actions"><button type="submit" class="button">Convidar</button></div></form><div class="invite-result" data-convite-resultado tabindex="-1" hidden></div></section>`;
  return `<section class="panel-section" aria-labelledby="ac-pessoas"><h2 id="ac-pessoas">Quem tem acesso</h2><div class="table-wrap"><table class="panel-table people-table"><thead><tr><th scope="col">Pessoa</th><th scope="col">Papel</th><th scope="col">Desde</th><th scope="col" class="num"><span class="sr-only">Ações</span></th></tr></thead><tbody>${(a.membros||[]).map(linha).join('')}</tbody></table></div>${convites}<dl class="roles-help">${papeis.map(([k,l])=>`<div><dt>${l}</dt><dd>${PAPEL_AJUDA[k]}</dd></div>`).join('')}</dl></section>${convidar}`;
}

function empresas(vm) {
  return vm.empresas.length?`<ul class="company-list">${vm.empresas.map(x=>`<li><a href="${caminho(x.id)}"><strong>${e(x.name)}</strong><span>${PAPEIS[x.papel]||e(x.papel)}</span><span aria-hidden="true">→</span></a></li>`).join('')}</ul>`
    :`<div class="panel-empty-state"><h2>Sua conta ainda não está ligada a uma empresa</h2><p>Peça a quem cuida da empresa para convidar você pelo painel, ou fale com o Nexus.</p><a class="button secondary" href="/institucional/contato">Falar com o Nexus</a></div>`;
}

// Cupons (v0.14.0, 14.6): no ar na hora (ou no dia de início), até 10 em vigor por empresa. Depois da primeira coleta, só a
// validade e a quantidade mudam, porque quem coletou guardou aquelas condições. Suspenso pelo Nexus não reativa por aqui.
const STATUS_CUPOM={ativo:['publicado','No ar'],agendado:['validacao','Agendado'],pausado:['pausado','Pausado'],esgotado:['pausado','Esgotado'],vencido:['pausado','Vencido'],suspenso:['ajuste','Suspenso pelo Nexus']};
const LIMITE_CUPONS=10;
const camposCupom=(c,prefixo,travado=false)=>{
  const id=n=>`${prefixo}-${n}`,t=travado?' disabled':'';
  return `<div class="form-grid">${campo('titulo','Título',a=>`<input type="text" ${a} value="${e(c.titulo||'')}" maxlength="80" required placeholder="10% no café da manhã"${t}>`,{id:id('titulo'),full:true,dica:'De 4 a 80 caracteres. É o que o morador vê primeiro.'})}${campo('condicoes','Condições',a=>`<textarea ${a} rows="3" maxlength="600" required placeholder="Vale de segunda a sexta, até as 10h, para consumo na loja."${t}>${e(c.condicoes||'')}</textarea>`,{id:id('condicoes'),full:true,dica:'O que vale, onde e como usar. De 10 a 600 caracteres.'})}${campo('validade','Válido até',a=>`<input type="date" ${a} value="${e(c.validade||'')}" required>`,{id:id('validade'),dica:'Até 1 ano à frente.'})}${campo('inicio','Começa em',a=>`<input type="date" ${a} value="${e(c.inicio||'')}"${t}>`,{id:id('inicio'),dica:'Opcional. Em branco, entra no ar na hora.'})}${campo('quantidade','Quantidade',a=>`<input type="number" ${a} value="${e(c.quantidade??'')}" min="${Math.max(1,c.coletados||0)}" max="100000" step="1">`,{id:id('quantidade'),dica:'Opcional. Em branco, sem limite.'})}${campo('codigo','Código',a=>`<input type="text" ${a} value="${e(c.codigo||'')}" maxlength="20" autocapitalize="characters" spellcheck="false" placeholder="CAFE10"${t}>`,{id:id('codigo'),dica:'Opcional: de 4 a 20 letras, números ou hífen. Em branco, o guia cria um.'})}</div>`;
};
function cupons(vm) {
  const lista=vm.dados?.cupons||[],pode=vm.pode.cupons;
  const emVigor=lista.filter(c=>c.status!=='vencido').length,cheio=emVigor>=LIMITE_CUPONS;
  const acao=(c,nome,rotulo)=>`<button type="button" class="button secondary" data-acao-cupom="${nome}" data-cupom="${e(c.id)}" data-version="${e(c.version)}">${rotulo}<span class="sr-only"> ${e(c.titulo)}</span></button>`;
  const linha=c=>{
    const [cls,rot]=STATUS_CUPOM[c.status]||['pausado',e(c.status||'')],coletado=(c.coletados||0)>0;
    const suspensao=c.status==='suspenso'&&c.suspensao?`<p class="item-refusal">${icone('falta')}<span><strong>Suspenso pelo Nexus em ${data(c.suspensao.em)}:</strong> ${e(c.suspensao.motivo)}</span></p>`:'';
    const contagem=`${numero(c.coletados)} ${c.coletados===1?'coleta':'coletas'}${c.quantidade?` de ${numero(c.quantidade)}`:''}`;
    const divulgar=c.status!=='suspenso'&&c.url?`<p class="panel-links"><a href="${e(c.url)}" target="_blank" rel="noopener">Ver no guia ${fora}</a><button type="button" class="link-button text-button" data-copiar-link="${e(c.url)}">Copiar o link para divulgar</button></p>`:'';
    const editar=`<details class="item-edit"><summary class="button secondary">Editar<span class="sr-only"> ${e(c.titulo)}</span></summary><form class="panel-form" data-form="cupom" data-cupom="${e(c.id)}" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><input type="hidden" name="version" value="${e(c.version)}">${coletado?'<p class="fieldset-note">Já houve coleta: só a validade e a quantidade mudam. Para mudar o resto, crie outro cupom.</p>':''}${camposCupom(c,`cupom-${c.id}`,coletado)}<div class="panel-actions"><button type="submit" class="button">Salvar cupom</button></div></form></details>`;
    const acoes=pode?`<div class="item-actions">${['ativo','agendado','esgotado'].includes(c.status)?acao(c,'pausar','Pausar'):''}${c.status==='pausado'?acao(c,'reativar','Reativar'):''}${c.status==='suspenso'?'':editar}<button type="button" class="link-button text-button danger" data-excluir-cupom="${e(c.id)}">Tirar do site<span class="sr-only"> ${e(c.titulo)}</span></button></div>`:'';
    return `<li class="item-row coupon-row" id="cupom-${e(c.id)}"><div class="item-info"><div class="item-tags"><span class="state-tag is-${cls}">${rot}</span></div><h3>${e(c.titulo)}</h3><p>${e(c.condicoes)}</p><p class="item-price">Código <strong class="coupon-code-inline">${e(c.codigo)}</strong> · ${contagem} · válido até ${data(c.validade)}${c.inicio&&c.status==='agendado'?` · começa em ${data(c.inicio)}`:''}</p>${suspensao}${divulgar}</div>${acoes}</li>`;
  };
  const novo=!pode?'':cheio?`<p class="panel-readonly">${icone('cadeado')}<span>A empresa já tem ${LIMITE_CUPONS} cupons em vigor, o máximo. Tire um do site ou espere um vencer para criar outro.</span></p>`
    :`<details class="item-new" id="novo-cupom"${lista.length?'':' open'}><summary class="button">${icone('mais')}Novo cupom</summary><form class="panel-form" data-form="cupom-novo" novalidate><h2>Novo cupom</h2><div class="form-errors" role="alert" tabindex="-1" hidden></div>${camposCupom({},'cupom-novo')}<div class="panel-actions"><button type="submit" class="button">Publicar cupom</button><p class="form-note">Entra no ar na hora (ou no dia de início), na página de cupons e no seu perfil.</p></div></form></details>`;
  const lista_=lista.length?`<p class="muted coupons-count">${emVigor} de ${LIMITE_CUPONS} cupons em vigor.</p><ul class="item-list">${lista.map(linha).join('')}</ul>`
    :`<div class="panel-empty-state"><h2>Nenhum cupom ainda</h2><p>Um cupom é um desconto que o morador coleta no guia e mostra na sua loja. Crie o primeiro e divulgue o link.</p></div>`;
  return `${pode?'':leitura(vm,'os cupons')}${novo}${lista_}`;
}

const MODULO={resumo,perfil,catalogo,cupons,resultados,relatorio,solicitacoes,acessos,empresas};

// Atalhos do PDF1: "Criar meu anúncio" é um item novo do tipo oferta (vai para a aprovação); "Solicitar criação ao Nexus" abre a
// solicitação de criação com o briefing.
function atalhos(vm) {
  if(vm.empresa&&vm.modulo==='relatorio'&&vm.dados?.mes)return acoesRelatorio(vm);
  if(!vm.empresa||vm.modulo!=='resumo')return '';
  const base=caminho(vm.empresa.id);
  const criar=vm.pode.catalogo?`<a class="button" href="${base}/catalogo?novo=oferta#novo-item">${icone('mais')}Criar meu anúncio</a>`:'';
  const pedir=vm.pode.solicitar?`<a class="button secondary" href="${base}/solicitacoes?nova=criacao#nova-solicitacao">Solicitar criação ao Nexus</a>`:'';
  return criar||pedir?`<div class="panel-shortcuts">${criar}${pedir}</div>`:'';
}

export function painelView(vm) {
  const modulo=MODULO[vm.modulo]?vm.modulo:'resumo';
  const [titulo,texto]=modulo==='relatorio'&&vm.empresa&&vm.dados?.rotulo?titulosRelatorio(vm):TITULOS[modulo];
  const conteudo=vm.empresa||modulo==='empresas'?MODULO[modulo](vm):MODULO.empresas(vm);
  return `<div class="panel" data-painel data-csrf="${e(vm.csrf)}"${vm.empresa?` data-empresa="${e(vm.empresa.id)}"`:''}><aside class="panel-side" aria-label="Empresa e módulos">${seletor(vm)}${navegacao(vm)}${conta(vm)}</aside><section class="panel-main" aria-labelledby="painel-titulo"><header class="panel-head"><div><h1 id="painel-titulo">${titulo}</h1><p>${texto}</p></div>${atalhos(vm)}</header><div class="panel-flash" data-painel-aviso role="status" tabindex="-1" hidden></div><p class="sr-only" data-painel-anuncio aria-live="polite"></p><noscript><p class="panel-readonly">O painel precisa do JavaScript do navegador para salvar alterações.</p></noscript>${conteudo}</section></div>`;
}
