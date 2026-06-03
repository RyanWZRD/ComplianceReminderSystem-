/**
 * Cloud write smoke: create_action + delete_action RPCs (editor create/delete, viewer denied).
 * Requires migrations 20260203000008 and 20260203000009 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ACTION_STATUSES, HISTORY_ACTIONS } from "../js/data/constants.js";
import {
  buildActionAddedHistoryDescription,
  validateCreateActionInput,
} from "../js/data/create-action.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** DBS record on Alex Volunteer — no seed actions. */
const TEST_RECORD_ID = "33333333-3333-3333-3333-333333333301";

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
 * @param {string} actionId
 */
function findAction(store, actionId) {
  for (const person of store.people) {
    for (const record of person.complianceRecords) {
      for (const action of record.actions || []) {
        if (String(action.id) === actionId) {
          return { person, record, action };
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
const { canMutateActions, canMutateData } = await import("../js/app/permissions.js");

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

if (!canMutateActions()) {
  console.error("Editor must have canMutateActions() when CLOUD_WRITES_ENABLED=true.");
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

const actionTitle = `P35A Verify ${Date.now()}`;
const blankValidation = validateCreateActionInput({ title: "" });

if (blankValidation.valid) {
  console.error("Client validation should reject blank title.");
  process.exit(1);
}

const blankRpc = await store.createAction({
  recordId: TEST_RECORD_ID,
  title: "",
});

if (!blankRpc.ok || blankRpc.status !== "validation_error") {
  console.error(`Expected validation_error for blank title, got ${JSON.stringify(blankRpc)}.`);
  process.exit(1);
}

const historyBefore = target.record.history?.length ?? 0;
const actionsBefore = target.record.actions?.length ?? 0;

const createResult = await store.createAction({
  recordId: TEST_RECORD_ID,
  title: actionTitle,
  notes: "Verify script note",
  dueDate: null,
  owner: "Editor",
});

if (!createResult.ok || createResult.status !== "created") {
  console.error(`Create action failed: ${JSON.stringify(createResult)}`);
  process.exit(1);
}

const createdActionId = createResult.actionId;

if (!createdActionId) {
  console.error("create_action should return action_id.");
  process.exit(1);
}

await store.load();

const afterCreate = findAction(store, createdActionId);

if (!afterCreate) {
  console.error("Created action not found after reload.");
  process.exit(1);
}

if (afterCreate.action.title !== actionTitle) {
  console.error("Created action title mismatch after reload.");
  process.exit(1);
}

if (
  afterCreate.action.status !== ACTION_STATUSES.OPEN ||
  afterCreate.action.completed
) {
  console.error("Created action should be open and not completed.");
  process.exit(1);
}

const expectedAddedHistory = buildActionAddedHistoryDescription(actionTitle);
const addedHistory = (afterCreate.record.history || []).find(
  (entry) =>
    entry.action === HISTORY_ACTIONS.ACTION_ADDED &&
    entry.description === expectedAddedHistory
);

if (!addedHistory) {
  console.error(`Expected action_added history: ${expectedAddedHistory}`);
  process.exit(1);
}

if ((afterCreate.record.history?.length ?? 0) <= historyBefore) {
  console.error("History count should increase after create.");
  process.exit(1);
}

if ((afterCreate.record.actions?.length ?? 0) !== actionsBefore + 1) {
  console.error("Action count should increase by one after create.");
  process.exit(1);
}

const deleteResult = await store.deleteAction(createdActionId);

if (!deleteResult.ok || deleteResult.status !== "deleted") {
  console.error(`Delete action failed: ${JSON.stringify(deleteResult)}`);
  process.exit(1);
}

await store.load();

const afterDelete = findAction(store, createdActionId);

if (afterDelete) {
  console.error("Action should be removed after delete + reload.");
  process.exit(1);
}

const recordAfterDelete = findRecord(store, TEST_RECORD_ID);

if (!recordAfterDelete) {
  console.error("Test record missing after delete.");
  process.exit(1);
}

const deletedHistory = (recordAfterDelete.record.history || []).find(
  (entry) =>
    entry.action === HISTORY_ACTIONS.ACTION_DELETED &&
    entry.description === `Action deleted: ${actionTitle}.`
);

if (!deletedHistory) {
  console.error("Expected action_deleted history entry after delete.");
  process.exit(1);
}

if ((recordAfterDelete.record.actions?.length ?? 0) !== actionsBefore) {
  console.error("Action count should return to pre-create total after delete.");
  process.exit(1);
}

await signOut();

await signInAs(viewerEmail);

if (canMutateActions()) {
  console.error("Viewer must not have canMutateActions().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerCreate = await viewerStore.createAction({
  recordId: TEST_RECORD_ID,
  title: "Viewer blocked action",
});

if (viewerCreate.ok) {
  console.error("Viewer createAction should not succeed.");
  process.exit(1);
}

const viewerDelete = await viewerStore.deleteAction(createdActionId);

if (viewerDelete.ok) {
  console.error("Viewer deleteAction should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud create/delete action smoke test: OK");
console.log(`  Record: ${TEST_RECORD_ID}`);
console.log(`  Created action: ${actionTitle} (${createdActionId})`);
console.log("  action_added + action_deleted history verified");
console.log("  Delete removed action; counts restored");
console.log("  Blank title: validation_error");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
