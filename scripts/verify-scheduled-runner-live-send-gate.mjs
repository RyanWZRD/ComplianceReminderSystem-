/**
 * V6 Phase 59: Scheduled runner live-send gate verification.
 * Static checks for explicit mode gate (dry_run default; live_send refused),
 * SCHEDULED_EMAIL_SENDING_ENABLED config gate, and safety constraints
 * (no Resend, no sendReminderEmail, no mark-as-sent, no live sent_at writes).
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

console.log(
  "V6 Phase 59 scheduled runner live-send gate verification (verify-scheduled-runner-live-send-gate)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");

const functionSource = readFileSync(functionPath, "utf8");
const serveHandlerSource = functionSource.slice(functionSource.indexOf("Deno.serve"));
const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
const automatedEmailRemindersDoc = readFileSync(automatedEmailRemindersDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-scheduled-runner-live-send-gate"',
  "package.json verify-scheduled-runner-live-send-gate script",
);
assertContains(
  packageJson,
  '"verify-scheduled-runner-live-send-gate-staging"',
  "package.json verify-scheduled-runner-live-send-gate-staging script",
);

console.log("--- mode gate (required) ---");

assertContains(
  functionSource,
  'SCHEDULED_RUNNER_DRY_RUN_MODE = "dry_run"',
  "index.ts defines dry_run mode constant",
);
assertContains(
  functionSource,
  'SCHEDULED_RUNNER_LIVE_SEND_MODE = "live_send"',
  "index.ts defines live_send mode constant",
);
assertContains(functionSource, "normalizeRequestMode", "index.ts has normalizeRequestMode helper");
assertContains(
  functionSource,
  "mode: SCHEDULED_RUNNER_DRY_RUN_MODE",
  "index.ts defaults to dry_run when mode omitted",
);
assertContains(
  functionSource,
  'status: "refused"',
  "index.ts returns refused status for live_send",
);
assertContains(
  functionSource,
  "scheduled_live_send_not_enabled",
  "index.ts refuses live_send when SCHEDULED_EMAIL_SENDING_ENABLED is off",
);
assertContains(
  functionSource,
  "scheduled_live_send_not_implemented",
  "index.ts refuses live_send even when gate enabled (Phase 59)",
);
assertContains(functionSource, "409", "index.ts returns HTTP 409 for refused live_send");

assertAppearsBefore(
  serveHandlerSource,
  "SCHEDULED_RUNNER_LIVE_SEND_MODE",
  "loadReminderSettings",
  "live_send refusal is evaluated before settings load",
);
assertAppearsBefore(
  serveHandlerSource,
  'status: "refused"',
  "await insertScheduledDryRunAutomationRun",
  "live_send refusal is evaluated before automation_runs insert",
);
assertAppearsBefore(
  serveHandlerSource,
  'status: "refused"',
  "await insertScheduledDryRunDeliveryLogs",
  "live_send refusal is evaluated before reminder_delivery_logs insert",
);

console.log("--- SCHEDULED_EMAIL_SENDING_ENABLED config gate (required) ---");

assertContains(
  functionSource,
  "SCHEDULED_EMAIL_SENDING_ENABLED",
  "index.ts reads SCHEDULED_EMAIL_SENDING_ENABLED",
);
assertContains(
  functionSource,
  "parseScheduledEmailSendingEnabled",
  "index.ts parses SCHEDULED_EMAIL_SENDING_ENABLED",
);
assertContains(
  functionSource,
  "isScheduledEmailSendingEnabled",
  "index.ts gates on isScheduledEmailSendingEnabled",
);
assertContains(
  functionSource,
  'value === "true" || value === "1" || value === "yes"',
  "index.ts treats only true/1/yes as enabled",
);

console.log("--- dry_run path unchanged (required) ---");

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
assertContains(
  functionSource,
  'from("automation_runs")',
  "index.ts inserts automation_runs",
);
assertContains(
  functionSource,
  'from("reminder_delivery_logs")',
  "index.ts inserts reminder_delivery_logs",
);

console.log("--- safety gates: no email delivery or live writes (required) ---");

assertNotContains(
  functionSource,
  "email-provider",
  "scheduled-reminder-runner does not import email-provider",
);
assertNotContains(
  functionSource,
  "sendReminderEmail",
  "scheduled-reminder-runner does not call sendReminderEmail",
);

const forbiddenNeedles = [
  "api.resend.com",
  "RESEND_API_KEY",
  "sendViaResend",
  "send-reminder-deliveries",
  "mark_reminder_sent",
  "sent_at:",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(
    functionSource,
    needle,
    `scheduled-reminder-runner/index.ts has no ${needle}`,
  );
}

console.log("--- documentation (required) ---");

assertContains(
  scheduledRunnerDoc,
  "Phase 59",
  "v6-scheduled-runner.md documents Phase 59",
);
assertContains(
  scheduledRunnerDoc,
  "live_send",
  "v6-scheduled-runner.md documents live_send mode",
);
assertContains(
  scheduledRunnerDoc,
  "SCHEDULED_EMAIL_SENDING_ENABLED",
  "v6-scheduled-runner.md documents SCHEDULED_EMAIL_SENDING_ENABLED",
);
assertContains(
  scheduledRunnerDoc,
  "verify-scheduled-runner-live-send-gate",
  "v6-scheduled-runner.md references live-send gate verification script",
);
assertContains(
  automatedEmailRemindersDoc,
  "Phase 59",
  "v6-automated-email-reminders.md documents Phase 59",
);
assertContains(
  deliveryArchDoc,
  "Phase 59",
  "v6-delivery-architecture.md documents Phase 59",
);
assertContains(roadmap, "Phase 59", "ROADMAP.md documents Phase 59");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-live-send-gate: all checks OK");
console.log("  mode: dry_run default — existing Phase 52 dry-run behaviour unchanged");
console.log("  mode: live_send refused (409) — no automation_runs or delivery log writes");
console.log("  gate: SCHEDULED_EMAIL_SENDING_ENABLED defaults false");
console.log("  safety: no Resend, no sendReminderEmail, no mark-as-sent, no live sent_at writes");
