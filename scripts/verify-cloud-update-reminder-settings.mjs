/**
 * Cloud write smoke: update_reminder_settings RPC (admin only).
 * Requires migration 20260203000006 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_REMINDER_SETTINGS } from "../js/data/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

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

let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env file.");
  process.exit(1);
}

const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");
const adminEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_ADMIN") ||
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL") ||
  "alpha-admin@example.com";
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
const { CloudSettingsStore } = await import("../js/data/cloud-settings-store.js");
const { canMutateData, canMutateReminderSettings } = await import("../js/app/permissions.js");

if (canMutateData()) {
  console.error("canMutateData() must stay false in cloud mode.");
  process.exit(1);
}

const testSettings = {
  days30: true,
  days14: true,
  days7: false,
  hideSentReminders: true,
};

async function signInAs(email) {
  const result = await signInWithPassword(email, password);

  if (!result.ok) {
    console.error(`Sign-in failed (${email}): ${result.error}`);
    process.exit(1);
  }
}

// --- Admin: update + reload ---
await signInAs(adminEmail);

if (!canMutateReminderSettings()) {
  console.error("Admin must have canMutateReminderSettings() when CLOUD_WRITES_ENABLED=true.");
  process.exit(1);
}

const adminStore = new CloudSettingsStore();
const loadBefore = await adminStore.load();

if (!loadBefore.ok) {
  console.error(`Admin settings load failed: ${loadBefore.error?.message}`);
  process.exit(1);
}

const updateResult = await adminStore.updateReminderSettings(testSettings);

if (!updateResult.ok || updateResult.status !== "updated") {
  console.error(`Admin update failed: ${JSON.stringify(updateResult)}`);
  process.exit(1);
}

const reloadStore = new CloudSettingsStore();
const loadAfter = await reloadStore.load();

if (!loadAfter.ok) {
  console.error(`Reload after update failed: ${loadAfter.error?.message}`);
  process.exit(1);
}

const loaded = reloadStore.getSettings();

if (loaded.days7 !== false || loaded.hideSentReminders !== true) {
  console.error(`Settings mismatch after update: ${JSON.stringify(loaded)}`);
  process.exit(1);
}

const restoreResult = await adminStore.updateReminderSettings({
  ...DEFAULT_REMINDER_SETTINGS,
});

if (!restoreResult.ok) {
  console.error(`Restore seed settings failed: ${JSON.stringify(restoreResult)}`);
  process.exit(1);
}

await signOut();

// --- Editor: denied ---
await signInAs(editorEmail);

if (canMutateReminderSettings()) {
  console.error("Editor must not have canMutateReminderSettings().");
  process.exit(1);
}

const editorStore = new CloudSettingsStore();
await editorStore.load();

const editorAttempt = await editorStore.updateReminderSettings(testSettings);

if (editorAttempt.ok) {
  console.error("Editor updateReminderSettings should not succeed.");
  process.exit(1);
}

await signOut();

// --- Viewer: denied ---
await signInAs(viewerEmail);

if (canMutateReminderSettings()) {
  console.error("Viewer must not have canMutateReminderSettings().");
  process.exit(1);
}

const viewerStore = new CloudSettingsStore();
await viewerStore.load();

const viewerAttempt = await viewerStore.updateReminderSettings(testSettings);

if (viewerAttempt.ok) {
  console.error("Viewer updateReminderSettings should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud update reminder settings smoke test: OK");
console.log("  Admin: update + reload verified");
console.log("  Editor/viewer: RPC denied");
console.log("  Seed settings restored");
console.log("  canMutateData() remains false in cloud");
