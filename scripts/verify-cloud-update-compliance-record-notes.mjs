/**
 * Cloud write smoke: update_compliance_record_notes RPC (editor update / viewer denied).
 * Requires migration 20260203000007 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HISTORY_ACTIONS } from "../js/data/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** Taylor Warden DBS — lightly used by other smoke tests. */
const TEST_RECORD_ID = "33333333-3333-3333-3333-333333333304";

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
 * @param {string} recordId
 */
function findRecord(store, recordId) {
  for (const person of store.people) {
    for (const record of person.complianceRecords) {
      if (String(record.id) === recordId) {
        return { person, record };
      }
    }
  }

  return null;
}

let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env file.");
  process.exit(1);
}

const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");
const editorEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_EDITOR") || "alpha-editor@example.com";
const viewerEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_VIEWER") || "alpha-viewer@example.com";

if (!password) {
  console.error(".env must define SUPABASE_TEST_PASSWORD.");
  process.exit(1);
}

process.env.DATA_BACKEND = "cloud";
process.env.AUTH_MODE = "supabase";
process.env.CLOUD_WRITES_ENABLED = "true";

const { signInWithPassword, signOut } = await import("../js/auth/session.js");
const { CloudComplianceStore } = await import("../js/data/cloud-store.js");
const { canMutateData, canUpdateComplianceRecordNotes } = await import("../js/app/permissions.js");

if (canMutateData()) {
  console.error("canMutateData() must stay false in cloud mode.");
  process.exit(1);
}

async function signInAs(email) {
  const result = await signInWithPassword(email, password);

  if (!result.ok) {
    console.error(`Sign-in failed (${email}): ${result.error}`);
    process.exit(1);
  }
}

await signInAs(editorEmail);

if (!canUpdateComplianceRecordNotes()) {
  console.error("Editor must have canUpdateComplianceRecordNotes() when CLOUD_WRITES_ENABLED=true.");
  process.exit(1);
}

const store = new CloudComplianceStore();
const loadBefore = await store.load();

if (!loadBefore.ok) {
  console.error(`Editor load failed: ${loadBefore.error?.message}`);
  process.exit(1);
}

const before = findRecord(store, TEST_RECORD_ID);

if (!before) {
  console.error(`Test record ${TEST_RECORD_ID} not found in seed data.`);
  process.exit(1);
}

const baseNotes = before.record.notes || "";
const verifyLine = `P3-4 verify ${Date.now()}`;
const updatedNotes = baseNotes ? `${baseNotes}\n${verifyLine}` : verifyLine;

const updateResult = await store.updateComplianceRecordNotes(TEST_RECORD_ID, updatedNotes);

if (!updateResult.ok || updateResult.status !== "updated") {
  console.error(`Notes update failed: ${JSON.stringify(updateResult)}`);
  process.exit(1);
}

const reloadStore = new CloudComplianceStore();
const loadAfter = await reloadStore.load();

if (!loadAfter.ok) {
  console.error(`Reload after notes update failed: ${loadAfter.error?.message}`);
  process.exit(1);
}

const after = findRecord(reloadStore, TEST_RECORD_ID);

if (!after || (after.record.notes || "") !== updatedNotes) {
  console.error("Notes did not persist after reload.");
  process.exit(1);
}

const notesHistory = (after.record.history || []).filter(
  (entry) =>
    entry.action === HISTORY_ACTIONS.EDITED &&
    String(entry.description || "").includes("Notes updated")
);

if (notesHistory.length === 0) {
  console.error('Expected edited history entry with "Notes updated."');
  process.exit(1);
}

const noChanges = await reloadStore.updateComplianceRecordNotes(TEST_RECORD_ID, updatedNotes);

if (!noChanges.ok || noChanges.status !== "no_changes") {
  console.error(`Expected no_changes, got ${JSON.stringify(noChanges)}.`);
  process.exit(1);
}

await signOut();

await signInAs(viewerEmail);

if (canUpdateComplianceRecordNotes()) {
  console.error("Viewer must not have canUpdateComplianceRecordNotes().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerAttempt = await viewerStore.updateComplianceRecordNotes(
  TEST_RECORD_ID,
  `${updatedNotes}\nviewer blocked`
);

if (viewerAttempt.ok) {
  console.error("Viewer updateComplianceRecordNotes should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud update compliance record notes smoke test: OK");
console.log(`  Record: ${TEST_RECORD_ID}`);
console.log("  Editor: updated + reload + no_changes");
console.log("  Viewer: RPC denied");
