/**
 * RC-002: bulk mark reminders — static app wiring + cloud record-by-record RPC loop.
 * Requires migration 20260203000001 and CLOUD_WRITES_ENABLED=true for cloud section.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REMINDER_UI_LABELS,
  getReminderSentText,
  isReminderTypeMarkedSent,
} from "../js/data/reminder-sent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const appJsPath = join(root, "app.js");

/** 14-day reminder window (~20 days expiry in seed). */
const BULK_RECORD_FOURTEEN_DAY = "33333333-3333-3333-3333-333333333302";
/** Expired record (-5 days expiry in seed). */
const BULK_RECORD_EXPIRED = "33333333-3333-3333-3333-333333333303";

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

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(label);
  }
}

function assertRegex(source, pattern, label) {
  if (!pattern.test(source)) {
    fail(label);
  }
}

console.log("RC-002 bulk mark reminders verification\n");

console.log("--- static app.js checks ---");

const appJs = readFileSync(appJsPath, "utf8");

assertContains(
  appJs,
  "async function bulkMarkSelectedRemindersSent()",
  "bulkMarkSelectedRemindersSent is async"
);

const bulkStart = appJs.indexOf("async function bulkMarkSelectedRemindersSent()");
const bulkEnd = appJs.indexOf("// Update the notes field in the main table", bulkStart);

if (bulkStart === -1 || bulkEnd === -1) {
  fail("bulkMarkSelectedRemindersSent function body");
} else {
  const bulkBody = appJs.slice(bulkStart, bulkEnd);

  assertContains(
    bulkBody,
    "if (!canMarkReminderSent())",
    "bulk uses canMarkReminderSent() permission gate"
  );

  if (bulkBody.includes("rejectIfReadOnly()")) {
    fail("bulk must not use rejectIfReadOnly() (blocks cloud editors)");
  }

  assertContains(
    bulkBody,
    "if (!isCloudMode())",
    "bulk branches on isCloudMode()"
  );

  assertContains(
    bulkBody,
    "repository.markReminderSent",
    "bulk cloud path calls repository.markReminderSent"
  );

  assertContains(
    bulkBody,
    "reloadCloudDataAfterWrite",
    "bulk cloud path reloads after writes"
  );
}

assertContains(
  appJs,
  "const markReminderControlIds = [\"bulk-mark-reminders-btn\"]",
  "applyReadOnlyMode re-enables bulk-mark-reminders-btn when canMarkReminderSent()"
);

if (failures.length > 0) {
  console.error("Static checks failed:");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("Static checks: OK");

console.log("\n--- cloud bulk RPC loop ---");

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
const { canMutateData, canMarkReminderSent } = await import("../js/app/permissions.js");

if (canMutateData()) {
  console.error("canMutateData() must stay false in cloud mode.");
  process.exit(1);
}

const reminderFourteenDay = REMINDER_UI_LABELS[14];
const reminderExpired = REMINDER_UI_LABELS.expired;

async function signInAs(email) {
  const result = await signInWithPassword(email, password);

  if (!result.ok) {
    console.error(`Sign-in failed (${email}): ${result.error}`);
    process.exit(1);
  }
}

await signInAs(editorEmail);

if (!canMarkReminderSent()) {
  console.error("Editor must have canMarkReminderSent() when CLOUD_WRITES_ENABLED=true.");
  process.exit(1);
}

const store = new CloudComplianceStore();
const loadBefore = await store.load();

if (!loadBefore.ok) {
  console.error(`Editor load failed: ${loadBefore.error?.message}`);
  process.exit(1);
}

const bulkTargets = [
  { recordId: BULK_RECORD_FOURTEEN_DAY, reminderType: reminderFourteenDay },
  { recordId: BULK_RECORD_EXPIRED, reminderType: reminderExpired },
];

for (const target of bulkTargets) {
  const found = findRecord(store, target.recordId);

  if (!found) {
    console.error(`Bulk target record ${target.recordId} not found in seed data.`);
    process.exit(1);
  }
}

let markedCount = 0;

for (const target of bulkTargets) {
  const result = await store.markReminderSent(target.recordId, target.reminderType);

  if (!result.ok) {
    console.error(`Bulk mark failed for ${target.recordId}: ${result.error}`);
    process.exit(1);
  }

  if (result.status === "marked") {
    markedCount += 1;
  } else if (result.status !== "skipped") {
    console.error(
      `Unexpected bulk mark status for ${target.recordId}: ${result.status}`
    );
    process.exit(1);
  }
}

if (markedCount === 0) {
  console.error("Expected at least one record to be marked in bulk loop.");
  process.exit(1);
}

const reloadAfter = await store.load();

if (!reloadAfter.ok) {
  console.error(`Reload after bulk mark failed: ${reloadAfter.error?.message}`);
  process.exit(1);
}

for (const target of bulkTargets) {
  const after = findRecord(store, target.recordId);

  if (!after) {
    console.error(`Record ${target.recordId} missing after bulk reload.`);
    process.exit(1);
  }

  const sentLabel = getReminderSentText(target.reminderType);

  if (!isReminderTypeMarkedSent(after.record.notes, target.reminderType)) {
    console.error(
      `Notes for ${target.recordId} should include "${sentLabel}" after bulk mark.`
    );
    process.exit(1);
  }
}

await signOut();

await signInAs(viewerEmail);

if (canMarkReminderSent()) {
  console.error("Viewer must not have canMarkReminderSent().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerAttempt = await viewerStore.markReminderSent(
  BULK_RECORD_EXPIRED,
  reminderExpired
);

if (viewerAttempt.ok) {
  console.error("Viewer bulk markReminderSent should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud bulk RPC loop: OK");
console.log(`  Records: ${BULK_RECORD_FOURTEEN_DAY}, ${BULK_RECORD_EXPIRED}`);
console.log(`  Marked in loop: ${markedCount}`);
console.log("  Viewer: RPC denied");
console.log("\nRC-002 bulk mark reminders verification: OK");
