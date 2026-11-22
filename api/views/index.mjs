import { layout } from './layout.mjs';
import { homeView } from './home.mjs';
import { buscaView } from './busca.mjs';
import { empresaView } from './empresa.mjs';
import { conteudosView, conteudoView } from './conteudo.mjs';
import { ofertasView, eventosView, sobreView, institucionalView, naoEncontradaView, indisponivelView } from './paginas.mjs';
import { paraEmpresasView } from './para-empresas.mjs';
import { cadastroView, contatoView } from './cadastro.mjs';
import { entrarView, recuperarView, definirSenhaView, criarContaView } from './conta.mjs';
import { cuponsView, cupomView, minhaContaView } from './cupons.mjs';
import { painelView } from './painel.mjs';
import { adminView } from './admin.mjs';
import { bairrosView, bairroView } from './bairros.mjs';

// Registro das views: o campo view de cada rota (docs/CONTRATO.md) escolhe uma destas funções puras vm → HTML.
export const views={
  home:homeView,busca:buscaView,empresa:empresaView,conteudos:conteudosView,conteudo:conteudoView,
  ofertas:ofertasView,eventos:eventosView,'para-empresas':paraEmpresasView,cadastro:cadastroView,contato:contatoView,
  sobre:sobreView,institucional:institucionalView,'nao-encontrada':naoEncontradaView,indisponivel:indisponivelView,
  entrar:entrarView,recuperar:recuperarView,'definir-senha':definirSenhaView,'criar-conta':criarContaView,painel:painelView,admin:adminView,
  cupons:cuponsView,cupom:cupomView,'minha-conta':minhaContaView,bairros:bairrosView,bairro:bairroView
};

// JS próprio de algumas telas (Fases 3 e 4), além do site.js: a conta, o painel e o admin (equipe.js, porque /assets/admin.js
// segue fechado como arquivo dos pilotos) falam com as APIs.
const SCRIPTS={cadastro:'cadastro.js','para-empresas':'cadastro.js',empresa:'avaliacao.js',entrar:'conta.js',recuperar:'conta.js','definir-senha':'conta.js','criar-conta':'conta.js',painel:'painel.js',admin:'equipe.js',
  cupons:'cupons.js',cupom:'cupons.js','minha-conta':'cupons.js'};

// Página completa: layout + view da rota. meta = {canonical, indexable, path, menu?}, definidos pelo servidor;
// menu {ofertas, eventos} diz se esses itens entram no menu (também aceito em route.menu); conta {nome, tipo} (v0.14.0) troca o
// "Entrar" do cabeçalho.
// og:type: leitura de artigo ou classificado é "article"; o resto, "website".
// rodapeBairros (v0.17.0) é aceito e ignorado: a seção de bairros saiu do site na v0.17.1, a pedido do usuário.
export function renderPage(route,{canonical,indexable,path,menu,conta=null}) {
  const view=views[route.view];
  if(!view)throw new Error(`View desconhecida: ${route.view}`);
  const ogType=route.view==='conteudo'?'article':'website';
  // No painel, o botão do cabeçalho leva à página pública da empresa (ou ao guia, sem empresa escolhida). O admin usa a casca de
  // trabalho do layout: cabeçalho próprio, sem o menu público, o rodapé e o aviso de medição.
  const acao=route.view==='painel'?(route.vm?.empresa?.url?{href:route.vm.empresa.url,label:'Ver minha página'}:{href:'/',label:'Ir para o guia'}):null;
  return layout({title:route.title,description:route.description,canonical,indexable,path,ogImage:route.ogImage||'',ogType,menu:menu||route.menu||{},script:SCRIPTS[route.view]||'',acao,trabalho:route.view==='admin',conta},view(route.vm));
}
