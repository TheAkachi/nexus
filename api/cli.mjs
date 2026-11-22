import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, openDB, migrate } from './db.mjs';
import { importSnapshot } from './import.mjs';
import { backup, restore } from './backup.mjs';
import { ensureUser, issueToken } from './auth.mjs';
import { audit } from './lib/auditoria.mjs';
import { PAPEIS } from './permissoes.mjs';
import { coletar } from './coleta.mjs';

const command=process.argv[2],args=process.argv.slice(3);
const origin=process.env.PUBLIC_ORIGIN||'http://127.0.0.1:4183';
const db=await openDB();
// Links de uso único (contrato 12.2): a senha nunca passa pela linha de comando; o link sai aqui e vai pelo WhatsApp.
const linkDe=value=>`${origin}/entrar/definir-senha?token=${value}`;
try {
  await migrate(db);
  if(command==='migrate') console.log('Migrações aplicadas.');
  else if(command==='seed') console.log(await importSnapshot(db));
  else if(command==='backup') {
    const archive=await backup(db,process.env.BACKUP_PASSPHRASE);
    // --stdout: o arquivo sai na saída padrão (o backup diário da VPS grava fora do contêiner).
    if(args[0]==='--stdout'){process.stdout.write(JSON.stringify(archive));}
    else {
    await mkdir(resolve(root,'backups'),{recursive:true});
    const file=resolve(root,'backups',`nexus-${Date.now()}.json`);
    await writeFile(file,JSON.stringify(archive),{mode:0o600,flag:'wx'});
    console.log(`Backup criptografado: ${file}`);
    }
  } else if(command==='restore') {
    if(!args[0]||!process.env.BACKUP_PASSPHRASE) throw new Error('Informe arquivo e BACKUP_PASSPHRASE. DB_DIR deve apontar para banco novo.');
    console.log(await restore(db,JSON.parse(await readFile(args[0],'utf8')),process.env.BACKUP_PASSPHRASE));
  } else if(command==='admin') {
    // Equipe Nexus: node api/cli.mjs admin EMAIL [admin|editor|operador]
    const papel=args[1]||'admin';
    if(!['admin','editor','operador'].includes(papel))throw new Error('Papel da equipe: admin, editor ou operador.');
    const u=await ensureUser(db,args[0],{kind:'equipe'});
    await db.query("UPDATE users SET staff_role=$2,kind='equipe',disabled=false WHERE id=$1",[u.id,papel]);
    const {value,expires}=await issueToken(db,{kind:'recuperacao',userId:u.id});
    await audit(db,{action:'equipe_definida_cli',resource:u.id,after:{email:u.email,papel},ip:'cli'});
    console.log(`${u.email} é ${papel} da equipe. Link para definir a senha (vale até ${expires.toISOString()}):\n${linkDe(value)}`);
  } else if(command==='link-senha') {
    // Recuperação manual: node api/cli.mjs link-senha EMAIL
    const u=(await db.query('SELECT id,email FROM users WHERE email=$1 AND disabled=false',[String(args[0]||'').trim().toLowerCase()])).rows[0];
    if(!u)throw new Error('Conta não encontrada ou desativada.');
    const {value,expires}=await issueToken(db,{kind:'recuperacao',userId:u.id});
    await audit(db,{action:'recuperacao_cli',resource:u.id,after:{email:u.email},ip:'cli'});
    console.log(`Link para ${u.email} definir a senha (vale até ${expires.toISOString()}):\n${linkDe(value)}`);
  } else if(command==='convite') {
    // Primeiro dono de uma empresa: node api/cli.mjs convite EMAIL EMPRESA [dono|editor|financeiro|leitura]
    const [email,empresa,papel='dono']=args;
    if(!PAPEIS.includes(papel))throw new Error('Papel: dono, editor, financeiro ou leitura.');
    if(!(await db.query('SELECT 1 FROM businesses WHERE id=$1',[empresa])).rows.length)throw new Error('Empresa não encontrada (use o id, como boreal-tintas).');
    const u=await ensureUser(db,email);
    const {value,expires}=await issueToken(db,{kind:'convite',userId:u.id,businessId:empresa,role:papel});
    await audit(db,{business:empresa,action:'convite_cli',resource:u.id,after:{email:u.email,papel},ip:'cli'});
    console.log(`Convite de ${u.email} como ${papel} em ${empresa} (vale até ${expires.toISOString()}):\n${linkDe(value)}`);
  } else if(command==='coletar') {
    // Coleta diária do portal antigo (13.7): notícias e artigos novos ou alterados. Para sozinha depois de COLETA_ATE.
    const r=await coletar(db,{log:m=>console.log(m)});
    console.log(r.parada?`Coleta desligada: COLETA_ATE=${r.ate}.`:`Coleta: ${r.novas} novas, ${r.atualizadas} atualizadas, ${r.ignoradas} sem mudança, ${r.erros.length} erros.`);
    for(const e of r.erros)console.log(`  erro: ${e}`);
  } else throw new Error('Comandos: migrate, seed, backup [--stdout], restore ARQUIVO, admin EMAIL [papel], link-senha EMAIL, convite EMAIL EMPRESA [papel], coletar');
} finally { await db.close(); }
