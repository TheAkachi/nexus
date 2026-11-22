import { activeCampaigns } from './campanhas.mjs';
import { adsFor } from './anuncios.mjs';
import { safeURL, oneLine } from '../lib/saneamento.mjs';
import { sanitizeHtml, textoDoHtml } from '../lib/html-seguro.mjs';
import { localNow, clock } from '../lib/horario.mjs';
import { plans, banners, campaigns, FONTE_OFICIAL } from './planos.mjs';
import { rota, titulo } from './rota.mjs';
import { ABERTURA, NOVIDADES, PERGUNTAS } from './cadastro.mjs';

// Espaço comum depois de "R$" (o Intl usa o não separável), como no preço dos classificados e no contrato.
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100).replace(/\s/g,' ');
const br=d=>d?d.split('-').reverse().join('/'):'';
const image=src=>safeURL(src,{image:true})?src:'';

// vm Oferta[]: só as vigentes (publicadas, com condições e validade de hoje em diante, em São Paulo), mais novas primeiro.
export async function currentOffers(db,now=new Date(),limit=null) {
  const today=localNow(now).date;
  const rows=(await db.query(`SELECT c.id,c.name,c.description,c.conditions,to_char(c.valid_until,'YYYY-MM-DD') AS valid_until,c.price_mode,c.price_cents,c.image_url,b.slug,b.name AS business_name
    FROM catalog_items c JOIN businesses b ON b.id=c.business_id WHERE c.kind='offer' AND c.status='published' AND b.status='published'
    AND c.conditions<>'' AND c.valid_until>=$1::date ORDER BY c.updated_at DESC ${limit?'LIMIT '+Number(limit):''}`,[today])).rows;
  return rows.map(r=>({id:r.id,name:r.name,description:r.description,conditions:r.conditions,validUntil:br(r.valid_until),businessSlug:r.slug,businessName:r.business_name,image:image(r.image_url),
    priceLabel:r.price_mode==='inquiry'?'Sob consulta':r.price_cents==null?'':`${r.price_mode==='from'?'A partir de ':''}${money(r.price_cents)}`}));
}
// vm Evento[]: publicados que ainda não terminaram, do mais próximo ao mais distante.
export async function upcomingEvents(db,now=new Date()) {
  const rows=(await db.query(`SELECT e.*,b.slug AS business_slug,b.name AS business_name FROM events e LEFT JOIN businesses b ON b.id=e.business_id AND b.status='published'
    WHERE e.status='published' AND coalesce(e.ends_at,e.starts_at)>=$1 ORDER BY e.starts_at`,[now.toISOString()])).rows;
  const local=d=>{const t=new Date(d),l=localNow(t);return {date:br(l.date),time:clock(l.minute)};};
  return rows.map(e=>({slug:e.slug,title:e.title,date:local(e.starts_at).date,endDate:e.ends_at&&local(e.ends_at).date!==local(e.starts_at).date?local(e.ends_at).date:'',time:local(e.starts_at).time,
    place:oneLine(e.place),address:oneLine(e.address),description:textoDoHtml(sanitizeHtml(e.description)),descriptionHtml:sanitizeHtml(e.description),image:image(e.image_url),href:safeURL(e.url),business:e.business_slug?{slug:e.business_slug,name:e.business_name}:null}));
}
// Itens do menu que só aparecem com conteúdo (contrato 10.5): mesmo critério do sitemap.
export async function menuState(db,now=new Date()) {
  return {ofertas:(await currentOffers(db,now,1)).length>0,eventos:(await upcomingEvents(db,now)).length>0};
}

export async function loadOfertas({db,now,random}) {
  return rota('ofertas',{items:await currentOffers(db,now),ads:adsFor('ofertas',{campaigns:await activeCampaigns(db,now),random})},
    {title:titulo('Ofertas gastronômicas e culturais'),description:'Ofertas publicadas pelos espaços parceiros do Nexus no Rio de Janeiro, com condições e validade.'});
}
export async function loadEventos({db,now,random}) {
  return rota('eventos',{items:await upcomingEvents(db,now),ads:adsFor('eventos',{campaigns:await activeCampaigns(db,now),random})},{title:titulo('Agenda cultural e gastronômica'),description:'Agenda de eventos gastronômicos e culturais no Rio de Janeiro pelo guia Nexus.'});
}
// O formulário do topo: as perguntas obrigatórias do /cadastro, iguais às de lá; envia o mesmo POST /cadastro.
const cadastroCurto={abertura:ABERTURA,novidades:NOVIDADES,perguntas:PERGUNTAS.filter(p=>p.obrigatoria)};
export const loadParaEmpresas=()=>rota('para-empresas',{plans,campaigns,banners,fonte:FONTE_OFICIAL,cadastro:cadastroCurto},
  {title:titulo('Divulgue seu espaço'),description:'Formatos demonstrativos de divulgação, campanhas e banners do guia Nexus para espaços gastronômicos e culturais do Rio.'});
// Sobre o Nexus.
export async function loadSobre(db) {
  const equipe=(await db.query("SELECT p.name,p.role,p.media_id FROM about_people p JOIN media m ON m.id=p.media_id AND m.status='aprovada' ORDER BY p.position,p.name")).rows
    .map(p=>({nome:p.name,funcao:p.role,foto:`/midia/${p.media_id}/800.webp`}));
  return rota('sobre',{equipe},{title:titulo('Sobre o projeto'),description:'Conheça o Nexus, projeto demonstrativo Full Stack de guia gastronômico e cultural do Rio de Janeiro.'});
}
// /institucional/faq, /termos e /privacidade: o texto fica na view, escolhido por key.
const INSTITUCIONAL={
  faq:['Perguntas frequentes','Respostas sobre como explorar o Nexus e testar os recursos do ambiente demonstrativo.'],
  termos:['Termos de uso','Condições de uso da aplicação demonstrativa Nexus.'],
  privacidade:['Privacidade','Como o Nexus trata preferências locais, consentimento de medição e sessões autenticadas.']
};
export const loadInstitucional=key=>{const [title,description]=INSTITUCIONAL[key];return rota('institucional',{title,key},{title:titulo(title),description});};
