import {test} from 'node:test';
import assert from 'node:assert/strict';
import {views,renderPage} from '../../api/views/index.mjs';
import {admin,adminDados,adminRegistros,adminOcupacao,exemplos,filaCategoria} from './exemplos.mjs';

// Fase 4 (contrato 13): admin da equipe, a partir dos vms de exemplo. O servidor confere cada permissão; aqui se confere que a
// tela mostra como editável só o que vm.pode libera, que nada sai sem escape e que cada módulo traz o que a equipe precisa.
const page=(view,vm)=>renderPage({title:'Resumo · Admin | Guia PRIMIG',status:200,view,vm},{canonical:'https://guia.test/admin',indexable:false,path:'/admin'});
const semInline=html=>{assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)|<style|\sstyle=|\son[a-z]+=/i);};
const registro=(modulo,dados,filtros={})=>views.admin(admin(modulo,{dados,filtros:{q:'',status:'',page:1,id:dados?.id,...filtros}}));
const novo=(modulo,filtros={})=>views.admin(admin(modulo,{dados:null,filtros:{q:'',status:'',page:1,...filtros}}));
const nenhum={empresas:false,conteudo:false,banners:false,midia:false,fila:false,planos:false,acessos:false,equipe:false,solicitacoes:false};

test('admin: casca com os módulos em grupos, contagem, CSRF, script próprio e nada inline',()=>{
 const html=views.admin(exemplos.admin);
 assert.match(html,/^<div class="panel admin" data-admin data-csrf="csrf-admin-0123456789abcdef0123" data-modulo="resumo">/);
 assert.match(html,/<p class="nav-group-label" id="grupo-0">Trabalho<\/p><ul aria-labelledby="grupo-0"><li><a href="\/admin" aria-current="page">/);
 for(const [grupo,itens] of [['Guia',['Empresas','Conteúdo','Banners','Mídia']],['Equipe e números',['Relatórios','Usuários','Acessos ao painel','Auditoria']]])
  assert.match(html,new RegExp(`>${grupo}</p><ul[^>]*>${itens.map(i=>`[^]*<span>${i}</span>`).join('')}`));
 assert.match(html,/href="\/admin\/fila">[^]*<span>Fila de aprovação<\/span><span class="nav-count">3<span class="sr-only"> esperando<\/span><\/span>/,'a contagem vem de Admin.contagem');
 assert.match(html,/<span class="company-status is-live">Administração<\/span>/);
 assert.match(html,/<strong>Ana Equipe<\/strong><span>ana@primig\.com\.br<\/span><\/p><button type="button" class="panel-logout secondary" data-sair>/);
 assert.match(html,/<div class="panel-flash" data-aviso role="status" tabindex="-1" hidden><\/div><p class="sr-only" data-anuncio aria-live="polite"><\/p>/);
 const pagina=page('admin',exemplos.admin);
 assert.match(pagina,/<script type="module" src="\/assets\/equipe\.js"><\/script><\/head>/,'/assets/admin.js segue fechado (pilotos)');
 assert.match(pagina,/<header class="site-header reference-header work-header"><a class="brand-logo" href="\/admin"[^]*<p class="work-title">Admin do guia<\/p><div class="nav-actions"><button type="button" class="icon-button theme-toggle"[^]*<a class="work-exit" href="\/" target="_blank" rel="noopener">Ver o guia/,'cabeçalho próprio do admin');
 assert.doesNotMatch(pagina,/id="main-nav"|<footer|id="consent"/,'sem o menu público, o rodapé e o aviso de medição');
 assert.doesNotMatch(pagina,/Assinantes|Receita/,'assinantes e receita saíram do site (v0.14.0)');
 assert.match(pagina,/<meta name="robots" content="noindex,nofollow">/);
 assert.doesNotMatch(pagina,/class="vitrine-slot/,'sem anúncio no admin');
 semInline(pagina);
});

test('admin, resumo: o que espera a equipe, os números do guia, atalhos por permissão e bairro e categoria',()=>{
 const html=views.admin(exemplos.admin);
 assert.match(html,/<a class="stat-card" href="\/admin\/empresas\?status=publicado"><span class="stat-label">Empresas no guia<\/span><strong>41<\/strong><small>2 fora do guia<\/small><\/a>/);

 assert.match(html,/<strong>5<\/strong><small>11 espaços livres hoje<\/small>/);
 assert.match(html,/<section class="panel-block block-depende has-items" aria-labelledby="r-espera">[^]*href="\/admin\/fila"><span><strong>3<\/strong> envios na fila de aprovação<\/span>[^]*href="\/admin\/solicitacoes\?status=aberta"><span><strong>2<\/strong> solicitações para responder/);
 assert.match(html,/<a class="button" href="\/admin\/conteudo\/novo\?tipo=artigo">[^]*Publicar um artigo<\/a><a class="button secondary" href="\/admin\/banners\/novo">[^]*Agendar um banner<\/a>/);
 assert.doesNotMatch(html,/[Nn]otícia/,'a seção de notícias saiu do site');
 assert.match(html,/<form class="admin-filters is-compact" method="get" action="\/admin" role="search"[^]*<select id="r-bairro" name="bairro">[^]*<option value="Posse">Posse<\/option>[^]*<optgroup label="Alimentação"><option value="alimentacao">Alimentação: todo o grupo<\/option><option value="padarias">Padarias<\/option>[^]*Filtrar o resumo<\/button>/);
 const vazio=views.admin(admin('resumo',{pode:nenhum,dados:{...adminDados.resumo,fila:0,solicitacoes:0}}));
 assert.doesNotMatch(vazio,/Fazer agora|has-items/,'sem permissão de escrita, sem atalhos; sem espera, sem destaque');
 assert.match(vazio,/A fila de aprovação está vazia/);
});

test('admin, listas: filtros na URL, escape, tabela que vira ficha e páginas que guardam os filtros',()=>{
 const html=views.admin(admin('empresas',{filtros:{q:'pão "doce"',status:'publicado',bairro:'Centro',page:2},dados:{...adminDados.empresas,pagina:2,paginas:3}}));
 assert.match(html,/<nav class="quick-filters admin-tabs" aria-label="Cadastro"><a class="filter-chip" href="\/admin\/empresas" aria-current="page">Empresas<\/a><a class="filter-chip" href="\/admin\/empresas\?aba=redes">Redes<\/a>/);
 assert.match(html,/<form class="admin-filters" method="get" action="\/admin\/empresas" role="search"[^>]*><div class="form-field filter-q"><label for="filtro-q">[^<]+<\/label><input type="search" id="filtro-q" name="q" value="pão &quot;doce&quot;"/);
 assert.match(html,/<select id="filtro-status" name="status"><option value="">Todas<\/option><option value="publicado" selected>Publicada<\/option>/);
 assert.match(html,/<a class="link-button text-button" href="\/admin\/empresas">Limpar filtros<\/a>/);
 assert.match(html,/<p class="admin-count">43 empresas<\/p>/);
 assert.match(html,/<th scope="row"><a href="\/admin\/empresas\/padaria-exemplo">Padaria &lt;Exemplo&gt;<\/a> <span class="type-tag">Destaque<\/span><\/th><td data-rotulo="Bairro">Centro<\/td>[^]*<td data-rotulo="Plano">Premium<\/td><td data-rotulo="Situação"><span class="state-tag is-publicado">Publicada<\/span>/);
 assert.match(html,/<td data-rotulo="Plano"><span class="muted">Sem plano<\/span><\/td><td data-rotulo="Situação"><span class="state-tag is-pausado">Fora do guia<\/span>/);
 assert.match(html,/<a class="button secondary" rel="prev" href="\/admin\/empresas\?q=p%C3%A3o\+%22doce%22&amp;status=publicado&amp;bairro=Centro">[^]*Anterior<\/a><span>Página 2 de 3<\/span><a class="button secondary" rel="next" href="\/admin\/empresas\?q=[^"]*page=3">/);
 assert.match(html,/<div class="panel-shortcuts"><a class="button" href="\/admin\/empresas\/novo">/);
 const planos=views.admin(admin('empresas',{filtros:{aba:'planos'},dados:{itens:[{id:'p1',nome:'Premium',precoCentavos:35000,ordem:2,patrocinado:true,pago:true,status:'ativo',version:3}],total:1,pagina:1,paginas:1}}));
 assert.match(planos,/<button type="button" class="link-button text-button" data-editar-linha="plano-p1" aria-expanded="false" aria-controls="plano-p1">Editar[^]*<tr class="edit-row" id="plano-p1" hidden><td colspan="7"><form class="panel-form" data-form="plano" data-id="p1" novalidate>[^]*name="version" value="3"/);
 assert.doesNotMatch(views.admin(admin('empresas',{filtros:{aba:'planos'},pode:{...nenhum},dados:{itens:[],total:0,pagina:1,paginas:1}})),/data-form="plano"/,'sem a permissão planos, só leitura');
});

test('admin, empresas: plano definido pela gestão comercial (19.5), na ficha só leitura e marcado na lista',()=>{
 const html=registro('empresas',{...adminRegistros.empresa,planoGerido:true});
 assert.doesNotMatch(html,/name="plano"/,'sem o campo: o salvar não manda o plano');
 assert.match(html,/<div class="form-field managed-plan" data-campo="plano"><span class="field-label">Plano<\/span><p class="managed-plan-value"><span>Premium<\/span> <span class="state-tag is-em-andamento">Definido pela gestão<\/span><\/p><p class="field-hint">A gestão comercial define o plano pela assinatura desta empresa/);
 assert.match(html,/name="rede"[^]*name="destaque"/,'os outros campos do bloco continuam editáveis');
 assert.match(registro('empresas',{...adminRegistros.empresa,plano:null,planoGerido:true}),/<span>Sem plano pago<\/span> <span class="state-tag is-em-andamento">Definido pela gestão<\/span>/);
 assert.match(registro('empresas',{...adminRegistros.empresa,planoGerido:false}),/<select id="campo-plano" name="plano"/);
 const linhas=[{...adminDados.empresas.itens[0],plano:{id:'p-premium',nome:'Premium'},planoGerido:true},{...adminDados.empresas.itens[1],plano:{id:'p-sumido',nome:'Ouro'},planoGerido:false},{...adminDados.empresas.itens[1],id:'sem-plano',plano:null,planoGerido:true}];
 const lista=views.admin(admin('empresas',{dados:{itens:linhas,total:3,pagina:1,paginas:1}}));
 assert.match(lista,/<td data-rotulo="Plano">Premium <span class="state-tag is-em-andamento">Definido pela gestão<\/span><\/td>/);
 assert.match(lista,/<td data-rotulo="Plano">Ouro<\/td>/,'a linha traz {id, nome}: fora das opções, vale o nome do vm');
 assert.match(lista,/<td data-rotulo="Plano"><span class="muted">Sem plano<\/span> <span class="state-tag is-em-andamento">Definido pela gestão<\/span><\/td>/);
 assert.doesNotMatch(lista,/\[object Object\]/);
});

test('admin, empresa: cadastro completo com categorias, horário, redes, plano, imagem e publicação',()=>{
 const html=registro('empresas',adminRegistros.empresa);
 assert.match(html,/<a class="admin-back" href="\/admin\/empresas"><span aria-hidden="true">←<\/span> Empresas<\/a><h1 id="admin-titulo">Padaria &lt;Exemplo&gt;<\/h1><div class="record-meta"><span class="state-tag is-publicado">Publicada<\/span><a href="\/comercio\/padaria-exemplo" target="_blank"/);
 assert.match(html,/href="\/admin\/auditoria\?empresa=padaria-exemplo">Histórico na auditoria<\/a><span class="muted">Editado pela equipe/);
 assert.match(html,/<form class="panel-form admin-form" data-form="empresa" data-id="padaria-exemplo" novalidate>[^]*<input type="hidden" name="version" value="5">/);
 assert.match(html,/<details class="category-group" data-grupo="alimentacao" open><summary>Alimentação <span class="count-tag">1<\/span><\/summary><div class="check-options"><label class="toggle"><input type="checkbox" name="categorias" value="Padarias" checked>/);
 assert.match(html,/<div class="hours-day" data-dia="1">[^]*value="07:00"[^]*value="19:00"/);
 assert.match(html,/<select data-rede><option value="Instagram" selected>Instagram<\/option>/);
 assert.match(html,/<select id="campo-plano" name="plano"[^>]*><option value="">Sem plano<\/option><option value="p-premium" selected>Premium<\/option>/);
 assert.match(html,/<input type="checkbox" name="destaque" checked>/);
 assert.match(html,/<div class="form-field full image-field" data-imagem-campo data-campo="imagem">[^]*<img src="\/midia\/m1\/800\.webp" alt=""[^]*Trocar imagem[^]*<input type="hidden" name="imagem" value="\/midia\/m1\/800\.webp"><\/div>/);
 assert.match(html,/<div class="panel-actions admin-save"><button type="submit" class="button">Salvar alterações<\/button><button type="button" class="button secondary" data-acao-registro="pausar">Tirar do ar<\/button>/,'publicada: salvar já vale e tirar do ar é à parte');
 assert.match(html,/<dialog class="media-picker" data-biblioteca aria-labelledby="biblioteca-titulo">[^]*<input type="file" id="dialogo-arquivo" name="arquivo"/);
 const nova=novo('empresas');
 assert.match(nova,/<h1 id="admin-titulo">Nova empresa<\/h1>/);assert.match(nova,/data-form="empresa" data-novo novalidate/);
 assert.match(nova,/name="slug"/);
 // Empresa nova: o rascunho é o primeiro botão (o do Enter), e o texto diz o que cada um faz.
 assert.match(nova,/<div class="panel-actions admin-save"><button type="submit" class="button" data-depois="">Salvar como rascunho<\/button><button type="submit" class="button secondary" data-depois="publicar">Salvar e publicar<\/button><p class="form-note">Como rascunho, a empresa fica fora do guia até alguém publicar\. “Salvar e publicar” já põe a empresa no guia\.<\/p>/);
 const rascunho=views.admin(admin('empresas',{dados:{...adminRegistros.empresa,status:'rascunho'},filtros:{id:'padaria-exemplo'}}));
 assert.match(rascunho,/data-depois="publicar">Salvar e publicar no guia<\/button><button type="submit" class="button secondary" data-depois="">Salvar sem publicar/,'a empresa já em rascunho não muda');
 const leitura=views.admin(admin('empresas',{pode:nenhum,dados:adminRegistros.empresa,filtros:{id:'padaria-exemplo'}}));
 assert.match(leitura,/class="panel-readonly"[^]*Seu papel na equipe \(Administração\) vê o cadastro, mas não altera/);
 assert.doesNotMatch(leitura,/admin-save|<dialog/);assert.match(leitura,/<fieldset class="panel-fieldset" id="identificacao" disabled>/);
});

test('admin, conteúdo: abas por tipo, editor de texto rico, biblioteca, editorias e campos de cada tipo',()=>{
 const lista=views.admin(admin('conteudo'));
 assert.match(lista,/aria-label="Tipo de conteúdo"><a class="filter-chip" href="\/admin\/conteudo\?tipo=artigo" aria-current="page">Artigos<\/a><a class="filter-chip" href="\/admin\/conteudo\?tipo=classificado">Classificados<\/a>[^]*\?tipo=evento">Eventos<\/a>[^]*\?tipo=colecao">Coleções<\/a>/);
 assert.doesNotMatch(lista,/Notícias|tipo=noticia/,'sem a aba de notícias');
 assert.match(lista,/<a href="\/admin\/conteudo\/c1\?tipo=artigo">Feira de artesanato no Centro<\/a><\/th><td data-rotulo="Editorias">Cidade<\/td><td data-rotulo="Data">12\/10\/2026<\/td><td data-rotulo="Situação"><span class="state-tag is-rascunho">Rascunho<\/span>/);
 assert.match(lista,/<a class="button" href="\/admin\/conteudo\/novo\?tipo=artigo">[^]*Novo artigo<\/a>/);
 assert.match(views.admin(admin('conteudo',{filtros:{tipo:'evento'},dados:{itens:[{id:'news:a b',titulo:'Show',inicio:'2026-10-20T19:30',local:'Praça',status:'publicado'}],total:1,pagina:1,paginas:1}})),/<a href="\/admin\/conteudo\/news%3Aa%20b\?tipo=evento">Show<\/a><\/th><td data-rotulo="Quando">20\/10\/2026 às 19:30<\/td>/,'o id com ":" vai codificado');
 const html=registro('conteudo',adminRegistros.conteudo);
 assert.match(html,/<a class="admin-back" href="\/admin\/conteudo\?tipo=artigo"><span aria-hidden="true">←<\/span> Artigos<\/a><h1 id="admin-titulo">Feira de artesanato no Centro<\/h1>/);
 assert.match(html,/<div class="rich-toolbar" role="toolbar" aria-label="Formatar o texto" aria-controls="editor-html"><button type="button" class="secondary" data-cmd="h2" aria-label="Título de seção">Título<\/button>[^]*data-cmd="ul">Lista<\/button>[^]*data-cmd="link">Link<\/button><button type="button" class="secondary" data-cmd="imagem">Imagem<\/button><\/div>/);
 assert.match(html,/<div class="rich-area" id="editor-html" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="rotulo-html" aria-describedby="dica-html" data-area><p>A feira reúne artesãos\.<\/p><h2>Como chegar<\/h2><ul><li>Ônibus até a praça\.<\/li><\/ul><\/div>/,'o html já saneado entra sem escape');
 assert.match(html,/<span class="field-label" id="rotulo-html">Texto do artigo<\/span>/);
 assert.match(html,/<input type="checkbox" name="editorias" value="Cidade" checked><span>Cidade<\/span><\/label><label class="toggle"><input type="checkbox" name="editorias" value="Saúde">/);
 assert.match(html,/data-depois="publicar">Salvar e publicar<\/button><button type="submit" class="button secondary" data-depois="">Salvar sem publicar<\/button>/);
 assert.match(html,/data-form="conteudo" data-id="c1" data-tipo="artigo" novalidate/);
 assert.match(registro('conteudo',{...adminRegistros.conteudo,status:'publicado'}),/href="\/artigos\/feira-no-centro" target="_blank"/);
 const classificado=novo('conteudo',{tipo:'classificado'});
 assert.match(classificado,/<h1 id="admin-titulo">Novo classificado<\/h1>/);assert.match(classificado,/name="preco"[^]*name="telefone"[^]*<select id="campo-empresa" name="empresa"><option value="">Nenhuma<\/option>/);
 assert.doesNotMatch(classificado,/name="editorias"/);
 const evento=novo('conteudo',{tipo:'evento'});
 assert.match(evento,/data-form="evento" data-novo/);assert.match(evento,/<input type="datetime-local" id="campo-inicio" name="inicio" value="" required>/);
 assert.match(evento,/<div class="rich-area" id="editor-descricao" contenteditable="true"[^>]*><p><br><\/p><\/div>/,'a descrição do evento usa o editor (13.9, item 10)');
 assert.match(novo('conteudo',{tipo:'oferta'}),/<select id="campo-empresa" name="empresa" required><option value="">Escolha a empresa<\/option>/);
 const colecao=novo('conteudo',{tipo:'colecao'});
 assert.match(colecao,/data-campo="grupos"[^]*<input type="checkbox" name="grupos" value="alimentacao">/);assert.doesNotMatch(colecao,/<dialog/,'coleção não tem imagem');
});

test('admin, banners: prévia no formato real, formatos do espaço e ocupação por dia',()=>{
 const html=registro('banners',adminRegistros.banner);
 assert.match(html,/<optgroup label="Página inicial"><option value="home-topo" data-computador="super-banner" data-celular="link-patrocinado" selected>Página inicial: logo depois da abertura \(3 banners giram\)<\/option>/);
 assert.match(html,/<option value="super-banner" selected>Super banner · 728 × 90<\/option>/);assert.match(html,/<option value="quadrado" hidden disabled>/,'só os formatos do espaço');
 assert.match(html,/<div class="preview-slot"><p class="preview-label">Computador <small data-previa-medida="computador">728 × 90 px<\/small><\/p><div class="preview-stage"><div class="vitrine-piece is-faixa" data-previa-peca="computador"><span class="vitrine-tag"><span>Publicidade<span class="vitrine-by"> · <span data-previa-anunciante>Padaria Exemplo<\/span>/);
 assert.match(html,/Celular <small data-previa-medida="celular">320 × 100 px<\/small>[^]*<div class="vitrine-piece is-link" data-previa-peca="celular">[^]*<img src="\/midia\/m3\/800\.webp" alt="" width="320" height="100">/,'a imagem do celular no formato do celular do espaço');
 assert.match(html,/<p class="fieldset-note" data-ocupacao-aviso hidden><\/p>/);
 const oc=views.admin(admin('banners',{filtros:{aba:'ocupacao',de:'2026-10-15',ate:'2026-10-28'},dados:adminOcupacao}));
 assert.match(oc,/<a class="filter-chip" href="\/admin\/banners\?aba=ocupacao" aria-current="page">Ocupação dos espaços<\/a>/);
 assert.match(oc,/href="\/admin\/banners\?aba=ocupacao&amp;de=2026-10-01&amp;ate=2026-10-14">[^]*14 dias antes<\/a><a class="link-button text-button" href="\/admin\/banners\?aba=ocupacao&amp;de=2026-10-29&amp;ate=2026-11-11">14 dias depois/);
 assert.match(oc,/<th scope="col" class="occ-day"><span>15<\/span><small>qui<\/small><span class="sr-only"> 15\/10\/2026<\/span><\/th><th scope="col" class="occ-day"><span>16<\/span><small>sex<\/small>/);
 assert.match(oc,/<th scope="col" class="occ-day is-weekend"><span>17<\/span><small>sáb<\/small>/);
 assert.match(oc,/<td class="occ is-parcial" title="Padaria Exemplo"><span aria-hidden="true">1\/3<\/span><span class="sr-only">15\/10\/2026: 1 de 3 vendidos \(Padaria Exemplo\)<\/span><\/td>/);
 assert.match(oc,/<td class="occ is-primig"><span class="sr-only">25\/10\/2026: livre, com o anúncio da PRIMIG<\/span><\/td>/,'livre num espaço casa mostra a PRIMIG');
 assert.match(oc,/<td class="occ is-livre"><span class="sr-only">15\/10\/2026: livre<\/span><\/td>/,'livre num espaço sem casa');
 assert.match(oc,/vendido em 10 de 14 dias<\/small><a class="link-button text-button" href="\/admin\/banners\/novo\?espaco=home-topo&amp;inicio=2026-10-15">Agendar aqui/,'leva o primeiro dia com vaga');
 assert.match(html,/<label for="campo-inicio">Primeiro dia no ar<\/label>[^]*<label for="campo-fim">Último dia no ar<\/label>[^]*<details class="more-options full"><summary>Mais opções<\/summary>[^]*name="peso"/);
 assert.match(html,/<div class="form-field full image-field is-peca" data-imagem-campo data-campo="imagem">[^]*<p class="field-warning" data-imagem-aviso hidden><\/p><input type="hidden" name="imagem"/);
 assert.match(html,/Com a empresa escolhida, já vem o perfil dela no guia/);assert.doesNotMatch(html,/aprovados/);
 const lista=b=>views.admin(admin('banners',{dados:{itens:[{...adminRegistros.banner,status:'publicado',...b}],total:1,pagina:1,paginas:1}}));
 assert.match(lista({inicio:'2099-01-01',fim:'2099-01-31'}),/<td data-rotulo="Situação"><span class="state-tag is-em-andamento">Agendado<\/span>/);
 assert.match(lista({inicio:'2020-01-01',fim:'2020-01-31'}),/<span class="state-tag is-pausado">Encerrado<\/span>/);
 assert.match(lista({inicio:'2020-01-01',fim:'2099-01-31'}),/<span class="state-tag is-publicado">No ar<\/span>/);
 const cheio={espacos:[{id:'x',pagina:'busca',onde:'topo',giram:1,casa:true,dias:[{dia:'2026-10-15',banners:[{id:'b',titulo:'B',anunciante:'Loja <A>'}],livres:0}]}]};
 assert.match(views.admin(admin('banners',{filtros:{aba:'ocupacao'},dados:cheio})),/<td class="occ is-vendido" title="Loja &lt;A&gt;"><span class="sr-only">15\/10\/2026: vendido \(Loja &lt;A&gt;\)<\/span>/);
});

test('admin, fila: antes e depois, aprovar e recusar com comentário, decididos e histórico',()=>{
 const html=views.admin(admin('fila'));
 assert.match(html,/<a class="filter-chip" href="\/admin\/fila" aria-current="page">Esperando decisão \(3\)<\/a>/);
 assert.match(html,/<h2 id="fila-titulo-a2">Oferta · Café da manhã para dois<\/h2><p class="queue-meta"><a href="\/admin\/empresas\/padaria-exemplo">Padaria Exemplo<\/a> · enviado por Maria Souza em 02\/10\/2026 às 10:00 · <a href="\/admin\/auditoria\?empresa=padaria-exemplo">Histórico<span class="sr-only"> de Padaria Exemplo na auditoria<\/span><\/a><\/p>/,'o título é o que se decide');
 assert.match(html,/<h2 id="fila-titulo-a3">Foto · Balcão<\/h2>/);
 assert.doesNotMatch(html,/state-tag is-pendente/,'na aba de quem espera, sem etiqueta repetida');
 assert.match(html,/<div class="diff-row is-changed"><h3>Resumo<\/h3><div class="diff-cols"><div class="diff-col"><p class="diff-label">No guia agora<\/p><p>Pães artesanais\.<\/p><\/div><div class="diff-col is-new"><p class="diff-label">Enviado<\/p><p>Pães e bolos\.<\/p>/);
 assert.match(html,/<p class="diff-label">Item novo<\/p><dl class="panel-dl">[^]*<dt>Preço<\/dt><dd>R\$ 49,90<\/dd>[^]*<dt>Condições<\/dt><dd>Até as 10h\.<\/dd>/);
 assert.match(html,/<figure class="queue-photo"><img src="\/midia\/f2\/800\.webp"[^]*<figcaption>Descrição: Balcão<\/figcaption>/);
 assert.match(html,/<button type="button" class="button" data-aprovar="a1" data-version="1" data-assunto="Texto do perfil" data-perfil="\/comercio\/padaria-exemplo">Aprovar<span class="sr-only">: Texto do perfil de Padaria Exemplo<\/span><\/button><details class="queue-refuse"><summary class="button secondary">Recusar/);
 assert.match(html,/<form class="panel-form" data-form="recusa" data-fila="a1" data-version="1" data-assunto="Texto do perfil" novalidate>[^]*<textarea id="recusa-a1" name="comentario"[^>]* required><\/textarea>[^]*O associado lê este comentário no painel/);
 const dois=views.admin(admin('fila',{dados:{itens:[adminDados.fila.itens[1],{...adminDados.fila.itens[1],id:'a9',enviado:{por:'Maria Souza',em:'2026-10-02T10:05:00-03:00'}}],total:2,pagina:1,paginas:1}}));
 assert.equal(dois.match(/class="queue-dup"/g)?.length,1,'só o segundo envio igual avisa');
 assert.match(dois,/<p class="queue-dup">[^]*Igual a outro envio desta lista \(02\/10\/2026 às 10:00\)\. Aprove um e recuse o outro como repetido\./);
 const alteracao={...adminDados.fila.itens[1],dados:{...adminDados.fila.itens[1].dados,antes:{...adminDados.fila.itens[1].dados,precoCentavos:3990,antes:undefined}}};
 assert.match(views.admin(admin('fila',{dados:{itens:[alteracao],total:1,pagina:1,paginas:1}})),/<tr class="is-changed"><th scope="row">Preço<\/th><td>R\$ 39,90<\/td><td>R\$ 49,90<span class="sr-only"> \(mudou\)<\/span><\/td><\/tr>/);
 const recusado={...adminDados.fila.itens[2],status:'recusado',comentario:'Foto <escura>',decidido:{por:{id:'u',email:'ana@primig.com.br'},em:'2026-10-03T12:00:00Z'}};
 const decidido=views.admin(admin('fila',{filtros:{status:'recusado'},dados:{itens:[recusado],total:1,pagina:1,paginas:1}}));
 assert.match(decidido,/<p class="queue-decided">Recusado por ana@primig\.com\.br em 03\/10\/2026 às 09:00: “Foto &lt;escura&gt;”<\/p>/,'horário de São Paulo');
 assert.doesNotMatch(decidido,/data-aprovar/);
 assert.doesNotMatch(views.admin(admin('fila',{pode:nenhum})),/data-aprovar|data-form="recusa"/,'sem a permissão fila, nada para decidir');
});

test('admin, relatórios: período, bairro e categoria, barras com o número e banners por espaço',()=>{
 const rel=views.admin(admin('relatorios',{filtros:{periodo:'7d',bairro:'Centro'}}));
 assert.match(rel,/<a class="filter-chip" href="\/admin\/relatorios\?periodo=7d&amp;bairro=Centro" aria-current="true">7 dias<\/a><a class="filter-chip" href="\/admin\/relatorios\?bairro=Centro">30 dias<\/a>/);
 assert.match(rel,/Os termos sem resultado não têm empresa: aparecem só sem o filtro de bairro e categoria/);
 const tudo=views.admin(admin('relatorios'));
 assert.match(tudo,/<ul class="channel-list report-bars"><li><span>conserto de celular<\/span>[^]*<strong>12<\/strong>/);
 assert.match(tudo,/<a href="\/admin\/empresas\/padaria-exemplo">Padaria Exemplo<\/a><\/th><td class="num" data-rotulo="Visitas">56<\/td><td class="num" data-rotulo="Buscas">230<\/td>/);
 assert.match(tudo,/<th scope="row">Página inicial: logo depois da abertura<\/th><td class="num" data-rotulo="Impressões">3\.400<\/td><td class="num" data-rotulo="Cliques">41<\/td><td class="num" data-rotulo="Taxa">1,21%<\/td>/);
});

test('admin, usuários, auditoria, mídia e solicitações',()=>{
 const us=views.admin(admin('usuarios'));
 assert.match(us,/<strong>Ana Equipe <small>\(você\)<\/small><\/strong>[^]*<td data-rotulo="Acesso">Equipe · Administração<\/td>/,'ninguém muda o próprio papel');
 assert.doesNotMatch(us,/data-desativar="u-ana"|data-encerrar="u-ana"/);
 assert.match(us,/<a href="\/admin\/empresas\/padaria-exemplo">Padaria Exemplo<\/a> · Dono<\/span><button type="button" class="link-button text-button danger" data-revogar="u-maria" data-empresa="padaria-exemplo">Tirar acesso/);
 assert.match(us,/data-link-senha="u-maria" data-email="maria@padaria-exemplo\.com\.br">Gerar link de senha/);
 assert.match(us,/data-desativar="u-maria" data-version="2" data-valor="true">Desativar/);
 assert.match(us,/<form class="panel-form" data-form="convite" novalidate>[^]*<select id="convite-empresa" name="empresa" required>/);
 assert.match(us,/<form class="panel-form" data-form="equipe" novalidate>[^]*<option value="editor" selected>Edição<\/option>/);
 assert.match(us,/<div class="invite-result" data-link-resultado tabindex="-1" hidden><\/div>/);
 const au=views.admin(admin('auditoria'));
 assert.match(au,/<th scope="row">Perfil alterado<\/th>[^]*<summary>1 campo<\/summary><dl><div><dt>whatsapp<\/dt><dd><span class="audit-before">\(21\) 9999-0000<\/span>[^]*<span class="audit-after">\(21\) 90000-0000<\/span>/);
 const mi=views.admin(admin('midia'));
 assert.match(mi,/<section class="panel-section" id="enviar"[^]*<input type="text" id="midia-alt" name="alt" aria-describedby="dica-midia-alt" maxlength="200" required/);
 assert.match(mi,/<li class="photo-card media-card" id="midia-m1"><img src="\/midia\/m1\/320\.webp"[^]*<form class="media-alt" data-form="alt" data-midia="m1" data-version="1" novalidate>/);
 const so=registro('solicitacoes',adminRegistros.solicitacao);
 assert.match(so,/<h1 id="admin-titulo">Banner para o Dia das Crianças<\/h1>/);
 assert.match(so,/<form class="role-form status-form" data-form="status-solicitacao" data-version="3" novalidate><label for="sol-status" class="sr-only">Situação<\/label><select id="sol-status" name="status" data-papel-atual="aberta"><option value="aberta" selected>Nova: responder<\/option>/);
 assert.match(so,/<article class="message is-associado"><header><strong>Maria Souza<\/strong><time datetime="2026-09-28T10:00:00-03:00">28\/09\/2026 às 10:00<\/time><\/header><p>Quero um banner para os bolos\.<\/p><\/article>/);
 assert.match(so,/<form class="panel-form request-reply" data-form="mensagem" novalidate>/);
 assert.match(views.admin(admin('solicitacoes')),/<td data-rotulo="Situação"><span class="state-tag is-vez">Nova: responder<\/span><\/td>/);
 for(const modulo of Object.keys(adminDados))semInline(views.admin(admin(modulo)));
});

test('admin v0.14.0: cupons com suspender e reativar, e o resumo no recorte de bairro e categoria (14.7 e 13.9 item 13)',()=>{
 const html=views.admin(admin('cupons'));
 assert.match(html,/<a href="\/admin\/cupons" aria-current="page">[^]*<span>Cupons<\/span>/);
 assert.match(html,/<select id="filtro-status" name="status"><option value="">Todas<\/option><option value="ativo">No ar<\/option>[^]*<option value="removido">Fora do site<\/option>/);
 assert.match(html,/<strong><a href="\/cupons\/cp1" target="_blank" rel="noopener">10% no café da manhã[^]*<span>Código CAFE10<\/span>[^]*<td class="num" data-rotulo="Coletas">8 de 50<\/td><td data-rotulo="Situação"><span class="state-tag is-publicado">No ar<\/span>/);
 assert.match(html,/<form class="panel-form" data-form="suspender" data-cupom="cp1" data-version="2" novalidate>[^]*name="motivo"[^]*A empresa lê o motivo no painel/);
 assert.match(html,/<span>Motivo: Condições diferentes das da loja\.<\/span>[^]*<span class="state-tag is-vez">Suspenso<\/span>[^]*data-reativar-cupom="cp7" data-version="4">Reativar/);
 assert.match(html,/href="\/painel\/padaria-exemplo\/cupons">Abrir no painel/);
 assert.doesNotMatch(views.admin(admin('cupons',{pode:nenhum})),/data-form="suspender"|data-reativar-cupom/);
 const resumo=views.admin(admin('resumo'));
 assert.match(resumo,/<form class="admin-filters is-compact" method="get" action="\/admin" role="search"[^]*Filtrar o resumo/,'o filtro recorta o próprio resumo');
 assert.match(resumo,/<a class="stat-card" href="\/admin\/cupons\?status=ativo"><span class="stat-label">Cupons no ar<\/span><strong>7<\/strong><small>58 coletas em 30 dias<\/small><\/a>/);
 const fatia=views.admin(admin('resumo',{filtros:{bairro:'Centro',categoria:'padarias'},dados:{...adminDados.resumo,recorte:{bairro:'Centro',categoria:'padarias'}}}));
 assert.match(fatia,/<h2 id="r-regiao">Recorte: Centro · Padarias<\/h2>/);
 assert.match(fatia,/<option value="Centro" selected>Centro<\/option>[^]*<option value="padarias" selected>Padarias<\/option>/);
 assert.match(fatia,/href="\/admin">Ver o guia todo<\/a>/);
 assert.match(fatia,/href="\/admin\/empresas\?bairro=Centro&amp;categoria=padarias">Empresas deste recorte/);
 assert.match(fatia,/11 espaços livres hoje · no guia todo/,'banners são sempre do guia todo');
 assert.match(fatia,/href="\/admin\/empresas\?status=publicado&amp;bairro=Centro&amp;categoria=padarias"><span class="stat-label">Empresas no guia/);
});

test('admin, acessos ao painel (v0.21.0, contrato 21): o menu, o filtro com a contagem, a situação, os membros e os convites',()=>{
 const html=views.admin(admin('acessos',{filtros:{q:'',situacao:'',page:1}}));
 assert.match(html,/<a href="\/admin\/acessos" aria-current="page"><svg[^]*?<\/svg><span>Acessos ao painel<\/span><\/a>/);
 assert.doesNotMatch(views.admin(admin('resumo',{pode:{...admin().pode,acessos:false}})),/href="\/admin\/acessos"/,'sem a ação acessos, sem o item');
 assert.match(html,/<h1 id="admin-titulo">Acessos ao painel<\/h1><p>Quem de cada empresa já entra no painel do anunciante, e o convite para quem ainda não entra\.<\/p>/);
 assert.match(html,/<nav class="quick-filters admin-tabs" aria-label="Situação de acesso"><a class="filter-chip" href="\/admin\/acessos" aria-current="page">Todas <span class="chip-count">4<\/span><\/a><a class="filter-chip" href="\/admin\/acessos\?situacao=sem-conta">Sem conta <span class="chip-count">1<\/span><\/a>[^]*?situacao=com-acesso">Com acesso <span class="chip-count">1<\/span><\/a><\/nav>/);
 assert.match(html,/<form class="admin-filters" method="get" action="\/admin\/acessos" role="search"[^>]*><div class="form-field filter-q"><label for="filtro-q">Nome da empresa<\/label>/);
 const filtrada=views.admin(admin('acessos',{filtros:{q:'tin',situacao:'sem-conta',page:1}}));
 assert.match(filtrada,/href="\/admin\/acessos\?q=tin&amp;situacao=convite-pendente"/,'o filtro mantém a busca');
 assert.match(filtrada,/<input type="hidden" name="situacao" value="sem-conta">/,'a busca mantém o filtro');
 assert.match(filtrada,/href="\/admin\/acessos\?q=tin&amp;situacao=sem-conta" aria-current="page">Sem conta/);
 // Uma empresa em cada situação.
 const cartao=id=>{const i=html.indexOf(`<li class="access-item" id="acesso-${id}">`);assert.ok(i>=0,id);return html.slice(i,html.indexOf('data-acesso-resultado',i));};
 const sem=cartao('boreal-tintas');
 assert.match(sem,/<h2 class="access-name"><a href="\/admin\/empresas\/boreal-tintas">Boreal Tintas<\/a><\/h2><p class="muted">Publicada · Centro<\/p><\/div><span class="state-tag is-sem-conta">Sem conta<\/span>/);
 assert.match(sem,/<p class="muted access-none">Ninguém desta empresa entra no painel ainda\.<\/p><details class="access-invite"><summary class="button secondary"><svg[^]*?<\/svg>Convidar<span class="sr-only"> para Boreal Tintas<\/span><\/summary><form class="panel-form" data-form="acesso-convite" data-empresa="boreal-tintas" data-nome="Boreal Tintas" novalidate>/);
 assert.match(sem,/name="email"[^>]*value="contato@borealtintas\.test"[^>]*required>[^]*Confira se é o e-mail do anunciante: este é o do perfil da empresa, que às vezes é o de quem fez o cadastro\. O convite dá o acesso ao painel a quem abrir o link\./,'o e-mail do convite sugerido, com o lembrete');
 assert.match(sem,/aria-describedby="dica-convite-boreal-tintas-email"/,'o lembrete ligado ao campo');
 assert.match(sem,/<option value="dono" selected>Dono<\/option>/);
 assert.match(sem,/O link do convite vale 7 dias e funciona uma vez só\./);
 const pendente=cartao('oficina-exemplo');
 assert.match(pendente,/<span class="state-tag is-em-andamento">Convite pendente<\/span>/);
 assert.match(pendente,/<strong>joao@oficina\.test<\/strong><span>Dono · vale até 04\/11\/2026 às 10:00<\/span><\/span><span class="row-actions"><button type="button" class="link-button text-button" data-reenviar-convite="joao@oficina\.test" data-empresa="oficina-exemplo">Reenviar<span class="sr-only"> o convite de joao@oficina\.test para Oficina Exemplo<\/span><\/button><button type="button" class="link-button text-button danger" data-cancelar-convite="joao@oficina\.test" data-empresa="oficina-exemplo">Cancelar/);
 assert.doesNotMatch(pendente,/access-invite/,'convite pendente: reenviar ou cancelar, sem convidar de novo');
 const vencido=cartao('rascunho-exemplo');
 assert.match(vencido,/<p class="muted">Rascunho<\/p><\/div><span class="state-tag is-ajuste">Convite vencido<\/span>/);
 assert.match(vencido,/<strong>ola@rascunho\.test<\/strong><span>Editor · venceu em 20\/10\/2026 às 10:00<\/span><\/span><\/li>/,'o vencido não se reenvia');
 assert.match(vencido,/data-form="acesso-convite" data-empresa="rascunho-exemplo"/);
 const com=cartao('padaria-exemplo');
 assert.match(com,/<span class="state-tag is-publicado">Com acesso<\/span><\/div><div class="access-block"><h3>Quem entra<\/h3><ul class="access-people"><li><span class="person"><strong>Maria Souza<\/strong><span>maria@padaria-exemplo\.com\.br<\/span><\/span><span class="access-role">Dono · desde 24\/09\/2026<\/span><\/li><\/ul><\/div>/);
 assert.match(com,/data-reenviar-convite="financeiro@padaria-exemplo\.com\.br"/,'o convite pendente de outra pessoa também se reenvia');
 assert.doesNotMatch(com,/access-invite/,'com acesso: os acessos continuam em Usuários');
 assert.doesNotMatch(html,/token=|definir-senha/,'a lista nunca traz o link do convite');
 assert.match(html,/<p class="admin-count">4 empresas<\/p>/);
 semInline(page('admin',admin('acessos',{filtros:{q:'',situacao:'',page:1}})));
});

test('admin, acessos ao painel: aberta numa empresa, o operador, quem não tem a ação e o escape',()=>{
 const d=adminDados.acessos,uma={...d,itens:[d.itens[0]],total:1};
 const aberta=views.admin(admin('acessos',{filtros:{q:'',situacao:'',empresa:'boreal-tintas',page:1},dados:uma}));
 assert.match(aberta,/<p class="access-only">Só esta empresa, pelo endereço da ficha\. <a href="\/admin\/acessos">Ver todas as empresas<\/a><\/p>/);
 assert.doesNotMatch(aberta,/admin-tabs|admin-filters|admin-count/,'sem o filtro e a busca');
 assert.match(aberta,/<details class="access-invite" open>/,'o convite já aberto na empresa da ficha');
 assert.doesNotMatch(views.admin(admin('acessos',{filtros:{q:'',situacao:'',page:1}})),/<details class="access-invite" open>/,'na lista toda, fechado');
 assert.match(views.admin(admin('acessos',{filtros:{q:'',situacao:'',empresa:'nao-existe',page:1},dados:{...d,itens:[],total:0}})),/<p class="panel-empty">Essa empresa não está no guia\.<\/p>/);
 // O operador convida, mas não reenvia nem cancela.
 const operador=views.admin(admin('acessos',{equipe:'operador',filtros:{q:'',situacao:'',page:1},dados:{...d,acoes:{convidar:true,reenviar:false,cancelar:false}}}));
 assert.match(operador,/<p class="form-note access-note">Seu papel na equipe convida, mas não reenvia nem cancela convites: isso é com a Administração\.<\/p>/);
 assert.doesNotMatch(operador,/data-reenviar-convite|data-cancelar-convite/);assert.match(operador,/data-form="acesso-convite"/);
 assert.doesNotMatch(views.admin(admin('acessos',{filtros:{q:'',situacao:'',page:1},dados:{...d,acoes:{convidar:false,reenviar:false,cancelar:false}}})),/data-form="acesso-convite"|data-reenviar-convite/,'sem acoes, sem botões');
 // Da equipe sem a ação acessos: 403 com dados null.
 assert.match(views.admin(admin('acessos',{equipe:'editor',pode:{...admin().pode,acessos:false},dados:null})),/<p class="panel-readonly"><svg[^]*?<\/svg><span>Os acessos ao painel são da Administração e da Operação: seu papel na equipe \(Edição\) não abre esta lista\.<\/span><\/p>/);
 // Sem e-mail no perfil, o campo vem vazio e a dica diz isso.
 const semEmail=views.admin(admin('acessos',{filtros:{q:'',situacao:'',page:1},dados:{...d,itens:[{...d.itens[0],convite:{email:'',papel:'dono'}}]}}));
 assert.match(semEmail,/name="email"[^>]*value=""[^]*A empresa não tem e-mail no perfil: escreva o e-mail do anunciante\./);
 const xss='"><img src=x onerror=alert(1)>';
 const escapado=views.admin(admin('acessos',{filtros:{q:'',situacao:'',page:1},dados:{...d,itens:[{...d.itens[1],empresa:{...d.itens[1].empresa,nome:xss},convites:[{...d.itens[1].convites[0],email:xss}]}]}}));
 assert.doesNotMatch(escapado,/<img src=x/);assert.match(escapado,/data-reenviar-convite="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;"/);
});

test('admin v0.22.0 (contrato 22): "Outra categoria…" e "Outra rede…" no formulário da empresa, e o aviso das parecidas na aba Redes',()=>{
 const html=registro('empresas',adminRegistros.empresa);
 assert.match(html,/<details class="category-new" data-categoria-nova><summary class="link-button text-button"><svg[^]*?<\/svg>Outra categoria…<\/summary><div class="category-new-body"><p class="field-hint">Só se nenhuma da lista servir\. Criada, ela vale para todas as empresas, na busca e nos filtros\.<\/p>/);
 assert.match(html,/<input type="text" id="categoria-nova-nome" name="categoriaNova"[^>]*maxlength="60"/);
 assert.match(html,/<select id="categoria-nova-grupo" name="categoriaGrupo"[^>]*><option value="">Escolha o grupo<\/option><option value="alimentacao">Alimentação<\/option><option value="automotivo">Automotivo<\/option>/,'os grupos da lista única');
 assert.match(html,/<button type="button" class="button secondary" data-criar-categoria>Criar a categoria<\/button><\/div><div class="similar-names" data-parecidas tabindex="-1" hidden><\/div><\/div><\/details><\/fieldset>/,'dentro das categorias, com a caixa das parecidas');
 assert.match(html,/<select id="campo-rede" name="rede"[^>]*data-rede-select><option value="">Não faz parte de uma rede<\/option><option value="r-medic">Medic Saúde<\/option><option value="__nova__">Outra rede…<\/option><\/select><p class="field-hint" data-rede-aviso aria-live="polite" hidden><\/p>/,'"Outra rede…" no fim do select');
 assert.match(html,/<div class="full network-new" data-rede-nova hidden>[^]*name="redeNova"[^]*<button type="button" class="button secondary" data-criar-rede>Criar a rede<\/button><\/div><div class="similar-names" data-parecidas tabindex="-1" hidden><\/div><\/div>/);
 // Quem não edita empresas não vê nem cria.
 const leitura=views.admin(admin('empresas',{pode:nenhum,dados:adminRegistros.empresa,filtros:{id:'padaria-exemplo'}}));
 assert.doesNotMatch(leitura,/data-categoria-nova|data-rede-nova|__nova__/);
 // A aba Redes: o formulário ganha a caixa das parecidas, para o "Criar mesmo assim".
 assert.match(views.admin(admin('empresas',{filtros:{aba:'redes',q:'',page:1},dados:{itens:[{id:'r-medic',nome:'Medic Saúde',empresas:3}],total:1,pagina:1,paginas:1}})),/<button type="submit" class="button">Criar rede<\/button><\/div><div class="similar-names" data-parecidas tabindex="-1" hidden><\/div><\/form>/);
 semInline(page('admin',admin('empresas',{dados:adminRegistros.empresa,filtros:{id:'padaria-exemplo'}})));
});

test('admin v0.22.0: a categoria sugerida na fila, com as parecidas, o aprovar e criar, o trocar e o recusar',()=>{
 const html=views.admin(admin('fila',{dados:{itens:[filaCategoria],total:1,pagina:1,paginas:1}}));
 assert.match(html,/<h2 id="fila-titulo-a9">Categoria sugerida · Pizzaria<\/h2>/);
 assert.match(html,/<dl class="panel-dl"><div><dt>Nome sugerido<\/dt><dd>Pizzaria<\/dd><\/div><div><dt>Grupo<\/dt><dd>Alimentação<\/dd><\/div><\/dl><div class="queue-similar"><p class="diff-label">Parecidas na lista<\/p><ul class="similar-list"><li><strong>Padarias<\/strong><small>Alimentação · 3 empresas no guia<\/small><\/li><\/ul><\/div>/);
 assert.doesNotMatch(html,/data-aprovar="a9"/,'sem o aprovar simples');
 assert.match(html,/<div class="queue-actions"><details class="queue-approve"><summary class="button">Aprovar e criar<span class="sr-only">: Categoria sugerida · Pizzaria de Padaria Exemplo<\/span><\/summary><form class="panel-form" data-form="aprovar-categoria" data-fila="a9" data-version="1" data-assunto="Categoria sugerida · Pizzaria" novalidate>/);
 assert.match(html,/<input type="text" id="categoria-a9-nome" name="nome"[^>]*value="Pizzaria"[^>]*maxlength="60" required>/,'o nome editável');
 assert.match(html,/<select id="categoria-a9-grupo" name="grupo"[^>]*><option value="alimentacao" selected>Alimentação<\/option>/,'o grupo do pedido escolhido');
 assert.match(html,/<details class="queue-swap"><summary class="button secondary">Trocar por uma da lista[^]*data-form="trocar-categoria" data-fila="a9" data-version="1"[^]*<select id="troca-a9" name="categoria"[^>]*required><option value="">Escolha a categoria<\/option><optgroup label="Alimentação"><option value="Padarias" selected>Padarias<\/option>/,'a primeira parecida já escolhida');
 assert.match(html,/<details class="queue-refuse"><summary class="button secondary">Recusar<span class="sr-only">: Categoria sugerida · Pizzaria de Padaria Exemplo<\/span>/);
 assert.match(html,/<option value="categoria">Categoria sugerida<\/option>/,'no filtro por tipo');
 const sem=views.admin(admin('fila',{dados:{itens:[{...filaCategoria,dados:{...filaCategoria.dados,parecidas:[]}}],total:1,pagina:1,paginas:1}}));
 assert.match(sem,/<p class="muted queue-similar">Nenhuma categoria parecida na lista\.<\/p>/);assert.match(sem,/<option value="">Escolha a categoria<\/option><optgroup label="Alimentação"><option value="Padarias">Padarias<\/option>/,'sem parecida, nada escolhido');
 const xss='"><img src=x onerror=alert(1)>';
 assert.doesNotMatch(views.admin(admin('fila',{dados:{itens:[{...filaCategoria,dados:{...filaCategoria.dados,nome:xss,parecidas:[{nome:xss,grupos:[{slug:'x',label:xss}],empresas:1}]}}],total:1,pagina:1,paginas:1}})),/<img src=x/);
});
