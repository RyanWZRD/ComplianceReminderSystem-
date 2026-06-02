/**
 * Read-only cloud QA: admin, editor, and viewer each load the same seed org data.
 * Does not test Postgres writes (see docs/cloud-phase1-rls-checklist.md for RLS SQL tests).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const SEED_ORGANISATION_ID = "11111111-1111-1111-1111-111111111111";

const EXPECTED = {
  people: 5,
  records: 6,
  history: 2,
  evidence: 2,
  actions: 3,
  deletedSnapshots: 1,
};

/** @type {{ role: string; emailKey: string; defaultEmail: string }[]} */
const ROLES = [
  { role: "admin", emailKey: "SUPABASE_TEST_EMAIL_ADMIN", defaultEmail: "alpha-admin@example.com" },
  {
    role: "editor",
    emailKey: "SUPABASE_TEST_EMAIL_EDITOR",
    defaultEmail: "alpha-editor@example.com",
  },
  {
    role: "viewer",
    emailKey: "SUPABASE_TEST_EMAIL_VIEWER",
    defaultEmail: "alpha-viewer@example.com",
  },
];

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

/**
 * @param {import('../js/data/cloud-store.js').CloudComplianceStore} store
 */
function countEntities(store) {
  let records = 0;
  let history = 0;
  let evidence = 0;
  let actions = 0;

  for (const person of store.people) {
    for (const record of person.complianceRecords) {
      records += 1;
      history += record.history?.length ?? 0;
      evidence += record.evidence?.length ?? 0;
      actions += record.actions?.length ?? 0;
    }
  }

  return {
    people: store.people.length,
    records,
    history,
    evidence,
    actions,
    deletedSnapshots: store.deletedRecordHistory.length,
  };
}

let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env file. Copy .env.example to .env and configure Supabase test credentials.");
  process.exit(1);
}

const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");

if (!password) {
  console.error(".env must define SUPABASE_TEST_PASSWORD (shared staging test password).");
  process.exit(1);
}

process.env.DATA_BACKEND = "cloud";
process.env.AUTH_MODE = "supabase";

const { signInWithPassword, signOut, getCurrentUser, getOrganisationId, isAuthenticated } =
  await import("../js/auth/session.js");
const { CloudComplianceStore } = await import("../js/data/cloud-store.js");
const { canMutateData } = await import("../js/app/permissions.js");

if (canMutateData()) {
  console.error("canMutateData() must be false when DATA_BACKEND=cloud.");
  process.exit(1);
}

for (const { role, emailKey, defaultEmail } of ROLES) {
  const email =
    readEnvValue(envContent, emailKey) ||
    (role === "admin" ? readEnvValue(envContent, "SUPABASE_TEST_EMAIL") : "") ||
    defaultEmail;

  if (!email) {
    console.error(`No email for ${role}. Set ${emailKey} or SUPABASE_TEST_EMAIL in .env.`);
    process.exit(1);
  }

  const signInResult = await signInWithPassword(email, password);

  if (!signInResult.ok) {
    console.error(`Sign-in failed for ${role} (${email}): ${signInResult.error}`);
    process.exit(1);
  }

  const user = getCurrentUser();

  if (!isAuthenticated() || !user || user.role !== role) {
    console.error(`Expected role ${role} after sign-in, got ${user?.role ?? "none"}.`);
    process.exit(1);
  }

  if (getOrganisationId() !== SEED_ORGANISATION_ID) {
    console.error(
      `${role}: expected organisation ${SEED_ORGANISATION_ID}, got ${getOrganisationId()}.`
    );
    process.exit(1);
  }

  const store = new CloudComplianceStore();
  const loadResult = await store.load();

  if (!loadResult.ok) {
    console.error(`${role}: load failed: ${loadResult.error?.message ?? "Unknown error"}`);
    process.exit(1);
  }

  const counts = countEntities(store);

  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (counts[key] !== expected) {
      console.error(`${role}: expected ${key} count ${expected}, got ${counts[key]}.`);
      process.exit(1);
    }
  }

  console.log(`  ${role}: OK (${email}) — people ${counts.people}, records ${counts.records}`);

  const signOutResult = await signOut();

  if (!signOutResult.ok) {
    console.error(`${role}: sign-out failed: ${signOutResult.error}`);
    process.exit(1);
  }
}

console.log("Cloud role load smoke test: OK");
console.log("  Roles: admin, editor, viewer");
console.log("  Same seed counts for each role");
console.log("  canMutateData() remains false (read-only cloud)");
