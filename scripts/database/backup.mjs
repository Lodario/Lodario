import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { backupDirectory, databaseEnvironment, remoteClient, runPostgres } from './connection.mjs';

fs.mkdirSync(backupDirectory, { recursive: true });
const env = databaseEnvironment();
const client = remoteClient(env);
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const files = [];
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query('SET LOCAL ROLE postgres');
  const snapshot = (await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
  const version = (await client.query('SHOW server_version')).rows[0].server_version;
  for (const [kind, args] of [
    ['schema', ['--schema-only']],
    ['data', ['--data-only']],
  ]) {
    const file = path.join(backupDirectory, `lodario-${stamp}-${kind}.sql`);
    runPostgres('pg_dump', ['--schema=public','--role=postgres','--no-owner',`--snapshot=${snapshot}`,...args,'--file',file],env);
    const bytes = fs.readFileSync(file);
    if (!bytes.length) throw new Error(`${kind} backup is empty.`);
    files.push({ name: path.basename(file), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    console.log(`PASS ${kind} backup: ${bytes.length} bytes`);
  }
  const rolesFile = path.join(backupDirectory, `lodario-${stamp}-roles.sql`);
  runPostgres('pg_dumpall',['--roles-only','--no-role-passwords','--role=postgres','--file',rolesFile],env);
  const rolesBytes = fs.readFileSync(rolesFile);
  files.push({name:path.basename(rolesFile),bytes:rolesBytes.length,sha256:crypto.createHash('sha256').update(rolesBytes).digest('hex')});
  // Include managed Auth and Storage metadata for recovery, never for application fixtures.
  const archive=path.join(backupDirectory,`lodario-${stamp}-recovery.dump`);
  runPostgres('pg_dump',['--schema=public','--schema=auth','--schema=storage','--format=custom','--role=postgres','--no-owner',`--snapshot=${snapshot}`,'--file',archive],env);
  const archiveBytes=fs.readFileSync(archive);
  files.push({name:path.basename(archive),bytes:archiveBytes.length,sha256:crypto.createHash('sha256').update(archiveBytes).digest('hex')});
  const managedCounts={};
  const managedTables=(await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('auth','storage') ORDER BY schemaname,tablename")).rows;
  for(const {schemaname,tablename} of managedTables)managedCounts[`${schemaname}.${tablename}`]=(await client.query(`SELECT count(*)::text AS n FROM "${schemaname}"."${tablename.replaceAll('"','""')}"`)).rows[0].n;
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  const counts = {};
  for (const {tablename} of tables) counts[tablename] = (await client.query(`SELECT count(*)::text AS n FROM public."${tablename.replaceAll('"','""')}"`)).rows[0].n;
  const record = { status:'backup-created', createdAt:new Date().toISOString(), deleteAfter:new Date(Date.now()+30*86400000).toISOString(),
    projectRef:fs.readFileSync('supabase/.temp/project-ref','utf8').trim(), serverVersion:version,
    scope:'Consistent public schema/data plus Auth and Storage schema/data recovery archive; roles without passwords. Excludes Storage object bytes and other provider-managed schemas/configuration.',
    tls:'Certificate and hostname verified; Supabase CA', files, tableCounts:counts,managedTableCounts:managedCounts };
  const resultFile = path.join(backupDirectory, `backup-${stamp}.json`);
  fs.writeFileSync(resultFile, JSON.stringify(record,null,2));
  console.log(`PASS roles backup and SHA-256 hashes; ${tables.length} public tables recorded. Retain for 30 days.`);
  console.log('Backup record: '+path.relative(process.cwd(),resultFile));
  await client.query('COMMIT');
} finally {
  await client.end();
  delete env.PGPASSWORD;
}
