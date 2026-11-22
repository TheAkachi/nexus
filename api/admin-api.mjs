import { fail } from './lib/erros.mjs';
import { sameSecret } from './auth.mjs';
import { MAX_BYTES } from './lib/imagens.mjs';
import * as E from './data/admin/empresas.mjs';
import * as C from './data/admin/conteudo.mjs';
import * as B from './data/admin/banners.mjs';
import * as M from './data/admin/midia.mjs';
import * as F from './data/admin/fila.mjs';
import * as U from './data/admin/usuarios.mjs';
import * as R from './data/admin/relatorios.mjs';
import { listarCuponsAdmin, suspenderCupom } from './data/cupons.mjs';
import * as P from './data/admin/pessoas.mjs';
import * as A from './data/admin/acessos.mjs';
import { criarCategoria } from './data/categorias-novas.mjs';

// Permissões da equipe por ação (contrato 13.1). Ler é para toda a equipe.
export const PODE_EQUIPE={empresas:['admin','operador'],conteudo:['admin','editor'],banners:['admin','editor'],midia:['admin','editor','operador'],fila:['admin','editor'],
  cupons:['admin','editor','operador'],planos:['admin'],acessos:['admin','operador'],equipe:['admin'],solicitacoes:['admin','editor','operador']};
export const podeEquipe=papel=>Object.fromEntries(Object.entries(PODE_EQUIPE).map(([k,v])=>[k,v.includes(papel)]));
const ESCRITA=['POST','PATCH','DELETE'];
// Recursos com o mesmo formato: lista, registro, criação, edição e publicar/pausar.
const CRUD={
  empresas:{acao:'empresas',listar:E.listarEmpresas,obter:E.obterEmpresa,criar:E.criarEmpresa,editar:E.editarEmpresa,status:E.statusEmpresa},
  conteudo:{acao:'conteudo',listar:C.listarConteudo,obter:C.obterConteudo,criar:C.criarConteudo,editar:C.editarConteudo,status:C.statusConteudo},
  eventos:{acao:'conteudo',listar:C.listarEventos,obter:C.obterEvento,criar:C.criarEvento,editar:C.editarEvento,status:C.statusEvento},
  ofertas:{acao:'conteudo',listar:C.listarOfertas,obter:C.obterOferta,criar:C.criarOferta,editar:C.editarOferta,status:C.statusOferta},
  colecoes:{acao:'conteudo',listar:C.listarColecoes,obter:C.obterColecao,criar:C.criarColecao,editar:C.editarColecao},
  banners:{acao:'banners',listar:B.listarBanners,obter:B.obterBanner,criar:B.criarBanner,editar:B.editarBanner,status:B.statusBanner}
};

export async function adminAPI(ctx) {
  const {db,req,path,method,ip,now,origin,mailer,send,url}=ctx;
  if(path!=='/api/admin'&&!path.startsWith('/api/admin/'))return false;
  const session=await ctx.session();
  // Fora da equipe, o admin não existe (404, como qualquer rota desconhecida).
  if(!session?.staff_role)throw fail('Endpoint não encontrado.',404);
  if(ESCRITA.includes(method)&&!sameSecret(req.headers['x-csrf-token'],session.csrf))throw fail('Verificação da sessão falhou. Recarregue a página.',403);
  const precisa=acao=>{if(!PODE_EQUIPE[acao].includes(session.staff_role))throw fail('Sua função na equipe não permite esta ação.',403);};
  const [rec,id,sub,...resto]=path.slice('/api/admin/'.length).split('/');
  const op={session,ip,now,origin,mailer};
  const ok=(status,valor)=>(send(status,valor),true);
  if(rec==='resumo'&&!id&&method==='GET')return ok(200,await R.resumoAdmin(db,now,url));
  if(rec==='banners'&&id==='ocupacao'&&!sub&&method==='GET')return ok(200,await B.ocupacao(db,url,now));
  const crud=CRUD[rec];
  if(crud) {
    if(!id&&method==='GET')return ok(200,await crud.listar(db,url));
    if(!id&&method==='POST'){precisa(crud.acao);return ok(201,await crud.criar(db,{...op,p:await ctx.body()}));}
    if(id&&!sub&&method==='GET')return ok(200,await crud.obter(db,id));
    if(id&&!sub&&method==='PATCH'){precisa(crud.acao);return ok(200,await crud.editar(db,{...op,id,p:await ctx.body()}));}
    if(id&&['publicar','pausar'].includes(sub)&&!resto.length&&method==='POST'&&crud.status){precisa(crud.acao);return ok(200,await crud.status(db,{...op,id,acao:sub,p:await ctx.body()}));}
    throw fail('Endpoint não encontrado.',404);
  }
  if(rec==='redes'&&!id) {
    if(method==='GET')return ok(200,await E.listarRedes(db));
    if(method==='POST'){precisa('empresas');return ok(201,await E.criarRede(db,{...op,p:await ctx.body()}));}
  }
  // Categoria nova pelo formulário da empresa (22.3).
  if(rec==='categorias'&&!id&&method==='POST'){precisa('empresas');return ok(201,await criarCategoria(db,{...op,p:await ctx.body()}));}
  if(rec==='planos') {
    if(!id&&method==='GET')return ok(200,await E.listarPlanos(db));
    if(!id&&method==='POST'){precisa('planos');return ok(201,await E.criarPlano(db,{...op,p:await ctx.body()}));}
    if(id&&!sub&&method==='PATCH'){precisa('planos');return ok(200,await E.editarPlano(db,{...op,id,p:await ctx.body()}));}
  }
  if(rec==='midia') {
    if(!id&&method==='GET')return ok(200,await M.listarMidia(db,url));
    if(!id&&method==='POST'){precisa('midia');return ok(201,await M.enviarMidia(db,{...op,buf:await ctx.raw(MAX_BYTES),declarado:req.headers['content-type']||'',alt:url.searchParams.get('alt'),dir:ctx.mediaDir}));}
    if(id&&!sub&&method==='PATCH'){precisa('midia');return ok(200,await M.editarMidia(db,{...op,id,p:await ctx.body()}));}
    if(id&&!sub&&method==='DELETE'){precisa('midia');return ok(200,await M.removerMidia(db,{...op,id,dir:ctx.mediaDir}));}
  }
  if(rec==='fila') {
    if(!id&&method==='GET')return ok(200,await F.listarFila(db,url));
    if(id&&['aprovar','recusar'].includes(sub)&&method==='POST'){precisa('fila');return ok(200,await F.decidir(db,{...op,id,acao:sub,p:await ctx.body()}));}
  }
  if(rec==='cupons') {
    if(!id&&method==='GET')return ok(200,await listarCuponsAdmin(db,url,now));
    if(/^[a-f0-9]{12}$/.test(id||'')&&['suspender','reativar'].includes(sub)&&!resto.length&&method==='POST'){precisa('cupons');return ok(200,await suspenderCupom(db,{...op,id,acao:sub,p:await ctx.body()}));}
  }
  // Pessoas do Sobre nós (18.7), com a ação de conteúdo. O nome equipe é das contas da equipe (13.4).
  if(rec==='pessoas') {
    if(!id&&method==='GET')return ok(200,await P.listarPessoas(db,url));
    if(!id&&method==='POST'){precisa('conteudo');return ok(201,await P.criarPessoa(db,{...op,p:await ctx.body()}));}
    if(id&&!sub&&method==='GET')return ok(200,await P.obterPessoa(db,id));
    if(id&&!sub&&method==='PATCH'){precisa('conteudo');return ok(200,await P.editarPessoa(db,{...op,id,p:await ctx.body()}));}
    if(id&&!sub&&method==='DELETE'){precisa('conteudo');return ok(200,await P.removerPessoa(db,{...op,id}));}
  }
  if(rec==='auditoria'&&!id&&method==='GET')return ok(200,await U.listarAuditoria(db,url));
  // Acessos dos anunciantes ao painel (21.1): a lista traz e-mails das contas, então pede a ação acessos, e não só ver.
  if(rec==='acessos'&&!id&&method==='GET'){precisa('acessos');return ok(200,await A.listarAcessos(db,url,{equipe:session.staff_role,now}));}
  if(rec==='usuarios') {
    if(!id&&method==='GET')return ok(200,await U.listarUsuarios(db,url));
    if(id==='convite'&&!sub&&method==='POST'){precisa('acessos');return ok(201,await U.convidarAssociado(db,{...op,p:await ctx.body()}));}
    if(id&&!sub&&method==='GET')return ok(200,await U.obterUsuario(db,id));
    if(id&&!sub&&method==='PATCH'){precisa('equipe');return ok(200,await U.editarUsuario(db,{...op,id,p:await ctx.body()}));}
    if(id&&sub==='link-senha'&&method==='POST'){precisa('acessos');return ok(201,await U.linkSenha(db,{...op,id}));}
    if(id&&sub==='acessos'&&resto.length===1&&method==='DELETE'){precisa('acessos');return ok(200,await U.revogarAcesso(db,{...op,id,empresa:resto[0]}));}
    if(id&&sub==='sessoes'&&resto[0]==='encerrar'&&method==='POST'){precisa('acessos');return ok(200,await U.encerrarSessoes(db,{...op,id}));}
  }
  if(rec==='equipe'&&!id&&method==='POST'){precisa('equipe');return ok(201,await U.definirEquipe(db,{...op,p:await ctx.body()}));}
  if(rec==='solicitacoes') {
    if(!id&&method==='GET')return ok(200,await U.listarSolicitacoes(db,url));
    if(id&&!sub&&method==='GET')return ok(200,await U.obterSolicitacao(db,id));
    if(id&&sub==='mensagens'&&method==='POST'){precisa('solicitacoes');return ok(201,await U.responderEquipe(db,{...op,id,p:await ctx.body()}));}
    if(id&&!sub&&method==='PATCH'){precisa('solicitacoes');return ok(200,await U.statusSolicitacao(db,{...op,id,p:await ctx.body()}));}
  }
  if(rec==='relatorios'&&!id&&method==='GET')return ok(200,await R.relatorios(db,url,now));
  throw fail('Endpoint não encontrado.',404);
}
