/**
 * V6 Phase 44: Edge Function delivery idempotency verification.
 * Static checks for duplicate-send protection via reminder_delivery_logs lookup,
 * skip outcome contract, and safeguards (no send, no log write, no mark-as-sent).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const functionPath = join(
  root,
  "supabase",
  "functions",
  "send-reminder-deliveries",
  "index.ts",
);
const schemaMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260401000006_create_reminder_delivery_logs.sql",
);
const manualDeliveryExecutionPath = join(
  root,
  "js/app/automation/manual-delivery-execution.js",
);
const manualDeliveryUiPath = join(root, "js/app/automation/manual-delivery-ui.js");
const packageJsonPath = join(root, "package.json");

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

function assert(condition, label) {
  if (!condition) {
    fail(label);
  }
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    fail(`${label}: must not contain ${JSON.stringify(needle)}`);
  }
}

/**
 * @param {string} source
 * @param {string} startNeedle
 * @param {string} endNeedle
 * @returns {string}
 */
function extractBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);

  if (start === -1) {
    return "";
  }

  const end = source.indexOf(endNeedle, start + startNeedle.length);

  if (end === -1) {
    return source.slice(start);
  }

  return source.slice(start, end);
}

console.log(
  "V6 Phase 44 Edge Function delivery idempotency verification (verify-edge-delivery-idempotency)\n",
);

assert(existsSync(functionPath), "supabase/functions/send-reminder-deliveries/index.ts exists");
assert(existsSync(schemaMigrationPath), "reminder_delivery_logs schema migration exists");

const functionSource = readFileSync(functionPath, "utf8");
const schemaMigration = readFileSync(schemaMigrationPath, "utf8");
const manualDeliveryExecutionJs = readFileSync(manualDeliveryExecutionPath, "utf8");
const manualDeliveryUiJs = readFileSync(manualDeliveryUiPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-edge-delivery-idempotency"',
  "package.json verify-edge-delivery-idempotency script",
);

console.log("--- Edge Function idempotency check (required) ---");

assertContains(
  functionSource,
  "hasExistingDeliveredReminderToday",
  "index.ts has hasExistingDeliveredReminderToday helper",
);
assertContains(
  functionSource,
  'from("reminder_delivery_logs")',
  "index.ts queries reminder_delivery_logs for idempotency",
);
assertContains(
  functionSource,
  '.eq("delivery_status", "delivered")',
  "index.ts checks for delivered status only",
);
assertContains(
  functionSource,
  'filter("metadata->>reminderWindow", "eq", reminderWindow)',
  "index.ts filters by metadata.reminderWindow",
);
assertContains(
  functionSource,
  "getUtcDayBounds",
  "index.ts defines UTC day bounds helper",
);
assertContains(
  functionSource,
  '.gte("delivered_at", start)',
  "index.ts scopes idempotency to delivered_at UTC day start",
);
assertContains(
  functionSource,
  '.lt("delivered_at", end)',
  "index.ts scopes idempotency to delivered_at UTC day end",
);
assertContains(
  functionSource,
  'skipReason: "already_sent"',
  "index.ts returns skipReason already_sent for duplicates",
);

const idempotencyBranch = extractBetween(
  functionSource,
  "if (alreadyDeliveredToday)",
  "if (attempted >= config.rateLimitPerRun)",
);

assertContains(
  idempotencyBranch,
  'deliveryStatus: "skipped"',
  "idempotency branch returns skipped deliveryStatus",
);
assertNotContains(
  idempotencyBranch,
  "sendViaResend",
  "idempotency branch does not call sendViaResend",
);
assertNotContains(
  idempotencyBranch,
  "persistDeliveryLog",
  "idempotency branch does not persist delivery log rows",
);
assertNotContains(
  idempotencyBranch,
  "mark_reminder_sent",
  "idempotency branch does not call mark_reminder_sent",
);
assertNotContains(
  idempotencyBranch,
  "maybeMarkReminderSentAfterDelivery",
  "idempotency branch does not invoke mark-as-sent helper",
);

console.log("--- schema alignment (required) ---");

assertContains(
  schemaMigration,
  "reminder_delivery_logs_dedup_idx",
  "schema has dedup unique index",
);
assertContains(
  schemaMigration,
  "metadata->>'reminderWindow'",
  "dedup index uses reminderWindow metadata",
);

console.log("--- Manual Delivery UI skipped counts (required) ---");

assertContains(
  manualDeliveryExecutionJs,
  "skipped: Number(summary.skipped ?? 0)",
  "manual-delivery-execution.js maps skipped count from Edge summary",
);
assertContains(
  manualDeliveryUiJs,
  "skipped: Number(executionSummary?.skipped ?? 0)",
  "manual-delivery-ui.js includes skipped in result summary",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-edge-delivery-idempotency: all checks OK");
console.log("  strategy: pre-send lookup on reminder_delivery_logs for delivered rows");
console.log("  dedup key: organisation_id + compliance_record_id + reminderWindow + UTC day (delivered_at)");
console.log("  outcome: skipped / already_sent — no Resend, no log insert, no mark-as-sent");
