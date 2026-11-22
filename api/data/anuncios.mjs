import { safeURL, destinationURL, normalize } from '../lib/saneamento.mjs';
import { ESPACOS, FORMATOS, MAX_POR_PAGINA, MAX_CELULAR, MAX_CASA } from './espacos.mjs';

// vm Casa: o anúncio do Nexus no formato do espaço, com preço e interesse do /para-empresas.
export function casaVM(format) {
  const f=FORMATOS[format];
  return f?{id:`nexus-${f.id}`,format:f.id,name:f.name,size:f.size,price:f.price,period:f.period,interesse:f.interesse,href:`/cadastro?interesse=${f.interesse}`}:null;
}
// vm Banner (contrato 4, 10.1 e 11.4).
export function bannerVM(c,placement=c.placement) {
  const f=FORMATOS[c.format];
  return {id:c.id,placement,href:destinationURL(c.destination),image:c.image_url,title:c.title,advertiser:c.advertiser||'',
    format:f?.id||'',width:f?.width??null,height:f?.height??null,imageMobile:safeURL(c.image_mobile_url,{image:true})?c.image_mobile_url:''};
}
const valid=c=>FORMATOS[c.format]&&destinationURL(c.destination)&&safeURL(c.image_url,{image:true});
const advertiserOf=c=>normalize(c.advertiser||'')||c.business_id||c.id;
// Rodízio por peso (Efraimidis–Spirakis): cada banner sorteia random^(1/peso) e sai na ordem decrescente.
const byWeight=(list,random)=>list.map(c=>({c,k:Math.pow(random(),1/Math.max(1,Number(c.weight)||1))})).sort((a,b)=>b.k-a.k).map(x=>x.c);

// vm ads da página (contrato 11.3): espaços na ordem de prioridade, até 4 com anúncio (3 no celular), anunciante uma vez
// por página, anúncio do Nexus nos espaços vazios (16.1) e, no perfil e no cupom, sem concorrente e nada na pagante.
// itens: itens da lista na página; paragrafos: parágrafos do texto; empresa: {id, categories, pagante} no perfil.
export function adsFor(pagina,{campaigns=[],random=Math.random,itens=0,paragrafos=0,empresa=null}={}) {
  if(empresa?.pagante)return {};
  const rival=c=>empresa&&(c.business_id===empresa.id||(c.business_categories||[]).some(cat=>empresa.categories.includes(cat)));
  const cabe=e=>!(e.quando==='com-resultados'&&!itens||e.quando==='sem-resultados'&&itens||e.aCada&&itens<=e.aCada||e.minItens&&itens<e.minItens||e.minParagrafos&&paragrafos<e.minParagrafos);
  const usados=new Set(),ads={};let mostrados=0,casas=0,noCelular=0;
  for(const e of ESPACOS.filter(e=>e.pagina===pagina&&cabe(e))) {
    if(mostrados>=MAX_POR_PAGINA)break;
    const formatos=new Set([...e.computador,...e.celular]),banners=[];
    for(const c of byWeight(campaigns.filter(c=>c.placement===e.id&&valid(c)&&formatos.has(c.format)&&!rival(c)),random)) {
      if(banners.length>=e.giram)break;
      const quem=advertiserOf(c);if(usados.has(quem))continue;
      usados.add(quem);banners.push(bannerVM(c,e.id));
    }
    const house=!banners.length&&e.casa&&casas<MAX_CASA?casaVM(e.computador[0]||e.celular[0]):null;
    if(!banners.length&&!house)continue;
    if(house)casas++;
    const celular=e.celular.length>0&&noCelular<MAX_CELULAR;if(celular)noCelular++;
    ads[e.id]={id:e.id,formatos:{computador:[...e.computador],celular:[...e.celular]},banners,house,celular,aCada:e.aCada||0};
    mostrados++;
  }
  return ads;
}
