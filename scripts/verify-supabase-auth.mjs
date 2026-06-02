/**
 * Smoke test for Supabase auth via session.js (public facade only).
 * Sets AUTH_MODE=supabase before importing session modules.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const SEED_ORGANISATION_ID = "11111111-1111-1111-1111-111111111111";

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

let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env file. Copy .env.example to .env and configure Supabase test credentials.");
  process.exit(1);
}

const email = readEnvValue(envContent, "SUPABASE_TEST_EMAIL");
const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");
const expectedRole = readEnvValue(envContent, "SUPABASE_TEST_ROLE") || "admin";

if (!email || !password) {
  console.error(
    ".env must define SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD (see .env.example)."
  );
  process.exit(1);
}

process.env.AUTH_MODE = "supabase";

const {
  signInWithPassword,
  signOut,
  getCurrentUser,
  getOrganisationId,
  isAuthenticated,
  canEdit,
  canAdmin,
  waitForAuthReady,
} = await import("../js/auth/session.js");

await waitForAuthReady();

const signInResult = await signInWithPassword(email, password);

if (!signInResult.ok) {
  console.error(`Sign-in failed: ${signInResult.error}`);
  process.exit(1);
}

const user = getCurrentUser();

if (!isAuthenticated() || !user) {
  console.error("Session user missing after sign-in.");
  process.exit(1);
}

if (user.role !== expectedRole) {
  console.error(`Expected role ${expectedRole}, got ${user.role}.`);
  process.exit(1);
}

if (getOrganisationId() !== SEED_ORGANISATION_ID) {
  console.error(
    `Expected organisation ${SEED_ORGANISATION_ID}, got ${getOrganisationId()}.`
  );
  process.exit(1);
}

if (!user.displayName || !user.userId) {
  console.error("Session user missing displayName or userId.");
  process.exit(1);
}

if (expectedRole === "viewer" && canEdit()) {
  console.error("Viewer should not have canEdit().");
  process.exit(1);
}

if (expectedRole === "viewer" && canAdmin()) {
  console.error("Viewer should not have canAdmin().");
  process.exit(1);
}

if (expectedRole === "admin" && (!canEdit() || !canAdmin())) {
  console.error("Admin should have canEdit() and canAdmin().");
  process.exit(1);
}

console.log("Supabase auth smoke test: OK");
console.log(`  User: ${user.displayName} (${user.userId})`);
console.log(`  Role: ${user.role}`);
console.log(`  Organisation: ${getOrganisationId()}`);

const signOutResult = await signOut();

if (!signOutResult.ok) {
  console.error(`Sign-out failed: ${signOutResult.error}`);
  process.exit(1);
}

if (isAuthenticated() || getCurrentUser()) {
  console.error("Session still active after sign-out.");
  process.exit(1);
}

console.log("  Sign-out: OK");
