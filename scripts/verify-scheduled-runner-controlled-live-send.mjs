/**
 * V6 Phase 61: Scheduled runner controlled live-send verification.
 * Static checks for allowlisted live_send path, safety gates, delivery log audit,
 * and unchanged dry_run / live_send_preview behaviour.
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
const emailProviderPath = join(root, "supabase", "functions", "_shared", "email-provider.ts");
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
 * @param {string} needle
 * @returns {number}
 */
function countOccurrences(source, needle) {
  let count = 0;
  let index = source.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = source.indexOf(needle, index + needle.length);
  }

  return count;
}

console.log(
  "V6 Phase 61 scheduled runner controlled live-send verification (verify-scheduled-runner-controlled-live-send)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");
assert(existsSync(emailProviderPath), "supabase/functions/_shared/email-provider.ts exists");

const functionSource = readFileSync(functionPath, "utf8");
const serveHandlerSource = functionSource.slice(functionSource.indexOf("Deno.serve"));
const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
const automatedEmailRemindersDoc = readFileSync(automatedEmailRemindersDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-scheduled-runner-controlled-live-send"',
  "package.json verify-scheduled-runner-controlled-live-send script",
);
assertContains(
  packageJson,
  '"verify-scheduled-runner-controlled-live-send-staging"',
  "package.json verify-scheduled-runner-controlled-live-send-staging script",
);
assertContains(
  packageJson,
  '"verify-scheduled-runner-mark-sent-after-delivery"',
  "package.json Phase 62 mark-sent verification script",
);

console.log("--- live_send provider wiring (required) ---");

assertContains(
  functionSource,
  'from "../_shared/email-provider.ts"',
  "index.ts imports email-provider",
);
assertContains(functionSource, "sendReminderEmail", "index.ts calls sendReminderEmail");
assertContains(
  functionSource,
  "getEmailProviderConfig",
  "index.ts uses getEmailProviderConfig",
);
assertContains(
  functionSource,
  "isEmailSendingEnabled",
  "index.ts gates on isEmailSendingEnabled",
);

const sendReminderEmailCalls = countOccurrences(functionSource, "sendReminderEmail(");
assert(
  sendReminderEmailCalls === 1,
  `sendReminderEmail must be called exactly once in live_send path (found ${sendReminderEmailCalls})`,
);
assertContains(
  functionSource,
  "processAndInsertLiveSendDeliveryLogs",
  "index.ts has dedicated live_send delivery log processor",
);

console.log("--- SCHEDULED_EMAIL_SENDING_ENABLED gate (required) ---");

assertContains(
  functionSource,
  "SCHEDULED_EMAIL_SENDING_ENABLED",
  "index.ts reads SCHEDULED_EMAIL_SENDING_ENABLED",
);
assertContains(
  functionSource,
  "scheduled_live_send_not_enabled",
  "index.ts refuses live_send when SCHEDULED_EMAIL_SENDING_ENABLED is off",
);
assertAppearsBefore(
  serveHandlerSource,
  "scheduled_live_send_not_enabled",
  "loadReminderSettings",
  "live_send gate-off refusal is evaluated before settings load",
);

console.log("--- SCHEDULED_EMAIL_ALLOWLIST gate (required) ---");

assertContains(
  functionSource,
  "SCHEDULED_EMAIL_ALLOWLIST",
  "index.ts reads SCHEDULED_EMAIL_ALLOWLIST",
);
assertContains(
  functionSource,
  "parseScheduledEmailAllowlist",
  "index.ts parses SCHEDULED_EMAIL_ALLOWLIST",
);
assertContains(
  functionSource,
  "scheduled_email_allowlist_not_configured",
  "index.ts refuses when SCHEDULED_EMAIL_ALLOWLIST is missing",
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

console.log("--- delivery log audit (required) ---");

assertContains(
  functionSource,
  "scheduled_reminder_live_send",
  "index.ts uses scheduled_reminder_live_send run_type",
);
assertContains(
  functionSource,
  'delivery_status: "sent"',
  "index.ts writes sent delivery_status",
);
assertContains(
  functionSource,
  'delivery_status: "skipped"',
  "index.ts writes skipped delivery_status",
);
assertContains(
  functionSource,
  'delivery_status: "failed"',
  "index.ts writes failed delivery_status",
);
assertContains(functionSource, "provider_message_id", "index.ts writes provider_message_id");
assertContains(functionSource, "sent_at:", "index.ts writes sent_at on success");
assertContains(functionSource, "error_code:", "index.ts writes error_code on failure");
assertContains(functionSource, "error_message:", "index.ts writes error_message on failure");
assertContains(functionSource, "sendSummary", "index.ts returns sendSummary");

const liveSendProcessorSource = functionSource.slice(
  functionSource.indexOf("async function processAndInsertLiveSendDeliveryLogs"),
  functionSource.indexOf("Deno.serve"),
);

assertContains(
  liveSendProcessorSource,
  "provider_message_id: null",
  "skipped/failed rows keep provider_message_id null when not sent",
);

console.log("--- safety: mark-sent covered by Phase 62 (required) ---");

assertContains(
  packageJson,
  '"verify-scheduled-runner-mark-sent-after-delivery"',
  "package.json references Phase 62 mark-sent verification",
);

const forbiddenNeedles = [
  "send-reminder-deliveries",
  "api.resend.com",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(
    functionSource,
    needle,
    `scheduled-reminder-runner/index.ts has no ${needle}`,
  );
}

console.log("--- dry_run unchanged (required) ---");

assertContains(
  functionSource,
  "insertScheduledDryRunAutomationRun",
  "index.ts persists automation_runs on dry_run",
);
assertContains(
  functionSource,
  "insertScheduledDryRunDeliveryLogs",
  "index.ts persists reminder_delivery_logs on dry_run",
);

const dryRunProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildDryRunDeliveryLogRows"),
  functionSource.indexOf("async function loadReminderSettings"),
);

assertNotContains(
  dryRunProcessorSource,
  "sendReminderEmail",
  "dry_run path does not call sendReminderEmail",
);

console.log("--- live_send_preview unchanged (required) ---");

assertContains(
  functionSource,
  "insertScheduledLiveSendPreviewDeliveryLogs",
  "index.ts persists preview delivery logs",
);

const previewProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildLiveSendPreviewDeliveryLogRows"),
  functionSource.indexOf("async function insertScheduledLiveSendPreviewAutomationRun"),
);

assertNotContains(
  previewProcessorSource,
  "sendReminderEmail",
  "live_send_preview path does not call sendReminderEmail",
);

console.log("--- no unrestricted bulk sending (required) ---");

assert(
  !functionSource.includes("Promise.all") ||
    !liveSendProcessorSource.includes("Promise.all"),
  "live_send processor does not parallel-send with Promise.all",
);
assertContains(
  liveSendProcessorSource,
  "for (const candidate of candidates)",
  "live_send processes candidates sequentially",
);

console.log("--- documentation (required) ---");

assertContains(
  scheduledRunnerDoc,
  "Phase 61",
  "v6-scheduled-runner.md documents Phase 61",
);
assertContains(
  scheduledRunnerDoc,
  "SCHEDULED_EMAIL_ALLOWLIST",
  "v6-scheduled-runner.md documents SCHEDULED_EMAIL_ALLOWLIST",
);
assertContains(
  scheduledRunnerDoc,
  "verify-scheduled-runner-controlled-live-send",
  "v6-scheduled-runner.md references controlled live-send verification script",
);
assertContains(
  automatedEmailRemindersDoc,
  "Phase 61",
  "v6-automated-email-reminders.md documents Phase 61",
);
assertContains(
  deliveryArchDoc,
  "Phase 61",
  "v6-delivery-architecture.md documents Phase 61",
);
assertContains(roadmap, "Phase 61", "ROADMAP.md documents Phase 61");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-controlled-live-send: all checks OK");
console.log("  mode: live_send — allowlisted recipients only with delivery log audit");
console.log("  gates: SCHEDULED_EMAIL_SENDING_ENABLED + EMAIL_SENDING_ENABLED + allowlist");
console.log("  safety: allowlist + delivery log audit; mark-sent verified by Phase 62 scripts");
console.log("  dry_run and live_send_preview unchanged (no sendReminderEmail)");
