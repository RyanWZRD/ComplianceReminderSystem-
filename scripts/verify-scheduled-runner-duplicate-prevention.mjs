/**
 * V6 Phase 63: Scheduled runner duplicate prevention verification.
 * Static checks for live_send idempotency via reminder_delivery_logs lookup,
 * duplicate_prevented skip branch, and unchanged dry_run / live_send_preview behaviour.
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
  "V6 Phase 63 scheduled runner duplicate prevention verification (verify-scheduled-runner-duplicate-prevention)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");

const functionSource = readFileSync(functionPath, "utf8");
const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
const automatedEmailRemindersDoc = readFileSync(automatedEmailRemindersDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-scheduled-runner-duplicate-prevention"',
  "package.json verify-scheduled-runner-duplicate-prevention script",
);
assertContains(
  packageJson,
  '"verify-scheduled-runner-duplicate-prevention-staging"',
  "package.json verify-scheduled-runner-duplicate-prevention-staging script",
);

const liveSendProcessorSource = extractBetween(
  functionSource,
  "async function processAndInsertLiveSendDeliveryLogs",
  "Deno.serve",
);

const duplicateHelperSource = extractBetween(
  functionSource,
  "async function findExistingSentDeliveryLog",
  "function mapReminderUiLabelToRpcCode",
);

const dryRunProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildDryRunDeliveryLogRows"),
  functionSource.indexOf("async function loadReminderSettings"),
);

const previewProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildLiveSendPreviewDeliveryLogRows"),
  functionSource.indexOf("async function insertScheduledLiveSendPreviewAutomationRun"),
);

console.log("--- duplicate check helper (required) ---");

assertContains(
  functionSource,
  "findExistingSentDeliveryLog",
  "index.ts defines findExistingSentDeliveryLog",
);
assertContains(
  duplicateHelperSource,
  'delivery_status", "sent"',
  "duplicate check filters delivery_status sent",
);
assertContains(
  duplicateHelperSource,
  'payload->>asOfDate',
  "duplicate check filters payload.asOfDate",
);
assertContains(
  duplicateHelperSource,
  "compliance_record_id",
  "duplicate check filters compliance_record_id",
);
assertContains(
  duplicateHelperSource,
  "reminder_type",
  "duplicate check filters reminder_type",
);
assertContains(
  duplicateHelperSource,
  "recipient_email",
  "duplicate check filters recipient_email",
);
assertContains(
  duplicateHelperSource,
  "due_date",
  "duplicate check filters due_date",
);

console.log("--- ordering: duplicate check before send (required) ---");

assertAppearsBefore(
  liveSendProcessorSource,
  "findExistingSentDeliveryLog",
  "sendReminderEmail(",
  "findExistingSentDeliveryLog before sendReminderEmail",
);

const duplicateBranch = extractBetween(
  liveSendProcessorSource,
  "if (existingSentLog)",
  "attempted += 1",
);

assertContains(
  duplicateBranch,
  'reason: "duplicate_prevented"',
  "duplicate branch uses duplicate_prevented reason",
);
assertContains(
  duplicateBranch,
  "duplicateOfDeliveryLogId",
  "duplicate branch records duplicateOfDeliveryLogId",
);
assertNotContains(
  duplicateBranch,
  "sendReminderEmail",
  "duplicate branch does not call sendReminderEmail",
);
assertNotContains(
  duplicateBranch,
  "markReminderSentAfterLiveDelivery",
  "duplicate branch does not call markReminderSentAfterLiveDelivery",
);
assertNotContains(
  duplicateBranch,
  "mark_reminder_sent",
  "duplicate branch does not call mark_reminder_sent",
);

const liveSendBasePayloadSource = extractBetween(
  functionSource,
  "function buildLiveSendCandidateBasePayload",
  "async function processAndInsertLiveSendDeliveryLogs",
);

console.log("--- sent delivery logs include payload.asOfDate (required) ---");

assertContains(
  liveSendBasePayloadSource,
  "asOfDate: asOfDateIso",
  "live_send base payload includes asOfDate",
);

const sentBranch = extractBetween(
  liveSendProcessorSource,
  'if (providerResult.status === "sent")',
  "const errorCode =",
);

assertContains(
  sentBranch,
  "...basePayload",
  "sent delivery log payload spreads basePayload with asOfDate",
);

console.log("--- response shape (required) ---");

assertContains(
  functionSource,
  "duplicatePreventionSummary",
  "index.ts returns duplicatePreventionSummary",
);
assertContains(
  functionSource,
  "duplicatesPrevented",
  "duplicatePreventionSummary includes duplicatesPrevented",
);
assertContains(
  functionSource,
  "skippedDuplicate",
  "sendSummary includes skippedDuplicate",
);

console.log("--- allowlist and skip branches unchanged (required) ---");

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

const missingEmailBranch = extractBetween(
  liveSendProcessorSource,
  "if (!candidate.hasEmail)",
  "const recipientEmail = normalizeEmail(candidate.email)",
);

assertNotContains(
  missingEmailBranch,
  "findExistingSentDeliveryLog",
  "missing-email branch does not run duplicate check",
);

const notAllowlistedBranch = extractBetween(
  liveSendProcessorSource,
  "if (!allowlist.has(recipientEmail))",
  "duplicateChecked += 1",
);

assertNotContains(
  notAllowlistedBranch,
  "sendReminderEmail",
  "not-allowlisted branch does not send",
);

console.log("--- mark-sent ordering preserved (required) ---");

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

console.log("--- dry_run and live_send_preview unchanged (required) ---");

assertNotContains(
  dryRunProcessorSource,
  "findExistingSentDeliveryLog",
  "dry_run path does not use duplicate check",
);
assertNotContains(
  dryRunProcessorSource,
  "duplicate_prevented",
  "dry_run path does not use duplicate_prevented",
);
assertNotContains(
  previewProcessorSource,
  "findExistingSentDeliveryLog",
  "live_send_preview path does not use duplicate check",
);
assertNotContains(
  previewProcessorSource,
  "duplicate_prevented",
  "live_send_preview path does not use duplicate_prevented",
);

console.log("--- documentation (required) ---");

assertContains(
  scheduledRunnerDoc,
  "Phase 63",
  "v6-scheduled-runner.md documents Phase 63",
);
assertContains(
  automatedEmailRemindersDoc,
  "Phase 63",
  "v6-automated-email-reminders.md documents Phase 63",
);
assertContains(
  deliveryArchDoc,
  "Phase 63",
  "v6-delivery-architecture.md documents Phase 63",
);
assertContains(roadmap, "Phase 63", "ROADMAP.md documents Phase 63");
assertContains(
  scheduledRunnerDoc,
  "verify-scheduled-runner-duplicate-prevention",
  "v6-scheduled-runner.md references duplicate prevention verification script",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-duplicate-prevention: all checks OK");
console.log("  mode: live_send — duplicate check before sendReminderEmail");
console.log("  skip: duplicate_prevented with duplicateOfDeliveryLogId");
console.log("  safeguards: dry_run/preview unchanged; allowlist + mark-sent ordering preserved");
