/**
 * V6 Phase 51: Scheduled runner dry-run delivery log creation verification.
 * Static checks for reminder_delivery_logs inserts after automation_runs insert,
 * pending/skipped delivery_status only, deliveryLogSummary response, and safety gates
 * (no Resend, no email send, no mark-as-sent, no sent_at writes).
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
  "V6 Phase 51 scheduled runner delivery log dry-run verification (verify-scheduled-runner-delivery-log-dry-run)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");

const functionSource = readFileSync(functionPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

console.log("--- delivery log insert path (required) ---");

assertContains(
  functionSource,
  'from("reminder_delivery_logs")',
  "index.ts inserts into reminder_delivery_logs",
);
assertContains(
  functionSource,
  "insertScheduledDryRunDeliveryLogs",
  "index.ts has delivery log insert helper",
);
assertContains(
  functionSource,
  "buildDryRunDeliveryLogRows",
  "index.ts builds delivery log rows from candidates",
);
assertContains(
  functionSource,
  "automation_run_id",
  "index.ts links delivery logs via automation_run_id",
);
assertContains(
  functionSource,
  "delivery_log_persist_failed",
  "index.ts returns structured error on delivery log insert failure",
);
assertContains(
  functionSource,
  "deliveryLogSummary",
  "index.ts returns deliveryLogSummary in response",
);

assertAppearsBefore(
  functionSource,
  "insertScheduledDryRunAutomationRun",
  'from("reminder_delivery_logs")',
  "automation_runs insert precedes reminder_delivery_logs insert",
);
assertAppearsBefore(
  functionSource,
  '.from("automation_runs")',
  'from("reminder_delivery_logs")',
  "automation_runs table write precedes reminder_delivery_logs table write",
);

console.log("--- delivery_status pending/skipped only (required) ---");

assertContains(
  functionSource,
  'delivery_status: deliveryStatus',
  "index.ts sets delivery_status from candidate",
);
assertContains(functionSource, '"pending"', "index.ts uses pending delivery_status");
assertContains(functionSource, '"skipped"', "index.ts uses skipped delivery_status");
assertNotContains(
  functionSource,
  'delivery_status: "sent"',
  "index.ts does not set sent delivery_status",
);
assertNotContains(
  functionSource,
  'delivery_status: "failed"',
  "index.ts does not set failed delivery_status",
);

console.log("--- dry-run payload metadata (required) ---");

assertContains(functionSource, 'mode: SCHEDULED_RUNNER_DRY_RUN_MODE', "payload includes dry_run mode");
assertContains(functionSource, "asOfDate: asOfDateIso", "payload includes asOfDate");
assertContains(functionSource, "reason", "payload includes reason");

console.log("--- safety gates: no email delivery or reminder mutation (required) ---");

const forbiddenNeedles = [
  "api.resend.com",
  "RESEND_API_KEY",
  "sendViaResend",
  "send-reminder-deliveries",
  "create_reminder_delivery_log",
  "mark_reminder_sent",
  "EMAIL_MODE",
  "production",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(
    functionSource,
    needle,
    `scheduled-reminder-runner/index.ts has no ${needle}`,
  );
}

assertNotContains(functionSource, "sent_at:", "index.ts does not assign sent_at");
assertNotContains(functionSource, "sent_at =", "index.ts does not assign sent_at");

const providerMessageIdMatches = functionSource.match(/provider_message_id/g) ?? [];
assert(
  providerMessageIdMatches.length === 1,
  "provider_message_id appears only once (null assignment in dry-run row builder)",
);

assertContains(
  functionSource,
  "SCHEDULED_RUNNER_DRY_RUN_MODE",
  "index.ts remains dry_run mode only",
);
assertContains(functionSource, "provider: null", "index.ts sets provider null");
assertContains(functionSource, "provider_message_id: null", "index.ts sets provider_message_id null");

console.log("--- npm script and documentation (required) ---");

assertContains(
  packageJson,
  '"verify-scheduled-runner-delivery-log-dry-run"',
  "package.json verify-scheduled-runner-delivery-log-dry-run script",
);

const docChecks = [
  [scheduledRunnerDocPath, "Phase 51", "v6-scheduled-runner.md references Phase 51"],
  [
    scheduledRunnerDocPath,
    "verify-scheduled-runner-delivery-log-dry-run",
    "v6-scheduled-runner.md references verification script",
  ],
  [
    automatedEmailRemindersDocPath,
    "Phase 51",
    "v6-automated-email-reminders.md references Phase 51",
  ],
  [deliveryArchDocPath, "Phase 51", "v6-delivery-architecture.md references Phase 51"],
  [roadmapPath, "V6 Phase 51", "ROADMAP references V6 Phase 51"],
];

for (const [docPath, needle, label] of docChecks) {
  assert(existsSync(docPath), `${docPath} exists`);
  if (existsSync(docPath)) {
    assertContains(readFileSync(docPath, "utf8"), needle, label);
  }
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-delivery-log-dry-run: all checks OK");
console.log("  mode: dry_run — delivery log rows only (pending/skipped)");
console.log("  order: automation_runs insert before reminder_delivery_logs insert");
console.log("  response: deliveryLogSummary with total/pending/skipped");
console.log("  safety: no Resend, no email send, no mark-as-sent, no sent_at writes");
