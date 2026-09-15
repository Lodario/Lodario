import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

export const backupDirectory = path.resolve('.local-backups/country-beta');
export const pgBin = process.env.LODARIO_PG_BIN || path.join(backupDirectory, 'edb/pgsql/bin');
export const caPath = process.env.LODARIO_DATABASE_CA || path.join(backupDirectory, 'supabase-root.crt');

/** Read only the configured Supabase CLI's temporary database login; never print or persist it. */
export function databaseEnvironment() {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const arguments_ = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx --yes supabase@2.109.1 db dump --linked --schema public --dry-run']
    : ['--yes', 'supabase@2.109.1', 'db', 'dump', '--linked', '--schema', 'public', '--dry-run'];
  let script;
  try { script = execFileSync(command, arguments_, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], windowsHide: true }); }
  catch { throw new Error('Supabase CLI could not obtain its temporary database login. Run supabase login/link and retry.'); }
  const env = { ...process.env };
  for (const match of script.matchAll(/export (PG[A-Z_]+)=(?:"([^"]*)"|'([^']*)'|([^\r\n]+))/g)) {
    env[match[1]] = match[2] ?? match[3] ?? match[4];
  }
  script = '';
  for (const name of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']) {
    if (!env[name]) throw new Error(`The CLI did not supply ${name}.`);
  }
  if (!fs.existsSync(caPath)) throw new Error('Download the Supabase CA certificate before connecting.');
  env.PGSSLMODE = 'verify-full';
  env.PGSSLROOTCERT = caPath;
  env.PGCONNECT_TIMEOUT = '20';
  return env;
}

export function remoteClient(env) {
  return new Client({ host: env.PGHOST, port: Number(env.PGPORT), user: env.PGUSER,
    password: env.PGPASSWORD, database: env.PGDATABASE, connectionTimeoutMillis: 20_000,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') } });
}

export function runPostgres(name, args, env) {
  const executable = path.join(pgBin, name + (process.platform === 'win32' ? '.exe' : ''));
  if (!fs.existsSync(executable)) throw new Error(`PostgreSQL tool is missing: ${name}. Set LODARIO_PG_BIN to the installed bin directory.`);
  try { return execFileSync(executable, args, { env, stdio: ['ignore','pipe','pipe'], windowsHide: true, encoding: 'utf8', maxBuffer: 16*1024*1024 }); }
  catch (error) {
    // COPY/restore stderr can contain row values. Never expose it in routine logs.
    throw new Error(`${name} failed (exit ${error.status ?? 'unavailable'}). Database contents and credentials were not logged.`);
  }
}
