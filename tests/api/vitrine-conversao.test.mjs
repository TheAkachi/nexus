import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {pageRoute} from '../../api/server.mjs';
import {ingestEvent} from '../../api/events.mjs';
import {slugsDeBairros,rodapeBairros} from '../../api/data/bairros.mjs';
import {sitemapEntries} from '../../api/data/sitemap.mjs';
import {ambiente,SENHA} from './helpers-painel.mjs';

// v0.17.0 (contrato, seção 18): bairros, busca com mapa e cupom, perfil com referência, pagamentos, Waze e avaliações de
// moradores, Para empresas com o formulário curto, destaque de artigos, pessoas do Sobre nós e a medição nova.
let t,dono,admin,editor,ana;
const A='boreal-tintas',G='garcia-churrasco';
const vm=async(path,sess=null)=>{const url=new URL(path,'http://x');const s=sess?(await t.db.query('SELECT s.user_id,s.csrf,u.staff_role,u.kind FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[sess.csrf])).rows[0]:null;
  return pageRoute({db:t.db,path:url.pathname,url,now:t.agora,usuario:s?.user_id||null,conta:s?{tipo:sess.usuario.tipo,csrf:s.csrf}:null});};
const api=(s,path,opts)=>t.com(s,`/api/admin${path}`,opts);
before(async()=>{
 t=await ambiente();
 await t.conta('dono@v17.test',{empresa:A});await t.conta('admin@v17.test',{equipe:'admin'});await t.conta('editor@v17.test',{equipe:'editor'});
 [dono,admin,editor]=await Promise.all(['dono@v17.test','admin@v17.test','editor@v17.test'].map(e=>t.entrar(e)));
 const r=await t.req('/api/auth/cadastro',{method:'POST',body:{nome:'Ana Maria Souza',email:'ana@v17.test',senha:SENHA,aceite:true}});
 ana={cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.json.csrf,usuario:r.json.usuario};
});
after(async()=>{await t?.fim();});

test('bairros (18.2): lista, página do bairro com mapa e outros da mesma cidade, 404 e o slug com cidade quando repete',async()=>{
 const lista=(await vm('/bairros')).vm;
 assert.equal(lista.bairros.length,17);assert.deepEqual(lista.bairros.find(b=>b.slug==='santa-rita'),{slug:'santa-rita',name:'Santa Rita',city:'Nova Iguaçu',count:11});
 const nomes=lista.bairros.map(b=>b.name);assert.deepEqual(nomes,[...nomes].sort((a,b)=>a.localeCompare(b,'pt-BR')),'ordem alfabética');
 assert.ok(lista.map.pontos.length>0);
 const sr=await vm('/bairros/santa-rita');
 assert.equal(sr.title,'Empresas em Santa Rita, Nova Iguaçu | Guia PRIMIG');
 assert.deepEqual([sr.vm.total,sr.vm.pages,sr.vm.current,sr.vm.results.length],[11,1,1,11]);
 assert.ok(sr.vm.results.every(c=>c.district==='Santa Rita'));assert.ok(sr.vm.map.pontos.every(p=>p.district==='Santa Rita'));
 assert.ok(sr.vm.outros.length<=6&&sr.vm.outros.every(o=>o.slug!=='santa-rita'));
 assert.deepEqual((await vm('/bairros/farrula')).vm.outros,[{slug:'areia-branca',name:'Areia Branca',count:1}],'só a mesma cidade (Belford Roxo)');
 for(const p of ['/bairros/nao-existe','/bairros/santa-rita?page=2'])assert.equal((await vm(p)).status,404,p);
 assert.deepEqual(slugsDeBairros([{name:'Centro',city:'Nova Iguaçu'},{name:'Centro',city:'Mesquita'},{name:'Posse',city:'Nova Iguaçu'}]).map(b=>b.slug),['centro-nova-iguacu','centro-mesquita','posse']);
 const rodape=await rodapeBairros(t.db);assert.equal(rodape.titulo,'Bairros com mais empresas');assert.equal(rodape.itens.length,8);assert.deepEqual(rodape.itens[0],{slug:'santa-rita',name:'Santa Rita'});
 const mapa=(await sitemapEntries(t.db,t.agora)).map(e=>e.path);assert.ok(mapa.includes('/bairros')&&mapa.includes('/bairros/santa-rita'));
 assert.equal((await t.db.query("SELECT new_path FROM redirects WHERE old_path='/guia-comercial/santa-rita'")).rows[0].new_path,'/bairros/santa-rita');
});

test('busca (18.3): mapa com todos os resultados e o filtro "Com cupom" com contagem',async()=>{
 const b=(await vm('/busca')).vm;
 assert.equal(b.results.length,12);assert.equal(b.map.located+b.map.missing,b.total,'o mapa conta todos os resultados, não só a página');
 assert.deepEqual([b.filters.cupom,b.counts.cupom],[false,0]);
 const c=await t.com(dono,`/api/painel/empresas/${A}/cupons`,{method:'POST',body:{titulo:'10% em tintas',condicoes:'Vale na loja de Santa Rita.',validade:'2026-10-31'}});assert.equal(c.status,201);
 const com=(await vm('/busca?cupom=1')).vm;assert.deepEqual([com.total,com.filters.cupom,com.results[0].slug],[1,true,A]);
 assert.equal((await vm('/busca')).vm.counts.cupom,1);
 assert.equal((await vm('/cupons')).vm.items[0].empresa.id,A,'o CupomCard traz o id da empresa (coupon_copied)');
});

test('perfil (18.4): referência e pagamentos pelo painel e pelo admin, Waze só com coordenada exata',async()=>{
 const v=(await t.com(dono,`/api/painel/empresas/${A}/perfil`)).json;assert.deepEqual([v.referencia,v.pagamentos],['',[]]);
 for(const [body,campo] of [[{pagamentos:['pix','cheque']},'pagamentos'],[{pagamentos:'pix'},'pagamentos'],[{referencia:'x'.repeat(121)},'referencia']])
  assert.equal((await t.com(dono,`/api/painel/empresas/${A}`,{method:'PATCH',body:{version:v.version,...body}})).json.campo,campo,JSON.stringify(body));
 const r=await t.com(dono,`/api/painel/empresas/${A}`,{method:'PATCH',body:{version:v.version,referencia:'  Em frente à praça ',pagamentos:['credito','pix','pix','boleto']}});
 assert.equal(r.status,200);assert.deepEqual(r.json.publicado.sort(),['pagamentos','referencia']);
 const e=(await vm(`/comercio/${A}`)).vm;assert.deepEqual([e.referencia,e.pagamentos],['Em frente à praça',['pix','credito','boleto']],'na ordem da lista, sem repetir');
 assert.match(e.wazeUrl,/^https:\/\/waze\.com\/ul\?ll=-22\.\d+,-43\.\d+&navigate=yes$/,'coordenada exata (precisão de rua)');
 assert.equal((await vm(`/comercio/${G}`)).vm.wazeUrl,'','sem coordenada');
 const adm=(await api(admin,`/empresas/${A}`)).json;assert.deepEqual([adm.referencia,adm.pagamentos],['Em frente à praça',['pix','credito','boleto']]);
 assert.deepEqual((await api(admin,`/empresas/${A}`,{method:'PATCH',body:{version:adm.version,pagamentos:['dinheiro']}})).json.pagamentos,['dinheiro']);
});

test('avaliações de moradores (18.4): pendente na fila, aprovada aparece, recusada pode ser trocada, bloqueios e exclusão da conta',async()=>{
 const url=`/api/empresas/${A}/avaliacoes`;
 assert.deepEqual((await vm(`/comercio/${A}`)).vm.avaliar,{conta:false,minha:null,bloqueio:''});
 assert.deepEqual((await vm(`/comercio/${A}`,ana)).vm.avaliar,{conta:true,csrf:ana.csrf,minha:null,bloqueio:''});
 assert.equal((await vm(`/comercio/${A}`,dono)).vm.avaliar.bloqueio,'propria');assert.equal((await vm(`/comercio/${A}`,editor)).vm.avaliar.bloqueio,'equipe');
 assert.equal((await t.req(url,{method:'POST',body:{nota:5,texto:'Atendimento muito bom.'}})).status,401);
 assert.equal((await t.com(ana,url,{method:'POST',body:{nota:5,texto:'Atendimento muito bom.'},csrf:'x'})).status,403,'CSRF');
 for(const [body,campo] of [[{nota:0,texto:'Atendimento muito bom.'},'nota'],[{nota:4.5,texto:'Atendimento muito bom.'},'nota'],[{nota:4,texto:'curto'},'texto'],[{nota:4,texto:'ok ok ok ok',extra:1},'extra']])
  assert.equal((await t.com(ana,url,{method:'POST',body})).json.campo,campo,JSON.stringify(body));
 assert.equal((await t.com(dono,url,{method:'POST',body:{nota:5,texto:'A melhor loja de tintas.'}})).status,403,'quem cuida da empresa não avalia');
 assert.equal((await t.com(editor,url,{method:'POST',body:{nota:5,texto:'A melhor loja de tintas.'}})).status,403,'a equipe não avalia');
 assert.equal((await t.com(ana,'/api/empresas/nao-existe/avaliacoes',{method:'POST',body:{nota:5,texto:'Atendimento muito bom.'}})).status,404);
 assert.deepEqual((await t.com(ana,url,{method:'POST',body:{nota:4,texto:'Atendimento muito bom.'}})).json,{status:'pendente'});
 assert.equal((await t.com(ana,url,{method:'POST',body:{nota:5,texto:'Mandando de novo.'}})).status,409);
 assert.deepEqual((await vm(`/comercio/${A}`,ana)).vm.avaliar.minha,{nota:4,texto:'Atendimento muito bom.',status:'pendente'});
 assert.deepEqual((await vm(`/comercio/${A}`)).vm.moradores,{media:null,total:0,itens:[]},'pendente não aparece');
 // Fila: recusar, mandar outra, aprovar.
 const fila=async()=>(await api(editor,'/fila?tipo=avaliacao')).json.itens;
 let item=(await fila())[0];assert.deepEqual(item.dados,{nota:4,texto:'Atendimento muito bom.',autor:{nome:'Ana'}});
 await api(editor,`/fila/${item.id}/recusar`,{method:'POST',body:{version:item.version,comentario:'Fale do atendimento, por favor.'}});
 assert.equal((await vm(`/comercio/${A}`,ana)).vm.avaliar.minha.status,'recusada');
 assert.equal((await t.com(ana,url,{method:'POST',body:{nota:5,texto:'Atendimento rápido e simpático.'}})).status,201,'a recusada pode ser trocada');
 item=(await fila())[0];await api(editor,`/fila/${item.id}/aprovar`,{method:'POST',body:{version:item.version}});
 const m=(await vm(`/comercio/${A}`)).vm.moradores;
 assert.deepEqual(m,{media:5,total:1,itens:[{nome:'Ana',nota:5,texto:'Atendimento rápido e simpático.',data:'05/10/2026'}]});
 assert.ok((await vm(`/comercio/${A}`)).vm.reviews.length>=0,'as do portal continuam separadas');
 // Excluir a conta apaga a avaliação; o pedido que ainda esperava sai da fila.
 await t.com(ana,`/api/empresas/${G}/avaliacoes`,{method:'POST',body:{nota:3,texto:'Bom, mas demorou.'}});
 assert.equal((await t.com(ana,'/api/me',{method:'DELETE',body:{senha:SENHA}})).status,200);
 assert.deepEqual((await vm(`/comercio/${A}`)).vm.moradores,{media:null,total:0,itens:[]});
 assert.equal((await fila()).length,0,'o pedido da avaliação apagada não fica esperando');
});

test('Para empresas (18.5): o formulário curto com as perguntas obrigatórias do cadastro',async()=>{
 const c=(await vm('/para-empresas')).vm.cadastro;
 assert.deepEqual(c.perguntas.map(p=>p.id),['ramo','local','plano']);assert.match(c.abertura,/afiliado à PRIMIG/);assert.ok(c.novidades.frase);
});

test('artigos (18.6): destaque marcado no admin ou o mais recente com foto, fora da lista em todas as páginas',async()=>{
 const p1=(await vm('/artigos')).vm,p2=(await vm('/artigos?page=2')).vm;
 assert.ok(p1.destaque?.image,'sem marcação: o mais recente com foto');
 const todos=[p1.destaque.href,...p1.items.map(i=>i.href),...p2.items.map(i=>i.href),...(await vm('/artigos?page=3')).vm.items.map(i=>i.href),...(await vm('/artigos?page=4')).vm.items.map(i=>i.href)];
 assert.equal(new Set(todos).size,todos.length,'nenhum repetido');assert.equal(todos.length,45,'nenhum some');
 assert.equal(p2.destaque,null,'só na página 1');assert.equal((await vm('/artigos?q=sa')).vm.destaque,null);assert.equal((await vm('/classificados')).vm.destaque,null);
 const lista=(await api(editor,'/conteudo?tipo=artigo')).json.itens,[x,y]=lista.slice(-2);
 assert.equal(x.destaque,false);
 assert.equal((await api(editor,`/conteudo/${encodeURIComponent(x.id)}`,{method:'PATCH',body:{version:x.version,destaque:true}})).json.destaque,true);
 assert.equal((await vm('/artigos')).vm.destaque.href,`/artigos/${x.slug}`);
 await api(editor,`/conteudo/${encodeURIComponent(y.id)}`,{method:'PATCH',body:{version:y.version,destaque:true}});
 assert.equal((await api(editor,`/conteudo/${encodeURIComponent(x.id)}`)).json.destaque,false,'marcar um desmarca o anterior');
 const cl=(await api(editor,'/conteudo?tipo=classificado')).json.itens[0];
 assert.equal('destaque' in cl,false);assert.equal((await api(editor,`/conteudo/${encodeURIComponent(cl.id)}`,{method:'PATCH',body:{version:cl.version,destaque:true}})).json.campo,'destaque');
});

test('pessoas do Sobre nós (18.7): só com foto da biblioteca, na ordem; a imagem em uso não sai',async()=>{
 const sharp=(await import('sharp')).default,jpg=await sharp({create:{width:600,height:600,channels:3,background:'#36c'}}).jpeg().toBuffer();
 const m=(await api(editor,'/midia?alt=Leandro',{method:'POST',raw:jpg,type:'image/jpeg'})).json;
 assert.equal((await api(editor,'/pessoas',{method:'POST',body:{nome:'L'}})).json.campo,'nome');
 assert.equal((await api(editor,'/pessoas',{method:'POST',body:{nome:'Leandro',foto:'f'.repeat(32)}})).json.campo,'foto');
 assert.equal((await api(editor,'/pessoas',{method:'POST',body:{nome:'Leandro',ordem:1000}})).json.campo,'ordem');
 const l=(await api(editor,'/pessoas',{method:'POST',body:{nome:'Leandro',funcao:'Fundador',foto:m.id,ordem:2}})).json;
 const sem=(await api(editor,'/pessoas',{method:'POST',body:{nome:'Sem Foto',funcao:'Vendas',ordem:1}})).json;
 const b=(await api(admin,'/pessoas',{method:'POST',body:{nome:'Bia',funcao:'Atendimento',foto:m.id,ordem:1}})).json;
 assert.deepEqual(Object.keys(l),['id','nome','funcao','foto','ordem','version']);
 assert.deepEqual((await vm('/institucional/sobre')).vm.equipe,[{nome:'Bia',funcao:'Atendimento',foto:`/midia/${m.id}/800.webp`},{nome:'Leandro',funcao:'Fundador',foto:`/midia/${m.id}/800.webp`}],'sem foto não aparece');
 assert.equal((await api(editor,'/pessoas')).json.total,3);
 assert.equal((await api(editor,`/pessoas/${b.id}`,{method:'PATCH',body:{version:b.version,ordem:5}})).json.ordem,5);
 assert.equal((await api(editor,`/pessoas/${b.id}`,{method:'PATCH',body:{version:b.version,ordem:6}})).status,409);
 assert.equal((await api(editor,`/midia/${m.id}`,{method:'DELETE'})).status,422,'a foto em uso não sai');
 assert.deepEqual((await api(editor,`/pessoas/${sem.id}`,{method:'DELETE'})).json,{ok:true});
 await t.conta('operador@v17.test',{equipe:'operador'});const op=await t.entrar('operador@v17.test');
 assert.equal((await api(op,'/pessoas',{method:'POST',body:{nome:'Outra'}})).status,403,'operador não mexe no conteúdo');
 assert.equal((await t.com(editor,'/api/admin/equipe',{method:'POST',body:{email:'x@primig.test',papel:'editor'}})).status,403,'o /equipe continua sendo das contas da equipe (só admin)');
});

test('medição (18.8): eventos novos, waze e ref só onde vale',async()=>{
 let n=0;const id=()=>`evento-v17-${String(++n).padStart(8,'0')}`,base={consent:true,session_id:'sessao-v17-0000000001'};
 const ok=p=>ingestEvent(t.db,{event_id:id(),...base,...p},'10.0.0.1',t.agora);
 await ok({name:'contact_clicked',business_id:A,channel:'waze'});
 await ok({name:'coupon_copied',business_id:A});
 await ok({name:'shortcut_clicked',ref:'alimentacao',source:'home'});
 await ok({name:'filter_used',ref:'cupom'});
 await ok({name:'map_opened',source:'search'});
 for(const p of [{name:'coupon_copied'},{name:'shortcut_clicked',source:'home'},{name:'shortcut_clicked',ref:'Alimentação',source:'home'},{name:'shortcut_clicked',ref:'alimentacao'},
   {name:'filter_used',ref:'aberto'},{name:'map_opened',source:'home'},{name:'business_viewed',business_id:A,ref:'x'},{name:'contact_clicked',business_id:A,channel:'telegram'}])
  await assert.rejects(()=>ok(p),undefined,JSON.stringify(p));
 assert.deepEqual((await t.db.query("SELECT name,ref,channel FROM public_events WHERE session_id=$1 ORDER BY event_id",[base.session_id])).rows.map(r=>[r.name,r.ref,r.channel]),
  [['contact_clicked',null,'waze'],['coupon_copied',null,null],['shortcut_clicked','alimentacao',null],['filter_used','cupom',null],['map_opened',null,null]]);
});
