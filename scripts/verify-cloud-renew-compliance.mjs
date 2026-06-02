/**
 * Cloud write smoke: renew_compliance RPC (suggested + custom).
 * Requires migration 20260203000003 and CLOUD_WRITES_ENABLED=true.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HISTORY_ACTIONS } from "../js/data/constants.js";
import {
  getLondonDateISOString,
  RENEWAL_MODES,
  validateCustomRenewalDate,
} from "../js/data/renew-compliance.js";
import { dateToISOString, parseDateAtMidnight } from "../js/data/dates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** 3-years cycle, valid expiry in future. */
const TEST_RECORD_SUGGESTED_ID = "33333333-3333-3333-3333-333333333301";

/** Expired record — custom renew only. */
const TEST_RECORD_CUSTOM_ID = "33333333-3333-3333-3333-333333333303";

/** Manual renewal cycle. */
const TEST_RECORD_MANUAL_ID = "33333333-3333-3333-3333-333333333306";

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
        return record;
      }
    }
  }

  return null;
}

/**
 * @param {string} expiryDate
 * @param {string} cycle
 * @returns {string | null}
 */
function calculateSuggestedExpiryLocal(expiryDate, cycle) {
  const base = parseDateAtMidnight(expiryDate);

  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const date = new Date(base.getTime());

  if (cycle === "6-months") {
    date.setMonth(date.getMonth() + 6);
  } else if (cycle === "1-year") {
    date.setFullYear(date.getFullYear() + 1);
  } else if (cycle === "2-years") {
    date.setFullYear(date.getFullYear() + 2);
  } else if (cycle === "3-years") {
    date.setFullYear(date.getFullYear() + 3);
  } else if (cycle === "5-years") {
    date.setFullYear(date.getFullYear() + 5);
  } else {
    return null;
  }

  return dateToISOString(date);
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
const { canMutateData, canRenewCompliance } = await import("../js/app/permissions.js");

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

if (!canRenewCompliance()) {
  console.error("Editor must have canRenewCompliance() when CLOUD_WRITES_ENABLED=true.");
  process.exit(1);
}

const store = new CloudComplianceStore();
const loadBefore = await store.load();

if (!loadBefore.ok) {
  console.error(`Editor load failed: ${loadBefore.error?.message}`);
  process.exit(1);
}

const todayLondon = getLondonDateISOString();

if (!validateCustomRenewalDate(todayLondon).valid) {
  console.error("London today date failed client validation.");
  process.exit(1);
}

// --- Custom: reject date before today ---
const beforeToday = await store.renewCompliance(
  TEST_RECORD_CUSTOM_ID,
  RENEWAL_MODES.CUSTOM,
  "2000-01-01"
);

if (!beforeToday.ok || beforeToday.status !== "invalid_date") {
  console.error(`Expected invalid_date (before today), got ${JSON.stringify(beforeToday)}.`);
  process.exit(1);
}

// --- Manual: suggested unavailable ---
const manualSuggested = await store.renewCompliance(
  TEST_RECORD_MANUAL_ID,
  RENEWAL_MODES.SUGGESTED
);

if (!manualSuggested.ok || manualSuggested.status !== "suggested_unavailable") {
  console.error(
    `Manual record suggested renew should be unavailable, got ${JSON.stringify(manualSuggested)}.`
  );
  process.exit(1);
}

// --- Suggested renew on 3-years record ---
const suggestedRecord = findRecord(store, TEST_RECORD_SUGGESTED_ID);

if (!suggestedRecord) {
  console.error(`Record ${TEST_RECORD_SUGGESTED_ID} not found.`);
  process.exit(1);
}

const expectedSuggested = calculateSuggestedExpiryLocal(
  suggestedRecord.expiryDate,
  suggestedRecord.renewalCycle || "3-years"
);

if (!expectedSuggested) {
  console.error("Could not compute expected suggested expiry.");
  process.exit(1);
}

const historyBeforeSuggested = suggestedRecord.history?.length ?? 0;

const suggestedResult = await store.renewCompliance(
  TEST_RECORD_SUGGESTED_ID,
  RENEWAL_MODES.SUGGESTED
);

if (!suggestedResult.ok || suggestedResult.status !== "renewed") {
  console.error(`Suggested renew failed: ${JSON.stringify(suggestedResult)}.`);
  process.exit(1);
}

if (suggestedResult.expiryDate !== expectedSuggested) {
  console.error(
    `Suggested expiry mismatch: expected ${expectedSuggested}, got ${suggestedResult.expiryDate}.`
  );
  process.exit(1);
}

const reloadSuggested = await store.load();

if (!reloadSuggested.ok) {
  console.error(`Reload after suggested renew failed: ${reloadSuggested.error?.message}`);
  process.exit(1);
}

const afterSuggested = findRecord(store, TEST_RECORD_SUGGESTED_ID);

if (!afterSuggested) {
  console.error("Record missing after suggested renew.");
  process.exit(1);
}

if (afterSuggested.expiryDate !== expectedSuggested) {
  console.error("Reloaded expiry does not match suggested renew result.");
  process.exit(1);
}

if (!(afterSuggested.notes || "").includes("Compliance renewed")) {
  console.error("Notes should include renewal audit line after suggested renew.");
  process.exit(1);
}

const renewedHistory = (afterSuggested.history || []).filter(
  (entry) => entry.action === HISTORY_ACTIONS.RENEWED
);

if (renewedHistory.length === 0 && (afterSuggested.history?.length ?? 0) <= historyBeforeSuggested) {
  console.error("History should include renewed entry after suggested renew.");
  process.exit(1);
}

// --- Custom renew on expired record (today or later) ---
const customRecord = findRecord(store, TEST_RECORD_CUSTOM_ID);

if (!customRecord) {
  console.error(`Record ${TEST_RECORD_CUSTOM_ID} not found.`);
  process.exit(1);
}

const customTarget = todayLondon;

const customResult = await store.renewCompliance(
  TEST_RECORD_CUSTOM_ID,
  RENEWAL_MODES.CUSTOM,
  customTarget
);

if (!customResult.ok || customResult.status !== "renewed") {
  console.error(`Custom renew failed: ${JSON.stringify(customResult)}.`);
  process.exit(1);
}

if (customResult.expiryDate !== customTarget) {
  console.error(
    `Custom expiry mismatch: expected ${customTarget}, got ${customResult.expiryDate}.`
  );
  process.exit(1);
}

const reloadCustom = await store.load();

if (!reloadCustom.ok) {
  console.error(`Reload after custom renew failed: ${reloadCustom.error?.message}`);
  process.exit(1);
}

const afterCustom = findRecord(store, TEST_RECORD_CUSTOM_ID);

if (!afterCustom || afterCustom.expiryDate !== customTarget) {
  console.error("Custom renew did not persist after reload.");
  process.exit(1);
}

await signOut();

// --- Viewer denied ---
await signInAs(viewerEmail);

if (canRenewCompliance()) {
  console.error("Viewer must not have canRenewCompliance().");
  process.exit(1);
}

const viewerStore = new CloudComplianceStore();
await viewerStore.load();

const viewerAttempt = await viewerStore.renewCompliance(
  TEST_RECORD_MANUAL_ID,
  RENEWAL_MODES.CUSTOM,
  todayLondon
);

if (viewerAttempt.ok) {
  console.error("Viewer renewCompliance should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud renew compliance smoke test: OK");
console.log(`  Suggested record: ${TEST_RECORD_SUGGESTED_ID} -> ${expectedSuggested}`);
console.log(`  Custom record: ${TEST_RECORD_CUSTOM_ID} -> ${customTarget}`);
console.log("  Manual suggested: unavailable");
console.log("  Before today: invalid_date");
console.log("  Viewer: RPC denied");
console.log("  canMutateData() remains false in cloud");
