// Real PostgreSQL regression suite, using synthetic Auth rows and transaction-local JWT claims.
// Run only against the disposable, loopback-only database described in docs/launch/country-beta-status.md.
import assert from 'node:assert/strict';
import { Client } from 'pg';
const admin = new Client({ host: '127.0.0.1', port: 55432, user: 'postgres', database: 'lodario_country_test' });
await admin.connect();
const q = (sql, params) => admin.query(sql, params);
let checks = 0;
async function asUser(user, sql, params = []) {
  await q('BEGIN');
  try {
    await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user.id, role: 'authenticated', iat: Math.floor(Date.now()/1000) })]);
    const result = await q(sql, params);
    await q('COMMIT');
    return result;
  } catch (error) { await q('ROLLBACK'); throw error; }
}
async function rpc(user, name, args = []) {
  return (await asUser(user, `SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS value`, args)).rows[0].value;
}
async function user(role='player') {
  const id=crypto.randomUUID(); const email=`synthetic-${id}@example.test`;
  await q("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),$3)", [id,email,JSON.stringify({role})]);
  await q('INSERT INTO public.profiles(id,role) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role',[id,role]);
  return {id,email,role};
}
const dob=(years, plusDays=0)=> { const d=new Date(); return new Date(Date.UTC(d.getUTCFullYear()-years,d.getUTCMonth(),d.getUTCDate()+plusDays)).toISOString().slice(0,10); };
async function consent(account) {
  const status=await rpc(account,'public_beta_get_my_consent_status');
  return rpc(account,'public_beta_accept_required_consents',[JSON.stringify(Object.fromEntries(status.documents.map(d=>[d.documentType,d.documentVersion])))]);
}
async function allowed(account) { return (await rpc(account,'public_beta_get_my_access_status')).eligible; }
async function writeLog(account) { return asUser(account,"INSERT INTO public.training_logs(user_id,date,session_type,duration,intensity,sprinting) VALUES($1,current_date,'Synthetic test',30,5,'low') RETURNING id",[account.id]); }
async function deny(action) { await assert.rejects(action, error=>['42501','P0001','23503','23505','22023'].includes(error.code)); }
function pass(message) { checks++; console.log('PASS '+message); }

try {
  const missing=await user();
  assert.equal(await allowed(missing), false);
  await deny(()=>writeLog(missing));
  await deny(()=>rpc(missing,'public_beta_set_my_date_of_birth',[dob(20)]));
  pass('Missing country/age identity and legacy DOB-only bypass fail closed');

  for(const [country,age,restricted] of [['PT',12,true],['PT',13,false],['FR',14,true],['FR',15,false],['DE',15,true],['DE',16,false]]) {
    const account=await user();
    const state=await rpc(account,'player_set_initial_age',[dob(age),country]);
    assert.equal(state.restricted,restricted,`${country}/${age}`);
    if(restricted) { await deny(()=>consent(account)); await deny(()=>writeLog(account)); }
    else { assert.equal(await allowed(account),false); await consent(account); assert.equal(await allowed(account),true); await writeLog(account); }
  }
  pass('Country threshold boundaries allow self-consenting minors and restrict younger Players');

  const child=await user(); const guardian=await user('guardian'); const wrongGuardian=await user('guardian');
  await rpc(child,'player_set_initial_age',[dob(12),'PT']);
  const invitation=await rpc(child,'guardian_create_invitation',[child.id,guardian.email,'Synthetic Guardian','parent',true,null,null]);
  await deny(()=>rpc(wrongGuardian,'guardian_accept_invitation',[invitation.token,'Wrong Guardian',true,'en']));
  const acceptance=await rpc(guardian,'guardian_accept_invitation',[invitation.token,'Synthetic Guardian',true,'en']);
  assert.equal(acceptance.requiresApproval,true);
  await deny(()=>consent(child));
  await deny(()=>writeLog(child));
  const childDocuments=await rpc(guardian,'guardian_get_player_consent_status',[child.id]);
  const versions=Object.fromEntries(childDocuments.documents.map(d=>[d.documentType,d.documentVersion]));
  await deny(()=>rpc(wrongGuardian,'guardian_accept_player_documents',[child.id,JSON.stringify(versions)]));
  await deny(()=>rpc(guardian,'guardian_accept_player_documents',[child.id,JSON.stringify({...versions,terms_of_use:'outdated'})]));
  await rpc(guardian,'guardian_accept_player_documents',[child.id,JSON.stringify(versions)]);
  assert.equal(await allowed(child),false);
  await rpc(guardian,'guardian_decide_player_account',[invitation.invitationId,true,'{}']);
  assert.equal(await allowed(child),true);
  await writeLog(child);
  pass('Verified email-bound Guardian acceptance plus exact document versions unlocks the child');

  await q("UPDATE public.beta_required_documents SET document_version=document_version||'-revision' WHERE document_type='terms_of_use'");
  assert.equal(await allowed(child),false);
  await deny(()=>writeLog(child));
  const revised=await rpc(guardian,'guardian_get_player_consent_status',[child.id]);
  await rpc(guardian,'guardian_accept_player_documents',[child.id,JSON.stringify(Object.fromEntries(revised.documents.map(d=>[d.documentType,d.documentVersion])))]);
  assert.equal(await allowed(child),true);
  await rpc(child,'revoke_guardian_relationship',[acceptance.relationshipId,'Synthetic revocation']);
  assert.equal(await allowed(child),false);
  await deny(()=>writeLog(child));
  pass('Document changes and Guardian revocation remove child access immediately');

  const fallback=await user();
  const fallbackState=await rpc(fallback,'player_set_initial_age',[dob(15),'NZ']);
  assert.equal(fallbackState.fallbackUsed,true); assert.equal(fallbackState.restricted,false);
  assert.equal(await allowed(fallback),false);
  await rpc(fallback,'guardian_create_invitation',[fallback.id,guardian.email,'Synthetic Guardian','parent',true,null,null]);
  await consent(fallback); assert.equal(await allowed(fallback),true); await writeLog(fallback);
  pass('Fallback ages 13–17 can use the app after inviting a Guardian while approval is pending');

  const coach=await user('coach');
  await rpc(coach,'public_beta_set_my_date_of_birth',[dob(30)]); await consent(coach);
  const team=(await asUser(coach,"INSERT INTO public.teams(name,invite_code,created_by) VALUES('Synthetic team','TESTC123',$1) RETURNING id",[coach.id])).rows[0];
  await asUser(coach,"INSERT INTO public.team_memberships(team_id,user_id,role,status) VALUES($1,$2,'coach','active')",[team.id,coach.id]);
  await rpc(fallback,'join_team_by_invite_code',['TESTC123']);
  assert.equal((await asUser(coach,'SELECT count(*)::integer AS n FROM public.training_logs WHERE user_id=$1',[fallback.id])).rows[0].n,1);
  const stranger=await user(); await rpc(stranger,'player_set_initial_age',[dob(20),'PT']); await consent(stranger);
  assert.equal((await asUser(stranger,'SELECT count(*)::integer AS n FROM public.training_logs WHERE user_id=$1',[fallback.id])).rows[0].n,0);
  await deny(()=>rpc(child,'join_team_by_invite_code',['TESTC123']));
  await deny(()=>rpc(coach,'public_beta_delete_my_account',['DELETE MY LODARIO ACCOUNT',crypto.randomUUID()]));
  pass('Eligible minors can join teams; restricted Players and unrelated users remain denied; Coach deletion protects members');

  const today=new Date().toISOString().slice(0,10); const group='synthetic-'+crypto.randomUUID();
  await asUser(coach,`INSERT INTO public.calendar_events(user_id,event_type_id,title,start_time,end_time,recurrence,recurrence_config)
    VALUES($1,'training','Synthetic team event',$2,$3,'none',$4)`,[fallback.id,today+'T18:00',today+'T19:00',JSON.stringify({meta:{coachManaged:true,coachId:coach.id,published:true,kind:'event',teamId:team.id,eventGroupId:group,assignmentScope:'team'}})]);
  const rsvp=await asUser(fallback,'SELECT * FROM public.set_my_calendar_event_rsvp($1,$2,$3,$4)',[team.id,group,today,'going']);
  assert.equal(rsvp.rows[0].rsvp_status,'going');
  const attendance=await asUser(coach,'SELECT * FROM public.set_calendar_event_attendance($1,$2,$3,$4,$5)',[team.id,group,today,fallback.id,'did']);
  assert.equal(attendance.rows[0].attendance_status,'did');
  await deny(()=>rpc(stranger,'set_calendar_event_attendance',[team.id,group,today,fallback.id,'did_not']));
  pass('Minor RSVP and Coach attendance persist; unrelated users cannot record attendance');

  await deny(()=>asUser(fallback,'SELECT * FROM public.ai_usage'));
  await deny(()=>rpc(fallback,'reserve_player_ai_message',[fallback.id,'free',10,10]));
  await q('BEGIN');
  await q("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:fallback.id,role:'service_role'})]);
  await q('INSERT INTO public.ai_free_message_credits(user_id,lifetime_free_used,rewarded_ad_credits) VALUES($1,10,2)',[fallback.id]);
  const reserved=(await q("SELECT * FROM public.reserve_player_ai_message($1,'free',10,10)",[fallback.id])).rows[0];
  assert.equal(reserved.allowed,true); assert.equal(reserved.rewarded_ad_credits,1);
  await q('ROLLBACK');
  pass('Deferred AI remains inaccessible; rewarded-credit database ambiguity is fixed');

  const correction=await rpc(fallback,'player_request_dob_correction',[dob(12),'Synthetic date correction for integration test']);
  await deny(()=>rpc(stranger,'review_player_dob_correction',[correction,true,'Synthetic admin decision']));
  await q("SELECT public.review_player_dob_correction($1,true,'Synthetic verified correction')",[correction]);
  assert.equal(await allowed(fallback),false);
  assert.equal((await q('SELECT date_of_birth::text FROM public.profiles WHERE id=$1',[fallback.id])).rows[0].date_of_birth,dob(12));
  pass('Support-only DOB correction executes and re-evaluates access and the stored profile');
  assert.equal((await asUser(coach,'SELECT count(*)::integer AS n FROM public.training_logs WHERE user_id=$1',[fallback.id])).rows[0].n,0);
  assert.equal((await asUser(coach,'SELECT count(*)::integer AS n FROM public.profiles WHERE id=$1',[fallback.id])).rows[0].n,0);
  assert.equal((await asUser(coach,'SELECT * FROM public.get_team_players($1)',[team.id])).rows.length,0);
  await deny(()=>asUser(coach,'SELECT * FROM public.set_calendar_event_attendance($1,$2,$3,$4,$5)',[team.id,group,today,fallback.id,'did_not']));
  pass('Coach access to subject health/profile/roster/attendance closes when the Player loses eligibility');

  const exported=await rpc(child,'public_beta_export_my_data',[crypto.randomUUID()]);
  assert.equal(exported.account.userId,child.id); assert.ok(Array.isArray(exported.guardianDocumentAcceptances));
  const deletion=await rpc(stranger,'public_beta_delete_my_account',['DELETE MY LODARIO ACCOUNT',crypto.randomUUID()]);
  assert.equal(deletion.deleted,true);
  pass('Owner export remains available while restricted and self-deletion succeeds');

  await q('BEGIN');
  await q('SET LOCAL ROLE anon');
  await assert.rejects(()=>q('SELECT public.public_beta_get_my_access_status()'),error=>error.code==='42501');
  await q('ROLLBACK');
  assert.equal((await q('SELECT 1 AS healthy')).rows[0].healthy,1);
  pass('Anonymous RPC execution is denied without crashing PostgreSQL');
  console.log(`PASS ${checks} country/Guardian PostgreSQL integration groups`);
} finally { await admin.end(); }
