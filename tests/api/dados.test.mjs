import {test} from 'node:test';
import assert from 'node:assert/strict';
import {escape} from '../../api/lib/html.mjs';
import {safeURL,destinationURL,slugify,addressParts,formatCEP,withoutTracking,oneLine,clip,byText} from '../../api/lib/saneamento.mjs';
import {categoryTree,normalizeCategory,matchesHomeCategory,allCategoryLabels} from '../../api/data/categorias.mjs';
import {businessCardVM,searchFormVM,lowerCategory} from '../../api/data/empresas.mjs';
import {adsFor,bannerVM} from '../../api/data/anuncios.mjs';
import {contentCardVM} from '../../api/data/conteudo.mjs';
import {mapVM} from '../../api/data/mapa.mjs';
import {cadastroVM,PERGUNTAS} from '../../api/data/cadastro.mjs';
import {plans,banners,campaigns} from '../../api/data/planos.mjs';

// Loaders e saneamento com dados sintéticos, sem banco.
const img='https://www.primigdivulgacao.com.br/custom/domain_1/image_files/a.png';

test('escape e saneamento de URLs',()=>{
 assert.equal(escape(`<a href="x">'&'</a>`),'&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');assert.equal(escape(null),'');
 assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(safeURL('http://exemplo.com'),'');assert.equal(safeURL('https://u:p@exemplo.com'),'');
 assert.equal(safeURL('https://evil.test/a.jpg',{image:true}),'');assert.equal(safeURL(img,{image:true}),img);assert.equal(safeURL('https://Exemplo.com'),'https://exemplo.com/');
 assert.equal(destinationURL('/comercio/x?from=banner'),'/comercio/x?from=banner');assert.equal(destinationURL('//evil.test'),'');assert.equal(destinationURL('javascript:x'),'');
 assert.equal(slugify('Saúde & Bem-estar'),'saude-bem-estar');
});

test('cards: imagem só quando aprovada, sem inventar categoria ou bairro',()=>{
 assert.deepEqual(businessCardVM({slug:'a',name:'A',district:'',summary:'s',details:{image:'https://evil.test/x.png'}}),{slug:'a',name:'A',image:'',category:'',district:'',city:'',summary:'s',whatsappUrl:'',openNow:null,closesAt:'',opensAt:'',opensDay:'',rating:null,reviewsCount:0,sponsored:false});
 assert.equal(businessCardVM({slug:'a',name:'A',district:'Centro',summary:'',details:{image:img,categories:['Pets','Rações'],city:'Mesquita'}}).category,'Pets');
 const c=contentCardVM({kind:'article',slug:'x',title:'T',body:'b'.repeat(300),metadata:{image:'https://evil.test/i.png'}});
 assert.equal(c.href,'/artigos/x');assert.equal(c.image,'');assert.equal(c.excerpt.length,160);assert.equal(c.author,'');
});

test('banners: só do espaço pedido, com formato, destino e imagens aprovados',()=>{
 const rows=[{id:'1',placement:'home-topo',format:'super-banner',destination:'/busca',image_url:img,title:'A'},{id:'2',placement:'home-topo',format:'super-banner',destination:'javascript:x',image_url:img,title:'B'},
  {id:'3',placement:'home-topo',format:'super-banner',destination:'/busca',image_url:'https://evil.test/x.png',title:'C'},{id:'4',placement:'busca-topo',format:'super-banner',destination:'https://Exemplo.com',image_url:img,title:'D'},
  {id:'5',placement:'home-topo',format:'quadrado',destination:'/busca',image_url:img,title:'E'}];
 assert.deepEqual(adsFor('home',{campaigns:rows,random:()=>0.5})['home-topo'].banners,[{id:'1',placement:'home-topo',href:'/busca',image:img,title:'A',advertiser:'',format:'super-banner',width:728,height:90,imageMobile:''}]);
 assert.equal(adsFor('busca',{campaigns:rows,itens:3,random:()=>0.5})['busca-topo'].banners[0].href,'https://exemplo.com/');
 assert.equal(bannerVM({...rows[0],image_mobile_url:'https://evil.test/m.png'}).imageMobile,'','imagem do celular também só do portal');
});

test('filtros dependentes da busca: cada categoria com seus bairros e vice-versa, em ordem alfabética',()=>{
 const form=searchFormVM([{district:'Posse',details:{categories:['Oficina','Ótica']}},{district:'Centro',details:{categories:['Oficina']}},{district:'',details:{categories:['Pets']}}]);
 assert.deepEqual(form.categories,[{value:'oficina',label:'Oficina',districts:['Centro','Posse']},{value:'otica',label:'Ótica',districts:['Posse']},{value:'pets',label:'Pets',districts:[]}]);
 assert.deepEqual(form.districts,[{name:'Centro',categories:['oficina']},{name:'Posse',categories:['oficina','otica']}]);
});

test('mapa: um ponto por empresa com coordenada, espiral no mesmo lugar e bairros com empresas em destaque',()=>{
 const geo={lat:-22.7,lng:-43.45,precisao:'bairro'};
 const vm=mapVM([{slug:'a',name:'A',district:'Santa Rita',details:{geo}},{slug:'b',name:'B',district:'Santa Rita',details:{geo}},{slug:'c',name:'C',district:'',details:{}}]);
 assert.equal(vm.located,2);assert.equal(vm.missing,1);assert.equal(vm.pontos.length,2);assert.ok(vm.pontos.every(p=>p.approx));
 assert.notDeepEqual([vm.pontos[0].x,vm.pontos[0].y],[vm.pontos[1].x,vm.pontos[1].y],'mesmo ponto se abre em espiral');
 assert.equal(vm.bairros[0].nome,'Santa Rita');assert.equal(vm.bairros[0].guia,true);assert.equal(vm.bairros.filter(b=>b.guia).length,1);
});

test('cadastro (17): planos, campanhas e banners viram opções das perguntas plano e banner',()=>{
 assert.deepEqual(Object.keys(cadastroVM()),['values','errors','abertura','perguntas','novidades','origem']);
 const options=PERGUNTAS.filter(p=>['plano','banner'].includes(p.id)).flatMap(p=>p.opcoes.map(o=>o.valor));
 for(const item of [...plans,...campaigns,...banners])assert.ok(options.includes(item.interesse),item.interesse);
 assert.deepEqual(plans.map(p=>p.interesse),['plano-avancado','plano-premium','plano-personalizado']);
});

test('endereço do acervo em partes: sem rua vazia, sem repetir bairro, cidade e estado, CEP formatado',()=>{
 assert.deepEqual(addressParts({street:'Rua, 2 - 361',district:'Santa Rita',city:'Nova Iguaçu',cep:'',full:'Rua , 2 - 361, Loja, Santa Rita, Nova Iguaçu, Rio de Janeiro 26053170, Brasil'}),{street:'',district:'Santa Rita',city:'Nova Iguaçu',cep:'26053-170',address:'Santa Rita, Nova Iguaçu'});
 assert.equal(addressParts({street:'Estrada do Grotão, 15 - Inconfidência- Queimados - R.J',district:'Inconfidência',city:'Queimados'}).street,'Estrada do Grotão, 15');
 assert.equal(addressParts({street:'Rua Francisco Barone 159, Santa Rita -NI',district:'Santa Rita',city:'Nova Iguaçu'}).address,'Rua Francisco Barone 159, Santa Rita, Nova Iguaçu');
 assert.equal(addressParts({street:'Tv. Quaresma, 71 - Centro',district:'Centro',city:'Nova Iguaçu',cep:'26210-340'}).address,'Tv. Quaresma, 71, Centro, Nova Iguaçu');
 assert.equal(addressParts({full:'Rua X 280, Monte Castelo, Nova Iguaçu, Rio de Janeiro 26.041-610, Brasil'}).cep,'26041-610');
 assert.equal(formatCEP('26011 002'),'26011-002');assert.equal(formatCEP('123'),'');
 assert.deepEqual(addressParts({}),{street:'',district:'',city:'',cep:'',address:''});
});

test('links de site sem utm_* nem fbclid; texto em uma linha e cortado sem partir palavra',()=>{
 assert.equal(withoutTracking('https://linktr.ee/loja?utm_source=ig&utm_medium=social&fbclid=abc'),'https://linktr.ee/loja');
 assert.equal(withoutTracking('https://exemplo.com.br/a?id=7&UTM_campaign=x'),'https://exemplo.com.br/a?id=7');
 assert.equal(withoutTracking(''),'');assert.equal(oneLine('  a \n\n b  '),'a b');
 const cut=clip('palavra '.repeat(40));assert.ok(cut.length<=160);assert.match(cut,/palavra…$/);assert.equal(clip('curto'),'curto');
 assert.deepEqual(['Alvorada','Alô','alho','Ãgua'].sort(byText),['Ãgua','alho','Alô','Alvorada']);
 assert.equal(lowerCategory('Loja de Tintas'),'loja de tintas');assert.equal(lowerCategory('GNV'),'GNV');
});

test('lista única de categorias: grupos com subcategorias normalizadas, a mesma para home, busca e cadastro',()=>{
 const companies=[{details:{categories:['Buffet']}},{details:{categories:['Serviços de Buffet','Pizzarias']}},{details:{categories:['Oficina mecênica']}},{details:{categories:['Lojas de Materiais de Construção']}}];
 const tree=categoryTree(companies);
 assert.deepEqual(tree.map(g=>g.slug),['alimentacao','casa-e-construcao','automotivo','eventos']);
 assert.deepEqual(tree[0],{slug:'alimentacao',label:'Alimentação',count:2,subcategorias:[{slug:'buffets-e-catering',label:'Buffets e catering',count:2},{slug:'pizzarias',label:'Pizzarias',count:1}]});
 assert.deepEqual(tree.find(g=>g.slug==='eventos').subcategorias.map(c=>c.label),['Buffets e catering'],'a mesma subcategoria em dois grupos');
 assert.equal(tree.find(g=>g.slug==='automotivo').subcategorias[0].label,'Oficina mecânica');
 assert.equal(normalizeCategory(' Buffets e Catering '),'Buffets e catering');assert.equal(normalizeCategory('Categoria nova'),'Categoria nova');
 assert.equal(matchesHomeCategory(companies[0],'buffets-e-catering'),true);assert.equal(matchesHomeCategory(companies[0],'eventos'),true);
 const all=categoryTree([],{all:true});assert.equal(all.length,10);assert.ok(all.every(g=>g.count===0));assert.ok(all.find(g=>g.slug==='imobiliaria'));
 assert.ok(allCategoryLabels().includes('Buffets e catering')&&allCategoryLabels().includes('Alimentação'));
 assert.ok(!allCategoryLabels().includes('Outra'),'v0.22.0: "Outra" virou a sugestão do painel (22.4)');
 const banner=PERGUNTAS.find(p=>p.id==='banner').opcoes[0];assert.deepEqual([banner.valor,banner.rotulo,banner.detalhe],['banner-link-patrocinado','Link patrocinado','320 × 100 · R$ 35,00/mês']);
});
