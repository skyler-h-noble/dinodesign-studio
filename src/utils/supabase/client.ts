import { createClient } from '@supabase/supabase-js';

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  anonKey,
  {
    auth: {
      storageKey: 'dinodesign-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
);
