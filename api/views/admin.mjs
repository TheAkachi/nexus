import { escape as e } from '../lib/html.mjs';
import { campo } from './conta.mjs';
import { FORMATOS, CLASSE_FORMATO, PAGAMENTOS } from './componentes.mjs';
import { data, numero, reais, opcoes, ICONES, fora, vazio, intervalo, rede, semana } from './painel.mjs';

// Fase 4 (contrato 13): admin da equipe Nexus. Uma view só, como o painel: o módulo em vm.modulo, a query da página em
// vm.filtros e, em vm.dados, a lista do módulo (o GET da API com esses filtros) ou, em /admin/<modulo>/<id>, o registro
// (null em /novo). vm.opcoes alimenta os selects; vm.pode só decide o que aparece como editável, porque o servidor confere
// cada escrita. As escritas saem pelo p2/equipe.js (fetch com X-CSRF-Token) e, quando dão certo, a página recarrega com a
// confirmação no topo.

const svg=(d,cls='')=>`<svg class="ico${cls?` ${cls}`:''}" viewBox="0 0 20 20" aria-hidden="true"><path d="${d}"/></svg>`;
const DESENHOS={...ICONES,empresas:ICONES.perfil,relatorios:ICONES.resultados,usuarios:ICONES.acessos,
  fila:'M3.5 5.5h7M3.5 10h7M3.5 14.5h5M12.2 13.6l2.1 2.1 3.6-4.2',banners:'M2.8 5.5h14.4v7.5H2.8zM6.5 13v3.2M13.5 13v3.2M5.6 8.4h5M5.6 10.4h3',
  midia:'M3 4.5h14v11H3zM3 12.8l4-3.8 3.2 3 2.3-2.1 4.5 3.9M13.2 7.6h.01',acessos:'M9.5 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM9.5 10H17M14.4 10v2.6M17 10v2.6',pessoas:'M7.5 9.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4zM2.8 16.2c.5-2.9 2.4-4.5 4.7-4.5s4.2 1.6 4.7 4.5M13.4 9a2.2 2.2 0 1 0 0-4.4M14.6 11.9c1.4.5 2.4 1.9 2.7 4.3',auditoria:'M3.6 7.4A7 7 0 1 1 3 10M3 4.4v3h3M10 6.2v4l2.8 1.7'};
const icone=(nome,cls)=>svg(DESENHOS[nome]||'',cls);

const GRUPOS=[['Gestão do Guia',[['resumo','Resumo'],['empresas','Lugares'],['fila','Fila de aprovação'],['cupons','Cupons'],['conteudo','Eventos e ofertas'],['usuarios','Usuários']]]];
const TITULOS={
  resumo:['Resumo','Visão geral do guia Nexus e atalhos rápidos.'],
  fila:['Fila de aprovação','Alterações e avaliações enviadas pelos parceiros e visitantes aguardando decisão.'],
  solicitacoes:['Solicitações','Pedidos enviados pelos parceiros.'],
  empresas:['Lugares','Cadastro dos espaços gastronômicos e culturais do guia.'],
  conteudo:['Eventos e ofertas','Agenda cultural, ofertas vigentes e coleções da página inicial.'],
  banners:['Banners','Espaços de destaque do guia.'],
  cupons:['Cupons','Cupons publicados no guia, com controle de validade e suspensão.'],
  midia:['Mídia','Biblioteca de imagens do guia.'],
  pessoas:['Pessoas','Curadoria exibida na página Sobre.'],
  relatorios:['Relatórios','Métricas gerais do guia.'],
  usuarios:['Usuários','Contas da equipe e dos parceiros (controle de papéis e acessos).'],
  acessos:['Acessos ao painel','Vínculos de acesso ao painel do parceiro.'],
  auditoria:['Auditoria','Registro de alterações administrativas.']
};
const EQUIPE={admin:'Administração',editor:'Edição',operador:'Operação'};
const SITUACAO={rascunho:'Rascunho',publicado:'Publicado',pausado:'Fora do ar',validacao:'Em aprovação'};
const SITUACAO_EMPRESA={rascunho:'Rascunho',publicado:'Publicada',pausado:'Fora do guia'};
const FILA={pendente:'Esperando decisão',aprovado:'Aprovado',recusado:'Recusado',substituido:'Substituído'};
const TIPO_FILA={descricao:'Texto do perfil',foto:'Foto',catalogo:'Produto ou serviço',oferta:'Oferta',avaliacao:'Avaliação de morador',categoria:'Categoria sugerida'};

// Solicitação dita do lado da equipe: aberta é a vez do Nexus; respondida espera o associado.
const SOL={aberta:'Nova: responder','em-andamento':'Em andamento',respondida:'Esperando o associado',fechada:'Encerrada'};
const SOL_CLASSE={aberta:'vez','em-andamento':'em-andamento',respondida:'pausado',fechada:'pausado'};
const TIPO_SOL={suporte:'Ajuda',criacao:'Criação pelo Nexus',alteracao:'Alteração'};
const PAPEIS={dono:'Dono',editor:'Editor',financeiro:'Financeiro',leitura:'Leitura'};
const TIPO_ITEM={produto:'Produto',servico:'Serviço',oferta:'Oferta'};
const PRECO=[['fixo','Preço fixo'],['a-partir','A partir de'],['consulta','Sob consulta']];
const TIPOS=[['evento','Eventos','Novo evento'],['oferta','Ofertas','Nova oferta'],['colecao','Coleções','Nova coleção']];
const PUBLICO={artigo:'/artigos/',classificado:'/classificados/'};
// Página de cada espaço (EspacoOpcao.pagina, os nomes das views).
const PAGINA_ESPACO={home:'Página inicial',busca:'Busca',conteudos:'Artigos e classificados',conteudo:'Leitura',empresa:'Perfil de empresa',ofertas:'Ofertas',eventos:'Eventos'};
const SEMANA=['dom','seg','ter','qua','qui','sex','sáb'];


// Endereços do admin. Filtros vazios e a página 1 ficam fora da URL.
const rota=(modulo,params={})=>{
  const q=new URLSearchParams();
  for(const [k,v] of Object.entries(params||{}))if(v!==''&&v!=null&&k!=='id'&&!(k==='page'&&Number(v)<=1))q.set(k,String(v));
  const s=q.toString();
  return `/admin${modulo==='resumo'?'':`/${modulo}`}${s?`?${s}`:''}`;
};
const ficha=(modulo,id,params)=>rota(`${modulo}/${encodeURIComponent(id)}`,params);

// Data e hora da API (ISO, em UTC ou com fuso) no horário de São Paulo: "02/10/2026 às 09:30".
const dataHora=v=>{const d=new Date(v||'');return Number.isNaN(d.getTime())?e(v||''):d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(', ',' às ');};
// Início e fim dos eventos chegam em aaaa-mm-ddThh:mm, já no horário de São Paulo.
const quando=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v||'');return m?`${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}`:data(v);};

const dinheiro=c=>c==null?'—':`R$ ${reais(c)}`;
const plural=(n,um,varios)=>`${numero(n)} ${Number(n)===1?um:varios}`;
const porcento=f=>`${(Number(f||0)*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
const quem=p=>e(typeof p==='string'?p:p?.nome||p?.email||'');
const etiqueta=(classe,texto)=>`<span class="state-tag is-${e(classe)}">${texto}</span>`;
const situacao=(s,mapa=SITUACAO)=>etiqueta(s,mapa[s]||e(s||''));
// Banner publicado dito pelo calendário, no dia de São Paulo: agendado (antes do primeiro dia), no ar ou encerrado.
const hojeSP=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
const situacaoBanner=b=>{if(b.status!=='publicado')return situacao(b.status);const h=hojeSP();return b.inicio&&h<b.inicio?etiqueta('em-andamento','Agendado'):b.fim&&h>b.fim?etiqueta('pausado','Encerrado'):etiqueta('publicado','No ar');};
const soLeitura=(vm,oque)=>`<p class="panel-readonly">${icone('cadeado')}<span>Seu papel na equipe (${EQUIPE[vm.equipe]||e(vm.equipe||'')}) vê ${oque}, mas não altera.</span></p>`;
const nomeEmpresa=(vm,id)=>(vm.opcoes?.empresas||[]).find(x=>x.id===id)?.nome||id||'';
const espacoDe=(vm,id)=>(vm.opcoes?.espacos||[]).find(s=>s.id===id);
const nomeEspaco=(vm,id)=>{const s=espacoDe(vm,id);return s?`${PAGINA_ESPACO[s.pagina]||e(s.pagina)}: ${e(s.onde)}`:e(id||'');};

// Categoria da lista única para filtros: o grupo inteiro ou uma subcategoria (pelo slug), sem repetir a subcategoria que
// aparece em mais de um grupo.
function opcoesCategoria(cats,atual) {
  const vistos=new Set();
  return cats.map(g=>`<optgroup label="${e(g.label)}"><option value="${e(g.slug)}"${g.slug===atual?' selected':''}>${e(g.label)}: todo o grupo</option>${(g.subcategorias||[]).filter(s=>!vistos.has(s.slug)&&vistos.add(s.slug)).map(s=>`<option value="${e(s.slug)}"${s.slug===atual?' selected':''}>${e(s.label)}</option>`).join('')}</optgroup>`).join('');
}

// Abas que trocam o recurso da lista (filtros.tipo, filtros.aba ou filtros.status), como links.
const abas=(rotulo,lista,atual,href)=>`<nav class="quick-filters admin-tabs" aria-label="${rotulo}">${lista.map(([v,l])=>`<a class="filter-chip" href="${e(href(v))}"${v===atual?' aria-current="page"':''}>${l}</a>`).join('')}</nav>`;

// Filtros da lista: GET na própria página, com a busca e os campos do módulo; "Limpar filtros" volta à lista sem eles.
function filtros(vm,campos=[],{busca='Buscar',fixos={}}={}) {
  const f=vm.filtros||{};
  const controle=c=>{
    const id=`filtro-${c.nome}`,v=String(f[c.nome]??'');
    const el=c.tipo==='date'?`<input type="date" id="${id}" name="${c.nome}" value="${e(v)}">`:c.tipo==='text'?`<input type="text" id="${id}" name="${c.nome}" value="${e(v)}" maxlength="80">`
      :`<select id="${id}" name="${c.nome}"><option value="">${c.todos||'Todos'}</option>${c.html??opcoes(c.lista||[],v)}</select>`;
    return `<div class="form-field"><label for="${id}">${c.rotulo}</label>${el}</div>`;
  };
  const ativos=[busca?'q':'',...campos.map(c=>c.nome)].some(k=>k&&f[k]);
  const ocultos=Object.entries(fixos).filter(([,v])=>v).map(([k,v])=>`<input type="hidden" name="${e(k)}" value="${e(v)}">`).join('');
  return `<form class="admin-filters" method="get" action="${e(rota(vm.modulo))}" role="search" aria-label="Filtrar a lista">${ocultos}${busca?`<div class="form-field filter-q"><label for="filtro-q">${busca}</label><input type="search" id="filtro-q" name="q" value="${e(f.q||'')}" maxlength="80"></div>`:''}${campos.map(controle).join('')}<div class="filter-actions"><button type="submit" class="button secondary">Filtrar</button>${ativos?`<a class="link-button text-button" href="${e(rota(vm.modulo,fixos))}">Limpar filtros</a>`:''}</div></form>`;
}

function paginacao(vm) {
  const d=vm.dados||{},p=Number(d.pagina)||1,n=Number(d.paginas)||1;
  if(n<=1&&p<=1)return '';
  const ir=(pg,rotulo,rel)=>`<a class="button secondary" rel="${rel}" href="${e(rota(vm.modulo,{...vm.filtros,page:pg}))}">${rotulo}</a>`;
  return `<nav class="admin-pages" aria-label="Páginas da lista">${p>1?ir(Math.min(p-1,n),'<span aria-hidden="true">←</span> Anterior','prev'):''}<span>Página ${numero(p)} de ${numero(n)}</span>${p<n?ir(p+1,'Próxima <span aria-hidden="true">→</span>','next'):''}</nav>`;
}
const contagem=(d,um,varios)=>`<p class="admin-count">${plural(d?.total||0,um,varios)}</p>`;
// Tabela que, no celular, vira uma ficha por linha (o rótulo da coluna vem de data-rotulo).
const tabela=(cabeca,linhas,classe='')=>`<div class="table-wrap"><table class="panel-table admin-table${classe?` ${classe}`:''}"><thead><tr>${cabeca.map(([t,c])=>`<th scope="col"${c?` class="${c}"`:''}>${t}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table></div>`;
const semResultado=(vm,comFiltro,semFiltro)=>vazio(['q','status','bairro','categoria','plano','editoria','espaco','empresa','tipo','acao','de','ate'].some(k=>vm.filtros?.[k]&&!(k==='tipo'&&vm.modulo==='conteudo'))?comFiltro:semFiltro);

// Peças dos formulários de registro ------------------------------------------------------------------------------------

// Imagem da biblioteca: a prévia, o botão que abre a biblioteca e o campo escondido com a URL (depois dos botões, para o
// erro do servidor levar o foco ao botão). No banner, a prévia mostra a arte inteira e há o aviso de tamanho (equipe.js).
function campoImagem(nome,rotulo,valor,{dica='',dis='',banner=false}={}) {
  return `<div class="form-field full image-field${banner?' is-peca':''}" data-imagem-campo data-campo="${nome}"><span class="field-label" id="rotulo-${nome}">${rotulo}</span><div class="image-field-box"><div class="image-field-preview" data-imagem-previa>${valor?`<img src="${e(valor)}" alt="" loading="lazy" decoding="async">`:'<span>Nenhuma imagem</span>'}</div><div class="image-field-actions"><button type="button" class="button secondary" data-escolher-imagem aria-describedby="rotulo-${nome}"${dis}>${valor?'Trocar imagem':'Escolher na biblioteca'}</button><button type="button" class="link-button text-button danger" data-tirar-imagem${valor?'':' hidden'}${dis}>Tirar imagem<span class="sr-only">: ${rotulo}</span></button></div></div>${dica?`<p class="field-hint">${dica}</p>`:''}${banner?'<p class="field-warning" data-imagem-aviso hidden></p>':''}<input type="hidden" name="${nome}" value="${e(valor||'')}"></div>`;
}

// Editor de texto rico simples (títulos, listas, negrito, links e imagens da biblioteca). O html chega já saneado pelo
// servidor (contrato 13.3, o mesmo saneamento do bodyHtml), por isso entra sem escape; o equipe.js limpa o que a edição
// produzir e manda o HTML no campo escondido.
function editor(nome,rotulo,html,{dica='',dis=false}={}) {
  const b=(cmd,texto,rot)=>`<button type="button" class="secondary" data-cmd="${cmd}"${rot?` aria-label="${rot}"`:''}${dis?' disabled':''}>${texto}</button>`;
  const barra=`<div class="rich-toolbar" role="toolbar" aria-label="Formatar o texto" aria-controls="editor-${nome}">${b('h2','Título','Título de seção')}${b('h3','Subtítulo')}${b('p','Parágrafo')}<span class="rich-sep" aria-hidden="true"></span>${b('ul','Lista')}${b('ol','Lista numerada')}${b('b','<strong>N</strong>','Negrito')}<span class="rich-sep" aria-hidden="true"></span>${b('link','Link')}${b('imagem','Imagem')}</div>`;
  const link=`<div class="rich-link" data-link-barra hidden><label for="link-${nome}">Endereço do link</label><input type="text" id="link-${nome}" data-link-url inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://"><button type="button" class="button secondary" data-link-aplicar>Aplicar</button><button type="button" class="link-button text-button" data-link-tirar>Tirar o link</button><button type="button" class="link-button text-button" data-link-cancelar>Cancelar</button></div>`;
  return `<div class="form-field full rich-field" data-campo="${nome}"><span class="field-label" id="rotulo-${nome}">${rotulo}</span><div class="rich-editor" data-editor="${nome}">${barra}${link}<div class="rich-area" id="editor-${nome}" contenteditable="${dis?'false':'true'}" role="textbox" aria-multiline="true" aria-labelledby="rotulo-${nome}"${dica?` aria-describedby="dica-${nome}"`:''} data-area>${html||'<p><br></p>'}</div></div>${dica?`<p class="field-hint" id="dica-${nome}">${dica}</p>`:''}<input type="hidden" name="${nome}"></div>`;
}

const textarea=(valor,max,linhas=3,extra='')=>a=>`<textarea ${a} rows="${linhas}" maxlength="${max}"${extra}>${e(valor||'')}</textarea>`;
const texto=(valor,max,extra='')=>a=>`<input type="text" ${a} value="${e(valor??'')}" maxlength="${max}"${extra}>`;
const escolha=(lista,atual,vazioRotulo)=>a=>`<select ${a}>${vazioRotulo!=null?`<option value="">${vazioRotulo}</option>`:''}${opcoes(lista,atual??'')}</select>`;
const caixas=(nome,lista,marcadas)=>`<div class="check-options">${lista.map(([v,l])=>`<label class="toggle"><input type="checkbox" name="${nome}" value="${e(v)}"${marcadas.has(v)?' checked':''}><span>${e(l)}</span></label>`).join('')}</div>`;

// Formulário de um registro: erros no topo, versão lida e a barra de ações fixa no rodapé.
const formulario=(tipo,x,novo,corpo,acoes,extra='')=>`<form class="panel-form admin-form" data-form="${tipo}"${novo?' data-novo':` data-id="${e(x.id)}"`}${extra} novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><input type="hidden" name="version" value="${e(novo?'':x.version??'')}">${corpo}${acoes?`<div class="panel-actions admin-save">${acoes}</div>`:''}</form>`;

// Botões de salvar de quem publica (empresa, conteúdo, banner): salvar e publicar de uma vez, ou só salvar. Publicado,
// salvar já vale no guia, e tirar do ar é um botão à parte. rascunho: no registro novo, o rascunho vem primeiro e é o
// padrão (o Enter do formulário salva sem publicar), e o texto diz o que cada botão faz.
function botoesPublicar(x,novo,{publicar='Salvar e publicar',nota='',rascunho=false}={}) {
  if(!novo&&x.status==='publicado')return `<button type="submit" class="button">Salvar alterações</button><button type="button" class="button secondary" data-acao-registro="pausar">Tirar do ar</button><p class="form-note">As alterações valem no guia assim que você salva.</p>`;
  if(novo&&rascunho)return `<button type="submit" class="button" data-depois="">Salvar como rascunho</button><button type="submit" class="button secondary" data-depois="publicar">${publicar}</button><p class="form-note">${nota||'Como rascunho, fica fora do guia até alguém publicar. “Salvar e publicar” já põe no guia.'}</p>`;
  return `<button type="submit" class="button" data-depois="publicar">${!novo&&x.status==='pausado'?publicar.replace('publicar','publicar de novo'):publicar}</button><button type="submit" class="button secondary" data-depois="">${novo?'Salvar como rascunho':'Salvar sem publicar'}</button>${nota?`<p class="form-note">${nota}</p>`:''}`;
}

// Biblioteca de imagens (enviar e escolher), aberta pelos campos de imagem e pelo editor.
const envioMidia=prefixo=>`<form class="photo-upload" data-envio-midia novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${campo('arquivo','Escolher imagem',a=>`<input type="file" ${a} accept="image/jpeg,image/png,image/webp" required>`,{id:`${prefixo}-arquivo`,dica:'JPG, PNG ou WebP, até 8 MB. A biblioteca guarda versões de 320, 800 e 1600 px de largura.'})}<figure class="photo-preview" data-previa hidden><figcaption data-previa-nome></figcaption></figure>${campo('alt','Descreva a imagem',a=>`<input type="text" ${a} maxlength="200" required placeholder="Artesãos montando as barracas na praça do Centro">`,{id:`${prefixo}-alt`,dica:'Obrigatória. É o que o leitor de tela fala no lugar da imagem: diga o que aparece nela.'})}<div class="panel-actions"><button type="submit" class="button">Enviar imagem</button></div></form>`;
const biblioteca=()=>`<dialog class="media-picker" data-biblioteca aria-labelledby="biblioteca-titulo"><div class="media-picker-head"><h2 id="biblioteca-titulo">Biblioteca de imagens</h2><button type="button" class="icon-button small" data-fechar-biblioteca aria-label="Fechar a biblioteca">${icone('fechar')}</button></div><form class="media-picker-search" role="search" data-biblioteca-busca><label for="biblioteca-q">Buscar pela descrição</label><div><input type="search" id="biblioteca-q" name="q" maxlength="80"><button type="submit" class="button secondary">Buscar</button></div></form><div class="media-picker-grid" data-biblioteca-lista aria-busy="true"></div><p class="sr-only" data-biblioteca-status aria-live="polite"></p><div class="media-picker-more"><button type="button" class="button secondary" data-biblioteca-mais hidden>Mostrar mais imagens</button></div><details class="media-picker-upload"><summary class="button secondary">${icone('mais')}Enviar uma imagem nova</summary>${envioMidia('dialogo')}</details></dialog>`;

// Resumo ---------------------------------------------------------------------------------------------------------------

function resumo(vm) {
  const r=vm.dados||{},pode=vm.pode||{},o=vm.opcoes||{};
  const linha=(ico,href,n,um,varios,nada)=>`<li>${icone(ico)}<a href="${href}">${n?`<span><strong>${numero(n)}</strong> ${n===1?um:varios}</span>`:`<span>${nada}</span>`}<span aria-hidden="true">→</span></a></li>`;
  const espera=`<section class="panel-block block-depende${r.fila?' has-items':''}" aria-labelledby="r-espera"><h2 id="r-espera">Esperando aprovação</h2><ul class="todo-list">${linha('fila','/admin/fila',r.fila,'envio na fila de aprovação','envios na fila de aprovação','A fila de aprovação está vazia')}</ul></section>`;
  const atalho=(ok,href,rotulo,classe='button secondary')=>ok?`<a class="${classe}" href="${href}">${rotulo}</a>`:'';
  const fazer=[atalho(pode.empresas,'/admin/empresas/novo',`${icone('mais')}Cadastrar lugar`,'button'),atalho(pode.conteudo,'/admin/conteudo/novo?tipo=evento',`${icone('mais')}Novo evento`),atalho(pode.conteudo,'/admin/conteudo/novo?tipo=oferta',`${icone('mais')}Nova oferta`)].filter(Boolean).join('');
  const atalhos=fazer?`<section class="panel-block" aria-labelledby="r-fazer"><h2 id="r-fazer">Ações rápidas</h2><div class="admin-shortcuts">${fazer}</div></section>`:'';
  const cartao=(href,rotulo,valor,nota='')=>`<a class="stat-card" href="${href}"><span class="stat-label">${rotulo}</span><strong>${valor}</strong>${nota?`<small>${nota}</small>`:''}</a>`;
  const em=r.empresas||{},cu=r.cupons,f=vm.filtros||{},recorte=r.recorte||null;
  const nomeCategoria=slug=>{for(const g of o.categorias||[]){if(g.slug===slug)return g.label;const s=(g.subcategorias||[]).find(x=>x.slug===slug);if(s)return s.label;}return slug;};
  const fatia=recorte?[recorte.bairro,recorte.categoria&&nomeCategoria(recorte.categoria)].filter(Boolean).map(e).join(' · '):'';
  const doRecorte={bairro:recorte?.bairro,categoria:recorte?.categoria};
  const regiao=`<section class="panel-block admin-slice${recorte?' is-sliced':''}" aria-labelledby="r-regiao"><h2 id="r-regiao">${recorte?`Recorte: ${fatia}`:'Filtrar por bairro e categoria'}</h2><form class="admin-filters is-compact" method="get" action="/admin" role="search" aria-labelledby="r-regiao"><div class="form-field"><label for="r-bairro">Bairro</label><select id="r-bairro" name="bairro"><option value="">Todos os bairros</option>${opcoes((o.bairros||[]).map(b=>[b,b]),f.bairro||'')}</select></div><div class="form-field"><label for="r-categoria">Categoria</label><select id="r-categoria" name="categoria"><option value="">Todas as categorias</option>${opcoesCategoria(o.categorias||[],f.categoria||'')}</select></div><div class="filter-actions"><button type="submit" class="button secondary">Filtrar</button>${recorte?'<a class="link-button text-button" href="/admin">Ver tudo</a>':''}</div></form>${recorte?`<p class="panel-links"><a href="${e(rota('empresas',doRecorte))}">Ver lugares deste recorte <span aria-hidden="true">→</span></a></p>`:''}</section>`;
  const numeros=`<section class="admin-stats" aria-labelledby="r-guia"><h2 id="r-guia" class="sr-only">${recorte?`O recorte ${fatia}`:'O guia hoje'}</h2>${cartao(e(rota('empresas',{status:'publicado',...doRecorte})),'Lugares no guia',numero(em.publicadas),em.pausadas?`${plural(em.pausadas,'pausado','pausados')}`:'')}${cu?cartao('/admin/cupons?status=ativo','Cupons ativos',numero(cu.ativos),`${plural(cu.coletas30,'coleta','coletas')} em 30 dias`):''}</section>`;
  return `${regiao}${numeros}<div class="summary-grid">${espera}${atalhos}</div>`;
}

// Fila de aprovação -----------------------------------------------------------------------------------------------------

// Antes e depois de cada envio (Fila.dados por tipo, contrato 13.9): o texto que está no guia ao lado do que chegou.
const paragrafos=t=>t?String(t).split(/\n\s*\n/).map(p=>`<p>${e(p)}</p>`).join(''):'<p class="muted">Em branco</p>';
function diferenca(a) {
  const d=a.dados||{};
  if(a.tipo==='descricao'){
    const antes=d.antes||{},campos=[['resumo','Resumo'],['descricao','Sobre a empresa']];
    return `<div class="diff">${campos.map(([k,l])=>{const mudou=(antes[k]||'')!==(d[k]||'');return `<div class="diff-row${mudou?' is-changed':''}"><h3>${l}${mudou?'':' <small>(sem mudança)</small>'}</h3><div class="diff-cols"><div class="diff-col"><p class="diff-label">No guia agora</p>${paragrafos(antes[k])}</div><div class="diff-col is-new"><p class="diff-label">Enviado</p>${paragrafos(d[k])}</div></div></div>`;}).join('')}</div>`;
  }
  // v0.17.0 (18.4): avaliação de morador, com a nota, o texto como chegou (não se edita) e o primeiro nome de quem escreveu.
  if(a.tipo==='avaliacao')return `<div class="queue-review"><p class="queue-review-head"><span class="queue-review-stars" aria-hidden="true">${'★'.repeat(Number(d.nota)||0)}${'☆'.repeat(5-(Number(d.nota)||0))}</span><strong>Nota ${Number(d.nota)||'—'} de 5</strong> · ${e(d.autor?.nome||'Morador')}</p>${paragrafos(d.texto)}</div>`;
  if(a.tipo==='foto')return `<figure class="queue-photo"><img src="${e(d.url)}" alt="" width="${Number(d.largura)||800}" height="${Number(d.altura)||600}" loading="lazy" decoding="async"><figcaption>${d.alt?`Descrição: ${e(d.alt)}`:'<strong>Sem descrição.</strong> Quem usa leitor de tela não vai saber o que a foto mostra.'}</figcaption></figure>`;
  if(a.tipo==='catalogo'||a.tipo==='oferta'){
    const preco=i=>i.precoModo==='consulta'||i.precoCentavos==null?'Sob consulta':`${i.precoModo==='a-partir'?'A partir de ':''}R$ ${reais(i.precoCentavos)}`;
    const campos=[['Tipo',i=>TIPO_ITEM[i.tipo]||e(i.tipo||'')],['Nome',i=>e(i.nome||'')],['Descrição',i=>e(i.descricao||'')],['Preço',preco],...(a.tipo==='oferta'||d.tipo==='oferta'?[['Condições',i=>e(i.condicoes||'')],['Válida até',i=>data(i.validade)]]:[])];
    if(!d.antes)return `<p class="diff-label">Item novo</p><dl class="panel-dl">${campos.map(([l,f])=>`<div><dt>${l}</dt><dd>${f(d)||'—'}</dd></div>`).join('')}</dl>`;
    return `<div class="table-wrap"><table class="panel-table diff-table"><thead><tr><th scope="col">Campo</th><th scope="col">No guia agora</th><th scope="col">Enviado</th></tr></thead><tbody>${campos.map(([l,f])=>{const x=f(d.antes),y=f(d);return `<tr${x!==y?' class="is-changed"':''}><th scope="row">${l}</th><td>${x||'—'}</td><td>${y||'—'}${x!==y?'<span class="sr-only"> (mudou)</span>':''}</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  // v0.22.0 (22.5): a categoria sugerida pelo anunciante, com o grupo e as parecidas que já estão na lista.
  if(a.tipo==='categoria'){
    const parecidas=(d.parecidas||[]).length?`<div class="queue-similar"><p class="diff-label">Parecidas na lista</p><ul class="similar-list">${d.parecidas.map(p=>`<li><strong>${e(p.nome)}</strong><small>${(p.grupos||[]).map(g=>e(g.label)).join(', ')} · ${plural(p.empresas,'empresa','empresas')} no guia</small></li>`).join('')}</ul></div>`:'<p class="muted queue-similar">Nenhuma categoria parecida na lista.</p>';
    return `<dl class="panel-dl"><div><dt>Nome sugerido</dt><dd>${e(d.nome||'')}</dd></div><div><dt>Grupo</dt><dd>${e(d.grupo?.label||'')}</dd></div></dl>${parecidas}`;
  }
  return `<dl class="panel-dl">${Object.entries(d).filter(([,v])=>typeof v==='string'||typeof v==='number').map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>`;
}
// As decisões da categoria sugerida (22.5): aprovar e criar (o nome e o grupo editáveis) ou trocar por uma da lista, que já vem
// com a primeira parecida escolhida. A recusa é a mesma dos outros tipos.
function decidirCategoria(vm,a,{titulo,contexto}) {
  const d=a.dados||{},grupos=vm.opcoes?.categorias||[],vistas=new Set(),sugerida=d.parecidas?.[0]?.nome||'';
  const lista=grupos.map(g=>{const subs=(g.subcategorias||[]).filter(s=>!vistas.has(s.label)&&vistas.add(s.label));return subs.length?`<optgroup label="${e(g.label)}">${subs.map(s=>`<option value="${e(s.label)}"${s.label===sugerida?' selected':''}>${e(s.label)}</option>`).join('')}</optgroup>`:'';}).join('');
  const dados=`data-fila="${e(a.id)}" data-version="${e(a.version)}" data-assunto="${titulo}"`;
  const aprovar=`<details class="queue-approve"><summary class="button">Aprovar e criar<span class="sr-only">: ${contexto}</span></summary><form class="panel-form" data-form="aprovar-categoria" ${dados} novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${campo('nome','Nome da categoria',texto(d.nome,60,' required'),{id:`categoria-${a.id}-nome`,dica:'Corrija se precisar: é assim que ela aparece no guia.'})}${campo('grupo','Grupo',escolha(grupos.map(g=>[g.slug,g.label]),d.grupo?.slug||''),{id:`categoria-${a.id}-grupo`})}<div class="panel-actions"><button type="submit" class="button">Criar e pôr na empresa</button></div></form></details>`;
  const trocar=`<details class="queue-swap"><summary class="button secondary">Trocar por uma da lista<span class="sr-only">: ${contexto}</span></summary><form class="panel-form" data-form="trocar-categoria" ${dados} novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${campo('categoria','Categoria da lista',a2=>`<select ${a2} required><option value="">Escolha a categoria</option>${lista}</select>`,{id:`troca-${a.id}`,dica:'A empresa fica com esta categoria, e nada novo é criado.'})}<div class="panel-actions"><button type="submit" class="button">Pôr esta na empresa</button></div></form></details>`;
  return `${aprovar}${trocar}`;
}
function fila(vm) {
  const f=vm.filtros||{},st=['aprovado','recusado'].includes(f.status)?f.status:'pendente',d=vm.dados||{},itens=d.itens||[],pode=vm.pode?.fila;
  const tabs=abas('Situação dos envios',[['pendente',`Esperando decisão${vm.contagem?.fila?` (${numero(vm.contagem.fila)})`:''}`],['aprovado','Aprovados'],['recusado','Recusados']],st,v=>rota('fila',{...(v==='pendente'?{}:{status:v}),tipo:f.tipo,empresa:f.empresa}));
  const filtro=filtros(vm,[{nome:'tipo',rotulo:'Tipo',lista:Object.entries(TIPO_FILA)},{nome:'empresa',rotulo:'Empresa',lista:(vm.opcoes?.empresas||[]).map(x=>[x.id,x.nome]),todos:'Todas'}],{busca:'',fixos:st==='pendente'?{}:{status:st}});
  // Envio repetido na mesma página (mesma empresa, tipo e conteúdo): o segundo avisa, para aprovar um e recusar o outro.
  const chave=a=>{const d=a.dados||{};return JSON.stringify([a.tipo,a.empresa?.id,a.tipo==='foto'?d.url:a.tipo==='descricao'?[d.resumo,d.descricao]:a.tipo==='avaliacao'?[d.autor?.nome,d.nota,d.texto]:a.tipo==='categoria'?[d.nome,d.grupo?.slug]:[d.nome,d.descricao,d.precoModo,d.precoCentavos,d.condicoes,d.validade]]);};
  const primeiro=new Map();for(const a of itens)if(!primeiro.has(chave(a)))primeiro.set(chave(a),a);
  // O título é o que se decide ("Oferta · Café da manhã para dois"); a empresa e quem mandou vão logo abaixo.
  const assunto=a=>{const d=a.dados||{},nome=a.tipo==='foto'?d.alt:a.tipo==='descricao'?'':a.tipo==='avaliacao'?`${d.autor?.nome||'Morador'}, nota ${d.nota}`:d.nome;return `${TIPO_FILA[a.tipo]||a.tipo||''}${nome?` · ${nome}`:''}`;};
  const item=a=>{
    const titulo=e(assunto(a)),contexto=`${titulo} de ${e(a.empresa?.nome||'')}`,igual=primeiro.get(chave(a));
    const repetido=igual&&igual!==a?`<p class="queue-dup">${icone('falta')}<span>Igual a outro envio desta lista (${dataHora(igual.enviado?.em)}). Aprove um e recuse o outro como repetido.</span></p>`:'';
    const perfil=a.empresa?.id?` data-perfil="${e(`/comercio/${a.empresa.id}`)}"`:'';
    const decidir=a.status==='pendente'&&pode?`<div class="queue-actions">${a.tipo==='categoria'?decidirCategoria(vm,a,{titulo,contexto}):`<button type="button" class="button" data-aprovar="${e(a.id)}" data-version="${e(a.version)}" data-assunto="${titulo}"${perfil}>Aprovar<span class="sr-only">: ${contexto}</span></button>`}<details class="queue-refuse"><summary class="button secondary">Recusar<span class="sr-only">: ${contexto}</span></summary><form class="panel-form" data-form="recusa" data-fila="${e(a.id)}" data-version="${e(a.version)}" data-assunto="${titulo}" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${(a.tipo==='avaliacao'?campo('comentario','Por que não publicar',textarea('',600,3,' required'),{id:`recusa-${a.id}`,dica:'Fica no registro da equipe. Recuse só o que fere as regras (ofensa, dado pessoal, propaganda), nunca por a nota ser baixa.'}):campo('comentario','O que o associado precisa mudar',textarea('',600,3,' required'),{id:`recusa-${a.id}`,dica:'O associado lê este comentário no painel. Seja específico: “A foto está escura; envie uma com a fachada de dia.”'}))}<div class="panel-actions"><button type="submit" class="button">Recusar com este comentário</button></div></form></details></div>`
      :a.status==='pendente'?'':`<p class="queue-decided">${FILA[a.status]||e(a.status)}${a.decidido?` por ${quem(a.decidido.por)} em ${dataHora(a.decidido.em)}`:''}${a.comentario?`: “${e(a.comentario)}”`:''}</p>`;
    const empresa=a.empresa?.id?`<a href="${e(ficha('empresas',a.empresa.id))}">${e(a.empresa.nome)}</a>`:e(a.empresa?.nome||'');
    const historico=a.empresa?.id?` · <a href="${e(rota('auditoria',{empresa:a.empresa.id}))}">Histórico<span class="sr-only"> de ${e(a.empresa.nome)} na auditoria</span></a>`:'';
    return `<li><article class="queue-item" id="fila-${e(a.id)}" aria-labelledby="fila-titulo-${e(a.id)}" tabindex="-1"><header class="queue-head">${a.status==='pendente'?'':`<div class="item-tags">${situacao(a.status,FILA)}</div>`}<h2 id="fila-titulo-${e(a.id)}">${titulo}</h2><p class="queue-meta">${empresa} · enviado por ${quem(a.enviado?.por)} em ${dataHora(a.enviado?.em)}${historico}</p></header>${repetido}${diferenca(a)}${decidir}</article></li>`;
  };
  const lista=itens.length?`<ul class="queue-list">${itens.map(item).join('')}</ul>`:st==='pendente'?`<div class="panel-empty-state"><h2>Nada esperando aprovação</h2><p>Quando um associado mandar um texto, uma foto, um produto ou uma oferta, aparece aqui.</p></div>`:semResultado(vm,'Nenhum envio com esses filtros.','Nenhum envio decidido ainda.');
  return `${tabs}${filtro}${pode?'':soLeitura(vm,'a fila')}${itens.length?contagem(d,'envio','envios'):''}${lista}${paginacao(vm)}`;
}

// Empresas, redes e planos ----------------------------------------------------------------------------------------------

function empresasLista(vm) {
  const f=vm.filtros||{},o=vm.opcoes||{},d=vm.dados||{},itens=d.itens||[];
  const filtro=filtros(vm,[{nome:'status',rotulo:'Situação',lista:[['publicado','Publicado'],['pausado','Pausado'],['rascunho','Rascunho']],todos:'Todos'},{nome:'bairro',rotulo:'Bairro',lista:(o.bairros||[]).map(b=>[b,b])},
    {nome:'categoria',rotulo:'Categoria',html:opcoesCategoria(o.categorias||[],f.categoria),todos:'Todas'}],{busca:'Nome, bairro ou endereço'});
  const linha=x=>`<tr><th scope="row"><a href="${e(ficha('empresas',x.id))}">${e(x.nome)}</a>${x.destaque?' <span class="type-tag">Destaque</span>':''}</th><td data-rotulo="Bairro">${e(x.bairro||'—')}</td><td data-rotulo="Categorias">${e((x.categorias||[]).join(', ')||'—')}</td><td data-rotulo="Situação">${situacao(x.status,SITUACAO_EMPRESA)}</td><td data-rotulo="Atualizada">${data(x.atualizada)}</td></tr>`;
  const lista=itens.length?tabela([['Lugar'],['Bairro'],['Categorias'],['Situação'],['Atualizado']],itens.map(linha).join('')):semResultado(vm,'Nenhum lugar com esses filtros.','Nenhum lugar cadastrado ainda.');
  return `${filtro}${contagem(d,'lugar','lugares')}${lista}${paginacao(vm)}`;
}
function redes(vm) {
  const itens=vm.dados?.itens||[],pode=vm.pode?.empresas;
  const nova=pode?`<details class="item-new" id="nova-rede"><summary class="button">${icone('mais')}Nova rede</summary><form class="panel-form" data-form="rede" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><div class="form-grid">${campo('nome','Nome da rede',texto('',80,' required'),{id:'rede-nome',dica:'Marcas com várias unidades no guia, como a Medic ou o Kibarato. A unidade se liga à rede no cadastro da empresa.'})}</div><div class="panel-actions"><button type="submit" class="button">Criar rede</button></div><div class="similar-names" data-parecidas tabindex="-1" hidden></div></form></details>`:'';
  const lista=itens.length?tabela([['Rede'],['Unidades no guia','num']],itens.map(r=>`<tr><th scope="row">${e(r.nome)}</th><td class="num" data-rotulo="Unidades">${numero(Array.isArray(r.empresas)?r.empresas.length:r.empresas)}</td></tr>`).join('')):vazio('Nenhuma rede cadastrada ainda.');
  return `${nova}${lista}${paginacao(vm)}`;
}
const camposPlano=(p,prefixo)=>`<div class="form-grid">${campo('nome','Nome',texto(p.nome,60,' required'),{id:`${prefixo}-nome`})}${campo('precoCentavos','Preço por mês (R$)',texto(p.precoCentavos==null?'':reais(p.precoCentavos),12,' inputmode="decimal" placeholder="0,00"'),{id:`${prefixo}-preco`})}${campo('ordem','Ordem na busca',a=>`<input type="number" ${a} value="${e(p.ordem??0)}" min="0" max="100" step="1">`,{id:`${prefixo}-ordem`,dica:'Plano de ordem maior aparece antes na busca.'})}${campo('status','Situação',escolha([['ativo','Ativo'],['pausado','Pausado']],p.status||'ativo'),{id:`${prefixo}-status`})}<div class="form-field full check-options"><label class="toggle"><input type="checkbox" name="patrocinado"${p.patrocinado?' checked':''}><span>Mostra o selo “Patrocinado” nos cards</span></label><label class="toggle"><input type="checkbox" name="pago"${p.pago?' checked':''}><span>Conta como pagante na regra dos anúncios</span></label></div></div>`;
function planos(vm) {
  const itens=vm.dados?.itens||[],pode=vm.pode?.planos;
  const novo=pode?`<details class="item-new" id="novo-plano"><summary class="button">${icone('mais')}Novo plano</summary><form class="panel-form" data-form="plano" data-novo novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${camposPlano({},'plano-novo')}<div class="panel-actions"><button type="submit" class="button">Criar plano</button></div></form></details>`:soLeitura(vm,'os planos');
  const linha=p=>`<tr><th scope="row">${e(p.nome)}</th><td class="num" data-rotulo="Preço">${dinheiro(p.precoCentavos)}</td><td class="num" data-rotulo="Ordem">${numero(p.ordem)}</td><td data-rotulo="Selo">${p.patrocinado?'Patrocinado':'—'}</td><td data-rotulo="Pagante">${p.pago?'Sim':'Não'}</td><td data-rotulo="Situação">${etiqueta(p.status==='ativo'?'publicado':'pausado',p.status==='ativo'?'Ativo':'Pausado')}</td><td class="num">${pode?`<button type="button" class="link-button text-button" data-editar-linha="plano-${e(p.id)}" aria-expanded="false" aria-controls="plano-${e(p.id)}">Editar<span class="sr-only"> ${e(p.nome)}</span></button>`:''}</td></tr>${pode?`<tr class="edit-row" id="plano-${e(p.id)}" hidden><td colspan="7"><form class="panel-form" data-form="plano" data-id="${e(p.id)}" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><input type="hidden" name="version" value="${e(p.version)}">${camposPlano(p,`plano-${p.id}`)}<div class="panel-actions"><button type="submit" class="button">Salvar plano</button></div></form></td></tr>`:''}`;
  return `${novo}${itens.length?tabela([['Plano'],['Preço por mês','num'],['Ordem','num'],['Selo'],['Pagante'],['Situação'],['<span class="sr-only">Ações</span>','num']],itens.map(linha).join(''),'plans-table'):vazio('Nenhum plano cadastrado ainda. Use “Novo plano” para criar o primeiro.')}`;
}

// Plano definido pela gestão comercial (contrato 19.4 e 19.5): somente leitura, sem o campo no formulário, para o salvar
// não mandar o plano (o equipe.js só manda o que está no formulário).
const GESTAO='<span class="state-tag is-em-andamento">Definido pela gestão</span>';
const nomePlano=(vm,p)=>{const id=p?.id??p;return id?(vm.opcoes?.planos||[]).find(o=>o.id===id)?.nome||p?.nome||id:'';};
const planoDaGestao=(vm,x)=>`<div class="form-field managed-plan" data-campo="plano"><span class="field-label">Plano</span><p class="managed-plan-value"><span>${e(nomePlano(vm,x.plano)||'Sem plano pago')}</span> ${GESTAO}</p><p class="field-hint">A gestão comercial define o plano pela assinatura desta empresa: ele muda quando a assinatura é paga, vence ou é cancelada. Para mudar o plano, altere a assinatura na gestão.</p></div>`;

function empresaRegistro(vm) {
  const x=vm.dados||{},novo=vm.dados===null,o=vm.opcoes||{},pode=vm.pode?.empresas,dis=pode?'':' disabled';
  const marcadas=new Set(x.categorias||[]),conhecidas=new Set();
  const grupos=(o.categorias||[]).map(g=>{
    const subs=(g.subcategorias||[]).filter(s=>!conhecidas.has(s.label)&&conhecidas.add(s.label));if(!subs.length)return '';
    const n=subs.filter(s=>marcadas.has(s.label)).length;
    return `<details class="category-group" data-grupo="${e(g.slug)}"${n?' open':''}><summary>${e(g.label)}${n?` <span class="count-tag">${n}</span>`:''}</summary>${caixas('categorias',subs.map(s=>[s.label,s.label]),marcadas)}</details>`;
  }).join('');
  const outras=[...marcadas].filter(c=>!conhecidas.has(c));
  // Categoria e rede novas (v0.22.0, contrato 22.3 e 22.6): o equipe.js cria pelo POST e, com nomes parecidos, pergunta antes.
  // Criada, a categoria já vem marcada e a rede já vem escolhida, mas a empresa ainda precisa ser salva.
  const gruposOpcoes=(o.categorias||[]).map(g=>[g.slug,g.label]);
  const categoriaNova=pode?`<details class="category-new" data-categoria-nova><summary class="link-button text-button">${icone('mais')}Outra categoria…</summary><div class="category-new-body"><p class="field-hint">Só se nenhuma da lista servir. Criada, ela vale para todas as empresas, na busca e nos filtros.</p><div class="form-grid">${campo('categoriaNova','Nome da categoria',texto('',60,' autocomplete="off" placeholder="Ex.: Pizzarias"'),{id:'categoria-nova-nome'})}${campo('categoriaGrupo','Grupo',escolha(gruposOpcoes,'','Escolha o grupo'),{id:'categoria-nova-grupo',dica:'O grupo da página inicial e da busca em que ela aparece.'})}</div><div class="panel-actions"><button type="button" class="button secondary" data-criar-categoria>Criar a categoria</button></div><div class="similar-names" data-parecidas tabindex="-1" hidden></div></div></details>`:'';
  const ident=`<fieldset class="panel-fieldset" id="identificacao"${dis}><legend>Empresa</legend><div class="form-grid">${campo('nome','Nome',texto(x.nome,120,' required'))}${novo?campo('slug','Endereço no guia',texto('',80,' autocapitalize="off" spellcheck="false" placeholder="padaria-do-centro"'),{dica:'Opcional. Em branco, o endereço sai do nome.'}):''}${campo('bairro','Bairro',texto(x.bairro,80,' list="lista-bairros"'))}${campo('cidade','Cidade',texto(x.cidade,80))}${campo('rua','Endereço',texto(x.rua,160,' placeholder="Rua, número e complemento"'),{full:true})}${campo('cep','CEP',texto(x.cep,9,' inputmode="numeric" placeholder="26000-000"'))}${campo('referencia','Ponto de referência',texto(x.referencia,120,' placeholder="Ex.: em frente à praça da matriz"'),{full:true,dica:'Opcional. Aparece no perfil, junto do endereço.'})}<div class="form-field full" data-campo="pagamentos"><span class="field-label">Formas de pagamento</span>${caixas('pagamentos',Object.entries(PAGAMENTOS),new Set(x.pagamentos||[]))}</div></div><datalist id="lista-bairros">${(o.bairros||[]).map(b=>`<option value="${e(b)}">`).join('')}</datalist></fieldset>`;
  const categorias=`<fieldset class="panel-fieldset" id="categorias" data-campo="categorias"${dis}><legend>Categorias</legend><p class="fieldset-note">Onde a empresa aparece na busca. Abra o grupo para marcar as categorias.</p><div class="category-groups">${grupos}</div>${outras.length?`<p class="field-hint">Fora da lista única (desmarque para tirar):</p>${caixas('categorias',outras.map(c=>[c,c]),marcadas)}`:''}${categoriaNova}</fieldset>`;
  const contatos=`<fieldset class="panel-fieldset" id="contatos"${dis}><legend>Contatos</legend><div class="form-grid">${campo('whatsapp','WhatsApp',a=>`<input type="tel" ${a} value="${e(x.whatsapp||'')}" inputmode="tel" maxlength="20" placeholder="(21) 90000-0000">`)}${campo('telefone','Telefone',a=>`<input type="tel" ${a} value="${e(x.telefone||'')}" inputmode="tel" maxlength="20">`)}${campo('email','E-mail',a=>`<input type="email" ${a} value="${e(x.email||'')}" inputmode="email" maxlength="160">`)}${campo('site','Site',texto(x.site,300,' inputmode="url" autocapitalize="off" spellcheck="false" placeholder="empresa.com.br"'))}</div></fieldset><fieldset class="panel-fieldset" id="redes" data-campo="redes"${dis}><legend>Redes sociais</legend><div class="social-list" data-redes>${(x.redes||[]).map(rede).join('')}</div><button type="button" class="link-button text-button" data-mais-rede>${icone('mais')}Adicionar rede</button></fieldset>`;
  const horario=`<fieldset class="panel-fieldset" id="horario" data-campo="horario"${dis}><legend>Horário da semana</legend><p class="fieldset-note">Marque os dias em que a empresa abre. Se fecha para o almoço, use “Outro horário no dia”. Até meia-noite: feche às 00:00.</p>${pode?`<button type="button" class="link-button text-button" data-copiar-segunda>${icone('copiar')}Repetir o horário de segunda de terça a sexta</button>`:''}<div class="hours-week">${semana(x.horario)}</div></fieldset>`;
  const textos=`<fieldset class="panel-fieldset" id="textos"${dis}><legend>Textos do perfil</legend><div class="form-grid">${campo('resumo','Resumo',textarea(x.resumo,300,2),{full:true,dica:'Até 300 caracteres. Os cards da busca mostram os primeiros 160.'})}${campo('descricao','Sobre a empresa',textarea(x.descricao,6000,7),{full:true,dica:'Separe os parágrafos com uma linha em branco.'})}</div></fieldset>`;
  const plano=x.planoGerido?planoDaGestao(vm,x):campo('plano','Plano',escolha((o.planos||[]).map(p=>[p.id,p.nome]),x.plano,'Sem plano'),{dica:'O plano decide a ordem na busca e o selo, como está na aba Planos.'});
  const guia=`<fieldset class="panel-fieldset" id="no-guia"${dis}><legend>No guia</legend><div class="form-grid">${plano}${campo('rede','Rede',a=>`<select ${a} data-rede-select><option value="">Não faz parte de uma rede</option>${opcoes((o.redes||[]).map(r=>[r.id,r.nome]),x.rede??'')}${pode?'<option value="__nova__">Outra rede…</option>':''}</select><p class="field-hint" data-rede-aviso aria-live="polite" hidden></p>`)}${pode?`<div class="full network-new" data-rede-nova hidden>${campo('redeNova','Nome da rede nova',texto('',80,' autocomplete="off" placeholder="Ex.: Super Kibarato"'),{id:'rede-nova-nome',dica:'As unidades da mesma marca ficam juntas no guia.'})}<div class="panel-actions"><button type="button" class="button secondary" data-criar-rede>Criar a rede</button></div><div class="similar-names" data-parecidas tabindex="-1" hidden></div></div>`:''}<div class="form-field full"><label class="toggle"><input type="checkbox" name="destaque"${x.destaque?' checked':''}><span>Destaque: aparece primeiro na página inicial e nas coleções</span></label></div>${campoImagem('imagem','Imagem do card',x.imagem,{dica:'A foto que aparece no card da busca e no topo do perfil.',dis})}</div></fieldset>`;
  const modelos=`<template data-modelo-intervalo>${intervalo(1)}</template><template data-modelo-rede>${rede({},0)}</template>`;
  // Empresa nova: o padrão é o rascunho, para a empresa não entrar no guia sem querer (teste do convite de 28/10/2026).
  const acoes=pode?botoesPublicar(x,novo,novo?{publicar:'Salvar e publicar',rascunho:true,nota:'Como rascunho, a empresa fica fora do guia até alguém publicar. “Salvar e publicar” já põe a empresa no guia.'}:{publicar:'Salvar e publicar no guia'}):'';
  return `${pode?'':soLeitura(vm,'o cadastro')}${formulario('empresa',x,novo,`${ident}${categorias}${contatos}${horario}${textos}${guia}${modelos}`,acoes)}`;
}

// Conteúdo: artigos, classificados, eventos, ofertas e coleções (as notícias saíram do site em 2026-10-15) ---------

// O tipo vai sempre na URL: a aba padrão é Artigos, qualquer que seja o padrão do servidor.
const tipoDe=vm=>TIPOS.some(([t])=>t===vm.filtros?.tipo)?vm.filtros.tipo:'evento';
const comTipo=t=>({tipo:t});
// Pessoas do Sobre nós (v0.17.0, contrato 18.7): foto da biblioteca (id), nome, função e ordem (a menor primeiro). Quem não tem
// foto fica guardado, mas não aparece no site. A permissão é a do conteúdo (admin e edição).
const fotoPessoa=id=>id?`/midia/${encodeURIComponent(id)}/800.webp`:'';
function pessoasLista(vm) {
  const d=vm.dados||{},itens=[...(d.itens||[])].sort((a,b)=>(a.ordem??0)-(b.ordem??0)||String(a.nome).localeCompare(b.nome,'pt-BR'));
  if(!itens.length)return vazio('Ninguém cadastrado ainda. Enquanto não houver pessoa com foto, o Sobre nós fica como está.');
  const linha=x=>`<tr><td class="person-thumb">${x.foto?`<img src="${e(fotoPessoa(x.foto))}" alt="" width="48" height="48" loading="lazy" decoding="async">`:'<span aria-hidden="true">—</span>'}</td><th scope="row"><a href="${e(ficha('pessoas',x.id))}">${e(x.nome)}</a></th><td data-rotulo="Função">${e(x.funcao||'')}</td><td data-rotulo="Ordem" class="num">${numero(x.ordem??0)}</td><td data-rotulo="No site">${x.foto?'<span class="state-tag is-publicado">Aparece</span>':'<span class="state-tag is-pausado">Sem foto: não aparece</span>'}</td></tr>`;
  return `${contagem({total:itens.length},'pessoa','pessoas')}<div class="table-wrap"><table class="panel-table"><thead><tr><th scope="col"><span class="sr-only">Foto</span></th><th scope="col">Nome</th><th scope="col">Função</th><th scope="col">Ordem</th><th scope="col">No site</th></tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div>`;
}
function pessoaRegistro(vm) {
  const x=vm.dados||{},novo=vm.dados===null,pode=vm.pode?.conteudo,dis=pode?'':' disabled';
  const corpo=`<fieldset class="panel-fieldset"${dis}><legend>Pessoa</legend><div class="form-grid">${campoImagem('foto','Foto',fotoPessoa(x.foto),{dica:'Da biblioteca de mídia. Sem foto, a pessoa não aparece no Sobre nós.',dis})}${campo('nome','Nome',texto(x.nome,80,' required'))}${campo('funcao','Função',texto(x.funcao,80,' placeholder="Ex.: Atendimento às empresas"'))}${campo('ordem','Ordem',a=>`<input type="number" ${a} value="${e(x.ordem??0)}" min="0" max="999" step="1" inputmode="numeric">`,{dica:'A menor aparece primeiro.'})}</div></fieldset>`;
  const acoes=pode?`<button type="submit" class="button">${novo?'Salvar pessoa':'Salvar alterações'}</button>${novo?'':'<button type="button" class="button secondary danger" data-acao-registro="excluir">Excluir pessoa</button>'}<p class="form-note">Vale no Sobre nós assim que você salva.</p>`:'';
  return `${pode?'':soLeitura(vm,'as pessoas')}${formulario('pessoa',x,novo,corpo,acoes)}`;
}

function conteudoLista(vm) {
  const t=tipoDe(vm),d=vm.dados||{},itens=d.itens||[],o=vm.opcoes||{},nome=TIPOS.find(([v])=>v===t)[1].toLowerCase();
  const tabs=abas('Tipo de conteúdo',TIPOS.map(([v,l])=>[v,l]),t,v=>rota('conteudo',comTipo(v)));
  const campos=[{nome:'status',rotulo:'Situação',lista:[['rascunho','Rascunho'],['publicado','Publicado'],['pausado','Fora do ar']]}];
  if(t==='artigo')campos.push({nome:'editoria',rotulo:'Editoria',lista:(o.editorias||[]).map(x=>[x.slug,x.label]),todos:'Todas'});
  const filtro=filtros(vm,campos,{busca:t==='oferta'?'Buscar pelo nome':'Buscar pelo título',fixos:comTipo(t)});
  const link=(x,rotulo)=>`<a href="${e(ficha('conteudo',x.id,comTipo(t)))}">${e(rotulo||'Sem título')}</a>`;
  const status=x=>`<td data-rotulo="Situação">${situacao(x.status)}</td>`;
  const formas={
    evento:[[['Evento'],['Quando'],['Local'],['Situação']],x=>`<tr><th scope="row">${link(x,x.titulo)}</th><td data-rotulo="Quando">${quando(x.inicio)}</td><td data-rotulo="Local">${e(x.local||'—')}</td>${status(x)}</tr>`],
    oferta:[[['Oferta'],['Empresa'],['Preço'],['Válida até'],['Situação']],x=>`<tr><th scope="row">${link(x,x.nome)}</th><td data-rotulo="Empresa">${e(nomeEmpresa(vm,x.empresa))}</td><td data-rotulo="Preço">${x.precoModo==='consulta'||x.precoCentavos==null?'Sob consulta':`${x.precoModo==='a-partir'?'A partir de ':''}R$ ${reais(x.precoCentavos)}`}</td><td data-rotulo="Válida até">${data(x.validade)}</td>${status(x)}</tr>`],
    colecao:[[['Coleção'],['Grupos'],['Posição','num'],['Situação']],x=>`<tr><th scope="row">${link(x,x.titulo)}</th><td data-rotulo="Grupos">${e((x.grupos||[]).map(g=>(o.categorias||[]).find(c=>c.slug===g)?.label||g).join(', '))}</td><td class="num" data-rotulo="Posição">${numero(x.posicao)}</td>${status(x)}</tr>`]
  };
  const [cab,linha]=formas[t]||[[['Título'],['Editorias'],['Data'],['Situação']],x=>`<tr><th scope="row">${link(x,x.titulo)}</th><td data-rotulo="Editorias">${e((x.editorias||[]).join(', ')||'—')}</td><td data-rotulo="Data">${data(x.data)}</td>${status(x)}</tr>`];
  const lista=itens.length?tabela(cab,itens.map(linha).join('')):semResultado(vm,`Nenhum item em ${nome} com esses filtros.`,`Nada em ${nome} ainda.`);
  return `${tabs}${filtro}${vm.pode?.conteudo?'':soLeitura(vm,'o conteúdo')}${contagem(d,'item','itens')}${lista}${paginacao(vm)}`;
}

function conteudoRegistro(vm) {
  const t=tipoDe(vm),x=vm.dados||{},novo=vm.dados===null,pode=vm.pode?.conteudo,o=vm.opcoes||{},dis=pode?'':' disabled',d=dis;
  const leitura=pode?'':soLeitura(vm,'o conteúdo');
  const empresas=(o.empresas||[]).map(x=>[x.id,x.nome]);
  const publicar=nota=>pode?botoesPublicar(x,novo,{nota}):'';
  if(t==='evento'){
    const corpo=`<fieldset class="panel-fieldset"${dis}><legend>Evento</legend><div class="form-grid">${campo('titulo','Nome do evento',texto(x.titulo,200,' required'),{full:true})}${campo('inicio','Começa',a=>`<input type="datetime-local" ${a} value="${e(x.inicio||'')}" required>`)}${campo('fim','Termina',a=>`<input type="datetime-local" ${a} value="${e(x.fim||'')}">`,{dica:'Opcional. Horário de Brasília.'})}${campo('local','Local',texto(x.local,160,' placeholder="Praça Rui Barbosa"'))}${campo('endereco','Endereço',texto(x.endereco,200))}${campo('link','Link do evento',texto(x.link,300,' inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://"'),{dica:'Ingressos ou a página do organizador. Abre em outra aba.'})}${campo('empresa','Empresa do guia',escolha(empresas,x.empresa,'Nenhuma'))}</div></fieldset><fieldset class="panel-fieldset"${dis}><legend>Descrição e imagem</legend><div class="form-grid">${editor('descricao','Descrição',x.descricao,{dis:!pode})}${campoImagem('imagem','Imagem',x.imagem,{dis:d})}</div></fieldset>`;
    return leitura+formulario('evento',x,novo,corpo,publicar('O evento sai da lista quando termina.'));
  }
  if(t==='oferta'){
    const corpo=`<fieldset class="panel-fieldset"${dis}><legend>Oferta</legend><div class="form-grid">${novo?campo('empresa','Empresa',a=>`<select ${a} required><option value="">Escolha a empresa</option>${opcoes(empresas,'')}</select>`,{full:true}):`<div class="form-field full"><span class="field-label">Empresa</span><p class="field-static"><a href="${e(ficha('empresas',x.empresa))}">${e(nomeEmpresa(vm,x.empresa))}</a></p></div>`}${campo('nome','Nome da oferta',texto(x.nome,120,' required'),{full:true})}${campo('descricao','Descrição',textarea(x.descricao,600),{full:true})}${campo('precoModo','Preço',escolha(PRECO,x.precoModo||'fixo'),{})}${campo('precoCentavos','Valor (R$)',texto(x.precoCentavos==null?'':reais(x.precoCentavos),12,' inputmode="decimal" placeholder="0,00"'),{extra:`preco-valor${x.precoModo==='consulta'?' is-hidden':''}`})}${campo('condicoes','Condições',textarea(x.condicoes,300,2,' required'),{full:true,dica:'Quando vale, para quem e os limites.'})}${campo('validade','Válida até',a=>`<input type="date" ${a} value="${e(x.validade||'')}" required>`)}${campoImagem('imagem','Imagem',x.imagem,{dis:d})}</div></fieldset>`;
    return leitura+formulario('oferta',x,novo,corpo,publicar('A oferta criada pela equipe não passa pela fila de aprovação.'));
  }
  if(t==='colecao'){
    const marcados=new Set(x.grupos||[]);
    const corpo=`<fieldset class="panel-fieldset"${dis}><legend>Coleção da página inicial</legend><div class="form-grid">${campo('titulo','Título',texto(x.titulo,120,' required placeholder="Vai reunir a família?"'),{full:true})}${campo('subtitulo','Subtítulo',texto(x.subtitulo,200),{full:true})}${campo('posicao','Posição',a=>`<input type="number" ${a} value="${e(x.posicao??0)}" min="0" max="100" step="1">`,{dica:'De 0 a 100. A de número menor aparece primeiro.'})}${campo('status','Situação',escolha([['rascunho','Rascunho'],['publicado','Publicada'],['pausado','Fora do ar']],x.status||'rascunho'))}</div></fieldset><fieldset class="panel-fieldset" data-campo="grupos"${dis}><legend>Grupos de categoria</legend><p class="fieldset-note">A coleção mostra empresas destes grupos, destaques primeiro.</p>${caixas('grupos',(o.categorias||[]).map(g=>[g.slug,g.label]),marcados)}</fieldset>`;
    return leitura+formulario('colecao',x,novo,corpo,pode?'<button type="submit" class="button">Salvar coleção</button>':'');
  }
  const marcadas=new Set(x.editorias||[]),lista=[...(o.editorias||[]).map(ed=>[ed.label,ed.label]),...[...marcadas].filter(l=>!(o.editorias||[]).some(ed=>ed.label===l)).map(l=>[l,l])];
  const rotuloTexto={artigo:'Texto do artigo',classificado:'Texto do classificado'}[t];
  const textoPrincipal=`<fieldset class="panel-fieldset"${dis}><legend>Texto</legend><div class="form-grid">${campo('titulo','Título',texto(x.titulo,200,' required'),{full:true})}${campo('resumo','Resumo',textarea(x.resumo,300,2),{full:true,dica:'Aparece no card da lista e quando o link é compartilhado.'})}${editor('html',rotuloTexto,x.html,{dica:'Use “Título” para dividir o texto em partes. Imagens vêm da biblioteca, com descrição.',dis:!pode})}</div></fieldset>`;
  const classificado=t==='classificado'?`<fieldset class="panel-fieldset"${dis}><legend>Classificado</legend><div class="form-grid">${campo('preco','Preço',texto(x.classificado?.preco,40,' placeholder="R$ 150,00 ou A combinar"'))}${campo('telefone','Telefone',a=>`<input type="tel" ${a} value="${e(x.classificado?.telefone||'')}" inputmode="tel" maxlength="40">`)}${campo('empresa','Empresa do guia',escolha(empresas,x.classificado?.empresa,'Nenhuma'))}</div></fieldset>`:'';
  const galeria=`<div class="form-field full gallery-field" data-galeria data-campo="galeria"><span class="field-label" id="rotulo-galeria">Galeria</span><ul class="gallery-list" data-galeria-lista>${(x.galeria||[]).map(u=>`<li><img src="${e(u)}" alt="" loading="lazy" decoding="async"><input type="hidden" data-galeria-url value="${e(u)}">${pode?'<button type="button" class="icon-button small" data-tirar-galeria aria-label="Tirar esta foto da galeria">'+icone('fechar')+'</button>':''}</li>`).join('')}</ul>${pode?`<button type="button" class="button secondary" data-galeria-mais aria-describedby="rotulo-galeria">${icone('mais')}Adicionar foto à galeria</button>`:''}<p class="field-hint">Até 12 fotos, mostradas no fim do texto.</p></div>`;
  const publicacao=`<fieldset class="panel-fieldset"${dis}><legend>Publicação</legend><div class="form-grid">${campoImagem('imagem','Imagem de capa',x.imagem,{dica:'Aparece no card da lista, no topo do texto e no compartilhamento.',dis:d})}${campo('autor','Autor',texto(x.autor,80,' placeholder="Equipe Nexus"'),{dica:'Em branco: Equipe Nexus.'})}${campo('data','Data',a=>`<input type="date" ${a} value="${e(String(x.data||'').slice(0,10))}">`,{dica:'Em branco: a data em que você publicar.'})}${t==='classificado'?'':`<div class="form-field full" data-campo="editorias"><span class="field-label">Editorias</span>${caixas('editorias',lista,marcadas)}</div><div class="form-field full"><label class="toggle"><input type="checkbox" name="destaque"${x.destaque?' checked':''}><span>Destaque em /artigos: aparece grande no topo da lista</span></label><p class="field-hint">Só um artigo fica em destaque: marcar este tira o anterior. Sem nenhum marcado, vai o mais recente com foto.</p></div>`}${campo('fonte','Fonte',texto(x.fonte,300,' placeholder="Link ou nome da fonte original"'),{full:true})}${galeria}</div></fieldset>`;
  return leitura+formulario('conteudo',x,novo,`${textoPrincipal}${classificado}${publicacao}`,publicar(''),` data-tipo="${t}"`);
}

// Banners: lista, registro com a prévia no formato real e a ocupação dos espaços ----------------------------------------

function previaBanner(vm,x) {
  const esp=espacoDe(vm,x.espaco),pc=esp?.formatos?.computador||[],cel=esp?.formatos?.celular||[];
  const f=FORMATOS[x.formato]?x.formato:pc[0]||'super-banner',m=x.imagemCelular&&cel[0]?cel[0]:cel.includes(f)?f:'';
  const peca=(fmt,img,qual)=>{const [w,h]=FORMATOS[fmt];return `<div class="vitrine-piece is-${CLASSE_FORMATO[fmt]}" data-previa-peca="${qual}"><span class="vitrine-tag"><span>Publicidade<span class="vitrine-by"> · <span data-previa-anunciante>${e(x.anunciante||'Anunciante')}</span></span></span></span><span class="vitrine-frame">${img?`<img src="${e(img)}" alt="" width="${w}" height="${h}">`:'<span class="vitrine-empty">Sem imagem</span>'}</span></div>`;};
  const medida=fmt=>`${FORMATOS[fmt][0]} × ${FORMATOS[fmt][1]} px`;
  return `<section class="peca-previa" aria-labelledby="previa-titulo" data-previa><h2 id="previa-titulo">Prévia no tamanho real</h2><div class="preview-slot"><p class="preview-label">Computador <small data-previa-medida="computador">${medida(f)}</small></p><div class="preview-stage">${peca(f,x.imagem,'computador')}</div></div><div class="preview-slot is-phone"><p class="preview-label">Celular <small data-previa-medida="celular">${m?medida(m):'não aparece'}</small></p><div class="preview-stage">${m?peca(m,x.imagemCelular||x.imagem,'celular'):'<p class="muted" data-previa-sem-celular>Este espaço não aparece no celular com este formato.</p>'}</div></div></section>`;
}
function bannersLista(vm) {
  const f=vm.filtros||{};
  if(f.aba==='ocupacao')return abas('Banners',[['banners','Banners'],['ocupacao','Ocupação dos espaços']],'ocupacao',v=>rota('banners',v==='banners'?{}:{aba:v}))+ocupacao(vm);
  const d=vm.dados||{},itens=d.itens||[];
  const tabs=abas('Banners',[['banners','Banners'],['ocupacao','Ocupação dos espaços']],'banners',v=>rota('banners',v==='banners'?{}:{aba:v}));
  const filtro=filtros(vm,[{nome:'status',rotulo:'Situação',lista:[['rascunho','Rascunho'],['publicado','Publicado'],['pausado','Fora do ar']]},{nome:'espaco',rotulo:'Espaço',lista:(vm.opcoes?.espacos||[]).map(s=>[s.id,`${PAGINA_ESPACO[s.pagina]||s.pagina}: ${s.onde}`])}],{busca:'Título ou anunciante'});
  const linha=b=>`<tr><th scope="row"><a href="${e(ficha('banners',b.id))}">${e(b.titulo)}</a></th><td data-rotulo="Anunciante">${e(b.anunciante||'—')}</td><td data-rotulo="Espaço">${nomeEspaco(vm,b.espaco)}</td><td data-rotulo="Período">${data(b.inicio)} a ${data(b.fim)}</td><td data-rotulo="Situação">${situacaoBanner(b)}</td></tr>`;
  const lista=itens.length?tabela([['Banner'],['Anunciante'],['Espaço'],['Período'],['Situação']],itens.map(linha).join('')):semResultado(vm,'Nenhum banner com esses filtros.','Nenhum banner ainda. Use “Novo banner” para agendar o primeiro.');
  return `${tabs}${filtro}${vm.pode?.banners?'':soLeitura(vm,'os banners')}${contagem(d,'banner','banners')}${lista}${paginacao(vm)}`;
}
function bannerRegistro(vm) {
  const x=vm.dados||{},novo=vm.dados===null,pode=vm.pode?.banners,o=vm.opcoes||{},dis=pode?'':' disabled',d=dis;
  const esp=espacoDe(vm,x.espaco),formatos=(esp?.formatos?.computador||Object.keys(FORMATOS));
  const grupos=Object.entries((o.espacos||[]).reduce((g,s)=>{(g[s.pagina]||=[]).push(s);return g;},{}));
  const espacos=a=>`<select ${a} required data-espaco><option value="">Escolha o espaço</option>${grupos.map(([p,lista])=>`<optgroup label="${e(PAGINA_ESPACO[p]||p)}">${lista.map(s=>`<option value="${e(s.id)}" data-computador="${e((s.formatos?.computador||[]).join(' '))}" data-celular="${e((s.formatos?.celular||[]).join(' '))}"${s.id===x.espaco?' selected':''}>${e(PAGINA_ESPACO[p]||p)}: ${e(s.onde)}${s.giram>1?` (${s.giram} banners giram)`:''}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const nomes={'link-patrocinado':'Link patrocinado','quadrado':'Quadrado','super-banner':'Super banner','ar-livre':'Ar livre','meia-pagina':'Meia página','exibir-lateral':'Lateral'};
  const formato=a=>`<select ${a} required data-formato>${Object.keys(FORMATOS).map(f=>`<option value="${f}"${f===(x.formato||formatos[0])?' selected':''}${formatos.includes(f)?'':' hidden disabled'}>${nomes[f]} · ${FORMATOS[f][0]} × ${FORMATOS[f][1]}</option>`).join('')}</select>`;
  const corpo=`<div class="peca-layout"><div class="peca-campos"><fieldset class="panel-fieldset"${dis}><legend>Banner</legend><div class="form-grid">${campo('titulo','Nome do banner',texto(x.titulo,120,' required placeholder="Padaria Exemplo: café da manhã"'),{full:true,dica:'Só a equipe vê. A imagem vai com este nome como descrição.'})}${campo('anunciante','Anunciante',texto(x.anunciante,80,' required data-anunciante'),{dica:'Aparece em “Publicidade · anunciante”.'})}${campo('empresa','Empresa do guia',escolha((o.empresas||[]).map(y=>[y.id,y.nome]),x.empresa,'Nenhuma'))}${campo('destino','Leva para',texto(x.destino,300,' required inputmode="url" autocapitalize="off" spellcheck="false" placeholder="/comercio/padaria-exemplo ou https://"'),{full:true,dica:'Com a empresa escolhida, já vem o perfil dela no guia. Troque por outra página do guia ou por um site (abre em outra aba).'})}</div></fieldset><fieldset class="panel-fieldset"${dis}><legend>Onde e quando</legend><div class="form-grid">${campo('espaco','Espaço',espacos,{full:true})}${campo('formato','Formato no computador',formato)}${campo('inicio','Primeiro dia no ar',a=>`<input type="date" ${a} value="${e(x.inicio||'')}" required>`)}${campo('fim','Último dia no ar',a=>`<input type="date" ${a} value="${e(x.fim||'')}" required>`)}<details class="more-options full"${Number(x.peso??1)!==1?' open':''}><summary>Mais opções</summary>${campo('peso','Peso no rodízio',a=>`<input type="number" ${a} value="${e(x.peso??1)}" min="1" max="10" step="1">`,{dica:'Com peso 2, aparece duas vezes mais que um banner de peso 1 no mesmo espaço. Na dúvida, deixe 1.'})}</details></div><p class="fieldset-note" data-ocupacao-aviso hidden></p></fieldset><fieldset class="panel-fieldset"${dis}><legend>Imagens</legend><div class="form-grid">${campoImagem('imagem','Imagem para computador',x.imagem,{dica:'No tamanho do formato ou no dobro, para telas nítidas.',dis:d,banner:true})}${campoImagem('imagemCelular','Imagem para celular',x.imagemCelular,{dica:'Opcional. No formato do celular do espaço; sem ela, vale a do computador quando o formato serve no celular.',dis:d,banner:true})}</div></fieldset></div>${previaBanner(vm,x)}</div>`;
  const acoes=pode?botoesPublicar(x,novo,{nota:'Para publicar: espaço, datas, destino e uma imagem da biblioteca. O banner entra no ar no primeiro dia e sai depois do último.'}):'';
  return `${pode?'':soLeitura(vm,'os banners')}${formulario('banner',x,novo,corpo,acoes)}`;
}

// Ocupação: um espaço por linha e um dia por coluna. Dia com todas as vagas vendidas, com parte vendida, livre com o
// anúncio do Nexus (espaço casa) ou livre sem nada.
const somaDias=(dia,n)=>{const d=new Date(`${dia}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
function ocupacao(vm) {
  const f=vm.filtros||{},esp=vm.dados?.espacos||[],dias=(esp[0]?.dias||[]).map(d=>d.dia),pode=vm.pode?.banners;
  const de=f.de||dias[0]||'',ate=f.ate||dias.at(-1)||'',n=dias.length||30;
  const periodo=`<form class="admin-filters is-compact" method="get" action="/admin/banners" aria-label="Período da ocupação"><input type="hidden" name="aba" value="ocupacao"><div class="form-field"><label for="ocup-de">De</label><input type="date" id="ocup-de" name="de" value="${e(de)}"></div><div class="form-field"><label for="ocup-ate">Até</label><input type="date" id="ocup-ate" name="ate" value="${e(ate)}"></div><div class="filter-actions"><button type="submit" class="button secondary">Ver período</button>${de?`<a class="link-button text-button" href="${e(rota('banners',{aba:'ocupacao',de:somaDias(de,-n),ate:somaDias(de,-1)}))}"><span aria-hidden="true">←</span> ${n} dias antes</a><a class="link-button text-button" href="${e(rota('banners',{aba:'ocupacao',de:somaDias(ate,1),ate:somaDias(ate,n)}))}">${n} dias depois <span aria-hidden="true">→</span></a>`:''}</div></form>`;
  const legenda=`<ul class="occupancy-legend" aria-label="Legenda"><li><span class="occ is-vendido" aria-hidden="true"></span>Vendido</li><li><span class="occ is-parcial" aria-hidden="true"></span>Com vaga no rodízio</li><li><span class="occ is-primig" aria-hidden="true"></span>Livre, com o anúncio do Nexus</li><li><span class="occ is-livre" aria-hidden="true"></span>Livre, sem anúncio</li></ul>`;
  if(!esp.length)return `${periodo}${vazio('Nenhum espaço de anúncio cadastrado.')}`;
  const cabeca=dias.map(dia=>{const w=new Date(`${dia}T12:00:00Z`).getUTCDay();return `<th scope="col" class="occ-day${w===0||w===6?' is-weekend':''}"><span>${dia.slice(8)}</span><small>${SEMANA[w]}</small><span class="sr-only"> ${data(dia)}</span></th>`;}).join('');
  const linha=s=>{
    // "Agendar aqui" já leva o primeiro dia com vaga do período.
    let vendidos=0;const livre=(s.dias||[]).find(d=>(d.livres??1)>0)?.dia;
    const celulas=(s.dias||[]).map(d=>{
      const pagos=d.banners||[],estado=!pagos.length?(s.casa?'primig':'livre'):d.livres>0?'parcial':'vendido';if(pagos.length)vendidos++;
      const texto={vendido:'vendido',parcial:`${pagos.length} de ${s.giram} vendidos`,primig:'livre, com o anúncio do Nexus',livre:'livre'}[estado];
      return `<td class="occ is-${estado}"${pagos.length?` title="${e(pagos.map(b=>b.anunciante||b.titulo).join(', '))}"`:''}>${estado==='parcial'?`<span aria-hidden="true">${pagos.length}/${s.giram}</span>`:''}<span class="sr-only">${data(d.dia)}: ${texto}${pagos.length?` (${e(pagos.map(b=>b.anunciante||b.titulo).join(', '))})`:''}</span></td>`;
    }).join('');
    return `<tr><th scope="row"><span class="occ-space">${PAGINA_ESPACO[s.pagina]||e(s.pagina)}</span><span class="occ-where">${e(s.onde||s.id)}</span><small>${s.giram>1?`${s.giram} giram · `:''}vendido em ${vendidos} de ${(s.dias||[]).length} dias</small>${pode?`<a class="link-button text-button" href="${e(`/admin/banners/novo?${new URLSearchParams({espaco:s.id,...(livre?{inicio:livre}:{})})}`)}">Agendar aqui<span class="sr-only">: ${e(s.onde||s.id)}</span></a>`:''}</th>${celulas}</tr>`;
  };
  return `${periodo}${legenda}<div class="table-wrap occupancy-wrap" tabindex="0" role="region" aria-label="Ocupação de ${data(de)} a ${data(ate)}"><table class="occupancy"><caption class="sr-only">Ocupação dos espaços de anúncio, de ${data(de)} a ${data(ate)}</caption><thead><tr><th scope="col" class="occ-corner">Espaço</th>${cabeca}</tr></thead><tbody>${esp.map(linha).join('')}</tbody></table></div>`;
}

// Cupons (v0.14.0, 14.7) ------------------------------------------------------------------------------------------------

// A lista de todas as empresas; suspender com o motivo (a empresa lê no painel) e reativar. Criar e editar ficam no painel da
// empresa, que o admin da equipe também abre.
const STATUS_CUPOM={ativo:['publicado','No ar'],agendado:['em-andamento','Agendado'],pausado:['pausado','Pausado'],esgotado:['pausado','Esgotado'],vencido:['pausado','Vencido'],suspenso:['vez','Suspenso'],removido:['pausado','Fora do site']};
function cuponsAdmin(vm) {
  const d=vm.dados||{},itens=d.itens||[],pode=vm.pode?.cupons;
  const filtro=filtros(vm,[{nome:'status',rotulo:'Situação',lista:Object.entries(STATUS_CUPOM).map(([k,[,l]])=>[k,l]),todos:'Todas'},{nome:'empresa',rotulo:'Empresa',lista:(vm.opcoes?.empresas||[]).map(x=>[x.id,x.nome]),todos:'Todas'}],{busca:'Título, código ou empresa'});
  const linha=c=>{
    const [cls,rot]=STATUS_CUPOM[c.status]||['pausado',e(c.status||'')],titulo=e(c.titulo);
    const suspender=`<details class="queue-refuse coupon-suspend"><summary class="button secondary">Suspender<span class="sr-only"> ${titulo}</span></summary><form class="panel-form" data-form="suspender" data-cupom="${e(c.id)}" data-version="${e(c.version)}" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${campo('motivo','Motivo',textarea('',300,2,' required'),{id:`motivo-${c.id}`,dica:'A empresa lê o motivo no painel. Ex.: “As condições não batem com as da loja.”'})}<div class="panel-actions"><button type="submit" class="button">Suspender o cupom</button></div></form></details>`;
    const acoes=!pode||c.status==='removido'?'':c.status==='suspenso'?`<button type="button" class="link-button text-button" data-reativar-cupom="${e(c.id)}" data-version="${e(c.version)}">Reativar<span class="sr-only"> ${titulo}</span></button>`:suspender;
    const painel=vm.equipe==='admin'&&c.empresa?.id?`<a class="link-button text-button" href="${e(`/painel/${encodeURIComponent(c.empresa.id)}/cupons`)}">Abrir no painel<span class="sr-only"> de ${e(c.empresa.nome)}</span></a>`:'';
    const nome=c.status==='removido'||!c.url?titulo:`<a href="${e(c.url)}" target="_blank" rel="noopener">${titulo}<span class="sr-only"> (abre em outra aba)</span></a>`;
    return `<tr><th scope="row"><span class="person"><strong>${nome}</strong><span>Código ${e(c.codigo||'')}</span>${c.suspensao?`<span>Motivo: ${e(c.suspensao.motivo)}</span>`:''}</span></th><td data-rotulo="Empresa">${c.empresa?.id?`<a href="${e(ficha('empresas',c.empresa.id))}">${e(c.empresa.nome)}</a>`:'—'}</td><td data-rotulo="Validade">${data(c.validade)}</td><td class="num" data-rotulo="Coletas">${numero(c.coletados)}${c.quantidade?` de ${numero(c.quantidade)}`:''}</td><td data-rotulo="Situação">${etiqueta(cls,rot)}</td><td data-rotulo="Ações"><div class="row-actions">${acoes}${painel}</div></td></tr>`;
  };
  const lista=itens.length?tabela([['Cupom'],['Empresa'],['Validade'],['Coletas','num'],['Situação'],['Ações']],itens.map(linha).join(''),'coupons-table'):semResultado(vm,'Nenhum cupom com esses filtros.','Nenhum cupom ainda. As empresas criam os cupons no painel.');
  return `${filtro}${pode?'':soLeitura(vm,'os cupons')}${contagem(d,'cupom','cupons')}${lista}${paginacao(vm)}`;
}

// Mídia -----------------------------------------------------------------------------------------------------------------

function midia(vm) {
  const d=vm.dados||{},itens=d.itens||[],pode=vm.pode?.midia;
  const envio=pode?`<section class="panel-section" id="enviar" aria-labelledby="midia-enviar"><h2 id="midia-enviar">Enviar uma imagem</h2>${envioMidia('midia')}</section>`:soLeitura(vm,'a biblioteca');
  const cartao=m=>`<li class="photo-card media-card" id="midia-${e(m.id)}"><img src="${e(m.tamanhos?.[320]||m.url)}" alt="" width="${Number(m.largura)||800}" height="${Number(m.altura)||600}" loading="lazy" decoding="async"><div class="photo-meta"><form class="media-alt" data-form="alt" data-midia="${e(m.id)}" data-version="${e(m.version)}" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${campo('alt','Descrição',textarea(m.alt,200,2,pode?' required':' disabled'),{id:`alt-${m.id}`})}${pode?'<button type="submit" class="button secondary" data-salvar-alt hidden>Salvar descrição</button>':''}</form><p class="media-info">${numero(m.largura)} × ${numero(m.altura)} px</p><div class="media-actions"><button type="button" class="link-button text-button" data-copiar-url="${e(m.url)}">Copiar endereço</button>${pode?`<button type="button" class="link-button text-button danger" data-excluir-midia="${e(m.id)}">Excluir<span class="sr-only"> a imagem ${e(m.alt||'')}</span></button>`:''}</div></div></li>`;
  const lista=itens.length?`<ul class="photo-grid media-grid">${itens.map(cartao).join('')}</ul>`:semResultado(vm,'Nenhuma imagem com essa descrição.','A biblioteca está vazia. Envie a primeira imagem acima.');
  return `${envio}<section class="panel-section" aria-labelledby="midia-lista"><h2 id="midia-lista">Biblioteca</h2>${filtros(vm,[],{busca:'Buscar pela descrição'})}${contagem(d,'imagem','imagens')}${lista}${paginacao(vm)}</section>`;
}

// Relatórios ------------------------------------------------------------------------------------------------------------

// Barras horizontais com o número ao lado (cada item numa linha, para ler sem o gráfico).
const barrasH=(itens,rotulo,valor,formato=numero)=>{const max=Math.max(1,...itens.map(valor));return `<ul class="channel-list report-bars">${itens.map(x=>`<li><span>${rotulo(x)}</span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="track" width="100" height="8"/><rect class="fill" width="${Math.round(valor(x)/max*100)}" height="8"/></svg><strong>${formato(valor(x))}</strong></li>`).join('')}</ul>`;};
function relatorios(vm) {
  const r=vm.dados||{},f=vm.filtros||{},o=vm.opcoes||{},periodo=['7d','30d','90d'].includes(f.periodo||r.periodo)?f.periodo||r.periodo:'30d',filtrado=Boolean(f.bairro||f.categoria);
  const chips=[['7d','7 dias'],['30d','30 dias'],['90d','90 dias']].map(([p,l])=>`<a class="filter-chip" href="${e(rota('relatorios',{periodo:p==='30d'?'':p,bairro:f.bairro,categoria:f.categoria}))}"${p===periodo?' aria-current="true"':''}>${l}</a>`).join('');
  const regiao=`<form class="admin-filters is-compact" method="get" action="/admin/relatorios" aria-label="Bairro e categoria">${periodo==='30d'?'':`<input type="hidden" name="periodo" value="${periodo}">`}<div class="form-field"><label for="rel-bairro">Bairro</label><select id="rel-bairro" name="bairro"><option value="">Todos os bairros</option>${opcoes((o.bairros||[]).map(b=>[b,b]),f.bairro||'')}</select></div><div class="form-field"><label for="rel-categoria">Categoria</label><select id="rel-categoria" name="categoria"><option value="">Todas as categorias</option>${opcoesCategoria(o.categorias||[],f.categoria||'')}</select></div><div class="filter-actions"><button type="submit" class="button secondary">Filtrar</button>${filtrado?`<a class="link-button text-button" href="${e(rota('relatorios',{periodo:periodo==='30d'?'':periodo}))}">Limpar filtros</a>`:''}</div></form>`;
  const buscas=r.buscasSemResultado||[],vistas=r.maisVistas||[],c=r.cliques||{},canais=[['whatsapp','WhatsApp'],['telefone','Telefone'],['rota','Como chegar'],['site','Site']];
  const secao=(id,titulo,html,nota='')=>`<section class="panel-section report-card" aria-labelledby="${id}"><h2 id="${id}">${titulo}</h2>${nota?`<p class="form-note">${nota}</p>`:''}${html}</section>`;
  const semBusca=filtrado?vazio('Os termos sem resultado não têm empresa: aparecem só sem o filtro de bairro e categoria.'):buscas.length?barrasH(buscas,x=>e(x.termo),x=>x.vezes):vazio('Nenhuma busca sem resultado no período.');
  const maisVistas=vistas.length?tabela([['Empresa'],['Visitas ao perfil','num'],['Aparições em buscas','num']],vistas.map(x=>`<tr><th scope="row"><a href="${e(ficha('empresas',x.empresa?.id||''))}">${e(x.empresa?.nome||'')}</a></th><td class="num" data-rotulo="Visitas">${numero(x.visitas)}</td><td class="num" data-rotulo="Buscas">${numero(x.buscas)}</td></tr>`).join('')):vazio('Nenhuma visita registrada no período.');
  const totalCliques=canais.reduce((s,[k])=>s+(c[k]||0),0);
  const cliques=totalCliques?barrasH(canais,([,l])=>l,([k])=>c[k]||0):vazio('Nenhum clique para contato no período.');
  const espacos=(r.espacos||[]).length?tabela([['Espaço'],['Impressões','num'],['Cliques','num'],['Taxa de cliques','num']],r.espacos.map(s=>`<tr><th scope="row">${nomeEspaco(vm,s.id)}</th><td class="num" data-rotulo="Impressões">${numero(s.impressoes)}</td><td class="num" data-rotulo="Cliques">${numero(s.cliques)}</td><td class="num" data-rotulo="Taxa">${porcento(s.ctr)}</td></tr>`).join('')):vazio('Nenhuma impressão de banner no período.');
  const banners=(r.banners||[]).length?`<h3>Por banner</h3>${tabela([['Banner'],['Espaço'],['Impressões','num'],['Cliques','num'],['Taxa de cliques','num']],r.banners.map(b=>`<tr><th scope="row"><a href="${e(ficha('banners',b.id))}">${e(b.titulo)}</a></th><td data-rotulo="Espaço">${nomeEspaco(vm,b.espaco)}</td><td class="num" data-rotulo="Impressões">${numero(b.impressoes)}</td><td class="num" data-rotulo="Cliques">${numero(b.cliques)}</td><td class="num" data-rotulo="Taxa">${porcento(b.ctr)}</td></tr>`).join(''))}`:'';
  return `<div class="results-head"><nav class="quick-filters" aria-label="Período">${chips}</nav><p class="muted">De ${data(r.de)} a ${data(r.ate)}</p></div>${regiao}<div class="report-grid">${secao('rel-buscas','Buscas sem resultado',semBusca,'O que os moradores procuraram e o guia não tinha: pistas de quem convidar.')}${secao('rel-vistas','Empresas mais vistas',maisVistas)}${secao('rel-cliques','Cliques por tipo',cliques)}${secao('rel-banners','Banners por espaço',espacos+banners)}</div>`;
}

// Auditoria -------------------------------------------------------------------------------------------------------------

const acaoTexto=a=>{const t=String(a||'').replace(/[_.:-]+/g,' ').trim();return e(t?t[0].toUpperCase()+t.slice(1):'');};
const valorCurto=v=>{const t=v==null?'—':typeof v==='string'?v:JSON.stringify(v);return e(t.length>160?`${t.slice(0,157)}…`:t);};
function auditoria(vm) {
  const d=vm.dados||{},itens=d.itens||[];
  const filtro=filtros(vm,[{nome:'acao',rotulo:'Ação',tipo:'text'},{nome:'empresa',rotulo:'Empresa',lista:(vm.opcoes?.empresas||[]).map(x=>[x.id,x.nome]),todos:'Todas'},{nome:'de',rotulo:'De',tipo:'date'},{nome:'ate',rotulo:'Até',tipo:'date'}],{busca:''});
  const mudanca=x=>{
    const antes=x.antes&&typeof x.antes==='object'?x.antes:{},depois=x.depois&&typeof x.depois==='object'?x.depois:{},chaves=[...new Set([...Object.keys(antes),...Object.keys(depois)])];
    if(!chaves.length)return '<span class="muted">—</span>';
    return `<details class="audit-change"><summary>${plural(chaves.length,'campo','campos')}</summary><dl>${chaves.map(k=>`<div><dt>${e(k)}</dt><dd><span class="audit-before">${valorCurto(antes[k])}</span> <span aria-hidden="true">→</span><span class="sr-only"> passou a </span> <span class="audit-after">${valorCurto(depois[k])}</span></dd></div>`).join('')}</dl>${x.ip?`<p class="muted">IP ${e(x.ip)}</p>`:''}</details>`;
  };
  const linha=x=>`<tr><td data-rotulo="Quando">${dataHora(x.em)}</td><th scope="row">${acaoTexto(x.acao)}</th><td data-rotulo="Empresa">${x.empresa?`<a href="${e(ficha('empresas',x.empresa))}">${e(nomeEmpresa(vm,x.empresa))}</a>`:'—'}</td><td data-rotulo="Quem">${x.por?e(x.por.email||''):'Sistema'}</td><td data-rotulo="O que mudou">${mudanca(x)}</td></tr>`;
  const lista=itens.length?tabela([['Quando'],['Ação'],['Empresa'],['Quem'],['O que mudou']],itens.map(linha).join(''),'audit-table'):semResultado(vm,'Nenhum registro com esses filtros.','Nenhum registro ainda.');
  return `${filtro}${contagem(d,'registro','registros')}${lista}${paginacao(vm)}`;
}

// Usuários --------------------------------------------------------------------------------------------------------------

function usuarios(vm) {
  const f=vm.filtros||{},d=vm.dados||{},itens=d.itens||[],pode=vm.pode||{},eu=vm.usuario?.id,o=vm.opcoes||{};
  const tabs=abas('Tipo de conta',[['','Todas'],['equipe','Equipe'],['associado','Associados']],f.tipo||'',v=>rota('usuarios',{tipo:v}));
  const filtro=filtros(vm,[],{busca:'Nome ou e-mail',fixos:{tipo:f.tipo}});
  const linha=u=>{
    const proprio=u.id===eu,nome=e(u.nome||u.email);
    const papel=u.tipo==='equipe'?(pode.equipe&&!proprio?`<form class="role-form" data-form="papel-equipe" data-usuario="${e(u.id)}" data-version="${e(u.version)}" novalidate><label><span class="sr-only">Papel de ${nome} na equipe</span><select name="equipe" data-papel-atual="${e(u.equipe)}">${opcoes(Object.entries(EQUIPE),u.equipe)}</select></label><button type="submit" class="button secondary" data-salvar-papel hidden>Salvar papel<span class="sr-only"> de ${nome}</span></button></form>`:`Equipe · ${EQUIPE[u.equipe]||e(u.equipe||'')}`)
      :(u.acessos||[]).length?`<ul class="access-list">${u.acessos.map(a=>`<li><span><a href="${e(ficha('empresas',a.empresa.id))}">${e(a.empresa.nome)}</a> · ${PAPEIS[a.papel]||e(a.papel)}${a.ativo===false?' (inativo)':''}</span>${pode.acessos?`<button type="button" class="link-button text-button danger" data-revogar="${e(u.id)}" data-empresa="${e(a.empresa.id)}">Tirar acesso<span class="sr-only"> de ${nome} a ${e(a.empresa.nome)}</span></button>`:''}</li>`).join('')}</ul>`:'<span class="muted">Sem empresa</span>';
    const acoes=[pode.acessos&&!u.desativado&&`<button type="button" class="link-button text-button" data-link-senha="${e(u.id)}" data-email="${e(u.email)}">Gerar link de senha<span class="sr-only"> para ${nome}</span></button>`,
      (pode.acessos||pode.equipe)&&!proprio&&!u.desativado&&`<button type="button" class="link-button text-button" data-encerrar="${e(u.id)}">Encerrar sessões<span class="sr-only"> de ${nome}</span></button>`,
      pode.equipe&&!proprio&&`<button type="button" class="link-button text-button danger" data-desativar="${e(u.id)}" data-version="${e(u.version)}" data-valor="${u.desativado?'false':'true'}">${u.desativado?'Reativar':'Desativar'}<span class="sr-only"> a conta de ${nome}</span></button>`].filter(Boolean).join('');
    return `<tr><th scope="row"><span class="person"><strong>${nome}${proprio?' <small>(você)</small>':''}</strong>${u.nome?`<span>${e(u.email)}</span>`:''}</span></th><td data-rotulo="Acesso">${papel}</td><td data-rotulo="Situação">${u.desativado?etiqueta('pausado','Desativada'):etiqueta('publicado','Ativa')}</td><td data-rotulo="Ações"><div class="row-actions">${acoes}</div></td></tr>`;
  };
  const resultado=`<div class="invite-result" data-link-resultado tabindex="-1" hidden></div>`;
  const convidar=pode.acessos?`<details class="item-new" id="convidar"><summary class="button">${icone('mais')}Convidar associado</summary><form class="panel-form" data-form="convite" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><div class="form-grid">${campo('email','E-mail',a=>`<input type="email" ${a} maxlength="160" inputmode="email" required>`,{id:'convite-email'})}${campo('empresa','Empresa',a=>`<select ${a} required><option value="">Escolha a empresa</option>${opcoes((o.empresas||[]).map(x=>[x.id,x.nome]),'')}</select>`,{id:'convite-empresa'})}${campo('papel','Papel',escolha(Object.entries(PAPEIS),'dono'),{id:'convite-papel'})}</div><div class="panel-actions"><button type="submit" class="button">Convidar</button><p class="form-note">O convite vale 7 dias. Sem e-mail configurado, o link aparece aqui para mandar pelo WhatsApp.</p></div></form></details>`:'';
  const equipe=pode.equipe?`<details class="item-new" id="equipe-nova"><summary class="button secondary">${icone('mais')}Nova conta da equipe</summary><form class="panel-form" data-form="equipe" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><div class="form-grid">${campo('email','E-mail',a=>`<input type="email" ${a} maxlength="160" inputmode="email" required>`,{id:'equipe-email'})}${campo('papel','Papel',escolha(Object.entries(EQUIPE),'editor'),{id:'equipe-papel'})}</div><dl class="roles-help"><div><dt>Administração</dt><dd>tudo, inclusive planos e a equipe</dd></div><div><dt>Edição</dt><dd>conteúdo, banners, mídia e a fila</dd></div><div><dt>Operação</dt><dd>empresas e acessos</dd></div></dl><div class="panel-actions"><button type="submit" class="button">Criar conta</button></div></form></details>`:'';
  const lista=itens.length?tabela([['Pessoa'],['Acesso'],['Situação'],['Ações']],itens.map(linha).join(''),'users-table'):semResultado(vm,'Nenhuma conta com esses filtros.','Nenhuma conta ainda.');
  return `${convidar||equipe?`<div class="admin-forms">${convidar}${equipe}</div>`:''}${resultado}${tabs}${filtro}${contagem(d,'conta','contas')}${lista}${paginacao(vm)}`;
}

// Acessos ao painel (v0.21.0, contrato 21) ----------------------------------------------------------------------------
// Cada empresa com a situação de acesso, os membros e os convites, e as ações por situação: "Convidar" (sem conta ou convite
// vencido, com o e-mail e o papel sugeridos), "Reenviar" e "Cancelar" no convite pendente, só com acoes.reenviar e
// acoes.cancelar. O link do convite nunca vem na lista: só a resposta do convite e do reenvio o traz, e o equipe.js o mostra
// no próprio cartão, sem guardar.
const ACESSO={'sem-conta':['sem-conta','Sem conta'],'convite-pendente':['em-andamento','Convite pendente'],'convite-vencido':['ajuste','Convite vencido'],'com-acesso':['publicado','Com acesso']};
const CONTAGEM_ACESSO={'sem-conta':'semConta','convite-pendente':'convitePendente','convite-vencido':'conviteVencido','com-acesso':'comAcesso'};
function cartaoAcesso(x,{acoes,aberto}) {
  const m=x.empresa||{},id=e(m.id),nome=e(m.nome||m.id),[cls,rotulo]=ACESSO[x.situacao]||['sem-conta',e(x.situacao||'')];
  const onde=[SITUACAO_EMPRESA[m.status]||e(m.status||''),m.bairro&&e(m.bairro)].filter(Boolean).join(' · ');
  const membros=(x.membros||[]).length?`<ul class="access-people">${x.membros.map(p=>`<li><span class="person"><strong>${e(p.usuario?.nome||p.usuario?.email||'')}</strong>${p.usuario?.nome?`<span>${e(p.usuario.email)}</span>`:''}</span><span class="access-role">${PAPEIS[p.papel]||e(p.papel)}${p.desde?` · desde ${data(p.desde)}`:''}</span></li>`).join('')}</ul>`:'';
  const convite=c=>{
    const quem=e(c.email),botao=(acao,texto,cls='')=>`<button type="button" class="link-button text-button${cls}" data-${acao}-convite="${quem}" data-empresa="${id}">${texto}<span class="sr-only"> o convite de ${quem} para ${nome}</span></button>`;
    const botoes=c.vencido?'':[acoes.reenviar&&botao('reenviar','Reenviar'),acoes.cancelar&&botao('cancelar','Cancelar',' danger')].filter(Boolean).join('');
    return `<li><span class="person"><strong>${quem}</strong><span>${PAPEIS[c.papel]||e(c.papel)} · ${c.vencido?`venceu em ${dataHora(c.expira)}`:`vale até ${dataHora(c.expira)}`}</span></span>${botoes?`<span class="row-actions">${botoes}</span>`:''}</li>`;
  };
  const convites=(x.convites||[]).length?`<div class="access-block"><h3>Convites</h3><ul class="access-people">${x.convites.map(convite).join('')}</ul></div>`:'';
  // Convidar: sem conta ou com o convite vencido; o e-mail e o papel vêm de x.convite.
  const sugerido=x.convite||{},convidar=acoes.convidar&&['sem-conta','convite-vencido'].includes(x.situacao)
    ?`<details class="access-invite"${aberto?' open':''}><summary class="button secondary">${icone('mais')}Convidar<span class="sr-only"> para ${nome}</span></summary><form class="panel-form" data-form="acesso-convite" data-empresa="${id}" data-nome="${nome}" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div><div class="form-grid">${campo('email','E-mail de quem vai cuidar da empresa',a=>`<input type="email" ${a} value="${e(sugerido.email||'')}" maxlength="160" inputmode="email" autocomplete="off" required>`,{id:`convite-${m.id}-email`,dica:sugerido.email?'Confira se é o e-mail do anunciante: este é o do perfil da empresa, que às vezes é o de quem fez o cadastro. O convite dá o acesso ao painel a quem abrir o link.':'A empresa não tem e-mail no perfil: escreva o e-mail do anunciante.'})}${campo('papel','Papel',escolha(Object.entries(PAPEIS),sugerido.papel||'dono'),{id:`convite-${m.id}-papel`})}</div><div class="panel-actions"><button type="submit" class="button">Enviar o convite</button><p class="form-note">O link do convite vale 7 dias e funciona uma vez só. Sem e-mail configurado, ele aparece aqui para mandar pelo WhatsApp.</p></div></form></details>`:'';
  const semNada=!membros&&!convites?`<p class="muted access-none">${x.situacao==='sem-conta'?'Ninguém desta empresa entra no painel ainda.':''}</p>`:'';
  return `<li class="access-item" id="acesso-${id}"><div class="access-head"><div><h2 class="access-name"><a href="${e(ficha('empresas',m.id))}">${nome}</a></h2>${onde?`<p class="muted">${onde}</p>`:''}</div>${etiqueta(cls,rotulo)}</div>${membros?`<div class="access-block"><h3>Quem entra</h3>${membros}</div>`:''}${convites}${semNada}${convidar}<div class="invite-result" data-acesso-resultado tabindex="-1" hidden></div></li>`;
}
function acessos(vm) {
  const d=vm.dados,f=vm.filtros||{};
  if(!d)return `<p class="panel-readonly">${icone('cadeado')}<span>Os acessos ao painel são da Administração e da Operação: seu papel na equipe (${EQUIPE[vm.equipe]||e(vm.equipe||'')}) não abre esta lista.</span></p>`;
  const itens=d.itens||[],c=d.contagem||{},acoes=d.acoes||{},total=Object.values(c).reduce((s,n)=>s+(Number(n)||0),0);
  const chip=(s,l)=>{const n=s?c[CONTAGEM_ACESSO[s]]:total;return [s,`${l} <span class="chip-count">${numero(n||0)}</span>`];};
  const tabs=f.empresa?'':abas('Situação de acesso',[chip('','Todas'),chip('sem-conta','Sem conta'),chip('convite-pendente','Convite pendente'),chip('convite-vencido','Convite vencido'),chip('com-acesso','Com acesso')],f.situacao||'',v=>rota('acessos',{q:f.q,situacao:v}));
  const busca=f.empresa?`<p class="access-only">Só esta empresa, pelo endereço da ficha. <a href="${e(rota('acessos'))}">Ver todas as empresas</a></p>`:filtros(vm,[],{busca:'Nome da empresa',fixos:{situacao:f.situacao}});
  const sozinha=Boolean(f.empresa)&&itens.length===1;
  const lista=itens.length?`<ul class="access-list-items">${itens.map(x=>cartaoAcesso(x,{acoes,aberto:sozinha})).join('')}</ul>`
    :vazio(f.empresa?'Essa empresa não está no guia.':f.q||f.situacao?'Nenhuma empresa com esses filtros.':'Nenhuma empresa no guia ainda.');
  const operador=acoes.convidar&&!acoes.reenviar?`<p class="form-note access-note">Seu papel na equipe convida, mas não reenvia nem cancela convites: isso é com a Administração.</p>`:'';
  return `${tabs}${busca}${operador}${f.empresa?'':contagem(d,'empresa','empresas')}${lista}${paginacao(vm)}`;
}

// Solicitações ----------------------------------------------------------------------------------------------------------

function solicitacoesLista(vm) {
  const d=vm.dados||{},itens=d.itens||[];
  const filtro=filtros(vm,[{nome:'status',rotulo:'Situação',lista:Object.entries(SOL),todos:'Todas'},{nome:'empresa',rotulo:'Empresa',lista:(vm.opcoes?.empresas||[]).map(x=>[x.id,x.nome]),todos:'Todas'}],{busca:''});
  const linha=s=>`<tr><th scope="row"><a href="${e(ficha('solicitacoes',s.id))}">${e(s.assunto)}</a></th><td data-rotulo="Empresa">${e(s.empresa?.nome||'')}</td><td data-rotulo="Tipo">${TIPO_SOL[s.tipo]||e(s.tipo)}</td><td data-rotulo="Situação">${etiqueta(SOL_CLASSE[s.status]||s.status,SOL[s.status]||e(s.status))}</td><td data-rotulo="Atualizada">${data(s.atualizada)}</td></tr>`;
  const lista=itens.length?tabela([['Assunto'],['Empresa'],['Tipo'],['Situação'],['Atualizada']],itens.map(linha).join('')):semResultado(vm,'Nenhuma solicitação com esses filtros.','Nenhuma solicitação ainda.');
  return `${filtro}${contagem(d,'solicitação','solicitações')}${lista}${paginacao(vm)}`;
}
function solicitacaoRegistro(vm) {
  const s=vm.dados||{},pode=vm.pode?.solicitacoes,b=s.briefing;
  const briefing=b?`<section class="panel-section" aria-labelledby="sol-briefing"><h2 id="sol-briefing">Briefing da criação</h2><dl class="panel-dl">${[['Objetivo',b.objetivo&&e(b.objetivo)],['Formato',b.formato&&e(b.formato)],['Para quando',b.prazo&&data(b.prazo)],['Referências',b.referencias&&e(b.referencias)]].filter(([,v])=>v).map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>`:'';
  const mensagem=m=>`<article class="message is-${m.autor?.lado==='equipe'?'equipe':'associado'}"><header><strong>${e(m.autor?.nome||'')}</strong><time datetime="${e(m.em||'')}">${dataHora(m.em)}</time></header><p>${e(m.texto)}</p></article>`;
  const conversa=`<section class="panel-section" aria-labelledby="sol-conversa"><h2 id="sol-conversa">Conversa</h2><div class="request-thread">${(s.mensagens||[]).map(mensagem).join('')||vazio('Nenhuma mensagem ainda.')}</div>${pode&&s.status!=='fechada'?`<form class="panel-form request-reply" data-form="mensagem" novalidate><div class="form-errors" role="alert" tabindex="-1" hidden></div>${campo('texto','Responder ao associado',textarea('',2000,4,' required'),{id:'resposta-texto',dica:'A resposta deixa a solicitação “Esperando o associado”.'})}<div class="panel-actions"><button type="submit" class="button">Enviar resposta</button></div></form>`:''}</section>`;
  const status=pode?`<form class="role-form status-form" data-form="status-solicitacao" data-version="${e(s.version??'')}" novalidate><label for="sol-status" class="sr-only">Situação</label><select id="sol-status" name="status" data-papel-atual="${e(s.status)}">${opcoes(Object.entries(SOL),s.status)}</select><button type="submit" class="button secondary" data-salvar-papel hidden>Mudar situação</button></form>`:etiqueta(SOL_CLASSE[s.status]||s.status,SOL[s.status]||e(s.status||''));
  const ficha_=`<dl class="panel-dl request-facts"><div><dt>Empresa</dt><dd>${s.empresa?.id?`<a href="${e(ficha('empresas',s.empresa.id))}">${e(s.empresa.nome)}</a>`:e(s.empresa?.nome||'')}</dd></div><div><dt>Tipo</dt><dd>${TIPO_SOL[s.tipo]||e(s.tipo||'')}</dd></div><div><dt>Aberta em</dt><dd>${data(s.criada)}</dd></div><div><dt>Situação</dt><dd>${status}</dd></div></dl>`;
  return `${pode?'':soLeitura(vm,'as solicitações')}${ficha_}${briefing}${conversa}`;
}

// Módulos: lista, registro, título do registro e o botão de criar ------------------------------------------------------

const MODULOS={
  resumo:{lista:resumo},
  fila:{lista:fila},
  solicitacoes:{lista:solicitacoesLista,registro:solicitacaoRegistro,nome:x=>x.assunto},
  empresas:{lista:empresasLista,registro:empresaRegistro,nome:x=>x.nome,novo:'Nova empresa',criar:vm=>vm.pode?.empresas&&!['redes','planos'].includes(vm.filtros?.aba)&&{href:'/admin/empresas/novo',rotulo:'Nova empresa'},publico:x=>x.status==='publicado'&&x.slug&&`/comercio/${x.slug}`},
  conteudo:{lista:conteudoLista,registro:conteudoRegistro,nome:x=>x.titulo||x.nome,novo:vm=>TIPOS.find(([t])=>t===tipoDe(vm))[2],
    criar:vm=>{const t=tipoDe(vm);return vm.pode?.conteudo&&{href:rota('conteudo/novo',comTipo(t)),rotulo:TIPOS.find(([v])=>v===t)[2]};},publico:(x,vm)=>x.status==='publicado'&&x.slug&&PUBLICO[tipoDe(vm)]&&`${PUBLICO[tipoDe(vm)]}${x.slug}`,
    voltar:vm=>[rota('conteudo',comTipo(tipoDe(vm))),TIPOS.find(([t])=>t===tipoDe(vm))[1]]},
  banners:{lista:bannersLista,registro:bannerRegistro,nome:x=>x.titulo,novo:'Novo banner',criar:vm=>vm.pode?.banners&&{href:'/admin/banners/novo',rotulo:'Novo banner'}},
  cupons:{lista:cuponsAdmin},
  midia:{lista:midia},
  pessoas:{lista:pessoasLista,registro:pessoaRegistro,nome:x=>x.nome,novo:'Nova pessoa',criar:vm=>vm.pode?.conteudo&&{href:'/admin/pessoas/novo',rotulo:'Nova pessoa'}},

  relatorios:{lista:relatorios},
  usuarios:{lista:usuarios},
  acessos:{lista:acessos},
  auditoria:{lista:auditoria}
};
const NOME_MODULO=Object.fromEntries(GRUPOS.flatMap(([,itens])=>itens));

function navegacao(vm,atual,registro) {
  const conta=n=>n?`<span class="nav-count">${numero(n)}<span class="sr-only"> esperando</span></span>`:'';
  const numeros=vm.contagem||(atual==='resumo'?{fila:vm.dados?.fila,solicitacoes:vm.dados?.solicitacoes}:{});
  // Acessos ao painel (21) só aparece com a ação acessos; os outros módulos dizem no próprio corpo o que o papel não altera.
  const grupos=GRUPOS.map(([nome,itens],g)=>`<div class="nav-group"><p class="nav-group-label" id="grupo-${g}">${nome}</p><ul aria-labelledby="grupo-${g}">${itens.filter(([m])=>m!=='acessos'||vm.pode?.acessos).map(([m,l])=>`<li><a href="${rota(m)}"${m===atual?` aria-current="${registro?'true':'page'}"`:''}>${icone(m)}<span>${l}</span>${conta(numeros[m])}</a></li>`).join('')}</ul></div>`).join('');
  return `<nav class="panel-nav admin-nav" aria-label="Admin"><div class="nav-groups">${grupos}</div></nav>`;
}
const marca=vm=>`<div class="panel-company"><p class="panel-label">Equipe Nexus</p><p class="company-current">Admin do guia</p><div class="company-meta"><span class="company-status is-live">${EQUIPE[vm.equipe]||e(vm.equipe||'Equipe')}</span></div></div>`;
const conta=vm=>`<div class="panel-user"><p><strong>${e(vm.usuario?.nome||vm.usuario?.email||'')}</strong>${vm.usuario?.nome?`<span>${e(vm.usuario.email)}</span>`:''}</p><button type="button" class="panel-logout secondary" data-sair>${icone('sair')}<span>Sair</span></button></div>`;

export function adminView(vm) {
  const m=MODULOS[vm.modulo]?vm.modulo:'resumo',def=MODULOS[m],novo=vm.dados===null&&Boolean(def.registro),registro=Boolean(def.registro)&&(novo||Boolean(vm.filtros?.id));
  const [titulo,descricao]=TITULOS[m];
  let cabeca;
  if(registro){
    const x=vm.dados||{},[href,rotulo]=def.voltar?def.voltar(vm):[rota(m),NOME_MODULO[m]];
    const nome=novo?(typeof def.novo==='function'?def.novo(vm):def.novo):def.nome(x);
    const publico=!novo&&def.publico?.(x,vm);
    const estado=!novo&&x.status&&m!=='solicitacoes'?m==='banners'?situacaoBanner(x):situacao(x.status,m==='empresas'?SITUACAO_EMPRESA:SITUACAO):'';
    const extras=[publico&&`<a href="${e(publico)}" target="_blank" rel="noopener">Ver no guia ${fora}</a>`,!novo&&m==='empresas'&&`<a href="${e(rota('auditoria',{empresa:x.id}))}">Histórico na auditoria</a>`,!novo&&x.gerida&&'<span class="muted">Editado pela equipe: a coleta diária e a importação não sobrescrevem.</span>'].filter(Boolean).join('');
    cabeca=`<header class="panel-head admin-record-head"><div><a class="admin-back" href="${e(href)}"><span aria-hidden="true">←</span> ${rotulo}</a><h1 id="admin-titulo">${e(nome||'Sem título')}</h1>${estado||extras?`<div class="record-meta">${estado}${extras}</div>`:''}</div></header>`;
  }else{
    const criar=def.criar?.(vm);
    cabeca=`<header class="panel-head"><div><h1 id="admin-titulo">${titulo}</h1><p>${descricao}</p></div>${criar?`<div class="panel-shortcuts"><a class="button" href="${e(criar.href)}">${icone('mais')}${criar.rotulo}</a></div>`:''}</header>`;
  }
  const conteudo=registro?def.registro(vm):def.lista(vm);
  const imagens=registro&&['empresas','conteudo','banners'].includes(m)&&vm.filtros?.tipo!=='colecao'&&vm.pode?.[m];
  const id=registro&&!novo?` data-id="${e(vm.dados?.id||'')}"`:'';
  return `<div class="panel admin" data-admin data-csrf="${e(vm.csrf)}" data-modulo="${m}"${id}><aside class="panel-side" aria-label="Módulos do admin">${marca(vm)}${navegacao(vm,m,registro)}${conta(vm)}</aside><section class="panel-main" aria-labelledby="admin-titulo">${cabeca}<div class="panel-flash" data-aviso role="status" tabindex="-1" hidden></div><p class="sr-only" data-anuncio aria-live="polite"></p><noscript><p class="panel-readonly">O admin precisa do JavaScript do navegador para salvar.</p></noscript>${conteudo}</section>${imagens?biblioteca():''}</div>`;
}
