// Synthetic fixtures only. Fixed disposable loopback database, transaction rollback,
// real FK/trigger execution, and a limited Auth-style DB role. Never sends email.
import assert from 'node:assert/strict';
import { Client } from 'pg';

const db = new Client({ host: '127.0.0.1', port: 55432, user: 'postgres', database: 'lodario_country_test', connectionTimeoutMillis: 5000 });
await db.connect();
const q = (sql, args = []) => db.query(sql, args);
const one = async (sql, args = []) => (await q(sql, args)).rows[0];
const count = async (table, column, value) => Number((await one(`SELECT count(*) AS n FROM public.${table} WHERE ${column}=$1`, [value])).n);
const dob = years => `${new Date().getUTCFullYear() - years}-01-01`;

async function asUser(user, sql, args = [], claims = {}) {
  await q('SAVEPOINT acting_user');
  try {
    await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user.id, role: 'authenticated', iat: Math.floor(Date.now() / 1000), ...claims })]);
    const result = await q(sql, args);
    await q('RESET ROLE');
    await q("SELECT set_config('request.jwt.claims','{}',true)");
    await q('RELEASE SAVEPOINT acting_user');
    return result;
  } catch (error) { await q('ROLLBACK TO SAVEPOINT acting_user'); throw error; }
}
async function rpc(user, name, args = [], claims = {}) {
  return (await asUser(user, `SELECT public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS value`, args, claims)).rows[0].value;
}
async function makeUser(role = 'player', age = 25) {
  const id = crypto.randomUUID(); const email = `delete-${id}@example.test`;
  await q('INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),$3)', [id, email, JSON.stringify({ role })]);
  await q('INSERT INTO public.profiles(id,role,display_name) VALUES($1,$2,\'Synthetic deletion fixture\') ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role', [id, role]);
  const user = { id, email };
  await q('INSERT INTO public.user_account_roles(user_id,role) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, role]);
  if (role === 'player') await rpc(user, 'player_set_initial_age', [dob(age), 'PT']);
  if (role === 'coach') await rpc(user, 'public_beta_set_my_date_of_birth', [dob(age)]);
  if (role !== 'guardian' && age >= 18) {
    const status = await rpc(user, 'public_beta_get_my_consent_status');
    await rpc(user, 'public_beta_accept_required_consents', [JSON.stringify(Object.fromEntries(status.documents.map(d => [d.documentType, d.documentVersion])))]);
  }
  if (role === 'guardian') {
    await q('INSERT INTO public.guardian_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
    await q('INSERT INTO public.guardian_notification_preferences(guardian_user_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
  }
  return user;
}
async function team(owner, members = []) {
  const row = await one("INSERT INTO public.teams(name,invite_code,created_by) VALUES('Deletion fixture',$1,$2) RETURNING id", [crypto.randomUUID(), owner.id]);
  for (const [user, role] of [[owner, 'coach'], ...members]) await q('INSERT INTO public.team_memberships(team_id,user_id,role) VALUES($1,$2,$3)', [row.id, user.id, role]);
  return row;
}
async function relation(guardian, player, primary = true) {
  const row = await one("INSERT INTO public.guardian_player_relationships(guardian_user_id,player_user_id,relationship_type,is_primary,status,verification_status,consent_status,created_by) VALUES($1,$2,'parent',$3,'active','verified','granted',$1) RETURNING id", [guardian.id, player.id, primary]);
  await q("INSERT INTO public.guardian_relationship_permissions(relationship_id,permission_key,state,controlled_by) VALUES($1,'calendar','allowed','platform')", [row.id]);
  await q("INSERT INTO public.guardian_consent_history(guardian_user_id,player_user_id,relationship_id,decision,consent_category,text_version,policy_version,verification_method) VALUES($1,$2,$3,'granted','required_account_approval','test','test','test')", [guardian.id, player.id, row.id]);
  await q('INSERT INTO public.guardian_document_acceptances(guardian_user_id,player_user_id,relationship_id,document_type,document_version) SELECT $1,$2,$3,document_type,document_version FROM public.beta_required_documents', [guardian.id, player.id, row.id]);
  await q("UPDATE public.player_age_identities SET account_state='active' WHERE player_user_id=$1", [player.id]);
  return row;
}
async function invitation(player, guardian, author, intended = guardian.id, email = guardian.email) {
  return one("INSERT INTO public.guardian_invitations(player_user_id,guardian_email,guardian_name,intended_guardian_user_id,relationship_type,invitation_type,player_age_policy_category,permission_template_key,token_hash,token_hint,expires_at,created_by,policy_version) VALUES($1,$2,'Synthetic guardian',$3,'parent','minor_overview','minor','minor_overview',extensions.gen_random_bytes(32),'test',now()+interval '7 days',$4,'test') RETURNING id", [player.id, email, intended, author.id]);
}
async function coreData(user, coach = user) {
  const id = user.id;
  await q("INSERT INTO public.wellness_logs(user_id,date,sleep_time,wake_time,sleep_duration,sleep_quality,energy,fatigue,stress) VALUES($1,current_date,'22:00','06:00',8,7,7,3,3)", [id]);
  await q("INSERT INTO public.training_logs(user_id,date,session_type,duration,intensity) VALUES($1,current_date,'test',30,5)", [id]);
  await q("INSERT INTO public.injuries(user_id,description) VALUES($1,'Synthetic fixture')", [id]);
  await q("INSERT INTO public.custom_event_types(id,user_id,name,color) VALUES($1,$2,'Fixture','#ffffff')", [crypto.randomUUID(), id]);
  const event = await one("INSERT INTO public.calendar_events(user_id,event_type_id,title,start_time,end_time,recurrence_config) VALUES($1,'training','Shared scheduled event','2026-09-16T18:00','2026-09-16T19:00',$2) RETURNING id", [id, JSON.stringify({ meta: { coachManaged: true, coachId: coach.id } })]);
  await q("INSERT INTO public.player_calendar_event_color_overrides(user_id,scope,event_id,color) VALUES($1,'event',$2,'#ffffff')", [id, event.id]);
  for (const table of ['ai_conversations', 'ai_entitlements', 'ai_free_message_credits', 'ai_rewarded_ad_grants']) await q(`INSERT INTO public.${table}(user_id) VALUES($1)`, [id]);
  await q("INSERT INTO public.ai_messages(user_id,conversation_id,role,content) SELECT $1,id,'user','Synthetic fixture' FROM public.ai_conversations WHERE user_id=$1", [id]);
  await q("INSERT INTO public.ai_usage(user_id,model_used) VALUES($1,'test')", [id]);
  await q("INSERT INTO public.ai_usage_reservations(user_id,tier) VALUES($1,'free')", [id]);
  await q('INSERT INTO public.player_billing_summaries(player_user_id) VALUES($1)', [id]);
  return event;
}
async function authDelete(users) {
  await q('SET LOCAL ROLE lodario_auth_delete_test');
  await q('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [users.map(user => user.id)]);
  await q('RESET ROLE');
}
async function noUserReferences(user) {
  const refs = (await q(`SELECT c.conrelid::regclass::text AS table_name,a.attname AS column_name
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='auth.users'::regclass AND n.nspname='public'`)).rows;
  for (const ref of refs) assert.equal(Number((await one(`SELECT count(*) AS n FROM public.${ref.table_name} WHERE ${ref.column_name}=$1`, [user.id])).n), 0, `${ref.table_name}.${ref.column_name} retained deleted user`);
  assert.equal((await q('SELECT id FROM auth.users WHERE id=$1', [user.id])).rowCount, 0);
}
async function scenario(name, run) {
  await q('SAVEPOINT scenario');
  try { await run(); console.log('PASS ' + name); }
  finally { await q('ROLLBACK TO SAVEPOINT scenario'); }
}

await q('BEGIN');
try {
  await q('CREATE ROLE lodario_auth_delete_test NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await q('GRANT USAGE ON SCHEMA auth TO lodario_auth_delete_test');
  await q('GRANT SELECT, DELETE ON auth.users TO lodario_auth_delete_test');

  await scenario('catalog: every public auth FK cascades or safely nulls; helpers are not client-callable', async () => {
    const bad = (await q(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE c.contype='f' AND c.confrelid='auth.users'::regclass AND n.nspname='public'
      AND (c.confdeltype NOT IN ('c','n') OR (c.confdeltype='n' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) AND a.attnotnull)))`)).rows;
    assert.deepEqual(bad, []);
    for (const fn of ['cleanup_auth_user_email_records()', 'handle_deleted_guardian_relationship()']) {
      for (const role of ['anon', 'authenticated']) assert.equal((await one('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed', [role, `public.${fn}`])).allowed, false);
    }
  });

  await scenario('Auth-style Player deletion clears personal/AI/consent records and preserves sibling, Guardian and team', async () => {
    const coach = await makeUser('coach'); const guardian = await makeUser('guardian');
    const player = await makeUser(); const sibling = await makeUser();
    const t = await team(coach, [[player, 'player'], [sibling, 'player']]);
    await coreData(player); await coreData(sibling);
    const deletedLink = await relation(guardian, player); const keptLink = await relation(guardian, sibling, false);
    await invitation(player, guardian, coach);
    for (const u of [player, sibling]) {
      await q("INSERT INTO public.event_attendance(team_id,event_group_id,event_date,player_id) VALUES($1,'fixture',current_date,$2)", [t.id, u.id]);
      await q("INSERT INTO public.calendar_event_attendance(team_id,event_group_id,occurrence_date,player_id,attendance_recorded_by) VALUES($1,'fixture',current_date,$2,$3)", [t.id, u.id, coach.id]);
    }
    const request = await one("INSERT INTO public.guardian_privacy_requests(requesting_user_id,requester_role,request_type) VALUES($1,'player','data_export') RETURNING id", [player.id]);
    await q('INSERT INTO public.guardian_privacy_request_internal(request_id) VALUES($1)', [request.id]);
    await q("INSERT INTO public.player_date_of_birth_corrections(player_user_id,original_date_of_birth,requested_date_of_birth,reason,category_change) VALUES($1,'2000-01-01','2000-01-02','Synthetic fixture correction',false)", [player.id]);
    await q("INSERT INTO public.beta_waitlist(name,email,role) VALUES('Fixture',$1,'Player')", [player.email]);
    await q("INSERT INTO public.guardian_age_transitions(player_user_id,transition_type,due_at,policy_version) VALUES($1,'reached_adult',now(),'test')", [player.id]);
    await q("INSERT INTO public.player_policy_notifications(player_user_id,notification_type,title,message) VALUES($1,'age_transition','Fixture','Fixture')", [player.id]);
    await authDelete([player]); await noUserReferences(player);
    assert.equal(await count('guardian_relationship_permissions', 'relationship_id', deletedLink.id), 0);
    assert.equal(await count('guardian_privacy_request_internal', 'request_id', request.id), 0);
    assert.equal(await count('beta_waitlist', 'email', player.email), 0);
    assert.equal(await count('guardian_relationship_permissions', 'relationship_id', keptLink.id), 1);
    assert.equal(await count('guardian_consent_history', 'player_user_id', sibling.id), 1);
    assert.equal(await count('training_logs', 'user_id', sibling.id), 1);
    assert.equal(await count('calendar_event_attendance', 'player_id', sibling.id), 1);
    assert.equal(await count('teams', 'id', t.id), 1);
    assert.equal(await count('guardian_profiles', 'user_id', guardian.id), 1);
  });

  await scenario('Guardian deletion invalidates email/ID invitations, removes access, and preserves another Guardian', async () => {
    const guardian = await makeUser('guardian'); const other = await makeUser('guardian');
    const child = await makeUser('player', 12); const sibling = await makeUser('player', 12);
    await coreData(child); await relation(guardian, child); await relation(guardian, sibling); await relation(other, sibling, false);
    await invitation(child, guardian, child);
    await invitation(sibling, guardian, sibling, guardian.id, `old-${guardian.email}`);
    const emailOnly = await invitation(sibling, guardian, sibling, null);
    const keptInvite = await invitation(sibling, other, sibling);
    await q("INSERT INTO public.guardian_verification_records(guardian_user_id,method,status,policy_version) VALUES($1,'verified_email','verified','test')", [guardian.id]);
    const update = await one("INSERT INTO public.guardian_updates(guardian_user_id,update_type,title,message,related_player_id) VALUES($1,'team_announcement','Fixture','Fixture',$2) RETURNING id", [guardian.id, child.id]);
    await q('INSERT INTO public.guardian_acknowledgements(update_id,guardian_user_id) VALUES($1,$2)', [update.id, guardian.id]);
    assert.equal((await one('SELECT public.public_beta_user_age_eligible($1) AS allowed', [child.id])).allowed, true);
    await authDelete([guardian]); await noUserReferences(guardian);
    assert.equal(await count('guardian_invitations', 'id', emailOnly.id), 0);
    assert.equal(await count('guardian_invitations', 'id', keptInvite.id), 1);
    assert.equal(await count('guardian_acknowledgements', 'update_id', update.id), 0);
    assert.equal((await one('SELECT account_state FROM public.player_age_identities WHERE player_user_id=$1', [child.id])).account_state, 'relationship_revoked');
    assert.equal((await one('SELECT public.public_beta_user_age_eligible($1) AS allowed', [child.id])).allowed, false);
    assert.equal((await one('SELECT public.public_beta_user_age_eligible($1) AS allowed', [sibling.id])).allowed, true);
    assert.equal(await count('training_logs', 'user_id', child.id), 1);
    assert.equal(await count('guardian_consent_history', 'guardian_user_id', other.id), 1);
  });

  await scenario('Coach deletion preserves team, schedules, attendance and invitations; null authors fail closed', async () => {
    const owner = await makeUser('coach'); const colleague = await makeUser('coach'); const stranger = await makeUser('coach');
    const player = await makeUser(); const guardian = await makeUser('guardian');
    const t = await team(owner, [[colleague, 'coach'], [player, 'player']]);
    const event = await coreData(player, owner);
    const invite = await rpc(owner, 'guardian_create_invitation', [player.id, guardian.email, 'Fixture', 'parent', false, 'coach_initiated', t.id]);
    await q("UPDATE public.guardian_invitations SET last_sent_at=now()-interval '2 minutes' WHERE id=$1", [invite.invitationId]);
    await q("INSERT INTO public.calendar_event_attendance(team_id,event_group_id,occurrence_date,player_id,attendance_recorded_by,attendance_status) VALUES($1,'fixture',current_date,$2,$3,'did')", [t.id, player.id, owner.id]);
    const update = await one("INSERT INTO public.guardian_updates(guardian_user_id,update_type,title,message,created_by,related_team_id) VALUES($1,'team_announcement','Fixture','Shared news',$2,$3) RETURNING id", [guardian.id, owner.id, t.id]);
    await authDelete([owner]); await noUserReferences(owner);
    assert.equal((await one('SELECT created_by FROM public.teams WHERE id=$1', [t.id])).created_by, null);
    assert.equal(await count('team_memberships', 'team_id', t.id), 2);
    assert.equal(await count('calendar_events', 'id', event.id), 1);
    assert.equal((await one('SELECT attendance_recorded_by,attendance_status FROM public.calendar_event_attendance WHERE player_id=$1', [player.id])).attendance_recorded_by, null);
    assert.equal((await one('SELECT created_by FROM public.guardian_updates WHERE id=$1', [update.id])).created_by, null);
    assert.equal((await one('SELECT created_by FROM public.guardian_invitations WHERE id=$1', [invite.invitationId])).created_by, null);
    assert.equal(await rpc(colleague, 'can_manage_team', [t.id, colleague.id]), true);
    await asUser(colleague, "UPDATE public.teams SET name='Managed by surviving coach' WHERE id=$1", [t.id]);
    await assert.rejects(() => rpc(stranger, 'guardian_resend_invitation', [invite.invitationId]), { code: '42501' });
    await assert.rejects(() => rpc(stranger, 'guardian_cancel_invitation', [invite.invitationId]), { code: '42501' });
    await rpc(colleague, 'guardian_resend_invitation', [invite.invitationId]);
    await rpc(colleague, 'guardian_cancel_invitation', [invite.invitationId]);
  });

  await scenario('self-service restricted deletion works; confirmation, recency, team and normal write guards remain', async () => {
    const child = await makeUser('player', 12); await coreData(child);
    await assert.rejects(() => rpc(child, 'public_beta_delete_my_account', ['WRONG', crypto.randomUUID()]), { code: '22023' });
    await assert.rejects(() => rpc(child, 'public_beta_delete_my_account', ['DELETE MY LODARIO ACCOUNT', crypto.randomUUID()], { iat: 1 }), { code: '42501' });
    await assert.rejects(() => asUser(child, "INSERT INTO public.training_logs(user_id,date,session_type,duration,intensity) VALUES($1,current_date,'blocked',30,5)", [child.id]));
    await asUser(child, "SELECT set_config('lodario.public_beta_self_delete_user_id',$1,true)", [child.id]);
    await asUser(child, 'DELETE FROM public.training_logs WHERE user_id=$1', [child.id]);
    assert.equal(await count('training_logs', 'user_id', child.id), 1);
    assert.deepEqual(await rpc(child, 'public_beta_delete_my_account', ['DELETE MY LODARIO ACCOUNT', crypto.randomUUID()]), { deleted: true });
    await noUserReferences(child);
    const owner = await makeUser('coach'); const player = await makeUser();
    await team(owner, [[player, 'player']]);
    await assert.rejects(() => rpc(owner, 'public_beta_delete_my_account', ['DELETE MY LODARIO ACCOUNT', crypto.randomUUID()]), { code: '23503' });
    const loneCoach = await makeUser('coach'); const emptyTeam = await team(loneCoach);
    assert.deepEqual(await rpc(loneCoach, 'public_beta_delete_my_account', ['DELETE MY LODARIO ACCOUNT', crypto.randomUUID()]), { deleted: true });
    assert.equal((await one('SELECT created_by FROM public.teams WHERE id=$1', [emptyTeam.id])).created_by, null);
  });

  await scenario('optional attribution detaches without deleting surviving users records or audit history', async () => {
    const deleted = await makeUser('guardian'); const player = await makeUser(); const survivor = await makeUser('guardian');
    const r = await relation(survivor, player);
    await q('UPDATE public.guardian_player_relationships SET created_by=$1 WHERE id=$2', [deleted.id, r.id]);
    await q('UPDATE public.user_account_roles SET granted_by=$1 WHERE user_id=$2', [deleted.id, player.id]);
    const correction = await one("INSERT INTO public.player_date_of_birth_corrections(player_user_id,original_date_of_birth,requested_date_of_birth,reason,category_change,guardian_confirmed_by,reviewed_by) VALUES($1,'2000-01-01','2000-01-02','Synthetic fixture correction',false,$2,$2) RETURNING id", [player.id, deleted.id]);
    const request = await one("INSERT INTO public.guardian_privacy_requests(requesting_user_id,requester_role,request_type,related_player_id) VALUES($1,'guardian','relationship_removal',$2) RETURNING id", [survivor.id, deleted.id]);
    await q('INSERT INTO public.guardian_privacy_request_internal(request_id,assigned_to) VALUES($1,$2)', [request.id, deleted.id]);
    const audit = await one("INSERT INTO public.guardian_audit_events(actor_user_id,subject_player_id,event_type) VALUES($1,$1,'test') RETURNING id", [deleted.id]);
    const product = await one("INSERT INTO public.guardian_product_events(actor_user_id,event_name) VALUES($1,'age_step_started') RETURNING id", [deleted.id]);
    const operation = await one("INSERT INTO public.beta_operational_events(user_id,event_type,request_id) VALUES($1,'deletion_completed',$2) RETURNING id", [deleted.id, crypto.randomUUID()]);
    await authDelete([deleted]); await noUserReferences(deleted);
    assert.equal((await one('SELECT created_by FROM public.guardian_player_relationships WHERE id=$1', [r.id])).created_by, null);
    assert.equal((await one('SELECT granted_by FROM public.user_account_roles WHERE user_id=$1', [player.id])).granted_by, null);
    assert.deepEqual(await one('SELECT guardian_confirmed_by,reviewed_by FROM public.player_date_of_birth_corrections WHERE id=$1', [correction.id]), { guardian_confirmed_by: null, reviewed_by: null });
    assert.equal((await one('SELECT assigned_to FROM public.guardian_privacy_request_internal WHERE request_id=$1', [request.id])).assigned_to, null);
    assert.equal((await one('SELECT related_player_id FROM public.guardian_privacy_requests WHERE id=$1', [request.id])).related_player_id, null);
    assert.deepEqual(await one('SELECT actor_user_id,subject_player_id FROM public.guardian_audit_events WHERE id=$1', [audit.id]), { actor_user_id: null, subject_player_id: null });
    assert.equal((await one('SELECT actor_user_id FROM public.guardian_product_events WHERE id=$1', [product.id])).actor_user_id, null);
    assert.equal((await one('SELECT user_id FROM public.beta_operational_events WHERE id=$1', [operation.id])).user_id, null);
  });

  await scenario('multi-user and empty Auth accounts delete without cascade-order errors', async () => {
    const guardian = await makeUser('guardian'); const player = await makeUser('player', 12);
    await relation(guardian, player); await coreData(player);
    await authDelete([guardian, player]); await noUserReferences(guardian); await noUserReferences(player);
    const empty = { id: crypto.randomUUID() };
    await q('INSERT INTO auth.users(id) VALUES($1)', [empty.id]);
    await authDelete([empty]); await noUserReferences(empty);
  });
} finally {
  await q('ROLLBACK');
  await db.end();
}
