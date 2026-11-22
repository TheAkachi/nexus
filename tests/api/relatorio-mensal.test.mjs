import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {openDB,migrate} from '../../api/db.mjs';
import {loadPainel} from '../../api/data/contas.mjs';
import {relatorioEmpresa} from '../../api/data/painel.mjs';
import {ambiente} from './helpers-painel.mjs';

// Relatório do mês (contrato 20, v0.20.0): um mês fechado comparado com o anterior, das somas diárias, com o mês sem
// medição em null e o mês em que a série começou no meio como parcial. Hoje é 05/12/2026: o padrão é novembro.
const E='boreal-tintas';let t,dono,leitura,fora,outra,parada;
const somar=(dia,empresa,c)=>t.db.query('INSERT INTO business_daily(day,business_id,views,contact_whatsapp,contact_phone,contact_map,contact_website,search_impressions) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
  [dia,empresa,c.v||0,c.w||0,c.t||0,c.r||0,c.s||0,c.a||0]);
before(async()=>{
  t=await ambiente();t.agora=new Date('2026-12-05T10:00:00-03:00');
  [outra,parada]=(await t.db.query("SELECT id FROM businesses WHERE id<>$1 AND status='published' ORDER BY id LIMIT 2",[E])).rows.map(r=>r.id);
  await t.conta('dono@relatorio.test',{empresa:E,papel:'dono'});await t.conta('leitura@relatorio.test',{empresa:E,papel:'leitura'});await t.conta('fora@relatorio.test',{empresa:outra,papel:'dono'});
  [dono,leitura,fora]=[await t.entrar('dono@relatorio.test'),await t.entrar('leitura@relatorio.test'),await t.entrar('fora@relatorio.test')];
  await t.db.query("UPDATE metric_starts SET since=CASE serie WHEN 'contatos' THEN '2026-09-24'::date WHEN 'aparicoes' THEN '2026-10-15'::date WHEN 'banners' THEN '2026-10-03'::date ELSE since END");
  await somar('2026-08-20',E,{v:7,a:3});
  await somar('2026-09-25',E,{v:10,w:2});
  await somar('2026-10-03',E,{v:100,w:20,t:3,r:5,s:1});
  await somar('2026-10-20',E,{v:5,a:50});
  await somar('2026-11-10',E,{v:130,w:25,t:1,r:6,a:80});
  await somar('2026-11-10',outra,{v:999,w:99,a:999});
  for(const [id,titulo,status] of [['boreal-nov','Tintas com 10% de desconto','published'],['boreal-casa','Anúncio da casa','house'],['boreal-antigo','Banner antigo','published']])
    await t.db.query("INSERT INTO campaigns(id,title,source,status,business_id) VALUES($1,$2,'{}'::jsonb,$3,$4)",[id,titulo,status,E]);
  for(const [dia,c,slot,i,k] of [['2026-11-12','boreal-nov','home-topo',2000,30],['2026-11-13','boreal-nov','busca-topo',310,7],['2026-10-20','boreal-nov','home-topo',820,9],
    ['2026-11-12','boreal-casa','home-topo',500,5],['2026-09-10','boreal-antigo','home-topo',100,1]])
    await t.db.query('INSERT INTO ad_daily(day,campaign_id,slot,impressions,clicks) VALUES($1,$2,$3,$4,$5)',[dia,c,slot,i,k]);
});
after(async()=>{await t?.fim();});

test('novembro contra outubro: os números do mês, a diferença só com os dois meses inteiros e os banners da empresa',async()=>{
  const r=(await t.com(dono,`/api/painel/empresas/${E}/relatorio`)).json;
  assert.deepEqual([r.mes,r.rotulo,r.anterior,r.url],['2026-11','novembro de 2026',{mes:'2026-10',rotulo:'outubro de 2026'},`/painel/${E}/relatorio/2026-11`]);
  assert.deepEqual(r.visitas,{atual:130,anterior:105,diferenca:25});
  assert.deepEqual(r.contatos,{whatsapp:{atual:25,anterior:20,diferenca:5},telefone:{atual:1,anterior:3,diferenca:-2},rota:{atual:6,anterior:5,diferenca:1},
    site:{atual:0,anterior:1,diferenca:-1},total:{atual:32,anterior:29,diferenca:3}});
  assert.deepEqual(r.aparicoes,{atual:80,anterior:50,diferenca:null},'outubro é parcial nas aparições, medidas desde 15/10');
  assert.deepEqual(r.banners,[{id:'boreal-nov',titulo:'Tintas com 10% de desconto',impressoes:{atual:2310,anterior:820,diferenca:null},cliques:{atual:37,anterior:9,diferenca:null}}],
    'sem o banner da casa e sem o antigo, que não teve nada nos dois meses');
  assert.deepEqual(r.series,{contatos:{medidoDesde:'2026-09-24',parcial:{atual:false,anterior:false}},aparicoes:{medidoDesde:'2026-10-15',parcial:{atual:false,anterior:true}},
    banners:{medidoDesde:'2026-10-03',parcial:{atual:false,anterior:true}}});
  assert.deepEqual(r.disponiveis,[['2026-11','novembro'],['2026-10','outubro'],['2026-09','setembro']].map(([mes,n])=>({mes,rotulo:`${n} de 2026`,url:`/painel/${E}/relatorio/${mes}`})));
  assert.match(r.nota,/aceitaram a medição/);
  // Só totais: as chaves são exatamente as do contrato.
  assert.deepEqual(Object.keys(r),['mes','rotulo','anterior','url','disponiveis','series','visitas','contatos','aparicoes','banners','nota']);
});

test('outubro e setembro: o mês sem medição vem null, nunca zero, e o mês parcial não tem diferença',async()=>{
  const out=(await t.com(dono,`/api/painel/empresas/${E}/relatorio?mes=2026-10`)).json;
  assert.deepEqual(out.visitas,{atual:105,anterior:10,diferenca:null},'setembro é parcial nos contatos, medidos desde 24/09');
  assert.deepEqual(out.aparicoes,{atual:50,anterior:null,diferenca:null},'setembro acaba antes de 15/10');
  assert.deepEqual(out.banners.map(b=>[b.id,b.impressoes,b.cliques]),[['boreal-nov',{atual:820,anterior:null,diferenca:null},{atual:9,anterior:null,diferenca:null}]],
    'o banner de 10/09, antes da medição dos banners, não entra');
  assert.deepEqual([out.series.contatos.parcial,out.series.banners.parcial],[{atual:false,anterior:true},{atual:true,anterior:false}]);
  const set=(await t.com(dono,`/api/painel/empresas/${E}/relatorio?mes=2026-09`)).json;
  assert.deepEqual([set.anterior.mes,set.visitas,set.contatos.total,set.aparicoes,set.banners],
    ['2026-08',{atual:10,anterior:null,diferenca:null},{atual:2,anterior:null,diferenca:null},{atual:null,anterior:null,diferenca:null},[]]);
});

test('empresa sem movimento num mês medido: zero, não null',async()=>{
  const r=await relatorioEmpresa(t.db,parada,'2026-11',t.agora);
  assert.deepEqual([r.visitas,r.contatos.whatsapp,r.aparicoes,r.banners],[{atual:0,anterior:0,diferenca:0},{atual:0,anterior:0,diferenca:0},{atual:0,anterior:0,diferenca:null},[]]);
});

test('meses aceitos e quem vê: os quatro papéis, 422 fora dos meses fechados e 404 sem vínculo',async()=>{
  for(const mes of ['2026-08','2026-12','2027-01','2026-13','11-2026']) {
    const r=await t.com(dono,`/api/painel/empresas/${E}/relatorio?mes=${mes}`);
    assert.deepEqual([r.status,r.json.campo],[422,'mes'],mes);
  }
  assert.equal((await t.com(leitura,`/api/painel/empresas/${E}/relatorio`)).json.mes,'2026-11');
  assert.equal((await t.com(fora,`/api/painel/empresas/${E}/relatorio`)).status,404);
  assert.equal((await t.req(`/api/painel/empresas/${E}/relatorio`)).status,401);
});

test('página: endereço estável por mês, o padrão no mês anterior, o login antes e 404 fora dos meses aceitos',async()=>{
  assert.deepEqual([(await t.com(dono,`/painel/${E}/relatorio`)).status,(await t.com(dono,`/painel/${E}/relatorio`)).location],[303,`/painel/${E}/relatorio/2026-11`]);
  const sem=await t.req(`/painel/${E}/relatorio/2026-10`);
  assert.deepEqual([sem.status,sem.location],[303,`/entrar?next=${encodeURIComponent(`/painel/${E}/relatorio/2026-10`)}`]);
  const sessao={...(await t.db.query('SELECT s.id,s.user_id,s.csrf,s.token_hash,u.email,u.name,u.staff_role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[dono.csrf])).rows[0],tipo:'afiliado'};
  const pagina=path=>loadPainel({db:t.db,session:sessao,path,url:new URL(`http://x${path}`),now:t.agora});
  const p=await pagina(`/painel/${E}/relatorio/2026-10`);
  assert.deepEqual([p.status,p.view,p.vm.modulo,p.vm.dados.mes],[200,'painel','relatorio','2026-10']);
  assert.match(p.title,/^Relatório de outubro de 2026 · .+ \| Guia PRIMIG$/);
  for(const path of [`/painel/${E}/relatorio/2026-08`,`/painel/${E}/relatorio/2026-12`,`/painel/${E}/relatorio/2026-13`,`/painel/${E}/resultados/2026-11`,`/painel/${outra}/relatorio/2026-11`])
    assert.equal((await pagina(path)).status,404,path);
});

test('migração 013: aparições e banners medidos desde o dia em que rodaram a 006 e a 005',async()=>{
  const db=await openDB({url:null,path:':memory:'});
  try {
    await migrate(db);
    const r=(await db.query(`SELECT m.serie,m.since=(s.applied_at AT TIME ZONE 'America/Sao_Paulo')::date AS igual FROM metric_starts m
      JOIN schema_migrations s ON s.name=CASE m.serie WHEN 'aparicoes' THEN '006_contas.sql' ELSE '005_anuncios.sql' END WHERE m.serie IN ('aparicoes','banners') ORDER BY 1`)).rows;
    assert.deepEqual(r,[{serie:'aparicoes',igual:true},{serie:'banners',igual:true}]);
    await assert.rejects(db.query("INSERT INTO metric_starts(serie,since) VALUES('outra','2026-01-01')"));
  } finally {await db.close();}
});
