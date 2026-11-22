import { mapa, projetar } from '../mapa-rio.mjs';

// vm Mapa da abertura. Projeção, quadro e rótulos vêm de api/mapa-rio.mjs (gerado por scripts/gerar-mapa.mjs);
// as posições das empresas vêm de details.geo (conteudo-portal/localizacoes.json, gravado pelo db:seed).
const n=v=>Math.round(v*10)/10;
const plain=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();

export function mapVM(companies) {
  const located=companies.filter(b=>Number.isFinite(b.details?.geo?.lat)&&Number.isFinite(b.details?.geo?.lng));
  // Empresas no mesmo ponto (mesmo bairro, localização aproximada) se abrem em espiral para cada uma ficar clicável.
  const seen=new Map();
  const pontos=located.map(b=>{
    const {lat,lng,precisao}=b.details.geo,key=`${lat.toFixed(4)},${lng.toFixed(4)}`,i=seen.get(key)||0;
    seen.set(key,i+1);
    const [x,y]=projetar(lng,lat),angle=i*2.4,dist=i?9*Math.sqrt(i):0;
    return {slug:b.slug,name:b.name,district:b.district||'',city:b.details?.city||'',x:n(x+Math.cos(angle)*dist),y:n(y+Math.sin(angle)*dist),approx:precisao==='bairro'};
  });
  const {quadro,largura,altura}=mapa;
  // Bairros com empresas do guia têm prioridade de rótulo; depois, os mais perto do centro do quadro.
  const porBairro=companies.reduce((m,b)=>m.set(plain(b.district),(m.get(plain(b.district))||0)+1),new Map());
  const centro=[quadro.x+quadro.w/2,quadro.y+quadro.h/2];
  const bairros=[...mapa.bairros].sort((a,b)=>(porBairro.get(plain(b.nome))||0)-(porBairro.get(plain(a.nome))||0)||Math.hypot(a.x-centro[0],a.y-centro[1])-Math.hypot(b.x-centro[0],b.y-centro[1]));
  return {
    quadro,largura,altura,located:located.length,missing:companies.length-located.length,
    municipios:mapa.municipios.map(m=>({nome:m.nome,x:m.rotulo[0],y:m.rotulo[1]})),
    bairros:bairros.map(b=>({nome:b.nome,x:b.x,y:b.y,guia:!!porBairro.get(plain(b.nome))})),
    pontos
  };
}
