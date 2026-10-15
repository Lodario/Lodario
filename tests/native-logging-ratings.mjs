// Temporary tables on the fixed loopback test server; no public tables are changed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Client } from 'pg';

const db = new Client({ host: '127.0.0.1', port: 55432, user: 'postgres', database: 'lodario_country_test', connectionTimeoutMillis: 3000 });
await db.connect();
try {
  await db.query('BEGIN');
  await db.query(`CREATE TEMP TABLE wellness_logs (
    sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 10),
    energy integer CHECK (energy BETWEEN 1 AND 10),
    fatigue integer CHECK (fatigue BETWEEN 1 AND 10),
    stress integer CHECK (stress BETWEEN 1 AND 10),
    pain_level integer CHECK (pain_level BETWEEN 1 AND 10)
  ); CREATE TEMP TABLE training_logs (
    intensity integer CHECK (intensity BETWEEN 1 AND 10),
    performance integer CHECK (performance BETWEEN 1 AND 10),
    pain_level integer CHECK (pain_level BETWEEN 1 AND 10)
  );`);
  const migration = fs.readFileSync(new URL('../supabase/migrations/20261013180000_logging_zero_ratings.sql', import.meta.url), 'utf8')
    .replace(/\b(?:BEGIN|COMMIT);/g, '').replaceAll('public.', 'pg_temp.');
  await db.query(migration);
  await db.query('INSERT INTO pg_temp.wellness_logs VALUES (0,0,0,0,0), (10,10,10,10,10)');
  await db.query('INSERT INTO pg_temp.training_logs VALUES (1,1,0), (10,10,10), (5,NULL,NULL)');
  for (const sql of [
    'INSERT INTO pg_temp.wellness_logs VALUES (-1,0,0,0,0)',
    'INSERT INTO pg_temp.wellness_logs VALUES (0,11,0,0,0)',
    'INSERT INTO pg_temp.training_logs VALUES (0,5,0)',
    'INSERT INTO pg_temp.training_logs VALUES (5,0,0)',
    'INSERT INTO pg_temp.training_logs VALUES (5,5,11)',
  ]) {
    await db.query('SAVEPOINT invalid_rating');
    await assert.rejects(db.query(sql), error => error.code === '23514');
    await db.query('ROLLBACK TO SAVEPOINT invalid_rating');
  }
  console.log('PASS migrated database accepts zero wellness/pain and enforces effort/performance 1–10');
} finally {
  await db.query('ROLLBACK');
  await db.end();
}
