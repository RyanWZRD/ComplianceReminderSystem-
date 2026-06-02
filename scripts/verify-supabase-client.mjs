import { isSupabaseConfigured, getSupabaseClient } from "../js/data/supabase-client.js";

if (!isSupabaseConfigured()) {
  console.error(
    "Supabase is not configured. Set .env values and run: npm run sync-env"
  );
  process.exit(1);
}

const client = getSupabaseClient();

if (!client || typeof client.auth?.getSession !== "function") {
  console.error("Supabase client failed to initialize.");
  process.exit(1);
}

console.log("Supabase client smoke test: OK");
console.log(`  URL: ${client.supabaseUrl}`);
