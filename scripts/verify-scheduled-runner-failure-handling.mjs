/**
 * V6 Phase 64: Scheduled runner failure handling and retry-safe delivery statuses.
 * Static checks for live_send provider failure logging, retry posture, and unchanged
 * dry_run / live_send_preview behaviour.
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
const emailProviderPath = join(
  root,
  "supabase",
  "functions",
  "_shared",
  "email-provider.ts",
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
  "V6 Phase 64 scheduled runner failure handling verification (verify-scheduled-runner-failure-handling)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");
assert(existsSync(emailProviderPath), "supabase/functions/_shared/email-provider.ts exists");

const functionSource = readFileSync(functionPath, "utf8");
const emailProviderSource = readFileSync(emailProviderPath, "utf8");
const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
const automatedEmailRemindersDoc = readFileSync(automatedEmailRemindersDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-scheduled-runner-failure-handling"',
  "package.json verify-scheduled-runner-failure-handling script",
);
assertContains(
  packageJson,
  '"verify-scheduled-runner-failure-handling-staging"',
  "package.json verify-scheduled-runner-failure-handling-staging script",
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

const failedBranch = extractBetween(
  liveSendProcessorSource,
  "normalizeProviderError(providerResult)",
  "failed += 1",
);

console.log("--- normalizeProviderError helper (required) ---");

assertContains(
  emailProviderSource,
  "export function normalizeProviderError",
  "email-provider.ts exports normalizeProviderError",
);
assertContains(
  functionSource,
  "normalizeProviderError",
  "index.ts uses normalizeProviderError",
);
assertContains(
  failedBranch,
  "normalizeProviderError(providerResult)",
  "failed branch uses normalizeProviderError",
);

console.log("--- provider failure branch (required) ---");

assertContains(
  failedBranch,
  'delivery_status: "failed"',
  "failed branch inserts delivery_status failed",
);
assertContains(failedBranch, 'provider: "resend"', "failed branch sets provider resend");
assertContains(failedBranch, "error_code:", "failed branch sets error_code");
assertContains(failedBranch, "error_message:", "failed branch sets error_message");
assertContains(
  failedBranch,
  "provider_message_id: null",
  "failed branch sets provider_message_id null",
);
assertContains(failedBranch, "sent_at: null", "failed branch sets sent_at null");
assertContains(failedBranch, "...basePayload", "failed branch includes basePayload with asOfDate");
assertContains(failedBranch, "emailPreview:", "failed branch includes emailPreview when generated");

assertNotContains(
  failedBranch,
  "markReminderSentAfterLiveDelivery",
  "failed branch does not call markReminderSentAfterLiveDelivery",
);
assertNotContains(
  failedBranch,
  "mark_reminder_sent",
  "failed branch does not call mark_reminder_sent",
);

console.log("--- send and delivery log summaries (required) ---");

assertContains(liveSendProcessorSource, "failed += 1", "processor increments failed count");
assertContains(
  liveSendProcessorSource,
  "hasSendErrors: failed > 0",
  "processor tracks hasSendErrors",
);
assertContains(
  functionSource,
  "hasRunErrors ? \"completed_with_errors\"",
  "live_send handler returns completed_with_errors on send or mark-sent errors",
);
assertContains(
  functionSource,
  "hasMarkSentErrors || hasSendErrors",
  "completed_with_errors includes provider send failures",
);

console.log("--- retry posture: sent-only duplicate prevention (required) ---");

assertContains(
  duplicateHelperSource,
  'delivery_status", "sent"',
  "duplicate check filters delivery_status sent only",
);
assertNotContains(
  duplicateHelperSource,
  'delivery_status", "failed"',
  "duplicate check does not filter delivery_status failed",
);
assertNotContains(
  duplicateHelperSource,
  'delivery_status", "skipped"',
  "duplicate check does not filter delivery_status skipped",
);

assertContains(functionSource, "buildRetrySummary", "index.ts defines buildRetrySummary");
assertContains(functionSource, "retrySummary", "live_send response includes retrySummary");
assertContains(functionSource, "retryableFailures", "retrySummary includes retryableFailures");

console.log("--- mark-sent failure after successful send preserved (required) ---");

assertAppearsBefore(
  liveSendProcessorSource,
  'delivery_status: "sent"',
  "markReminderSentAfterLiveDelivery(",
  "sent delivery log insert before markReminderSentAfterLiveDelivery",
);
assertContains(
  functionSource,
  "hasMarkSentErrors",
  "mark-sent errors still tracked separately",
);

const sentBranch = extractBetween(
  liveSendProcessorSource,
  'if (providerResult.status === "sent")',
  "normalizeProviderError(providerResult)",
);

assertNotContains(
  sentBranch,
  'delivery_status: "failed"',
  "sent branch does not downgrade delivery log to failed",
);

console.log("--- FORCE_EMAIL_PROVIDER_FAILURE test hook (required) ---");

assertContains(
  emailProviderSource,
  "FORCE_EMAIL_PROVIDER_FAILURE",
  "email-provider.ts reads FORCE_EMAIL_PROVIDER_FAILURE",
);
assertContains(
  emailProviderSource,
  "forced_test_failure",
  "email-provider.ts returns forced_test_failure code",
);

console.log("--- dry_run and live_send_preview unchanged (required) ---");

assertNotContains(
  dryRunProcessorSource,
  "normalizeProviderError",
  "dry_run path does not use normalizeProviderError",
);
assertNotContains(
  dryRunProcessorSource,
  "retrySummary",
  "dry_run path does not return retrySummary",
);
assertNotContains(
  previewProcessorSource,
  "normalizeProviderError",
  "live_send_preview path does not use normalizeProviderError",
);
assertNotContains(
  previewProcessorSource,
  "retrySummary",
  "live_send_preview path does not return retrySummary",
);

console.log("--- documentation (required) ---");

assertContains(
  scheduledRunnerDoc,
  "Phase 64",
  "v6-scheduled-runner.md documents Phase 64",
);
assertContains(
  automatedEmailRemindersDoc,
  "Phase 64",
  "v6-automated-email-reminders.md documents Phase 64",
);
assertContains(
  deliveryArchDoc,
  "Phase 64",
  "v6-delivery-architecture.md documents Phase 64",
);
assertContains(roadmap, "Phase 64", "ROADMAP.md documents Phase 64");
assertContains(
  scheduledRunnerDoc,
  "verify-scheduled-runner-failure-handling",
  "v6-scheduled-runner.md references failure handling verification script",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-failure-handling: all checks OK");
console.log("  mode: live_send — failed delivery logs without mark_reminder_sent");
console.log("  retry: duplicate prevention checks sent only; retrySummary.retryableFailures");
console.log("  status: completed_with_errors when send or mark-sent failures occur");
console.log("  safeguards: dry_run/preview unchanged; Phase 63 duplicate prevention preserved");
