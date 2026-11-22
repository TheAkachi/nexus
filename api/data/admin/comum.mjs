import { fail } from '../../lib/erros.mjs';
import { normalize, safeURL } from '../../lib/saneamento.mjs';

// Convenções das APIs do admin (contrato 13.3): listas de 20, versão em toda alteração, erro com campo.
export const POR_PAGINA=20;
export const rejectExtra=(p,keys)=>{const extra=Object.keys(p||{}).find(k=>!keys.includes(k));if(extra)throw fail('Campo não permitido.',422,extra);};
export const needVersion=p=>{if(!Number.isInteger(p?.version)||p.version<1)throw fail('Informe a versão que você abriu.',422,'version');return p.version;};
export const conflito=()=>fail('Esta informação mudou desde que você abriu. Recarregue.',409);
export function texto(v,campo,max,{obrigatorio=false,min=0}={}) {
  if(v===undefined&&!obrigatorio)return undefined;
  if(v===null&&!obrigatorio)return '';
  if(typeof v!=='string')throw fail('Valor inválido.',422,campo);
  const t=v.trim();
  if(t.length>max)throw fail(`Use até ${max} caracteres.`,422,campo);
  if((obrigatorio||min)&&t.length<Math.max(1,min))throw fail(min>1?`Use pelo menos ${min} caracteres.`:'Preencha este campo.',422,campo);
  return t;
}
export function imagem(v,campo) {
  if(v===undefined)return undefined;
  if(v===''||v===null)return '';
  const u=typeof v==='string'&&safeURL(v.trim(),{image:true});
  if(!u)throw fail('Use uma imagem da biblioteca ou do portal do Nexus.',422,campo);
  return u;
}
export const dia=(v,campo,{obrigatorio=false}={})=>{
  if((v===undefined||v===''||v===null)&&!obrigatorio)return v===undefined?undefined:null;
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(`${v}T12:00:00Z`)))throw fail('Use a data no formato aaaa-mm-dd.',422,campo);
  return v;
};
export const iso=d=>d?new Date(d).toISOString():null;
export const diaDe=d=>d?(d instanceof Date?d.toISOString():String(d)).slice(0,10):null;

// Paginação: ?page= (a partir de 1); página além da última vem vazia.
export function pagina(url) {
  const p=parseInt(url?.searchParams?.get('page')||'1',10);
  return Number.isInteger(p)&&p>=1&&p<=10000?p:1;
}
export const filtro=(url,k)=>(url?.searchParams?.get(k)||'').trim().slice(0,100);
export function lista(itens,url) {
  const p=pagina(url),total=itens.length;
  return {itens:itens.slice((p-1)*POR_PAGINA,p*POR_PAGINA),total,pagina:p,paginas:Math.max(1,Math.ceil(total/POR_PAGINA))};
}
// Busca de texto sem acento nem caixa, nos campos dados.
export const casa=(q,...campos)=>!q||campos.some(c=>normalize(String(c??'')).includes(normalize(q)));

// Status em português na API; em inglês no banco.
export const STATUS_PT={draft:'rascunho',review:'validacao','pending-review':'rascunho',published:'publicado',paused:'pausado',active:'ativo'};
export const STATUS_DB={rascunho:'draft',validacao:'review',publicado:'published',pausado:'paused'};
export const statusFiltro=(url,mapa=STATUS_DB)=>{const s=filtro(url,'status');return s&&mapa[s]?mapa[s]:'';};
