import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {views,renderPage} from '../../api/views/index.mjs';
import {layout} from '../../api/views/layout.mjs';
import {businessCard,contentCard,anuncio,intercalar} from '../../api/views/componentes.mjs';
import {exemplos,cardEmpresa,cardEmpresaSemDados,cardConteudo,anuncios,peca} from './exemplos.mjs';

// HTML gerado a partir dos dados de exemplo (sem banco). Cada view é uma função pura vm → HTML.
const page=(view,vm=exemplos[view],meta={})=>renderPage({title:'Título',status:200,view,vm},{canonical:'https://guia.test/x',indexable:false,path:'/x',...meta});

test('toda view registrada tem exemplo e respeita a CSP: sem script ou estilo inline nem on*=',()=>{
 assert.deepEqual(Object.keys(views).sort(),Object.keys(exemplos).sort());
 for(const view of Object.keys(views)){
  const html=views[view](exemplos[view]);
  assert.equal(typeof html,'string',view);assert.ok(html.length>50,view);
  assert.doesNotMatch(html,/<script|<style|\sstyle=|\son[a-z]+=/i,view);
 }
 const full=page('home');assert.equal((full.match(/<script/g)||[]).length,2);assert.match(full,/<script src="\/assets\/theme\.js"><\/script>/);assert.match(full,/<script type="module" src="\/assets\/site\.js"><\/script>/);
 assert.throws(()=>renderPage({title:'x',status:200,view:'inexistente',vm:{}},{canonical:'/',indexable:false,path:'/'}),/View desconhecida/);
});

test('layout: tema claro padrão, ids congelados, meta de busca e escape do título',()=>{
 const html=layout({title:'Padaria <b> & "Cia"',canonical:'https://guia.test/a?b=<c>',indexable:false,path:'/busca'},'<p>corpo</p>');
 assert.match(html,/<html lang="pt-BR" data-theme="light">/);assert.match(html,/<script src="\/assets\/theme\.js"><\/script><link rel="stylesheet"/);assert.match(html,/data-theme-toggle/);
 assert.match(html,/class="logo-claro"/);assert.match(html,/class="logo-escuro"/);
 for(const id of ['menu-toggle','main-nav','consent','consent-yes','consent-no','privacy-settings'])assert.match(html,new RegExp(`id="${id}"`),id);
 assert.match(html,/<title>Padaria &lt;b&gt; &amp; &quot;Cia&quot;<\/title>/);assert.match(html,/<link rel="canonical" href="https:\/\/guia\.test\/a\?b=&lt;c&gt;">/);
 assert.match(html,/<meta name="robots" content="noindex,nofollow">/);assert.match(html,/<a href="\/busca" aria-current="page">Guia de Negócios<\/a>/);
 assert.match(html,/<meta name="description" content="Encontre empresas e serviços locais no Guia PRIMIG\.">/);
 const indexed=layout({title:'x',description:'d'.repeat(300),canonical:'/',indexable:true,path:'/'},'');
 assert.match(indexed,/<meta name="robots" content="index,follow">/);assert.match(indexed,new RegExp(`content="${'d'.repeat(170)}"`));
});

test('CSS do tema: claro por variáveis --lt-*, sem as fontes descartadas',async()=>{
 const css=await readFile(new URL('../../p2/style.css',import.meta.url),'utf8');
 assert.match(css,/html\[data-theme="light"\] body\{--lt-soft:#f5f7fa/);assert.doesNotMatch(css,/Geist/);
});

test('CSS do cabeçalho: o fundo de ponta a ponta não cria rolagem lateral',async()=>{
 // Com width:100vw, o ::before contava a barra de rolagem e a página passava uns 8 px para o lado em todas as telas.
 const css=await readFile(new URL('../../p2/style.css',import.meta.url),'utf8');
 const regras=[...css.matchAll(/[^{}]*\.reference-header::before\{([^}]*)\}/g)].map(m=>m[1]);
 assert.ok(regras.length>=2,'a regra do tema escuro e a do claro');
 for(const r of regras){assert.doesNotMatch(r,/width:100vw|translateX/);assert.doesNotMatch(r,/background:/,'o degradê vai no border-image');}
 assert.match(regras[0],/left:0;right:0;border-image:linear-gradient\([^)]*\)[^;]*fill 0\/0\/0 100vw/);
});

test('CSS das abas do admin: a faixa de módulos rola com a barra fina à mostra e o esmaecido nas bordas',async()=>{
 // Até 1050 px, a faixa passava da largura e cortava os últimos módulos, sem barra de rolagem nenhuma.
 const css=(await readFile(new URL('../../p2/style.css',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
 const bloco=[...css.matchAll(/@media\(max-width:1050px\)\{\n((?: [^\n]*\n)+)\}/g)].map(m=>m[1]).find(b=>b.includes('.admin .nav-groups{position:relative;overflow-x:auto'));
 assert.ok(bloco,'o bloco das abas, até 1050 px');
 assert.match(bloco,/\.admin \.nav-groups\{position:relative;overflow-x:auto;[^}]*scrollbar-width:thin;scrollbar-color:var\(--pal-line-strong\) transparent\}/);
 assert.match(bloco,/\.admin \.nav-groups::-webkit-scrollbar\{height:6px\}/);assert.doesNotMatch(bloco,/scrollbar-width:none|display:none/);
 assert.match(bloco,/\.admin \.panel-nav::before\{left:0;background:linear-gradient\(to right,var\(--pal-panel\)/);
 assert.match(bloco,/\.admin \.panel-nav::after\{right:0;background:linear-gradient\(to left,var\(--pal-panel\)/);
 assert.match(bloco,/\.admin \.panel-nav\.tem-antes::before,\.admin \.panel-nav\.tem-depois::after\{opacity:1\}/);
 assert.match(bloco,/\.admin \.nav-groups\{position:relative;/,'o texto do leitor de tela fica preso à faixa, sem rolagem lateral na página');
 // A barra de salvar com o par rascunho e publicar: no celular, os dois botões lado a lado, da mesma altura.
 assert.match(css,/@media\(max-width:600px\)\{\n {2}\.admin-form>\.admin-save:has\(>\[data-depois\]\)\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:stretch;gap:8px\}/);
});

test('cards: escape, fallbacks e data-atributos usados pelo site.js',()=>{
 const card=businessCard(cardEmpresa);
 assert.match(card,/Padaria &lt;Exemplo&gt; &amp; Cia/);assert.doesNotMatch(card,/<Exemplo>/);assert.match(card,/data-favorite="padaria-exemplo"/);assert.match(card,/<img class="" src="https:\/\/www\.primigdivulgacao/);
 const empty=businessCard(cardEmpresaSemDados);
 assert.doesNotMatch(empty,/<img/);assert.match(empty,/Negócio local/);assert.match(empty,/Bairro não informado · Nova Iguaçu/);
 assert.match(contentCard({...exemplos.conteudos.items[0],category:'',author:''}),/<p class="eyebrow">Artigos<\/p>[^]*Equipe PRIMIG/);
});

test('home: mapa, filtros de categoria e anúncios da PRIMIG entre os cards',()=>{
 const html=views.home(exemplos.home);
 assert.match(html,/<figure class="future-map baixada-map" data-map data-quadro="150 130\.4 1000 869\.6" data-area="1300 1130"/);
 for(const zoom of ['in','out','reset'])assert.match(html,new RegExp(`data-map-zoom="${zoom}"`));
 assert.match(html,/2 empresas no mapa/);assert.match(html,/1 sem endereço no acervo/);assert.match(html,/class="map-point is-approx"/);assert.match(html,/<text x="756" y="907" class="is-guia">Centro<\/text>/);
 assert.equal((html.match(/class="business-card"/g)||[]).length,6,'5 destaques e 1 card de coleção');assert.doesNotMatch(html,/side-service/);assert.doesNotMatch(html,/from=search/);assert.match(html,/class="more-tile" href="\/busca" data-resto4="3" data-resto2="1"><strong>Ver as 43 empresas do guia/);
 assert.doesNotMatch(html,/id="explorar"|chip-list/);assert.match(html,/<datalist id="bairros-guia"><option value="Centro"><option value="Posse"><\/datalist>/);assert.ok(html.indexOf('id="empresas"')<html.indexOf('id="sobre"'));
 assert.match(html,/class="bairros-band commercial-band"[^]*PARA EMPRESAS[^]*href="\/para-empresas"/);assert.doesNotMatch(html,/class="service-ad"/);
 const filtered=views.home({...exemplos.home,category:'alimentacao',selectedCount:1});
 assert.doesNotMatch(filtered,/class="more-tile/);assert.match(filtered,/<a href="\/\?category=alimentacao#empresas" aria-current="true">Alimentação<\/a>/);assert.match(filtered,/1 empresa encontrada nesta categoria/);
 const direct=views.home({...exemplos.home,category:'padarias',directCategory:'Padarias'});assert.match(direct,/<option value="padarias" selected>Padarias<\/option>/);
});

test('busca e favoritos: filtros dependentes, contagem e ids da lista salva',()=>{
 const html=views.busca(exemplos.busca);
 assert.match(html,/data-search-results="13"/);assert.match(html,/13 empresas encontradas/);assert.match(html,/<option value="oficinas" data-districts="Centro\|Posse" >Oficinas<\/option>/);
 assert.match(html,/<option data-categories="oficinas\|padarias" >Centro<\/option>/);assert.match(html,/<nav class="pagination"/);assert.match(html,/href="\/busca\?q=p%C3%A3o&amp;district=|href="\/busca\?q=p%C3%A3o&district=/);
 assert.match(views.busca({...exemplos.busca,district:'Posse'}),/<option data-categories="oficinas" selected>Posse<\/option>/);
 const saved=views.busca({...exemplos.busca,favorites:true});
 assert.match(saved,/id="saved-grid"/);assert.match(saved,/id="saved-empty" hidden/);assert.doesNotMatch(saved,/data-search-results|<form class="search"|class="pagination"/);
 assert.match(views.busca({...exemplos.busca,total:0,pages:1,results:[]}),/Não encontramos esse resultado/);
});

test('perfil da empresa: botões medidos, catálogo com preço e fallbacks',()=>{
 const html=views.empresa(exemplos.empresa);
 assert.match(html,/data-profile="padaria-exemplo"/);
 for(const channel of ['whatsapp','phone','map','website'])assert.match(html,new RegExp(`data-contact="${channel}" data-business="padaria-exemplo"`),channel);
 assert.match(html,/R\$\s18,90/);assert.match(html,/Sob consulta/);assert.match(html,/2 itens/);assert.match(html,/Ligar <span class="phone-number">\(21\) 3000-0000<\/span><\/a>/);assert.match(html,/class="contact-bar" role="group"[^]*data-contact="whatsapp"[^]*data-contact="phone"[^]*data-contact="map"/);assert.doesNotMatch(html,/nesta versão/);assert.match(html,/Padarias · Cafés/);
 const bare=views.empresa({...exemplos.empresa,categories:[],socials:[],whatsappUrl:'',phoneUrl:'',address:'',mapUrl:'',directionsUrl:'',week:[],reviews:[],reviewsCount:0,rating:null,hours:'',website:'',catalog:[],photos:[],image:'',wazeUrl:'',referencia:'',pagamentos:[],moradores:{media:null,total:0,itens:[]},avaliar:null});
 assert.doesNotMatch(bare,/data-contact=/);assert.match(bare,/Endereço não informado/);assert.match(bare,/Consulte a empresa/);assert.doesNotMatch(bare,/id="catalogo"|id="fotos"|href="#catalogo"|href="#fotos"|Avaliações|class="contact-bar"/);assert.match(bare,/NEGÓCIO LOCAL/);
});

test('conteúdo: lista paginada e leitura com texto escapado',()=>{
 const list=views.conteudos(exemplos.conteudos);assert.match(list,/<h1>Artigos<\/h1>/);assert.match(list,/href="\/artigos\?q=&page=2">2<\/a>/);
 assert.match(views.conteudos({...exemplos.conteudos,items:[]}),/Nenhuma publicação encontrada/);
 const read=views.conteudo({...exemplos.conteudo,bodyHtml:''});
 assert.match(read,/&lt;b&gt;marcação&lt;\/b&gt;/);assert.doesNotMatch(read,/<b>marcação/);assert.match(read,/Equipe PRIMIG · 20\/09\/2026/);assert.match(read,/Consultar publicação de origem/);
 assert.match(views.conteudo({...exemplos.conteudo,date:'',sourceUrl:''}),/Data não informada/);
});

test('formulários: interesse escolhido, erros visíveis e escape do que foi digitado',()=>{
 const signup=views.cadastro(exemplos.cadastro);assert.match(signup,/method="post" action="\/cadastro"/);assert.match(signup,/<input type="radio" name="plano" value="plano-avancado" required checked data-trecho="no Plano Avançado \(R\$ 67,00\/mês\)">/);
 const invalid=views.cadastro({...exemplos.cadastro,values:{ramo:'<script>x</script>'},errors:['Tente de novo.']});
 assert.match(invalid,/role="alert"/);assert.doesNotMatch(invalid,/<script>x/);assert.doesNotMatch(invalid,/ checked/);
 const contact=views.contato(exemplos.contato);assert.match(contact,/action="\/institucional\/contato"/);assert.match(contact,/\(21\) 90000-0000 ↗/);
 const plans=views['para-empresas'](exemplos['para-empresas']);
 assert.match(plans,/href="\/cadastro\?interesse=plano-personalizado#signup-title">Quero um plano personalizado/);assert.match(plans,/href="\/cadastro\?interesse=banner-quadrado#signup-title">Quero este espaço/);assert.match(plans,/<h3>Personalizado<\/h3><p class="pricing-price"><strong>A combinar<\/strong><\/p>/);
});

// Fase 1: compartilhamento, formulários com LGPD e erro por campo, institucionais pelo key e subtítulos das listas.
test('layout: Open Graph e Twitter Card a partir da rota, com a imagem padrão quando não há outra',()=>{
 const meta=(html,key)=>(html.match(new RegExp('<meta (?:property|name)="'+key+'" content="([^"]*)">'))||[])[1];
 const padrao=layout({title:'Boreal Tintas · loja de tintas em Santa Rita | Guia PRIMIG',description:'Tintas & acabamentos',canonical:'https://guia.test/comercio/boreal-tintas',indexable:true,path:'/comercio/boreal-tintas'},'');
 assert.match(padrao,/<title>Boreal Tintas · loja de tintas em Santa Rita \| Guia PRIMIG<\/title>/);
 assert.equal(meta(padrao,'og:title'),'Boreal Tintas · loja de tintas em Santa Rita | Guia PRIMIG');assert.equal(meta(padrao,'og:description'),'Tintas &amp; acabamentos');
 assert.equal(meta(padrao,'og:url'),'https://guia.test/comercio/boreal-tintas');assert.equal(meta(padrao,'og:type'),'website');assert.equal(meta(padrao,'og:locale'),'pt_BR');
 assert.equal(meta(padrao,'og:image'),'https://guia.test/assets/og-padrao.png');assert.equal(meta(padrao,'og:image:width'),'1200');assert.equal(meta(padrao,'og:image:height'),'630');
 assert.equal(meta(padrao,'twitter:card'),'summary_large_image');assert.equal(meta(padrao,'twitter:image'),'https://guia.test/assets/og-padrao.png');
 const propria=renderPage({title:'Feira no Centro | Guia PRIMIG',description:'d',status:200,view:'conteudo',vm:exemplos.conteudo,ogImage:'https://www.primigdivulgacao.com.br/x.png'},{canonical:'https://guia.test/artigos/feira',indexable:true,path:'/noticias/feira'});
 assert.equal(meta(propria,'og:image'),'https://www.primigdivulgacao.com.br/x.png');assert.equal(meta(propria,'og:type'),'article');assert.equal(meta(propria,'og:image:alt'),'Feira no Centro | Guia PRIMIG');assert.equal(meta(propria,'og:image:width'),undefined);
});

test('formulários: aviso de finalidade, aceite opcional de novidades e erro marcado no campo',()=>{
 for(const [view,vm] of [['cadastro',exemplos.cadastro],['contato',exemplos.contato]]){
  const html=views[view](vm);
  assert.match(html,/<input type="checkbox" value="sim" id="campo-novidades" name="novidades"><span>Quero receber novidades da PRIMIG pelo WhatsApp\.<\/span>/,view);
  assert.match(html,/class="form-note">Seus dados servem só para o Leandro[^<]*<a href="\/institucional\/privacidade">Privacidade<\/a>/,view);
  assert.ok(html.indexOf('class="form-note"')<html.indexOf('<button type="submit"'),view);
  assert.match(views[view]({...vm,values:{novidades:'sim'}}),/name="novidades" checked>/,view);
 }
 const invalid=views.cadastro({...exemplos.cadastro,values:{},errors:[{campo:'ramo',mensagem:'Escolha o ramo do seu negócio.'},{campo:'plano',mensagem:'Escolha um plano, ou peça ajuda para escolher.'},{campo:'',mensagem:'Tente de novo.'}]});
 assert.match(invalid,/<li><a href="#campo-ramo">Escolha o ramo do seu negócio\.<\/a><\/li>/);assert.match(invalid,/<li>Tente de novo\.<\/li>/);
 assert.match(invalid,/<li class="quiz-step has-error" data-pergunta="ramo"[^>]*><fieldset id="campo-ramo" tabindex="-1" aria-invalid="true" aria-describedby="erro-ramo"><legend>[^]*?<\/legend><p class="field-error" id="erro-ramo">Escolha o ramo do seu negócio\.<\/p>/);
 assert.match(invalid,/<fieldset id="campo-plano" tabindex="-1" aria-invalid="true" aria-describedby="erro-plano">/);
 assert.doesNotMatch(invalid,/<fieldset id="campo-local"[^>]*aria-invalid/);
 const contato=views.contato({...exemplos.contato,errors:[{campo:'mensagem',mensagem:'Escreva a mensagem (de 5 a 800 caracteres).'}]});
 assert.match(contato,/<textarea id="campo-mensagem" name="mensagem" aria-invalid="true" aria-describedby="erro-mensagem"/);
});

// v0.16.0 (contrato 17): cadastro só com escolhas. A mensagem sai do mesmo módulo na view, na prévia e no servidor.
test('cadastro por escolhas: caixas de opção sem campo de texto, na ordem do contrato, com o trecho de cada opção',()=>{
 const html=views.cadastro(exemplos.cadastro);
 assert.doesNotMatch(html,/<textarea|<select|type="text"|type="tel"|<input (?![^>]*type="(?:radio|checkbox)")/);
 assert.deepEqual([...html.matchAll(/data-pergunta="([a-z]+)"/g)].map(m=>m[1]),['ramo','local','tempo','canais','objetivos','plano','banner','horario']);
 assert.match(html,/<li class="quiz-step" data-pergunta="ramo" data-tipo="uma" data-bloco="1" data-frase="Meu negócio é \{\}\." data-obrigatoria><fieldset id="campo-ramo" tabindex="-1"><legend><span class="quiz-num">1 de 8<\/span><span class="quiz-q">Qual é o ramo do seu negócio\?<\/span><span class="quiz-dica">Obrigatória · escolha uma<\/span><\/legend>/);
 assert.match(html,/<label class="quiz-chip"><input type="radio" name="ramo" value="alimentacao" required data-trecho="do ramo de alimentação"><span class="quiz-chip-rotulo">Alimentação<\/span><\/label>/);
 assert.match(html,/<input type="radio" name="local" value="so-online" data-frase="Ele funciona só pela internet\.">/);
 assert.match(html,/<li class="quiz-step" data-pergunta="canais" data-tipo="varias" data-bloco="1" data-frase="Hoje os clientes me encontram \{\}\."><fieldset[^>]*><legend>[^]*?<span class="quiz-dica">Opcional · escolha quantas quiser<\/span>/);
 assert.match(html,/<input type="checkbox" name="canais" value="instagram" data-trecho="pelo Instagram">/);
 assert.match(html,/<input type="radio" name="banner" value="nao" data-frase="">/);
 assert.match(html,/<span class="quiz-chip-rotulo">Super Banner<\/span><small>728 × 90 · R\$ 99,00\/mês<\/small>/);
 assert.match(html,/<form class="signup-quiz" method="post" action="\/cadastro" accept-charset="UTF-8" data-quiz data-abertura="Olá, Leandro! Tenho interesse em me tornar afiliado à PRIMIG\." data-novidades="Quero receber novidades da PRIMIG pelo WhatsApp\.">/);
 assert.match(html,/<p class="quiz-message" data-mensagem>Olá, Leandro! Tenho interesse em me tornar afiliado à PRIMIG\.\n\nTenho interesse no Plano Avançado \(R\$ 67,00\/mês\)\.<\/p>/);
 assert.match(views.cadastro({...exemplos.cadastro,values:{}}),/<p class="quiz-message" data-mensagem data-vazia>Olá, Leandro!/);
 assert.match(views.cadastro({...exemplos.cadastro,values:{canais:['google','instagram']}}),/name="canais" value="instagram" checked[^]*name="canais" value="google" checked/);
 assert.doesNotMatch(html,/style=|<script|on[a-z]+=/);
});

test('cadastro por escolhas: a mensagem junta as respostas por bloco, na ordem das opções, com frases próprias',async()=>{
 const {mensagemDoCadastro,juntar}=await import('../../p2/cadastro-mensagem.js');
 const vm=exemplos.cadastro;
 assert.equal(juntar([]),'');assert.equal(juntar(['a']),'a');assert.equal(juntar(['a','b']),'a e b');assert.equal(juntar(['a','b','c']),'a, b e c');
 const texto=mensagemDoCadastro(vm,{ramo:'alimentacao',local:'nova-iguacu',tempo:'1-a-5',canais:['indicacao','instagram','instagram'],objetivos:['mais-clientes','google','promocoes'],plano:'plano-premium',banner:'banner-super-banner',horario:'tarde',novidades:'sim'},'guia.test');
 assert.equal(texto,['Olá, Leandro! Tenho interesse em me tornar afiliado à PRIMIG.',
  'Meu negócio é do ramo de alimentação. Ele fica em Nova Iguaçu. Ele existe há 1 a 5 anos. Hoje os clientes me encontram pelo Instagram e por indicação. Quero mais clientes no WhatsApp, aparecer no Google e divulgar promoções e cupons.',
  'Tenho interesse no Plano Premium (R$ 350,00/mês). Também quero o banner Super Banner, 728 × 90 (R$ 99,00/mês).',
  'Prefiro conversar à tarde. Quero receber novidades da PRIMIG pelo WhatsApp.',
  'Enviado pelo site guia.test'].join('\n\n'));
 assert.equal(mensagemDoCadastro(vm,{ramo:'outro',local:'so-online',tempo:'vai-abrir',plano:'conhecer',banner:'nao',horario:'qualquer'},'guia.test'),['Olá, Leandro! Tenho interesse em me tornar afiliado à PRIMIG.',
  'Meu negócio é de um ramo que não está na lista. Ele funciona só pela internet. Ainda vou abrir o negócio.',
  'Quero ajuda para escolher o melhor plano.',
  'Posso conversar em qualquer horário.',
  'Enviado pelo site guia.test'].join('\n\n'));
 assert.equal(mensagemDoCadastro(vm,{ramo:'valor-inventado',canais:[]}),'Olá, Leandro! Tenho interesse em me tornar afiliado à PRIMIG.');
});

test('institucionais pelo key e subtítulo próprio em cada lista de conteúdo',()=>{
 const privacidade=views.institucional({title:'Privacidade',key:'privacidade'});
 assert.match(privacidade,/<h1>Privacidade<\/h1>/);assert.match(privacidade,/Novidades pelo WhatsApp/);assert.doesNotMatch(privacidade,/Ambiente local|em revisão/);
 assert.match(views.institucional({title:'Termos de uso',key:'termos'}),/<h1>Termos de uso<\/h1>/);assert.match(views.institucional({title:'Perguntas frequentes',key:'faq'}),/Como salvo uma empresa\?/);
 const intro=section=>views.conteudos({...exemplos.conteudos,section}).match(/<h1>[^<]*<\/h1><p>([^<]*)<\/p>/)[1];
 assert.match(intro('classificados'),/anunciados na região/);assert.notEqual(intro('classificados'),intro('artigos'));
});

// Fase 2 (contrato da seção 10): vitrine com horário, avaliações, filtros, home do PDF1, leitura rica, ofertas e eventos.
const card2={...cardEmpresa,whatsappUrl:'https://wa.me/5521900000000?text=Ol%C3%A1',openNow:false,closesAt:'',opensAt:'8h',opensDay:'amanhã',rating:4.8,reviewsCount:12,sponsored:false};
test('horário, nota e patrocinado: só o que o vm diz',()=>{
 const fechado=businessCard(card2);
 assert.match(fechado,/class="hours-badge is-closed"[^]*Fechado · abre amanhã às 8h/);assert.match(fechado,/<strong>4,8<\/strong><span class="rating-count">· 12 avaliações<\/span>/);
 assert.match(fechado,/class="card-whatsapp is-whatsapp" href="https:\/\/wa\.me\/5521900000000\?text=Ol%C3%A1"/);assert.doesNotMatch(fechado,/Patrocinado/);
 assert.match(businessCard({...card2,openNow:true,closesAt:'18h'}),/Aberto agora · fecha às 18h/);
 assert.match(businessCard({...card2,openNow:null,holiday:'Tiradentes'}),/Feriado \(Tiradentes\) · horário: consulte/);
 assert.match(businessCard({...card2,openNow:null,holiday:''}),/Horário: consulte/);
 assert.match(businessCard({...card2,sponsored:true}),/<span class="card-selo">Patrocinado<\/span>/);
 const {slug,name,image,category,district,city,summary}=cardEmpresa;assert.doesNotMatch(businessCard({slug,name,image,category,district,city,summary}),/hours-badge|class="rating"|card-whatsapp|Patrocinado/);
});

test('perfil: avaliações com média e origem, semana, rota, unidades, e-mail e vídeo',()=>{
 const vm={...exemplos.empresa,openNow:true,closesAt:'18h',opensAt:'',opensDay:'',holiday:'',week:[{day:'segunda-feira',label:'7h às 19h',today:true},{day:'domingo',label:'Fechado',today:false}],rating:4.5,reviewsCount:2,reviewsSource:'portal PRIMIG',
  reviews:[{author:'Maria <S>',date:'12/08/2026',rating:5,title:'Ótimo',text:'Atendimento excelente.'},{author:'João',date:'',rating:4,title:'',text:'Bom.'}],
  units:[{slug:'padaria-exemplo-posse',name:'Padaria Exemplo Posse',district:'Posse'}],email:'contato@exemplo.com.br',videoUrl:'https://www.youtube.com/watch?v=x',features:['Estacionamento','Entrega'],sponsored:false,plan:null,
  directionsUrl:'https://www.google.com/maps/dir/?api=1&destination=-22.7,-43.4'};
 const html=views.empresa(vm);
 assert.match(html,/<section id="avaliacoes"[^]*<strong class="reviews-avg">4,5<\/strong>[^]*2 avaliações publicadas no portal PRIMIG/);
 assert.match(html,/Maria &lt;S&gt;/);assert.match(html,/<p class="review-title">Ótimo<\/p>/);assert.match(html,/href="#avaliacoes">Avaliações<\/a>/);
 assert.match(html,/<tr class="is-today"><th scope="row">segunda-feira <span class="today-tag">hoje<\/span><\/th><td>7h às 19h<\/td><\/tr>/);
 assert.match(html,/data-contact="map" data-business="padaria-exemplo" href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=-22\.7,-43\.4"[^>]*>Como chegar/);
 assert.match(html,/class="contact-bar"[^]*data-contact="map"[^>]*href="https:\/\/www\.google\.com\/maps\/dir\//);
 assert.match(html,/<h2>Outras unidades<\/h2>[^]*href="\/comercio\/padaria-exemplo-posse">Padaria Exemplo Posse<\/a><span>Posse<\/span>/);
 assert.match(html,/href="mailto:contato@exemplo\.com\.br"/);assert.match(html,/href="https:\/\/www\.youtube\.com\/watch\?v=x" target="_blank" rel="noopener noreferrer">Assistir ao vídeo/);assert.doesNotMatch(html,/<iframe/);
 assert.match(html,/<li>Estacionamento<\/li><li>Entrega<\/li>/);
 const sem=views.empresa({...exemplos.empresa,rating:null,reviewsCount:0,reviews:[],units:[],directionsUrl:'',mapUrl:''});
 assert.doesNotMatch(sem,/id="avaliacoes"|Outras unidades|data-contact="map"/);
});

test('busca: chips com contagem mantêm os outros filtros; vazia mostra sugestões',()=>{
 const html=views.busca({...exemplos.busca,results:[card2],total:1,pages:1,filters:{aberto:true,whatsapp:false,avaliacoes:false},counts:{aberto:1,whatsapp:5,avaliacoes:0}});
 assert.match(html,/<a class="filter-chip" href="\/busca\?q=p%C3%A3o&amp;district=&amp;category=&amp;location=&amp;sort=name" aria-current="true">[^]*Aberto agora <span class="chip-count">1<\/span>/);
 assert.match(html,/<a class="filter-chip" href="\/busca\?q=p%C3%A3o&amp;district=&amp;category=&amp;location=&amp;sort=name&amp;aberto=1&amp;whatsapp=1">Com WhatsApp <span class="chip-count">5<\/span><\/a>/);
 assert.match(html,/<span class="filter-chip is-empty" aria-disabled="true">Com avaliações <span class="chip-count">0<\/span><\/span>/);
 assert.match(html,/<input type="hidden" name="aberto" value="1">/);assert.match(html,/sort=recent&amp;aberto=1/);
 const vazia=views.busca({...exemplos.busca,results:[],total:0,pages:1,filters:{},counts:{aberto:0,whatsapp:0,avaliacoes:0},suggestions:{categorias:[{slug:'pets',label:'Pets',count:2}],bairros:[{name:'Santa Rita',count:11}]}});
 assert.match(vazia,/Experimente uma categoria[^]*href="\/busca\?category=pets">Pets <span>2<\/span>/);assert.match(vazia,/Ou um bairro próximo[^]*href="\/busca\?district=Santa\+Rita">Santa Rita <span>11<\/span>/);
});

test('home na ordem do PDF1, sem bloco vazio',()=>{
 const oferta={id:'o1',name:'Café para dois',description:'Pães e café.',conditions:'Até as 10h.',validUntil:'31/10/2026',businessSlug:'padaria-exemplo',businessName:'Padaria Exemplo',image:'',priceLabel:'R$ 19,90'};
 const vm={...exemplos.home,districts:[{name:'Centro',count:3},{name:'Posse',count:1}],categorias:[{slug:'alimentacao',label:'Alimentação',count:9,subcategorias:[]}],
  collections:[{slug:'familia',title:'Vai reunir a família?',subtitle:'Buffets e padarias.',href:'/busca?category=alimentacao',businesses:[cardEmpresa,cardEmpresa]}],
  offers:[oferta],ads:{}};
 const html=views.home(vm);
 const ordem=['class="reference-hero"','id="empresas"','id="colecao-familia"','id="ofertas-title"','Artigos relevantes','commercial-band'].map(s=>html.indexOf(s));
 assert.ok(ordem.every((p,i)=>p>=0&&(i===0||p>ordem[i-1])),String(ordem));
 assert.match(html,/<datalist id="bairros-guia"><option value="Centro"><option value="Posse"><\/datalist>/);assert.match(html,/<a href="\/\?category=alimentacao#empresas" >Alimentação<\/a>/);
 assert.match(html,/Válida até 31\/10/);assert.match(html,/<p class="offer-price">R\$ 19,90<\/p>/);assert.doesNotMatch(html,/class="vitrine-slot/,'ads vazio: nenhum espaço');
 assert.equal((html.match(/class="news-card"/g)||[]).length,vm.articles.length);assert.doesNotMatch(html,/Notícias|href="\/noticias/,'a seção de notícias saiu do site');
 const vazia=views.home({...exemplos.home,ads:{},collections:[],offers:[]});
 assert.doesNotMatch(vazia,/collection|ofertas-title|Notícias da cidade|class="vitrine-slot/);assert.match(vazia,/Artigos relevantes/);
});

test('leitura rica, editorias, classificado, ofertas e eventos',()=>{
 const body='<h2>Quem pode doar</h2><ul><li>Um</li></ul><table><thead><tr><th>Dia</th></tr></thead><tbody><tr><td>Seg</td></tr></tbody></table><blockquote><p>Citação</p></blockquote>';
 const read=views.conteudo({...exemplos.conteudo,bodyHtml:body,editoria:{slug:'saude',label:'Saúde'},readingMinutes:3,gallery:[{src:'https://www.primigdivulgacao.com.br/a.png',alt:'Doação'}]});
 assert.match(read,/<div class="reading-body"><h2>Quem pode doar<\/h2><ul><li>Um<\/li><\/ul><table>/);assert.doesNotMatch(read,/Primeiro parágrafo/);
 assert.match(read,/<p class="eyebrow"><a href="\/artigos\?editoria=saude">Saúde<\/a><\/p>/);assert.match(read,/3 min de leitura/);assert.match(read,/class="reading-gallery"[^]*alt="Doação"/);
 assert.match(views.conteudo({...exemplos.conteudo,bodyHtml:''}),/<div class="reading-body"><p>Primeiro parágrafo com &lt;b&gt;marcação/);assert.match(views.conteudo(exemplos.conteudo),/class="reading-tags"[^]*href="\/artigos\?editoria=baixada-fluminense">Baixada Fluminense<\/a>/);
 const muitas=views.conteudos({...exemplos.conteudos,editorias:[{slug:'unica',label:'Única',count:1},{slug:'cidade',label:'Cidade',count:4},{slug:'saude',label:'Saúde',count:9}]});
 assert.doesNotMatch(muitas,/editoria=unica/);assert.ok(muitas.indexOf('editoria=saude')<muitas.indexOf('editoria=cidade'),'maior contagem primeiro');
 const lista=views.conteudos({...exemplos.conteudos,editorias:[{slug:'cidade',label:'Cidade',count:4},{slug:'saude',label:'Saúde',count:2}],editoria:'saude'});
 assert.match(lista,/href="\/artigos\?q=&amp;editoria=saude" aria-current="true">Saúde <span class="chip-count">2<\/span>/);assert.match(lista,/<input type="hidden" name="editoria" value="saude">/);assert.match(lista,/editoria=saude&page=2/);
 const classificado=views.conteudo({...exemplos.conteudo,section:'classificados',label:'Classificados locais',price:'R$ 199,00',phone:'(21) 3000-0000',phoneUrl:'tel:2130000000',whatsappUrl:'https://wa.me/5521900000000',business:{slug:'padaria-exemplo',name:'Padaria Exemplo'}});
 assert.match(classificado,/class="classified-box"[^]*<strong>R\$ 199,00<\/strong>[^]*Conversar no WhatsApp[^]*href="tel:2130000000">Ligar <span class="phone-number">\(21\) 3000-0000<\/span>[^]*href="\/comercio\/padaria-exemplo">Padaria Exemplo/);
 assert.match(views.ofertas({items:[{id:'o1',name:'Café',description:'',conditions:'Até as 10h.',validUntil:'15/10/2026',businessSlug:'padaria-exemplo',businessName:'Padaria Exemplo',image:'',priceLabel:'Sob consulta'}]}),/class="offer-card"[^]*Até as 10h\.[^]*Válida até 15\/10/);
 const eventos=views.eventos({items:[{slug:'feira',title:'Feira <de> artesanato',date:'12/10/2026',endDate:'13/10/2026',time:'9h',place:'Praça',address:'Centro',description:'',image:'',href:'https://exemplo.com.br/feira',business:null}]});
 assert.match(eventos,/12\/10\/2026 a 13\/10\/2026 · 9h/);assert.match(eventos,/Feira &lt;de&gt; artesanato/);assert.match(eventos,/Praça · Centro/);
 assert.match(views.eventos({items:[{slug:'f',title:'F',date:'',description:'Texto <corrido>',descriptionHtml:'<p>Com <strong>HTML</strong></p>',business:null}]}),/<div class="event-description"><p>Com <strong>HTML<\/strong><\/p><\/div>/,'descriptionHtml sai sem escape (13.9, item 10)');
 assert.match(views.eventos({items:[{slug:'f',title:'F',date:'',description:'Texto <corrido>',business:null}]}),/<p>Texto &lt;corrido&gt;<\/p>/,'sem o campo, o texto escapado');
 assert.match(views.eventos({items:[]}),/ainda não foi publicada/);assert.match(views.eventos({}),/ainda não foi publicada/);
});

test('menu: Ofertas e Eventos só com conteúdo',()=>{
 const sem=layout({title:'x',canonical:'https://guia.test/',path:'/'},'');assert.doesNotMatch(sem,/href="\/ofertas"|href="\/eventos"/);
 const com=renderPage({title:'x',description:'d',status:200,view:'sobre',vm:{}},{canonical:'https://guia.test/',indexable:false,path:'/ofertas',menu:{ofertas:true,eventos:true}});
 assert.match(com,/<a href="\/ofertas" aria-current="page">Ofertas<\/a>/);assert.match(com,/<a href="\/eventos" >Eventos<\/a>/);
});

test('Parte A: espaço de anúncio com moldura, rótulo, formato do celular e anúncio da PRIMIG no espaço vazio',()=>{
 const topo=anuncio(anuncios.home['home-topo']);
 assert.match(topo,/^<aside class="vitrine-slot vitrine-faixa" aria-label="Vitrine" data-vitrine="home-topo">/);
 assert.match(topo,/<a class="vitrine-piece is-faixa m-link" data-campaign="banner-padaria" data-placement="home-topo" href="\/comercio\/padaria-exemplo" rel="sponsored noopener noreferrer">/);
 assert.match(topo,/<span class="vitrine-tag"><span>Publicidade<span class="vitrine-by"> · Padaria Exemplo<\/span><\/span><\/span>/);
 assert.match(topo,/<source media="\(max-width: 700px\)" srcset="https:\/\/www\.primigdivulgacao[^"]*"><img src="[^"]*" alt="Padaria Exemplo: café da manhã completo" width="728" height="90" loading="lazy"/);
 // Destino fora do site abre outra aba e avisa; a 2ª peça começa escondida e o rodízio tem controles e a posição.
 assert.match(topo,/data-campaign="banner-oficina" data-placement="home-topo" href="https:\/\/exemplo\.com\.br\/" rel="sponsored noopener noreferrer" target="_blank" hidden>[^]*<span aria-hidden="true">↗<\/span>[^]*abre em outra aba/);
 assert.match(topo,/<div class="vitrine-controls"><button type="button" class="secondary" data-rotate="previous" aria-label="Anúncio anterior">[^]*data-rotate="toggle" aria-label="Pausar rodízio" aria-pressed="false">[^]*data-rotate="next"[^]*<span class="vitrine-count">1 de 2<\/span>/);
 assert.match(anuncio(anuncios.busca['busca-topo'],{eager:true}),/loading="eager"/);
 // Anúncio da PRIMIG: medido como os outros, com o formato e o preço do espaço e o link para o cadastro com o interesse.
 const vazio=anuncio(anuncios.home['home-comercial']);
 assert.match(vazio,/<a class="vitrine-piece is-faixa m-link vitrine-house" data-campaign="primig-super-banner" data-placement="home-comercial" href="\/cadastro\?interesse=banner-super-banner">/);
 assert.match(vazio,/Publicidade<span class="vitrine-by"> · PRIMIG[^]*<strong>Este espaço pode ser seu<\/strong><span class="vitrine-house-meta"><span>Super Banner<\/span> · <span>728 × 90<\/span> · <span>R\$ 99,00\/mês<\/span>/);
 assert.doesNotMatch(vazio,/<img|vitrine-controls/);
 // Peça sem formato de celular: some no celular (e o espaço, quando nenhuma peça aparece lá); celular false também tira o espaço.
 const lateral=anuncio(anuncios.busca['busca-lateral'],{variant:'lateral'});
 assert.match(lateral,/class="vitrine-slot vitrine-lateral sem-celular"/);assert.match(lateral,/class="vitrine-piece is-meia sem-celular"/);assert.match(lateral,/width="300" height="600"/);
 const misto=anuncio({...anuncios.home['home-destaques'],banners:[peca('a','ar-livre','A'),peca('b','ar-livre','B',{imageMobile:'https://www.primigdivulgacao.com.br/b.png'})]});
 assert.match(misto,/class="vitrine-slot vitrine-faixa"/);assert.match(misto,/class="vitrine-piece is-painel sem-celular" data-campaign="a"/);assert.match(misto,/class="vitrine-piece is-painel m-quadrado" data-campaign="b"/);
 assert.match(anuncio({...anuncios.home['home-topo'],celular:false}),/class="vitrine-slot vitrine-faixa sem-celular"/);
 assert.equal(anuncio(undefined),'');assert.equal(anuncio({...anuncios.home['home-grade'],banners:[]}),'','espaço sem banner e sem anúncio da PRIMIG some');
 for(const html of [topo,vazio,lateral,misto])assert.doesNotMatch(html,/style=|\son\w+=|<script/);
});

test('Parte A: espaços nas páginas, na ordem do contrato, e só onde há anúncio',()=>{
 // Home: topo depois da abertura, card depois do 6º destaque, destaques antes das coleções, comercial antes da área comercial.
 const vm={...exemplos.home,businesses:Array(8).fill(cardEmpresa),ads:anuncios.home};
 const home=views.home(vm);
 const ordem=['class="reference-hero"','data-vitrine="home-topo"','id="empresas"','data-vitrine="home-grade"','data-vitrine="home-destaques"','id="colecao-familia"','id="ofertas-title"','Artigos relevantes','data-vitrine="home-comercial"','commercial-band'].map(x=>home.indexOf(x));
 assert.ok(ordem.every((p,i)=>p>=0&&(i===0||p>ordem[i-1])),String(ordem));
 const grade=home.slice(home.indexOf('class="business-grid'),home.indexOf('class="more-tile'));
 assert.equal(grade.split('data-vitrine="home-grade"')[0].split('class="business-card"').length-1,6);
 assert.match(home,/class="more-tile" href="\/busca" data-resto4="3" data-resto2="1"/,'o card do anúncio conta na última linha da grade');
 assert.doesNotMatch(views.home({...exemplos.home,ads:anuncios.home}),/data-vitrine="home-grade"/,'com 6 destaques ou menos o card ficaria no fim');
 assert.doesNotMatch(views.home({...exemplos.home,ads:{}}),/vitrine-slot/);
 // Busca: topo, uma linha a cada 6 resultados (nunca depois do último, alternando os banners), lateral e busca vazia.
 const treze=Array(13).fill(cardEmpresa),busca=views.busca({...exemplos.busca,results:treze,total:13,ads:anuncios.busca});
 assert.equal((busca.match(/data-vitrine="busca-meio"/g)||[]).length,2);assert.ok(busca.indexOf('data-campaign="banner-farmacia"')<busca.indexOf('data-campaign="banner-pet"'));
 assert.match(busca,/<aside class="vitrine-slot vitrine-linha" aria-label="Vitrine" data-vitrine="busca-meio">/);
 assert.equal((views.busca({...exemplos.busca,results:Array(12).fill(cardEmpresa),ads:anuncios.busca}).match(/data-vitrine="busca-meio"/g)||[]).length,1);
 assert.match(busca,/<\/section>(<aside class="vitrine-slot vitrine-faixa"[^>]*data-vitrine="busca-topo">)[^]*<div class="vitrine-rail-layout"><div class="vitrine-rail-main"><section class="results"[^]*<div class="vitrine-rail"><aside class="vitrine-slot vitrine-lateral sem-celular"[^>]*data-vitrine="busca-lateral">/);
 assert.doesNotMatch(busca,/busca-vazia/);
 const nada=views.busca({...exemplos.busca,results:[],total:0,pages:0,ads:{'busca-vazia':anuncios.busca['busca-vazia']}});
 assert.match(nada,/<div class="empty" ?>[^]*<\/div><aside class="vitrine-slot vitrine-faixa"[^>]*data-vitrine="busca-vazia">/);
 assert.doesNotMatch(views.busca({...exemplos.busca,favorites:true,ads:anuncios.busca}),/vitrine-slot/,'favoritos não têm anúncio');
 // Listas: topo e um card a cada 6 itens.
 const lista=views.conteudos({...exemplos.conteudos,items:Array(12).fill(cardConteudo),ads:anuncios.conteudos});
 assert.match(lista,/<\/section><aside class="vitrine-slot vitrine-faixa"[^>]*data-vitrine="lista-topo">/);assert.equal((lista.match(/data-vitrine="lista-meio"/g)||[]).length,1);
 assert.equal(lista.split('data-vitrine="lista-meio"')[0].split('class="news-card"').length-1,6);
 // Leitura: depois do 3º parágrafo de primeiro nível (os da citação não contam), no fim antes de "Mais em" e na lateral.
 const corpo='<p>Um.</p><blockquote><p>Citação.</p></blockquote><p>Dois.</p><ul><li>Item</li></ul><p>Três.</p><p>Quatro.</p>';
 const leitura=views.conteudo({...exemplos.conteudo,bodyHtml:corpo,ads:anuncios.conteudo});
 assert.match(leitura,/<div class="reading-body"><p>Um\.<\/p><blockquote><p>Citação\.<\/p><\/blockquote><p>Dois\.<\/p><ul><li>Item<\/li><\/ul><p>Três\.<\/p><\/div><aside class="vitrine-slot vitrine-texto"[^>]*data-vitrine="leitura-texto">[^]*<\/aside><div class="reading-body"><p>Quatro\.<\/p><\/div>/);
 assert.ok(leitura.indexOf('data-vitrine="leitura-fim"')<leitura.indexOf('class="reading-tags"'));
 assert.match(leitura,/^<div class="vitrine-rail-layout"><div class="vitrine-rail-main"><article class="reading">[^]*<div class="vitrine-rail"><aside[^>]*data-vitrine="leitura-lateral">/);
 const curta=views.conteudo({...exemplos.conteudo,bodyHtml:'<p>Só um.</p>',ads:{'leitura-texto':anuncios.conteudo['leitura-texto']}});
 assert.match(curta,/<div class="reading-body"><p>Só um\.<\/p><\/div><aside class="vitrine-slot vitrine-texto"/);
 // Perfil, ofertas e eventos.
 assert.match(views.empresa({...exemplos.empresa,ads:anuncios.empresa}),/<\/section><section class="info-card units-card">[^]*<\/section><aside class="vitrine-slot vitrine-lateral"[^>]*data-vitrine="perfil-lateral">[^]*<\/aside><\/aside>/);
 assert.match(views.ofertas({...exemplos.ofertas,ads:anuncios.ofertas}),/<\/section><aside class="vitrine-slot vitrine-faixa"[^>]*data-vitrine="ofertas-topo">/);
 assert.match(views.eventos({...exemplos.eventos,ads:anuncios.eventos}),/<\/section><aside class="vitrine-slot vitrine-faixa"[^>]*data-vitrine="eventos-topo">/);
 // Páginas sem anúncio (contrato 11.2) não desenham ads mesmo se o vm trouxer.
 for(const v of ['cadastro','contato','institucional','sobre','para-empresas','nao-encontrada','indisponivel'])assert.doesNotMatch(views[v]({...exemplos[v],ads:anuncios.home}),/vitrine-slot/,v);
 // intercalar: depois de cada 6, nunca depois do último.
 assert.deepEqual(intercalar(['a','b'],{aCada:1,banners:[],house:null}),['a','b']);
 assert.equal(intercalar([1,2,3,4,5,6,7],{...anuncios.busca['busca-meio']}).length,8);
});

test('cupons com publicidade: topo, um card a cada N cupons e a lateral do cupom; sem ads, nada',async()=>{
 const x=await import('./exemplos.mjs');
 const esp=(id,pc,cel,extra={})=>({id,formatos:{computador:pc,celular:cel},banners:[],house:x.casa(pc[0]),celular:cel.length>0,aCada:0,...extra});
 const items=Array.from({length:8},(_,i)=>({...x.cupomCard,id:`c${i}`,href:`/cupons/c${i}`}));
 const lista=views.cupons({...x.exemplos.cupons,items,ads:{'cupons-topo':esp('cupons-topo',['super-banner'],['link-patrocinado']),'cupons-meio':esp('cupons-meio',['quadrado'],['quadrado'],{aCada:6})}});
 assert.ok(lista.indexOf('data-vitrine="cupons-topo"')<lista.indexOf('class="coupon-grid"'),'o topo vem antes da grade');
 assert.equal(lista.split('data-vitrine="cupons-meio"')[0].split('class="coupon-card').length-1,6,'o card de anúncio entra depois do 6º cupom');
 assert.match(views.cupom({...x.exemplos.cupom,ads:{'cupom-lateral':esp('cupom-lateral',['meia-pagina'],[])}}),/<div class="vitrine-rail-layout">[^]*data-vitrine="cupom-lateral"/);
 assert.doesNotMatch(views.cupons(x.exemplos.cupons)+views.cupom(x.exemplos.cupom),/class="vitrine-slot/);
});

test('Sobre nós: trajetória em 3 etapas alternadas, ligadas por linha tracejada, e o menu leva a ela', () => {
 const html=views.sobre(exemplos.sobre);
 assert.match(html,/<ol class="trajetoria" aria-label="Trajetória do Leandro até a PRIMIG">/);
 assert.deepEqual([...html.matchAll(/<li class="trajetoria-passo (is-\w+)">/g)].map(m=>m[1]),['is-esquerda','is-direita','is-esquerda']);
 assert.equal(html.match(/<svg class="trajetoria-liga"/g).length,2);
 assert.equal(html.match(/class="trajetoria-haste"/g).length,2);
 assert.match(html,/<path class="liga-larga" d="M20\.83 0 C20\.83 55 79\.17 45 79\.17 100" vector-effect="non-scaling-stroke"\/>/);
 assert.match(html,/<a class="button secondary" href="\/institucional\/contato">Fale com a PRIMIG<\/a>/);
 assert.doesNotMatch(html,/style=|<script|<style/);
 const pagina=renderPage({title:'Sobre',description:'d',status:200,view:'sobre',vm:{}},{canonical:'https://guia.test/institucional/sobre',indexable:false,path:'/institucional/sobre',menu:{}});
 assert.match(pagina,/<a href="\/institucional\/sobre" aria-current="page">Sobre nós<\/a><\/div>/);
 assert.doesNotMatch(pagina,/<a href="\/institucional\/contato" [^>]*>Contato<\/a><\/div>/);
 assert.match(pagina,/<a href="\/institucional\/sobre">Sobre nós<\/a><a href="\/institucional\/contato">Contato<\/a>/);
});

// v0.17.1: atalhos numa faixa só, com título e setas; card com as ações numa linha; Bairros fora do menu e do rodapé.
test('ajustes 0.17.1: atalhos com título e setas, WhatsApp do card com ícone e sem Bairros no menu e no rodapé',()=>{
 const home=views.home(exemplos.home);
 if(home.includes('data-atalhos')){
  assert.match(home,/<section class="category-shortcuts" aria-labelledby="atalhos-titulo" data-atalhos><div class="shortcuts-head"><h2 id="atalhos-titulo">Explore por categoria<\/h2><div class="shortcuts-arrows"><button type="button" class="shortcuts-arrow" data-atalhos-ir="-1" aria-label="Categorias anteriores" hidden>/);
  assert.match(home,/<ul class="shortcuts-track" data-atalhos-trilha><li><a href="\/busca\?category=[a-z-]+" data-atalho="[a-z-]+"><svg class="shortcut-icon"[^]*?<span class="shortcut-text"><span class="shortcut-label">/);
 }
 assert.match(businessCard(cardEmpresa),/<a class="card-whatsapp is-whatsapp" [^>]*><svg class="wa-icone"[^]*?<span class="wa-texto">WhatsApp<\/span><span class="sr-only"> de [^<]+<\/span><span class="wa-seta" aria-hidden="true">↗<\/span><\/a>/);
 const pagina=renderPage({title:'x',description:'d',status:200,view:'sobre',vm:{}},{canonical:'https://guia.test/',indexable:false,path:'/',menu:{},rodapeBairros:{titulo:'Bairros com mais empresas',itens:[{slug:'centro',name:'Centro'}]}});
 assert.doesNotMatch(pagina,/href="\/bairros|footer-districts|Bairros com mais empresas/);
});

test('cadastro v0.23.0 (23.4): o interesse de origem num campo escondido, sem texto novo na tela',()=>{
 const com=views.cadastro({...exemplos.cadastro,origem:'plano-premium'});
 assert.match(com,/data-novidades="[^"]*"><input type="hidden" name="interesse" value="plano-premium"><div class="quiz-layout">/);
 assert.doesNotMatch(views.cadastro({...exemplos.cadastro,origem:''}),/name="interesse"/,'sem origem, sem o campo');
 assert.doesNotMatch(views.cadastro(exemplos.cadastro),/name="interesse"/);
 assert.doesNotMatch(com,/Pedido [A-Z0-9]{4}|código do pedido|guardad/i,'a prévia não mostra o código, nem fala da guarda');
 assert.match(views.cadastro({...exemplos.cadastro,origem:'"><b>x'}),/name="interesse" value="&quot;&gt;&lt;b&gt;x">/);
});
