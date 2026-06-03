/**
 * Cloud write smoke: archive_compliance_record RPC (editor archive, viewer denied, not_found).
 * Requires migration 20260203000016 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HISTORY_ACTIONS } from "../js/data/constants.js";
import { buildRecordDeletedHistoryDescription } from "../js/data/archive-compliance-record.js";
import { getLondonDateISOString } from "../js/data/renew-compliance.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const MISSING_RECORD_ID = "33333333-3333-3333-3333-333333339999";

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

/**
 * @param {import('../js/data/cloud-store.js').CloudComplianceStore} store
 * @param {string} personName
 */
function findPersonByName(store, personName) {
  const normalized = personName.trim().toLowerCase();

  return (
    store.people.find((person) => person.name.trim().toLowerCase() === normalized) ?? null
  );
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
const { canArchiveComplianceRecord, canMutateData } = await import("../js/app/permissions.js");

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

if (!canArchiveComplianceRecord()) {
  console.error("Editor must have canArchiveComplianceRecord() when CLOUD_WRITES_ENABLED=true.");
  process.exit(1);
}

const store = new CloudComplianceStore();
const loadBefore = await store.load();

if (!loadBefore.ok) {
  console.error(`Editor load failed: ${loadBefore.error?.message}`);
  process.exit(1);
}

const snapshotsBefore = store.deletedRecordHistory.length;

const notFoundResult = await store.archiveComplianceRecord(MISSING_RECORD_ID);

if (!notFoundResult.ok || notFoundResult.status !== "not_found") {
  console.error(
    `Expected not_found for missing record, got ${JSON.stringify(notFoundResult)}.`
  );
  process.exit(1);
}

const todayLondon = getLondonDateISOString();
const tempPersonName = `P37A Verify ${Date.now()}`;

const createResult = await store.createComplianceRecord({
  name: tempPersonName,
  role: "Volunteer",
  complianceType: "DBS",
  expiryDate: todayLondon,
  renewalCycle: "3-years",
});

if (!createResult.ok || createResult.status !== "created") {
  console.error(`Create temp record failed: ${JSON.stringify(createResult)}`);
  process.exit(1);
}

const createdRecordId = createResult.recordId;

if (!createdRecordId) {
  console.error("create_compliance_record should return record_id.");
  process.exit(1);
}

await store.load();

const createdTarget = findRecord(store, createdRecordId);

if (!createdTarget) {
  console.error("Created record not found after reload.");
  process.exit(1);
}

const archiveResult = await store.archiveComplianceRecord(createdRecordId);

if (!archiveResult.ok || archiveResult.status !== "archived") {
  console.error(`Archive record failed: ${JSON.stringify(archiveResult)}`);
  process.exit(1);
}

if (!archiveResult.deletedSnapshotId) {
  console.error("archive_compliance_record should return deleted_snapshot_id.");
  process.exit(1);
}

await store.load();

if (findRecord(store, createdRecordId)) {
  console.error("Archived record should be removed after reload.");
  process.exit(1);
}

if (findPersonByName(store, tempPersonName)) {
  console.error("Person with no remaining records should be removed after archive.");
  process.exit(1);
}

if (store.deletedRecordHistory.length !== snapshotsBefore + 1) {
  console.error("Deleted snapshot count should increase by one after archive.");
  process.exit(1);
}

const latestSnapshot = store.deletedRecordHistory[0];

if (!latestSnapshot || latestSnapshot.personName !== tempPersonName) {
  console.error("Latest deleted snapshot should match archived person.");
  process.exit(1);
}

const expectedDeletedHistory = buildRecordDeletedHistoryDescription(
  "DBS",
  todayLondon
);
const deletedHistory = (latestSnapshot.record?.history || []).find(
  (entry) =>
    entry.action === HISTORY_ACTIONS.DELETED &&
    entry.description === expectedDeletedHistory
);

if (!deletedHistory) {
  console.error(`Expected deleted history in snapshot: ${expectedDeletedHistory}`);
  process.exit(1);
}

await signOut();

await signInAs(viewerEmail);

if (canArchiveComplianceRecord()) {
  console.error("Viewer must not have canArchiveComplianceRecord().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerArchive = await viewerStore.archiveComplianceRecord(MISSING_RECORD_ID);

if (viewerArchive.ok) {
  console.error("Viewer archiveComplianceRecord should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud archive compliance record smoke test: OK");
console.log(`  Created then archived: ${tempPersonName} (${createdRecordId})`);
console.log(`  Deleted snapshot: ${archiveResult.deletedSnapshotId}`);
console.log("  deleted history preserved in snapshot");
console.log("  Active record removed after reload");
console.log("  Missing record: not_found");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
console.log("  Reset restores canonical counts (run reset-alpha-staging-data.mjs)");
