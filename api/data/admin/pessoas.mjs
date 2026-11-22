import { randomUUID } from 'node:crypto';
import { fail } from '../../lib/erros.mjs';
import { audit, diff } from '../../lib/auditoria.mjs';
import { oneLine } from '../../lib/saneamento.mjs';
import { rejectExtra, needVersion, conflito, texto, lista } from './comum.mjs';

// Pessoas do Nexus na página Sobre nós (contrato 18.7). A foto é uma imagem da biblioteca de mídia; sem foto, a pessoa
// fica no admin mas não aparece no site.
const pessoaVM=p=>({id:p.id,nome:p.name,funcao:p.role,foto:p.media_id||null,ordem:p.position,version:p.version});
export async function listarPessoas(db,url) {
  return lista((await db.query('SELECT * FROM about_people ORDER BY position,name')).rows.map(pessoaVM),url);
}
async function pessoa(db,id,{lock=false}={}) {
  const p=(await db.query(`SELECT * FROM about_people WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
  if(!p)throw fail('Pessoa não encontrada.',404);
  return p;
}
export const obterPessoa=async(db,id)=>pessoaVM(await pessoa(db,id));
async function validar(db,p,{novo}) {
  const v={};
  const nome=texto(p.nome,'nome',80,{obrigatorio:novo,min:2});if(nome!==undefined)v.name=oneLine(nome);
  const funcao=texto(p.funcao,'funcao',80);if(funcao!==undefined)v.role=oneLine(funcao);
  if(p.foto!==undefined) {
    if(p.foto!==null&&(typeof p.foto!=='string'||!(await db.query("SELECT 1 FROM media WHERE id=$1 AND kind='midia' AND status='aprovada'",[p.foto])).rows.length))
      throw fail('Escolha uma imagem da biblioteca de mídia.',422,'foto');
    v.media_id=p.foto;
  }
  if(p.ordem!==undefined){if(!Number.isInteger(p.ordem)||p.ordem<0||p.ordem>999)throw fail('Use uma ordem de 0 a 999.',422,'ordem');v.position=p.ordem;}
  return v;
}
export async function criarPessoa(db,{p,session,ip,now=new Date()}) {
  rejectExtra(p,['nome','funcao','foto','ordem']);
  const v=await validar(db,p,{novo:true}),id=randomUUID();
  await db.query('INSERT INTO about_people(id,name,role,media_id,position,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6)',
    [id,v.name,v.role||'',v.media_id||null,v.position??0,now.toISOString()]);
  const vm=await obterPessoa(db,id);
  await audit(db,{actor:session.user_id,action:'pessoa_criada',resource:id,after:vm,ip});
  return vm;
}
export async function editarPessoa(db,{id,p,session,ip,now=new Date()}) {
  rejectExtra(p,['nome','funcao','foto','ordem','version']);
  const version=needVersion(p),v=await validar(db,p,{novo:false});
  return db.transaction(async tx=>{
    const atual=await pessoa(tx,id,{lock:true});if(atual.version!==version)throw conflito();
    await tx.query('UPDATE about_people SET name=$2,role=$3,media_id=$4,position=$5,updated_at=$6,version=version+1 WHERE id=$1',
      [id,v.name??atual.name,v.role??atual.role,v.media_id!==undefined?v.media_id:atual.media_id,v.position??atual.position,now.toISOString()]);
    const antes=pessoaVM(atual),depois=pessoaVM(await pessoa(tx,id)),mudou=diff(antes,depois);
    await audit(tx,{actor:session.user_id,action:'pessoa_editada',resource:id,before:mudou.before,after:mudou.after,ip});
    return depois;
  });
}
export async function removerPessoa(db,{id,session,ip}) {
  const atual=await pessoa(db,id);
  await db.query('DELETE FROM about_people WHERE id=$1',[id]);
  await audit(db,{actor:session.user_id,action:'pessoa_removida',resource:id,before:pessoaVM(atual),ip});
  return {ok:true};
}
