/**
 * V5-0 Phase 5: Automation Dry-Run Scan Engine.
 * Deterministic fixture checks, immutability guard, and absence of execution hooks.
 * No Supabase, browser, cron, Edge Functions, queue processing, or email delivery.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import {
  CLOUD_FIXTURE_ROWS,
  EXPECTED_AUTOMATION_DRY_RUN,
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
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    fail(`${label}: must not contain ${JSON.stringify(needle)}`);
  }
}

console.log("V5-0 Phase 5 automation dry-run verification (verify-automation-dry-run)\n");

const dryRunJs = readFileSync(
  join(root, "js", "app", "automation", "automation-dry-run.js"),
  "utf8"
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");

assertContains(dryRunJs, "export function computeAutomationDryRun", "dry-run module export");
assertContains(dryRunJs, "reminderCandidates", "dry-run output reminderCandidates");
assertContains(dryRunJs, "actionCandidates", "dry-run output actionCandidates");
assertContains(dryRunJs, "escalationCandidates", "dry-run output escalationCandidates");
assertContains(dryRunJs, "computeComplianceInsights", "dry-run reuses insights engine");
assertContains(dryRunJs, "getActiveReminderType", "dry-run reuses reminder window detection");
assertContains(dryRunJs, "personRowHasEmail", "dry-run reuses contact readiness");
assertContains(dryRunJs, "EVIDENCE_GAP_TIERS", "dry-run reuses evidence gap tiers");
assertContains(dryRunJs, "hasReminderActivityForType", "dry-run reuses operational follow-up");

const forbiddenNeedles = [
  "createAutomationRun",
  ".rpc(",
  "notification_queue",
  "delivery_log",
  "enqueue_reminder_notifications",
  "mark_reminder_sent",
  "apply_automation_policies",
  "daily_compliance_scan",
  "process_notification_queue",
  "pg_cron",
  "smtp",
  "resend",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(dryRunJs, needle, `automation-dry-run.js has no ${needle}`);
}

assertContains(
  packageJson,
  '"verify-automation-dry-run": "node scripts/verify-automation-dry-run.mjs"',
  "package.json verify-automation-dry-run script"
);
assertNotContains(appJs, "computeAutomationDryRun", "app.js does not wire dry-run yet");

const localResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
assertDeepEqual(localResult, EXPECTED_AUTOMATION_DRY_RUN, "local fixture dry-run output");

const cloudResult = computeAutomationDryRun(CLOUD_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
assertDeepEqual(cloudResult, EXPECTED_AUTOMATION_DRY_RUN, "cloud fixture dry-run output");

const repeatLocal = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
assertDeepEqual(repeatLocal, localResult, "dry-run is deterministic");

const mutableRows = structuredClone(LOCAL_FIXTURE_ROWS);
const beforeSnapshot = structuredClone(mutableRows);

computeAutomationDryRun(mutableRows, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
assertDeepEqual(mutableRows, beforeSnapshot, "dry-run does not mutate input rows");

assertEqual(
  localResult.reminderCandidates.withEmail + localResult.reminderCandidates.missingEmail,
  localResult.reminderCandidates.total,
  "reminder withEmail + missingEmail equals total"
);
assertEqual(
  localResult.reminderCandidates.byType["30-day"] +
    localResult.reminderCandidates.byType["14-day"] +
    localResult.reminderCandidates.byType["7-day"] +
    localResult.reminderCandidates.byType.expired,
  localResult.reminderCandidates.total,
  "reminder type buckets sum to total"
);
assertEqual(localResult.reminderCandidates.missingEmail, 3, "missing email count");
assertEqual(localResult.reminderCandidates.byType["14-day"], 1, "14-day bucket");
assertEqual(localResult.reminderCandidates.byType.expired, 1, "expired bucket");

if (failures.length > 0) {
  console.error("FAIL verify-automation-dry-run:");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("V5-0 Phase 5 automation dry-run scan engine: OK");
console.log(`  asOfDate=${localResult.asOfDate}`);
console.log(`  totalRecords=${localResult.totalRecords}`);
console.log(
  `  reminderCandidates.total=${localResult.reminderCandidates.total} (withEmail=${localResult.reminderCandidates.withEmail}, missingEmail=${localResult.reminderCandidates.missingEmail})`
);
console.log(
  `  reminderCandidates.byType=${JSON.stringify(localResult.reminderCandidates.byType)}`
);
console.log(`  actionCandidates=${JSON.stringify(localResult.actionCandidates)}`);
console.log(`  escalationCandidates=${JSON.stringify(localResult.escalationCandidates)}`);
console.log("  No RPC, createAutomationRun, email delivery, queue, cron, or row mutation");
