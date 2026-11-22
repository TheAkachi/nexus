import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {openDB,migrate} from '../../api/db.mjs';
import {compararNomes} from '../../api/lib/parecidos.mjs';
import {groupsOfCategory,nomesDasCategorias} from '../../api/data/categorias.mjs';
import {ambiente} from './helpers-painel.mjs';

// Categoria nova, sugestão de categoria pela fila e rede sem nome repetido (contrato 22, v0.22.0).
const E='boreal-tintas';let t,admin,editor,dono;
const perfil=async()=>(await t.com(dono,`/api/painel/empresas/${E}/perfil`)).json;
const patch=async body=>t.com(dono,`/api/painel/empresas/${E}`,{method:'PATCH',body:{...body,version:(await perfil()).version}});
const criar=(body,s=admin)=>t.com(s,'/api/admin/categorias',{method:'POST',body});
const filaCategoria=async()=>(await t.com(admin,'/api/admin/fila?tipo=categoria')).json.itens;
before(async()=>{
  t=await ambiente();
  await t.conta('admin@categorias.test',{equipe:'admin'});await t.conta('editor@categorias.test',{equipe:'editor'});await t.conta('dono@categorias.test',{empresa:E,papel:'dono'});
  [admin,editor,dono]=[await t.entrar('admin@categorias.test'),await t.entrar('editor@categorias.test'),await t.entrar('dono@categorias.test')];
});
after(async()=>{await t?.fim();});

test('nomes iguais e parecidos: sem acento, maiúscula e pontuação; contido ou até 2 letras de diferença',()=>{
  const lista=['Pizzarias','Super Kibarato','Clínicas médicas','GNV'];
  assert.equal(compararNomes('PIZZARIAS!',lista).igual,'Pizzarias');
  assert.equal(compararNomes('clinicas  medicas',lista).igual,'Clínicas médicas');
  assert.deepEqual(compararNomes('Pizzaria',lista).parecidos,['Pizzarias']);
  assert.deepEqual(compararNomes('Kibarato',lista).parecidos,['Super Kibarato']);
  assert.deepEqual(compararNomes('GLP',lista).parecidos,[],'com até 5 letras, só 1 letra de diferença');
  assert.deepEqual(compararNomes('GNVs',lista).parecidos,['GNV']);
  assert.deepEqual(compararNomes('Lavanderia',lista),{igual:null,parecidos:[]});
});

test('admin: categoria igual recusada, parecidas antes de criar, e a nova vale na busca, nas opções e nas métricas',async()=>{
  for(const [nome,igual] of [['pizzarias','Pizzarias'],['Buffet','Buffets e catering'],['PETS','Pets'],['outra','Outra']]) {
    const r=await criar({nome,grupo:'alimentacao'});
    assert.deepEqual([r.status,r.json.campo,r.json.igual],[422,'nome',{nome:igual}],nome);
  }
  const p=await criar({nome:'Pizzaria',grupo:'alimentacao'});
  assert.deepEqual([p.status,p.json.campo,p.json.parecidas.map(x=>[x.nome,x.grupos.map(g=>g.slug)])],[422,'nome',[['Pizzarias',['alimentacao']]]]);
  assert.ok(Number.isInteger(p.json.parecidas[0].empresas));
  assert.deepEqual([(await criar({nome:'Banho e tosa',grupo:'nada'})).json.campo,(await criar({nome:'B',grupo:'pets'})).json.campo],['grupo','nome']);
  assert.equal((await criar({nome:'Banho e tosa',grupo:'pets'},editor)).status,403,'o editor não tem a ação empresas');
  const r=await criar({nome:'Banho e tosa',grupo:'pets'});
  assert.equal(r.status,201);
  assert.deepEqual({...r.json,criadaEm:undefined},{nome:'Banho e tosa',slug:'banho-e-tosa',grupos:[{slug:'pets',label:'Pets'}],criadaEm:undefined});
  assert.equal((await t.db.query("SELECT count(*)::int AS n FROM audit_log WHERE action='categoria_criada' AND resource_id='banho-e-tosa'")).rows[0].n,1);
  assert.deepEqual((await criar({nome:'Banho e tosas',grupo:'pets'})).json.parecidas.map(x=>x.nome),['Banho e tosa'],'a nova já entra nas parecidas');
  assert.equal((await criar({nome:'Pizzaria',grupo:'alimentacao',confirmar:true})).status,201,'com confirmar, cria mesmo com parecidas');
  // A categoria nova no seu grupo, nas opções, na empresa, na busca e no nome das métricas.
  assert.deepEqual(groupsOfCategory('Banho e tosa'),['pets']);
  const pets=(await perfil()).opcoes.categorias.find(g=>g.slug==='pets');
  assert.ok(pets.subcategorias.some(c=>c.label==='Banho e tosa'));
  const emp=(await t.com(admin,`/api/admin/empresas/${E}`)).json;
  assert.equal((await t.com(admin,`/api/admin/empresas/${E}`,{method:'PATCH',body:{categorias:[...emp.categorias,'Banho e tosa'],version:emp.version}})).status,200);
  for(const q of ['banho-e-tosa','pets'])assert.match((await t.req(`/busca?category=${q}`)).text,/Boreal Tintas/,q);
  assert.equal(nomesDasCategorias().get('banho-e-tosa'),'Banho e tosa');
  // "Outra" deixa de valer como categoria da empresa.
  assert.equal((await patch({categorias:['Loja de Tintas','Outra']})).json.campo,'categorias');
});

test('painel: "Outra" vira sugestão na fila, sem entrar nas categorias; a nova substitui, e null retira',async()=>{
  const antes=(await perfil()).categorias;
  const igual=await patch({sugestaoCategoria:{nome:'loja de tintas',grupo:'casa-e-construcao'}});
  assert.deepEqual([igual.status,igual.json.campo,igual.json.igual],[422,'sugestaoCategoria',{nome:'Loja de Tintas'}]);
  assert.equal((await patch({sugestaoCategoria:{nome:'Chaveiro'}})).json.campo,'sugestaoCategoria','sem grupo');
  const r=await patch({sugestaoCategoria:{nome:'Chaveiro',grupo:'casa-e-construcao'}});
  assert.deepEqual([r.status,r.json.emAnalise],[200,['sugestaoCategoria']]);
  let p=await perfil();
  assert.deepEqual([p.categorias,p.emAnalise,{...p.sugestaoCategoria,em:undefined}],
    [antes,['sugestaoCategoria'],{nome:'Chaveiro',grupo:{slug:'casa-e-construcao',label:'Casa e construção'},status:'pendente',comentario:'',em:undefined}]);
  assert.ok((await t.com(dono,`/api/painel/empresas/${E}`)).json.primig.emAnalise.some(x=>x.tipo==='categoria'&&x.titulo==='Categoria sugerida: Chaveiro'));
  assert.doesNotMatch((await t.req('/busca?q=chaveiro')).text,/Boreal Tintas/,'a sugestão não entra na busca');
  await patch({sugestaoCategoria:{nome:'Chaveiro 24 horas',grupo:'casa-e-construcao'}});
  assert.deepEqual((await filaCategoria()).map(i=>i.dados.nome),['Chaveiro 24 horas'],'a nova substitui a pendente');
  await patch({sugestaoCategoria:null});
  p=await perfil();
  assert.deepEqual([p.sugestaoCategoria,p.emAnalise,(await filaCategoria()).length],[null,[],0]);
  assert.equal((await patch({categorias:[],sugestaoCategoria:{nome:'Chaveiro',grupo:'casa-e-construcao'}})).json.campo,'categorias','publicada, a sugestão não conta');
});

test('fila: aprovar criando, com o nome corrigido; trocar por uma da lista; recusar com comentário; igual recusado',async()=>{
  await patch({sugestaoCategoria:{nome:'Chaveiro',grupo:'casa-e-construcao'}});
  let [i]=await filaCategoria();
  assert.deepEqual([i.tipo,i.dados.nome,i.dados.grupo,Array.isArray(i.dados.parecidas)],['categoria','Chaveiro',{slug:'casa-e-construcao',label:'Casa e construção'},true]);
  const decidir=(id,acao,body)=>t.com(admin,`/api/admin/fila/${id}/${acao}`,{method:'POST',body});
  let r=await decidir(i.id,'aprovar',{version:i.version,nome:'Chaveiro e fechaduras'});
  assert.equal(r.status,200);
  assert.deepEqual((await t.db.query("SELECT nome,grupo FROM categories WHERE slug='chaveiro-e-fechaduras'")).rows,[{nome:'Chaveiro e fechaduras',grupo:'casa-e-construcao'}]);
  let p=await perfil();
  assert.ok(p.categorias.includes('Chaveiro e fechaduras'));assert.equal(p.sugestaoCategoria,null,'a aprovada não aparece');
  assert.deepEqual(groupsOfCategory('Chaveiro e fechaduras'),['casa-e-construcao']);
  // Trocar por uma da lista, sem criar.
  await patch({sugestaoCategoria:{nome:'Serralheria',grupo:'casa-e-construcao'}});
  [i]=await filaCategoria();
  assert.equal((await decidir(i.id,'aprovar',{version:i.version,categoria:'Não existe'})).json.campo,'categoria');
  assert.equal((await decidir(i.id,'aprovar',{version:i.version,categoria:'Pedreiro'})).status,200);
  assert.ok((await perfil()).categorias.includes('Pedreiro'));
  assert.equal((await t.db.query("SELECT count(*)::int AS n FROM categories WHERE nome='Serralheria'")).rows[0].n,0);
  // Recusar com comentário: o anunciante vê no perfil.
  await patch({sugestaoCategoria:{nome:'Coisas diversas',grupo:'outros-servicos'}});
  [i]=await filaCategoria();
  assert.equal((await decidir(i.id,'recusar',{version:i.version,comentario:'Use Reformas e Acabamentos.'})).status,200);
  p=await perfil();
  assert.deepEqual([p.sugestaoCategoria.status,p.sugestaoCategoria.comentario,p.emAnalise],['recusada','Use Reformas e Acabamentos.',[]]);
  // Ao criar, igual a uma que entrou na lista depois da sugestão: a equipe troca por ela.
  await patch({sugestaoCategoria:{nome:'Lava jato',grupo:'automotivo'}});
  assert.equal((await criar({nome:'Lava Jato',grupo:'automotivo'})).status,201);
  [i]=await filaCategoria();
  r=await decidir(i.id,'aprovar',{version:i.version});
  assert.deepEqual([r.status,r.json.campo,r.json.igual],[422,'nome',{nome:'Lava Jato'}]);
  // categoria, nome e grupo só valem neste tipo da fila.
  await patch({resumo:'Tintas e acessórios para a sua obra, com entrega.'});
  const [desc]=(await t.com(admin,'/api/admin/fila?tipo=descricao')).json.itens;
  assert.equal((await decidir(desc.id,'aprovar',{version:desc.version,nome:'x'})).json.campo,'nome');
});

test('rede nova: nome igual recusado, parecidas antes de criar e o identificador repetido como antes',async()=>{
  const redes=(await t.com(admin,'/api/admin/redes')).json.itens,rede=redes[0];
  const nova=body=>t.com(admin,'/api/admin/redes',{method:'POST',body});
  const igual=await nova({nome:rede.nome.toUpperCase()});
  assert.deepEqual([igual.status,igual.json.campo,igual.json.igual],[422,'nome',{id:rede.id,nome:rede.nome}]);
  assert.equal(igual.json.erro,`Já existe a rede "${rede.nome}".`);
  // Uma palavra do nome da rede (como "Kibarato" de "Super Kibarato") está contida nele: é parecida.
  const parte=rede.nome.split(' ').sort((a,b)=>b.length-a.length)[0];
  const parecida=await nova({nome:parte});
  assert.deepEqual([parecida.status,parecida.json.parecidas.map(x=>x.id)],[422,[rede.id]]);
  const r=await nova({nome:parte,confirmar:true});
  assert.deepEqual([r.status,r.json.empresas],[201,0]);
  assert.equal((await nova({id:rede.id,nome:'Uma rede com outro nome qualquer',confirmar:true})).json.campo,'id');
});

test('migração 014: a tabela das categorias com o grupo conferido e o tipo categoria na fila',async()=>{
  const db=await openDB({url:null,path:':memory:'});
  try {
    await migrate(db);
    await assert.rejects(db.query("INSERT INTO categories(nome,slug,grupo) VALUES('Xis','xis','nada')"));
    await db.query("INSERT INTO categories(nome,slug,grupo) VALUES('Xis','xis','pets')");
    await assert.rejects(db.query("INSERT INTO categories(nome,slug,grupo) VALUES('Xis!','xis','pets')"),'slug repetido');
    await db.query("INSERT INTO businesses(id,slug,name,status) VALUES('e','e','E','draft')");
    await db.query("INSERT INTO approvals(id,business_id,kind,resource_id) VALUES('a','e','categoria','e')");
  } finally {await db.close();}
});
