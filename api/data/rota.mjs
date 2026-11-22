// Formato de toda rota de página (docs/CONTRATO.md): {title, description, status, view, vm, ogImage}.
// title já vem completo, com a marca; description é própria de cada página; ogImage vazio vira a imagem padrão no servidor.
// view é o nome de uma view registrada em api/views/index.mjs.
export const MARCA='Nexus';
export const titulo=texto=>`${texto} | ${MARCA}`;
export const rota=(view,vm={},{title,description,status=200,ogImage=''}={})=>({title,description,status,view,vm,ogImage});
// 404 de local ou publicação que não existe (ou foi pausada) e 404 genérico de caminho desconhecido.
export const indisponivel=()=>rota('indisponivel',{},{title:titulo('Página não encontrada'),status:404,description:'Este espaço ou publicação não está disponível no Nexus. Use a busca para explorar outros lugares no Rio de Janeiro.'});
export const naoEncontrada=()=>rota('nao-encontrada',{},{title:titulo('Página não encontrada'),status:404,description:'Este endereço não existe no Nexus. Use a busca para encontrar restaurantes, cafés, bares, eventos e espaços culturais no Rio de Janeiro.'});
