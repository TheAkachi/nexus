import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signupSubmission} from '../../api/cadastro.mjs';
import {loadCadastro,PERGUNTAS,ABERTURA} from '../../api/data/cadastro.mjs';

// v0.16.0 (contrato, seção 17): cadastro só com respostas de escolher, que formam a mensagem para o WhatsApp do Leandro.
const mensagem=fields=>{const r=signupSubmission(fields,'https://guia.test');assert.ok(r.redirect,JSON.stringify(r.vm?.errors));return new URL(r.redirect).searchParams.get('text');};
const vm=path=>loadCadastro(new URL(path,'http://x')).vm;

test('perguntas na ordem do contrato, todas com trecho ou frase própria, e o português de cada ramo',()=>{
 assert.deepEqual(PERGUNTAS.map(p=>[p.id,p.tipo,p.obrigatoria,p.bloco]),[['ramo','uma',true,1],['local','uma',true,1],['tempo','uma',false,1],['canais','varias',false,1],
  ['objetivos','varias',false,1],['plano','uma',true,2],['banner','uma',false,2],['horario','uma',false,3]]);
 for(const p of PERGUNTAS){assert.equal((p.frase.match(/\{\}/g)||[]).length,1,p.id);for(const o of p.opcoes)assert.ok(o.trecho||o.frase!==undefined,`${p.id}/${o.valor}`);
  assert.equal(new Set(p.opcoes.map(o=>o.valor)).size,p.opcoes.length,`${p.id}: valores únicos`);}
 const ramo=PERGUNTAS[0].opcoes;assert.equal(ramo.length,12);
 assert.deepEqual(['automotivo','imobiliaria','outros-servicos','comercio-online','outro'].map(v=>ramo.find(o=>o.valor===v).trecho),
  ['do ramo automotivo','do ramo imobiliário','de prestação de serviços','um comércio on-line','de um ramo que não está na lista']);
 assert.equal(PERGUNTAS.find(p=>p.id==='local').opcoes.find(o=>o.valor==='sao-joao-de-meriti').trecho,'São João de Meriti');
 const plano=PERGUNTAS.find(p=>p.id==='plano').opcoes;
 assert.deepEqual(plano.find(o=>o.valor==='plano-personalizado'),{valor:'plano-personalizado',rotulo:'Plano Personalizado',detalhe:'valor a combinar',trecho:'no Plano Personalizado (valor a combinar)'});
 assert.deepEqual(plano.find(o=>o.valor==='campanha-basica'),{valor:'campanha-basica',rotulo:'Campanha Básica',detalhe:'panfletagem digital · R$ 750,00/mês',trecho:'na Campanha Básica de panfletagem digital (R$ 750,00/mês)'});
 assert.equal(PERGUNTAS.find(p=>p.id==='banner').opcoes.find(o=>o.valor==='nao').frase,'');
});

test('?interesse= marca o plano ou o banner; valor desconhecido não marca nada',()=>{
 assert.deepEqual(vm('/cadastro?interesse=plano-premium').values,{plano:'plano-premium'});
 assert.deepEqual(vm('/cadastro?interesse=campanha-basica').values,{plano:'campanha-basica'});
 assert.deepEqual(vm('/cadastro?interesse=banner-quadrado').values,{banner:'banner-quadrado'});
 assert.deepEqual(vm('/cadastro?interesse=%3Cx%3E').values,{});assert.deepEqual(vm('/cadastro').values,{});
 assert.equal(vm('/cadastro').abertura,ABERTURA);
});

test('a mensagem: frases por bloco, trechos na ordem das opções, frase própria e frase vazia (17.2)',()=>{
 assert.equal(mensagem({ramo:'alimentacao',local:'nova-iguacu',tempo:'1-a-5',canais:['google','instagram','google'],objetivos:'mais-clientes',plano:'plano-avancado',banner:'nao',horario:'qualquer',novidades:'sim'}),
  'Olá, Leandro! Tenho interesse em me tornar afiliado à PRIMIG.\n\n'+
  'Meu negócio é do ramo de alimentação. Ele fica em Nova Iguaçu. Ele existe há 1 a 5 anos. Hoje os clientes me encontram pelo Instagram e pelo Google. Quero mais clientes no WhatsApp.\n\n'+
  'Tenho interesse no Plano Avançado (R$ 67,00/mês).\n\n'+
  'Posso conversar em qualquer horário. Quero receber novidades da PRIMIG pelo WhatsApp.\n\n'+
  'Enviado pelo site guia.test');
 assert.match(mensagem({ramo:'outro',local:'outra',plano:'conhecer',canais:['indicacao','facebook','instagram'],banner:'saber'}),
  /Meu negócio é de um ramo que não está na lista\. Ele fica em outra cidade\. Hoje os clientes me encontram pelo Instagram, pelo Facebook e por indicação\.\n\nQuero ajuda para escolher o melhor plano\. Quero saber mais sobre os banners\.\n\nEnviado/);
 assert.match(mensagem({ramo:'pets',local:'japeri',plano:'campanha-avancada',banner:'banner-super-banner',tempo:'vai-abrir',horario:'noite'}),
  /do ramo de pets\. Ele fica em Japeri\. Ainda vou abrir o negócio\.\n\nTenho interesse na Campanha Avançada de panfletagem digital \(R\$ 1\.550,00\/mês\)\. Também quero o banner Super Banner, 728 × 90 \(R\$ 99,00\/mês\)\.\n\nPrefiro conversar à noite\./);
});

test('validação: obrigatórias, valor fora da lista e duas respostas numa pergunta de escolha única (17.3)',()=>{
 const r=signupSubmission({ramo:'alimentacao',local:['nova-iguacu','mesquita'],plano:'plano-ouro',canais:['instagram','tiktok'],novidades:'sim'},'https://guia.test');
 assert.equal(r.status,422);assert.equal(r.view,'cadastro');
 assert.deepEqual(r.vm.errors.map(e=>[e.campo,e.mensagem]),[['local','Escolha uma opção da lista.'],['canais','Escolha uma opção da lista.'],['plano','Escolha uma opção da lista.']]);
 assert.deepEqual(r.vm.values,{ramo:'alimentacao',local:'nova-iguacu',canais:['instagram'],novidades:'sim'},'volta só o que vale');
 assert.deepEqual(signupSubmission({ramo:'',local:' ',plano:''},'https://guia.test').vm.errors.map(e=>e.mensagem),
  ['Escolha o ramo do seu negócio.','Escolha onde fica o seu negócio.','Escolha um plano, ou peça ajuda para escolher.']);
});
