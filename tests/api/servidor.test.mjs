import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {createApp} from '../../api/server.mjs';
import {clientIP} from '../../api/lib/ip.mjs';

let db,server,base;
const origin='http://127.0.0.1:4180';
before(async()=>{db=await openDB({url:null,path:':memory:'});await migrate(db);await importSnapshot(db);server=await createApp({db,origin});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.close();});

test('/assets serve qualquer arquivo de p2/ com extensão permitida, com gzip e ETag',async()=>{
 const css=await fetch(base+'/assets/style.css');assert.equal(css.status,200);assert.equal(css.headers.get('content-type'),'text/css; charset=utf-8');
 const alias=await fetch(base+'/assets/p2.css');assert.equal(await alias.text(),await css.text(),'p2.css é o nome público de style.css');assert.equal(alias.headers.get('etag'),css.headers.get('etag'));
 assert.equal((await fetch(base+'/assets/site.js',{headers:{'Accept-Encoding':'gzip'}})).headers.get('content-encoding'),'gzip');
 assert.equal((await fetch(base+'/assets/logo-primig.png',{headers:{'Accept-Encoding':'gzip'}})).headers.get('content-encoding'),null,'imagem binária vai sem gzip');
 const name=`teste-${randomUUID()}`,dir=new URL('../../p2/',import.meta.url);
 try{
  for(const [ext,type] of [['webp','image/webp'],['avif','image/avif'],['woff2','font/woff2']]){
   await writeFile(new URL(`${name}.${ext}`,dir),'x');const r=await fetch(`${base}/assets/${name}.${ext}`);assert.equal(r.status,200,ext);assert.equal(r.headers.get('content-type'),type);
  }
  await writeFile(new URL(`${name}.json`,dir),'{}');assert.equal((await fetch(`${base}/assets/${name}.json`)).status,404,'extensão fora da lista');
 }finally{for(const ext of ['webp','avif','woff2','json'])await rm(new URL(`${name}.${ext}`,dir),{force:true});}
 for(const path of ['/assets/nao-existe.css','/assets/','/assets/%2e%2e/package.json','/assets/..%2Fapi%2Fserver.mjs','/assets/.gitkeep.css','/assets/../api/db.mjs','/assets/sub/..%2Fstyle.css','/assets/p2%2F..%2F..%2Fpackage.json'])assert.equal((await fetch(base+path)).status,404,path);
 assert.equal((await fetch(base+'/assets/style.css',{method:'POST',headers:{Origin:origin}})).status,404);
});

test('IP real: X-Forwarded-For só vale vindo do proxy (rede privada) e só o último endereço',()=>{
 const req=(remoteAddress,forwarded)=>({socket:{remoteAddress},headers:forwarded?{'x-forwarded-for':forwarded}:{}});
 assert.equal(clientIP(req('172.16.9.1','203.0.113.7')),'203.0.113.7');
 assert.equal(clientIP(req('::ffff:127.0.0.1','198.51.100.1, 203.0.113.7')),'203.0.113.7','o cliente não escolhe o próprio IP');
 assert.equal(clientIP(req('10.0.0.2','2001:db8::1')),'2001:db8::1');
 assert.equal(clientIP(req('198.51.100.9','203.0.113.7')),'198.51.100.9','conexão direta de fora ignora o cabeçalho');
 assert.equal(clientIP(req('172.16.9.1','lixo')),'172.16.9.1');
 assert.equal(clientIP(req('172.16.9.1')),'172.16.9.1');
 assert.equal(clientIP(req('172.32.0.1','203.0.113.7')),'172.32.0.1','172.32/16 não é rede privada');
});

test('limite de eventos por minuto usa o IP do visitante, não o do proxy',async()=>{
 const send=ip=>fetch(base+'/api/events',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Forwarded-For':`198.51.100.1, ${ip}`},body:JSON.stringify({event_id:randomUUID(),session_id:randomUUID(),name:'business_viewed',business_id:'boreal-tintas',source:'search',consent:true})});
 const minute=Math.floor(Date.now()/60000);
 assert.equal((await send('203.0.113.7')).status,200);
 const keys=[minute,minute+1].map(m=>createHash('sha256').update(`events:203.0.113.7:${m}`).digest('hex'));
 const rows=(await db.query('SELECT key_hash FROM rate_limits WHERE key_hash = ANY($1)',[keys])).rows;
 assert.equal(rows.length,1,'contador guardado pelo IP real (hash, sem o IP em si)');
});

test('versão única: /health/live, package.json e a última entrada do CHANGELOG',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
 const changelog=await readFile(new URL('../../CHANGELOG.md',import.meta.url),'utf8');
 assert.deepEqual(await (await fetch(base+'/health/live')).json(),{status:'ok',version:pkg.version});
 assert.equal(changelog.match(/^## v(\S+)/m)[1],pkg.version);
});
