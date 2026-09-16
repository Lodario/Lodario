'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MailPlus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createGuardianInvitation, manageGuardianInvitation } from '@/lib/guardian/onboarding';

type Contact = {
  id: string;
  kind: 'relationship' | 'invitation';
  name: string;
  email: string | null;
  relationship: string;
  isPrimary: boolean;
  status: string;
  canManage: boolean;
  canResend: boolean;
};

type Player = {
  player_id: string;
  player_name: string;
  age_policy_category: string;
  account_state: string;
  positions: string[] | null;
  height_cm: number | null;
  weight_kg: number | null;
  contacts: Contact[];
};

type Notice = { tone: 'success' | 'warning' | 'error'; message: string };
const pendingStatuses = ['pending', 'sent', 'delivered', 'opened', 'accepted', 'review_required'];
const connectedStatuses = ['active', 'adult_authorised'];
const tones = [
  'from-orange-500/45 to-amber-300/10 text-orange-100',
  'from-sky-500/45 to-cyan-300/10 text-sky-100',
  'from-emerald-500/45 to-lime-300/10 text-emerald-100',
  'from-violet-500/45 to-fuchsia-300/10 text-violet-100',
  'from-rose-500/45 to-orange-300/10 text-rose-100',
];
const inputClass = 'w-full rounded-xl border border-white/10 bg-[var(--surface-card)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent-primary)]';
const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-gray-300 transition-colors hover:border-white/25 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

function humanize(value: string) {
  const text = value.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function StatusBadge({ contact }: { contact: Contact | null }) {
  const status = contact?.status ?? 'not_linked';
  const connected = connectedStatuses.includes(status);
  const pending = pendingStatuses.includes(status);
  const label = connected ? 'Connected'
    : contact?.kind === 'invitation' && ['pending', 'sent', 'delivered', 'opened'].includes(status) ? 'Invitation pending'
    : contact?.kind === 'relationship' && status === 'pending' ? 'Connection pending'
    : humanize(status);
  const tone = connected ? 'bg-emerald-400/10 text-emerald-300'
    : pending ? 'bg-amber-300/10 text-amber-200'
    : ['revoked', 'rejected', 'suspended'].includes(status) ? 'bg-rose-400/10 text-rose-300'
    : 'bg-white/[0.05] text-gray-400';
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs ${tone}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />{label}
  </span>;
}

export function CoachGuardianSheet({ teamId, loadingTeam = false }: { teamId: string; loadingTeam?: boolean }) {
  const [rows, setRows] = useState<Player[]>([]);
  const [loading, setLoading] = useState(Boolean(teamId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [ascending, setAscending] = useState(true);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [busyContact, setBusyContact] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef(0);
  const mutationRef = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (!teamId) return;
    const request = ++requestRef.current;
    if (!quiet) setLoading(true);
    try {
      const { data, error } = await supabase.rpc('coach_get_guardian_sheet', { p_team_id: teamId });
      if (request !== requestRef.current) return;
      if (error) throw error;
      setRows((data ?? []) as Player[]);
      setLoadError(null);
    } catch (error) {
      if (request !== requestRef.current) return;
      setLoadError(error instanceof Error ? error.message : 'Unable to refresh guardian information. Please try again.');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible' && !mutationRef.current) void load(true); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      requestRef.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const connectedCount = rows.filter(row => row.contacts.some(contact => connectedStatuses.includes(contact.status))).length;
  const pendingCount = rows.filter(row => row.contacts.some(contact => pendingStatuses.includes(contact.status))).length;
  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter(row => {
      const matchesQuery = [row.player_name, ...(row.positions ?? []), ...row.contacts.flatMap(contact => [contact.name, contact.email ?? ''])]
        .some(value => value.toLowerCase().includes(search));
      const matchesFilter = filter === 'all'
        || (filter === 'connected' && row.contacts.some(contact => connectedStatuses.includes(contact.status)))
        || (filter === 'pending' && row.contacts.some(contact => pendingStatuses.includes(contact.status)))
        || (filter === 'not_linked' && !row.contacts.some(contact => connectedStatuses.includes(contact.status)));
      return matchesQuery && matchesFilter;
    }).sort((a, b) => a.player_name.localeCompare(b.player_name) * (ascending ? 1 : -1));
  }, [rows, query, filter, ascending]);

  function openInvite(playerId = '') {
    setSelected(playerId);
    setName('');
    setEmail('');
    setNotice(null);
    dialogRef.current?.showModal();
  }

  function deliveryNotice(data: { warning?: string; developmentPreviewUrl?: string } | null, message: string): Notice {
    if (data?.warning) return { tone: 'warning', message: data.warning };
    if (data?.developmentPreviewUrl) return { tone: 'warning', message: 'Invitation saved in development mode. No email was delivered.' };
    return { tone: 'success', message };
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (mutationRef.current || !teamId || !rows.some(row => row.player_id === selected) || !name.trim() || !email.trim()) return;
    mutationRef.current = true;
    setSending(true);
    setNotice(null);
    try {
      const result = await createGuardianInvitation({
        playerId: selected, guardianEmail: email.trim(), guardianName: name.trim(),
        relationshipType: 'parent', isPrimary: false, invitationType: 'coach_initiated', relatedTeamId: teamId,
      });
      if (result.error) throw new Error(result.error);
      dialogRef.current?.close();
      setNotice(deliveryNotice(result.data, 'Secure guardian invitation sent.'));
      setName('');
      setEmail('');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to send the invitation. Please try again.' });
    } finally {
      await load(true);
      mutationRef.current = false;
      setSending(false);
    }
  }

  async function manage(action: 'resend' | 'cancel', contact: Contact) {
    if (mutationRef.current) return;
    mutationRef.current = true;
    setBusyContact(contact.id);
    setNotice(null);
    try {
      const result = await manageGuardianInvitation(action, contact.id);
      if (result.error) throw new Error(result.error);
      setNotice(deliveryNotice(result.data, action === 'resend' ? 'Guardian invitation resent.' : 'Guardian invitation cancelled.'));
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to update the invitation. Please try again.' });
    } finally {
      await load(true);
      mutationRef.current = false;
      setBusyContact(null);
    }
  }

  const noticeElement = notice ? <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : notice.tone === 'warning' ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'}`}>{notice.message}</p> : null;
  const unavailable = loading || loadingTeam || Boolean(loadError);
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-primary)]">Team operations</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Guardians</h1>
          <p className="mt-2 text-sm text-gray-400">Manage guardian connections and invitations for your players.</p>
        </div>
        <button type="button" onClick={() => openInvite()} disabled={!teamId || unavailable || !rows.length || sending || Boolean(busyContact)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"><MailPlus size={17} />Invite guardian</button>
      </header>
      {noticeElement}
      {!teamId ? <div className="rounded-2xl border border-white/10 p-8 text-sm text-gray-400">{loadingTeam ? 'Loading teams…' : 'Choose a team to view guardian connections.'}</div> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input aria-label="Search players or guardians" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search players or guardians" className="min-h-10 w-64 rounded-xl border border-white/10 bg-transparent pl-9 pr-3 text-xs text-gray-200 outline-none focus:border-white/30" /></label>
            <select aria-label="Filter guardian connections" value={filter} onChange={event => setFilter(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-[var(--surface-card)] px-3 text-xs text-gray-300"><option value="all">All players</option><option value="connected">Connected</option><option value="pending">Pending</option><option value="not_linked">Not connected</option></select>
          </div>
          <div className="flex items-center gap-3">
            {!unavailable && <p className="text-xs text-gray-500"><span className="text-gray-300">{rows.length}</span> players <span className="px-1">·</span> {connectedCount} connected <span className="px-1">·</span> {pendingCount} with pending connections</p>}
            <button type="button" onClick={() => void load()} disabled={loading || sending || Boolean(busyContact)} className={buttonClass} aria-label="Refresh guardian information"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>
        {loadError && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">{loadError} {rows.length > 0 ? 'Previously loaded information may be out of date.' : ''} Use Refresh to try again.</p>}
        <section aria-label="Guardian connections" aria-busy={loading} className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(11,13,13,0.72)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-white/[0.08] text-xs font-medium text-gray-300">
                <th scope="col" aria-sort={ascending ? 'ascending' : 'descending'} className="w-[210px] px-5 py-5"><button type="button" onClick={() => setAscending(value => !value)} className="inline-flex items-center gap-1.5 hover:text-white">Name {ascending ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button></th>
                <th scope="col" className="px-3 py-5">Position</th><th scope="col" className="px-3 py-5">Height</th><th scope="col" className="px-3 py-5">Weight</th>
                <th scope="col" className="px-3 py-5">Guardian</th><th scope="col" className="px-3 py-5">Guardian email</th><th scope="col" className="px-3 py-5">Status</th><th scope="col" className="px-3 py-5">Player account</th><th scope="col" className="px-5 py-5 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {loading && rows.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-gray-400"><Loader2 size={20} className="mx-auto mb-2 animate-spin text-[var(--accent-primary)]" />Loading guardian connections…</td></tr> : visibleRows.map(row => {
                  const contacts: (Contact | null)[] = row.contacts.length ? row.contacts : [null];
                  const initials = row.player_name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
                  const tone = tones[Array.from(row.player_id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % tones.length];
                  return <Fragment key={row.player_id}>{contacts.map((contact, index) => <tr key={contact?.id ?? row.player_id} className="border-b border-white/[0.07] transition-colors last:border-b-0 hover:bg-white/[0.025]">
                    <td className="px-5 py-3">{index === 0 ? <div className="flex items-center gap-3"><span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br text-xs font-bold ${tone}`}>{initials || 'P'}</span><div><p className="font-medium text-gray-100">{row.player_name}</p><p className="mt-0.5 text-[10px] text-gray-500">{humanize(row.age_policy_category)}</p></div></div> : <span className="pl-[52px] text-xs text-gray-500">{row.player_name}</span>}</td>
                    <td className="px-3 py-3 text-xs text-gray-300">{row.positions?.join(', ') || '—'}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-gray-300">{row.height_cm ? `${row.height_cm} cm` : '—'}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-gray-300">{row.weight_kg ? `${row.weight_kg} kg` : '—'}</td>
                    <td className="px-3 py-3"><p className="text-xs text-gray-200">{contact?.name ?? '—'}</p>{contact && <p className="mt-1 whitespace-nowrap text-[10px] text-gray-500">{humanize(contact.relationship)} · {contact.isPrimary ? 'Primary' : 'Secondary'}</p>}</td>
                    <td className="px-3 py-3 text-xs text-gray-300">{contact?.email ?? '—'}</td>
                    <td className="px-3 py-3"><StatusBadge contact={contact} /></td>
                    <td className="px-3 py-3 text-xs text-gray-400">{humanize(row.account_state)}</td>
                    <td className="px-5 py-3"><div className="flex justify-end gap-2">
                      {contact?.canManage && <><button type="button" disabled={unavailable || sending || Boolean(busyContact) || !contact.canResend} onClick={() => void manage('resend', contact)} title={!contact.canResend ? 'Resending is on cooldown or the resend limit has been reached.' : undefined} aria-label={`Resend invitation to ${contact.name} for ${row.player_name}`} className={buttonClass}>{busyContact === contact.id ? <Loader2 size={13} className="animate-spin" /> : 'Resend'}</button><button type="button" disabled={unavailable || sending || Boolean(busyContact)} onClick={() => void manage('cancel', contact)} aria-label={`Cancel invitation to ${contact.name} for ${row.player_name}`} className={buttonClass}>Cancel</button></>}
                      {index === 0 && <button type="button" disabled={unavailable || sending || Boolean(busyContact)} onClick={() => openInvite(row.player_id)} className={buttonClass} aria-label={`Invite guardian for ${row.player_name}`}><MailPlus size={14} />Invite</button>}
                    </div></td>
                  </tr>)}</Fragment>;
                })}
                {!loading && !loadError && visibleRows.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-sm text-gray-500"><ShieldCheck size={24} className="mx-auto mb-3 text-gray-600" />{rows.length === 0 ? 'No active players in this team.' : 'No players match your search or filter.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-gray-500"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Operational linking status only. Dates of birth, private verification data and consent answers remain private. Guardian account emails are masked.</p>
      </>}
      <dialog ref={dialogRef} aria-labelledby="guardian-invite-title" onCancel={event => { if (sending) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-white/10 bg-[var(--surface-elevated)] p-0 text-white shadow-2xl backdrop:bg-black/70">
        <form onSubmit={invite} className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 id="guardian-invite-title" className="flex items-center gap-2 text-lg font-semibold"><MailPlus size={19} className="text-[var(--accent-primary)]" />Invite guardian</h2><p className="mt-1 text-xs text-gray-500">Send a secure invitation to a player’s guardian.</p></div><button type="button" aria-label="Close invitation" disabled={sending} onClick={() => dialogRef.current?.close()} className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40"><X size={20} /></button></div>
          {notice?.tone === 'error' && noticeElement}
          {loadError && <p role="alert" className="text-xs text-rose-200">Guardian information could not be refreshed. Close this dialog and refresh before sending an invitation.</p>}
          <label className="block text-xs text-gray-400">Player<select autoFocus required disabled={sending} value={selected} onChange={event => setSelected(event.target.value)} className={`${inputClass} mt-1.5`}><option value="">Select player</option>{rows.map(row => <option key={row.player_id} value={row.player_id}>{row.player_name}</option>)}</select></label>
          <label className="block text-xs text-gray-400">Guardian name<input required disabled={sending} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Guardian name" autoComplete="name" className={`${inputClass} mt-1.5`} /></label>
          <label className="block text-xs text-gray-400">Guardian email<input required type="email" disabled={sending} value={email} onChange={event => setEmail(event.target.value)} placeholder="parent@example.com" autoComplete="email" className={`${inputClass} mt-1.5`} /></label>
          <p className="text-xs leading-relaxed text-gray-500">The coach can initiate a limited invitation. Only the guardian can provide consent and approve the player account.</p>
          <button disabled={sending || Boolean(loadError) || !selected || !name.trim() || !email.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] text-sm font-bold text-black disabled:opacity-40">{sending && <Loader2 size={16} className="animate-spin" />}{sending ? 'Sending…' : 'Send secure invitation'}</button>
        </form>
      </dialog>
    </div>
  );
}
