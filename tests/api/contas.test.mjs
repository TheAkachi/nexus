import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../api/server.mjs';
import {hashPassword,verifyPassword,sameSecret,ensureUser,issueToken} from '../../api/auth.mjs';
import {loadPainel,loadDefinirSenha} from '../../api/data/contas.mjs';
import {ambiente,origin,SENHA} from './helpers-painel.mjs';

// Fase 3: login, sessão, CSRF, limites, links de uso único, papéis e auditoria (contrato 12.1 e 12.2).
let t;
before(async()=>{t=await ambiente();});
after(async()=>{await t?.fim();});
const A='boreal-tintas',B='funeraria-sao-salvador';
const minutos=n=>{t.agora=new Date(t.agora.getTime()+n*60000);};
const auditoria=async(action,resource)=>(await t.db.query('SELECT * FROM audit_log WHERE action=$1 AND ($2::text IS NULL OR resource_id=$2) ORDER BY created_at DESC',[action,resource??null])).rows;

test('senha: scrypt com os parâmetros no hash; formato antigo ainda entra e é refeito no login',async()=>{
 const h=await hashPassword(SENHA);assert.match(h,/^scrypt\$32768\$8\$1\$[\w-]{22}\$[\w-]{86}$/);
 assert.equal((await verifyPassword(SENHA,h)).ok,true);assert.equal((await verifyPassword('outra-senha-123',h)).ok,false);
 await assert.rejects(hashPassword('curta'),e=>e.status===422&&e.campo==='senha');
 // Formato do protótipo de 11122e6 (sal hex:chave hex).
 const {scryptSync,randomBytes}=await import('node:crypto');const salt=randomBytes(16).toString('hex');
 const antigo=`${salt}:${scryptSync(SENHA,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}`;
 const id=await t.conta('antigo@exemplo.test');await t.db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[antigo,id]);
 assert.deepEqual(await verifyPassword(SENHA,antigo),{ok:true,rehash:true});
 await t.entrar('antigo@exemplo.test');
 assert.match((await t.db.query('SELECT password_hash FROM users WHERE id=$1',[id])).rows[0].password_hash,/^scrypt\$/);
 assert.equal(sameSecret('abc','abc'),true);assert.equal(sameSecret('abc','abd'),false);assert.equal(sameSecret('abc','abcd'),false);assert.equal(sameSecret('',''),false);
});

test('login: cookie HttpOnly e SameSite, csrf, /api/me; falha genérica e auditada com o IP',async()=>{
 await t.conta('dono@a.test',{empresa:A});
 const s=await t.entrar('dono@a.test',SENHA,{ip:'10.1.1.1'});
 assert.match(s.setCookie,/^primig_sessao=[a-f0-9]{64}; HttpOnly; SameSite=Lax; Path=\/; Max-Age=43200$/);
 const me=await t.com(s,'/api/me');assert.equal(me.status,200);
 assert.deepEqual(me.json.empresas,[{id:A,slug:A,name:'Boreal Tintas',papel:'dono'}]);assert.equal(me.json.csrf,s.csrf);assert.equal(me.json.equipe,null);
 const errada=await t.req('/api/auth/login',{method:'POST',body:{email:'dono@a.test',senha:'senha-errada-999'},ip:'10.1.1.2'});
 const inexistente=await t.req('/api/auth/login',{method:'POST',body:{email:'ninguem@a.test',senha:'senha-errada-999'},ip:'10.1.1.2'});
 assert.equal(errada.status,401);assert.deepEqual(errada.json,inexistente.json,'mesma resposta: não revela a conta');
 assert.equal((await auditoria('login_falha','ninguem@a.test'))[0].ip,'10.1.1.2');assert.equal((await auditoria('login',me.json.usuario.id))[0].ip,'10.1.1.1');
 assert.equal((await t.req('/api/auth/login',{method:'POST',body:{email:'dono@a.test',senha:SENHA},originValue:'https://outro.site'})).status,403,'origem externa');
 assert.equal((await t.req('/api/auth/login',{method:'POST',body:{email:'dono@a.test',senha:SENHA,extra:1}})).json.campo,'extra');
 // Com origem https, o cookie é Secure.
 const https=await createApp({db:t.db,origin:'https://guia.example',clock:()=>t.agora,mediaDir:t.dir,mailer:null});await new Promise(r=>https.listen(0,'127.0.0.1',r));
 try{const r=await fetch(`http://127.0.0.1:${https.address().port}/api/auth/login`,{method:'POST',headers:{Origin:'https://guia.example','Content-Type':'application/json'},body:JSON.stringify({email:'dono@a.test',senha:SENHA})});
  assert.match(r.headers.get('set-cookie'),/; Secure$/);}finally{await new Promise(r=>https.close(r));}
});

test('limite de tentativas: 5 falhas por conta (mesmo de IPs diferentes) e 20 por IP real em 15 min',async()=>{
 await t.conta('alvo@a.test',{empresa:A});
 for(let i=0;i<5;i++)assert.equal((await t.req('/api/auth/login',{method:'POST',body:{email:'alvo@a.test',senha:`errada-${i}-123456`}})).status,401);
 const bloqueada=await t.req('/api/auth/login',{method:'POST',body:{email:'alvo@a.test',senha:SENHA}});
 assert.equal(bloqueada.status,429,'a senha certa também espera');assert.ok((await auditoria('login_bloqueado','alvo@a.test')).length);
 minutos(16);await t.entrar('alvo@a.test');
 for(let i=0;i<20;i++)await t.req('/api/auth/login',{method:'POST',body:{email:`x${i}@a.test`,senha:'qualquer-coisa-123'},ip:'10.2.2.2'});
 assert.equal((await t.req('/api/auth/login',{method:'POST',body:{email:'alvo@a.test',senha:SENHA},ip:'10.2.2.2'})).status,429,'IP no limite');
 assert.equal((await t.req('/api/auth/login',{method:'POST',body:{email:'alvo@a.test',senha:SENHA},ip:'10.2.2.3'})).status,200,'outro IP entra');
 minutos(16);
});

test('CSRF em toda escrita autenticada, comparado em tempo constante; origem conferida',async()=>{
 await t.conta('csrf@a.test',{empresa:A});const s=await t.entrar('csrf@a.test'),outra=await t.entrar('csrf@a.test');
 const perfil=(await t.com(s,`/api/painel/empresas/${A}/perfil`)).json;
 const patch=(csrf,originValue=origin)=>t.req(`/api/painel/empresas/${A}`,{method:'PATCH',cookie:s.cookie,csrf,originValue,body:{version:perfil.version,telefone:'(21) 2667-0000'}});
 assert.equal((await patch(undefined)).status,403);assert.equal((await patch('0'.repeat(64))).status,403);
 assert.equal((await patch(outra.csrf)).status,403,'csrf de outra sessão');
 assert.equal((await patch(s.csrf,'https://outro.site')).status,403,'origem externa');
 assert.equal((await patch(s.csrf)).status,200);
 assert.equal((await t.com(s,'/api/auth/logout',{method:'POST',csrf:undefined})).status,403,'logout também exige csrf');
});

test('sessão expira com 60 min sem uso e 12 h depois do login; logout encerra no servidor',async()=>{
 await t.conta('sessao@a.test',{empresa:A});
 let s=await t.entrar('sessao@a.test');
 for(let i=0;i<5;i++){minutos(50);assert.equal((await t.com(s,'/api/me')).status,200,`uso a cada 50 min (${i})`);}
 minutos(61);const r=await t.com(s,'/api/me');assert.equal(r.status,401);assert.equal(r.json.erro,'Sua sessão terminou. Entre de novo.');
 s=await t.entrar('sessao@a.test');
 for(let i=0;i<14;i++){minutos(55);if(i<13)assert.equal((await t.com(s,'/api/me')).status,200);}
 assert.equal((await t.com(s,'/api/me')).status,401,'passou de 12 h, mesmo em uso');
 s=await t.entrar('sessao@a.test');
 const out=await t.com(s,'/api/auth/logout',{method:'POST'});assert.equal(out.status,200);assert.match(out.headers.get('set-cookie'),/primig_sessao=; .*Max-Age=0/);
 assert.equal((await t.com(s,'/api/me')).status,401,'o cookie antigo não vale mais');assert.ok((await auditoria('logout')).length);
});

test('empresa A não lê nem altera nada da empresa B (APIs e página)',async()=>{
 await t.conta('a@isolamento.test',{empresa:A});await t.conta('b@isolamento.test',{empresa:B});
 const a=await t.entrar('a@isolamento.test'),b=await t.entrar('b@isolamento.test');
 const itemB=(await t.com(b,`/api/painel/empresas/${B}/catalogo`,{method:'POST',body:{tipo:'servico',nome:'Plano funeral',precoModo:'consulta',enviar:false}})).json;
 const solB=(await t.com(b,`/api/painel/empresas/${B}/solicitacoes`,{method:'POST',body:{tipo:'suporte',assunto:'Dúvida',texto:'Como mudo o horário?'}})).json;
 const vB=(await t.com(b,`/api/painel/empresas/${B}/perfil`)).json.version,telB=(await t.db.query('SELECT phone FROM businesses WHERE id=$1',[B])).rows[0].phone;
 for(const [path,method,body] of [[`/api/painel/empresas/${B}`,'GET'],[`/api/painel/empresas/${B}/perfil`,'GET'],[`/api/painel/empresas/${B}`,'PATCH',{version:vB,telefone:'2100000000'}],
  [`/api/painel/empresas/${B}/catalogo`,'GET'],[`/api/painel/empresas/${B}/catalogo`,'POST',{tipo:'produto',nome:'Invasão',precoModo:'consulta'}],[`/api/painel/empresas/${B}/catalogo/${itemB.id}`,'PATCH',{version:1,nome:'x'}],
  [`/api/painel/empresas/${B}/metricas?periodo=30d`,'GET'],[`/api/painel/empresas/${B}/solicitacoes`,'GET'],[`/api/painel/empresas/${B}/solicitacoes/${solB.id}`,'GET'],
  [`/api/painel/empresas/${B}/acessos`,'GET'],[`/api/painel/empresas/${B}/fotos/portal-0`,'DELETE']]) {
  const r=await t.com(a,path,{method,body});assert.equal(r.status,404,`${method} ${path}`);assert.equal(r.json.erro,'Empresa não encontrada.');
 }
 // Pelo caminho da própria empresa, o item e a solicitação da B também não aparecem.
 assert.equal((await t.com(a,`/api/painel/empresas/${A}/catalogo/${itemB.id}`,{method:'PATCH',body:{version:1,nome:'x'}})).status,404);
 assert.equal((await t.com(a,`/api/painel/empresas/${A}/solicitacoes/${solB.id}`)).status,404);
 assert.equal((await t.com(a,`/painel/${B}`)).status,404);assert.equal((await t.db.query('SELECT phone FROM businesses WHERE id=$1',[B])).rows[0].phone,telB,'o telefone da B não mudou');
 assert.equal((await t.db.query("SELECT count(*)::int AS n FROM catalog_items WHERE business_id=$1 AND name='Invasão'",[B])).rows[0].n,0);
 const me=(await t.com(a,'/api/me')).json;assert.deepEqual(me.empresas.map(e=>e.id),[A]);
});

test('papel de leitura vê e não altera; ninguém se promove; a empresa nunca fica sem dono',async()=>{
 const donoId=await t.conta('dono@papeis.test',{empresa:B}),leituraId=await t.conta('leitura@papeis.test',{empresa:B,papel:'leitura'});
 const fin=await t.conta('fin@papeis.test',{empresa:B,papel:'financeiro'});
 const dono=await t.entrar('dono@papeis.test'),leitura=await t.entrar('leitura@papeis.test'),financeiro=await t.entrar('fin@papeis.test');
 for(const path of ['','/perfil','/catalogo','/metricas?periodo=7d','/solicitacoes'])assert.equal((await t.com(leitura,`/api/painel/empresas/${B}${path}`)).status,200,path);
 const v=(await t.com(leitura,`/api/painel/empresas/${B}/perfil`)).json.version;
 assert.equal((await t.com(leitura,`/api/painel/empresas/${B}`,{method:'PATCH',body:{version:v,telefone:'2100000000'}})).status,403);
 assert.equal((await t.com(leitura,`/api/painel/empresas/${B}/catalogo`,{method:'POST',body:{tipo:'produto',nome:'Item',precoModo:'consulta'}})).status,403);
 assert.equal((await t.com(leitura,`/api/painel/empresas/${B}/solicitacoes`,{method:'POST',body:{tipo:'suporte',assunto:'Oi',texto:'Teste'}})).status,403);
 assert.equal((await t.com(leitura,`/api/painel/empresas/${B}/acessos`)).status,403);
 assert.equal((await t.com(leitura,`/api/painel/empresas/${B}/acessos/${leituraId}`,{method:'PATCH',body:{papel:'dono'}})).status,403,'leitura não se promove');
 assert.equal((await t.db.query('SELECT role FROM memberships WHERE user_id=$1',[leituraId])).rows[0].role,'leitura');
 assert.equal((await t.com(financeiro,`/api/painel/empresas/${B}`)).json.contratado.plano,null,'financeiro vê o que foi contratado');
 assert.equal((await t.com(leitura,`/api/painel/empresas/${B}`)).json.contratado,null,'leitura não vê');
 assert.equal((await t.com(dono,`/api/painel/empresas/${B}/acessos/${donoId}`,{method:'PATCH',body:{papel:'editor'}})).status,403,'ninguém muda o próprio papel');
 assert.equal((await t.com(dono,`/api/painel/empresas/${B}/acessos/${donoId}`,{method:'DELETE'})).status,403);
 const promovido=await t.com(dono,`/api/painel/empresas/${B}/acessos/${fin}`,{method:'PATCH',body:{papel:'dono'}});assert.equal(promovido.status,200);
 const outroDono=await t.entrar('fin@papeis.test');
 assert.equal((await t.com(outroDono,`/api/painel/empresas/${B}/acessos/${donoId}`,{method:'PATCH',body:{papel:'editor'}})).status,200,'com dois donos, um pode deixar de ser');
 assert.equal((await t.com(outroDono,`/api/painel/empresas/${B}/acessos/${donoId}`,{method:'PATCH',body:{papel:'dono'}})).status,200);
 const papel=(await auditoria('papel_alterado',donoId))[0];assert.deepEqual([papel.before,papel.after],[{papel:'editor'},{papel:'dono'}]);
 // Página: o módulo de acessos exige o papel de dono.
 const pagina=async(s,path)=>loadPainel({db:t.db,session:(await t.db.query('SELECT s.id,s.user_id,s.csrf,s.token_hash,u.email,u.name,u.staff_role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.csrf=$1',[s.csrf])).rows[0],path,now:t.agora});
 assert.equal((await pagina(leitura,`/painel/${B}/acessos`)).status,403);
 const vm=(await pagina(dono,`/painel/${B}/acessos`)).vm;assert.equal(vm.modulo,'acessos');assert.equal(vm.csrf,dono.csrf);assert.ok(vm.dados.membros.length>=3);
 assert.deepEqual(vm.pode,{perfil:true,catalogo:true,cupons:true,plano:true,solicitar:true,acessos:true});
 assert.deepEqual((await pagina(leitura,`/painel/${B}`)).vm.pode,{perfil:false,catalogo:false,cupons:false,plano:false,solicitar:false,acessos:false});
 assert.deepEqual(await pagina(leitura,'/painel'),{redirect:`/painel/${B}`},'uma empresa: vai direto para ela');
});

test('convite: link de uso único por 7 dias; e-mail quando há provedor, link na resposta quando não há',async()=>{
 await t.conta('dono@convite.test',{empresa:A});const dono=await t.entrar('dono@convite.test');
 t.enviados.length=0;
 const r=await t.com(dono,`/api/painel/empresas/${A}/acessos`,{method:'POST',body:{email:'Novo.Editor@Convite.test',papel:'editor'}});
 assert.equal(r.status,201);assert.deepEqual([r.json.email,r.json.papel,r.json.link,r.json.enviado,r.json.ativo],['novo.editor@convite.test','editor','',true,false]);
 const link=/\/entrar\/definir-senha\?token=([a-f0-9]{64})/.exec(t.enviados[0].text);assert.ok(link,'o e-mail leva o link');assert.equal(t.enviados[0].to,'novo.editor@convite.test');
 const pagina=await loadDefinirSenha(t.db,new URL(`${origin}/entrar/definir-senha?token=${link[1]}`),t.agora);
 assert.deepEqual(pagina.vm,{token:link[1],tipo:'convite',valido:true,email:'novo.editor@convite.test',empresa:'Boreal Tintas',convidadoPor:'dono'});
 assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:link[1],senha:'curta'}})).json.campo,'senha');
 assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:link[1],senha:'senha-do-editor-123'}})).status,200);
 const editor=await t.entrar('novo.editor@convite.test','senha-do-editor-123');
 assert.deepEqual((await t.com(editor,'/api/me')).json.empresas.map(e=>[e.id,e.papel]),[[A,'editor']]);
 const reuso=await t.req('/api/auth/senha',{method:'POST',body:{token:link[1],senha:'outra-senha-123456'}});assert.equal(reuso.status,422);assert.equal(reuso.json.campo,'token');
 assert.equal((await t.com(dono,`/api/painel/empresas/${A}/acessos`,{method:'POST',body:{email:'novo.editor@convite.test',papel:'leitura'}})).json.campo,'email','já tem acesso');
 // Sem provedor: o link volta na resposta para ir pelo WhatsApp; vencido depois de 7 dias.
 t.mailerAtivo=false;
 const semEmail=(await t.com(dono,`/api/painel/empresas/${A}/acessos`,{method:'POST',body:{email:'whatsapp@convite.test',papel:'leitura'}})).json;
 assert.equal(semEmail.enviado,false);assert.match(semEmail.link,/^http:\/\/127\.0\.0\.1:4180\/entrar\/definir-senha\?token=[a-f0-9]{64}$/);
 t.mailerAtivo=true;
 const lista=(await t.com(dono,`/api/painel/empresas/${A}/acessos`)).json;assert.ok(lista.convites.some(c=>c.email==='whatsapp@convite.test'&&c.papel==='leitura'));
 minutos(7*24*60+1);
 const vencido=await t.req('/api/auth/senha',{method:'POST',body:{token:semEmail.link.split('=')[1],senha:'senha-qualquer-123'}});assert.equal(vencido.status,422);
 const resumo=(await t.com(await t.entrar('dono@convite.test'),`/api/painel/empresas/${A}`)).json;
 assert.ok(resumo.depende.some(d=>d.tipo==='convite'&&d.texto.includes('whatsapp@convite.test')),'o convite vencido aparece no que depende do dono');
 // Conta que já tem senha recebe o acesso na hora.
 const ja=(await t.com(await t.entrar('dono@convite.test'),`/api/painel/empresas/${A}/acessos`,{method:'POST',body:{email:'novo.editor@convite.test',papel:'leitura'}}));
 assert.equal(ja.status,422,'continua com acesso: não duplica');
});

test('recuperação: resposta igual exista a conta ou não; link de 1 hora, uso único, encerra as sessões',async()=>{
 await t.conta('esqueci@a.test',{empresa:A});const antiga=await t.entrar('esqueci@a.test');
 t.enviados.length=0;
 const sim=await t.req('/api/auth/reset',{method:'POST',body:{email:'esqueci@a.test'}}),nao=await t.req('/api/auth/reset',{method:'POST',body:{email:'nao-existe@a.test'}});
 assert.deepEqual([sim.status,sim.json],[nao.status,nao.json]);assert.equal(t.enviados.length,1);
 const primeiro=/token=([a-f0-9]{64})/.exec(t.enviados[0].text)[1];
 await t.req('/api/auth/reset',{method:'POST',body:{email:'esqueci@a.test'}});const segundo=/token=([a-f0-9]{64})/.exec(t.enviados[1].text)[1];
 assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:primeiro,senha:'nova-senha-1234'}})).status,422,'o link novo invalida o anterior');
 assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:segundo,senha:'nova-senha-1234'}})).status,200);
 assert.equal((await t.com(antiga,'/api/me')).status,401,'sessões antigas encerradas');
 await t.entrar('esqueci@a.test','nova-senha-1234');
 assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:segundo,senha:'mais-uma-senha-123'}})).status,422,'uso único');
 await t.req('/api/auth/reset',{method:'POST',body:{email:'esqueci@a.test'}});const terceiro=/token=([a-f0-9]{64})/.exec(t.enviados.at(-1).text)[1];
 minutos(61);assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:terceiro,senha:'mais-uma-senha-123'}})).status,422,'vale 1 hora');
 for(let i=0;i<5;i++)await t.req('/api/auth/reset',{method:'POST',body:{email:'esqueci@a.test'},ip:'10.3.3.3'});
 assert.equal((await t.req('/api/auth/reset',{method:'POST',body:{email:'esqueci@a.test'},ip:'10.3.3.3'})).status,429);
 assert.ok((await auditoria('senha_definida')).some(a=>a.after.via==='recuperacao'));
});

test('revogar acesso encerra as sessões da pessoa; sessões próprias podem ser listadas e encerradas',async()=>{
 await t.conta('dono@revoga.test',{empresa:A});const editorId=await t.conta('editor@revoga.test',{empresa:A,papel:'editor'});
 const dono=await t.entrar('dono@revoga.test'),editor=await t.entrar('editor@revoga.test');
 assert.equal((await t.com(editor,`/api/painel/empresas/${A}`)).status,200);
 assert.equal((await t.com(dono,`/api/painel/empresas/${A}/acessos/${editorId}`,{method:'DELETE'})).status,200);
 assert.equal((await t.com(editor,'/api/me')).status,401,'sessão do editor encerrada');
 const denovo=await t.entrar('editor@revoga.test');assert.equal((await t.com(denovo,`/api/painel/empresas/${A}`)).status,404,'sem vínculo, a empresa some');
 const outra=await t.entrar('dono@revoga.test');
 const sessoes=(await t.com(dono,'/api/me/sessoes')).json;assert.equal(sessoes.length,2);assert.equal(sessoes.filter(s=>s.atual).length,1);
 assert.equal((await t.com(dono,'/api/me/sessoes',{method:'DELETE'})).status,200);
 assert.equal((await t.com(outra,'/api/me')).status,401);assert.equal((await t.com(dono,'/api/me')).status,200,'a atual continua');
});

test('equipe: admin tem todas as ações; editor e operador da equipe veem e atendem, mas não editam o perfil',async()=>{
 await t.conta('admin@primig.test',{equipe:'admin'});await t.conta('op@primig.test',{equipe:'operador'});
 const admin=await t.entrar('admin@primig.test'),op=await t.entrar('op@primig.test');
 assert.equal((await t.com(admin,'/api/me')).json.equipe,'admin');
 const v=(await t.com(op,`/api/painel/empresas/${B}/perfil`)).json.version;
 assert.equal((await t.com(op,`/api/painel/empresas/${B}`,{method:'PATCH',body:{version:v,telefone:'2133334444'}})).status,403);
 assert.equal((await t.com(admin,`/api/painel/empresas/${B}`,{method:'PATCH',body:{version:v,telefone:'2133334444'}})).status,200);
 assert.equal((await t.com(op,`/api/painel/empresas/${B}/solicitacoes`,{method:'POST',body:{tipo:'suporte',assunto:'Contato',texto:'Retorno da PRIMIG'}})).status,201);
 // Primeiro admin pelo CLI: conta sem senha e link de uso único (a senha nunca passa pela linha de comando).
 const u=await ensureUser(t.db,'primeiro.admin@primig.test',{kind:'equipe'});await t.db.query("UPDATE users SET staff_role='admin' WHERE id=$1",[u.id]);
 assert.equal((await t.req('/api/auth/login',{method:'POST',body:{email:'primeiro.admin@primig.test',senha:'!sem-senha'}})).status,401,'sem senha não entra');
 const {value}=await issueToken(t.db,{kind:'recuperacao',userId:u.id,now:t.agora});
 assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:value,senha:'senha-do-admin-123'}})).status,200);
 assert.equal((await t.com(await t.entrar('primeiro.admin@primig.test','senha-do-admin-123'),'/api/me')).json.equipe,'admin');
});

test('auditoria só aceita INSERT, com antes, depois e IP',async()=>{
 const linha=(await t.db.query("SELECT id FROM audit_log LIMIT 1")).rows[0];assert.ok(linha);
 await assert.rejects(t.db.query("UPDATE audit_log SET action='x' WHERE id=$1",[linha.id]),/só aceita INSERT/);
 await assert.rejects(t.db.query('DELETE FROM audit_log WHERE id=$1',[linha.id]),/só aceita INSERT/);
 await assert.rejects(t.db.query('TRUNCATE audit_log'),/só aceita INSERT/);
 const p=(await auditoria('perfil_atualizado'))[0];assert.ok(p.before&&p.after&&p.ip,'antes, depois e IP');
});
