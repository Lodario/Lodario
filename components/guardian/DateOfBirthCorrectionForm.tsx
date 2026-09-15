'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function DateOfBirthCorrectionForm() {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('player_request_dob_correction', {
        p_requested_date_of_birth: date, p_reason: reason,
      });
      setMessage(error ? 'The request could not be submitted. Contact support or try again.' : 'Correction submitted for support review. Your access rules stay in place until it is approved.');
      if (!error) { setDate(''); setReason(''); }
    } catch { setMessage('The request could not be submitted. Please try again.'); }
    finally { setSaving(false); }
  };
  return <details className="rounded-xl border border-white/10 p-4 text-left">
    <summary className="cursor-pointer text-sm font-semibold">Entered the wrong date of birth?</summary>
    <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
      <p className="text-gray-400">Request a correction without unlocking your account. Support will review ownership and any Guardian requirements.</p>
      <label className="block">Correct date of birth<input required type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-3" /></label>
      <label className="block">Reason<textarea required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-3" /></label>
      <button disabled={saving} className="min-h-11 w-full rounded-lg border border-white/20 px-4 font-semibold disabled:opacity-50">{saving ? 'Submitting…' : 'Request correction'}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </details>;
}
