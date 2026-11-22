// Saneamento por lista branca do HTML das notícias e artigos (contrato: Conteudo.bodyHtml).
// Ficam só as marcas da lista (h1 vira h2, h5/h6 viram h4, b/i viram strong/em); as demais somem e o texto delas fica.
// script, style e afins somem com o conteúdo. Nenhum atributo passa, exceto a[href] e img[src, alt]:
// link só https (http vira https) ou caminho do site (rewriteLink troca os do portal antigo pelas páginas novas);
// imagem só do portal, e a de outro site (que a CSP bloquearia) vira link para a imagem, com a legenda.
import { escape } from './html.mjs';
import { safeURL, withoutTracking, oneLine } from './saneamento.mjs';

const TAGS={p:'p',h1:'h2',h2:'h2',h3:'h3',h4:'h4',h5:'h4',h6:'h4',ul:'ul',ol:'ol',li:'li',table:'table',thead:'thead',tbody:'tbody',tr:'tr',th:'th',td:'td',blockquote:'blockquote',strong:'strong',b:'strong',em:'em',i:'em',a:'a',img:'img',figure:'figure',figcaption:'figcaption',br:'br'};
const VOID=new Set(['br','img']);
const DROP=new Set(['script','style','iframe','object','embed','noscript','template','svg','math','head','title','textarea','select','option','button','form','video','audio','canvas']);
const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):Number(e.slice(1))):ENTITIES[e.toLowerCase()]??m);
// Texto: mantém as entidades válidas, escapa < e > e o & solto.
const text=s=>s.replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]{1,31});)/gi,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const attrs=s=>{const out={};for(const m of s.matchAll(/([^\s=/"']+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g))out[m[1].toLowerCase()]=decode(m[3]??m[4]??m[5]??'');return out;};
const internal=href=>/^\/(?!\/)[^\s<>"]*$/.test(href);
// Link http vira https (o site só aponta para https); link interno fica como está.
const external=href=>withoutTracking(safeURL(String(href).trim().replace(/^http:\/\//i,'https://')));

export function sanitizeHtml(html,{rewriteLink=href=>href}={}) {
  let out='',skip=null;const open=[];
  const tokens=String(html||'').replace(/<!--[\s\S]*?-->/g,'').split(/(<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>)/);
  for(const token of tokens) {
    const tag=/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>$/.exec(token);
    if(!tag){if(!skip)out+=text(token);continue;}
    const [,closing,rawName,rest]=tag,name=rawName.toLowerCase();
    if(skip){if(closing&&name===skip)skip=null;continue;}
    if(DROP.has(name)){if(!closing&&!/\/\s*$/.test(rest))skip=name;continue;}
    const safe=TAGS[name];if(!safe)continue;
    if(closing){const i=open.lastIndexOf(safe);if(i<0)continue;while(open.length>i)out+=`</${open.pop()}>`;continue;}
    if(safe==='img'){
      const a=attrs(rest),src=safeURL(a.src,{image:true});
      if(src){out+=`<img src="${escape(src)}" alt="${escape(a.alt||'')}" loading="lazy">`;continue;}
      // Imagem de fora do portal (a CSP não deixa exibir): vira link para a imagem, com a legenda, para não se perder.
      const href=external(a.src||''),label=`Imagem: ${a.alt?oneLine(a.alt):'ver na fonte'}`;
      if(href)out+=open.includes('a')?escape(label):`<a href="${escape(href)}" rel="noopener noreferrer">${escape(label)}</a>`;
      continue;
    }
    if(safe==='br'){out+='<br>';continue;}
    if(safe==='a'){
      const href=rewriteLink(attrs(rest).href||''),link=internal(href)?href:external(href);
      // Link inválido: some a marca e fica o texto (o fechamento sem par é ignorado).
      if(!link)continue;
      out+=internal(link)?`<a href="${escape(link)}">`:`<a href="${escape(link)}" rel="noopener noreferrer">`;open.push('a');continue;
    }
    out+=`<${safe}>`;if(!VOID.has(safe))open.push(safe);
  }
  while(open.length)out+=`</${open.pop()}>`;
  // Parágrafos e títulos vazios (só espaço, &nbsp; ou <br>) não chegam à página.
  return out.replace(/<(p|h2|h3|h4|li|figcaption)>(\s|&nbsp;|&#160;|<br>)*<\/\1>/gi,'').replace(/\r\n?/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

// Texto corrido a partir do HTML saneado (busca, resumo e tempo de leitura das publicações criadas no admin).
const ENTIDADES={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' '};
export function textoDoHtml(html) {
  return String(html||'').replace(/<\/(p|h[2-4]|li|blockquote|figcaption|tr)>|<br>/gi,'\n').replace(/<[^>]*>/g,'')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g,m=>ENTIDADES[m]).split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}
