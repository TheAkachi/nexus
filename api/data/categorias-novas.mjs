import { fail } from '../lib/erros.mjs';
import { audit } from '../lib/auditoria.mjs';
import { oneLine, slugify } from '../lib/saneamento.mjs';
import { compararNomes } from '../lib/parecidos.mjs';
import { GRUPOS, nomesDaLista, apelidos, homeGroupLabels, normalizeCategory, groupsOfCategory, carregarCategorias } from './categorias.mjs';
import { rejectExtra } from './admin/comum.mjs';

// Categorias novas (contrato 22): a criação pelo admin (22.3), a sugestão do painel (22.4) e a decisão da fila (22.5).
export const grupoVM=slug=>{const g=GRUPOS.find(x=>x.slug===slug);return g?{slug:g.slug,label:g.label}:null;};
// Nome de 2 a 60 caracteres numa linha e um dos 10 grupos. campo: onde o erro aponta (no painel, a sugestão inteira).
export function validarCategoriaNova(p,campo) {
  const nome=typeof p?.nome==='string'?oneLine(p.nome):'';
  if(nome.length<2||nome.length>60)throw fail('Use de 2 a 60 caracteres no nome da categoria.',422,campo||'nome');
  if(!grupoVM(p?.grupo))throw fail('Escolha o grupo da categoria.',422,campo||'grupo');
  return {nome,grupo:p.grupo};
}
// Igual: uma categoria da lista, um apelido do portal antigo, um grupo ou "Outra" com o mesmo nome (22.2). Parecidas: só
// as da lista, com os grupos e quantas empresas publicadas têm cada uma.
export async function compararCategoria(db,nome) {
  const {igual}=compararNomes(nome,[...nomesDaLista(),...apelidos(),...homeGroupLabels,'Outra']);
  const {parecidos}=compararNomes(nome,nomesDaLista());
  const contagem=new Map(parecidos.length?(await db.query(`SELECT c,count(*)::int AS n FROM businesses,jsonb_array_elements_text(COALESCE(details->'categories','[]'::jsonb)) c
    WHERE status='published' AND c=ANY($1) GROUP BY c`,[parecidos])).rows.map(r=>[r.c,r.n]):[]);
  return {igual:igual===null?null:{nome:normalizeCategory(igual)},
    parecidas:parecidos.map(n=>({nome:n,grupos:groupsOfCategory(n).map(grupoVM).filter(Boolean),empresas:contagem.get(n)||0}))};
}
// Grava a categoria e a auditoria, dentro da transação de quem chama; depois do COMMIT, quem chama relê a lista.
export async function inserirCategoria(tx,{nome,grupo,session,ip,now=new Date()}) {
  await tx.query('INSERT INTO categories(nome,slug,grupo,criada_em,criada_por) VALUES($1,$2,$3,$4,$5)',[nome,slugify(nome),grupo,now.toISOString(),session.user_id]);
  await audit(tx,{actor:session.user_id,action:'categoria_criada',resource:slugify(nome),after:{nome,grupo},ip});
  return {nome,slug:slugify(nome),grupos:[grupoVM(grupo)],criadaEm:now.toISOString()};
}
// POST /api/admin/categorias (22.3): o igual é recusado; com parecidas, só cria com confirmar: true.
export async function criarCategoria(db,{p,session,ip,now=new Date()}) {
  rejectExtra(p,['nome','grupo','confirmar']);
  if(p.confirmar!==undefined&&typeof p.confirmar!=='boolean')throw fail('Valor inválido.',422,'confirmar');
  const v=validarCategoriaNova(p),c=await compararCategoria(db,v.nome);
  if(c.igual)throw fail(`Já existe a categoria "${c.igual.nome}".`,422,'nome',{igual:c.igual});
  if(c.parecidas.length&&p.confirmar!==true)throw fail('Há categorias parecidas: confira antes de criar.',422,'nome',{parecidas:c.parecidas});
  const criada=await db.transaction(tx=>inserirCategoria(tx,{...v,session,ip,now}));
  await carregarCategorias(db,{forcar:true});
  return criada;
}
