import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {pageRoute} from '../../api/server.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {loadAdmin} from '../../api/data/admin/pagina.mjs';
import {ambiente,origin} from './helpers-painel.mjs';

// Fase 4: admin da equipe (contrato 13). Servidor real, relógio fixo (segunda, 05/10/2026, 10h).
let t,admin,editor,operador,associado;
before(async()=>{
 t=await ambiente();
 await t.conta('admin@primig.test',{equipe:'admin'});await t.conta('editor@primig.test',{equipe:'editor'});await t.conta('operador@primig.test',{equipe:'operador'});
 await t.conta('dono@associado.test',{empresa:'boreal-tintas'});
 [admin,editor,operador,associado]=await Promise.all(['admin@primig.test','editor@primig.test','operador@primig.test','dono@associado.test'].map(e=>t.entrar(e)));
});
after(async()=>{await t?.fim();});
const api=(s,path,opts)=>t.com(s,`/api/admin${path}`,opts);
const publico=async path=>{const url=new URL(path,'http://x');return (await pageRoute({db:t.db,path:url.pathname,url,now:t.agora,random:()=>0.5})).vm;};
const sessao=async s=>(await t.db.query('SELECT s.id,s.user_id,s.csrf,s.token_hash,u.email,u.name,u.staff_role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[s.csrf])).rows[0];
const pagina=async(s,path)=>{const url=new URL(path,origin);return loadAdmin({db:t.db,session:await sessao(s),path:url.pathname,url,now:t.agora});};
const jpg=(w=1200,h=800)=>sharp({create:{width:w,height:h,channels:3,background:'#2a6'}}).jpeg().toBuffer();

test('só a equipe entra; cada papel só faz o que pode; CSRF em toda escrita',async()=>{
 assert.equal((await api(associado,'/resumo')).status,404,'associado não vê o admin');
 assert.equal(admin.usuario.equipe,'admin');assert.equal(associado.usuario.equipe,null,'o login diz se a pessoa é da equipe (13.9, item 12)');
 assert.equal((await t.req('/api/admin/resumo')).status,404,'sem sessão também 404');
 const r=(await api(operador,'/resumo')).json;assert.deepEqual(Object.keys(r).sort(),['bannersNoAr','cupons','empresas','espacosLivres','fila','recorte','solicitacoes']);
 assert.equal((await api(editor,'/empresas',{method:'POST',body:{nome:'Nova'}})).status,403);
 assert.equal((await api(operador,'/conteudo',{method:'POST',body:{tipo:'noticia',titulo:'Teste'}})).status,403);
 assert.equal((await api(operador,'/planos',{method:'POST',body:{nome:'Ouro'}})).status,403);
 assert.equal((await api(editor,'/equipe',{method:'POST',body:{email:'x@primig.test',papel:'editor'}})).status,403);
 assert.equal((await t.req('/api/admin/redes',{method:'POST',cookie:admin.cookie,body:{nome:'Sem CSRF'}})).status,403);
 for(const path of ['/empresas','/conteudo?tipo=artigo','/banners','/midia','/fila','/auditoria','/usuarios','/solicitacoes','/cupons','/relatorios'])assert.equal((await api(editor,path)).status,200,path);
 // Página: vm do admin, record e novo; fora da equipe, 404.
 assert.equal((await pagina(associado,'/admin')).status,404);
 const vm=(await pagina(editor,'/admin/empresas?bairro=Centro')).vm;
 assert.equal(vm.modulo,'empresas');assert.deepEqual(vm.filtros,{bairro:'Centro'});assert.ok(vm.dados.itens.every(e=>e.bairro==='Centro'));
 assert.deepEqual(vm.pode,{empresas:false,conteudo:true,banners:true,midia:true,fila:true,cupons:true,planos:false,acessos:false,equipe:false,solicitacoes:true});
 assert.deepEqual(Object.keys(vm.opcoes).sort(),['bairros','categorias','editorias','empresas','espacos','planos','redes']);assert.deepEqual(Object.keys(vm.contagem),['fila','solicitacoes']);
 assert.equal((await pagina(editor,'/admin/empresas/boreal-tintas')).vm.dados.nome,'Boreal Tintas');
 assert.equal((await pagina(editor,'/admin/empresas/nao-existe')).status,404);assert.equal((await pagina(editor,'/admin/conteudo/novo')).vm.dados,null);
 assert.equal((await pagina(editor,'/admin/fila')).title,'Fila de aprovação · Admin | Guia PRIMIG');
});

test('empresas: criar, publicar, editar por versão, filtrar por bairro e categoria; o db:seed não sobrescreve',async()=>{
 const erro=await api(operador,'/empresas',{method:'POST',body:{nome:'X'}});assert.equal(erro.json.campo,'nome');
 const nova=await api(operador,'/empresas',{method:'POST',body:{nome:'Pizzaria Sol Nascente',bairro:'Centro',rua:'Rua Marechal Floriano, 100',cep:'26210000',telefone:'(21) 2667-0000',
  categorias:['Pizzarias'],horario:[1,2,3,4,5,6].map(dia=>({dia,abre:'06:00',fecha:'20:00'}))}});
 if(nova.status!==201)assert.fail(JSON.stringify(nova.json));
 assert.equal(nova.json.status,'rascunho');assert.equal(nova.json.gerida,true);assert.equal(nova.json.horario.length,6);
 assert.equal((await t.req('/comercio/pizzaria-sol-nascente')).status,404,'rascunho não aparece');
 const pub=(await api(operador,`/empresas/pizzaria-sol-nascente/publicar`,{method:'POST',body:{version:nova.json.version}})).json;assert.equal(pub.status,'publicado');
 const perfil=await publico('/comercio/pizzaria-sol-nascente');assert.equal(perfil.openNow,true);assert.equal(perfil.address,'Rua Marechal Floriano, 100, Centro, Nova Iguaçu');
 assert.equal((await api(operador,'/empresas/pizzaria-sol-nascente',{method:'PATCH',body:{version:nova.json.version,resumo:'velho'}})).status,409);
 const ed=(await api(operador,'/empresas/pizzaria-sol-nascente',{method:'PATCH',body:{version:pub.version,resumo:'Pizza todos os dias.',whatsapp:'(21) 99999-1234'}})).json;
 assert.equal(ed.resumo,'Pizza todos os dias.');assert.equal(ed.whatsapp,'5521999991234');
 const lista=(await api(editor,'/empresas?bairro=Centro&categoria=alimentacao')).json;assert.ok(lista.itens.some(e=>e.id==='pizzaria-sol-nascente'));
 assert.ok(lista.itens.every(e=>e.bairro==='Centro'));
 // Empresa do acervo editada no admin não volta ao texto do acervo no db:seed.
 const boreal=(await api(admin,'/empresas/boreal-tintas')).json;
 await api(admin,'/empresas/boreal-tintas',{method:'PATCH',body:{version:boreal.version,resumo:'Tintas e acessórios em Santa Rita.'}});
 await importSnapshot(t.db);assert.equal((await api(admin,'/empresas/boreal-tintas')).json.resumo,'Tintas e acessórios em Santa Rita.');
 const a=(await t.db.query("SELECT before,after FROM audit_log WHERE action='empresa_editada' AND business_id='boreal-tintas'")).rows[0];assert.ok(a.before.resumo&&a.after.resumo);
 // Redes.
 assert.equal((await api(operador,'/redes',{method:'POST',body:{nome:'Rede Sol'}})).status,201);
 const v=(await api(operador,'/empresas/pizzaria-sol-nascente')).json.version;assert.equal((await api(operador,'/empresas/pizzaria-sol-nascente',{method:'PATCH',body:{version:v,rede:'rede-sol'}})).json.rede,'rede-sol');
 assert.equal((await api(operador,'/empresas/pizzaria-sol-nascente',{method:'PATCH',body:{version:v+1,rede:'inexistente'}})).json.campo,'rede');
});

test('plano real pelo admin: ordem na busca, Patrocinado e regra do anúncio no perfil, sem JSON (D2)',async()=>{
 const p=(await api(admin,'/planos',{method:'POST',body:{nome:'Ouro',precoCentavos:35000,ordem:5,patrocinado:true,pago:true}})).json;assert.deepEqual([p.id,p.status,p.pago],['ouro','ativo',true]);
 const cebolinha='cebolinha-gnv-e-ar-condicionado-automotivo';
 assert.ok((await publico(`/comercio/${cebolinha}`)).ads['perfil-lateral'],'antes do plano real: não pagante tem anúncio');
 const v=(await api(operador,`/empresas/${cebolinha}`)).json.version;
 await api(operador,`/empresas/${cebolinha}`,{method:'PATCH',body:{version:v,plano:'ouro'}});
 const busca=await publico('/busca');assert.equal(busca.results[0].slug,cebolinha);assert.equal(busca.results[0].sponsored,true);
 assert.deepEqual((await publico(`/comercio/${cebolinha}`)).ads,{},'plano pago: sem anúncio');
 assert.ok((await publico('/comercio/funeraria-sao-salvador')).ads['perfil-lateral'],'com plano real, a página própria do portal deixa de contar');
 const ed=(await api(admin,'/planos/ouro',{method:'PATCH',body:{version:p.version,pago:false}})).json;assert.equal(ed.pago,false);
 assert.ok((await publico(`/comercio/${cebolinha}`)).ads['perfil-lateral'],'plano que não é pago não tira o anúncio');
 await t.db.query('UPDATE businesses SET plan_id=NULL');await t.db.query("DELETE FROM plans WHERE id='ouro'");
});

test('mídia com texto alternativo obrigatório e artigo publicado com imagem (Pronto quando); notícia fora do admin (15.3)',async()=>{
 assert.equal((await api(editor,'/midia',{method:'POST',raw:await jpg(),type:'image/jpeg'})).json.campo,'alt');
 const m=await api(editor,'/midia?alt=Feira%20na%20pra%C3%A7a',{method:'POST',raw:await jpg(2400,1600),type:'image/jpeg'});
 assert.equal(m.status,201);assert.deepEqual([m.json.largura,m.json.altura,m.json.alt],[1600,1067,'Feira na praça']);
 assert.match(m.json.url,/^\/midia\/[a-f0-9]{32}\/1600\.webp$/);assert.deepEqual(Object.keys(m.json.tamanhos),['320','800','1600']);
 assert.equal((await t.req(m.json.url)).status,200,'pública na hora');
 const html=`<h1>Feira</h1><p>Texto <script>alert(1)</script>da feira.</p><figure><img src="${m.json.tamanhos[800]}" alt="Feira"><figcaption>A praça</figcaption></figure><p><img src="https://outro.site/x.jpg" alt="Outra"></p>`;
 assert.equal((await api(editor,'/conteudo',{method:'POST',body:{tipo:'noticia',titulo:'Notícia'}})).json.campo,'tipo','notícia saiu do site');
 assert.equal((await api(editor,'/conteudo?tipo=noticia')).json.campo,'tipo');
 const noticia=(await t.db.query("SELECT id FROM content WHERE kind='news' LIMIT 1")).rows[0].id;
 assert.equal((await api(editor,`/conteudo/${encodeURIComponent(noticia)}`)).status,404,'notícia não aparece no admin');
 assert.equal((await api(editor,`/conteudo/${encodeURIComponent(noticia)}/pausar`,{method:'POST',body:{version:1}})).status,404);
 assert.ok((await api(editor,'/conteudo')).json.itens.every(c=>c.tipo==='artigo'),'sem ?tipo=, os artigos');
 const n=await api(editor,'/conteudo',{method:'POST',body:{tipo:'artigo',titulo:'Feira de outubro na praça',html,editorias:['Cidade Nova Iguaçu'],imagem:m.json.url}});
 assert.equal(n.status,201);assert.equal(n.json.status,'rascunho');
 assert.doesNotMatch(n.json.html,/script/);assert.match(n.json.html,new RegExp(`<img src="${m.json.tamanhos[800]}" alt="Feira" loading="lazy">`));assert.match(n.json.html,/Imagem: Outra/);
 assert.equal((await t.req(`/artigos/${n.json.slug}`)).status,404,'rascunho fora do ar');
 const pub=(await api(editor,`/conteudo/${encodeURIComponent(n.json.id)}/publicar`,{method:'POST',body:{version:n.json.version}})).json;
 assert.equal(pub.status,'publicado');assert.equal(pub.data,t.agora.toISOString());
 const leitura=await publico(`/artigos/${n.json.slug}`);assert.equal(leitura.image,m.json.url);assert.match(leitura.bodyHtml,/\/midia\//);assert.equal(leitura.editoria.slug,'cidade-nova-iguacu');
 assert.equal((await publico('/artigos')).destaque.href,`/artigos/${n.json.slug}`,'a mais recente com foto vira o destaque (18.6)');
 // Em uso: não sai da biblioteca.
 assert.equal((await api(editor,`/midia/${m.json.id}`,{method:'DELETE'})).status,422);
 const solta=(await api(editor,'/midia?alt=Sobra',{method:'POST',raw:await jpg(400,300),type:'image/jpeg'})).json;
 assert.equal((await api(editor,`/midia/${solta.id}`,{method:'PATCH',body:{version:solta.version,alt:'Sobra editada'}})).json.alt,'Sobra editada');
 assert.equal((await api(editor,`/midia/${solta.id}`,{method:'DELETE'})).status,200);assert.equal((await t.req(solta.url)).status,404);
 // Notícia do acervo editada no admin: o db:seed não desfaz.
 const acervo=(await api(editor,'/conteudo?tipo=artigo&q=autocuidado')).json.itens[0];
 await api(editor,`/conteudo/${encodeURIComponent(acervo.id)}`,{method:'PATCH',body:{version:acervo.version,titulo:'Autocuidado é necessidade (revisto)'}});
 await importSnapshot(t.db);assert.equal((await api(editor,`/conteudo/${encodeURIComponent(acervo.id)}`)).json.titulo,'Autocuidado é necessidade (revisto)');
});

test('eventos com descrição em HTML, ofertas da equipe e coleções',async()=>{
 const e=await api(editor,'/eventos',{method:'POST',body:{titulo:'Feira do bairro',inicio:'2026-10-10T09:00',fim:'2026-10-10T18:00',local:'Praça',descricao:'<p>Com <strong>música</strong><script>x</script></p>',empresa:'boreal-tintas'}});
 assert.equal(e.status,201);assert.equal(e.json.descricao,'<p>Com <strong>música</strong></p>');assert.equal(e.json.inicio,'2026-10-10T09:00');
 await api(editor,`/eventos/${e.json.id}/publicar`,{method:'POST',body:{version:e.json.version}});
 const ev=(await publico('/eventos')).items[0];assert.deepEqual([ev.description,ev.descriptionHtml],['Com música','<p>Com <strong>música</strong></p>']);
 await importSnapshot(t.db);assert.equal((await publico('/eventos')).items.length,1,'evento do admin não é pausado pelo arquivo');
 assert.equal((await api(editor,'/ofertas',{method:'POST',body:{empresa:'boreal-tintas',nome:'Tinta',precoModo:'fixo',precoCentavos:19990}})).json.campo,'condicoes');
 const o=await api(editor,'/ofertas',{method:'POST',body:{empresa:'boreal-tintas',nome:'Tinta 18L',precoModo:'fixo',precoCentavos:19990,condicoes:'À vista',validade:'2026-10-31'}});
 assert.equal(o.json.status,'publicado');assert.deepEqual((await publico('/ofertas')).items.map(i=>i.name),['Tinta 18L']);
 const c=await api(editor,'/colecoes',{method:'POST',body:{titulo:'Vai pintar a casa?',grupos:['casa-e-construcao'],posicao:1,status:'publicado'}});
 assert.equal(c.status,201);assert.ok((await publico('/')).collections.some(x=>x.title==='Vai pintar a casa?'));
 await importSnapshot(t.db);assert.ok((await publico('/')).collections.some(x=>x.title==='Vai pintar a casa?'),'coleção do admin fica');
 assert.equal((await api(editor,'/colecoes',{method:'POST',body:{titulo:'Errada',grupos:['nao-existe']}})).json.campo,'grupos');
});

test('banner agendado num espaço (Pronto quando): validação, ocupação e o anúncio no ar',async()=>{
 const m=(await api(editor,'/midia?alt=Banner%20teste',{method:'POST',raw:await jpg(728,90),type:'image/jpeg'})).json;
 const b=await api(editor,'/banners',{method:'POST',body:{titulo:'Promoção Boreal',anunciante:'Boreal Tintas',empresa:'boreal-tintas',espaco:'busca-topo',formato:'quadrado',destino:'/comercio/boreal-tintas',imagem:m.url}});
 assert.equal(b.status,201);assert.equal(b.json.status,'rascunho');
 const sem=await api(editor,`/banners/${b.json.id}/publicar`,{method:'POST',body:{version:b.json.version}});assert.equal(sem.json.campo,'formato','o topo da busca não aceita quadrado');
 const ok=(await api(editor,`/banners/${b.json.id}`,{method:'PATCH',body:{version:b.json.version,formato:'super-banner'}})).json;
 assert.equal((await api(editor,`/banners/${b.json.id}/publicar`,{method:'POST',body:{version:ok.version}})).json.campo,'inicio');
 const datas=(await api(editor,`/banners/${b.json.id}`,{method:'PATCH',body:{version:ok.version,inicio:'2026-10-05',fim:'2026-10-20'}})).json;
 const pub=await api(editor,`/banners/${b.json.id}/publicar`,{method:'POST',body:{version:datas.version}});assert.equal(pub.json.status,'publicado');
 assert.deepEqual((await publico('/busca')).ads['busca-topo'].banners.map(x=>x.id),[b.json.id]);
 const oc=(await api(editor,'/banners/ocupacao?de=2026-10-19&ate=2026-10-22')).json;
 const topo=oc.espacos.find(e=>e.id==='busca-topo');assert.deepEqual(topo.dias.map(d=>[d.dia,d.banners.length,d.livres]),[['2026-10-19',1,2],['2026-10-20',1,2],['2026-10-21',0,3],['2026-10-22',0,3]]);
 assert.equal(topo.casa,true);assert.ok(topo.onde);
 const vm=(await pagina(editor,'/admin/banners?aba=ocupacao')).vm;assert.deepEqual([vm.filtros.de,vm.filtros.ate],['2026-10-05','2026-11-03']);
 assert.equal((await api(editor,'/banners/ocupacao?de=2026-10-01&ate=2027-03-01')).json.campo,'ate');
 // Banner do portal editado no admin não volta a seguir o banners.json.
 const portal=(await api(editor,'/banners/2')).json;await api(editor,'/banners/2',{method:'PATCH',body:{version:portal.version,titulo:'L. Marinho (editado)'}});
 await importSnapshot(t.db);assert.equal((await api(editor,'/banners/2')).json.titulo,'L. Marinho (editado)');
 assert.equal((await api(editor,'/banners/primig-quadrado')).status,404,'o anúncio da PRIMIG não é editado aqui');
});
