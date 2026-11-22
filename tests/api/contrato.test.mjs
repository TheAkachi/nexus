import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {pageRoute} from '../../api/server.mjs';
import {signupSubmission,contactSubmission} from '../../api/cadastro.mjs';
import {views} from '../../api/views/index.mjs';
import {exemplos} from '../views/exemplos.mjs';

// Contrato entre back e front (docs/CONTRATO.md): toda rota de página devolve {title, description, status, view, vm, ogImage},
// a view existe no registro e o vm tem pelo menos as chaves do exemplo em tests/views/exemplos.mjs (o back pode
// acrescentar campos antes de o front usá-los, mas não tirar os que o exemplo tem).
let db;
before(async()=>{db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);});
after(async()=>{if(db)await db.close();});
const route=path=>pageRoute({db,path:decodeURIComponent(new URL(path,'http://x').pathname),url:new URL(path,'http://x')});
const check=(r,view,status)=>{
 assert.deepEqual(Object.keys(r).sort(),['description','ogImage','status','title','view','vm'],view);
 assert.equal(r.view,view);assert.equal(r.status,status,view);assert.ok(views[r.view],`view ${r.view} registrada`);
 assert.match(r.title,/ \| Guia PRIMIG$|^Guia Comercial PRIMIG \| /,`${view}: título completo, com a marca`);
 assert.equal(typeof r.description,'string');assert.ok(r.description.length>=40&&r.description.length<=160,`${view}: descrição própria (${r.description.length})`);
 assert.doesNotMatch(r.description,/\s{2}/,`${view}: sem espaços duplos`);
 assert.ok(r.ogImage===''||/^https:\/\//.test(r.ogImage),`${view}: ogImage aprovada ou vazia`);
 for(const key of Object.keys(exemplos[view]))assert.ok(key in r.vm,`vm ${view} tem ${key}`);
};
const cases=async()=>{
 const article=(await db.query("SELECT slug FROM content WHERE kind='article' LIMIT 1")).rows[0].slug;
 const news=(await db.query("SELECT slug FROM content WHERE kind='news' LIMIT 1")).rows[0].slug;
 return [['/','home',200],['/?category=alimentacao','home',200],['/busca','busca',200],['/busca?q=tinta','busca',200],['/busca?category=loja-de-tintas&district=Santa%20Rita','busca',200],['/busca?page=2','busca',200],['/favoritos','busca',200],
  ['/comercio/boreal-tintas','empresa',200],['/comercio/funeraria-sao-salvador','empresa',200],['/comercio/nao-existe','indisponivel',404],['/artigos?page=2','conteudos',200],['/artigos','conteudos',200],['/classificados','conteudos',200],
  [`/artigos/${article}`,'conteudo',200],[`/noticias/${news}`,'indisponivel',410],['/classificados/nao-existe','indisponivel',404],['/ofertas','ofertas',200],['/eventos','eventos',200],['/para-empresas','para-empresas',200],
  ['/cadastro?interesse=plano-premium','cadastro',200],['/institucional/contato','contato',200],['/institucional/sobre','sobre',200],['/institucional/faq','institucional',200],['/institucional/termos','institucional',200],
  ['/institucional/privacidade','institucional',200],['/nada-aqui','nao-encontrada',404],['/busca?page=99','nao-encontrada',404]];
};

test('cada rota de página devolve o formato do contrato, com título, descrição e ogImage próprios',async()=>{
 const seen=new Map();
 for(const [path,view,status] of await cases()){
  const r=await route(path);check(r,view,status);
  // Nenhuma descrição repetida entre páginas indexáveis diferentes (os 404 podem repetir).
  if(status===200){assert.ok(!seen.has(r.description)||seen.get(r.description)===path,`descrição repetida em ${path} e ${seen.get(r.description)}`);seen.set(r.description,path);}
 }
 const boreal=await route('/comercio/boreal-tintas');
 assert.equal(boreal.title,'Boreal Tintas · loja de tintas em Santa Rita | Guia PRIMIG');assert.match(boreal.ogImage,/^https:\/\/www\.primigdivulgacao\.com\.br\//);
 assert.equal((await route('/institucional/sobre')).description,'A PRIMIG conecta comerciantes locais e consumidores por meio do guia comercial da região.');
 assert.deepEqual((await route('/institucional/termos')).vm,{title:'Termos de uso',key:'termos'});
 assert.equal((await route('/institucional/privacidade')).title,'Privacidade | Guia PRIMIG');
});

test('formulário com erro devolve a mesma view com status 422 e erros por campo; válido devolve só o redirecionamento',()=>{
 const signup=signupSubmission({},'http://x.test');check(signup,'cadastro',422);
 assert.deepEqual(signup.vm.errors.map(e=>e.campo),['ramo','local','plano']);assert.equal(signup.vm.errors[0].mensagem,'Escolha o ramo do seu negócio.');
 assert.equal(String(signup.vm.errors[0]),'Escolha o ramo do seu negócio.','a mensagem também sai como texto');
 assert.deepEqual(JSON.parse(JSON.stringify(signup.vm.errors[0])),{campo:'ramo',mensagem:'Escolha o ramo do seu negócio.'});
 const contact=contactSubmission({},'http://x.test');check(contact,'contato',422);assert.deepEqual(contact.vm.errors.map(e=>e.campo),['nome','mensagem']);
 assert.deepEqual(Object.keys(signupSubmission({ramo:'alimentacao',local:'nova-iguacu',plano:'conhecer'},'http://x.test')),['redirect']);
});

test('URLs do vm já chegam aprovadas: https, imagens só do portal da PRIMIG e links sem rastreio',async()=>{
 const urls=[];
 const walk=(value,key='')=>{if(typeof value==='string'&&/^(image|src|href|website|sourceUrl|whatsappUrl|mapUrl|directionsUrl|url)$/.test(key)&&/^[a-z]+:/i.test(value))urls.push([key,value]);else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))walk(v,Array.isArray(value)?key:k);};
 for(const path of ['/','/busca','/comercio/boreal-tintas','/comercio/funeraria-sao-salvador','/artigos','/classificados'])walk((await route(path)).vm);
 assert.ok(urls.length>20);
 for(const [key,url] of urls){assert.match(url,/^https:\/\//,url);assert.doesNotMatch(url,/[?&](utm_|fbclid)/i,url);if(['image','src'].includes(key))assert.match(url,/^https:\/\/(www\.)?primigdivulgacao\.com\.br\//,url);}
});
