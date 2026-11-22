// Lista única de categorias (contrato: vm Categoria). O primeiro nível são os grupos da home; o segundo, as categorias do
// acervo com o nome normalizado (o import grava os nomes já normalizados em details.categories). Uma categoria pode estar
// em mais de um grupo; categoria que não esteja na tabela nem nas criadas pela equipe (22.1) cai em "Outros serviços".
import {slugify,byText,oneLine} from '../lib/saneamento.mjs';

export const GRUPOS=[
 {slug:'restaurantes',label:'Restaurantes'},
 {slug:'cafes-e-padarias',label:'Cafés e Padarias'},
 {slug:'bares-e-botecos',label:'Bares e Botecos'},
 {slug:'arte-e-cultura',label:'Arte e Cultura'},
 {slug:'livrarias-e-cinema',label:'Livrarias e Cinema'},
 {slug:'musica-e-palcos',label:'Música e Palcos'},
 {slug:'parques-e-lazer',label:'Parques e Lazer'},
 {slug:'experiencias',label:'Experiências'}
];
// Sinônimos normalizados.
const ALIASES={
 'Cafeteria':'Cafeterias Especiais','Cafeterias':'Cafeterias Especiais',
 'Boteco':'Botecos Tradicionais','Pizzaria':'Pizzarias','Bistrô':'Bistrôs'
};
// Categoria normalizada → grupos (o primeiro é o principal).
const CATEGORIAS={
 'Bistrôs':['restaurantes'],'Cozinha Brasileira':['restaurantes'],'Frutos do Mar':['restaurantes'],
 'Culinária Japonesa':['restaurantes'],'Pizzarias':['restaurantes'],'Comida Vegetariana':['restaurantes'],
 'Cafeterias Especiais':['cafes-e-padarias'],'Padarias Artesanais':['cafes-e-padarias'],'Confeitarias':['cafes-e-padarias'],
 'Botecos Tradicionais':['bares-e-botecos'],'Cervejarias Artesanais':['bares-e-botecos'],'Wine Bars':['bares-e-botecos'],
 'Casas de Samba e Choro':['bares-e-botecos','musica-e-palcos'],
 'Museus':['arte-e-cultura'],'Galerias de Arte':['arte-e-cultura'],'Centros Culturais':['arte-e-cultura'],'Teatros':['arte-e-cultura'],
 'Livrarias Independentes':['livrarias-e-cinema'],'Cinemas de Rua':['livrarias-e-cinema'],'Sebos e Discos':['livrarias-e-cinema'],
 'Casas de Show':['musica-e-palcos'],'Jazz e Instrumental':['musica-e-palcos'],'Rodas de Samba':['musica-e-palcos'],
 'Mirantes e Praças':['parques-e-lazer'],'Jardins e Parques':['parques-e-lazer'],'Feiras ao Ar Livre':['parques-e-lazer'],
 'Tours Gastronômicos':['experiencias'],'Oficinas Criativas':['experiencias'],'Degustações':['experiencias','bares-e-botecos']
};

// Categorias criadas pela equipe (contrato 22.1, tabela categories): nome → [grupo]. A lista única é a base acima mais
// estas. O servidor relê a tabela no máximo a cada 30 s (e na hora, quando cria uma); trocar de banco relê na hora.
let NOVAS=new Map(),lidas={db:null,em:0};
export async function carregarCategorias(db,{forcar=false,agora=Date.now()}={}) {
 if(!forcar&&lidas.db===db&&agora-lidas.em<30000)return;
 NOVAS=new Map((await db.query('SELECT nome,grupo FROM categories')).rows.map(r=>[r.nome,[r.grupo]]));
 lidas={db,em:agora};
}
export const registrarCategoria=(nome,grupo)=>{NOVAS.set(nome,[grupo]);};
// Os nomes da lista única (a base e as novas), os apelidos do portal antigo e os grupos de cada categoria.
export const nomesDaLista=()=>[...Object.keys(CATEGORIAS),...NOVAS.keys()];
export const apelidos=()=>Object.keys(ALIASES);
const gruposDe=nome=>CATEGORIAS[nome]||NOVAS.get(nome);

export const homeGroupLabels=GRUPOS.map(group=>group.label);
export const normalizeCategory=name=>{const value=oneLine(name);return ALIASES[value]||value;};
export const groupsOfCategory=name=>gruposDe(normalizeCategory(name))||['experiencias'];
const categoriesOf=business=>[...new Set((business.details?.categories||business.categories||[]).map(normalizeCategory))];

export function homeGroupsForBusiness(business) {
 return [...new Set(categoriesOf(business).flatMap(groupsOfCategory))];
}
export function availableHomeGroups(companies) {
 const present=new Set(companies.flatMap(homeGroupsForBusiness));
 return GRUPOS.filter(group=>present.has(group.slug)).map(({slug,label})=>({slug,label}));
}
// ?category= aceita o slug de um grupo ou o de uma categoria.
export function matchesHomeCategory(business,category) {
 return !category||homeGroupsForBusiness(business).includes(category)||categoriesOf(business).some(value=>slugify(value)===category);
}
// Nome de cada identificador do ?category= (grupo da home ou categoria do acervo), para as métricas da gestão (19.6).
export function nomesDasCategorias(companies=[]) {
 const nomes=new Map(GRUPOS.map(g=>[g.slug,g.label]));
 for(const c of [...nomesDaLista(),...companies.flatMap(categoriesOf)])if(!nomes.has(slugify(c)))nomes.set(slugify(c),c);
 return nomes;
}
// Rótulos aceitos nas categorias da empresa (14.5 e 13.4): grupos e categorias da lista única. v0.22.0: "Outra" saiu e
// virou a sugestão do painel (22.4); as categorias criadas pela equipe entraram.
export const allCategoryLabels=()=>[...homeGroupLabels,...nomesDaLista()];

// vm Categoria[]: grupos na ordem da home, categorias em ordem alfabética, com a contagem de empresas publicadas.
// all=true (cadastro) traz também grupos e categorias ainda sem empresa.
export function categoryTree(companies,{all=false}={}) {
 const count=new Map(),add=key=>count.set(key,(count.get(key)||0)+1);
 for(const b of companies){for(const g of homeGroupsForBusiness(b))add('g:'+g);for(const c of categoriesOf(b))add('c:'+c);}
 const known=new Set([...nomesDaLista(),...companies.flatMap(categoriesOf)]);
 return GRUPOS.map(group=>({
  slug:group.slug,label:group.label,count:count.get('g:'+group.slug)||0,
  subcategorias:[...known].filter(c=>groupsOfCategory(c).includes(group.slug)).sort(byText).map(c=>({slug:slugify(c),label:c,count:count.get('c:'+c)||0})).filter(c=>all||c.count)
 })).filter(group=>all||group.count);
}
