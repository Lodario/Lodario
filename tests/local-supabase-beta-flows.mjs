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

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateYearsAgo(years, extraDays = 0) {
  const now = new Date();
  const result = new Date(
    Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate() + extraDays),
  );
  return isoDate(result);
}

async function createAccount({ admin, apiUrl, anonKey, role, label, createdUserIds }) {
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `local-beta-flow-${label}-${unique}@example.test`;
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
    .insert({ id: created.user.id, role });
  assert.ifError(profileError);

  const client = makeUserClient(apiUrl, anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signInError);
  createdUserIds.add(created.user.id);

  return { client, id: created.user.id, role };
}

async function setDateOfBirth(account, dateOfBirth) {
  const { data, error } = await account.client.rpc('public_beta_set_my_date_of_birth', {
    p_date_of_birth: dateOfBirth,
  });
  assert.ifError(error);
  return data;
}

async function createTeamForCoach(coach, label) {
  const inviteCode = `B${crypto.randomUUID().replaceAll('-', '').slice(0, 7)}`.toUpperCase();
  const { data: team, error: teamError } = await coach.client
    .from('teams')
    .insert({
      name: `Synthetic local ${label}`,
      invite_code: inviteCode,
      created_by: coach.id,
    })
    .select('id, invite_code')
    .single();
  assert.ifError(teamError);
  assert.ok(team?.id);

  const { error: membershipError } = await coach.client.from('team_memberships').upsert(
    {
      team_id: team.id,
      user_id: coach.id,
      role: 'coach',
      status: 'active',
    },
    { onConflict: 'team_id,user_id' },
  );
  assert.ifError(membershipError);
  return team;
}

async function joinTeam(player, inviteCode) {
  const { data, error } = await player.client.rpc('join_team_by_invite_code', {
    p_invite_code: inviteCode,
  });
  assert.ifError(error);
  assert.equal(data?.[0]?.status, 'joined');
}

async function accountIsDeleted(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  return Boolean(error || !data?.user);
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
  const createdUserIds = new Set();
  let changedDocument = null;

  try {
    const exactAdult = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'player',
      label: 'exact-adult',
      createdUserIds,
    });
    const exactAdultStatus = await setDateOfBirth(exactAdult, dateYearsAgo(18));
    assert.equal(exactAdultStatus.eligible, true);

    const turnsAdultTomorrow = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'player',
      label: 'adult-tomorrow',
      createdUserIds,
    });
    const tomorrowStatus = await setDateOfBirth(turnsAdultTomorrow, dateYearsAgo(18, 1));
    assert.equal(tomorrowStatus.eligible, false);

    const leapDayAdult = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'player',
      label: 'leap-day',
      createdUserIds,
    });
    const leapDayStatus = await setDateOfBirth(leapDayAdult, '2008-02-29');
    assert.equal(leapDayStatus.eligible, true);
    console.log('PASS exact 18th birthday, turns-18-tomorrow, and leap-day DOB boundaries');

    const missingDob = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'player',
      label: 'missing-dob',
      createdUserIds,
    });
    const { error: missingDobWriteError } = await missingDob.client.from('training_logs').insert({
      user_id: missingDob.id,
      date: isoDate(new Date()),
      session_type: 'Synthetic local test',
      duration: 20,
      intensity: 2,
      sprinting: 'none',
      pain_active: false,
      is_injury: false,
    });
    assert.ok(missingDobWriteError);
    console.log('PASS missing-DOB account cannot write stable-core data');

    const player = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'player',
      label: 'core-player',
      createdUserIds,
    });
    await setDateOfBirth(player, '1994-06-15');

    const { data: initialConsent, error: initialConsentError } = await player.client.rpc(
      'public_beta_get_my_consent_status',
    );
    assert.ifError(initialConsentError);
    assert.equal(initialConsent.complete, false);
    assert.ok(initialConsent.documents.length > 0);

    const { error: rejectedConsentError } = await player.client.rpc(
      'public_beta_accept_required_consents',
      { p_acceptances: {} },
    );
    assert.ok(rejectedConsentError);

    const acceptances = Object.fromEntries(
      initialConsent.documents.map((document) => [
        document.documentType,
        document.documentVersion,
      ]),
    );
    const { data: acceptedConsent, error: acceptedConsentError } = await player.client.rpc(
      'public_beta_accept_required_consents',
      { p_acceptances: acceptances },
    );
    assert.ifError(acceptedConsentError);
    assert.equal(acceptedConsent.complete, true);

    const { data: repeatedConsent, error: repeatedConsentError } = await player.client.rpc(
      'public_beta_accept_required_consents',
      { p_acceptances: acceptances },
    );
    assert.ifError(repeatedConsentError);
    assert.equal(repeatedConsent.complete, true);

    const { data: consentRows, error: consentRowsError } = await player.client
      .from('user_consent_acceptances')
      .select('id, document_type, document_version, acceptance_source');
    assert.ifError(consentRowsError);
    assert.equal(consentRows.length, initialConsent.documents.length);

    const { error: mutateConsentError } = await player.client
      .from('user_consent_acceptances')
      .update({ acceptance_source: 'tampered' })
      .eq('id', consentRows[0].id);
    assert.ok(mutateConsentError);

    changedDocument = initialConsent.documents[0];
    const temporaryVersion = `${changedDocument.documentVersion}-local-next`;
    const { error: changeVersionError } = await admin
      .from('beta_required_documents')
      .update({ document_version: temporaryVersion })
      .eq('document_type', changedDocument.documentType);
    assert.ifError(changeVersionError);
    const { data: outdatedConsent, error: outdatedConsentError } = await player.client.rpc(
      'public_beta_get_my_consent_status',
    );
    assert.ifError(outdatedConsentError);
    assert.equal(outdatedConsent.complete, false);
    const { error: restoreVersionError } = await admin
      .from('beta_required_documents')
      .update({ document_version: changedDocument.documentVersion })
      .eq('document_type', changedDocument.documentType);
    assert.ifError(restoreVersionError);
    changedDocument = null;
    console.log('PASS consent rejection, acceptance, repeat idempotency, immutability, and version transition');

    const today = isoDate(new Date());
    const { data: wellness, error: wellnessError } = await player.client
      .from('wellness_logs')
      .insert({
        user_id: player.id,
        date: today,
        sleep_time: '22:30',
        wake_time: '07:00',
        sleep_duration: 8.5,
        sleep_quality: 8,
        energy: 7,
        fatigue: 3,
        stress: 2,
        pain_active: false,
        is_injury: false,
      })
      .select('id')
      .single();
    assert.ifError(wellnessError);

    const { data: training, error: trainingError } = await player.client
      .from('training_logs')
      .insert({
        user_id: player.id,
        date: today,
        session_type: 'Synthetic local test',
        duration: 60,
        intensity: 7,
        sprinting: 'low',
        performance: 7,
        pain_active: false,
        is_injury: false,
      })
      .select('id')
      .single();
    assert.ifError(trainingError);

    const { data: injury, error: injuryError } = await player.client
      .from('injuries')
      .insert({
        user_id: player.id,
        description: 'Synthetic local integration injury',
        status: 'active',
        auto_tracked: false,
        guardian_visible: false,
        professional_attention_suggested: false,
      })
      .select('id')
      .single();
    assert.ifError(injuryError);

    const { data: playerCalendar, error: playerCalendarError } = await player.client
      .from('calendar_events')
      .insert({
        user_id: player.id,
        event_type_id: 'training',
        title: 'Synthetic local player event',
        start_time: `${today}T08:00`,
        end_time: `${today}T09:00`,
        recurrence: 'none',
        recurrence_config: {},
        excluded_dates: [],
        overrides: [],
        guardian_visible: false,
      })
      .select('id')
      .single();
    assert.ifError(playerCalendarError);
    assert.ok(wellness?.id && training?.id && injury?.id && playerCalendar?.id);
    console.log('PASS wellness, training, injury/pain, and Player calendar records use real local tables');

    const { data: exportPayload, error: exportError } = await player.client.rpc(
      'public_beta_export_my_data',
      { p_request_id: crypto.randomUUID() },
    );
    assert.ifError(exportError);
    assert.equal(exportPayload.account.userId, player.id);
    assert.ok(exportPayload.wellnessLogs.some((row) => row.id === wellness.id));
    assert.ok(exportPayload.trainingLogs.some((row) => row.id === training.id));
    assert.ok(exportPayload.injuries.some((row) => row.id === injury.id));
    assert.ok(exportPayload.calendarEvents.some((row) => row.id === playerCalendar.id));
    console.log('PASS owner-scoped Player export includes owned stable-core records');

    const coach = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'coach',
      label: 'coach',
      createdUserIds,
    });
    await setDateOfBirth(coach, '1987-03-12');
    const team = await createTeamForCoach(coach, 'core team');
    await joinTeam(player, team.invite_code);

    const { data: coachPlayerLogs, error: coachPlayerLogsError } = await coach.client
      .from('wellness_logs')
      .select('id')
      .eq('user_id', player.id)
      .eq('id', wellness.id);
    assert.ifError(coachPlayerLogsError);
    assert.equal(coachPlayerLogs.length, 1);

    const outsider = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'player',
      label: 'outsider',
      createdUserIds,
    });
    await setDateOfBirth(outsider, '1992-09-08');
    const { data: outsiderTeams, error: outsiderTeamsError } = await outsider.client
      .from('teams')
      .select('id')
      .eq('id', team.id);
    assert.ifError(outsiderTeamsError);
    assert.deepEqual(outsiderTeams, []);
    const { data: outsiderLogs, error: outsiderLogsError } = await outsider.client
      .from('wellness_logs')
      .select('id')
      .eq('id', wellness.id);
    assert.ifError(outsiderLogsError);
    assert.deepEqual(outsiderLogs, []);
    console.log('PASS team connection grants Coach access while unrelated adults remain private');

    const eventGroupId = `local-${crypto.randomUUID()}`;
    const { data: coachCalendar, error: coachCalendarError } = await coach.client
      .from('calendar_events')
      .insert({
        user_id: player.id,
        event_type_id: 'training',
        title: 'Synthetic local team event',
        start_time: `${today}T18:00`,
        end_time: `${today}T19:00`,
        recurrence: 'none',
        recurrence_config: {
          meta: {
            coachManaged: true,
            coachId: coach.id,
            published: true,
            kind: 'event',
            teamId: team.id,
            eventGroupId,
            assignmentScope: 'team',
          },
        },
        excluded_dates: [],
        overrides: [],
        guardian_visible: false,
      })
      .select('id')
      .single();
    assert.ifError(coachCalendarError);
    assert.ok(coachCalendar?.id);

    const { data: rsvp, error: rsvpError } = await player.client.rpc(
      'set_my_calendar_event_rsvp',
      {
        p_team_id: team.id,
        p_event_group_id: eventGroupId,
        p_occurrence_date: today,
        p_rsvp_status: 'going',
      },
    );
    assert.ifError(rsvpError);
    assert.equal(rsvp?.[0]?.rsvp_status, 'going');

    const { data: attendance, error: attendanceError } = await coach.client.rpc(
      'set_calendar_event_attendance',
      {
        p_team_id: team.id,
        p_event_group_id: eventGroupId,
        p_occurrence_date: today,
        p_player_id: player.id,
        p_attendance_status: 'did',
      },
    );
    assert.ifError(attendanceError);
    assert.equal(attendance?.[0]?.attendance_status, 'did');

    const { data: roster, error: rosterError } = await coach.client.rpc(
      'get_calendar_event_attendance_roster',
      {
        p_team_id: team.id,
        p_event_group_id: eventGroupId,
        p_occurrence_date: today,
      },
    );
    assert.ifError(rosterError);
    assert.ok(roster.some((row) => row.player_id === player.id && row.rsvp_status === 'going'));

    const { error: outsiderRosterError } = await outsider.client.rpc(
      'get_calendar_event_attendance_roster',
      {
        p_team_id: team.id,
        p_event_group_id: eventGroupId,
        p_occurrence_date: today,
      },
    );
    assert.ok(outsiderRosterError);

    const { error: minorJoinError } = await turnsAdultTomorrow.client.rpc(
      'join_team_by_invite_code',
      { p_invite_code: team.invite_code },
    );
    assert.ok(minorJoinError);
    console.log('PASS team calendar, RSVP, attendance, and under-18 join denial');

    const { error: guardianTableError } = await player.client
      .from('guardian_profiles')
      .select('guardian_user_id')
      .limit(1);
    assert.ok(guardianTableError);
    console.log('PASS authenticated beta user cannot directly access Guardian tables');

    const deletePlayer = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'player',
      label: 'delete-player',
      createdUserIds,
    });
    await setDateOfBirth(deletePlayer, '1996-01-10');
    const { data: deletePlayerResult, error: deletePlayerError } = await deletePlayer.client.rpc(
      'public_beta_delete_my_account',
      {
        p_confirmation: 'DELETE MY LODARIO ACCOUNT',
        p_request_id: crypto.randomUUID(),
      },
    );
    assert.ifError(deletePlayerError);
    assert.equal(deletePlayerResult.deleted, true);
    assert.equal(await accountIsDeleted(admin, deletePlayer.id), true);
    createdUserIds.delete(deletePlayer.id);

    const emptyTeamCoach = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'coach',
      label: 'empty-team-coach',
      createdUserIds,
    });
    await setDateOfBirth(emptyTeamCoach, '1985-07-21');
    await createTeamForCoach(emptyTeamCoach, 'empty deletion team');
    const { data: emptyCoachDelete, error: emptyCoachDeleteError } =
      await emptyTeamCoach.client.rpc('public_beta_delete_my_account', {
        p_confirmation: 'DELETE MY LODARIO ACCOUNT',
        p_request_id: crypto.randomUUID(),
      });
    assert.ifError(emptyCoachDeleteError);
    assert.equal(emptyCoachDelete.deleted, true);
    assert.equal(await accountIsDeleted(admin, emptyTeamCoach.id), true);
    createdUserIds.delete(emptyTeamCoach.id);

    const blockedCoach = await createAccount({
      admin,
      apiUrl,
      anonKey,
      role: 'coach',
      label: 'blocked-coach',
      createdUserIds,
    });
    await setDateOfBirth(blockedCoach, '1984-11-19');
    const blockedTeam = await createTeamForCoach(blockedCoach, 'occupied deletion team');
    await joinTeam(outsider, blockedTeam.invite_code);
    const { error: blockedCoachDeleteError } = await blockedCoach.client.rpc(
      'public_beta_delete_my_account',
      {
        p_confirmation: 'DELETE MY LODARIO ACCOUNT',
        p_request_id: crypto.randomUUID(),
      },
    );
    assert.ok(blockedCoachDeleteError);
    assert.equal(await accountIsDeleted(admin, blockedCoach.id), false);
    console.log('PASS Player deletion, empty-team Coach deletion, and occupied-team Coach block');
  } finally {
    if (changedDocument) {
      await admin
        .from('beta_required_documents')
        .update({ document_version: changedDocument.documentVersion })
        .eq('document_type', changedDocument.documentType);
    }

    for (const userId of [...createdUserIds].reverse()) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error && !error.message.toLowerCase().includes('not found')) {
        console.warn('WARN one disposable local user could not be removed');
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
