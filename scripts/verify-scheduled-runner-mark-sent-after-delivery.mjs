/**
 * V6 Phase 62: Scheduled runner mark-sent-after-delivery verification.
 * Static checks for live_send mark_reminder_sent after successful send + delivery log,
 * safety gates, and unchanged dry_run / live_send_preview behaviour.
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
  "scheduled-reminder-runner",
  "index.ts",
);
const markSentRpcMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260203000001_mark_reminder_sent_rpc.sql",
);
const scheduledRunnerDocPath = join(root, "docs", "v6-scheduled-runner.md");
const automatedEmailRemindersDocPath = join(
  root,
  "docs",
  "v6-automated-email-reminders.md",
);
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const roadmapPath = join(root, "ROADMAP.md");
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
 * @param {string} beforeNeedle
 * @param {string} afterNeedle
 * @param {string} label
 */
function assertAppearsBefore(source, beforeNeedle, afterNeedle, label) {
  const beforeIndex = source.indexOf(beforeNeedle);
  const afterIndex = source.indexOf(afterNeedle);

  if (beforeIndex === -1) {
    fail(`${label}: missing ${JSON.stringify(beforeNeedle)}`);
    return;
  }

  if (afterIndex === -1) {
    fail(`${label}: missing ${JSON.stringify(afterNeedle)}`);
    return;
  }

  if (beforeIndex >= afterIndex) {
    fail(
      `${label}: ${JSON.stringify(beforeNeedle)} must appear before ${JSON.stringify(afterNeedle)}`,
    );
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
  "V6 Phase 62 scheduled runner mark-sent-after-delivery verification (verify-scheduled-runner-mark-sent-after-delivery)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");
assert(existsSync(markSentRpcMigrationPath), "mark_reminder_sent RPC migration exists");

const functionSource = readFileSync(functionPath, "utf8");
const markSentRpcMigration = readFileSync(markSentRpcMigrationPath, "utf8");
const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
const automatedEmailRemindersDoc = readFileSync(automatedEmailRemindersDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-scheduled-runner-mark-sent-after-delivery"',
  "package.json verify-scheduled-runner-mark-sent-after-delivery script",
);
assertContains(
  packageJson,
  '"verify-scheduled-runner-mark-sent-after-delivery-staging"',
  "package.json verify-scheduled-runner-mark-sent-after-delivery-staging script",
);

const liveSendProcessorSource = extractBetween(
  functionSource,
  "async function processAndInsertLiveSendDeliveryLogs",
  "Deno.serve",
);

const markSentHelperSource = extractBetween(
  functionSource,
  "async function markReminderSentAfterLiveDelivery",
  "function buildMarkSentSummary",
);

const dryRunProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildDryRunDeliveryLogRows"),
  functionSource.indexOf("async function loadReminderSettings"),
);

const previewProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildLiveSendPreviewDeliveryLogRows"),
  functionSource.indexOf("async function insertScheduledLiveSendPreviewAutomationRun"),
);

console.log("--- mark-sent only in live_send path (required) ---");

assertContains(
  liveSendProcessorSource,
  "markReminderSentAfterLiveDelivery",
  "live_send processor calls markReminderSentAfterLiveDelivery",
);
assertContains(
  markSentHelperSource,
  "MARK_SENT_RPC",
  "markReminderSentAfterLiveDelivery uses MARK_SENT_RPC",
);
assertContains(functionSource, "MARK_SENT_RPC", "index.ts defines MARK_SENT_RPC");
assertContains(
  functionSource,
  '"mark_reminder_sent"',
  "MARK_SENT_RPC constant names mark_reminder_sent",
);
assertContains(
  liveSendProcessorSource,
  "markSentSummary",
  "live_send processor returns markSentSummary",
);
assertContains(
  functionSource,
  "completed_with_errors",
  "live_send handler can return completed_with_errors",
);

assertNotContains(
  dryRunProcessorSource,
  "mark_reminder_sent",
  "dry_run path does not call mark_reminder_sent",
);
assertNotContains(
  previewProcessorSource,
  "mark_reminder_sent",
  "live_send_preview path does not call mark_reminder_sent",
);

console.log("--- ordering: send -> delivery log -> mark-sent (required) ---");

assertContains(liveSendProcessorSource, "sendReminderEmail", "live_send calls sendReminderEmail");
assertContains(
  liveSendProcessorSource,
  'delivery_status: "sent"',
  "live_send writes sent delivery_status",
);

assertAppearsBefore(
  liveSendProcessorSource,
  "sendReminderEmail(",
  "markReminderSentAfterLiveDelivery(",
  "sendReminderEmail before markReminderSentAfterLiveDelivery",
);
assertAppearsBefore(
  liveSendProcessorSource,
  'delivery_status: "sent"',
  "markReminderSentAfterLiveDelivery(",
  "sent delivery log insert before markReminderSentAfterLiveDelivery",
);

const sentBranch = extractBetween(
  liveSendProcessorSource,
  'if (providerResult.status === "sent")',
  "const errorCode =",
);

assertContains(
  sentBranch,
  "markReminderSentAfterLiveDelivery",
  "mark-as-sent runs only in provider sent branch",
);

const sentBranchBeforeMark = sentBranch.slice(
  0,
  sentBranch.indexOf("markReminderSentAfterLiveDelivery"),
);

assertContains(
  sentBranchBeforeMark,
  "reminder_delivery_logs",
  "delivery log insert precedes mark-as-sent in sent branch",
);

console.log("--- skipped/failed candidates are not marked sent (required) ---");

const missingEmailBranch = extractBetween(
  liveSendProcessorSource,
  "if (!candidate.hasEmail)",
  "const recipientEmail = normalizeEmail(candidate.email)",
);

assertNotContains(
  missingEmailBranch,
  "markReminderSentAfterLiveDelivery",
  "missing-email branch does not mark sent",
);

const notAllowlistedBranch = extractBetween(
  liveSendProcessorSource,
  "if (!allowlist.has(recipientEmail))",
  "attempted += 1",
);

assertNotContains(
  notAllowlistedBranch,
  "markReminderSentAfterLiveDelivery",
  "not-allowlisted branch does not mark sent",
);

const failedBranch = extractBetween(
  liveSendProcessorSource,
  "const errorCode =",
  "failed += 1",
);

assertNotContains(
  failedBranch,
  "markReminderSentAfterLiveDelivery",
  "failed provider branch does not mark sent",
);

console.log("--- RPC contract and caller JWT (required) ---");

assertContains(
  markSentRpcMigration,
  "create or replace function public.mark_reminder_sent",
  "RPC migration defines mark_reminder_sent",
);
assertContains(
  markSentHelperSource,
  '.rpc(MARK_SENT_RPC',
  "markReminderSentAfterLiveDelivery calls mark_reminder_sent via RPC",
);
assertNotContains(
  markSentHelperSource,
  "SUPABASE_SERVICE_ROLE_KEY",
  "mark-as-sent helper must not use service role key",
);

console.log("--- allowlist and safety gates (required) ---");

assertContains(
  functionSource,
  "SCHEDULED_EMAIL_ALLOWLIST",
  "index.ts reads SCHEDULED_EMAIL_ALLOWLIST",
);
assertContains(
  functionSource,
  'reason: "not_allowlisted"',
  "index.ts skips non-allowlisted recipients",
);
assertContains(
  functionSource,
  'reason: "missing_email"',
  "index.ts skips missing-email candidates",
);
assertContains(
  functionSource,
  "scheduled_live_send_not_enabled",
  "index.ts refuses live_send when SCHEDULED_EMAIL_SENDING_ENABLED is off",
);

console.log("--- response shape (required) ---");

assertContains(functionSource, "markSentSummary", "index.ts returns markSentSummary");
assertContains(functionSource, "markedSent", "markSentSummary includes markedSent");

console.log("--- documentation (required) ---");

assertContains(
  scheduledRunnerDoc,
  "Phase 62",
  "v6-scheduled-runner.md documents Phase 62",
);
assertContains(
  automatedEmailRemindersDoc,
  "Phase 62",
  "v6-automated-email-reminders.md documents Phase 62",
);
assertContains(
  deliveryArchDoc,
  "Phase 62",
  "v6-delivery-architecture.md documents Phase 62",
);
assertContains(roadmap, "Phase 62", "ROADMAP.md documents Phase 62");
assertContains(
  scheduledRunnerDoc,
  "verify-scheduled-runner-mark-sent-after-delivery",
  "v6-scheduled-runner.md references mark-sent verification script",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-mark-sent-after-delivery: all checks OK");
console.log("  mode: live_send — mark_reminder_sent after successful send + delivery log only");
console.log("  safeguards: dry_run/preview/skipped/failed never mark sent");
console.log("  ordering: provider success -> sent delivery log -> mark_reminder_sent");
