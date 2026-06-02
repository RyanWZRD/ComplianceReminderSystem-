import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-env.js";

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

/**
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  const url = String(SUPABASE_URL || "").trim();
  const key = String(SUPABASE_ANON_KEY || "").trim();

  if (!url || !key) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Copy js/data/supabase-env.example.js to js/data/supabase-env.js, " +
        "set SUPABASE_URL and SUPABASE_ANON_KEY in .env, then run: npm run sync-env"
    );
  }

  if (!client) {
    client = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
  }

  return client;
}
