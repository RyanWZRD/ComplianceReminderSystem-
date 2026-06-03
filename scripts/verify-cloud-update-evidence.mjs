/**
 * Cloud write smoke: update_evidence RPC (editor update, viewer denied, not_found, no_changes).
 * Requires migration 20260203000015 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HISTORY_ACTIONS } from "../js/data/constants.js";
import {
  buildEvidenceUpdatedHistoryDescription,
  validateUpdateEvidenceInput,
} from "../js/data/update-evidence.js";

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

const blankValidation = validateUpdateEvidenceInput({ name: "", documentType: "" });

if (blankValidation.valid) {
  console.error("Client validation should reject blank name and document type.");
  process.exit(1);
}

const notFoundResult = await store.updateEvidence({
  evidenceId: MISSING_EVIDENCE_ID,
  name: "Missing",
  documentType: "Other",
});

if (!notFoundResult.ok || notFoundResult.status !== "not_found") {
  console.error(
    `Expected not_found for missing evidence, got ${JSON.stringify(notFoundResult)}.`
  );
  process.exit(1);
}

const evidenceName = `P36C Verify ${Date.now()}`;
const documentType = "Training Certificate";
const updatedName = `${evidenceName} Updated`;
const updatedType = "Policy Acknowledgement";
const historyBefore = target.record.history?.length ?? 0;
const evidenceBefore = target.record.evidence?.length ?? 0;

const createResult = await store.createEvidence({
  recordId: TEST_RECORD_ID,
  name: evidenceName,
  documentType,
  notes: "Verify update script",
  fileName: "verify-metadata-only.pdf",
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

if (afterCreate.evidence.fileData !== null) {
  console.error("Cloud evidence should not include fileData after reload.");
  process.exit(1);
}

const fileNameBefore = afterCreate.evidence.fileName;

const blankNameRpc = await store.updateEvidence({
  evidenceId: createdEvidenceId,
  name: "",
  documentType: "Other",
});

if (!blankNameRpc.ok || blankNameRpc.status !== "validation_error") {
  console.error(`Expected validation_error for blank name, got ${JSON.stringify(blankNameRpc)}.`);
  process.exit(1);
}

const noChangesRpc = await store.updateEvidence({
  evidenceId: createdEvidenceId,
  name: evidenceName,
  documentType,
  notes: "Verify update script",
  addedDate: afterCreate.evidence.addedDate,
  fileName: fileNameBefore,
});

if (!noChangesRpc.ok || noChangesRpc.status !== "no_changes") {
  console.error(`Unchanged metadata should be no_changes, got ${JSON.stringify(noChangesRpc)}.`);
  process.exit(1);
}

const updateResult = await store.updateEvidence({
  evidenceId: createdEvidenceId,
  name: updatedName,
  documentType: updatedType,
  notes: "Updated by verify script",
  addedDate: afterCreate.evidence.addedDate,
  fileName: fileNameBefore,
});

if (!updateResult.ok || updateResult.status !== "updated") {
  console.error(`Update evidence failed: ${JSON.stringify(updateResult)}`);
  process.exit(1);
}

await store.load();

const afterUpdate = findEvidence(store, createdEvidenceId);

if (!afterUpdate) {
  console.error("Evidence missing after update + reload.");
  process.exit(1);
}

if (afterUpdate.evidence.name !== updatedName) {
  console.error("Updated evidence name mismatch after reload.");
  process.exit(1);
}

if (afterUpdate.evidence.documentType !== updatedType) {
  console.error("Updated evidence document type mismatch after reload.");
  process.exit(1);
}

if (afterUpdate.evidence.fileData !== null) {
  console.error("fileData must remain null in cloud after update.");
  process.exit(1);
}

if (afterUpdate.evidence.fileName !== fileNameBefore) {
  console.error("file_name metadata should be unchanged (no file replacement).");
  process.exit(1);
}

const expectedUpdatedHistory = buildEvidenceUpdatedHistoryDescription(updatedType);
const updatedHistory = (afterUpdate.record.history || []).find(
  (entry) =>
    entry.action === HISTORY_ACTIONS.EVIDENCE_UPDATED &&
    entry.description === expectedUpdatedHistory
);

if (!updatedHistory) {
  console.error(`Expected evidence_updated history: ${expectedUpdatedHistory}`);
  process.exit(1);
}

if ((afterUpdate.record.history?.length ?? 0) <= historyBefore) {
  console.error("History count should increase after update (evidence_updated entry).");
  process.exit(1);
}

if ((afterUpdate.record.evidence?.length ?? 0) !== evidenceBefore + 1) {
  console.error("Evidence count should be pre-create total + 1 after update.");
  process.exit(1);
}

const deleteResult = await store.deleteEvidence(createdEvidenceId);

if (!deleteResult.ok || deleteResult.status !== "deleted") {
  console.error(`Cleanup delete failed: ${JSON.stringify(deleteResult)}`);
  process.exit(1);
}

await store.load();

if (findEvidence(store, createdEvidenceId)) {
  console.error("Temporary evidence should be removed after cleanup delete.");
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

const viewerUpdate = await viewerStore.updateEvidence({
  evidenceId: createdEvidenceId,
  name: "Viewer blocked",
  documentType: "Other",
});

if (viewerUpdate.ok) {
  console.error("Viewer updateEvidence should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud update evidence smoke test: OK");
console.log(`  Record: ${TEST_RECORD_ID}`);
console.log(`  Created, updated, deleted: ${evidenceName} (${createdEvidenceId})`);
console.log("  evidence_updated history verified");
console.log("  Updated metadata visible after reload; fileData untouched");
console.log("  Blank name: validation_error; unchanged: no_changes; missing: not_found");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
console.log("  Reset restores canonical counts (run reset-alpha-staging-data.mjs)");
