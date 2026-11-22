import { fail } from './lib/erros.mjs';

// Permissão por empresa e por ação (contrato 12.1), sempre conferida no servidor.
export const ACOES=['ver','perfil','catalogo','cupons','plano','solicitar','acessos'];
const ASSOCIADO={ver:['dono','editor','financeiro','leitura'],perfil:['dono','editor'],catalogo:['dono','editor'],cupons:['dono','editor'],plano:['dono','financeiro'],solicitar:['dono','editor','financeiro'],acessos:['dono']};
const EQUIPE={ver:['admin','editor','operador'],perfil:['admin'],catalogo:['admin'],cupons:['admin'],plano:['admin','editor','operador'],solicitar:['admin','editor','operador'],acessos:['admin']};
export const PAPEIS=['dono','editor','financeiro','leitura'];
export const pode=(papel,equipe,acao)=>Boolean(papel&&ASSOCIADO[acao]?.includes(papel)||equipe&&EQUIPE[acao]?.includes(equipe));

// Acesso da sessão à empresa: papel (vínculo ativo), papel na equipe e as ações resolvidas. Sem relação nenhuma: null,
// e quem chama responde 404, igual a uma empresa inexistente (não revela que a empresa existe).
export async function acessoA(db,session,businessId) {
  const empresa=(await db.query('SELECT id,slug,name,status,version FROM businesses WHERE id=$1',[businessId])).rows[0];
  if(!empresa||!session)return null;
  const papel=(await db.query('SELECT role FROM memberships WHERE user_id=$1 AND business_id=$2 AND active=true',[session.user_id,businessId])).rows[0]?.role||null;
  const equipe=session.staff_role||null;
  if(!papel&&!equipe)return null;
  return {empresa,papel,equipe,pode:Object.fromEntries(ACOES.filter(a=>a!=='ver').map(a=>[a,pode(papel,equipe,a)]))};
}
export function exigir(acesso,acao) {
  if(!acesso)throw fail('Empresa não encontrada.',404);
  if(!pode(acesso.papel,acesso.equipe,acao))throw fail('Você não tem permissão para esta ação nesta empresa.',403);
}
