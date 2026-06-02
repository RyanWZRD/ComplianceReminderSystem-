/**
 * Lightweight staging prep check: .env + generated supabase-env.js present and valid.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const supabaseEnvPath = join(root, "js", "data", "supabase-env.js");

/**
 * @param {string} content
 * @param {string} key
 * @returns {string}
 */
function readEnvValue(content, key) {
  const pattern = new RegExp(`^${key}\\s*=\\s*(.*)$`, "m");
  const match = content.match(pattern);

  if (!match) {
    return "";
  }

  let value = match[1].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

if (!existsSync(envPath)) {
  console.error("Missing .env — copy .env.example to .env and configure staging values.");
  process.exit(1);
}

const envContent = readFileSync(envPath, "utf8");
const url = readEnvValue(envContent, "SUPABASE_URL");
const anonKey = readEnvValue(envContent, "SUPABASE_ANON_KEY");
const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");

if (!url || url.includes("YOUR_PROJECT")) {
  console.error(".env: set SUPABASE_URL to your staging project URL.");
  process.exit(1);
}

if (!anonKey || anonKey.includes("your-")) {
  console.error(".env: set SUPABASE_ANON_KEY (publishable anon key from the dashboard).");
  process.exit(1);
}

if (!password) {
  console.error(".env: set SUPABASE_TEST_PASSWORD for alpha test users.");
  process.exit(1);
}

if (!existsSync(supabaseEnvPath)) {
  console.error("Missing js/data/supabase-env.js — run: npm run sync-env");
  process.exit(1);
}

const { isSupabaseConfigured } = await import("../js/data/supabase-client.js");

if (!isSupabaseConfigured()) {
  console.error("supabase-env.js is present but isSupabaseConfigured() is false.");
  process.exit(1);
}

console.log("Staging config smoke test: OK");
console.log(`  SUPABASE_URL: ${url}`);
console.log("  supabase-env.js: configured");
console.log("  Test password: set");
