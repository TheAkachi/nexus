import { tokenInfo } from '../auth.mjs';
import { acessoA } from '../permissoes.mjs';
import { meVM } from '../painel-api.mjs';
import * as P from './painel.mjs';
import { rota, titulo, naoEncontrada } from './rota.mjs';
import { whatsappURL } from './cadastro.mjs';
import { meusCupons, cuponsEmpresa } from './cupons.mjs';

// Páginas da conta e do painel (contrato 12.3). Sem índice, sem anúncio e sem cache.
// Volta depois do login: painel, admin, cupons ou minha conta (12.3, 13.2 e 14.2).
// v0.21.0: a única volta com consulta é a lista de acessos aberta numa empresa (21.2), com o id no formato dos ids de empresa.
const seguro=next=>typeof next==='string'&&(/^\/(painel|admin|cupons)(\/[a-zA-Z0-9:%-]+)*$/.test(next)||/^\/admin\/acessos\?empresa=[a-z0-9][a-z0-9-]{0,79}$/.test(next)
  ||next==='/minha-conta')?next:'';
// tipo: a opção que a tela abre. Sem ?tipo=, afiliado quando a volta é para o painel ou o admin.
export function loadEntrar(url) {
  const next=seguro(url.searchParams.get('next')),pedido=url.searchParams.get('tipo');
  const tipo=['usuario','afiliado'].includes(pedido)?pedido:/^\/(painel|admin)/.test(next)?'afiliado':'usuario';
  return rota('entrar',{next,motivo:['expirou','saiu'].includes(url.searchParams.get('motivo'))?url.searchParams.get('motivo'):'',tipo},
    {title:titulo('Entrar'),description:'Entre no Nexus para pegar cupons de desconto ou cuidar da sua empresa: perfil, cupons e resultados.'});
}
export const loadCriarConta=url=>rota('criar-conta',{next:seguro(url.searchParams.get('next'))},
  {title:titulo('Criar conta'),description:'Crie sua conta no Nexus para pegar cupons de desconto das empresas de Rio de Janeiro.'});
// /minha-conta (14.2): os dados da conta e os cupons coletados. Sem sessão, vai para /entrar.
export async function loadMinhaConta({db,session,now}) {
  if(!session)return {redirect:'/entrar?next=%2Fminha-conta'};
  return rota('minha-conta',{usuario:{id:session.user_id,email:session.email,nome:session.name||'',tipo:session.tipo},csrf:session.csrf,cupons:await meusCupons(db,session.user_id,now)},
    {title:titulo('Minha conta'),description:'Sua conta no Nexus: os cupons que você pegou, com o código e a validade de cada um.'});
}
export const loadRecuperar=()=>rota('recuperar',{},{title:titulo('Recuperar a senha'),description:'Peça um link para criar uma nova senha no Nexus.'});
export async function loadDefinirSenha(db,url,now) {
  const value=url.searchParams.get('token')||'',t=await tokenInfo(db,value,now);
  // Convite: a empresa e quem convidou (a equipe ou o CLI aparecem como "Equipe Nexus").
  const convidadoPor=t?.kind!=='convite'?'':!t.created_by||t.criador_equipe?'Equipe Nexus':(t.criador_nome||t.criador_email||'');
  return rota('definir-senha',{token:t?value:'',tipo:t?.kind||'',valido:Boolean(t),email:t?.email||'',empresa:t?.kind==='convite'?t.empresa||'':'',convidadoPor},
    {title:titulo(t?.kind==='convite'?'Aceitar o convite':'Criar nova senha'),description:'Defina sua senha para entrar no painel do anunciante do Nexus.'});
}

const MODULOS={resumo:'ver',perfil:'ver',catalogo:'ver',cupons:'ver',resultados:'ver',relatorio:'ver',solicitacoes:'ver',acessos:'acessos'};
// Nomes dos módulos como na view do painel (título da página: "<módulo> · <empresa>").
const NOMES={resumo:'Resumo',perfil:'Minha empresa',catalogo:'Produtos e serviços',cupons:'Cupons',resultados:'Resultados',relatorio:'Relatório do mês',solicitacoes:'Solicitações e suporte',acessos:'Acessos'};
const suporte={whatsappUrl:whatsappURL('Olá, equipe Nexus! Preciso de ajuda com o painel do Nexus.')};
const dadosDe=(db,modulo,acesso,now,periodo='30d')=>({
  resumo:()=>P.resumoEmpresa(db,acesso,now),perfil:()=>P.perfilEmpresa(db,acesso.empresa.id),catalogo:()=>P.catalogoEmpresa(db,acesso.empresa.id),cupons:()=>cuponsEmpresa(db,acesso.empresa.id,now),
  resultados:()=>P.metricasEmpresa(db,acesso.empresa.id,P.PERIODOS[periodo]?periodo:'30d',now),solicitacoes:()=>P.solicitacoesEmpresa(db,acesso.empresa.id),acessos:()=>P.acessosEmpresa(db,acesso.empresa.id,now)
})[modulo]();

// /painel e /painel/<id>/<modulo>. Devolve {redirect} quando a página manda para outro lugar.
export async function loadPainel({db,session,path,url,now}) {
  if(!session)return {redirect:`/entrar?next=${encodeURIComponent(seguro(path)||'/painel')}`};
  if(session.tipo==='usuario')return {redirect:'/minha-conta'};
  const me=await meVM(db,session),base={usuario:me.usuario,csrf:me.csrf,empresas:me.empresas,suporte};
  const meta=t=>({title:titulo(t),description:'Painel do anunciante do Nexus: perfil, catálogo, resultados e solicitações.'});
  if(path==='/painel') {
    if(me.empresas.length===1)return {redirect:`/painel/${me.empresas[0].id}`};
    return rota('painel',{...base,empresa:null,papel:null,pode:null,modulo:'empresas',dados:null},meta('Painel'));
  }
  // v0.20.0: só o relatório leva o mês no caminho (/painel/<id>/relatorio/<aaaa-mm>, contrato 20.1).
  const m=/^\/painel\/([a-z0-9][a-z0-9-]*)(?:\/([a-z]+)(?:\/(\d{4}-\d{2}))?)?$/.exec(path);
  if(!m)return naoEncontrada();
  const [,id,modulo='resumo',mes]=m;
  if(!MODULOS[modulo]||(mes&&modulo!=='relatorio'))return naoEncontrada();
  const acesso=await acessoA(db,session,id);
  if(!acesso)return naoEncontrada();
  const vm={...base,empresa:{id:acesso.empresa.id,slug:acesso.empresa.slug,name:acesso.empresa.name,status:acesso.empresa.status,url:acesso.empresa.status==='published'?`/comercio/${acesso.empresa.slug}`:''},
    papel:acesso.papel,pode:acesso.pode,modulo};
  if(MODULOS[modulo]!=='ver'&&!acesso.pode[MODULOS[modulo]])return rota('painel',{...vm,dados:null},{...meta('Sem permissão'),status:403});
  // Relatório do mês: sem o mês, vai para o endereço estável do mês anterior; mês fora dos aceitos, 404.
  if(modulo==='relatorio') {
    if(!mes)return {redirect:`/painel/${id}/relatorio/${P.mesAnterior(now)}`};
    const dados=await P.relatorioEmpresa(db,acesso.empresa.id,mes,now).catch(e=>{if(e.status===422)return null;throw e;});
    if(!dados)return naoEncontrada();
    return rota('painel',{...vm,dados},meta(`Relatório de ${dados.rotulo} · ${acesso.empresa.name}`));
  }
  return rota('painel',{...vm,dados:await dadosDe(db,modulo,acesso,now,url?.searchParams.get('periodo')||'30d')},meta(`${NOMES[modulo]} · ${acesso.empresa.name}`));
}
