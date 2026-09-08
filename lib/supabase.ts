import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from './env/public';

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getPublicSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
