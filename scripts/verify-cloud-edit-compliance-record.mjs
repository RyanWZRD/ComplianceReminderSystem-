/**
 * Cloud write smoke: update_compliance_record RPC (person + record fields; notes untouched).
 * Requires migration 20260203000005 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HISTORY_ACTIONS } from "../js/data/constants.js";
import { validateEditComplianceRecordInput } from "../js/data/edit-compliance-record.js";
import { getLondonDateISOString } from "../js/data/renew-compliance.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const JORDAN_PERSON_ID = "22222222-2222-2222-2222-222222222202";
const JORDAN_RECORD_ID = "33333333-3333-3333-3333-333333333302";

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
const { canEditComplianceRecord, canMutateData } = await import("../js/app/permissions.js");

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

if (!canEditComplianceRecord()) {
  console.error("Editor must have canEditComplianceRecord() when CLOUD_WRITES_ENABLED=true.");
  process.exit(1);
}

const store = new CloudComplianceStore();
const loadBefore = await store.load();

if (!loadBefore.ok) {
  console.error(`Editor load failed: ${loadBefore.error?.message}`);
  process.exit(1);
}

const before = findRecord(store, JORDAN_RECORD_ID);

if (!before) {
  console.error("Jordan Coordinator seed record not found.");
  process.exit(1);
}

const notesBeforeEdit = before.record.notes || "";
const uniqueRole = `Step11 Role ${Date.now()}`;

const todayLondon = getLondonDateISOString();
const pastExpiry = "2020-01-15";

const blankValidation = validateEditComplianceRecordInput({
  name: "Jordan Coordinator",
  role: "Coordinator",
  complianceType: "Basic Awareness",
  expiryDate: todayLondon,
  renewalCycle: "3-years",
});

if (!blankValidation.valid) {
  console.error("Baseline client validation should pass.");
  process.exit(1);
}

const blankNameValidation = validateEditComplianceRecordInput({
  name: "",
  role: "Coordinator",
  complianceType: "Basic Awareness",
  expiryDate: todayLondon,
  renewalCycle: "3-years",
});

if (blankNameValidation.valid) {
  console.error("Client validation should reject blank name.");
  process.exit(1);
}

const blankRpc = await store.updateComplianceRecord({
  personId: JORDAN_PERSON_ID,
  recordId: JORDAN_RECORD_ID,
  name: "",
  role: "Coordinator",
  complianceType: "Basic Awareness",
  expiryDate: todayLondon,
  renewalCycle: "3-years",
});

if (!blankRpc.ok || blankRpc.status !== "validation_error") {
  console.error(`Expected validation_error for blank name, got ${JSON.stringify(blankRpc)}.`);
  process.exit(1);
}

const roleUpdate = await store.updateComplianceRecord({
  personId: JORDAN_PERSON_ID,
  recordId: JORDAN_RECORD_ID,
  name: before.person.name,
  role: uniqueRole,
  complianceType: before.record.complianceType,
  expiryDate: before.record.expiryDate,
  renewalCycle: before.record.renewalCycle || "3-years",
});

if (!roleUpdate.ok || roleUpdate.status !== "updated") {
  console.error(`Role update failed: ${JSON.stringify(roleUpdate)}.`);
  process.exit(1);
}

const reloadRole = await store.load();

if (!reloadRole.ok) {
  console.error(`Reload after role update failed: ${reloadRole.error?.message}`);
  process.exit(1);
}

const afterRole = findRecord(store, JORDAN_RECORD_ID);

if (!afterRole || afterRole.person.role !== uniqueRole) {
  console.error("Role update did not persist after reload.");
  process.exit(1);
}

if ((afterRole.record.notes || "") !== notesBeforeEdit) {
  console.error("Notes must remain unchanged after edit.");
  process.exit(1);
}

const editedHistory = (afterRole.record.history || []).filter(
  (entry) => entry.action === HISTORY_ACTIONS.EDITED
);

if (editedHistory.length === 0) {
  console.error("Expected edited history entry after role update.");
  process.exit(1);
}

const nextComplianceType =
  afterRole.record.complianceType === "Foundations" ? "Leadership" : "Foundations";
const nextRenewalCycle = afterRole.record.renewalCycle === "1-year" ? "2-years" : "1-year";
const nextExpiryDate = afterRole.record.expiryDate === pastExpiry ? "2019-06-01" : pastExpiry;

const fieldUpdate = await store.updateComplianceRecord({
  personId: JORDAN_PERSON_ID,
  recordId: JORDAN_RECORD_ID,
  name: afterRole.person.name,
  role: afterRole.person.role,
  complianceType: nextComplianceType,
  expiryDate: nextExpiryDate,
  renewalCycle: nextRenewalCycle,
});

if (!fieldUpdate.ok || fieldUpdate.status !== "updated") {
  console.error(`Field update failed: ${JSON.stringify(fieldUpdate)}.`);
  process.exit(1);
}

const reloadFields = await store.load();

if (!reloadFields.ok) {
  console.error(`Reload after field update failed: ${reloadFields.error?.message}`);
  process.exit(1);
}

const afterFields = findRecord(store, JORDAN_RECORD_ID);

if (
  !afterFields ||
  afterFields.record.complianceType !== nextComplianceType ||
  afterFields.record.expiryDate !== nextExpiryDate ||
  afterFields.record.renewalCycle !== nextRenewalCycle
) {
  console.error("Compliance fields did not persist after reload.");
  process.exit(1);
}

if ((afterFields.record.notes || "") !== notesBeforeEdit) {
  console.error("Notes must remain unchanged after field update.");
  process.exit(1);
}

const noChanges = await store.updateComplianceRecord({
  personId: JORDAN_PERSON_ID,
  recordId: JORDAN_RECORD_ID,
  name: afterFields.person.name,
  role: afterFields.person.role,
  complianceType: afterFields.record.complianceType,
  expiryDate: afterFields.record.expiryDate,
  renewalCycle: afterFields.record.renewalCycle,
});

if (!noChanges.ok || noChanges.status !== "no_changes") {
  console.error(`Expected no_changes, got ${JSON.stringify(noChanges)}.`);
  process.exit(1);
}

const nameConflict = await store.updateComplianceRecord({
  personId: JORDAN_PERSON_ID,
  recordId: JORDAN_RECORD_ID,
  name: "Alex Volunteer",
  role: afterFields.person.role,
  complianceType: afterFields.record.complianceType,
  expiryDate: afterFields.record.expiryDate,
  renewalCycle: afterFields.record.renewalCycle,
});

if (!nameConflict.ok || nameConflict.status !== "name_conflict") {
  console.error(`Expected name_conflict, got ${JSON.stringify(nameConflict)}.`);
  process.exit(1);
}

const reloadConflict = await store.load();

if (!reloadConflict.ok) {
  console.error(`Reload after name conflict failed: ${reloadConflict.error?.message}`);
  process.exit(1);
}

const afterConflict = findRecord(store, JORDAN_RECORD_ID);

if (!afterConflict || afterConflict.person.name !== afterFields.person.name) {
  console.error("Name conflict should not change stored person name.");
  process.exit(1);
}

await signOut();

await signInAs(viewerEmail);

if (canEditComplianceRecord()) {
  console.error("Viewer must not have canEditComplianceRecord().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerAttempt = await viewerStore.updateComplianceRecord({
  personId: JORDAN_PERSON_ID,
  recordId: JORDAN_RECORD_ID,
  name: "Viewer Blocked Name",
  role: "Coordinator",
  complianceType: "DBS",
  expiryDate: todayLondon,
  renewalCycle: "3-years",
});

if (viewerAttempt.ok) {
  console.error("Viewer updateComplianceRecord should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud edit compliance record smoke test: OK");
console.log(`  Record: Jordan Coordinator -> ${JORDAN_RECORD_ID}`);
console.log("  Role + compliance field updates persisted");
console.log("  Notes unchanged");
console.log("  no_changes + name_conflict + validation_error");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
