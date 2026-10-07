// Supabase client (optional). Falls back silently to null when env vars aren't set.
// To activate: set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in /app/frontend/.env
import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const SUPABASE_ENABLED = Boolean(url && key);

export const supabase = SUPABASE_ENABLED
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
