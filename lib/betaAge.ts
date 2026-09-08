import { supabase } from './supabase';

export type PublicBetaAgeStatus = {
  hasDateOfBirth: boolean;
  eligible: boolean;
  age: number | null;
  dateOfBirth: string | null;
  role: 'player' | 'coach' | null;
};

type RpcResult = {
  hasDateOfBirth?: unknown;
  eligible?: unknown;
  age?: unknown;
  dateOfBirth?: unknown;
  role?: unknown;
};

function normalizeStatus(value: unknown): PublicBetaAgeStatus | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const result = value as RpcResult;
  const role = result.role === 'player' || result.role === 'coach' ? result.role : null;

  return {
    hasDateOfBirth: result.hasDateOfBirth === true,
    eligible: result.eligible === true,
    age: typeof result.age === 'number' && Number.isInteger(result.age) ? result.age : null,
    dateOfBirth: typeof result.dateOfBirth === 'string' ? result.dateOfBirth : null,
    role,
  };
}

export async function getPublicBetaAgeStatus(): Promise<{
  data: PublicBetaAgeStatus | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('public_beta_get_my_age_status');
  if (error) return { data: null, error: error.message };

  const status = normalizeStatus(data);
  return status
    ? { data: status, error: null }
    : { data: null, error: 'The age-check service returned an invalid response.' };
}

export async function confirmPublicBetaDateOfBirth(dateOfBirth: string): Promise<{
  data: PublicBetaAgeStatus | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('public_beta_set_my_date_of_birth', {
    p_date_of_birth: dateOfBirth,
  });
  if (error) return { data: null, error: error.message };

  const status = normalizeStatus(data);
  return status
    ? { data: status, error: null }
    : { data: null, error: 'The age-check service returned an invalid response.' };
}
