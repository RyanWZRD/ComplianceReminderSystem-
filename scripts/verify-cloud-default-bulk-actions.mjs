/**
 * Cloud write smoke: add_default_actions + bulk create_action loop (editor ok, viewer denied).
 * Requires migration 20260203000012 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_ACTION_TEMPLATES } from "../js/data/default-action-templates.js";
import {
  buildActionAddedHistoryDescription,
  validateCreateActionInput,
} from "../js/data/create-action.js";
import { HISTORY_ACTIONS } from "../js/data/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** Alex Volunteer DBS — no seed actions. */
const DEFAULTS_RECORD_ID = "33333333-3333-3333-3333-333333333301";
const BULK_RECORD_A = DEFAULTS_RECORD_ID;
const BULK_RECORD_B = "33333333-3333-3333-3333-333333333302";
const BULK_RECORD_MISSING = "00000000-0000-0000-0000-000000000099";

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
 * @param {string} recordId
 * @param {string} title
 */
function findActionByTitle(store, recordId, title) {
  const target = findRecord(store, recordId);

  if (!target) {
    return null;
  }

  const normalized = title.trim().toLowerCase();

  for (const action of target.record.actions || []) {
    if (action.title.trim().toLowerCase() === normalized) {
      return { ...target, action };
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

const defaultsTarget = findRecord(store, DEFAULTS_RECORD_ID);

if (!defaultsTarget) {
  console.error(`Defaults test record ${DEFAULTS_RECORD_ID} not found.`);
  process.exit(1);
}

const actionsBeforeDefaults = defaultsTarget.record.actions?.length ?? 0;
const historyBeforeDefaults = defaultsTarget.record.history?.length ?? 0;

const firstDefaults = await store.addDefaultActions(DEFAULTS_RECORD_ID);

if (!firstDefaults.ok || firstDefaults.status !== "completed") {
  console.error(`First add_default_actions failed: ${JSON.stringify(firstDefaults)}`);
  process.exit(1);
}

if (firstDefaults.addedCount !== DEFAULT_ACTION_TEMPLATES.length) {
  console.error(
    `Expected ${DEFAULT_ACTION_TEMPLATES.length} defaults added, got ${firstDefaults.addedCount}.`
  );
  process.exit(1);
}

if (firstDefaults.skippedCount !== 0) {
  console.error("First run should not skip any templates.");
  process.exit(1);
}

await store.load();

const afterFirstDefaults = findRecord(store, DEFAULTS_RECORD_ID);

if (!afterFirstDefaults) {
  console.error("Record missing after first default actions.");
  process.exit(1);
}

if (
  (afterFirstDefaults.record.actions?.length ?? 0) !==
  actionsBeforeDefaults + DEFAULT_ACTION_TEMPLATES.length
) {
  console.error("Action count should increase by template count after first defaults.");
  process.exit(1);
}

for (const templateTitle of DEFAULT_ACTION_TEMPLATES) {
  const match = findActionByTitle(store, DEFAULTS_RECORD_ID, templateTitle);

  if (!match) {
    console.error(`Missing default action after add: ${templateTitle}`);
    process.exit(1);
  }

  const expectedHistory = buildActionAddedHistoryDescription(templateTitle);
  const historyEntry = (match.record.history || []).find(
    (entry) =>
      entry.action === HISTORY_ACTIONS.ACTION_ADDED &&
      entry.description === expectedHistory
  );

  if (!historyEntry) {
    console.error(`Missing action_added history for template: ${templateTitle}`);
    process.exit(1);
  }
}

if ((afterFirstDefaults.record.history?.length ?? 0) < historyBeforeDefaults + DEFAULT_ACTION_TEMPLATES.length) {
  console.error("History should gain one entry per added default action.");
  process.exit(1);
}

const secondDefaults = await store.addDefaultActions(DEFAULTS_RECORD_ID);

if (!secondDefaults.ok || secondDefaults.status !== "completed") {
  console.error(`Second add_default_actions failed: ${JSON.stringify(secondDefaults)}`);
  process.exit(1);
}

if (secondDefaults.addedCount !== 0) {
  console.error("Second run should add zero default actions.");
  process.exit(1);
}

if (secondDefaults.skippedCount !== DEFAULT_ACTION_TEMPLATES.length) {
  console.error("Second run should skip all templates as duplicates.");
  process.exit(1);
}

const bulkTitle = `P35C Bulk ${Date.now()}`;
const bulkValidation = validateCreateActionInput({ title: bulkTitle });

if (!bulkValidation.valid) {
  console.error("Bulk title should pass client validation.");
  process.exit(1);
}

const bulkTargets = [
  { recordId: BULK_RECORD_A, expectCreated: true },
  { recordId: BULK_RECORD_B, expectCreated: true },
  { recordId: BULK_RECORD_MISSING, expectCreated: false },
];

let bulkCreated = 0;

for (const target of bulkTargets) {
  const result = await store.createAction({
    recordId: target.recordId,
    title: bulkTitle,
    notes: "Bulk verify note",
  });

  if (target.expectCreated) {
    if (!result.ok || result.status !== "created") {
      console.error(`Bulk create failed for ${target.recordId}: ${JSON.stringify(result)}`);
      process.exit(1);
    }

    bulkCreated += 1;
  } else if (result.ok && result.status === "created") {
    console.error("Bulk create should not succeed for missing record.");
    process.exit(1);
  } else if (!result.ok || result.status !== "not_found") {
    console.error(`Expected not_found for missing record, got ${JSON.stringify(result)}`);
    process.exit(1);
  }
}

if (bulkCreated !== 2) {
  console.error("Bulk loop should create exactly two actions (partial success).");
  process.exit(1);
}

await store.load();

for (const recordId of [BULK_RECORD_A, BULK_RECORD_B]) {
  const match = findActionByTitle(store, recordId, bulkTitle);

  if (!match) {
    console.error(`Bulk action missing on record ${recordId} after reload.`);
    process.exit(1);
  }

  const expectedHistory = buildActionAddedHistoryDescription(bulkTitle);
  const historyEntry = (match.record.history || []).find(
    (entry) =>
      entry.action === HISTORY_ACTIONS.ACTION_ADDED &&
      entry.description === expectedHistory
  );

  if (!historyEntry) {
    console.error(`Missing bulk action_added history on record ${recordId}.`);
    process.exit(1);
  }
}

await signOut();

await signInAs(viewerEmail);

if (canMutateActions()) {
  console.error("Viewer must not have canMutateActions().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerDefaults = await viewerStore.addDefaultActions(DEFAULTS_RECORD_ID);

if (viewerDefaults.ok) {
  console.error("Viewer addDefaultActions should not succeed.");
  process.exit(1);
}

const viewerBulk = await viewerStore.createAction({
  recordId: BULK_RECORD_A,
  title: "Viewer blocked bulk",
});

if (viewerBulk.ok) {
  console.error("Viewer createAction should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud default + bulk action smoke test: OK");
console.log(`  Defaults record: ${DEFAULTS_RECORD_ID}`);
console.log(`  First add_default_actions: ${DEFAULT_ACTION_TEMPLATES.length} added`);
console.log("  Second run: duplicates skipped");
console.log("  action_added history verified for each template");
console.log(`  Bulk title: ${bulkTitle}`);
console.log("  Bulk partial: 2 created, 1 not_found");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
