/**
 * V5-1 Phase 1: Reminder queue foundation.
 * Deterministic fixture checks, immutability guard, and absence of execution hooks.
 * No Supabase, browser, email delivery, mark-sent, or compliance mutation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import {
  REMINDER_QUEUE_EXECUTION_DEFAULTS,
  REMINDER_QUEUE_SOURCE,
  REMINDER_QUEUE_STATUS,
  buildReminderQueueFromDryRun,
} from "../js/app/automation/reminder-queue.js";
import {
  CLOUD_FIXTURE_ROWS,
  EXPECTED_AUTOMATION_DRY_RUN,
  EXPECTED_REMINDER_QUEUE_NAMES,
  EXPECTED_REMINDER_QUEUE_SUMMARY,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(label);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    fail(label);
  }
}

console.log("V5-1 Phase 1 reminder queue verification (verify-reminder-queue)\n");

const queueJs = readFileSync(join(root, "js/app/automation/reminder-queue.js"), "utf8");
const packageJson = readFileSync(join(root, "package.json"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");

assertContains(queueJs, "export function buildReminderQueueFromDryRun", "reminder-queue module export");
assertContains(queueJs, 'status: REMINDER_QUEUE_STATUS', "queue items use queued status");
assertContains(queueJs, 'source: REMINDER_QUEUE_SOURCE', "queue items use dry_run_candidate source");
assertContains(queueJs, "REMINDER_QUEUE_EXECUTION_DEFAULTS", "queue items include execution defaults");
assertContains(queueJs, "getActiveReminderType", "queue reuses reminder window detection");

const forbiddenNeedles = [
  "sendEmail",
  "sendReminder",
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "enqueue_reminder_notifications",
  "process_notification_queue",
  "createAutomationRun",
  "logAutomationDryRunRun",
  "apply_automation_policies",
  ".rpc(",
  "smtp",
  "resend",
  "history_entries",
  "add_default_actions",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(queueJs, needle, `reminder-queue.js has no ${needle}`);
}

assertContains(
  packageJson,
  '"verify-reminder-queue": "node scripts/verify-reminder-queue.mjs"',
  "package.json verify-reminder-queue script"
);
assertContains(appJs, "buildReminderQueueFromDryRun", "app.js wires reminder queue preview");
assertContains(appJs, "reminder-queue.js", "app.js imports reminder queue module");

const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const queue = buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assertDeepEqual(queue.summary, EXPECTED_REMINDER_QUEUE_SUMMARY, "local fixture queue summary");
assertEqual(queue.items.length, EXPECTED_AUTOMATION_DRY_RUN.reminderCandidates.total, "queue count matches dry-run total");
assertEqual(queue.asOfDate, FIXTURE_AS_OF_DATE, "queue asOfDate");

const queueNames = queue.items.map((item) => item.personName);
assertDeepEqual(queueNames, EXPECTED_REMINDER_QUEUE_NAMES, "queue item sort order");

queue.items.forEach((item) => {
  assertEqual(item.status, REMINDER_QUEUE_STATUS, `${item.personName} status is queued`);
  assertEqual(item.source, REMINDER_QUEUE_SOURCE, `${item.personName} source is dry_run_candidate`);
  assertEqual(item.asOfDate, FIXTURE_AS_OF_DATE, `${item.personName} asOfDate`);
  assert(item.emailMissing, `${item.personName} flagged as missing email`);
  assertEqual(item.email, null, `${item.personName} email is null when missing`);

  Object.entries(REMINDER_QUEUE_EXECUTION_DEFAULTS).forEach(([key, expectedValue]) => {
    assertEqual(
      item[key],
      expectedValue,
      `${item.personName} execution field ${key}`
    );
  });
});

const withEmailItem = buildReminderQueueFromDryRun({
  dryRunResult: computeAutomationDryRun(
    [
      {
        ...LOCAL_FIXTURE_ROWS[1],
        email: "jordan.coordinator@example.com",
      },
    ],
    FIXTURE_SETTINGS,
    FIXTURE_AS_OF_DATE
  ),
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: [
    {
      ...LOCAL_FIXTURE_ROWS[1],
      email: "jordan.coordinator@example.com",
    },
  ],
  settings: FIXTURE_SETTINGS,
});

assertEqual(withEmailItem.summary.total, 1, "single-row queue count");
assertEqual(withEmailItem.summary.withEmail, 1, "email present candidate counted");
assertEqual(withEmailItem.summary.missingEmail, 0, "no missing-email candidates");
assertEqual(
  withEmailItem.items[0].email,
  "jordan.coordinator@example.com",
  "queue retains normalized email"
);
assertEqual(withEmailItem.items[0].emailMissing, false, "email present candidate not flagged missing");

const cloudDryRun = computeAutomationDryRun(CLOUD_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const cloudQueue = buildReminderQueueFromDryRun({
  dryRunResult: cloudDryRun,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: CLOUD_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assertDeepEqual(cloudQueue.summary, EXPECTED_REMINDER_QUEUE_SUMMARY, "cloud fixture queue summary");

const mutableDryRun = structuredClone(dryRunResult);
const beforeDryRun = structuredClone(mutableDryRun);

buildReminderQueueFromDryRun({
  dryRunResult: mutableDryRun,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});
assertDeepEqual(mutableDryRun, beforeDryRun, "queue build does not mutate dry-run result");

const mutableRows = structuredClone(LOCAL_FIXTURE_ROWS);
const beforeRows = structuredClone(mutableRows);

buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: mutableRows,
  settings: FIXTURE_SETTINGS,
});
assertDeepEqual(mutableRows, beforeRows, "queue build does not mutate input rows");

if (failures.length > 0) {
  console.error("FAIL verify-reminder-queue:");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("V5-1 Phase 1 reminder queue foundation: OK");
console.log(`  asOfDate=${queue.asOfDate}`);
console.log(`  items=${queue.items.length} (withEmail=${queue.summary.withEmail}, missingEmail=${queue.summary.missingEmail})`);
console.log(`  byWindow=${JSON.stringify(queue.summary.byWindow)}`);
console.log("  No email delivery, mark-sent, compliance mutation, or app execution hooks");
