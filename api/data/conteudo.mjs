import { normalize, safeURL, clip, slugify, byText, oneLine } from '../lib/saneamento.mjs';
import { activeCampaigns } from './campanhas.mjs';
import { adsFor } from './anuncios.mjs';
import { rota, titulo, indisponivel, naoEncontrada } from './rota.mjs';

// Seções públicas de publicação. As notícias saíram do site na v0.15.0 (contrato 15): ficam no banco, sem aparecer.
export const KIND_PATHS={article:'artigos',classified:'classificados'};
const LABELS={article:'Ideias e histórias',classified:'Classificados locais'};
const DESCRICOES={
  article:'Artigos e dicas do Nexus para quem empreende e para quem vive em Rio de Janeiro.',
  classified:'Classificados de empresas e moradores de Rio de Janeiro publicados no Nexus.'
};
const image=src=>safeURL(src,{image:true})?src:'';
// Tempo de leitura a 200 palavras por minuto, no mínimo 1.
const readingMinutes=c=>Math.max(1,Math.round((Number(c.metadata?.words)||(c.body.match(/\S+/g)||[]).length)/200));
// Editorias da publicação (categorias do portal); sem a lista, o rótulo do portal vira a única editoria.
const editoriasOf=c=>{if(c.metadata?.editorias?.length)return c.metadata.editorias;const label=oneLine(c.metadata?.category);return label?[{slug:slugify(label),label}]:[];};
const editoriaOf=c=>editoriasOf(c)[0]||null;

// vm CardConteudo
export const contentCardVM=c=>({href:`/${KIND_PATHS[c.kind]}/${c.slug}`,title:c.title,image:image(c.metadata?.image),category:c.metadata?.category||'',kind:c.kind,excerpt:c.body.slice(0,160),author:c.metadata?.author||'',
  editoria:editoriaOf(c)?.slug||'',readingMinutes:readingMinutes(c),...(c.kind==='classified'?{price:c.metadata?.price||''}:{})});

// Notícia que saiu do guia (15.1): 410, para os buscadores tirarem o endereço do índice. /noticias vai para /artigos no servidor.
export const noticiaRemovida=()=>rota('indisponivel',{},{title:titulo('Notícia removida'),status:410,
  description:'As notícias saíram do Nexus. Veja os artigos, os cupons e as empresas de Rio de Janeiro.'});
// /artigos e /classificados (lista com busca, filtro por editoria e páginas de 12; além da última, 404) e
// /<seção>/<slug> (leitura). Outros caminhos: null.
export async function loadConteudo({db,path,url,now=new Date(),random}) {
  if(path.startsWith('/noticias/'))return noticiaRemovida();
  const section=Object.values(KIND_PATHS).find(k=>path===`/${k}`||path.startsWith(`/${k}/`));
  if(!section)return null;
  const kind=Object.keys(KIND_PATHS).find(k=>KIND_PATHS[k]===section),label=LABELS[kind],campaigns=await activeCampaigns(db,now);
  if(path===`/${section}`) {
    const q=(url.searchParams.get('q')||'').slice(0,100);
    const all=(await db.query("SELECT * FROM content WHERE kind=$1 AND status='published' ORDER BY metadata->>'date' DESC NULLS LAST,title",[kind])).rows;
    // vm Editoria[] com a contagem; editoria desconhecida no ?editoria= mostra a lista toda.
    const editorias=[...all.reduce((m,c)=>{for(const e of editoriasOf(c))m.set(e.slug,{...e,count:(m.get(e.slug)?.count||0)+1});return m;},new Map()).values()].sort((a,b)=>byText(a.label,b.label));
    const editoria=editorias.some(e=>e.slug===url.searchParams.get('editoria'))?url.searchParams.get('editoria'):'';
    // Destaque (18.6): só em /artigos sem busca nem editoria. O marcado no admin ou, sem marcação, o mais recente com foto;
    // ele sai da lista em todas as páginas, para a paginação não pular nem repetir.
    const destaque=kind==='article'&&!q&&!editoria?all.find(c=>c.metadata?.destaque===true)||all.find(c=>image(c.metadata?.image))||null:null;
    const rows=all.filter(c=>c!==destaque&&normalize(c.title).includes(normalize(q))&&(!editoria||editoriasOf(c).some(e=>e.slug===editoria)));
    const pages=Math.max(1,Math.ceil(rows.length/12)),requested=parseInt(url.searchParams.get('page')||'1')||1;
    if(requested>pages)return naoEncontrada();
    const current=Math.max(1,requested),editoriaLabel=editorias.find(e=>e.slug===editoria)?.label;
    const page=rows.slice((current-1)*12,current*12),ads=adsFor('conteudos',{campaigns,random,itens:page.length});
    return rota('conteudos',{section,label,q,pages,current,items:page.map(contentCardVM),ads,editorias,editoria,destaque:destaque&&current===1?contentCardVM(destaque):null},
      {title:titulo(`${label}${editoriaLabel?` · ${editoriaLabel}`:''}${q?` sobre “${q.trim()}”`:''}${current>1?` · página ${current}`:''}`),
       description:clip(`${DESCRICOES[kind]}${editoriaLabel?` Editoria: ${editoriaLabel}.`:''}${current>1?` Página ${current} de ${pages}.`:''}`)});
  }
  const slug=path.slice(section.length+2),c=(await db.query("SELECT * FROM content WHERE kind=$1 AND slug=$2 AND status='published'",[kind,slug])).rows[0];
  if(!c)return indisponivel();
  const m=c.metadata,date=m.date&&Number.isFinite(Date.parse(m.date))?new Date(m.date).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
  // Leitura de artigo: espaços do texto, da lateral e do fim; classificado não tem anúncio (contrato 11.2).
  const paragrafos=c.body_html?(c.body_html.match(/<p>/g)||[]).length:c.body.split(/\n+/).filter(Boolean).length;
  const ads=kind==='classified'?{}:adsFor('conteudo',{campaigns,random,paragrafos});
  const vm={section,label,title:c.title,category:m.category||'',author:m.author||'',date,image:image(m.image),paragraphs:c.body.split(/\n+/).filter(Boolean),sourceUrl:safeURL(c.source_url)?c.source_url:'',ads,
    bodyHtml:c.body_html||'',editoria:editoriaOf(c),editorias:editoriasOf(c),readingMinutes:readingMinutes(c),gallery:(m.gallery||[]).filter(src=>image(src)).map((src,i)=>({src,alt:`${c.title} · foto ${i+1}`}))};
  // Classificado: preço, contato e a empresa que anunciou.
  if(kind==='classified') {
    const business=m.business?(await db.query("SELECT slug,name FROM businesses WHERE id=$1 AND status='published'",[m.business])).rows[0]||null:null;
    const digits=String(m.phone||'').replace(/\D/g,''),number=digits.length>=10&&digits.length<=11?`55${digits}`:'';
    Object.assign(vm,{price:m.price||'',phone:oneLine(m.phone),phoneUrl:digits?`tel:${digits}`:'',whatsappUrl:/^55\d{2}9\d{8}$/.test(number)?`https://wa.me/${number}?text=${encodeURIComponent(`Olá! Vi o classificado "${c.title}" no Nexus.`)}`:'',business});
  }
  return rota('conteudo',vm,{title:titulo(c.title),description:clip(m.summary||c.body),ogImage:image(m.image)||vm.gallery[0]?.src||''});
}
