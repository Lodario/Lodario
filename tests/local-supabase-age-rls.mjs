import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

function readLocalSupabaseStatus() {
  const executable = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx --yes supabase@2.109.1 status --output json']
      : ['--yes', 'supabase@2.109.1', 'status', '--output', 'json'];
  const output = execFileSync(executable, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return JSON.parse(output);
}

function requireLocalUrl(value) {
  const url = new URL(value);
  assert.ok(
    ['127.0.0.1', 'localhost'].includes(url.hostname),
    `Refusing to run against non-local Supabase host: ${url.hostname}`,
  );
  return url.origin;
}

function makeUserClient(apiUrl, anonKey) {
  return createClient(apiUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function createPlayer(admin, apiUrl, anonKey, label) {
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `local-age-gate-${label}-${unique}@example.test`;
  const password = `Local-${crypto.randomUUID()}-Pass9!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(createError);
  assert.ok(created.user?.id);

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: created.user.id, role: 'player' });
  assert.ifError(profileError);

  const client = makeUserClient(apiUrl, anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signInError);

  return { client, id: created.user.id };
}

async function setDateOfBirth(client, dateOfBirth) {
  return client.rpc('public_beta_set_my_date_of_birth', {
    p_date_of_birth: dateOfBirth,
  });
}

async function main() {
  const status = readLocalSupabaseStatus();
  const apiUrl = requireLocalUrl(status.API_URL);
  const anonKey = status.ANON_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  assert.ok(anonKey, 'Local Supabase status did not include ANON_KEY');
  assert.ok(serviceRoleKey, 'Local Supabase status did not include SERVICE_ROLE_KEY');

  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const createdUserIds = [];

  try {
    const missing = await createPlayer(admin, apiUrl, anonKey, 'missing');
    createdUserIds.push(missing.id);
    const { data: missingStatus, error: missingStatusError } = await missing.client.rpc(
      'public_beta_get_my_age_status',
    );
    assert.ifError(missingStatusError);
    assert.equal(missingStatus.hasDateOfBirth, false);
    assert.equal(missingStatus.eligible, false);
    assert.equal(missingStatus.age, null);
    console.log('PASS missing DOB is ineligible and returns no age');

    const { error: futureDobError } = await setDateOfBirth(missing.client, '2999-01-01');
    assert.ok(futureDobError, 'A future DOB must be rejected');
    const { error: malformedDobError } = await setDateOfBirth(missing.client, 'not-a-date');
    assert.ok(malformedDobError, 'A malformed DOB must be rejected');
    console.log('PASS future and malformed DOB values are rejected');

    const adult = await createPlayer(admin, apiUrl, anonKey, 'adult');
    createdUserIds.push(adult.id);
    const { data: adultSetStatus, error: adultSetError } = await setDateOfBirth(
      adult.client,
      '1995-02-14',
    );
    assert.ifError(adultSetError);
    assert.equal(adultSetStatus.hasDateOfBirth, true);
    assert.equal(adultSetStatus.eligible, true);
    assert.ok(adultSetStatus.age >= 18);

    const { data: adultStatus, error: adultStatusError } = await adult.client.rpc(
      'public_beta_get_my_age_status',
    );
    assert.ifError(adultStatusError);
    assert.equal(adultStatus.eligible, true);
    assert.equal(adultStatus.role, 'player');
    console.log('PASS authenticated adult can complete and pass the age gate');

    const { error: changedDobError } = await setDateOfBirth(adult.client, '1994-02-14');
    assert.ok(changedDobError, 'An authenticated user must not be able to replace a stored DOB');
    console.log('PASS stored DOB cannot be changed through the beta RPC');

    const minor = await createPlayer(admin, apiUrl, anonKey, 'minor');
    createdUserIds.push(minor.id);
    const { data: minorSetStatus, error: minorSetError } = await setDateOfBirth(
      minor.client,
      '2011-02-14',
    );
    assert.ifError(minorSetError);
    assert.equal(minorSetStatus.hasDateOfBirth, true);
    assert.equal(minorSetStatus.eligible, false);
    assert.ok(minorSetStatus.age < 18);
    console.log('PASS authenticated under-18 user is blocked by the age gate');

    const wellnessPayload = {
      user_id: adult.id,
      date: '2026-07-24',
      sleep_time: '22:30',
      wake_time: '07:00',
      sleep_duration: 8.5,
      sleep_quality: 8,
      energy: 8,
      fatigue: 3,
      stress: 2,
      pain_active: false,
    };
    const { data: adultLog, error: adultLogError } = await adult.client
      .from('wellness_logs')
      .insert(wellnessPayload)
      .select('id')
      .single();
    assert.ifError(adultLogError);
    assert.ok(adultLog?.id);
    console.log('PASS authenticated adult can write an owned stable-core record');

    const observer = await createPlayer(admin, apiUrl, anonKey, 'observer');
    createdUserIds.push(observer.id);
    const { error: observerDobError } = await setDateOfBirth(observer.client, '1990-03-10');
    assert.ifError(observerDobError);
    const { data: crossUserRows, error: crossUserReadError } = await observer.client
      .from('wellness_logs')
      .select('id')
      .eq('id', adultLog.id);
    assert.ifError(crossUserReadError);
    assert.deepEqual(crossUserRows, []);
    console.log('PASS RLS prevents one adult from reading another adult’s wellness record');

    const { error: minorWriteError } = await minor.client.from('wellness_logs').insert({
      ...wellnessPayload,
      user_id: minor.id,
      date: '2026-07-23',
    });
    assert.ok(minorWriteError, 'An under-18 user must not be able to write wellness data');
    console.log('PASS restrictive RLS/write enforcement blocks under-18 stable-core access');

  } finally {
    for (const userId of createdUserIds.reverse()) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.warn(`WARN could not remove disposable local user ${userId}: ${error.message}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
