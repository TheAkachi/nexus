import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {pageRoute} from '../../api/server.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {responderSolicitacao} from '../../api/data/painel.mjs';
import {ambiente} from './helpers-painel.mjs';

// Fase 3: perfil (na hora e na fila), fotos, catálogo, métricas, solicitações e o resumo das 4 perguntas (contrato 12.4).
let t,dono,leitura;
const A='magnifico-reformas-e-acabamentos';
before(async()=>{t=await ambiente();await t.conta('dono@painel.test',{empresa:A});await t.conta('leitura@painel.test',{empresa:A,papel:'leitura'});dono=await t.entrar('dono@painel.test');leitura=await t.entrar('leitura@painel.test');});
after(async()=>{await t?.fim();});
const api=(path,opts)=>t.com(dono,`/api/painel/empresas/${A}${path}`,opts);
const publico=async()=>{const url=new URL(`/comercio/${A}`,'http://x');return (await pageRoute({db:t.db,path:url.pathname,url,now:t.agora})).vm;};
const versao=async()=>(await api('/perfil')).json.version;

test('horário, contatos e redes publicam na hora, com auditoria antes e depois; o db:seed não sobrescreve depois',async()=>{
 const antes=await publico();assert.equal(antes.openNow,null,'sem horário no acervo');
 const v=await versao();
 const r=await api('',{method:'PATCH',body:{version:v,horario:[1,2,3,4,5].map(dia=>({dia,abre:'08:00',fecha:'18:00'})).concat([{dia:6,abre:'08:00',fecha:'12:00'}]),
  telefone:'(21) 2667-1234',whatsapp:'(21) 99876-5432',email:'Contato@Magnifico.test',site:'magnifico.test/?utm_source=x',redes:[{rede:'Instagram',url:'https://www.instagram.com/magnifico.reformas/?fbclid=1'}]}});
 assert.equal(r.status,200);assert.equal(r.json.version,v+1);assert.deepEqual(r.json.publicado.sort(),['email','horario','redes','site','telefone','whatsapp']);assert.deepEqual(r.json.emAnalise,[]);
 const depois=await publico();
 assert.equal(depois.openNow,true,'segunda às 10h: aberto');assert.equal(depois.closesAt,'18h');assert.equal(depois.week.find(d=>d.day==='sábado').label,'8h às 12h');
 assert.equal(depois.phoneUrl,'tel:2126671234');assert.match(depois.whatsappUrl,/^https:\/\/wa\.me\/5521998765432\?text=/);assert.equal(depois.email,'contato@magnifico.test');
 assert.equal(depois.website,'https://magnifico.test/');assert.deepEqual(depois.socials,[{label:'Instagram',url:'https://www.instagram.com/magnifico.reformas/'}]);
 const a=(await t.db.query("SELECT * FROM audit_log WHERE action='perfil_atualizado' AND business_id=$1 ORDER BY created_at DESC",[A])).rows[0];
 assert.deepEqual(a.before.horario,[]);assert.equal(a.after.horario.length,6);assert.equal(a.after.telefone,'(21) 2667-1234');assert.ok(a.ip);assert.ok(a.actor_id);
 // Versão velha: 409. Reimportar o acervo não desfaz o que o associado publicou.
 const velho=await api('',{method:'PATCH',body:{version:v,telefone:'2100000000'}});assert.equal(velho.status,409);assert.match(velho.json.erro,/Recarregue/);
 await importSnapshot(t.db);
 assert.equal((await publico()).phoneUrl,'tel:2126671234');assert.equal((await t.db.query('SELECT count(*)::int AS n FROM business_hours WHERE business_id=$1',[A])).rows[0].n,6);
});

test('resumo e descrição vão para a fila; o público continua com o texto aprovado',async()=>{
 const resumoPublico=(await publico()).summary;
 let v=await versao();
 const r=await api('',{method:'PATCH',body:{version:v,resumo:'Reformas completas em Nova Iguaçu.',descricao:'Pintura, gesso e acabamento.\n\nOrçamento sem compromisso.'}});
 assert.deepEqual(r.json.publicado,[]);assert.deepEqual(r.json.emAnalise.sort(),['descricao','resumo']);
 assert.equal((await publico()).summary,resumoPublico,'nada muda no ar antes da aprovação');
 const perfil=(await api('/perfil')).json;assert.equal(perfil.resumo,'Reformas completas em Nova Iguaçu.');assert.deepEqual(perfil.emAnalise.sort(),['descricao','resumo']);
 v=perfil.version;await api('',{method:'PATCH',body:{version:v,resumo:'Reformas e acabamentos em Nova Iguaçu.'}});
 const fila=(await t.db.query("SELECT status,payload FROM approvals WHERE business_id=$1 AND kind='descricao' ORDER BY submitted_at,seq",[A])).rows;
 assert.deepEqual(fila.map(f=>f.status),['substituido','pendente']);assert.equal(fila[1].payload.resumo,'Reformas e acabamentos em Nova Iguaçu.');assert.ok(fila[1].payload.descricao,'o pedido novo mantém a descrição pendente');
 const resumo=(await api('')).json;assert.ok(resumo.primig.emAnalise.some(e=>e.tipo==='descricao'));
});

test('validação por campo: horário, WhatsApp, e-mail, redes e campo desconhecido',async()=>{
 const v=await versao();
 for(const [body,campo] of [[{horario:[{dia:7,abre:'08:00',fecha:'18:00'}]},'horario'],[{horario:[{dia:1,abre:'8h',fecha:'18:00'}]},'horario'],[{whatsapp:'2126671234'},'whatsapp'],
  [{email:'sem-arroba'},'email'],[{redes:[{rede:'Orkut',url:'https://orkut.test'}]},'redes'],[{redes:[{rede:'Instagram',url:'javascript:alert(1)'}]},'redes'],[{slug:'outra-empresa'},'slug'],[{nome:'X'},'nome'],[{cep:'2600'},'cep'],[{categorias:['Pastelaria do Zé']},'categorias'],[{imagem:'/midia/'+'a'.repeat(32)+'/800.webp'},'imagem'],[{site:'ftp://x'},'site']]) {
  const r=await api('',{method:'PATCH',body:{version:v,...body}});assert.equal(r.status,422,JSON.stringify(body));assert.equal(r.json.campo,campo,JSON.stringify(body));
 }
 assert.equal((await api('',{method:'PATCH',body:{telefone:'2126671234'}})).json.campo,'version');
});

test('fotos: tipo real, sem EXIF nem GPS, WebP em 3 tamanhos, pendente até a aprovação',async()=>{
 // JPEG 2000×1500 com GPS no EXIF e orientação 6 (deitada): no ar, vira 1500×2000.
 const jpeg=await sharp({create:{width:2000,height:1500,channels:3,background:'#3366cc'}}).jpeg().withExif({IFD0:{Make:'Camera de teste'},IFD3:{GPSLatitudeRef:'S',GPSLatitude:'22/1 45/1 0/1'}}).withMetadata({orientation:6}).toBuffer();
 assert.ok((await sharp(jpeg).metadata()).exif,'a foto de entrada tem EXIF');
 const r=await api('/fotos?alt=Fachada%20da%20loja',{method:'POST',raw:jpeg,type:'image/jpeg'});
 assert.equal(r.status,201);assert.equal(r.json.status,'pendente');assert.deepEqual([r.json.largura,r.json.altura],[800,1067]);assert.equal(r.json.alt,'Fachada da loja');
 assert.match(r.json.url,/^\/midia\/[a-f0-9]{32}\/800\.webp$/);const id=r.json.id;
 assert.deepEqual((await readdir(join(t.dir,id))).sort(),['1600.webp','320.webp','800.webp']);
 const grande=await sharp(await readFile(join(t.dir,id,'1600.webp'))).metadata();
 assert.deepEqual([grande.format,grande.width,grande.height,grande.exif,grande.orientation],['webp',1500,2000,undefined,undefined],'sem EXIF, já na orientação certa, sem ampliar');
 // Pendente: só quem cuida da empresa vê; o público não.
 assert.equal((await t.req(`/midia/${id}/320.webp`)).status,404);
 const visto=await t.com(leitura,`/midia/${id}/320.webp`);assert.equal(visto.status,200);assert.equal(visto.headers.get('cache-control'),'private, no-store');
 assert.ok(!(await publico()).photos.some(p=>p.src.includes(id)));
 assert.equal((await t.db.query("SELECT kind,status FROM approvals WHERE resource_id=$1",[id])).rows[0].status,'pendente');
 await t.db.query("UPDATE media SET status='aprovada' WHERE id=$1",[id]);// a aprovação é da Fase 4
 const aberta=await t.req(`/midia/${id}/800.webp`);assert.equal(aberta.status,200);assert.equal(aberta.headers.get('content-type'),'image/webp');assert.match(aberta.headers.get('cache-control'),/immutable/);
 assert.deepEqual((await publico()).photos.at(-1),{href:`/midia/${id}/1600.webp`,src:`/midia/${id}/800.webp`});
 // Tipo real: PNG declarado como JPEG, texto e arquivo grande são recusados.
 const png=await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer();
 assert.equal((await api('/fotos',{method:'POST',raw:png,type:'image/jpeg'})).status,415);
 assert.equal((await api('/fotos',{method:'POST',raw:Buffer.from('<script>alert(1)</script>'),type:'image/png'})).status,415);
 assert.equal((await api('/fotos',{method:'POST',raw:Buffer.alloc(8*1024*1024+1,0xff),type:'image/jpeg'})).status,413);
 assert.equal((await t.com(leitura,`/api/painel/empresas/${A}/fotos`,{method:'POST',raw:jpeg,type:'image/jpeg'})).status,403);
 // Tirar: a enviada some do disco; a do portal sai do perfil na hora.
 assert.equal((await api(`/fotos/${id}`,{method:'DELETE'})).status,200);await assert.rejects(readdir(join(t.dir,id)));
 assert.equal((await t.req(`/midia/${id}/800.webp`)).status,404);
 const fotosPortal=(await publico()).photos.length;
 if(fotosPortal){assert.equal((await api('/fotos/portal-0',{method:'DELETE'})).status,200);assert.equal((await publico()).photos.length,fotosPortal-1);}
});

test('catálogo: item novo vai para a fila; rascunho, validação, publicado e pausado por versão',async()=>{
 const oferta={tipo:'oferta',nome:'Pintura de sala',descricao:'Mão de obra',precoModo:'a-partir',precoCentavos:45000};
 assert.equal((await api('/catalogo',{method:'POST',body:oferta})).json.campo,'condicoes');
 assert.equal((await api('/catalogo',{method:'POST',body:{...oferta,condicoes:'Até 20 m²',validade:'2026-10-01'}})).json.campo,'validade','validade no passado');
 const novo=await api('/catalogo',{method:'POST',body:{...oferta,condicoes:'Até 20 m², tinta por conta do cliente',validade:'2026-12-31'}});
 assert.equal(novo.status,201);assert.equal(novo.json.status,'validacao');
 const fila=(await t.db.query("SELECT kind,status,payload FROM approvals WHERE resource_id=$1",[novo.json.id])).rows;
 assert.deepEqual(fila.map(f=>[f.kind,f.status]),[['oferta','pendente']]);assert.equal(fila[0].payload.nome,'Pintura de sala');
 const rascunho=(await api('/catalogo',{method:'POST',body:{tipo:'servico',nome:'Gesso',precoModo:'consulta',enviar:false}})).json;
 assert.equal(rascunho.status,'rascunho');assert.equal((await t.db.query('SELECT count(*)::int AS n FROM approvals WHERE resource_id=$1',[rascunho.id])).rows[0].n,0);
 assert.ok((await api('')).json.depende.some(d=>d.tipo==='rascunho'));
 const enviado=(await api(`/catalogo/${rascunho.id}/enviar`,{method:'POST',body:{version:rascunho.version}})).json;assert.equal(enviado.status,'validacao');
 assert.equal((await api(`/catalogo/${rascunho.id}/enviar`,{method:'POST',body:{version:rascunho.version}})).status,409);
 // A equipe aprova (Fase 4): publicado, com a versão aprovada.
 await t.db.query("UPDATE catalog_items SET status='published',approved_version=version WHERE id=$1",[enviado.id]);
 assert.ok((await publico()).catalog.some(c=>c.name==='Gesso'),'publicado aparece no perfil');
 const pausado=(await api(`/catalogo/${enviado.id}/pausar`,{method:'POST',body:{version:enviado.version}})).json;assert.equal(pausado.status,'pausado');
 assert.ok(!(await publico()).catalog.some(c=>c.name==='Gesso'));
 const reativado=(await api(`/catalogo/${enviado.id}/reativar`,{method:'POST',body:{version:pausado.version}})).json;assert.equal(reativado.status,'publicado','sem mudança, volta sem nova análise');
 const editado=(await api(`/catalogo/${enviado.id}`,{method:'PATCH',body:{version:reativado.version,nome:'Gesso e drywall'}})).json;assert.equal(editado.status,'validacao','mudou: volta para a fila');
 assert.equal((await api(`/catalogo/${enviado.id}/pausar`,{method:'POST',body:{version:editado.version}})).json.campo,'status');
 const lista=(await t.com(leitura,`/api/painel/empresas/${A}/catalogo`)).json.itens;assert.ok(lista.length>=2);
 assert.deepEqual(Object.keys(lista[0]).sort(),['condicoes','descricao','id','nome','precoCentavos','precoModo','recusa','status','tipo','validade','version']);
});

test('métricas de 7, 30 e 90 dias batem com os eventos; buscas contadas no servidor sem robôs',async()=>{
 const ev=async(name,extra,n,dias=0)=>{const salvo=t.agora;t.agora=new Date(salvo.getTime()-dias*86400000);
  for(let i=0;i<n;i++)assert.equal((await t.req('/api/events',{method:'POST',body:{event_id:`ev-${name}-${extra.channel||'v'}-${dias}-${i}-${Math.random().toString(36).slice(2,10)}`,name,session_id:'sessao-metricas-0001',business_id:A,consent:true,...extra}})).status,200);
  t.agora=salvo;};
 await ev('business_viewed',{source:'search'},3);await ev('business_viewed',{},2,10);await ev('business_viewed',{},4,45);
 await ev('contact_clicked',{channel:'whatsapp'},2);await ev('contact_clicked',{channel:'map'},1,3);await ev('contact_clicked',{channel:'phone'},1,20);await ev('contact_clicked',{channel:'website'},1,60);
 await t.req('/api/events',{method:'POST',body:{event_id:'ev-sem-consentimento-0001',name:'business_viewed',session_id:'sessao-metricas-0001',business_id:A,consent:false}});
 // Aparições na busca: duas páginas de resultado com a empresa e uma vinda de robô.
 await t.req('/busca?q=Magnifico');await t.req('/busca?q=reformas');
 await fetch(`${t.base}/busca?q=Magnifico`,{headers:{'User-Agent':'Googlebot/2.1'}});
 const m30=(await api('/metricas?periodo=30d')).json;
 assert.deepEqual([m30.visitas,m30.cliques,m30.buscas],[5,{whatsapp:2,telefone:1,rota:1,site:0},2]);
 assert.equal(m30.serie.length,30);assert.equal(m30.serie.at(-1).dia,'2026-10-05');assert.equal(m30.serie[0].dia,'2026-09-06');
 assert.equal(m30.serie.reduce((s,d)=>s+d.visitas,0),m30.visitas);assert.equal(m30.serie.find(d=>d.dia==='2026-10-02').cliques,1);
 // Conferência direta com a tabela de eventos (o "Pronto quando" da Fase 3).
 const banco=(await t.db.query("SELECT count(*) FILTER (WHERE name='business_viewed')::int AS v,count(*) FILTER (WHERE name='contact_clicked')::int AS c FROM public_events WHERE business_id=$1 AND occurred_at>=$2",[A,'2026-09-06T00:00:00-03:00'])).rows[0];
 assert.deepEqual([m30.visitas,Object.values(m30.cliques).reduce((s,n)=>s+n,0)],[banco.v,banco.c]);
 const m7=(await api('/metricas?periodo=7d')).json;assert.deepEqual([m7.visitas,m7.cliques.rota,m7.cliques.telefone],[3,1,0]);
 const m90=(await api('/metricas?periodo=90d')).json;assert.deepEqual([m90.visitas,m90.cliques.site],[9,1]);
 assert.equal((await api('/metricas?periodo=1ano')).json.campo,'periodo');assert.match(m30.nota,/aceitaram a medição/);
 const resumo=(await api('')).json;assert.deepEqual([resumo.aparece.visitas30,resumo.aparece.buscas30],[5,2]);
});

test('solicitações: suporte e "Solicitar criação à PRIMIG" com briefing; conversa e status',async()=>{
 assert.equal((await api('/solicitacoes',{method:'POST',body:{tipo:'criacao',assunto:'Banner',texto:'Quero um banner'}})).json.campo,'objetivo');
 const criacao=await api('/solicitacoes',{method:'POST',body:{tipo:'criacao',assunto:'Banner para a busca',texto:'Quero divulgar a pintura.',briefing:{objetivo:'Mais pedidos de orçamento',formato:'Super Banner',prazo:'novembro'}}});
 assert.equal(criacao.status,201);assert.deepEqual(criacao.json.briefing,{objetivo:'Mais pedidos de orçamento',formato:'Super Banner',prazo:'novembro',referencias:''});
 assert.equal(criacao.json.status,'aberta');assert.equal(criacao.json.mensagens.length,1);assert.equal(criacao.json.mensagens[0].autor.lado,'associado');
 assert.equal((await api('/solicitacoes',{method:'POST',body:{tipo:'suporte',assunto:'Horário',texto:'Ajuda',briefing:{objetivo:'x'}}})).json.campo,'briefing');
 const id=criacao.json.id,equipe=(await t.db.query("SELECT id FROM users WHERE email='dono@painel.test'")).rows[0].id;
 await responderSolicitacao(t.db,{id:A,sol:id,p:{texto:'Recebemos! Mandamos a arte até sexta.'},session:{user_id:equipe},ip:'',lado:'equipe',now:t.agora});
 const resumo=(await api('')).json;assert.ok(resumo.depende.some(d=>d.tipo==='responder'));assert.ok(resumo.primig.solicitacoes.some(s=>s.id===id&&s.status==='respondida'));
 const msg=await api(`/solicitacoes/${id}/mensagens`,{method:'POST',body:{texto:'Obrigado, aguardo.'}});assert.equal(msg.status,201);assert.equal(msg.json.texto,'Obrigado, aguardo.');
 const conversa=(await t.com(leitura,`/api/painel/empresas/${A}/solicitacoes/${id}`)).json;assert.equal(conversa.status,'aberta');assert.deepEqual(conversa.mensagens.map(m=>m.autor.lado),['associado','equipe','associado']);
 assert.equal(conversa.mensagens[1].autor.nome,'Equipe PRIMIG');
 assert.equal((await api(`/solicitacoes/${id}/fechar`,{method:'POST'})).json.status,'fechada');
 assert.ok((await api('/solicitacoes')).json.solicitacoes.every(s=>!('mensagens' in s)));
});

test('resumo: as 4 perguntas do PDF1',async()=>{
 const r=(await api('')).json;
 assert.deepEqual(Object.keys(r),['aparece','depende','primig','contratado']);
 assert.equal(r.aparece.status,'publicado');assert.equal(r.aparece.url,`/comercio/${A}`);
 assert.deepEqual(r.aparece.completo.map(c=>c.item),['foto','horario','whatsapp','descricao','endereco','redes']);
 assert.equal(r.aparece.completo.find(c=>c.item==='horario').ok,true);
 assert.deepEqual(r.contratado,{plano:null,banners:[],assinatura:null});
 assert.ok(r.primig.emAnalise.some(e=>e.tipo==='oferta'));
});

test('pedidos do front: período na página de resultados e blob: no img-src da CSP',async()=>{
 const {loadPainel}=await import('../../api/data/contas.mjs');
 const sessao=(await t.db.query('SELECT s.id,s.user_id,s.csrf,s.token_hash,u.email,u.name,u.staff_role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[dono.csrf])).rows[0];
 const pagina=async q=>(await loadPainel({db:t.db,session:sessao,path:`/painel/${A}/resultados`,url:new URL(`http://x/painel/${A}/resultados${q}`),now:t.agora})).vm.dados.periodo;
 assert.deepEqual([await pagina('?periodo=7d'),await pagina('?periodo=90d'),await pagina(''),await pagina('?periodo=1ano')],['7d','90d','30d','30d']);
 const csp=(await t.req('/')).headers.get('content-security-policy');
 assert.match(csp,/img-src 'self' blob: https:\/\/www\.primigdivulgacao\.com\.br https:\/\/primigdivulgacao\.com\.br;/);assert.match(csp,/script-src 'self';/,'scripts continuam só do próprio site');
});
