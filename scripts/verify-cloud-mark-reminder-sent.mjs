/**
 * Cloud write smoke: single-record mark_reminder_sent RPC.
 * Requires migration 20260203000001 and CLOUD_WRITES_ENABLED=true.
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

/** Record with ~20 days expiry — 14-day reminder window in seed. */
const TEST_RECORD_ID = "33333333-3333-3333-3333-333333333302";

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
const { canMutateData, canMarkReminderSent } = await import("../js/app/permissions.js");

if (canMutateData()) {
  console.error("canMutateData() must stay false in cloud mode.");
  process.exit(1);
}

const reminderType = REMINDER_UI_LABELS[14];

async function signInAs(email) {
  const result = await signInWithPassword(email, password);

  if (!result.ok) {
    console.error(`Sign-in failed (${email}): ${result.error}`);
    process.exit(1);
  }
}

// --- Editor: mark or skip, then reload ---
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

const found = findRecord(store, TEST_RECORD_ID);

if (!found) {
  console.error(`Test record ${TEST_RECORD_ID} not found in seed data.`);
  process.exit(1);
}

const historyBefore = found.record.history?.length ?? 0;
const notesBefore = found.record.notes || "";
const alreadyMarked = isReminderTypeMarkedSent(notesBefore, reminderType);

const first = await store.markReminderSent(TEST_RECORD_ID, reminderType);

if (!first.ok) {
  console.error(`markReminderSent failed: ${first.error}`);
  process.exit(1);
}

if (alreadyMarked) {
  if (first.status !== "skipped") {
    console.error(`Expected skipped for already-sent record, got ${first.status}.`);
    process.exit(1);
  }
} else if (first.status !== "marked") {
  console.error(`Expected marked on first call, got ${first.status}.`);
  process.exit(1);
}

const reloadAfterFirst = await store.load();

if (!reloadAfterFirst.ok) {
  console.error(`Reload after mark failed: ${reloadAfterFirst.error?.message}`);
  process.exit(1);
}

const afterFirst = findRecord(store, TEST_RECORD_ID);

if (!afterFirst) {
  console.error("Record missing after reload.");
  process.exit(1);
}

const sentLabel = getReminderSentText(reminderType);

if (!afterFirst.record.notes.includes(sentLabel)) {
  console.error(`Notes after mark should include "${sentLabel}".`);
  process.exit(1);
}

if (!alreadyMarked && (afterFirst.record.history?.length ?? 0) <= historyBefore) {
  console.error("History count should increase after first mark.");
  process.exit(1);
}

const second = await store.markReminderSent(TEST_RECORD_ID, reminderType);

if (!second.ok || second.status !== "skipped") {
  console.error(`Second mark should be skipped, got ${JSON.stringify(second)}.`);
  process.exit(1);
}

await signOut();

// --- Viewer: denied ---
await signInAs(viewerEmail);

if (canMarkReminderSent()) {
  console.error("Viewer must not have canMarkReminderSent().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerAttempt = await viewerStore.markReminderSent(TEST_RECORD_ID, reminderType);

if (viewerAttempt.ok) {
  console.error("Viewer markReminderSent should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud mark reminder sent smoke test: OK");
console.log(`  Record: ${TEST_RECORD_ID}`);
console.log(`  Editor: ${alreadyMarked ? "idempotent skip verified" : "marked + reload verified"}`);
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
