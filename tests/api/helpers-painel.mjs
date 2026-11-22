import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDB,migrate} from '../../api/db.mjs';
import {importSnapshot} from '../../api/import.mjs';
import {createApp} from '../../api/server.mjs';
import {hashPassword} from '../../api/auth.mjs';

// Ambiente das Fases 3 e 4: servidor real sobre o acervo importado, relógio controlado, e-mail falso e pasta de mídia temporária.
export const origin='http://127.0.0.1:4180';
export const SENHA='senha-de-teste-123';
export async function ambiente() {
  const t={agora:new Date('2026-10-05T10:00:00-03:00'),enviados:[],mailerAtivo:true};
  t.db=await openDB({url:null,path:':memory:'});await migrate(t.db);await importSnapshot(t.db);
  t.dir=await mkdtemp(join(tmpdir(),'primig-midia-'));
  t.server=await createApp({db:t.db,origin,clock:()=>t.agora,mailer:async m=>{if(!t.mailerAtivo)return false;t.enviados.push(m);return true;},mediaDir:t.dir});
  await new Promise(r=>t.server.listen(0,'127.0.0.1',r));
  t.base=`http://127.0.0.1:${t.server.address().port}`;
  // Cada chamada sai de um IP diferente (o limite por IP real não vaza de um teste para outro), salvo quando o teste escolhe.
  t.req=async(path,{method='GET',body,raw,type,cookie,csrf,ip=`10.9.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}`,originValue=origin}={})=>{
    const headers={Origin:originValue,'X-Forwarded-For':ip};
    if(body!==undefined)headers['Content-Type']='application/json';
    if(raw)headers['Content-Type']=type||'application/octet-stream';
    if(cookie)headers.Cookie=cookie;if(csrf)headers['X-CSRF-Token']=csrf;
    const r=await fetch(t.base+path,{method,redirect:'manual',headers,body:raw??(body!==undefined?JSON.stringify(body):undefined)});
    const text=r.headers.get('content-type')?.includes('image/')?'':await r.text();let json=null;try{json=JSON.parse(text);}catch{}
    return {status:r.status,json,text,headers:r.headers,location:r.headers.get('location')};
  };
  // Conta com senha, com vínculo opcional a uma empresa e papel na equipe.
  t.conta=async(email,{empresa,papel='dono',equipe=null,senha=SENHA}={})=>{
    const id=randomUUID();
    await t.db.query('INSERT INTO users(id,email,password_hash,staff_role,kind,name) VALUES($1,$2,$3,$4,$5,$6)',[id,email,await hashPassword(senha),equipe,equipe?'equipe':'associado',email.split('@')[0]]);
    if(empresa)await t.db.query('INSERT INTO memberships(user_id,business_id,role) VALUES($1,$2,$3)',[id,empresa,papel]);
    return id;
  };
  t.entrar=async(email,senha=SENHA,opts={})=>{
    const r=await t.req('/api/auth/login',{method:'POST',body:{email,senha},...opts});
    if(r.status!==200)throw new Error(`login ${email}: ${r.status} ${r.text}`);
    return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.json.csrf,usuario:r.json.usuario,setCookie:r.headers.get('set-cookie')};
  };
  // Atalho: chamada autenticada com a sessão s.
  t.com=(s,path,opts={})=>t.req(path,{cookie:s.cookie,csrf:s.csrf,...opts});
  t.fim=async()=>{if(t.server)await new Promise(r=>t.server.close(r));if(t.db)await t.db.close();await rm(t.dir,{recursive:true,force:true});};
  return t;
}
