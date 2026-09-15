import {databaseEnvironment,remoteClient} from './connection.mjs';
const env=databaseEnvironment();const client=remoteClient(env);
try{
  await client.connect();await client.query('BEGIN');await client.query('SET LOCAL ROLE postgres');
  await client.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
  await client.query("SELECT cron.schedule('lodario-operational-retention','15 3 * * *', $1)",["DELETE FROM public.beta_operational_events WHERE occurred_at < now() - interval '30 days'"]);
  await client.query("SELECT cron.schedule('lodario-cron-history-retention','30 3 * * *', $1)",["DELETE FROM cron.job_run_details WHERE end_time < now() - interval '30 days'"]);
  const jobs=await client.query("SELECT jobname,schedule,active FROM cron.job WHERE jobname IN ('lodario-operational-retention','lodario-cron-history-retention') ORDER BY jobname");
  await client.query('COMMIT');
  console.log(JSON.stringify(jobs.rows));
}finally{await client.end();delete env.PGPASSWORD;}
