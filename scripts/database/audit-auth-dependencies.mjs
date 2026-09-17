// Read-only catalog audit; prints schema metadata, never application records or credentials.
import { databaseEnvironment, remoteClient } from './connection.mjs';
import { Client } from 'pg';
const local = process.argv.includes('--local');
const db = local
  ? new Client({ host: '127.0.0.1', port: 55432, user: 'postgres', database: 'lodario_country_test' })
  : remoteClient(databaseEnvironment());
await db.connect();
try {
  await db.query('BEGIN READ ONLY');
  if (!local) await db.query('SET LOCAL ROLE postgres');
  const queries = {
    foreignKeys: `SELECT c.conrelid::regclass::text AS table_name,c.conname,pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE c.contype='f' AND (n.nspname='public' OR c.confrelid='auth.users'::regclass) ORDER BY 1,2`,
    triggers: `SELECT t.tgrelid::regclass::text AS table_name,t.tgname,pg_get_triggerdef(t.oid) AS definition,
      p.oid::regprocedure::text AS function_name,pg_get_functiondef(p.oid) AS function_definition
      FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal
      AND (n.nspname='public' OR t.tgrelid='auth.users'::regclass) ORDER BY 1,2`,
    ownershipColumns: `SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND (data_type IN ('uuid','jsonb','json') OR column_name ~ '(email|owner|user|player|guardian|coach|created_by|recorded_by|assigned_to|reviewed_by|granted_by)') ORDER BY 1,ordinal_position`,
  };
  for (const [name, sql] of Object.entries(queries)) console.log(JSON.stringify({ [name]: (await db.query(sql)).rows }));
  if ((await db.query("SELECT to_regclass('storage.objects') IS NOT NULL AS available")).rows[0].available) {
    console.log(JSON.stringify({ storageObjects: (await db.query('SELECT count(*)::integer AS count FROM storage.objects')).rows[0].count }));
  }
  await db.query('ROLLBACK');
} finally { await db.end(); }
