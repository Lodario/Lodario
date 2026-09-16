// Real SQL/JWT regression checks. Uses only the disposable loopback database;
// every fixture and mutation is rolled back. No emails are sent.
import assert from 'node:assert/strict';
import { Client } from 'pg';

const db = new Client({ host: '127.0.0.1', port: 55432, user: 'postgres', database: 'lodario_country_test', connectionTimeoutMillis: 5000 });
await db.connect();
const q = (sql, params = []) => db.query(sql, params);
async function asUser(user, sql, params = []) {
  await q('SAVEPOINT acting_user');
  try {
    await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user.id, role: 'authenticated', iat: Math.floor(Date.now() / 1000) })]);
    const result = await q(sql, params);
    await q('RESET ROLE');
    await q("SELECT set_config('request.jwt.claims','{}',true)");
    await q('RELEASE SAVEPOINT acting_user');
    return result;
  } catch (error) { await q('ROLLBACK TO SAVEPOINT acting_user'); throw error; }
}
async function rpc(user, name, args = []) {
  return (await asUser(user, `SELECT public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS value`, args)).rows[0].value;
}
async function makeUser(role = 'player') {
  const id = crypto.randomUUID();
  const email = `sheet-${id}@example.test`;
  await q('INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),$3)', [id, email, JSON.stringify({ role })]);
  await q('INSERT INTO public.profiles(id,role,display_name,height_cm,weight_kg,positions) VALUES($1,$2,$3,170,68.5,ARRAY[\'AM\',\'W\']) ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,display_name=EXCLUDED.display_name,height_cm=170,weight_kg=68.5,positions=EXCLUDED.positions', [id, role, `Sheet ${role}`]);
  const user = { id, email };
  if (role === 'coach') await rpc(user, 'public_beta_set_my_date_of_birth', ['1990-01-01']);
  else if (role === 'player') await rpc(user, 'player_set_initial_age', ['2000-01-01', 'PT']);
  if (role !== 'guardian') {
    const status = await rpc(user, 'public_beta_get_my_consent_status');
    await rpc(user, 'public_beta_accept_required_consents', [JSON.stringify(Object.fromEntries(status.documents.map(d => [d.documentType, d.documentVersion])))]);
  }
  return user;
}

await q('BEGIN');
try {
  const coach = await makeUser('coach');
  const outsider = await makeUser('coach');
  const player = await makeUser();
  const guardian = await makeUser('guardian');
  const team = (await q("INSERT INTO public.teams(name,invite_code,created_by) VALUES('Guardian sheet test',$1,$2) RETURNING id", [crypto.randomUUID().slice(0, 8), coach.id])).rows[0];
  await q("INSERT INTO public.team_memberships(team_id,user_id,role,status) VALUES($1,$2,'player','active')", [team.id, player.id]);
  const sheet = async (actor = coach) => (await asUser(actor, 'SELECT * FROM public.coach_get_guardian_sheet($1)', [team.id])).rows;

  let rows = await sheet();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].contacts, []);
  assert.deepEqual(rows[0].positions, ['AM', 'W']);
  assert.equal(Number(rows[0].height_cm), 170);
  await assert.rejects(() => sheet(outsider), { code: '42501' });
  await assert.rejects(() => sheet(player), { code: '42501' });
  assert.equal((await q("SELECT has_function_privilege('anon','public.coach_get_guardian_sheet(uuid)','EXECUTE') AS allowed")).rows[0].allowed, false);
  console.log('PASS team isolation, anonymous denial, real player fields and empty connections');

  const invitation = await rpc(coach, 'guardian_create_invitation', [player.id, guardian.email, 'Test Guardian', 'parent', false, 'coach_initiated', team.id]);
  rows = await sheet();
  assert.equal(rows[0].contacts.length, 1);
  assert.equal(rows[0].contacts[0].email, guardian.email);
  assert.equal(rows[0].contacts[0].canManage, true);
  assert.equal(rows[0].contacts[0].canResend, false);
  const raw = JSON.stringify(rows);
  for (const privateField of ['token_hash', 'date_of_birth', 'verification_status', 'consent_status', invitation.token]) assert.equal(raw.includes(privateField), false);
  await q("UPDATE public.guardian_invitations SET created_at=now()-interval '9 days',expires_at=now()-interval '1 day',last_sent_at=now()-interval '2 days' WHERE id=$1", [invitation.invitationId]);
  rows = await sheet();
  assert.equal(rows[0].contacts[0].status, 'expired');
  assert.equal(rows[0].contacts[0].canResend, true);
  await rpc(coach, 'guardian_resend_invitation', [invitation.invitationId]);
  assert.equal((await sheet())[0].contacts[0].status, 'sent');
  await rpc(coach, 'guardian_cancel_invitation', [invitation.invitationId]);
  assert.equal((await sheet())[0].contacts[0].status, 'cancelled');
  assert.equal((await sheet())[0].contacts[0].canManage, false);
  console.log('PASS invitation expiry, resend/cooldown, cancellation and private-field exclusion');

  const ownInvite = await rpc(player, 'guardian_create_invitation', [player.id, `other-${guardian.email}`, 'Other Guardian', 'parent', true, null, null]);
  const otherContact = (await sheet())[0].contacts.find(c => c.id === ownInvite.invitationId);
  assert.equal(otherContact.canManage, false);
  assert.match(otherContact.email, /\*\*\*/);

  // A linked invitation must not appear as a duplicate contact.
  await q("INSERT INTO public.guardian_profiles(user_id,display_name) VALUES($1,'Connected Guardian') ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name", [guardian.id]);
  const relation = (await q("INSERT INTO public.guardian_player_relationships(guardian_user_id,player_user_id,relationship_type,is_primary,status,metadata) VALUES($1,$2,'parent',true,'active',$3) RETURNING id", [guardian.id, player.id, JSON.stringify({ invitationId: invitation.invitationId })])).rows[0];
  rows = await sheet();
  assert.equal(rows[0].contacts.length, 2);
  const connected = rows[0].contacts.find(c => c.id === relation.id);
  assert.equal(connected.status, 'active');
  assert.equal(connected.isPrimary, true);
  assert.match(connected.email, /\*\*\*/);
  await q("UPDATE public.guardian_player_relationships SET status='revoked' WHERE id=$1", [relation.id]);
  assert.equal((await sheet())[0].contacts.find(c => c.id === relation.id).status, 'revoked');
  console.log('PASS multiple guardians, primary role, masked account emails, no duplicate accepted invite, revoked state');

  await q("UPDATE public.player_age_identities SET account_state='relationship_revoked' WHERE player_user_id=$1", [player.id]);
  // Missing required consent removes sporting metrics without hiding operational linking status.
  await q("UPDATE public.beta_required_documents SET document_version=document_version||'-sheet-test' WHERE document_type='terms_of_use'");
  // Coach accepts the changed version; player has not.
  const status = await rpc(coach, 'public_beta_get_my_consent_status');
  await rpc(coach, 'public_beta_accept_required_consents', [JSON.stringify(Object.fromEntries(status.documents.map(d => [d.documentType, d.documentVersion])))]);
  rows = await sheet();
  assert.equal(rows[0].height_cm, null);
  assert.equal(rows[0].weight_kg, null);
  assert.equal(rows[0].account_state, 'relationship_revoked');
  assert.equal(rows[0].contacts.length, 2);
  await q("UPDATE public.team_memberships SET status='removed' WHERE team_id=$1 AND user_id=$2", [team.id, player.id]);
  assert.equal((await sheet()).length, 0);
  console.log('PASS subject-consent gate and removed team member exclusion');
} finally {
  await q('ROLLBACK');
  await db.end();
}
