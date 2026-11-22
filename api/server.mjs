import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { root,openDB,migrate } from './db.mjs';
import { escape } from './lib/html.mjs';
import { clientIP } from './lib/ip.mjs';
import { ingestEvent } from './events.mjs';
import { signupSubmission,contactSubmission,respostasDoCadastro } from './cadastro.mjs';
import { renderPage, views } from './views/index.mjs';
import { sessionFor, sessionCookie } from './auth.mjs';
import { contaAPI, midia } from './painel-api.mjs';
import { adminAPI } from './admin-api.mjs';
import { integracaoAPI, chavesDoAmbiente } from './integracao-api.mjs';
import { carregarCategorias } from './data/categorias.mjs';
import { leadsDoAmbiente, guardarPedido } from './data/pedidos.mjs';
import { loadAdmin } from './data/admin/pagina.mjs';
import { contarBuscaVazia } from './data/admin/relatorios.mjs';
import { contarProcura } from './data/metricas.mjs';
import { brevoMailer } from './lib/email.mjs';
import { contarBusca } from './data/painel.mjs';
import { loadEntrar, loadRecuperar, loadDefinirSenha, loadPainel, loadCriarConta, loadMinhaConta } from './data/contas.mjs';
import { loadCupons, loadCupom } from './data/cupons.mjs';
import { loadBairros, loadBairro, rodapeBairros } from './data/bairros.mjs';
import { loadHome } from './data/home.mjs';
import { loadBusca,loadEmpresa } from './data/empresas.mjs';
import { loadConteudo } from './data/conteudo.mjs';
import { loadCadastro,loadContato } from './data/cadastro.mjs';
import { loadOfertas,loadEventos,loadParaEmpresas,loadSobre,loadInstitucional,menuState } from './data/paginas.mjs';
import { sitemapEntries } from './data/sitemap.mjs';
import { naoEncontrada } from './data/rota.mjs';

// Versão única do projeto: a do package.json (a mesma do CHANGELOG), exposta em /health/live.
const VERSION=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;

// Arquivos de p2/ servidos em /assets/<caminho>. Só extensões da lista; segmentos começam por letra ou número (sem "..",
// sem arquivo oculto). /assets/p2.css é o nome público de p2/style.css. Lidos uma vez: ETag para revalidar sem baixar
// de novo e gzip para texto (o mapa tem ~480 KB, ~180 KB compactado).
const ASSET_TYPES={css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif',woff2:'font/woff2'};
const ASSET_ALIASES={'p2.css':'style.css'};
const P2=resolve(root,'p2');
const assets=new Map();
async function asset(path) {
  const match=/^\/assets\/((?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9._-]*\.([a-z0-9]+))$/i.exec(path);
  const type=match&&ASSET_TYPES[match[2].toLowerCase()];
  if(!type)return null;
  const file=resolve(P2,ASSET_ALIASES[match[1]]||match[1]);
  if(!file.startsWith(P2+sep))return null;
  if(!assets.has(file)) {
    let bytes;try{bytes=await readFile(file);}catch{return null;}
    assets.set(file,{type,bytes,gzip:/^(text\/|image\/svg)/.test(type)?gzipSync(bytes,{level:9}):null,etag:`"${createHash('sha1').update(bytes).digest('base64url').slice(0,20)}"`});
  }
  return assets.get(file);
}
// Páginas que nunca entram no índice dos buscadores, mesmo com INDEXABLE=true.
const NOINDEX=['/busca','/favoritos','/cadastro'];

// Rotas de página: cada loader devolve {title, description, status, view, vm, ogImage} (docs/CONTRATO.md).
// now: o instante da requisição (aberto agora, ofertas vigentes, eventos futuros); os testes passam um relógio fixo.
// random: sorteio do rodízio de banners por peso (testes passam um determinístico).
// usuario: id da conta logada (cupons já coletados); conta: {tipo, csrf} para a tela coletar (14.3).
export async function pageRoute({db,path,url,now=new Date(),random=Math.random,usuario=null,conta=null}) {
  if(path==='/')return loadHome({db,url,now,random});
  if(path==='/busca'||path==='/favoritos')return loadBusca({db,path,url,now,random});
  if(path.startsWith('/comercio/'))return loadEmpresa({db,path,now,random,usuario,conta});
  if(path==='/bairros')return loadBairros({db,now});
  if(path.startsWith('/bairros/'))return loadBairro({db,path,url,now});
  if(path==='/cupons')return loadCupons({db,url,now,random,usuario,conta});
  if(path.startsWith('/cupons/'))return loadCupom({db,path,now,random,usuario,conta});
  if(path==='/ofertas')return loadOfertas({db,now,random});
  if(path==='/eventos')return loadEventos({db,now,random});
  const content=await loadConteudo({db,path,url,now,random});if(content)return content;
  if(path==='/para-empresas')return loadParaEmpresas();
  if(path==='/cadastro')return loadCadastro(url);
  if(path==='/institucional/sobre')return loadSobre(db);
  if(path==='/institucional/contato')return loadContato();
  const key=/^\/institucional\/(faq|termos|privacidade)$/.exec(path)?.[1];if(key)return loadInstitucional(key);
  return naoEncontrada();
}

const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('Envie JSON'),{status:415});
  const chunks=[];let size=0;
  for await(const chunk of req) { size+=chunk.length; if(size>16384) throw Object.assign(new Error('Corpo excede 16 KB'),{status:413}); chunks.push(chunk); }
  let data;try {data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(new Error('JSON inválido'),{status:400});}
  if(!data||typeof data!=='object'||Array.isArray(data)) throw Object.assign(new Error('Objeto JSON esperado'),{status:400});
  return data;
}
// Corpo binário (foto do painel), com limite de tamanho.
async function rawBody(req,max) {
  const chunks=[];let size=0;
  for await(const chunk of req) { size+=chunk.length; if(size>max) throw Object.assign(new Error('A foto pode ter até 8 MB.'),{status:413,campo:'arquivo'}); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
// Formulários HTML de cadastro e contato: só leitura do corpo, sem gravar nada.
async function formBody(req) {
  if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) throw Object.assign(new Error('Envie o formulário'),{status:415});
  const chunks=[];let size=0;
  for await(const chunk of req) { size+=chunk.length; if(size>8192) throw Object.assign(new Error('Formulário excede 8 KB'),{status:413}); chunks.push(chunk); }
  // Chave repetida (as caixas do cadastro, contrato 17.3) vira lista.
  // Objeto sem protótipo: nome de campo como __proto__ ou constructor não mexe em nada.
  const fields=Object.create(null);
  for(const [k,v] of new URLSearchParams(Buffer.concat(chunks).toString()))fields[k]=Object.hasOwn(fields,k)?[].concat(fields[k],v):v;
  return fields;
}
// mailer: envio dos links por e-mail (Brevo, só com a chave no .env); mediaDir: volume das fotos enviadas pelo painel.
// integracaoChaves: as chaves da integração com a gestão (INTEGRACAO_CHAVES, contrato 19.2); vazia, a integração fica desligada.
export async function createApp({db,origin='http://127.0.0.1:4180',indexable=false,logger=()=>{},clock=()=>new Date(),random=Math.random,mailer=brevoMailer(),mediaDir=process.env.MEDIA_DIR||resolve(root,'.runtime/media'),integracaoChaves=chavesDoAmbiente(),leads=leadsDoAmbiente()}) {
  const parsedOrigin=new URL(origin);
  if(parsedOrigin.origin!==origin || !['http:','https:'].includes(parsedOrigin.protocol)) throw new Error('PUBLIC_ORIGIN inválida');
  // ogImage sempre absoluta (sem imagem própria, a padrão do front); menu diz se Ofertas e Eventos têm conteúdo (contrato 10.5).
  // conta: {nome, tipo} da sessão, para o cabeçalho (14.2), ou null.
  const html=async(res,req,route,path,pageIndexable,conta=null)=>{
    // View que o front ainda não registrou (rotas novas antes das telas): responde como página inexistente.
    if(!views[route.view]){route=naoEncontrada();pageIndexable=false;}
    const menu=await menuState(db,clock()),bairros=await rodapeBairros(db);
    res.writeHead(route.status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:renderPage({...route,ogImage:new URL(route.ogImage||'/assets/og-padrao.png',origin).href},{canonical:origin+path,indexable:pageIndexable,path,menu,conta,rodapeBairros:bairros}));
  };
  const sendAsset=(res,req,a)=>{
    const gzip=a.gzip&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
    const headers={'Content-Type':a.type,'Cache-Control':'no-cache',ETag:a.etag,Vary:'Accept-Encoding'};
    if(req.headers['if-none-match']===a.etag){res.writeHead(304,headers);return res.end();}
    res.writeHead(200,gzip?{...headers,'Content-Encoding':'gzip'}:headers);return res.end(req.method==='HEAD'?undefined:gzip?a.gzip:a.bytes);
  };
  const server=createServer(async(req,res)=> {
    const requestId=randomUUID(),started=Date.now();
    res.setHeader('X-Request-ID',requestId);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if(!indexable)res.setHeader('X-Robots-Tag','noindex, nofollow');
    if(parsedOrigin.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');
    res.on('finish',()=>logger({requestId,method:req.method,status:res.statusCode,durationMs:Date.now()-started}));
    try {
      const url=new URL(req.url,origin),path=decodeURIComponent(url.pathname);
      if(path.includes('\\')||path.includes('\0'))return json(res,400,{error:'Rota inválida',requestId});
      // PUT só na integração com a gestão (contrato 19.3), que se autentica pela assinatura, sem Origin nem sessão.
      if(!['GET','HEAD','POST','PATCH','DELETE'].includes(req.method)&&!(req.method==='PUT'&&path.startsWith('/api/integracao/')))return json(res,405,{error:'Método não permitido',requestId});
      const nova=path.startsWith('/api/')&&path!=='/api/events';
      if(['POST','PATCH','DELETE'].includes(req.method)&&req.headers.origin!==origin)return json(res,403,nova?{erro:'Origem não autorizada.'}:{error:'Origem não autorizada',requestId});
      // Sessão lida só quando a rota precisa (painel, APIs da conta e fotos pendentes).
      let sess;const session=async()=>sess===undefined?(sess=await sessionFor(db,req.headers.cookie,clock())):sess;
      const conta=async()=>{const s=await session();return s?{nome:s.name||'',tipo:s.tipo}:null;};
      if(path==='/health/live')return json(res,200,{status:'ok',version:VERSION});
      if(path==='/health/ready'){await db.query('SELECT 1');return json(res,200,{status:'ready',database:db.kind});}
      if(path.startsWith('/assets/')) {
        const a=['GET','HEAD'].includes(req.method)&&await asset(path);
        if(!a)return json(res,404,{error:'Não encontrado'});
        return sendAsset(res,req,a);
      }
      if(path==='/favicon.ico'&&['GET','HEAD'].includes(req.method))return sendAsset(res,req,await asset('/assets/favicon.svg'));
      // Categorias criadas pela equipe (22.1): relidas no máximo a cada 30 s, antes das páginas e das APIs.
      if(path!=='/api/events')await carregarCategorias(db);
      if((path==='/cadastro'||path==='/institucional/contato')&&req.method==='POST') {
        const fields=await formBody(req);
        let result=(path==='/cadastro'?signupSubmission:contactSubmission)(fields,origin);
        // Leads (23.2): com a chave ligada, o cadastro válido grava o pedido e leva o código no fim da mensagem.
        if(leads&&path==='/cadastro'&&result.redirect) {
          const codigo=await guardarPedido(db,{values:respostasDoCadastro(fields).values,origem:fields.interesse,now:clock(),random,logger});
          if(codigo)result=signupSubmission(fields,origin,{codigo});
        }
        if(result.redirect){res.writeHead(303,{Location:result.redirect,'Cache-Control':'no-store'});return res.end();}
        return await html(res,req,result,path,false,await conta());
      }
      if(path==='/api/events'&&req.method==='POST')return json(res,200,await ingestEvent(db,await body(req),clientIP(req),clock()));
      if(nova) {
        const send=(status,value)=>json(res,status,value);
        const ctx={db,req,res,path,method:req.method,url,ip:clientIP(req),now:clock(),origin,secure:parsedOrigin.protocol==='https:',mailer,mediaDir,send,session,body:()=>body(req),raw:max=>rawBody(req,max),chaves:integracaoChaves,leads};
        if(await integracaoAPI(ctx))return;
        if(await contaAPI(ctx))return;
        if(await adminAPI(ctx))return;
      }
      if(path.startsWith('/api/'))return json(res,404,nova?{erro:'Endpoint não encontrado.'}:{error:'Endpoint não encontrado'});
      if(path.startsWith('/midia/')&&['GET','HEAD'].includes(req.method)) {
        const m=await midia(db,{path,session:await session(),dir:mediaDir});
        if(!m)return json(res,404,{error:'Não encontrado'});
        res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':m.publica?'public, max-age=31536000, immutable':'private, no-store',ETag:m.etag});return res.end(req.method==='HEAD'?undefined:m.bytes);
      }
      if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Método não permitido'});
      const redirect=(await db.query('SELECT new_path FROM redirects WHERE old_path=$1',[path])).rows[0];
      if(redirect){res.writeHead(301,{Location:redirect.new_path});return res.end();}
      // Barra no final: vai para o destino antigo sem a barra ou para a própria página sem a barra (mesma query).
      if(path.length>1&&path.endsWith('/')) {
        const bare=(await db.query('SELECT new_path FROM redirects WHERE old_path=$1',[path.replace(/\/+$/,'')||'/'])).rows[0];
        res.writeHead(301,{Location:bare?bare.new_path:(url.pathname.replace(/\/+$/,'')||'/')+url.search});return res.end();
      }
      if(path==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end(`User-agent: *\n${indexable?'Allow: /':'Disallow: /'}\nSitemap: ${origin}/sitemap.xml\n`);}
      if(path==='/sitemap.xml'){res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8'});return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(await sitemapEntries(db,clock())).map(e=>`<url><loc>${escape(origin+e.path)}</loc>${e.lastmod?`<lastmod>${e.lastmod}</lastmod>`:''}</url>`).join('')}</urlset>`);}
      // Conta e painel: nunca indexados; o painel exige sessão (sem ela, vai para /entrar).
      if(path==='/entrar')return await html(res,req,loadEntrar(url),path,false,await conta());
      if(path==='/entrar/criar-conta')return await html(res,req,loadCriarConta(url),path,false,await conta());
      if(path==='/entrar/recuperar')return await html(res,req,loadRecuperar(),path,false,await conta());
      if(path==='/entrar/definir-senha')return await html(res,req,await loadDefinirSenha(db,url,clock()),path,false,await conta());
      // Minha conta (14.2): os cupons coletados; sem sessão, vai para /entrar.
      if(path==='/minha-conta') {
        const route=await loadMinhaConta({db,session:await session(),now:clock()});
        if(route.redirect){res.writeHead(303,{Location:route.redirect,'Cache-Control':'no-store'});return res.end();}
        return await html(res,req,route,path,false,await conta());
      }
      // Admin da equipe (13.2): sem sessão vai para /entrar; fora da equipe, 404.
      if(path==='/admin'||path.startsWith('/admin/')) {
        const route=await loadAdmin({db,session:await session(),path,url,now:clock()});
        if(route.redirect){res.writeHead(303,{Location:route.redirect,'Cache-Control':'no-store'});return res.end();}
        return await html(res,req,route,path,false,await conta());
      }
      if(path==='/painel'||path.startsWith('/painel/')) {
        const route=await loadPainel({db,session:await session(),path,url,now:clock()});
        if(route.redirect){res.writeHead(303,{Location:route.redirect,'Cache-Control':'no-store'});return res.end();}
        return await html(res,req,route,path,false,await conta());
      }
      // As notícias saíram do site (contrato 15.1): a lista, com qualquer query, vai para os artigos.
      if(path==='/noticias'){res.writeHead(301,{Location:'/artigos'});return res.end();}
      const s=await session();
      const route=await pageRoute({db,path,url,now:clock(),random,usuario:s?.user_id||null,conta:s?{tipo:s.tipo,csrf:s.csrf}:null});
      // Aparições na busca (métrica do painel): uma por empresa da página de resultado, sem robôs e sem dado pessoal.
      // Busca sem resultado (relatório da equipe, 13.6): o termo normalizado conta por dia, também sem robôs.
      if(path==='/busca'&&req.method==='GET'&&route.status===200&&!/bot|crawl|spider|slurp|preview|facebookexternalhit/i.test(req.headers['user-agent']||'')) {
        await contarBusca(db,route.vm.results.map(r=>r.slug),clock());
        if(!route.vm.favorites&&route.vm.total===0&&route.vm.q)await contarBuscaVazia(db,route.vm.q,clock());
        // Buscas, termos, bairros e categorias por dia (19.6), para as métricas da gestão.
        if(!route.vm.favorites)await contarProcura(db,{q:route.vm.q,district:route.vm.district,category:route.vm.category,total:route.vm.total,pagina:route.vm.current},clock());
      }
      return await html(res,req,route,path,indexable&&route.status===200&&!NOINDEX.includes(path),await conta());
    } catch(error) {
      const status=error.code==='23505'?409:error.status||500,message=error.code==='23505'?'Este cadastro já existe. Use outro identificador.':error.status?error.message:'Falha interna';
      // APIs novas (Fase 3 em diante): {erro, campo?}; as antigas: {error}.
      const novaAPI=(()=>{try{const p=new URL(req.url,origin).pathname;return p.startsWith('/api/')&&p!=='/api/events';}catch{return false;}})();
      if(!res.headersSent)json(res,status,novaAPI?{erro:message,...(error.campo?{campo:error.campo}:{}),...(error.status&&error.extra?error.extra:{}),...(status===500?{requestId}:{})}:{error:message,requestId});else res.end();
      logger({requestId,error:status===500?'request_failed':'request_rejected',status});
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.timeout=20000;
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const db=await openDB();await migrate(db);
  const origin=process.env.PUBLIC_ORIGIN||'http://127.0.0.1:4183';
  if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://'))throw new Error('Produção exige PUBLIC_ORIGIN HTTPS');
  const server=await createApp({db,origin,indexable:process.env.INDEXABLE==='true',logger:entry=>console.log(JSON.stringify(entry))});
  server.listen(Number(process.env.PORT||4183),process.env.HOST||'127.0.0.1',()=>console.log(`Nexus: ${origin}`));
  const stop=()=>server.close(async()=>{await db.close();process.exit(0);});process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
