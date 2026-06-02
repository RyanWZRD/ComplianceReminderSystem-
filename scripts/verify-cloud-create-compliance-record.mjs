/**
 * Cloud write smoke: create_compliance_record RPC (new person + existing person merge).
 * Requires migration 20260203000004 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HISTORY_ACTIONS } from "../js/data/constants.js";
import {
  buildCreatedHistoryDescription,
  validateCreateComplianceRecordInput,
} from "../js/data/create-compliance-record.js";
import { getLondonDateISOString } from "../js/data/renew-compliance.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const EXISTING_PERSON_NAME = "Alex Volunteer";

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
 * @param {string} name
 */
function countRecordsForPersonName(store, name) {
  const normalized = name.trim().toLowerCase();
  let count = 0;

  for (const person of store.people) {
    if (person.name.trim().toLowerCase() === normalized) {
      count += person.complianceRecords.length;
    }
  }

  return count;
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
const { canAddComplianceRecord, canMutateData } = await import("../js/app/permissions.js");

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

if (!canAddComplianceRecord()) {
  console.error("Editor must have canAddComplianceRecord() when CLOUD_WRITES_ENABLED=true.");
  process.exit(1);
}

const store = new CloudComplianceStore();
const loadBefore = await store.load();

if (!loadBefore.ok) {
  console.error(`Editor load failed: ${loadBefore.error?.message}`);
  process.exit(1);
}

const todayLondon = getLondonDateISOString();
const newPersonName = `Step10 Verify ${Date.now()}`;

const blankValidation = validateCreateComplianceRecordInput({
  name: "",
  role: "Volunteer",
  complianceType: "DBS",
  expiryDate: todayLondon,
});

if (blankValidation.valid) {
  console.error("Client validation should reject blank name.");
  process.exit(1);
}

const blankRpc = await store.createComplianceRecord({
  name: "",
  role: "Volunteer",
  complianceType: "DBS",
  expiryDate: todayLondon,
});

if (!blankRpc.ok || blankRpc.status !== "validation_error") {
  console.error(`Expected validation_error for blank name, got ${JSON.stringify(blankRpc)}.`);
  process.exit(1);
}

const existingBefore = countRecordsForPersonName(store, EXISTING_PERSON_NAME);

const existingResult = await store.createComplianceRecord({
  name: "alex volunteer",
  role: "Volunteer",
  complianceType: "Basic Awareness",
  expiryDate: todayLondon,
  renewalCycle: "1-year",
});

if (!existingResult.ok || existingResult.status !== "created") {
  console.error(`Existing-person create failed: ${JSON.stringify(existingResult)}.`);
  process.exit(1);
}

if (existingResult.isNewPerson) {
  console.error("alex volunteer merge should not create a new person.");
  process.exit(1);
}

const reloadExisting = await store.load();

if (!reloadExisting.ok) {
  console.error(`Reload after existing-person create failed: ${reloadExisting.error?.message}`);
  process.exit(1);
}

const existingAfter = countRecordsForPersonName(store, EXISTING_PERSON_NAME);

if (existingAfter !== existingBefore + 1) {
  console.error(
    `Expected one more record for ${EXISTING_PERSON_NAME}, before=${existingBefore} after=${existingAfter}.`
  );
  process.exit(1);
}

const merged = findRecord(store, existingResult.recordId);

if (!merged) {
  console.error("Merged record not found after reload.");
  process.exit(1);
}

const expectedExistingHistory = buildCreatedHistoryDescription(
  "Basic Awareness",
  todayLondon
);

const createdHistory = (merged.record.history || []).find(
  (entry) => entry.action === HISTORY_ACTIONS.CREATED
);

if (!createdHistory || !String(createdHistory.description).includes("Basic Awareness")) {
  console.error("Merged record should include CREATED history entry.");
  process.exit(1);
}

if (createdHistory.description !== expectedExistingHistory) {
  console.error(
    `History description mismatch.\n  expected: ${expectedExistingHistory}\n  got: ${createdHistory.description}`
  );
  process.exit(1);
}

const newPersonResult = await store.createComplianceRecord({
  name: newPersonName,
  role: "Trustee",
  complianceType: "DBS",
  expiryDate: todayLondon,
  renewalCycle: "3-years",
});

if (!newPersonResult.ok || newPersonResult.status !== "created") {
  console.error(`New-person create failed: ${JSON.stringify(newPersonResult)}.`);
  process.exit(1);
}

if (!newPersonResult.isNewPerson) {
  console.error("New unique name should create a new person.");
  process.exit(1);
}

const reloadNew = await store.load();

if (!reloadNew.ok) {
  console.error(`Reload after new-person create failed: ${reloadNew.error?.message}`);
  process.exit(1);
}

const created = findRecord(store, newPersonResult.recordId);

if (!created || created.person.name !== newPersonName) {
  console.error("New person record did not persist after reload.");
  process.exit(1);
}

if (created.record.complianceType !== "DBS" || created.record.expiryDate !== todayLondon) {
  console.error("New record fields did not persist correctly.");
  process.exit(1);
}

await signOut();

await signInAs(viewerEmail);

if (canAddComplianceRecord()) {
  console.error("Viewer must not have canAddComplianceRecord().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerAttempt = await viewerStore.createComplianceRecord({
  name: "Viewer Blocked Person",
  role: "Volunteer",
  complianceType: "DBS",
  expiryDate: todayLondon,
});

if (viewerAttempt.ok) {
  console.error("Viewer createComplianceRecord should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud create compliance record smoke test: OK");
console.log(`  New person: ${newPersonName} -> ${newPersonResult.recordId}`);
console.log(`  Existing person merge: alex volunteer -> ${existingResult.recordId}`);
console.log("  Blank name: validation_error");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
