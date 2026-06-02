/**
 * Smoke test for CloudComplianceStore.load() via session.js (auth facade).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const EXPECTED = {
  people: 5,
  records: 6,
  history: 2,
  evidence: 2,
  actions: 3,
  deletedSnapshots: 1,
};

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

const email = readEnvValue(envContent, "SUPABASE_TEST_EMAIL");
const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");

if (!email || !password) {
  console.error(
    ".env must define SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD (see .env.example)."
  );
  process.exit(1);
}

process.env.AUTH_MODE = "supabase";

const { signInWithPassword, signOut } = await import("../js/auth/session.js");
const { CloudComplianceStore } = await import("../js/data/cloud-store.js");

try {
  const signInResult = await signInWithPassword(email, password);

  if (!signInResult.ok) {
    console.error(`Sign-in failed: ${signInResult.error}`);
    process.exit(1);
  }

  const store = new CloudComplianceStore();
  const loadResult = await store.load();

  if (!loadResult.ok) {
    console.error(`Load failed: ${loadResult.error?.message ?? "Unknown error"}`);
    process.exit(1);
  }

  const counts = countEntities(store);

  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (counts[key] !== expected) {
      console.error(`Expected ${key} count ${expected}, got ${counts[key]}.`);
      process.exit(1);
    }
  }

  const firstPerson = store.people[0];

  if (!firstPerson || typeof firstPerson.id !== "string") {
    console.error("Expected string UUID person ids.");
    process.exit(1);
  }

  const firstRecord = firstPerson.complianceRecords[0];

  if (!firstRecord || typeof firstRecord.id !== "string") {
    console.error("Expected string UUID record ids.");
    process.exit(1);
  }

  console.log("Cloud compliance load smoke test: OK");
  console.log(`  People: ${counts.people}`);
  console.log(`  Records: ${counts.records}`);
  console.log(`  History: ${counts.history}`);
  console.log(`  Evidence: ${counts.evidence}`);
  console.log(`  Actions: ${counts.actions}`);
  console.log(`  Deleted snapshots: ${counts.deletedSnapshots}`);
} finally {
  await signOut();
}
