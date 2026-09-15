// Resets only lodario_country_test on the fixed loopback test server. Never points at production.
import fs from 'node:fs';
import { Client } from 'pg';
const connection={host:'127.0.0.1',port:55432,user:'postgres'};
const admin=new Client({...connection,database:'postgres'}); await admin.connect();
for(const name of ['anon','authenticated','service_role']) { if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount) await admin.query(`CREATE ROLE ${name} NOLOGIN ${name==='service_role'?'BYPASSRLS':''}`); }
if(!(await admin.query("SELECT 1 FROM pg_database WHERE datname='lodario_country_test'")).rowCount) await admin.query('CREATE DATABASE lodario_country_test');
await admin.end(); const db=new Client({...connection,database:'lodario_country_test'}); await db.connect();
await db.query(`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS extensions CASCADE;
CREATE SCHEMA public; CREATE SCHEMA auth; CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role;
CREATE TABLE auth.users(id UUID PRIMARY KEY, email TEXT, email_confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), raw_user_meta_data JSONB DEFAULT '{}');
CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::UUID $$;
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
CREATE EXTENSION pgcrypto SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" SCHEMA extensions;
SET search_path=public,extensions;`);
try {
 for(const file of fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) {
   try {await db.query(fs.readFileSync('supabase/migrations/'+file,'utf8')); console.log('APPLIED '+file);}
   catch(e){console.error('FAILED '+file+' '+e.message+' '+(e.where||''));throw e;}
 }
} finally {await db.end();}
