import { categoryTree } from '../categorias.mjs';
import { byText } from '../../lib/saneamento.mjs';
import { ESPACOS } from '../espacos.mjs';
import { podeEquipe } from '../../admin-api.mjs';
import { rota, titulo, naoEncontrada } from '../rota.mjs';
import * as E from './empresas.mjs';
import * as C from './conteudo.mjs';
import * as B from './banners.mjs';
import * as M from './midia.mjs';
import * as F from './fila.mjs';
import * as U from './usuarios.mjs';
import { listarCuponsAdmin } from '../cupons.mjs';
import * as P from './pessoas.mjs';
import * as R from './relatorios.mjs';
import * as A from './acessos.mjs';

// Página /admin e /admin/<modulo>[/<id>|/novo] (contrato 13.2 e 13.9). dados é o mesmo JSON das APIs do módulo.
const NOMES={resumo:'Resumo',empresas:'Empresas',conteudo:'Conteúdo',banners:'Banners',midia:'Mídia',fila:'Fila de aprovação',cupons:'Cupons',pessoas:'Pessoas',
  relatorios:'Relatórios',auditoria:'Auditoria',usuarios:'Usuários e acessos',acessos:'Acessos ao painel',solicitacoes:'Solicitações'};
const FILTROS=['q','status','page','tipo','aba','editoria','espaco','anunciante','empresa','plano','bairro','categoria','periodo','de','ate','acao','usuario','situacao'];
const comPadrao=(url,padroes)=>{const u=new URL(url);for(const [k,v] of Object.entries(padroes))if(!u.searchParams.get(k))u.searchParams.set(k,v);return u;};

async function lista(db,modulo,url,now,equipe) {
  const tipo=url.searchParams.get('tipo')||'evento',aba=url.searchParams.get('aba');
  if(modulo==='acessos')return A.listarAcessos(db,url,{equipe,now});
  if(modulo==='resumo')return R.resumoAdmin(db,now,url);
  if(modulo==='empresas')return aba==='redes'?E.listarRedes(db):aba==='planos'?E.listarPlanos(db):E.listarEmpresas(db,url);
  if(modulo==='conteudo')return {evento:C.listarEventos,oferta:C.listarOfertas,colecao:C.listarColecoes}[tipo]?.(db,url)??C.listarConteudo(db,url);
  if(modulo==='banners')return aba==='ocupacao'?B.ocupacao(db,url,now):B.listarBanners(db,url);
  if(modulo==='midia')return M.listarMidia(db,url);
  if(modulo==='fila')return F.listarFila(db,url);
  if(modulo==='cupons')return listarCuponsAdmin(db,url,now);
  if(modulo==='pessoas')return P.listarPessoas(db,url);
  if(modulo==='relatorios')return R.relatorios(db,url,now);
  if(modulo==='auditoria')return U.listarAuditoria(db,url);
  if(modulo==='usuarios')return U.listarUsuarios(db,url);
  if(modulo==='solicitacoes')return U.listarSolicitacoes(db,url);
}
async function registro(db,modulo,id,url) {
  const tipo=url.searchParams.get('tipo')||'evento',aba=url.searchParams.get('aba');
  if(modulo==='empresas')return aba==='planos'?(await E.listarPlanos(db)).itens.find(p=>p.id===id)||null:aba==='redes'?null:E.obterEmpresa(db,id);
  if(modulo==='conteudo')return ({evento:C.obterEvento,oferta:C.obterOferta,colecao:C.obterColecao}[tipo]||C.obterConteudo)(db,id);
  if(modulo==='banners')return B.obterBanner(db,id);
  if(modulo==='midia')return (await M.listarMidia(db,new URL('http://x/?page=1'))).itens.find(m=>m.id===id)||(await db.query("SELECT * FROM media WHERE id=$1 AND kind='midia' AND status<>'removida'",[id])).rows.map(M.midiaVM)[0]||null;
  if(modulo==='usuarios')return U.obterUsuario(db,id);
  if(modulo==='pessoas')return P.obterPessoa(db,id);
  if(modulo==='solicitacoes')return U.obterSolicitacao(db,id);
  return null;
}
async function opcoes(db) {
  const empresas=(await db.query('SELECT id,name,district,details FROM businesses ORDER BY name')).rows;
  const editorias=new Map();
  for(const r of (await db.query("SELECT metadata->'editorias' AS e FROM content WHERE kind='article'")).rows)for(const e of r.e||[])editorias.set(e.slug,e);
  return {categorias:categoryTree(empresas,{all:true}),bairros:[...new Set(empresas.map(b=>b.district).filter(Boolean))].sort(byText),
    planos:(await db.query('SELECT id,name FROM plans ORDER BY rank DESC,name')).rows.map(p=>({id:p.id,nome:p.name})),
    redes:(await db.query('SELECT id,name FROM business_groups ORDER BY name')).rows.map(r=>({id:r.id,nome:r.name})),
    empresas:empresas.map(b=>({id:b.id,nome:b.name})),editorias:[...editorias.values()].sort((a,b)=>byText(a.label,b.label)),
    espacos:ESPACOS.map(e=>({id:e.id,pagina:e.pagina,onde:e.onde,formatos:{computador:[...e.computador],celular:[...e.celular]},giram:e.giram,casa:e.casa}))};
}
const contagemAdmin=async db=>({fila:await F.contarFila(db),solicitacoes:(await db.query("SELECT count(*)::int AS n FROM requests WHERE status IN ('aberta','em-andamento')")).rows[0].n});
export async function loadAdmin({db,session,path,url,now}) {
  // Sem sessão, volta ao mesmo lugar depois do login; a lista de acessos aberta numa empresa volta com a empresa (21.2).
  if(!session) {
    const empresa=url?.searchParams.get('empresa')||'';
    const volta=path==='/admin/acessos'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(empresa)?`${path}?empresa=${empresa}`:/^\/admin(\/[a-z0-9:%-]+)*$/i.test(path)?path:'/admin';
    return {redirect:`/entrar?next=${encodeURIComponent(volta)}`};
  }
  if(!session.staff_role)return naoEncontrada();
  const m=/^\/admin(?:\/([a-z]+)(?:\/([^/]+))?)?$/.exec(path);
  const modulo=m?.[1]||'resumo',id=m?.[2]?decodeURIComponent(m[2]):null;
  if(!m||!NOMES[modulo]||(id&&modulo==='resumo'))return naoEncontrada();
  // Padrões das abas: relatórios de 30 dias; ocupação de hoje a 29 dias à frente (o banners.mjs completa as datas).
  const u=comPadrao(url,modulo==='relatorios'?{periodo:'30d'}:{});
  const filtros=Object.fromEntries(FILTROS.filter(k=>u.searchParams.get(k)).map(k=>[k,u.searchParams.get(k)]));
  const base={usuario:{id:session.user_id,email:session.email,nome:session.name||''},csrf:session.csrf,equipe:session.staff_role,pode:podeEquipe(session.staff_role),modulo,filtros};
  const meta=t=>({title:titulo(`${t} · Admin`),description:'Admin da equipe Nexus: empresas, conteúdo, banners, cupons, aprovação e relatórios do Guia Comercial.'});
  // Acessos ao painel (21.2): a lista traz e-mails das contas e só abre com a ação acessos; sem ela, 403 sem os dados.
  if(modulo==='acessos'&&(id||!podeEquipe(session.staff_role).acessos)) {
    if(id)return naoEncontrada();
    return rota('admin',{...base,dados:null,opcoes:await opcoes(db),contagem:await contagemAdmin(db)},{...meta('Sem permissão'),status:403});
  }
  let dados;
  try{dados=id==='novo'?null:id?await registro(db,modulo,id,u):await lista(db,modulo,u,now,session.staff_role);}
  catch(e){if(e.status===404)return naoEncontrada();throw e;}
  if(id&&id!=='novo'&&!dados)return naoEncontrada();
  if(id)filtros.id=id;
  if(modulo==='banners'&&filtros.aba==='ocupacao'&&dados){filtros.de=dados.de;filtros.ate=dados.ate;}
  return rota('admin',{...base,dados,opcoes:await opcoes(db),contagem:await contagemAdmin(db)},meta(NOMES[modulo]));
}
