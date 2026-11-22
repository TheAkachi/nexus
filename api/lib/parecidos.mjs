import { normalize, collator } from './saneamento.mjs';

// Nome igual e nomes parecidos (contrato 22.2), para a categoria e a rede: sem acento, maiúscula, pontuação e espaços
// repetidos. Parecido é o nome que contém o outro (com pelo menos 3 letras) ou que difere em até 2 letras (1, se o mais
// curto tiver até 5 letras).
export const chaveNome=s=>normalize(s).replace(/[^a-z0-9]+/g,' ').trim();
// Distância de edição, parando assim que passa do limite.
function distancia(a,b,limite) {
  if(Math.abs(a.length-b.length)>limite)return limite+1;
  let antes=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++) {
    const linha=[i];let menor=i;
    for(let j=1;j<=b.length;j++){linha[j]=Math.min(antes[j]+1,linha[j-1]+1,antes[j-1]+(a[i-1]===b[j-1]?0:1));menor=Math.min(menor,linha[j]);}
    if(menor>limite)return limite+1;
    antes=linha;
  }
  return antes[b.length];
}
// candidatos: a lista para comparar; nomeDe tira o nome de cada um. Devolve o igual (ou null) e até 5 parecidos.
export function compararNomes(nome,candidatos,nomeDe=c=>c) {
  const k=chaveNome(nome);let igual=null;const parecidos=[];
  for(const c of candidatos) {
    const ck=chaveNome(nomeDe(c));if(!k||!ck)continue;
    if(ck===k){igual??=c;continue;}
    const curto=Math.min(k.length,ck.length),limite=curto<=5?1:2,d=distancia(k,ck,limite);
    const contido=curto>=3&&(ck.includes(k)||k.includes(ck));
    if(d<=limite||contido)parecidos.push({c,ordem:d<=limite?d:limite+1+Math.abs(k.length-ck.length)});
  }
  parecidos.sort((a,b)=>a.ordem-b.ordem||collator.compare(nomeDe(a.c),nomeDe(b.c)));
  return {igual,parecidos:parecidos.slice(0,5).map(p=>p.c)};
}
