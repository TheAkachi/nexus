import { fail } from '../lib/erros.mjs';
import { origemDe } from './cadastro.mjs';
import { textoDoCadastro } from '../cadastro.mjs';

// Pedidos do cadastro para a gestão, os leads (contrato 23), só com LEADS_LIGADOS=1. O site guarda o código, as respostas
// de escolher, a origem e a hora: nada de nome, telefone, e-mail, IP, sessão ou navegador. Guarda proposta de 30 dias [SEG].
export const leadsDoAmbiente=(valor=process.env.LEADS_LIGADOS)=>valor==='1';
const ALFABETO='ACDEFHJKMNPRTUVWXY3479',GUARDA_DIAS=30,POR_PAGINA=100;
// Sem 0/O, 1/I/L, 2/Z, 5/S, 6/G e 8/B: o código é lido e digitado por gente.
export const gerarCodigo=(random=Math.random,tamanho=4)=>Array.from({length:tamanho},()=>ALFABETO[Math.floor(random()*ALFABETO.length)]).join('');
export const limparPedidos=(db,now=new Date())=>db.query('DELETE FROM signup_requests WHERE criado_em<$1',[new Date(now.getTime()-GUARDA_DIAS*86400000).toISOString()]);

// Grava o pedido válido e devolve o código; um igual a outro é sorteado de novo (5 vezes com 4 caracteres, depois com 5).
// Se a gravação falhar, devolve '' e a pessoa segue para o WhatsApp sem a linha do pedido; o log não leva as respostas.
export async function guardarPedido(db,{values,origem,now=new Date(),random=Math.random,logger=()=>{}}) {
  try {
    await limparPedidos(db,now);
    for(let i=0;i<10;i++) {
      const codigo=gerarCodigo(random,i<5?4:5);
      const r=await db.query('INSERT INTO signup_requests(codigo,respostas,origem,criado_em) VALUES($1,$2::jsonb,$3,$4) ON CONFLICT (codigo) DO NOTHING RETURNING codigo',
        [codigo,JSON.stringify(values),origemDe(origem),now.toISOString()]);
      if(r.rows.length)return codigo;
    }
  } catch { logger({error:'pedido_nao_gravado'}); }
  return '';
}

// GET /api/integracao/v1/pedidos?desde=&page= (23.3): os pedidos desde a hora pedida, inclusive, do mais velho para o mais
// novo. O igual a desde volta de novo de propósito; a gestão ignora o código que já tem.
export async function pedidosDesde(db,url,{now=new Date(),origin}) {
  const desde=url.searchParams.get('desde')||'',d=new Date(desde);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(desde)||Number.isNaN(d.getTime()))throw fail('Informe desde como data e hora ISO.',422,'desde');
  const pagina=Math.max(1,parseInt(url.searchParams.get('page')||'1',10)||1);
  await limparPedidos(db,now);
  const total=(await db.query('SELECT count(*)::int AS n FROM signup_requests WHERE criado_em>=$1',[d.toISOString()])).rows[0].n;
  const rows=(await db.query('SELECT codigo,respostas,origem,criado_em FROM signup_requests WHERE criado_em>=$1 ORDER BY criado_em,codigo LIMIT $2 OFFSET $3',
    [d.toISOString(),POR_PAGINA,(pagina-1)*POR_PAGINA])).rows;
  return {itens:rows.map(r=>({codigo:r.codigo,texto:textoDoCadastro(r.respostas,origin,r.codigo),respostas:r.respostas,origem:r.origem,criadoEm:new Date(r.criado_em).toISOString()})),
    total,pagina,paginas:Math.max(1,Math.ceil(total/POR_PAGINA))};
}
