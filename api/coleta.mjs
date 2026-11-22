import { parseHTML } from 'linkedom';
import { localNow } from './lib/horario.mjs';
import { gravarPublicacao, linkReescrito } from './import.mjs';

// Coleta diária do portal antigo até a Fase 5 (contrato 13.7). É o coletor do histórico (6e6d716), reduzido aos artigos
// (as notícias saíram do site, 15.4): respeita o robots.txt, espera 1,1 s entre os pedidos e só busca o que é novo, mudou (lastmod) ou saiu há pouco.
// Grava pela mesma função do db:seed, sem tocar no que a equipe editou no admin. Para sozinha a partir de COLETA_ATE.
export const PORTAL='/para-empresas';
const UA='Mozilla/5.0 (compatible; Nexus-migracao-de-conteudo/1.0)';
const T=s=>(s||'').replace(/\s+/g,' ').trim();
const abs=u=>{try{return new URL(String(u||'').trim(),PORTAL).href;}catch{return '';}};
const rel=u=>(u||'').replace(PORTAL,'').replace('https://nexus.demo','');
const dom=html=>parseHTML(html||'<html><body></body></html>').document;
const $=(r,s)=>r.querySelector(s),$$=(r,s)=>[...r.querySelectorAll(s)];
const txt=(r,s)=>T($(r,s)?.textContent);
const meta=(d,n)=>$(d,`meta[name="${n}"]`)?.getAttribute('content')||$(d,`meta[property="${n}"]`)?.getAttribute('content')||'';
const words=s=>(s.match(/\S+/g)||[]).length;
function jsonLd(doc,tipos) {
  for(const s of $$(doc,'script[type="application/ld+json"]')){try{const j=JSON.parse(s.textContent);if(!tipos||tipos.includes(j['@type']))return j;}catch{}}
  return null;
}
// Corpo: atributos só os úteis, links e imagens absolutos (o saneamento do bodyHtml vem depois, na gravação).
const MANTER=new Set(['href','src','alt','title']);
function corpoHtml(el) {
  if(!el)return '';
  const d=dom(`<html><body><div id="raiz">${el.innerHTML}</div></body></html>`),raiz=$(d,'#raiz');
  $$(raiz,'script, style, noscript, form, input, button, link, meta').forEach(n=>n.remove());
  for(const n of $$(raiz,'*')){for(const a of [...n.attributes])if(!MANTER.has(a.name))n.removeAttribute(a.name);if(n.getAttribute('href'))n.setAttribute('href',abs(n.getAttribute('href')));if(n.getAttribute('src'))n.setAttribute('src',abs(n.getAttribute('src')));}
  return raiz.innerHTML.trim();
}
function textoCorrido(el) {
  if(!el)return '';
  const html=el.innerHTML.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|h[1-6]|li|tr|div|blockquote|ul|ol)>/gi,'\n');
  return ($(dom(`<html><body><div id="r">${html}</div></body></html>`),'#r').textContent||'').split('\n').map(l=>l.replace(/[ \t ]+/g,' ').trim()).filter(Boolean).join('\n');
}
const imagemOriginal=url=>{const m=/(?:\/media\/cache\/(?:resolve\/)?[^/]+)?(\/custom\/domain_1\/image_files\/.+)$/.exec(rel(abs(url)));return m?PORTAL+m[1]:abs(url);};
export function extrairArtigo(html,caminho) {
  const doc=dom(html),ld=jsonLd(doc,['NewsArticle','Article'])||jsonLd(doc),corpo=$(doc,'.article-description'),texto=textoCorrido(corpo);
  return {slug:caminho.replace('/artigo/','').replace(/\.html$/,''),url:PORTAL+caminho,titulo:txt(doc,'.article-title')||ld?.headline||'',publicadoEm:ld?.datePublished||'',
    editoria:ld?.articleSection||'',categorias:$$(doc,'.article-categories a').map(a=>({nome:T(a.textContent),link:rel(a.getAttribute('href'))})),
    autor:txt(doc,'.author-name')||(typeof ld?.author==='string'?ld.author:ld?.author?.name||''),resumo:ld?.description||meta(doc,'description'),
    imagem:{original:imagemOriginal(ld?.image||meta(doc,'og:image'))},galeria:[...new Set($$(doc,'.detail-gallery-main-image a[href], .detail-gallery-thumb-images a[href]').map(a=>abs(a.getAttribute('href'))))],
    html:corpoHtml(corpo),texto,palavras:words(texto)};
}
// robots.txt: as regras de "User-agent: *" (o asterisco no caminho vale qualquer trecho).
export function regrasRobots(texto) {
  const bloqueios=[],libera=[];let todos=false;
  for(const linha of String(texto).split(/\r?\n/)) {
    const [k,...v]=linha.split(':'),chave=k.trim().toLowerCase(),valor=v.join(':').trim();
    if(chave==='user-agent')todos=valor==='*';
    else if(todos&&chave==='disallow'&&valor)bloqueios.push(valor);
    else if(todos&&chave==='allow'&&valor)libera.push(valor);
  }
  // Vale a regra mais específica (a mais longa) que casa com o caminho; no empate, libera.
  const casa=(p,regra)=>new RegExp('^'+regra.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*')).test(p);
  const maior=(regras,p)=>Math.max(-1,...regras.filter(r=>casa(p,r)).map(r=>r.length));
  return caminho=>maior(libera,caminho)>=maior(bloqueios,caminho);
}
const entradas=xml=>[...String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m=>({loc:(/<loc>([^<]+)<\/loc>/.exec(m[1])||[])[1]||'',lastmod:(/<lastmod>([^<]+)<\/lastmod>/.exec(m[1])||[])[1]||''})).filter(e=>e.loc);

export async function coletar(db,{fetchImpl=globalThis.fetch,espera=1100,now=new Date(),ate=process.env.COLETA_ATE||'',limite=80,log=()=>{}}={}) {
  const hoje=localNow(now).date;
  if(ate&&hoje>ate)return {parada:true,ate,novas:0,atualizadas:0,ignoradas:0,erros:[]};
  let ultimo=0;
  const pegar=async caminho=>{
    const falta=ultimo+espera-Date.now();if(falta>0)await new Promise(r=>setTimeout(r,falta));ultimo=Date.now();
    const r=await fetchImpl(abs(caminho),{headers:{'User-Agent':UA,'Accept-Language':'pt-BR,pt;q=0.9'},signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(`${r.status} em ${rel(abs(caminho))}`);return r.text();
  };
  const permitido=regrasRobots(await pegar('/robots.txt').catch(()=>''));
  const indice=await pegar('/sitemap.xml');
  const subs=[...indice.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).filter(u=>/articledetail\d*\.xml$/.test(u)&&permitido(rel(u)));
  const alvos=[];
  for(const s of subs) {
    for(const e of entradas(await pegar(s)))alvos.push({caminho:rel(e.loc),lastmod:e.lastmod});
  }
  const atuais=new Map((await db.query("SELECT source_url,metadata->>'portalLastmod' AS lm,metadata->>'date' AS data,managed_at FROM content WHERE kind='article'")).rows.map(r=>[r.source_url,r]));
  const recente=d=>d&&Date.parse(d)>now.getTime()-7*86400000;
  // Novo, com lastmod diferente do último coletado ou publicado há menos de 7 dias (quando o portal não informa lastmod).
  const buscar=alvos.filter(a=>{const r=atuais.get(PORTAL+a.caminho);if(!permitido(a.caminho)||r?.managed_at)return false;return !r||(a.lastmod?a.lastmod!==r.lm:recente(r.data));}).slice(0,limite);
  const moves=new Map((await db.query('SELECT old_path,new_path FROM redirects')).rows.map(r=>[r.old_path,r.new_path]));
  const rewriteLink=linkReescrito(moves),resumo={parada:false,novas:0,atualizadas:0,ignoradas:alvos.length-buscar.length,erros:[]};
  for(const a of buscar) {
    try {
      const html=await pegar(a.caminho),c={...extrairArtigo(html,a.caminho),lastmod:a.lastmod};
      if(!c.titulo||!c.texto){resumo.erros.push(`${a.caminho}: página sem título ou texto`);continue;}
      const existia=atuais.has(PORTAL+a.caminho);
      await db.transaction(async tx=>{
        const caminho=await gravarPublicacao(tx,{kind:'article',c,rewriteLink,origem:'coleta'});
        // Um caminho antigo nunca esconde uma publicação atual (como no db:seed).
        await tx.query('DELETE FROM redirects WHERE old_path=$1',[caminho]);
      });
      existia?resumo.atualizadas++:resumo.novas++;
      log(`${existia?'atualizada':'nova'}: ${a.caminho}`);
    } catch(e){resumo.erros.push(`${a.caminho}: ${e.message}`);}
  }
  return resumo;
}
