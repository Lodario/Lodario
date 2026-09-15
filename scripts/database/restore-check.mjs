import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from 'pg';
import { backupDirectory, runPostgres } from './connection.mjs';

const fileName = process.argv[2];
if (!fileName || path.basename(fileName) !== fileName || !/^backup-.*\.json$/.test(fileName)) throw new Error('Supply a backup record filename from .local-backups/country-beta.');
const record = JSON.parse(fs.readFileSync(path.join(backupDirectory,fileName),'utf8'));
for (const file of record.files) {
  if (path.basename(file.name)!==file.name) throw new Error('Invalid backup file path.');
  const bytes=fs.readFileSync(path.join(backupDirectory,file.name));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256,'Backup checksum mismatch');
}
// Fixed loopback host/port. No environment variable or remote URL can redirect this restore.
const local={host:'127.0.0.1',port:55432,user:'postgres',database:'postgres',connectionTimeoutMillis:5000};
const database='lodario_restore_'+Date.now();
const admin=new Client(local); await admin.connect();
const env={...process.env,PGHOST:local.host,PGPORT:String(local.port),PGUSER:local.user,PGDATABASE:database,PGSSLMODE:'disable',PGPASSWORD:'',PGOPTIONS:''};
let restored;
try {
  // Placeholder ACL identities only: never replay hosted login/password settings.
  const rolesFile=record.files.find(f=>f.name.endsWith('-roles.sql'));
  for(const match of fs.readFileSync(path.join(backupDirectory,rolesFile.name),'utf8').matchAll(/^CREATE ROLE ([a-z_][a-z0-9_]*);$/gm)) {
    if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[match[1]])).rowCount)
      await admin.query(`CREATE ROLE "${match[1]}" NOLOGIN`);
  }
  await admin.query(`CREATE DATABASE ${database}`);
  restored=new Client({...local,database}); await restored.connect();
  await restored.query(`CREATE SCHEMA auth; CREATE SCHEMA extensions;
    CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,email_confirmed_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT now(),raw_user_meta_data JSONB DEFAULT '{}');
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
    GRANT USAGE ON SCHEMA auth,extensions TO anon,authenticated,service_role;
    CREATE EXTENSION pgcrypto SCHEMA extensions; CREATE EXTENSION "uuid-ossp" SCHEMA extensions;`);
  const schema=record.files.find(f=>f.name.endsWith('-schema.sql'));
  if(fs.readFileSync(path.join(backupDirectory,schema.name),'utf8').includes('CREATE SCHEMA public;')) await restored.query('DROP SCHEMA public');
  runPostgres('psql',['-X','--set','ON_ERROR_STOP=1','--file',path.join(backupDirectory,schema.name)],env);
  const data=record.files.find(f=>f.name.endsWith('-data.sql'));
  runPostgres('psql',['-X','--set','ON_ERROR_STOP=1','--command','SET session_replication_role=replica;','--file',path.join(backupDirectory,data.name)],env);
  let rows=0;
  for(const [table,expected] of Object.entries(record.tableCounts)) {
    const actual=(await restored.query(`SELECT count(*)::text AS n FROM public."${table.replaceAll('"','""')}"`)).rows[0].n;
    assert.equal(actual,expected,`${table} count mismatch`);rows+=Number(actual);
  }
  console.log(`PASS restored all ${Object.keys(record.tableCounts).length} public tables; ${rows} rows match the backup snapshot.`);
  // Auth is managed separately. Synthetic identities preserve public-data references for the drill.
  const references=(await restored.query(`SELECT c.conrelid::regclass::text AS table_name,a.attname AS column_name
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='auth.users'::regclass`)).rows;
  for(const reference of references) await restored.query(`INSERT INTO auth.users(id)
    SELECT DISTINCT "${reference.column_name.replaceAll('"','""')}" FROM ${reference.table_name}
    WHERE "${reference.column_name.replaceAll('"','""')}" IS NOT NULL ON CONFLICT DO NOTHING`);
  const pending=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&n>='20260723210000').sort();
  for(const migration of pending) {
    await restored.query(fs.readFileSync(path.join('supabase/migrations',migration),'utf8'));
    console.log('PASS restored-data migration '+migration);
  }
  const ageFlag=(await restored.query("SELECT enabled FROM public.guardian_feature_flags WHERE flag_key='public_beta_18_plus_enabled'")).rows[0].enabled;
  assert.equal(ageFlag,false);
  record.restore={passed:true,checkedAt:new Date().toISOString(),tables:Object.keys(record.tableCounts).length,rows,migrations:pending,authUsers:'Synthetic placeholder IDs only; production Auth users were not restored.'};
  fs.writeFileSync(path.join(backupDirectory,fileName),JSON.stringify(record,null,2));
} finally {
  if(restored)await restored.end();
  // Only this freshly created disposable database is removed; no shared database is touched.
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  await admin.end();
}
