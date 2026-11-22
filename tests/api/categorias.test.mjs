import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableHomeGroups,matchesHomeCategory} from '../../api/data/categorias.mjs';

test('categorias gerais agrupam o acervo sem inventar empresas',()=>{
 const companies=[
  {details:{categories:['Pizzarias']}},
  {details:{categories:['Loja de Tintas']}},
  {details:{categories:['Clínicas médicas']}}
 ];
 assert.deepEqual(availableHomeGroups(companies).map(group=>group.label),['Alimentação','Saúde e bem-estar','Casa e construção']);
 assert.equal(matchesHomeCategory(companies[0],'alimentacao'),true);
 assert.equal(matchesHomeCategory(companies[1],'casa-e-construcao'),true);
 assert.equal(matchesHomeCategory(companies[1],'loja-de-tintas'),true);
 assert.equal(matchesHomeCategory(companies[2],'imobiliaria'),false);
});
