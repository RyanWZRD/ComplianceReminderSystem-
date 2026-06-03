/**
 * Cloud write smoke: delete_evidence RPC (editor delete, viewer denied, not_found).
 * Requires migration 20260203000014 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HISTORY_ACTIONS } from "../js/data/constants.js";
import { buildEvidenceDeletedHistoryDescription } from "../js/data/delete-evidence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** DBS record on Alex Volunteer — no seed evidence. */
const TEST_RECORD_ID = "33333333-3333-3333-3333-333333333301";

const MISSING_EVIDENCE_ID = "55555555-5555-5555-5555-555555559999";

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
 * @param {string} evidenceId
 */
function findEvidence(store, evidenceId) {
  for (const person of store.people) {
    for (const record of person.complianceRecords) {
      for (const item of record.evidence || []) {
        if (String(item.id) === evidenceId) {
          return { person, record, evidence: item };
        }
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
const { canMutateData, canMutateEvidence } = await import("../js/app/permissions.js");

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

if (!canMutateEvidence()) {
  console.error("Editor must have canMutateEvidence() when CLOUD_WRITES_ENABLED=true.");
  process.exit(1);
}

const store = new CloudComplianceStore();
const loadBefore = await store.load();

if (!loadBefore.ok) {
  console.error(`Editor load failed: ${loadBefore.error?.message}`);
  process.exit(1);
}

const target = findRecord(store, TEST_RECORD_ID);

if (!target) {
  console.error(`Test record ${TEST_RECORD_ID} not found.`);
  process.exit(1);
}

const notFoundResult = await store.deleteEvidence(MISSING_EVIDENCE_ID);

if (!notFoundResult.ok || notFoundResult.status !== "not_found") {
  console.error(
    `Expected not_found for missing evidence, got ${JSON.stringify(notFoundResult)}.`
  );
  process.exit(1);
}

const evidenceName = `P36B Verify ${Date.now()}`;
const documentType = "Training Certificate";
const historyBefore = target.record.history?.length ?? 0;
const evidenceBefore = target.record.evidence?.length ?? 0;

const createResult = await store.createEvidence({
  recordId: TEST_RECORD_ID,
  name: evidenceName,
  documentType,
  notes: "Verify delete script",
});

if (!createResult.ok || createResult.status !== "created") {
  console.error(`Create evidence failed: ${JSON.stringify(createResult)}`);
  process.exit(1);
}

const createdEvidenceId = createResult.evidenceId;

if (!createdEvidenceId) {
  console.error("create_evidence should return evidence_id.");
  process.exit(1);
}

await store.load();

const afterCreate = findEvidence(store, createdEvidenceId);

if (!afterCreate) {
  console.error("Created evidence not found after reload.");
  process.exit(1);
}

if ((afterCreate.record.evidence?.length ?? 0) !== evidenceBefore + 1) {
  console.error("Evidence count should increase by one after create.");
  process.exit(1);
}

const deleteResult = await store.deleteEvidence(createdEvidenceId);

if (!deleteResult.ok || deleteResult.status !== "deleted") {
  console.error(`Delete evidence failed: ${JSON.stringify(deleteResult)}`);
  process.exit(1);
}

await store.load();

const afterDelete = findEvidence(store, createdEvidenceId);

if (afterDelete) {
  console.error("Evidence should be removed after delete + reload.");
  process.exit(1);
}

const recordAfterDelete = findRecord(store, TEST_RECORD_ID);

if (!recordAfterDelete) {
  console.error("Test record missing after delete.");
  process.exit(1);
}

const expectedDeletedHistory = buildEvidenceDeletedHistoryDescription(documentType);
const deletedHistory = (recordAfterDelete.record.history || []).find(
  (entry) =>
    entry.action === HISTORY_ACTIONS.EVIDENCE_DELETED &&
    entry.description === expectedDeletedHistory
);

if (!deletedHistory) {
  console.error(`Expected evidence_deleted history: ${expectedDeletedHistory}`);
  process.exit(1);
}

if ((recordAfterDelete.record.history?.length ?? 0) <= historyBefore) {
  console.error("History count should increase after delete (evidence_deleted entry).");
  process.exit(1);
}

if ((recordAfterDelete.record.evidence?.length ?? 0) !== evidenceBefore) {
  console.error("Evidence count should return to pre-create total after delete.");
  process.exit(1);
}

await signOut();

await signInAs(viewerEmail);

if (canMutateEvidence()) {
  console.error("Viewer must not have canMutateEvidence().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerDelete = await viewerStore.deleteEvidence(createdEvidenceId);

if (viewerDelete.ok) {
  console.error("Viewer deleteEvidence should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud delete evidence smoke test: OK");
console.log(`  Record: ${TEST_RECORD_ID}`);
console.log(`  Created then deleted: ${evidenceName} (${createdEvidenceId})`);
console.log("  evidence_deleted history verified");
console.log("  Delete removed evidence; counts restored");
console.log("  Missing evidence: not_found");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
console.log("  Reset restores canonical counts (run reset-alpha-staging-data.mjs)");
