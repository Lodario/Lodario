import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { backupDirectory,runPostgres } from './connection.mjs';
const fileName=process.argv[2];
if(!fileName||path.basename(fileName)!==fileName||!/^backup-.*\.json$/.test(fileName))throw Error('Supply a backup record filename.');
const record=JSON.parse(fs.readFileSync(path.join(backupDirectory,fileName),'utf8'));
for(const file of record.files){
  assert.equal(path.basename(file.name),file.name);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(backupDirectory,file.name))).digest('hex'),file.sha256);
}
const local={host:'127.0.0.1',port:55432,user:'postgres',database:'postgres',connectionTimeoutMillis:5000};
const database='lodario_recovery_'+Date.now(); const admin=new Client(local);await admin.connect();let restored;
try{
  const roles=record.files.find(f=>f.name.endsWith('-roles.sql'));
  for(const m of fs.readFileSync(path.join(backupDirectory,roles.name),'utf8').matchAll(/^CREATE ROLE ([a-z_][a-z0-9_]*);$/gm))
    if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[m[1]])).rowCount)await admin.query(`CREATE ROLE "${m[1]}" NOLOGIN`);
  await admin.query(`CREATE DATABASE ${database}`);restored=new Client({...local,database});await restored.connect();
  await restored.query('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions; CREATE EXTENSION "uuid-ossp" SCHEMA extensions; DROP SCHEMA public;');
  const archive=record.files.find(f=>f.name.endsWith('-recovery.dump'));
  runPostgres('pg_restore',['--exit-on-error','--no-owner','--dbname',database,path.join(backupDirectory,archive.name)],{...process.env,PGHOST:local.host,PGPORT:String(local.port),PGUSER:local.user,PGDATABASE:database,PGSSLMODE:'disable',PGPASSWORD:'',PGOPTIONS:''});
  const counts={...Object.fromEntries(Object.entries(record.tableCounts).map(([t,n])=>['public.'+t,n])),...record.managedTableCounts};
  for(const [table,n] of Object.entries(counts)) {
    const quoted=table.split('.').map(part=>'"'+part.replaceAll('"','""')+'"').join('.');
    assert.equal((await restored.query(`SELECT count(*)::text AS n FROM ${quoted}`)).rows[0].n,n,table+' count mismatch');
  }
  record.recoveryRestore={passed:true,checkedAt:new Date().toISOString(),tables:Object.keys(counts).length,authRestored:true,storageObjects:Number(record.managedTableCounts['storage.objects']||0)};
  fs.writeFileSync(path.join(backupDirectory,fileName),JSON.stringify(record,null,2));
  console.log('PASS full public/Auth/Storage metadata restore; '+Object.keys(counts).length+' table counts match.');
}finally{
  if(restored)await restored.end();
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);await admin.end();
}
