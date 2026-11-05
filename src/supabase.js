import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.startsWith('your-') &&
  !supabaseAnonKey.startsWith('your-');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default supabase;