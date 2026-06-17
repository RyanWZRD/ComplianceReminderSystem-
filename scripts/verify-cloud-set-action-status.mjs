/**
 * Cloud write smoke: set_action_status RPC (open/in_progress -> completed, completed -> open).
 * Requires migrations 20260203000002 and 20260203000017 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ACTION_STATUSES } from "../js/data/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** Open action on record 333...305 (Chase renewal paperwork). */
const TEST_ACTION_OPEN_ID = "66666666-6666-6666-6666-666666666601";

/** In-progress action — complete + restore for downstream verify scripts. */
const TEST_ACTION_IN_PROGRESS_ID = "66666666-6666-6666-6666-666666666602";

/** Completed action on record 333...303. */
const TEST_ACTION_COMPLETED_ID = "66666666-6666-6666-6666-666666666603";

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
const { canMutateData, canSetActionStatus } = await import("../js/app/permissions.js");

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

// --- Editor: complete open, reopen, reject in_progress ---
await signInAs(editorEmail);

if (!canSetActionStatus()) {
  console.error("Editor must have canSetActionStatus() when CLOUD_WRITES_ENABLED=true.");
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
  console.error("Open test action should start as open (reset seed if needed).");
  process.exit(1);
}

const historyBefore = openBefore.record.history?.length ?? 0;

const completeResult = await store.setActionStatus(
  TEST_ACTION_OPEN_ID,
  ACTION_STATUSES.COMPLETED
);

if (!completeResult.ok || completeResult.status !== "updated") {
  console.error(`Complete open action failed: ${JSON.stringify(completeResult)}`);
  process.exit(1);
}

await store.load();

const afterComplete = findAction(store, TEST_ACTION_OPEN_ID);

if (!afterComplete || getActionStatus(afterComplete.action) !== ACTION_STATUSES.COMPLETED) {
  console.error("Action should be completed after RPC + reload.");
  process.exit(1);
}

if ((afterComplete.record.history?.length ?? 0) <= historyBefore) {
  console.error("History count should increase after complete.");
  process.exit(1);
}

const reopenResult = await store.setActionStatus(TEST_ACTION_OPEN_ID, ACTION_STATUSES.OPEN);

if (!reopenResult.ok || reopenResult.status !== "updated") {
  console.error(`Reopen action failed: ${JSON.stringify(reopenResult)}`);
  process.exit(1);
}

await store.load();

const afterReopen = findAction(store, TEST_ACTION_OPEN_ID);

if (!afterReopen || getActionStatus(afterReopen.action) !== ACTION_STATUSES.OPEN) {
  console.error("Action should be open after reopen + reload.");
  process.exit(1);
}

const inProgressBefore = findAction(store, TEST_ACTION_IN_PROGRESS_ID);

if (!inProgressBefore) {
  console.error(`In-progress test action ${TEST_ACTION_IN_PROGRESS_ID} not found.`);
  process.exit(1);
}

if (getActionStatus(inProgressBefore.action) !== ACTION_STATUSES.IN_PROGRESS) {
  console.error("In-progress test action should start as in_progress (reset seed if needed).");
  process.exit(1);
}

const inProgressHistoryBefore = inProgressBefore.record.history?.length ?? 0;

const inProgressComplete = await store.setActionStatus(
  TEST_ACTION_IN_PROGRESS_ID,
  ACTION_STATUSES.COMPLETED
);

if (!inProgressComplete.ok || inProgressComplete.status !== "updated") {
  console.error(
    `In-progress -> completed failed: ${JSON.stringify(inProgressComplete)}.`
  );
  process.exit(1);
}

await store.load();

const afterInProgressComplete = findAction(store, TEST_ACTION_IN_PROGRESS_ID);

if (
  !afterInProgressComplete ||
  getActionStatus(afterInProgressComplete.action) !== ACTION_STATUSES.COMPLETED
) {
  console.error("In-progress action should be completed after RPC + reload.");
  process.exit(1);
}

if ((afterInProgressComplete.record.history?.length ?? 0) <= inProgressHistoryBefore) {
  console.error("History count should increase after in-progress complete.");
  process.exit(1);
}

const inProgressReopen = await store.setActionStatus(
  TEST_ACTION_IN_PROGRESS_ID,
  ACTION_STATUSES.OPEN
);

if (!inProgressReopen.ok || inProgressReopen.status !== "updated") {
  console.error(`Restore in-progress action to open failed: ${JSON.stringify(inProgressReopen)}.`);
  process.exit(1);
}

const restoreInProgress = await store.setActionInProgress(TEST_ACTION_IN_PROGRESS_ID);

if (!restoreInProgress.ok || restoreInProgress.status !== "updated") {
  console.error(
    `Restore in-progress seed state failed: ${JSON.stringify(restoreInProgress)}.`
  );
  process.exit(1);
}

await store.load();

const afterRestoreInProgress = findAction(store, TEST_ACTION_IN_PROGRESS_ID);

if (
  !afterRestoreInProgress ||
  getActionStatus(afterRestoreInProgress.action) !== ACTION_STATUSES.IN_PROGRESS
) {
  console.error("In-progress test action should be restored to in_progress for later verify scripts.");
  process.exit(1);
}

const completedReopen = await store.setActionStatus(
  TEST_ACTION_COMPLETED_ID,
  ACTION_STATUSES.OPEN
);

if (!completedReopen.ok || completedReopen.status !== "updated") {
  console.error(`Completed -> open failed: ${JSON.stringify(completedReopen)}`);
  process.exit(1);
}

await store.setActionStatus(TEST_ACTION_COMPLETED_ID, ACTION_STATUSES.COMPLETED);

await signOut();

// --- Viewer: denied ---
await signInAs(viewerEmail);

if (canSetActionStatus()) {
  console.error("Viewer must not have canSetActionStatus().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerAttempt = await viewerStore.setActionStatus(
  TEST_ACTION_OPEN_ID,
  ACTION_STATUSES.COMPLETED
);

if (viewerAttempt.ok) {
  console.error("Viewer setActionStatus should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud set action status smoke test: OK");
console.log(`  Open action: ${TEST_ACTION_OPEN_ID} (complete + reopen verified)`);
console.log(`  In-progress action: ${TEST_ACTION_IN_PROGRESS_ID} (complete + restore verified)`);
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
