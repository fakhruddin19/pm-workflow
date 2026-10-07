import { createClient } from "@supabase/supabase-js";

// Project Supabase Configuration
const DEFAULT_SUPABASE_URL = "https://fhhachnhxraztkoapbxb.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_TAnWInoCrhz6iafNMfCAgw_vkO0l1VG";

const url = process.env.REACT_APP_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

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
