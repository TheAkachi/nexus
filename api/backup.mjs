import { randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

// Ordem de restauração respeita chaves estrangeiras. Sessões e resets são revogados por não serem exportados.
// v0.22.0: categories (as categorias criadas pela equipe, contrato 22.1) vem depois de users, a quem criada_por aponta.
const tables=['users','plans','business_groups','categories','businesses','memberships','catalog_items','content','campaigns','redirects','measurement_events','public_events','ad_daily','access_tokens','media','approvals','requests','request_messages','business_daily','search_misses','site_daily','search_daily','metric_starts','coupons','coupon_claims','resident_reviews','about_people','reviews','business_hours','events','collections','pilot_experiences','pilot_vouchers','pilot_referrals','pilot_suggestion_reviews','audit_log'];
// Tabelas que a migração já cria com linhas (o começo das métricas, 19.6): na restauração, as linhas do backup tomam o lugar.
const PADRAO=['metric_starts'];
// O backup comum não leva hash de senha: a conta restaurada recebe uma senha inutilizável e precisa redefini-la.
export const RESTORED_PASSWORD='!restaurado-sem-senha';
export async function backup(db,passphrase) {
  if(typeof passphrase!=='string'||passphrase.length<16) throw new Error('BACKUP_PASSPHRASE deve ter ao menos 16 caracteres');
  const data=await db.transaction(async tx=> {
    const result={}; for(const table of tables) result[table]=(await tx.query(`SELECT * FROM ${table}`)).rows; return result;
  });
  for(const user of data.users) delete user.password_hash;
  const migrations=(await db.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows;
  const plain=Buffer.from(JSON.stringify({format:1,migrations,data}));
  const salt=randomBytes(16),iv=randomBytes(12),key=scryptSync(passphrase,salt,32);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
  return {format:1,algorithm:'aes-256-gcm',salt:salt.toString('hex'),iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:encrypted.toString('base64'),sha256:createHash('sha256').update(encrypted).digest('hex')};
}
export async function restore(db,archive,passphrase) {
  if(archive.format!==1 || archive.algorithm!=='aes-256-gcm') throw new Error('Formato não suportado');
  const encrypted=Buffer.from(archive.data,'base64');
  if(createHash('sha256').update(encrypted).digest('hex')!==archive.sha256) throw new Error('Checksum inválido');
  const key=scryptSync(passphrase,Buffer.from(archive.salt,'hex'),32);
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(archive.iv,'hex')); decipher.setAuthTag(Buffer.from(archive.tag,'hex'));
  const payload=JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString());
  const migrations=(await db.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows;
  if(JSON.stringify(migrations)!==JSON.stringify(payload.migrations)) throw new Error('Versão de schema incompatível');
  await db.transaction(async tx=> {
    for(const table of tables) if(!PADRAO.includes(table)&&(await tx.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n!==0) throw new Error('Restauração exige banco vazio, já migrado');
    for(const table of PADRAO) await tx.query(`DELETE FROM ${table}`);
    for(const table of tables) {
      const allowed=(await tx.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['public',table])).rows.map(x=>x.column_name);
      if(!Array.isArray(payload.data[table])) throw new Error('Tabela ausente');
      for(const source of payload.data[table]) {
        const row=table==='users'&&!source.password_hash?{...source,password_hash:RESTORED_PASSWORD}:source;
        const keys=Object.keys(row);
        if(!keys.length || keys.some(k=>!allowed.includes(k))) throw new Error('Coluna desconhecida');
        await tx.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`,keys.map(k=>(row[k] && typeof row[k]==='object')?JSON.stringify(row[k]):row[k]));
      }
    }
  });
  return Object.fromEntries(tables.map(t=>[t,payload.data[t].length]));
}
