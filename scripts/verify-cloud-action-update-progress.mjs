/**
 * Cloud write smoke: set_action_in_progress + update_action RPCs.
 * Requires migrations 20260203000010 and 20260203000011 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ACTION_STATUSES, HISTORY_ACTIONS } from "../js/data/constants.js";
import { buildActionInProgressHistoryDescription } from "../js/data/set-action-in-progress.js";
import {
  buildActionUpdatedHistoryDescription,
  validateUpdateActionInput,
} from "../js/data/update-action.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** Open action — open -> in_progress. */
const TEST_ACTION_OPEN_ID = "66666666-6666-6666-6666-666666666601";

/** In-progress action — metadata update + repeat in_progress. */
const TEST_ACTION_IN_PROGRESS_ID = "66666666-6666-6666-6666-666666666602";

/** Completed action — in_progress transition must be rejected. */
const TEST_ACTION_COMPLETED_ID = "66666666-6666-6666-6666-666666666603";

const MISSING_ACTION_ID = "66666666-6666-6666-6666-666666666699";

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
 * @param {object | undefined | null} actionItem
 * @returns {string}
 */
function getActionStatus(actionItem) {
  if (!actionItem) {
    return ACTION_STATUSES.OPEN;
  }

  if (
    actionItem.status === ACTION_STATUSES.IN_PROGRESS ||
    actionItem.status === ACTION_STATUSES.COMPLETED ||
    actionItem.status === ACTION_STATUSES.OPEN
  ) {
    return actionItem.status;
  }

  return actionItem.completed ? ACTION_STATUSES.COMPLETED : ACTION_STATUSES.OPEN;
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

const openBefore = findAction(store, TEST_ACTION_OPEN_ID);

if (!openBefore) {
  console.error(`Open test action ${TEST_ACTION_OPEN_ID} not found.`);
  process.exit(1);
}

if (getActionStatus(openBefore.action) !== ACTION_STATUSES.OPEN) {
  console.error("Open test action should start as open (run reset-alpha-staging-data if needed).");
  process.exit(1);
}

const openTitle = openBefore.action.title;
const historyBefore = openBefore.record.history?.length ?? 0;

const progressResult = await store.setActionInProgress(TEST_ACTION_OPEN_ID);

if (!progressResult.ok || progressResult.status !== "updated") {
  console.error(`set_action_in_progress failed: ${JSON.stringify(progressResult)}`);
  process.exit(1);
}

await store.load();

const afterProgress = findAction(store, TEST_ACTION_OPEN_ID);

if (!afterProgress || getActionStatus(afterProgress.action) !== ACTION_STATUSES.IN_PROGRESS) {
  console.error("Action should be in_progress after RPC + reload.");
  process.exit(1);
}

if (afterProgress.action.completed || afterProgress.action.completedAt) {
  console.error("completed/completed_at should be cleared for in_progress.");
  process.exit(1);
}

const progressHistory = (afterProgress.record.history || []).find(
  (entry) =>
    entry.action === HISTORY_ACTIONS.ACTION_UPDATED &&
    entry.description === buildActionInProgressHistoryDescription(openTitle)
);

if (!progressHistory) {
  console.error("Expected action_updated history for in progress.");
  process.exit(1);
}

if ((afterProgress.record.history?.length ?? 0) <= historyBefore) {
  console.error("History count should increase after set_action_in_progress.");
  process.exit(1);
}

const repeatProgress = await store.setActionInProgress(TEST_ACTION_OPEN_ID);

if (!repeatProgress.ok || repeatProgress.status !== "no_changes") {
  console.error(`Repeat in_progress should be no_changes, got ${JSON.stringify(repeatProgress)}.`);
  process.exit(1);
}

const completedAttempt = await store.setActionInProgress(TEST_ACTION_COMPLETED_ID);

if (
  !completedAttempt.ok ||
  completedAttempt.status !== "invalid_transition"
) {
  console.error(
    `Completed -> in_progress should be invalid_transition, got ${JSON.stringify(completedAttempt)}.`
  );
  process.exit(1);
}

const missingAttempt = await store.setActionInProgress(MISSING_ACTION_ID);

if (!missingAttempt.ok || missingAttempt.status !== "not_found") {
  console.error(`Missing action should be not_found, got ${JSON.stringify(missingAttempt)}.`);
  process.exit(1);
}

const inProgressBefore = findAction(store, TEST_ACTION_IN_PROGRESS_ID);

if (!inProgressBefore) {
  console.error(`In-progress test action ${TEST_ACTION_IN_PROGRESS_ID} not found.`);
  process.exit(1);
}

const inProgressTitle = inProgressBefore.action.title;
const inProgressStatusBefore = getActionStatus(inProgressBefore.action);
const inProgressCompletedBefore = Boolean(inProgressBefore.action.completed);
const inProgressCompletedAtBefore = inProgressBefore.action.completedAt ?? null;
const inProgressNotesBefore = inProgressBefore.action.notes || "";
const inProgressOwnerBefore = inProgressBefore.action.owner || "";
const inProgressDueBefore = inProgressBefore.action.dueDate ?? null;

const blankValidation = validateUpdateActionInput({ title: "" });

if (blankValidation.valid) {
  console.error("Client validation should reject blank title.");
  process.exit(1);
}

const blankUpdate = await store.updateAction({
  actionId: TEST_ACTION_IN_PROGRESS_ID,
  title: "",
});

if (!blankUpdate.ok || blankUpdate.status !== "validation_error") {
  console.error(`Blank title should be validation_error, got ${JSON.stringify(blankUpdate)}.`);
  process.exit(1);
}

const noChangesUpdate = await store.updateAction({
  actionId: TEST_ACTION_IN_PROGRESS_ID,
  title: inProgressTitle,
  notes: inProgressNotesBefore,
  dueDate: inProgressDueBefore,
  owner: inProgressOwnerBefore,
});

if (!noChangesUpdate.ok || noChangesUpdate.status !== "no_changes") {
  console.error(`Unchanged metadata should be no_changes, got ${JSON.stringify(noChangesUpdate)}.`);
  process.exit(1);
}

const updatedNotes = `${inProgressNotesBefore} P35B verify.`.trim();
const updatedOwner = inProgressOwnerBefore ? `${inProgressOwnerBefore} (edited)` : "Verifier";

const updateResult = await store.updateAction({
  actionId: TEST_ACTION_IN_PROGRESS_ID,
  title: inProgressTitle,
  notes: updatedNotes,
  dueDate: inProgressDueBefore,
  owner: updatedOwner,
});

if (!updateResult.ok || updateResult.status !== "updated") {
  console.error(`update_action failed: ${JSON.stringify(updateResult)}.`);
  process.exit(1);
}

await store.load();

const afterUpdate = findAction(store, TEST_ACTION_IN_PROGRESS_ID);

if (!afterUpdate) {
  console.error("In-progress action missing after update + reload.");
  process.exit(1);
}

if (afterUpdate.action.notes !== updatedNotes || afterUpdate.action.owner !== updatedOwner) {
  console.error("Metadata fields did not persist after update_action.");
  process.exit(1);
}

if (getActionStatus(afterUpdate.action) !== inProgressStatusBefore) {
  console.error("update_action must not change status.");
  process.exit(1);
}

if (
  Boolean(afterUpdate.action.completed) !== inProgressCompletedBefore ||
  (afterUpdate.action.completedAt ?? null) !== inProgressCompletedAtBefore
) {
  console.error("update_action must not change completed/completed_at.");
  process.exit(1);
}

const updateHistory = (afterUpdate.record.history || []).find(
  (entry) =>
    entry.action === HISTORY_ACTIONS.ACTION_UPDATED &&
    entry.description === buildActionUpdatedHistoryDescription(inProgressTitle)
);

if (!updateHistory) {
  console.error("Expected action_updated history for metadata update.");
  process.exit(1);
}

const openAfterOtherUpdate = findAction(store, TEST_ACTION_OPEN_ID);

if (
  !openAfterOtherUpdate ||
  getActionStatus(openAfterOtherUpdate.action) !== ACTION_STATUSES.IN_PROGRESS ||
  openAfterOtherUpdate.action.completed ||
  openAfterOtherUpdate.action.completedAt
) {
  console.error("update_action on another action should not affect other actions.");
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

const viewerProgress = await viewerStore.setActionInProgress(TEST_ACTION_OPEN_ID);

if (viewerProgress.ok) {
  console.error("Viewer setActionInProgress should not succeed.");
  process.exit(1);
}

const viewerUpdate = await viewerStore.updateAction({
  actionId: TEST_ACTION_IN_PROGRESS_ID,
  title: inProgressTitle,
  notes: "Viewer blocked",
});

if (viewerUpdate.ok) {
  console.error("Viewer updateAction should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud action update/in-progress smoke test: OK");
console.log(`  Open action: ${TEST_ACTION_OPEN_ID} -> in_progress`);
console.log("  Repeat in_progress: no_changes");
console.log("  Completed -> in_progress: invalid_transition");
console.log("  Missing action: not_found");
console.log(`  Metadata update: ${TEST_ACTION_IN_PROGRESS_ID} (status/completed unchanged)`);
console.log("  Blank title: validation_error; unchanged: no_changes");
console.log("  action_updated history verified");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
