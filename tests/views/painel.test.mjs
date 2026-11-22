import {test} from 'node:test';
import assert from 'node:assert/strict';
import {views,renderPage} from '../../api/views/index.mjs';
import {exemplos,painel,painelDados,cardEmpresa,minhaAssinatura,sugestaoCategoria} from './exemplos.mjs';

// Fase 3 (contrato 12): telas de conta e painel, a partir dos vms de exemplo. O servidor confere permissão de verdade; aqui se
// confere que a tela mostra como editável só o que vm.pode libera e que nada sai sem escape.
const page=(view,vm)=>renderPage({title:'Título | Guia PRIMIG',status:200,view,vm},{canonical:'https://guia.test/x',indexable:false,path:'/x'});
const semInline=html=>{assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)|<style|\sstyle=|\son[a-z]+=/i);};

test('entrar: só associado e equipe, campos rotulados, next escapado e aviso de sessão',()=>{
 const html=views.entrar({next:'/painel/a"b',motivo:''});
 assert.match(html,/<form class="account-form" data-conta="entrar" novalidate>/);
 assert.match(html,/<label for="campo-email">E-mail<\/label><input type="email" id="campo-email" name="email" autocomplete="username"/);
 assert.match(html,/<label for="campo-senha">Senha<\/label><div class="password-field"><input type="password" id="campo-senha" name="senha" autocomplete="current-password" maxlength="128" required><button type="button" class="reveal secondary" data-revelar aria-pressed="false">Mostrar<\/button>/);
 assert.match(html,/<input type="hidden" name="next" value="\/painel\/a&quot;b">/);
 assert.match(html,/href="\/entrar\/recuperar">Esqueci minha senha/);assert.match(html,/<noscript>/);
 assert.doesNotMatch(html,/consumidor|account-flash/i,'o consumidor só chega na Fase 8');
 assert.match(views.entrar({next:'',motivo:'expirou'}),/<p class="account-flash" role="status">Sua sessão terminou por falta de uso/);
 assert.match(views.entrar({next:'',motivo:'saiu'}),/Você saiu da sua conta\./);
 const pagina=page('entrar',exemplos.entrar);assert.match(pagina,/<script type="module" src="\/assets\/conta\.js"><\/script><\/head>/);semInline(pagina);
});

test('recuperar e definir a senha: confirmação escondida, convite, recuperação e link vencido',()=>{
 const rec=views.recuperar({});
 assert.match(rec,/data-conta="recuperar"/);assert.match(rec,/<div class="account-done" data-conta-feito tabindex="-1" hidden><h2>Confira seu e-mail<\/h2>/);
 const convite=views['definir-senha']({token:'t<1>',tipo:'convite',valido:true,email:'a<b>@x.test'});
 assert.match(convite,/<h2>Crie sua senha<\/h2><p>Seu acesso ao painel do Guia PRIMIG está pronto\. Crie a senha da conta <strong>a&lt;b&gt;@x\.test<\/strong>\./);
 assert.match(views['definir-senha']({token:'x',tipo:'convite',valido:true,email:'m@x.test',empresa:'Padaria <X>',convidadoPor:'Maria'}),/para cuidar de <strong>Padaria &lt;X&gt;<\/strong>, está pronto \(convite de Maria\)/);
 assert.match(views.entrar({}),/^<section class="account-page"><div class="account-intro"><h1>Área do afiliado<\/h1>[^]*<\/div><div class="account-card">[^]*<\/div><div class="account-more"><ul class="account-perks">/,'no celular o formulário vem logo depois do título');
 assert.match(convite,/<input type="hidden" name="token" value="t&lt;1&gt;">/);
 assert.match(convite,/autocomplete="new-password"[^]*De 12 a 128 caracteres[^]*id="campo-confirmar"/);
 assert.match(views['definir-senha']({token:'x',tipo:'recuperacao',valido:true,email:'m@x.test'}),/<h2>Defina uma nova senha<\/h2>[^]*as outras sessões abertas desta conta são encerradas/);
 const vencido=views['definir-senha']({token:'',tipo:'',valido:false,email:''});
 assert.match(vencido,/Este link não vale mais/);assert.match(vencido,/href="\/entrar\/recuperar">Pedir um link novo/);assert.doesNotMatch(vencido,/<form/);
 for(const html of [rec,convite,vencido])semInline(html);
});

test('painel: seletor de empresa, módulos, "em breve", atalhos e CSRF no data-atributo',()=>{
 const html=views.painel(painel('resumo'));
 assert.match(html,/^<div class="panel" data-painel data-csrf="csrf-exemplo-0123456789abcdef0123" data-empresa="padaria-exemplo">/);
 assert.match(html,/<details class="company-switch"><summary><span class="company-current">Padaria &lt;Exemplo&gt;<\/span>/);
 assert.match(html,/<li><a href="\/painel\/padaria-exemplo" aria-current="true"><span>Padaria &lt;Exemplo&gt;<\/span><small>Dono<\/small><\/a><\/li><li><a href="\/painel\/oficina-exemplo"><span>Oficina Exemplo<\/span><small>Editor<\/small>/);
 assert.match(html,/<span class="company-status is-live">Publicada no guia<\/span><a href="\/comercio\/padaria-exemplo" target="_blank" rel="noopener">Ver página pública/);
 assert.match(html,/<a href="\/painel\/padaria-exemplo" aria-current="page">[^]*<span>Resumo<\/span>/);
 for(const [m,l] of [['perfil','Minha empresa'],['catalogo','Produtos e serviços'],['resultados','Resultados'],['relatorio','Relatório do mês'],['solicitacoes','Solicitações e suporte'],['acessos','Acessos']])assert.match(html,new RegExp(`<a href="/painel/padaria-exemplo/${m}">[^]*?<span>${l}</span>`));
 for(const l of ['Conteúdo','Canais','Plano','CONECTA'])assert.match(html,new RegExp(`<li class="is-soon" aria-disabled="true"><svg[^]*?<span>${l}</span><small>em breve</small></li>`));
 assert.match(html,/<a class="button" href="\/painel\/padaria-exemplo\/catalogo\?novo=oferta#novo-item">[^]*Criar meu anúncio<\/a><a class="button secondary" href="\/painel\/padaria-exemplo\/solicitacoes\?nova=criacao#nova-solicitacao">Solicitar criação à PRIMIG<\/a>/);
 assert.match(html,/<button type="button" class="panel-logout secondary" data-sair>/);
 // Quem só lê não vê Acessos nem os atalhos de criar; na outra empresa, a troca mantém o módulo comum.
 const leitor=views.painel(painel('resumo',{papel:'leitura',pode:{perfil:false,catalogo:false,plano:false,solicitar:false,acessos:false}}));
 assert.doesNotMatch(leitor,/\/acessos"|Criar meu anúncio|Solicitar criação/);
 assert.match(views.painel(painel('perfil')),/<a href="\/painel\/oficina-exemplo\/perfil">/);
 assert.match(views.painel(painel('acessos')),/<a href="\/painel\/oficina-exemplo"><span>Oficina Exemplo/,'acessos depende do papel: a troca leva ao resumo');
 const pagina=page('painel',painel('resumo'));assert.match(pagina,/<script type="module" src="\/assets\/painel\.js"><\/script>/);
 assert.match(pagina,/<a class="button nav-cta" href="\/comercio\/padaria-exemplo">Ver minha página<\/a>/);assert.doesNotMatch(pagina,/>Anuncie aqui</,'quem já anuncia não vê o convite para anunciar');
 assert.match(page('painel',painel('empresas',{empresa:null,dados:null})),/<a class="button nav-cta" href="\/">Ir para o guia<\/a>/);
 assert.match(html,/<\/nav><p class="panel-soon-note">Em breve no painel: Conteúdo, Canais, Plano e CONECTA\.<\/p>/);
 assert.match(html,/<p class="sr-only" data-painel-anuncio aria-live="polite"><\/p>/);
 assert.doesNotMatch(page('home',exemplos.home),/painel\.js|conta\.js/);assert.match(pagina,/<a href="\/entrar\?tipo=afiliado">Área do afiliado<\/a>/);
});

test('painel, resumo: as 4 perguntas, o que depende de mim primeiro, como a empresa aparece e o que foi contratado',()=>{
 const html=views.painel(painel('resumo'));
 const perguntas=[...html.matchAll(/<h2 id="q-[a-z]+">([^<]+?)(?: <span class="count-tag">\d+<\/span>)?<\/h2>/g)].map(m=>m[1]);
 assert.deepEqual(perguntas,['O que depende de mim?','Como minha empresa aparece?','O que a PRIMIG está fazendo?','O que contratei?'],'a pergunta que pede ação vem primeiro');
 assert.match(html,/<section class="panel-block block-depende has-items" aria-labelledby="q-depende"><h2 id="q-depende">O que depende de mim\? <span class="count-tag">3<\/span><\/h2>/);
 assert.match(html,/<strong>56<\/strong> visitas ao perfil <span class="trend">\+12 em relação aos 30 dias anteriores<\/span> e <strong>230<\/strong> aparições em buscas nos últimos 30 dias/);
 assert.match(html,/<h3>Perfil preenchido: 4 de 6<\/h3>/);assert.match(html,/<rect class="fill" width="67" height="6"\/>/);
 assert.match(html,/O que falta está em “O que depende de mim\?”/);assert.doesNotMatch(html,/class="checklist"/,'o que falta preencher fica só nas pendências');
 assert.match(html,/<a href="\/comercio\/padaria-exemplo" target="_blank" rel="noopener">Ver página pública/);
 const semExtras=views.painel(painel('resumo',{dados:{...painelDados.resumo,aparece:{...painelDados.resumo.aparece,card:null,visitas30Antes:undefined,buscas30Antes:undefined}}}));
 assert.doesNotMatch(semExtras,/appearance-preview|em relação aos 30 dias anteriores/,'sem card (empresa não publicada) e sem o período anterior, nada é inventado');
 const completo=views.painel(painel('resumo',{dados:{...painelDados.resumo,aparece:{...painelDados.resumo.aparece,card:cardEmpresa,visitas30Antes:44}}}));
 assert.match(completo,/<div class="appearance-preview" inert><article class="business-card">[^]*Padaria &lt;Exemplo&gt; &amp; Cia/);
 assert.match(completo,/<strong>56<\/strong> visitas ao perfil <span class="trend">\+12 em relação aos 30 dias anteriores<\/span>/);
 assert.match(html,/class="whatsapp-link" href="https:\/\/wa\.me\/5521982155579\?text=Ol%C3%A1%2C\+Leandro%21" target="_blank" rel="noopener">Falar com o Leandro no WhatsApp/,'o link vem de suporte.whatsappUrl');
 assert.match(views.painel(painel('resumo',{suporte:undefined})),/class="whatsapp-link" href="https:\/\/wa\.me\/5521982155579\?text=Ol%C3%A1%2C\+Leandro%21\+Sou\+da\+Padaria\+%3CExemplo%3E/,'sem o campo, o número da PRIMIG com a mensagem');
 assert.match(html,/Dúvidas sobre o plano\? Fale com o Leandro no WhatsApp/);
 assert.match(html,/<a href="\/painel\/padaria-exemplo\/catalogo#item-i2">&quot;Café da manhã para dois&quot; voltou da aprovação/);
 assert.match(html,/<span>Encomenda de bolos<\/span><small>Item do catálogo · desde 01\/10\/2026<\/small>/);
 assert.match(html,/<span>Padaria Exemplo: café da manhã<\/span><small>Topo da página inicial · até 31\/10\/2026<\/small>/);
 assert.match(html,/O plano desta empresa ainda não está no painel/);
 const comPlano=views.painel(painel('resumo',{dados:{...painelDados.resumo,contratado:{plano:'Premium',banners:[],assinatura:null}}}));
 assert.match(comPlano,/<h2 id="q-contratado">O que contratei\?<\/h2><dl class="panel-dl"><div><dt>Plano<\/dt><dd>Premium<\/dd><\/div><\/dl>/,'sem a assinatura da gestão, continua o "O que contratei?"');
 assert.match(views.painel(painel('resumo',{dados:{...painelDados.resumo,contratado:null}})),/Só o dono e o financeiro da empresa veem o que foi contratado/);
 assert.match(views.painel(painel('resumo',{dados:{...painelDados.resumo,depende:[]}})),/Nada pendente agora/);
 semInline(html);
});

test('painel, resumo: a "Minha assinatura" da gestão no lugar do "O que contratei?", com a situação, os pagamentos e como pagar',()=>{
 const resumo=a=>views.painel(painel('resumo',{dados:{...painelDados.resumo,contratado:{plano:{id:'basico',nome:'Básico'},banners:[],assinatura:a}}}));
 const html=resumo(minhaAssinatura);
 const perguntas=[...html.matchAll(/<h2 id="q-[a-z]+">([^<]+?)(?: <span class="count-tag">\d+<\/span>)?<\/h2>/g)].map(m=>m[1]);
 assert.deepEqual(perguntas,['O que depende de mim?','Como minha empresa aparece?','O que a PRIMIG está fazendo?','Minha assinatura']);
 assert.doesNotMatch(html,/O que contratei/);
 assert.match(html,/<section class="panel-block block-assinatura" aria-labelledby="q-contratado"><h2 id="q-contratado">Minha assinatura<\/h2><dl class="panel-dl"><div><dt>Plano<\/dt><dd>Básico<\/dd><\/div><div><dt>Valor<\/dt><dd>R\$ 67,00 por mês<\/dd><\/div><div><dt>Vencimento<\/dt><dd class="subscription-due"><span class="state-tag is-em-dia">Em dia<\/span><span>26\/11\/2026<\/span><\/dd><\/div><\/dl>/);
 assert.match(html,/<h3>Últimos pagamentos<\/h3><ul class="plain-list"><li><span>R\$ 67,00 · Pix<\/span><small>pago em 26\/10\/2026 · de 26\/10\/2026 a 25\/11\/2026<\/small><\/li><li><span>R\$ 67,00 · Transferência<\/span>/);
 assert.match(html,/<h3>Como pagar<\/h3><div class="pix-key"><p><span class="panel-label">Chave Pix<\/span><code>pix@primig\.test<\/code><\/p><button type="button" class="secondary" data-copiar-pix="pix@primig\.test"><svg[^]*<\/svg><span>Copiar a chave<\/span><\/button><\/div>/);
 assert.match(html,/<a class="whatsapp-link" href="https:\/\/wa\.me\/5521900000000\?text=Ol%C3%A1%21\+Sou\+da\+Padaria\+%3CExemplo%3E\+e\+quero\+falar\+sobre\+a\+minha\+assinatura\+do\+Guia\+PRIMIG\." target="_blank" rel="noopener">Falar com o atendimento no WhatsApp, \(21\) 90000-0000 <span aria-hidden="true">↗<\/span>/);
 assert.match(html,/<p class="panel-note">Atualizado pela PRIMIG em 26\/10\/2026 às 15:38\.<\/p><\/section>/,'a hora de São Paulo');
 assert.doesNotMatch(html,/subscription-ask/,'em dia: nada a pedir');
 // A situação, como o site calcula (19.6), e o que fazer em cada uma.
 const vencida=resumo({...minhaAssinatura,venceEm:'2026-10-20',dias:-6,situacao:'vencida'});
 assert.match(vencida,/<section class="panel-block block-assinatura is-late"[^]*<span class="state-tag is-vencida">Venceu há 6 dias<\/span><span>20\/10\/2026<\/span>[^]*<p class="panel-sentence subscription-ask">O pagamento está atrasado\. Faça o Pix e mande o comprovante pelo WhatsApp do atendimento\.<\/p>/);
 assert.match(resumo({...minhaAssinatura,dias:1,situacao:'a-vencer'}),/<span class="state-tag is-a-vencer">Vence amanhã<\/span>[^]*O vencimento está perto\./);
 assert.doesNotMatch(resumo({...minhaAssinatura,dias:20,situacao:'a-vencer'}),/subscription-ask/,'a vencer, mas longe: sem pedido');
 assert.match(resumo({...minhaAssinatura,dias:0,situacao:'a-vencer'}),/Vence hoje/);
 assert.match(resumo({...minhaAssinatura,situacao:'suspensa'}),/<span class="state-tag is-suspensa">Suspensa<\/span>[^]*A assinatura está suspensa\. Fale com o atendimento para voltar\./);
 // Sem pagamento, sem chave e sem WhatsApp: a seção diz isso e cai no WhatsApp do Leandro.
 const sem=resumo({...minhaAssinatura,ultimosPagamentos:[],comoPagar:{chavePix:'',whatsapp:''}});
 assert.match(sem,/<h3>Últimos pagamentos<\/h3><p class="panel-empty">Nenhum pagamento registrado ainda\.<\/p>/);
 assert.match(sem,/<p class="panel-empty">A PRIMIG ainda não informou a chave Pix\. Fale com o atendimento\.<\/p><p class="panel-links"><a class="whatsapp-link"[^>]*>Dúvidas sobre a assinatura\? Fale com o Leandro no WhatsApp/);
 assert.doesNotMatch(sem,/data-copiar-pix/);
 // O link do Leandro: o número do suporte.whatsappUrl, com a mensagem da assinatura (não a geral do painel).
 assert.match(sem,/<a class="whatsapp-link" href="https:\/\/wa\.me\/5521982155579\?text=Ol%C3%A1%2C\+Leandro%21\+Sou\+da\+Padaria\+%3CExemplo%3E\+e\+quero\+falar\+sobre\+a\+minha\+assinatura\+do\+Guia\+PRIMIG\." target="_blank" rel="noopener">Dúvidas sobre a assinatura\? Fale com o Leandro no WhatsApp <span aria-hidden="true">↗<\/span>/);
 const semSuporte=views.painel(painel('resumo',{suporte:undefined,dados:{...painelDados.resumo,contratado:{plano:null,banners:[],assinatura:{...minhaAssinatura,comoPagar:{chavePix:'',whatsapp:''}}}}}));
 assert.match(semSuporte,/href="https:\/\/wa\.me\/5521982155579\?text=Ol%C3%A1%2C\+Leandro%21\+Sou\+da\+Padaria\+%3CExemplo%3E\+e\+quero\+falar\+sobre\+a\+minha\+assinatura/,'sem o suporte no vm, o número da PRIMIG');
 assert.doesNotMatch(sem.slice(sem.indexOf('block-assinatura')),/Preciso de ajuda com o painel|uso o painel do Guia PRIMIG/,'nada da mensagem geral na seção');
 const xss='"><img src=x onerror=alert(1)>';
 const escapado=resumo({...minhaAssinatura,plano:{id:'x',nome:xss},comoPagar:{chavePix:xss,whatsapp:'5521900000000'}});
 assert.doesNotMatch(escapado,/<img src=x/);assert.match(escapado,/<dd>&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;<\/dd>/);
 semInline(page('painel',painel('resumo',{dados:{...painelDados.resumo,contratado:{plano:null,banners:[],assinatura:minhaAssinatura}}})));
});

test('painel, minha empresa: semana de segunda a domingo, intervalos, redes, textos em análise e fotos',()=>{
 const html=views.painel(painel('perfil'));
 assert.deepEqual([...html.matchAll(/<span class="hours-name" id="dia-(\d)">/g)].map(m=>m[1]),['1','2','3','4','5','6','0']);
 assert.match(html,/data-dia="3"[^]*?<input type="time" data-abre value="07:00" required>[^]*?value="12:00"[^]*?value="14:00"[^]*?value="19:00"/);
 assert.match(html,/<div class="hours-day" data-dia="0"><div class="hours-head"><span class="hours-name" id="dia-0">Domingo<\/span><label class="toggle"><input type="checkbox" data-aberto>/,'domingo fechado');
 assert.match(views.painel(painel('perfil',{dados:{...painelDados.perfil,horario:[{dia:5,abre:'18:00',fecha:'24:00'}]}})),/data-fecha value="00:00"/);
 assert.match(html,/<input type="hidden" name="version" value="3">/);
 assert.match(html,/id="campo-whatsapp" name="whatsapp" value="\(21\) 90000-0000"/);
 assert.match(html,/<select data-rede><option value="Instagram" selected>Instagram<\/option>/);
 assert.match(html,/<label for="campo-descricao">Sobre a empresa <span class="review-tag">Em análise<\/span><\/label>/);
 assert.match(html,/<template data-modelo-intervalo>[^]*<\/template><template data-modelo-rede>/);
 assert.match(html,/data-copiar-segunda>[^]*Repetir o horário de segunda de terça a sexta<\/button>/);
 assert.match(html,/id="campo-site" name="site" value="https:\/\/padaria-exemplo\.com\.br\/" inputmode="url"/);assert.match(html,/placeholder="@suaempresa ou o link"/);
 assert.match(views.painel(painel('perfil',{dados:{...painelDados.perfil,fotos:[{id:'f9',url:'/midia/f9/800.webp',largura:800,altura:600,alt:'',status:'recusada',recusa:{comentario:'Foto escura.',em:'2026-10-02'}}]}})),/<span class="photo-refusal">Motivo: Foto escura\.<\/span>/);
 assert.match(html,/<li class="photo-card" data-foto="f2"><img src="\/midia\/f2\/800\.webp" alt="Balcão" width="800" height="533"[^]*<span class="state-tag is-pendente">Em análise<\/span>/);
 assert.match(html,/data-excluir-foto="f1"/);assert.match(html,/<input type="file" id="campo-arquivo" name="arquivo" aria-describedby="dica-campo-arquivo" accept="image\/jpeg,image\/png,image\/webp">/);
 const leitor=views.painel(painel('perfil',{papel:'leitura',pode:{perfil:false,catalogo:false,plano:false,solicitar:false,acessos:false}}));
 assert.match(leitor,/Seu acesso nesta empresa é de leitura: você vê o perfil, mas não altera/);
 assert.equal((leitor.match(/<fieldset class="panel-fieldset"[^>]*disabled>/g)||[]).length,5);
 assert.doesNotMatch(leitor,/Salvar alterações|data-excluir-foto|data-form="foto"/);
 semInline(html);
});

test('painel, produtos e serviços: situação da aprovação, ações por situação, preço e campos da oferta',()=>{
 const html=views.painel(painel('catalogo'));
 const linha=id=>html.slice(html.indexOf(`id="item-${id}"`),html.indexOf('</li>',html.indexOf(`id="item-${id}"`)));
 assert.match(linha('i1'),/<span class="state-tag is-publicado">Publicado<\/span>[^]*R\$ 18,90[^]*data-acao-item="pausar" data-item="i1" data-version="2"/);
 assert.match(linha('i2'),/<span class="state-tag is-ajuste">Voltou para ajuste<\/span>[^]*Voltou da aprovação em 02\/10\/2026:<\/strong> Falta a validade da oferta\.[^]*<button type="button" class="button" data-corrigir="i2">Corrigir e reenviar<\/button>/);
 assert.doesNotMatch(linha('i2'),/data-acao-item="enviar"/,'o item recusado não volta para a fila sem correção');
 assert.match(linha('i2'),/data-excluir-item="i2">Excluir rascunho/);assert.doesNotMatch(linha('i1')+linha('i3')+linha('i4'),/data-excluir-item/,'só o rascunho pode ser excluído');
 assert.match(linha('i2'),/data-form="item" data-item="i2" data-reenviar novalidate><p class="item-refusal">[^]*Salvar e reenviar para aprovação/);
 assert.match(views.painel(painel('catalogo',{dados:{itens:[{...painelDados.catalogo.itens[1],recusa:null}]}})),/is-rascunho">Rascunho[^]*data-acao-item="enviar"/);
 assert.match(linha('i3'),/is-validacao">Aguardando aprovação[^]*A partir de R\$ 80,00/);assert.doesNotMatch(linha('i3'),/data-acao-item/);
 assert.match(linha('i4'),/Sob consulta[^]*data-acao-item="reativar"/);
 assert.match(linha('i2'),/<div class="offer-fields full" data-oferta>/);assert.match(linha('i1'),/<div class="offer-fields full is-hidden" data-oferta>/);
 assert.match(linha('i4'),/preco-valor is-hidden/);
 assert.match(html,/<details class="item-new" id="novo-item"><summary class="button">[^]*Novo item<\/summary><form class="panel-form" data-form="item-novo"/);
 assert.match(html,/data-enviar="true">Enviar para aprovação<\/button><button type="submit" class="button secondary" data-enviar="false">Salvar como rascunho/);
 assert.equal(new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1])).size,[...html.matchAll(/ id="([^"]+)"/g)].length,'ids únicos entre os formulários dos itens');
 const leitor=views.painel(painel('catalogo',{pode:{perfil:false,catalogo:false,plano:false,solicitar:false,acessos:false},papel:'leitura'}));
 assert.doesNotMatch(leitor,/data-acao-item|item-new|item-edit/);
 assert.match(views.painel(painel('catalogo',{dados:{itens:[]}})),/Nenhum produto ou serviço ainda/);
 semInline(html);
});

test('painel, resultados: período, totais, gráficos com tabela para leitor de tela, cliques por tipo e banners',()=>{
 const html=views.painel(painel('resultados'));
 assert.match(html,/<a class="filter-chip" href="\/painel\/padaria-exemplo\/resultados\?periodo=30d" aria-current="true">30 dias<\/a>/);
 assert.match(html,/De 04\/09\/2026 a 03\/10\/2026/);
 assert.match(html,/<dt>Visitas ao perfil<\/dt><dd>56<small class="trend">\+15 em relação ao período anterior<\/small><\/dd>[^]*<dt>Cliques para contato<\/dt><dd>22<small class="trend">−3 em relação ao período anterior<\/small><\/dd>[^]*<dt>Aparições em buscas<\/dt><dd>230<small class="trend">\+32 em relação ao período anterior<\/small><\/dd>/);
 assert.doesNotMatch(views.painel(painel('resultados',{dados:{...painelDados.resultados,periodo:'90d',anterior:null}})),/class="trend"/,'em 90 dias não há período anterior guardado');
 assert.equal((html.match(/<svg viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-labelledby="graf-/g)||[]).length,3);
 assert.equal((html.match(/<figure class="chart"><figcaption id="graf-visitas">/g)||[]).length,1);
 assert.match(html,/<table class="sr-only"><caption>Visitas ao perfil por dia<\/caption>[^]*<tr><th scope="row">04\/09\/2026<\/th><td>1<\/td><\/tr>/);
 assert.match(html,/<li><span>WhatsApp<\/span><svg[^]*<rect class="fill" width="100" height="8"\/><\/svg><strong>12<\/strong>/);
 assert.match(html,/<th scope="row">Padaria Exemplo: café da manhã<\/th><td>Topo da página inicial<\/td><td class="num">1\.200<\/td><td class="num">18<\/td>/);
 const vazio=views.painel(painel('resultados',{dados:{...painelDados.resultados,cliques:{whatsapp:0,telefone:0,rota:0,site:0},serie:painelDados.resultados.serie.map(p=>({...p,visitas:0}))}}));
 assert.match(vazio,/<figcaption id="graf-visitas"><span>Visitas ao perfil por dia<\/span><\/figcaption><p class="chart-empty">Nenhum registro neste período\.<\/p>/);
 assert.match(vazio,/Nenhum clique para contato neste período/);
 semInline(html);
});

test('painel, solicitações e acessos: briefing da criação, conversa, papel e convite',()=>{
 const sol=views.painel(painel('solicitacoes'));
 assert.match(sol,/<input type="radio" name="tipo" value="suporte" checked>[^]*value="alteracao"[^]*value="criacao"/);
 assert.match(sol,/<fieldset class="panel-fieldset briefing is-hidden" data-briefing>/);
 assert.match(sol,/<li id="sol-s1"><details class="request" data-solicitacao="s1"><summary><span class="request-subject">Banner para o Dia das Crianças<\/span><span class="state-tag is-em-andamento">Com a PRIMIG<\/span><small>Criação pela PRIMIG · atualizada em 01\/10\/2026<\/small>/);
 assert.match(sol,/<dt>Para quando<\/dt><dd>10\/10\/2026<\/dd>/);assert.match(sol,/data-form="mensagem" data-solicitacao="s2"/);
 assert.match(views.painel(painel('solicitacoes',{dados:{solicitacoes:[]}})),/<details class="request-new" id="nova-solicitacao" open>/);
 assert.match(sol,/<span class="state-tag is-respondida">Sua vez: a PRIMIG respondeu<\/span>/);assert.match(sol,/<p class="panel-links">Prefere conversar\? <a class="whatsapp-link"/);
 const ac=views.painel(painel('acessos'));
 assert.match(ac,/<strong>Maria Souza <small>\(você\)<\/small><\/strong>[^]*<td data-rotulo="Papel">Dono<\/td>/);
 assert.doesNotMatch(ac,/data-usuario="u-maria"|data-revogar="u-maria"/,'ninguém muda o próprio papel');
 // Mudar o papel tem botão próprio; tornar dono pede a confirmação em palavras simples (o JS mostra os dois ao escolher).
 assert.match(ac,/<form class="role-form" data-form="papel" data-usuario="u-joao" novalidate><label><span class="sr-only">Papel de João Lima<\/span><select name="papel" data-papel-atual="editor">[^]*<option value="editor" selected>Editor<\/option>[^]*<\/select><\/label><button type="submit" class="button secondary" data-salvar-papel hidden>Salvar papel<span class="sr-only"> de João Lima<\/span><\/button><p class="role-confirm" data-confirmar-dono hidden>João Lima vai poder convidar e tirar pessoas desta empresa, inclusive você\.<\/p><\/form>/);
 assert.match(ac,/<td data-rotulo="Desde">30\/09\/2026<\/td>/);
 assert.match(ac,/data-revogar="u-joao">Tirar acesso<span class="sr-only"> de João Lima<\/span>/);
 assert.match(ac,/<li class="invite-row"><span class="person"><strong>financeiro@padaria-exemplo\.com\.br<\/strong><span>Financeiro · vale até 10\/10\/2026<\/span><\/span><span class="invite-actions"><button type="button" class="link-button text-button" data-reenviar-convite="financeiro@padaria-exemplo\.com\.br">Reenviar[^]*data-cancelar-convite="financeiro@padaria-exemplo\.com\.br">Cancelar/);
 assert.match(ac,/data-form="convite"[^]*<option value="editor" selected>Editor<\/option>/);
 for(const html of [sol,ac])semInline(html);
});

test('painel sem empresa escolhida: a lista de empresas ou o caminho para pedir acesso',()=>{
 const lista=views.painel(painel('empresas',{empresa:null,dados:null}));
 assert.match(lista,/<h1 id="painel-titulo">Suas empresas<\/h1>/);assert.doesNotMatch(lista,/class="panel-nav"|data-empresa=/);
 assert.match(lista,/<ul class="company-list"><li><a href="\/painel\/padaria-exemplo"><strong>Padaria &lt;Exemplo&gt;<\/strong><span>Dono<\/span>/);
 assert.match(views.painel(painel('empresas',{empresa:null,empresas:[],dados:null})),/Sua conta ainda não está ligada a uma empresa/);
});

test('painel v0.14.0: empresa no perfil, cupons e coletas em Resultados (contrato 14.5 e 14.6)',()=>{
 const perfil=views.painel(painel('perfil'));
 assert.match(perfil,/<form class="panel-form" data-form="perfil" data-publicada novalidate>[^]*<fieldset class="panel-fieldset" id="empresa-dados"><legend>Empresa<\/legend>/);
 assert.match(perfil,/<input type="text" id="campo-nome" name="nome"[^>]* value="Padaria &lt;Exemplo&gt;"/);
 assert.match(perfil,/<input type="text" id="campo-rua" name="rua"[^>]*value="Rua Exemplo, 10"/,'"Informe o endereço." aponta para #campo-rua');
 assert.match(perfil,/<input type="checkbox" name="categorias" value="Padarias" checked>/);
 assert.match(perfil,/<label class="main-photo"><input type="radio" name="imagem" value="\/midia\/f1\/800\.webp" checked><img src="\/midia\/f1\/800\.webp"/,'a foto principal é uma das aprovadas');
 assert.doesNotMatch(perfil,/name="imagem" value="\/midia\/f2\/800\.webp"/,'foto pendente não pode ser a principal');
 assert.match(perfil,/<datalist id="lista-bairros"><option value="Centro">/);
 const html=views.painel(painel('cupons'));
 assert.match(html,/<a href="\/painel\/padaria-exemplo\/cupons" aria-current="page">[^]*<span>Cupons<\/span>/);
 assert.match(html,/<details class="item-new" id="novo-cupom"><summary class="button">[^]*Novo cupom<\/summary><form class="panel-form" data-form="cupom-novo" novalidate>[^]*name="titulo"[^]*name="condicoes"[^]*name="validade"[^]*name="inicio"[^]*name="quantidade"[^]*name="codigo"/);
 assert.match(html,/<p class="muted coupons-count">3 de 10 cupons em vigor\.<\/p>/);
 assert.match(html,/<span class="state-tag is-publicado">No ar<\/span><\/div><h3>10% no café da manhã<\/h3>[^]*Código <strong class="coupon-code-inline">CAFE10<\/strong> · 8 coletas de 50 · válido até 30\/11\/2026/);
 assert.match(html,/Já houve coleta: só a validade e a quantidade mudam\.[^]*<input type="text" id="cupom-cp1-titulo" name="titulo"[^>]* disabled>/,'depois da coleta, o título trava');
 assert.match(html,/<span class="state-tag is-validacao">Agendado<\/span>[^]*começa em 01\/11\/2026/);
 assert.match(html,/<span class="state-tag is-ajuste">Suspenso pela PRIMIG<\/span>[^]*Suspenso pela PRIMIG em 12\/10\/2026:<\/strong> Condições diferentes das da loja\./);
 assert.doesNotMatch(html.slice(html.indexOf('id="cupom-cp7"')),/data-acao-cupom="reativar"|<summary class="button secondary">Editar/,'suspenso não reativa nem edita pelo painel');
 assert.match(html,/data-copiar-link="\/cupons\/cp1">Copiar o link para divulgar/);
 const cheio=views.painel(painel('cupons',{dados:{cupons:Array.from({length:10},(_,i)=>({...painelDados.cupons.cupons[0],id:`c${i}`}))}}));
 assert.match(cheio,/já tem 10 cupons em vigor, o máximo/);assert.doesNotMatch(cheio,/data-form="cupom-novo"/);
 assert.match(views.painel(painel('resultados')),/<dl class="stats-row has-4">[^]*<dt>Coletas de cupons<\/dt><dd>9<small class="trend">\+5 em relação ao período anterior<\/small><\/dd>/);
});

test('painel, relatório do mês (v0.20.0, contrato 20): o mês e o de comparação, a troca de mês, os números e a impressão',()=>{
 const html=views.painel(painel('relatorio'));
 assert.match(html,/<a href="\/painel\/padaria-exemplo\/relatorio" aria-current="page"><svg[^]*?<\/svg><span>Relatório do mês<\/span><\/a>/,'no menu, para todo papel');
 const leitor=views.painel(painel('relatorio',{papel:'leitura',pode:{perfil:false,catalogo:false,plano:false,solicitar:false,acessos:false}}));
 assert.match(leitor,/<span>Relatório do mês<\/span>/);assert.match(leitor,/data-imprimir/);
 assert.match(html,/<a href="\/painel\/oficina-exemplo\/relatorio">/,'a troca de empresa mantém o relatório');
 assert.match(html,/<h1 id="painel-titulo">Relatório de novembro de 2026<\/h1><p>Padaria &lt;Exemplo&gt;, comparado com outubro de 2026\.<\/p>/);
 assert.match(html,/<div class="panel-shortcuts report-actions"><details class="report-switch"><summary class="button secondary">Trocar de mês<svg[^]*?<\/svg><\/summary><ul><li><a href="\/painel\/boreal-tintas\/relatorio\/2026-11" aria-current="page">Novembro de 2026<\/a><\/li><li><a href="\/painel\/boreal-tintas\/relatorio\/2026-10">Outubro de 2026<\/a><\/li><li><a href="\/painel\/boreal-tintas\/relatorio\/2026-09">Setembro de 2026<\/a><\/li><\/ul><\/details><button type="button" class="button secondary" data-imprimir hidden><svg[^]*?<\/svg><span>Imprimir<\/span><\/button><\/div>/,'o Imprimir escondido até o JS ligar');
 // Os três números, com o anterior e a diferença; nas aparições, outubro começou no dia 15 e não compara.
 assert.match(html,/<dt>Visitas ao perfil<\/dt><dd><strong class="report-value">412<\/strong><span class="report-before">Outubro: 365<\/span><span class="report-diff">47 a mais que em outubro<\/span><\/dd>/);
 assert.match(html,/<dt>Contatos<\/dt><dd><strong class="report-value">65<\/strong><span class="report-before">Outubro: 60<\/span><span class="report-diff">5 a mais que em outubro<\/span><\/dd>/);
 assert.match(html,/<dt>Aparições na busca<\/dt><dd><strong class="report-value">1\.280<\/strong><span class="report-before">Outubro: 640, desde 15\/10<\/span><span class="report-diff">Sem comparação: outubro foi medido só em parte<\/span><\/dd>/);
 assert.match(html,/<th scope="col">Canal<\/th><th scope="col" class="num">Novembro<\/th><th scope="col" class="num">Outubro<\/th><th scope="col" class="num">Diferença<\/th>/);
 for(const [canal,a,b,d] of [['WhatsApp',41,35,'+6'],['Telefone',6,9,'−3'],['Como chegar',14,12,'+2'],['Site',4,4,'0']])assert.ok(html.includes(`<tr><th scope="row">${canal}</th><td class="num">${a}</td><td class="num">${b}</td><td class="num">${d}</td></tr>`),canal);
 assert.match(html,/<tfoot><tr><th scope="row">Total<\/th><td class="num">65<\/td><td class="num">60<\/td><td class="num">\+5<\/td><\/tr><\/tfoot>/);
 // Os banners: outubro parcial, sem a diferença, com o motivo.
 assert.match(html,/<th scope="col" class="num">Outubro<small>desde 03\/10<\/small><\/th>/);
 assert.match(html,/<tbody><tr class="report-group"><th scope="rowgroup" colspan="4">Tintas com 10% de desconto<\/th><\/tr><tr><th scope="row">Impressões<\/th><td class="num">2\.310<\/td><td class="num">820<\/td><td class="num"><span aria-hidden="true">—<\/span><span class="sr-only">sem comparação<\/span><\/td><\/tr>/);
 assert.match(html,/<p class="report-table-note">Sem a diferença: outubro foi medido só a partir de 03\/10\.<\/p>/);
 assert.match(html,/<p class="form-note">Visitas e contatos contam só os visitantes que aceitaram a medição\.[^<]*<\/p><p class="form-note">O guia mede as visitas e os contatos desde 24\/09\/2026, as aparições na busca desde 15\/10\/2026 e os banners desde 03\/10\/2026\.<\/p>/);
 const pagina=page('painel',painel('relatorio'));assert.match(pagina,/<script type="module" src="\/assets\/painel\.js"><\/script>/);semInline(pagina);
});

test('painel, relatório do mês: "sem medição" no lugar do null, a virada do ano, um mês só e o escape',()=>{
 const nulo={atual:null,anterior:null,diferenca:null},r=painelDados.relatorio;
 const primeiro=views.painel(painel('relatorio',{dados:{...r,mes:'2026-09',rotulo:'setembro de 2026',anterior:{mes:'2026-08',rotulo:'agosto de 2026'},disponiveis:[r.disponiveis[2]],
   series:{contatos:{medidoDesde:'2026-09-24',parcial:{atual:true,anterior:false}},aparicoes:{medidoDesde:null,parcial:{atual:false,anterior:false}},banners:{medidoDesde:null,parcial:{atual:false,anterior:false}}},
   visitas:{atual:10,anterior:null,diferenca:null},contatos:{whatsapp:{atual:2,anterior:null,diferenca:null},telefone:{atual:0,anterior:null,diferenca:null},rota:{atual:0,anterior:null,diferenca:null},site:{atual:0,anterior:null,diferenca:null},total:{atual:2,anterior:null,diferenca:null}},
   aparicoes:nulo,banners:[]}}));
 assert.match(primeiro,/<dt>Visitas ao perfil<\/dt><dd><strong class="report-value">10<\/strong><span class="report-part">desde 24\/09<\/span><span class="report-before">Agosto: <span class="report-none">sem medição<\/span><\/span><\/dd>/,'sem a frase da diferença');
 assert.match(primeiro,/<dt>Aparições na busca<\/dt><dd><strong class="report-value"><span class="report-none">sem medição<\/span><\/strong><span class="report-before">Agosto: <span class="report-none">sem medição<\/span><\/span><\/dd>/);
 assert.match(primeiro,/<tr><th scope="row">Telefone<\/th><td class="num">0<\/td><td class="num"><span class="report-none">sem medição<\/span><\/td>/,'zero só quando mediu');
 assert.doesNotMatch(primeiro,/report-table-note/,'agosto sem medição: o "sem medição" já explica a falta da diferença');
 // Os dois meses medidos, com setembro começando no dia 24: aí a nota diz por que não há diferença.
 const doisMeses=views.painel(painel('relatorio',{dados:{...r,series:{...r.series,contatos:{medidoDesde:'2026-10-24',parcial:{atual:false,anterior:true}}},contatos:{...r.contatos,total:{atual:65,anterior:12,diferenca:null}}}}));
 assert.match(doisMeses,/<\/table><\/div><p class="report-table-note">Sem a diferença: outubro foi medido só a partir de 24\/10\.<\/p><\/section>/);
 assert.match(primeiro,/<h2 id="rel-banners">Banners da empresa<\/h2><p class="panel-empty">O guia ainda não media os banners nestes dois meses\.<\/p>/);
 assert.doesNotMatch(primeiro,/report-switch/,'com um mês só, sem a troca');
 assert.match(primeiro,/O guia mede as visitas e os contatos desde 24\/09\/2026\.<\/p>/);
 assert.match(views.painel(painel('relatorio',{dados:{...r,banners:[]}})),/<p class="panel-empty">Nenhum banner da empresa teve impressão ou clique nestes dois meses\.<\/p>/);
 // Janeiro compara com dezembro do ano anterior: os meses vão com o ano.
 const virada=views.painel(painel('relatorio',{dados:{...r,mes:'2027-01',rotulo:'janeiro de 2027',anterior:{mes:'2026-12',rotulo:'dezembro de 2026'}}}));
 assert.match(virada,/<span class="report-before">Dezembro de 2026: 365<\/span><span class="report-diff">47 a mais que em dezembro de 2026<\/span>/);
 assert.match(virada,/<th scope="col" class="num">Janeiro de 2027<\/th><th scope="col" class="num">Dezembro de 2026<\/th>/);
 const menos=views.painel(painel('relatorio',{dados:{...r,visitas:{atual:300,anterior:365,diferenca:-65},contatos:{...r.contatos,total:{atual:60,anterior:60,diferenca:0}}}}));
 assert.match(menos,/<span class="report-diff">65 a menos que em outubro<\/span>/);assert.match(menos,/<span class="report-diff">O mesmo que em outubro<\/span>/);
 const xss='"><img src=x onerror=alert(1)>';
 const escapado=views.painel(painel('relatorio',{empresa:{...painel('relatorio').empresa,name:xss},dados:{...r,banners:[{...r.banners[0],titulo:xss}],disponiveis:[{...r.disponiveis[0],rotulo:xss,url:'/x"y'},r.disponiveis[1]]}}));
 assert.doesNotMatch(escapado,/<img src=x/);assert.match(escapado,/<p>&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;, comparado com/);
 assert.match(escapado,/<th scope="rowgroup" colspan="4">&quot;&gt;&lt;img/);assert.match(escapado,/<a href="\/x&quot;y" aria-current="page">&quot;&gt;&lt;img/);
 assert.match(views.painel(painel('relatorio',{dados:null})),/<p class="panel-empty">O relatório deste mês não está disponível\.<\/p>/,'sem dados, sem quebrar');
});

test('painel v0.22.0 (contrato 22.4): "Outra categoria…" vira a sugestão, com a pendente, a recusada e o Resumo',()=>{
 const perfil=extra=>views.painel(painel('perfil',{dados:{...painelDados.perfil,...extra}}));
 const sem=perfil({sugestaoCategoria:null});
 assert.match(sem,/<details class="category-new" data-campo="sugestaoCategoria"><summary class="link-button text-button"><svg[^]*?<\/svg>Outra categoria…<\/summary><div class="category-new-body"><p class="field-hint">Não achou a categoria da sua empresa\? Sugira uma: ela passa pela equipe da PRIMIG antes de aparecer no guia\. Até lá, a empresa continua nas categorias marcadas\.<\/p>/);
 assert.match(sem,/name="sugestaoNome"[^>]*maxlength="60"[^]*<select id="campo-sugestaoGrupo" name="sugestaoGrupo"><option value="">Escolha o grupo<\/option><option value="alimentacao">Alimentação<\/option>/);
 assert.match(sem,/<p class="form-note">A sugestão vai junto quando você salvar\.<\/p><\/div><\/details><\/div>/,'dentro do campo das categorias');
 assert.doesNotMatch(sem,/category-suggestion/);
 const pendente=perfil({sugestaoCategoria:sugestaoCategoria.pendente,emAnalise:['sugestaoCategoria']});
 assert.match(pendente,/<div class="category-suggestion"><p><span class="review-tag">Em análise<\/span> Você sugeriu a categoria <strong>Pizzaria<\/strong>, em Alimentação, em 29\/10\/2026\. Ela entra na empresa quando a PRIMIG aprovar\.<\/p><button type="button" class="link-button text-button" data-retirar-sugestao>Retirar a sugestão<\/button><\/div>/);
 assert.match(pendente,/<\/svg>Sugerir outra no lugar…<\/summary>/,'uma nova substitui a pendente');
 const recusada=perfil({sugestaoCategoria:sugestaoCategoria.recusada});
 assert.match(recusada,/<div class="category-suggestion is-refused"><p>A PRIMIG não aprovou a categoria <strong>Pizzaria<\/strong>: “Use &quot;Padarias&quot;: a empresa vende pizza no balcão\.” Você pode sugerir outra\.<\/p><\/div><details class="category-new"/);
 assert.doesNotMatch(recusada,/data-retirar-sugestao/);
 // Quem só lê vê a situação, sem sugerir nem retirar.
 const leitor=views.painel(painel('perfil',{papel:'leitura',pode:{perfil:false,catalogo:false,plano:false,solicitar:false,acessos:false},dados:{...painelDados.perfil,sugestaoCategoria:sugestaoCategoria.pendente}}));
 assert.match(leitor,/Você sugeriu a categoria <strong>Pizzaria<\/strong>/);assert.doesNotMatch(leitor,/data-retirar-sugestao|data-campo="sugestaoCategoria"/);
 // No Resumo, a sugestão pendente em análise pela PRIMIG.
 const resumo=views.painel(painel('resumo',{dados:{...painelDados.resumo,primig:{...painelDados.resumo.primig,emAnalise:[{tipo:'categoria',titulo:'Categoria sugerida: Pizzaria',desde:'2026-10-29'}]}}}));
 assert.match(resumo,/<li><span>Categoria sugerida: Pizzaria<\/span><small>Categoria nova · desde 29\/10\/2026/);
 const xss='"><img src=x onerror=alert(1)>';
 assert.doesNotMatch(perfil({sugestaoCategoria:{...sugestaoCategoria.recusada,nome:xss,comentario:xss}}),/<img src=x/);
 semInline(page('painel',painel('perfil',{dados:{...painelDados.perfil,sugestaoCategoria:sugestaoCategoria.pendente}})));
});
