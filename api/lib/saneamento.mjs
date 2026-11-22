// Saneamento de texto e URLs. Os loaders (api/data) usam estas funções para entregar às views só URLs aprovadas.
export const slugify=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
export const normalize=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
// Ordem alfabética pt-BR (acentos não empurram "Alô" para depois de "Alvorada"; números em ordem numérica).
export const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
export const byText=(a,b)=>collator.compare(a,b);
// Texto numa linha só, sem espaços duplos; clip corta em até n caracteres sem partir palavra.
export const oneLine=s=>String(s??'').replace(/\s+/g,' ').trim();
export function clip(s,n=160) {
  const text=oneLine(s);if(text.length<=n)return text;
  const cut=text.slice(0,n-1),space=cut.lastIndexOf(' ');
  return (space>n*.6?cut.slice(0,space):cut).replace(/[\s,;:.–-]+$/,'')+'…';
}
// Só https, sem usuário/senha; imagens locais do próprio site (/assets/fotos/... ou /midia/<id>/<largura>.webp).
export function safeURL(value,{image=false}={}) {
  if(!value)return '';
  if(image&&typeof value==='string'&&(/^\/midia\/[a-f0-9]{32}\/(320|800|1600)\.webp$/.test(value)||/^\/assets\/fotos\/[a-z0-9][a-z0-9._-]*\.(svg|webp|png|jpg)$/i.test(value)))return value;
  try { const u=new URL(value); if(u.protocol!=='https:'||u.username||u.password)return ''; if(image)return ''; return u.href; }catch{return '';}
}
// Link externo sem parâmetros de rastreio (utm_*, fbclid). Recebe uma URL já aprovada por safeURL.
export function withoutTracking(url) {
  if(!url)return '';
  try { const u=new URL(url); for(const key of [...u.searchParams.keys()])if(/^(utm_.*|fbclid)$/i.test(key))u.searchParams.delete(key); return u.href; }catch{return '';}
}
// Destino de banner: caminho interno simples ou URL https aprovada por safeURL.
export function destinationURL(value) { return typeof value==='string'&&/^\/(?!\/)[a-zA-Z0-9/_?=&%-]*$/.test(value)?value:safeURL(value); }

// Endereço do acervo em partes. O portal antigo juntava logradouro, complemento, bairro, cidade, estado, CEP e país numa
// linha só, às vezes sem o nome da rua ("Rua , 2 - 361") ou repetindo bairro e cidade no logradouro ("- Centro").
export function formatCEP(value) {
  const digits=String(value??'').replace(/\D/g,'');
  return digits.length===8?`${digits.slice(0,5)}-${digits.slice(5)}`:'';
}
const compact=s=>normalize(s).replace(/[^a-z0-9]/g,'');
export function cleanStreet(street,{district='',city=''}={}) {
  let s=oneLine(street);
  // Tipo de logradouro sem nome ("Rua, 2 - 361"): não há rua para mostrar.
  if(/^(rua|r\.?|avenida|av\.?|estrada|estr\.?|travessa|tv\.?|rodovia|rod\.?|praça|pça\.?|alameda|al\.?)\s*(,|$)/i.test(s))return '';
  const repeated=new Set([district,city,'RJ','Rio de Janeiro','NI'].filter(Boolean).map(compact));
  // Tira do fim os pedaços que só repetem bairro, cidade ou estado: " - Centro", ", Rio de Janeiro", " - R.J", " -NI".
  for(let m;(m=/\s*[-,]\s*([^-,]+)$/.exec(s))&&m.index>0&&repeated.has(compact(m[1]));)s=s.slice(0,m.index).trim();
  return s;
}
export function addressParts({street,district,city,cep,full}={}) {
  const parts={street:cleanStreet(street,{district,city}),district:oneLine(district),city:oneLine(city),cep:formatCEP(cep)||formatCEP(/\b(\d{2}\.?\d{3})[-\s]?(\d{3})\b/.exec(full||'')?.slice(1).join(''))};
  parts.address=[parts.street,parts.district,parts.city].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');
  return parts;
}
