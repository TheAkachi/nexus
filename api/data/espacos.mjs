import { banners as formatosVendidos } from './planos.mjs';

// Inventário dos espaços de anúncio (contrato, seção 11). Para criar, mover ou desligar um espaço, edite ESPACOS.
// Formatos: os 6 vendidos em /para-empresas; o id é o interesse do /cadastro sem "banner-".
export const FORMATOS=Object.fromEntries(formatosVendidos.map(b=>{
  const id=b.interesse.replace(/^banner-/,''),[width,height]=b.size.split('×').map(n=>Number(n.trim()));
  return [id,{id,name:b.name,size:b.size,price:b.price,period:b.period,interesse:b.interesse,width,height}];
}));

// Por página, na ordem de prioridade (até 4 com anúncio, 3 no celular).
// computador/celular: formatos aceitos em cada tela ([] = não aparece ali). giram: quantos banners o espaço roda.
// casa: sem banner pago, mostra o anúncio do Nexus (desde a v0.15.0, em todos os espaços: contrato 16.1). aCada: repete a cada N itens da lista.
// quando: 'com-resultados' ou 'sem-resultados' (busca); minItens e minParagrafos evitam dois espaços colados.
export const ESPACOS=[
  {id:'home-topo',pagina:'home',onde:'logo depois da abertura',computador:['super-banner'],celular:['link-patrocinado'],giram:3,casa:true},
  {id:'home-destaques',pagina:'home',onde:'entre os destaques e as coleções',computador:['ar-livre'],celular:['quadrado'],giram:2,casa:true},
  {id:'home-comercial',pagina:'home',onde:'antes da área comercial',computador:['super-banner'],celular:['link-patrocinado'],giram:2,casa:true},
  {id:'home-grade',pagina:'home',onde:'card na grade dos destaques, depois do 6º',computador:['quadrado'],celular:['quadrado'],giram:1,casa:true,minItens:7},
  {id:'busca-topo',pagina:'busca',onde:'topo dos resultados',computador:['super-banner'],celular:['link-patrocinado'],giram:3,casa:true,quando:'com-resultados'},
  {id:'busca-meio',pagina:'busca',onde:'na lista, a cada 6 resultados',computador:['link-patrocinado'],celular:['link-patrocinado'],giram:2,casa:true,aCada:6},
  {id:'busca-lateral',pagina:'busca',onde:'lateral em tela larga',computador:['meia-pagina','exibir-lateral'],celular:[],giram:1,casa:true,quando:'com-resultados'},
  {id:'busca-vazia',pagina:'busca',onde:'busca sem resultado',computador:['quadrado'],celular:['quadrado'],giram:1,casa:true,quando:'sem-resultados'},
  {id:'lista-topo',pagina:'conteudos',onde:'topo da lista',computador:['super-banner'],celular:['link-patrocinado'],giram:3,casa:true},
  {id:'lista-meio',pagina:'conteudos',onde:'na lista, a cada 6 itens',computador:['quadrado'],celular:['quadrado'],giram:1,casa:true,aCada:6},
  {id:'leitura-texto',pagina:'conteudo',onde:'depois do 3º parágrafo',computador:['ar-livre','quadrado'],celular:['quadrado'],giram:1,casa:true,minParagrafos:4},
  {id:'leitura-lateral',pagina:'conteudo',onde:'lateral fixa em tela larga',computador:['meia-pagina'],celular:[],giram:1,casa:true},
  {id:'leitura-fim',pagina:'conteudo',onde:'no fim, antes de "Mais em"',computador:['super-banner'],celular:['link-patrocinado'],giram:2,casa:true},
  {id:'perfil-lateral',pagina:'empresa',onde:'lateral (no celular, depois dos contatos)',computador:['quadrado'],celular:['quadrado'],giram:1,casa:true},
  {id:'ofertas-topo',pagina:'ofertas',onde:'topo',computador:['super-banner'],celular:['link-patrocinado'],giram:3,casa:true},
  {id:'eventos-topo',pagina:'eventos',onde:'topo',computador:['super-banner'],celular:['link-patrocinado'],giram:3,casa:true},
  // Cupons (contrato 16.2). A página do cupom segue a regra do perfil: sem concorrente e nada na pagante.
  {id:'cupons-topo',pagina:'cupons',onde:'topo da lista',computador:['super-banner'],celular:['link-patrocinado'],giram:3,casa:true},
  {id:'cupons-meio',pagina:'cupons',onde:'na lista, a cada 6 cupons',computador:['quadrado'],celular:['quadrado'],giram:1,casa:true,aCada:6},
  {id:'cupom-lateral',pagina:'cupom',onde:'lateral em tela larga',computador:['meia-pagina'],celular:[],giram:1,casa:true}
];
export const ESPACO_IDS=new Set(ESPACOS.map(e=>e.id));
// O anúncio do Nexus ocupa até o limite da página (16.1); antes eram 2.
export const MAX_POR_PAGINA=4,MAX_CELULAR=3,MAX_CASA=MAX_POR_PAGINA;
// Posições antigas do banners.json (Fase 2).
export const POSICOES_ANTIGAS={home:'home-topo','home-meio':'home-destaques',search:'busca-topo',content:'lista-topo'};
