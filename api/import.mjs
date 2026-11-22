import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './db.mjs';
import { hashPassword } from './auth.mjs';
import { safeURL, withoutTracking, slugify, addressParts, oneLine } from './lib/saneamento.mjs';
import { sanitizeHtml } from './lib/html-seguro.mjs';
import { parseAcervoHours } from './lib/horario.mjs';
import { normalizeCategory, GRUPOS } from './data/categorias.mjs';
import { FORMATOS, ESPACOS, POSICOES_ANTIGAS } from './data/espacos.mjs';
import { slugsDeBairros } from './data/bairros.mjs';
const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const PORTAL='https://nexus.demo';
const KIND_PATHS={news:'noticias',article:'artigos',classified:'classificados'};

export function parseRedirects(text) {
  const lines=text.trim().split(/\r?\n/);
  if(lines.shift()!=='url_antiga,rota_nova') throw new Error('Cabeçalho do mapa inválido');
  return lines.map((line,i)=>{
    const fields=line.split(',');
    if(fields.length!==2) throw new Error(`Mapa: linha ${i+2} deve ter duas colunas sem vírgulas internas`);
    return {from:fields[0],to:fields[1]};
  });
}

// Correções do Nexus (conteudo-portal/correcoes.json, decisão D2) por cima do registro do acervo.
const CORRECOES={nome:'nome',bairro:'bairro',cidade:'cidade',rua:'rua',cep:'cep',telefone:'telefone',whatsapp:'whatsapp',email:'email',site:'site',resumo:'resumo',redes:'redes'};
export const applyCorrections=(b,fix={})=>Object.entries(CORRECOES).reduce((r,[from,to])=>fix[from]===undefined?r:{...r,[to]:fix[from]},b);

// Marca de citação de ferramenta de redação publicada por engano no portal (<Cite refs={[...]}/>, às vezes escapada).
export const semCitacao=s=>String(s||'').replace(/[ \t]*(?:<|&lt;)Cite\b[^>]*?\/(?:>|&gt;)/g,'');

// Vídeo do YouTube como link para abrir fora do site (embutir exige mudar a CSP).
const videoLink=url=>{const id=/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})|youtu\.be\/([\w-]{6,})|[?&]v=([\w-]{6,})/.exec(url||'');return id?`https://www.youtube.com/watch?v=${id[1]||id[2]||id[3]}`:withoutTracking(safeURL(url));};

// Detalhes da empresa a partir do acervo: endereço em partes, categorias normalizadas, links aprovados e sem rastreio.
export function businessDetails(b,geo) {
  const {address,street,cep}=addressParts({street:b.rua,district:b.bairro,city:b.cidade,cep:b.cep,full:b.endereco});
  const details={address,street,cep,city:b.cidade||'Rio de Janeiro',whatsapp:b.whatsapp||'',website:withoutTracking(safeURL(b.site)),
    hours:(b.horarios||[]).map(h=>`${h.dia}: ${h.horas.join(', ')}`).join('\n'),description:(b.descricao||[]).join('\n\n'),
    image:safeURL(b.imagemGrande||b.imagem,{image:true}),photos:(b.fotos||[]).filter(x=>safeURL(x,{image:true})).slice(0,8),
    categories:[...new Set((b.categorias||[]).map(c=>normalizeCategory(c.nome)))],
    socials:(b.redes||[]).filter(s=>safeURL(s.url)).map(s=>({label:s.rede,url:withoutTracking(safeURL(s.url))})),
    email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(oneLine(b.email))?oneLine(b.email).toLowerCase():'',video:videoLink(b.video),features:(b.caracteristicas||[]).map(oneLine).filter(Boolean)};
  if(geo)details.geo={lat:geo.lat,lng:geo.lng,precisao:geo.precisao};
  return details;
}

// Avaliações do acervo, menos as escritas pela próprio Nexus. Datas "23 de janeiro, 2026" viram 2026-01-23.
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export function reviewDate(text) {
  const m=/(\d{1,2})\s+de\s+([a-zç]+),?\s+(\d{4})/i.exec(text||'');const month=m&&MESES.indexOf(m[2].toLowerCase());
  return m&&month>=0?`${m[3]}-${String(month+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;
}
export const acervoReviews=b=>(b.avaliacoes?.itens||[]).filter(a=>a.autor&&!/primig/i.test(a.autor)&&a.estrelas>=1&&a.estrelas<=5).map(a=>({
  id:`portal:${b.slug}:${createHash('sha1').update(`${a.autor}|${a.data}|${a.titulo}|${a.texto}`).digest('hex').slice(0,16)}`,
  author:oneLine(a.autor),rating:Math.round(a.estrelas),title:oneLine(a.titulo),body:oneLine(a.texto),reviewed_on:reviewDate(a.data)}));

// Preço do classificado: a última linha "R$ 199, 00" do portal vira "R$ 199,00".
export const classifiedPrice=c=>{const raw=[c.preco,...(c.linhas||[])].reverse().find(l=>/^R\$\s*[\d.]+\s*,\s*\d{2}$/.test(oneLine(l)));return raw?oneLine(raw).replace(/\s*,\s*/,',').replace(/^R\$\s*/,'R$ '):'';};
const words=t=>(String(t||'').match(/\S+/g)||[]).length;

// 301 das páginas de categoria e de local do portal antigo (conteudo-portal/portal-antigo.json) para a busca ou a lista.
const GRUPO_DO_PAI={'/guia-comercial/automoveis':'automotivo','/guia-comercial/artesanato':'moda-e-beleza','/guia-comercial/construcao-e-reforma':'casa-e-construcao','/guia-comercial/cuidador-de-idosos':'saude-e-bem-estar','/guia-comercial/festas-e-eventos':'eventos','/guia-comercial/moveis-e-eletrodomesticos':'casa-e-construcao'};
export function oldPortalRedirects(portal,companies) {
  const categories=new Set(companies.flatMap(b=>(b.categorias||[]).map(c=>slugify(normalizeCategory(c.nome)))));
  // Bairro com empresa vai para a página dele (contrato 18.2), com o mesmo slug de /bairros.
  const bairros=slugsDeBairros([...new Map(companies.filter(b=>b.bairro).map(b=>{const name=oneLine(b.bairro),city=oneLine(b.cidade)||'Rio de Janeiro';return [`${name}|${city}`,{name,city}];})).values()]);
  const districts=new Map(bairros.map(b=>[slugify(b.name),b.slug]));
  const cities=new Map(companies.filter(b=>b.cidade).map(b=>[slugify(b.cidade),oneLine(b.cidade)]));
  const groups=new Set(GRUPOS.map(g=>g.slug));
  const busca=params=>`/busca?${new URLSearchParams(params)}`;
  const editoria=({link,nome})=>nome?slugify(nome):link.split('/').pop().replace(/(-\d+)+$/,'');
  const out=[];
  for(const item of portal.guia) {
    const slug=slugify(normalizeCategory(item.nome));
    const group=categories.has(slug)||groups.has(slug)?slug:GRUPO_DO_PAI[item.link];
    out.push([item.link,group?busca({category:group}):'/busca']);
  }
  for(const link of portal.locaisGuia) {
    const key=link.split('/').pop();
    out.push([link,districts.has(key)?`/bairros/${districts.get(key)}`:cities.has(key)?busca({location:cities.get(key)}):'/busca']);
  }
  // As notícias saíram do site (15.1): as editorias de notícia do portal antigo vão para os artigos.
  for(const item of portal.noticias)out.push([item.link,'/artigos']);
  for(const item of portal.artigos)out.push([item.link,`/artigos?editoria=${editoria(item)}`]);
  for(const link of portal.classificados)out.push([link,'/classificados']);
  for(const link of portal.ofertas)out.push([link,'/ofertas']);
  return out;
}

const day=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s:null;
// Banner do portal (banners.json, contrato 11.6). Só publica com ativo, espaço e formato compatíveis, destino aprovado,
// período válido e imagem do portal. imagemCelular pode ser o id de outro banner do portal (imagens: id → URL) ou uma URL.
const espacoDe=p=>ESPACOS.find(e=>e.id===(POSICOES_ANTIGAS[p]||p));
export function bannerState(entry={},image='',imagens={}) {
  const destination=typeof entry.destino==='string'&&/^\/(?!\/)/.test(entry.destino)?entry.destino:safeURL(entry.destino);
  const espaco=espacoDe(entry.posicao),format=FORMATOS[entry.formato]?entry.formato:'';
  const cabe=Boolean(espaco&&format&&[...espaco.computador,...espaco.celular].includes(format));
  const mobile=entry.imagemCelular?imagens[String(entry.imagemCelular)]||String(entry.imagemCelular):'';
  const ready=entry.ativo===true&&destination&&cabe&&day(entry.inicio)&&day(entry.fim)&&entry.inicio<=entry.fim&&safeURL(image,{image:true});
  return {advertiser:oneLine(entry.anunciante),placement:espaco?.id||'home-topo',format,image_mobile_url:safeURL(mobile,{image:true}),
    weight:Math.min(100,Math.max(1,Math.round(Number(entry.peso)||1))),business:oneLine(entry.empresa),destination:destination||'',image_url:safeURL(image,{image:true}),
    starts_at:day(entry.inicio)?`${entry.inicio}T00:00:00-03:00`:null,ends_at:day(entry.fim)?`${entry.fim}T23:59:59-03:00`:null,status:ready?'published':'pending-review'};
}

// Uma publicação do portal no banco: o acervo (db:seed) ou a coleta diária (13.7). O que a equipe editou no admin (managed_at)
// fica como está, e o que a coleta já atualizou (metadata.coletado) não volta ao texto dos arquivos do repositório.
export async function gravarPublicacao(tx,{kind,c,rewriteLink=h=>h,redirects=[],classifiedOwner=new Map(),origem='arquivo'}) {
  const sourceSlug=c.slug || new URL(c.url).pathname.split('/').pop().replace(/\.html$/,'');
  const mapped=redirects.find(r=>r.from===c.url)?.to;
  const slug=mapped?.replace('/classificados#','/classificados/').split('/').pop() || sourceSlug;
  const body=semCitacao(c.texto||c.descricao||'');
  const metadata={author:c.autor||'Curadoria Nexus',date:c.publicadoEm||'',category:oneLine(c.editoria||c.categoria),image:safeURL(c.imagem?.original||(typeof c.imagem==='string'?c.imagem:''),{image:true}),summary:oneLine(semCitacao(c.resumo)),
    words:Number(c.palavras)||words(body),gallery:(c.galeria||[]).filter(src=>safeURL(src,{image:true})),
    // Editorias são as categorias do portal (uma publicação pode ter várias); o slug é o mesmo dos 301 de /noticias/<editoria>.
    editorias:[...new Map((c.categorias||[]).map(x=>oneLine(x.nome)).filter(Boolean).map(label=>[slugify(label),{slug:slugify(label),label}])).values()]};
  if(kind==='classified')Object.assign(metadata,{price:classifiedPrice(c),phone:oneLine(c.telefone),business:classifiedOwner.get(sourceSlug)||null});
  if(origem==='coleta')Object.assign(metadata,{coletado:true,portalLastmod:c.lastmod||''});
  const bodyHtml=c.html?sanitizeHtml(semCitacao(c.html),{rewriteLink}):'';
  // ID usa a origem estável; texto, título e metadados acompanham o acervo a cada reimportação.
  await tx.query(`INSERT INTO content(id,kind,slug,title,body,source_url,metadata,body_html) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,body=excluded.body,source_url=excluded.source_url,metadata=excluded.metadata,body_html=excluded.body_html,updated_at=now()
    WHERE content.managed_at IS NULL AND ($9 OR content.metadata->>'coletado' IS NULL) AND (content.slug,content.title,content.body,content.source_url,content.metadata,content.body_html) IS DISTINCT FROM (excluded.slug,excluded.title,excluded.body,excluded.source_url,excluded.metadata,excluded.body_html)`,
    [`${kind}:${sourceSlug}`,kind,slug,c.titulo,body,c.url,JSON.stringify(metadata),bodyHtml,origem==='coleta']);
  return `/${KIND_PATHS[kind]}/${slug}`;
}
// Link do corpo: endereço do portal antigo vira a página nova (mapa de caminhos antigos para novos); o resto segue como está.
export const linkReescrito=moves=>href=>{try{const u=new URL(href,PORTAL);if(!/^(www\.)?primigdivulgacao\.com\.br$/.test(u.hostname))return href;return moves.get(decodeURIComponent(u.pathname))||(u.pathname==='/'?'/':u.href);}catch{return href;}};

export async function importSnapshot(db) {
  const acervo=await json('conteudo-portal/empresas.json');
  const news=(await json('conteudo-portal/noticias.json')).noticias;
  const articles=(await json('conteudo-portal/artigos.json')).artigos;
  const ads=(await json('conteudo-portal/classificados.json')).classificados;
  const banners=(await json('conteudo-portal/site.json')).banners;
  const places=(await json('conteudo-portal/localizacoes.json')).empresas;
  const portal=await json('conteudo-portal/portal-antigo.json');
  const chains=(await json('conteudo-portal/redes.json')).redes;
  const collections=(await json('conteudo-portal/colecoes.json')).colecoes;
  const fixes=await json('conteudo-portal/correcoes.json');
  const bannerData=new Map((await json('conteudo-portal/banners.json')).banners.map(b=>[String(b.id),b]));
  const events=(await json('conteudo-portal/eventos.json')).eventos;
  const coupons=(await json('conteudo-portal/cupons.json').catch(()=>({cupons:[]}))).cupons||[];
  const offers=(await json('conteudo-portal/ofertas.json').catch(()=>({ofertas:[]}))).ofertas||[];
  const redirects=parseRedirects(await readFile(resolve(root,'conteudo-portal/redirecionamentos.csv'),'utf8'));
  const demoPassHash=await hashPassword('NexusDemo2026!');
  const companies=acervo.map(b=>applyCorrections(b,fixes.empresas?.[b.slug]));
  // Mapa único caminho antigo → caminho novo: categorias do portal antigo e, por cima, o mapa (que prevalece).
  const moves=new Map(oldPortalRedirects(portal,companies));
  for(const r of redirects) moves.set(new URL(r.from).pathname,r.to.replace('/classificados#','/classificados/'));
  // Link do corpo das publicações: endereço do portal antigo vira a página nova; o resto segue como está.
  const rewriteLink=linkReescrito(moves);
  const classifiedOwner=new Map(companies.flatMap(b=>(b.classificados||[]).map(slug=>[slug,b.slug])));
  await db.transaction(async tx=> {
    for(const p of fixes.planos||[]) await tx.query(`INSERT INTO plans(id,name,status,rank,sponsored) VALUES($1,$2,'active',$3,$4) ON CONFLICT(id) DO UPDATE SET name=excluded.name,rank=excluded.rank,sponsored=excluded.sponsored,status='active'`,[p.id,p.nome,Number(p.ordem)||0,p.patrocinado===true]);
    for(const r of chains) await tx.query('INSERT INTO business_groups(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=excluded.name',[r.id,r.nome]);
    const groupOf=new Map(chains.flatMap(r=>r.empresas.map(slug=>[slug,r.id])));
    // Empresas: o acervo (com as correções do Nexus) é a fonte. Só grava o que mudou, e aí renova updated_at (lastmod).
    // Empresa editada pelo painel ou pelo admin (managed_at): o acervo deixa de sobrescrever cadastro, detalhes e horário.
    // Empresa com o plano definido pela gestão comercial (plan_managed, contrato 19.4): o acervo não mexe no plano.
    const geridas=new Set((await tx.query('SELECT id FROM businesses WHERE managed_at IS NOT NULL')).rows.map(r=>r.id));
    for(const b of companies) {
      const plan=fixes.empresas?.[b.slug]?.plano||null,gerida=geridas.has(b.slug);
      if(!gerida)await tx.query(`INSERT INTO businesses(id,slug,name,district,summary,phone,website,source_url,group_id,featured,plan_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,district=excluded.district,summary=excluded.summary,phone=excluded.phone,website=excluded.website,source_url=excluded.source_url,group_id=excluded.group_id,featured=excluded.featured,
          plan_id=CASE WHEN businesses.plan_managed THEN businesses.plan_id ELSE excluded.plan_id END,updated_at=now()
        WHERE (businesses.slug,businesses.name,businesses.district,businesses.summary,businesses.phone,businesses.website,businesses.source_url,businesses.group_id,businesses.featured,businesses.plan_id) IS DISTINCT FROM (excluded.slug,excluded.name,excluded.district,excluded.summary,excluded.phone,excluded.website,excluded.source_url,excluded.group_id,excluded.featured,CASE WHEN businesses.plan_managed THEN businesses.plan_id ELSE excluded.plan_id END)`,
        [b.slug,b.slug,b.nome,oneLine(b.bairro),b.resumo||'',b.telefone||'',b.site||'',b.urlPortal||'',groupOf.get(b.slug)||null,b.destaque===true,plan]);
      // Página própria no portal antigo: define a empresa pagante até a lista real de planos (contrato 11.3). Não mexe no lastmod.
      await tx.query('UPDATE businesses SET own_page=$1 WHERE id=$2 AND own_page IS DISTINCT FROM $1',[b.temPaginaPropria===true,b.slug]);
      // Localização gerada por scripts/gerar-mapa.mjs (conteudo-portal/localizacoes.json) entra junto nos detalhes.
      if(!gerida) {
      await tx.query('UPDATE businesses SET details=$1::jsonb,enriched=true,updated_at=now() WHERE id=$2 AND details IS DISTINCT FROM $1::jsonb',[JSON.stringify(businessDetails(b,places[b.slug])),b.slug]);
      await tx.query('DELETE FROM business_hours WHERE business_id=$1',[b.slug]);
      for(const h of parseAcervoHours(b.horarios)) await tx.query('INSERT INTO business_hours(business_id,weekday,opens,closes) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[b.slug,h.weekday,h.opens,h.closes]);
      }
      const reviews=acervoReviews(b);
      await tx.query("DELETE FROM reviews WHERE business_id=$1 AND source='portal' AND NOT (id = ANY($2))",[b.slug,reviews.map(r=>r.id)]);
      for(const r of reviews) await tx.query(`INSERT INTO reviews(id,business_id,author,rating,title,body,reviewed_on,source,status) VALUES($1,$2,$3,$4,$5,$6,$7,'portal','published')
        ON CONFLICT(id) DO UPDATE SET author=excluded.author,rating=excluded.rating,title=excluded.title,body=excluded.body,reviewed_on=excluded.reviewed_on`,[r.id,b.slug,r.author,r.rating,r.title,r.body,r.reviewed_on]);
    }
    const contentPaths=[];
    for(const [kind,items] of [['news',news],['article',articles],['classified',ads]]) {
      for(const c of items) {
        contentPaths.push(await gravarPublicacao(tx,{kind,c,rewriteLink,redirects,classifiedOwner,origem:'arquivo'}));
      }
    }
    // Banners do portal: criados uma vez e ligados ou desligados pelo conteudo-portal/banners.json (D3).
    const imagens=Object.fromEntries(banners.map(b=>[String(b.id),b.imagem||'']));
    for(const b of banners) {
      await tx.query('INSERT INTO campaigns(id,title,source) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[String(b.id),b.alt||'',JSON.stringify(b)]);
      const s=bannerState(bannerData.get(String(b.id)),b.imagem,imagens),business=companies.some(c=>c.slug===s.business)?s.business:null;
      // Banner editado no admin (managed_at) não volta a seguir o banners.json.
      await tx.query('UPDATE campaigns SET advertiser=$2,placement=$3,destination=$4,image_url=$5,starts_at=$6,ends_at=$7,status=$8,format=$9,image_mobile_url=$10,weight=$11,business_id=$12 WHERE id=$1 AND managed_at IS NULL',
        [String(b.id),s.advertiser,s.placement,s.destination,s.image_url,s.starts_at,s.ends_at,s.status,s.format,s.image_mobile_url,s.weight,business]);
    }
    // Anúncios institucionais do Nexus (status 'house').
    for(const f of Object.values(FORMATOS)) await tx.query(`INSERT INTO campaigns(id,title,source,status,advertiser,format,destination,placement) VALUES($1,$2,'{}','house','Nexus',$3,$4,'')
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,status='house',advertiser='Nexus',format=excluded.format,destination=excluded.destination,placement=''`,[`nexus-${f.id}`,`Divulgue no Nexus: ${f.name}`,f.id,`/cadastro?interesse=${f.interesse}`]);
    await tx.query("DELETE FROM campaigns WHERE id LIKE 'nexus-%'");
    for(const o of offers) await tx.query(`INSERT INTO catalog_items(id,business_id,kind,name,description,conditions,valid_until,price_mode,price_cents,image_url,status,approved_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published',1)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,conditions=excluded.conditions,valid_until=excluded.valid_until,price_mode=excluded.price_mode,price_cents=excluded.price_cents,image_url=excluded.image_url,status='published'`,
      [o.id,o.business_id,o.kind||'offer',o.name,o.description||'',o.conditions||'',o.valid_until||null,o.price_mode||'fixed',o.price_cents??null,safeURL(o.image_url,{image:true})]);
    for(const cp of coupons) await tx.query(`INSERT INTO coupons(id,business_id,title,conditions,code,starts_on,ends_on,quantity,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ativo')
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,conditions=excluded.conditions,code=excluded.code,starts_on=excluded.starts_on,ends_on=excluded.ends_on,quantity=excluded.quantity WHERE coupons.status='ativo'`,
      [cp.id,cp.business_id,cp.title,cp.conditions,cp.code,cp.starts_on||null,cp.ends_on,cp.quantity??null]);
    // Contas demonstrativas para portfólio (visitante, parceiro e admin) — idempotentes.
    const demoUsers=[
      ['demo-visitante','visitante@nexus.demo','Marina Visitante','consumidor',null],
      ['demo-parceiro','parceiro@nexus.demo','Lucas Parceiro','associado',null],
      ['demo-admin','admin@nexus.demo','Equipe Nexus','equipe','admin']
    ];
    for(const [id,email,name,kind,staffRole] of demoUsers) {
      await tx.query(`INSERT INTO users(id,email,name,password_hash,kind,staff_role,terms_accepted_at)
        VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(email) DO NOTHING`,[id,email,name,demoPassHash,kind,staffRole]);
    }
    const parceiro=(await tx.query("SELECT id FROM users WHERE email='parceiro@nexus.demo'")).rows[0];
    if(parceiro) {
      for(const slug of ['bistro-mare-alta','cafe-mirante-santa']) {
        await tx.query(`INSERT INTO memberships(user_id,business_id,role,active) VALUES($1,$2,'dono',true) ON CONFLICT(user_id,business_id) DO NOTHING`,[parceiro.id,slug]);
      }
    }
    for(const [i,c] of collections.entries()) await tx.query(`INSERT INTO collections(id,title,subtitle,groups,position,status) VALUES($1,$2,$3,$4::jsonb,$5,'published')
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle,groups=excluded.groups,position=excluded.position,status='published' WHERE collections.source='arquivo'`,[c.id,c.titulo,c.subtitulo||'',JSON.stringify(c.grupos||[]),i]);
    // Só as coleções e os eventos vindos dos arquivos seguem os arquivos; os criados ou editados no admin ficam como estão.
    await tx.query("UPDATE collections SET status='paused' WHERE source='arquivo' AND NOT (id = ANY($1))",[collections.map(c=>c.id)]);
    for(const e of events) await tx.query(`INSERT INTO events(id,slug,title,description,starts_at,ends_at,place,address,image_url,url,business_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published')
      ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,place=excluded.place,address=excluded.address,image_url=excluded.image_url,url=excluded.url,business_id=excluded.business_id,status='published',updated_at=now() WHERE events.source='arquivo'`,
      [e.id,slugify(e.id),e.titulo,e.descricao||'',`${e.inicio}:00-03:00`,e.fim?`${e.fim}:00-03:00`:null,e.local||'',e.endereco||'',safeURL(e.imagem,{image:true}),safeURL(e.link),e.empresa||null]);
    // Evento que saiu da agenda sai do site (como as coleções).
    await tx.query("UPDATE events SET status='paused',updated_at=now() WHERE status='published' AND source='arquivo' AND NOT (id = ANY($1))",[events.map(e=>e.id)]);
    for(const [oldPath,alvo] of moves) {
      // As notícias saíram do site (15.1): a lista vira /artigos; a notícia não tem redirecionamento, e o caminho antigo
      // (/noticias/<slug>.html) responde 410 direto, sem cadeia.
      const target=/^\/noticias\//.test(alvo)?null:/^\/noticias(\?|$)/.test(alvo)?'/artigos':alvo;
      if(!target||oldPath===target||contentPaths.includes(oldPath)) continue;
      await tx.query('INSERT INTO redirects(old_path,new_path) VALUES($1,$2) ON CONFLICT(old_path) DO UPDATE SET new_path=excluded.new_path WHERE redirects.new_path<>excluded.new_path',[oldPath,target]);
    }
    await tx.query("DELETE FROM redirects WHERE new_path LIKE '/noticias/%'");
    // Um caminho antigo nunca esconde uma publicação atual com o mesmo endereço.
    await tx.query('DELETE FROM redirects WHERE old_path = ANY($1)',[contentPaths]);
  });
  return (await db.query("SELECT (SELECT count(*)::int FROM businesses) AS businesses,(SELECT count(*)::int FROM content) AS content,(SELECT count(*)::int FROM campaigns WHERE status<>'house') AS campaigns,(SELECT count(*)::int FROM redirects) AS redirects")).rows[0];
}
