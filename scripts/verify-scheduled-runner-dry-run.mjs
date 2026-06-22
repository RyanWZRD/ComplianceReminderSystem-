/**
 * V6 Phase 45: Scheduled automation runner dry-run verification.
 * Static checks for scheduled-reminder-runner Edge Function structure,
 * candidate parity with Manual Delivery Test queue preview, and safety gates
 * (no Resend, no delivery log writes, no mark-as-sent, no send-reminder-deliveries).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeScheduledRunnerDryRunSummary,
  mapQueueSummaryToScheduledRunnerSummary,
  SCHEDULED_RUNNER_DRY_RUN_MODE,
} from "../js/app/automation/scheduled-runner-candidates.js";
import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";
import {
  CLOUD_FIXTURE_ROWS,
  EXPECTED_REMINDER_QUEUE_SUMMARY,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const functionPath = join(
  root,
  "supabase",
  "functions",
  "scheduled-reminder-runner",
  "index.ts",
);
const candidatesPath = join(
  root,
  "js",
  "app",
  "automation",
  "scheduled-runner-candidates.js",
);
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const scheduledRunnerDocPath = join(root, "docs", "v6-scheduled-runner.md");
const v5DocPath = join(root, "docs", "v5-automated-compliance-operations.md");
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

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log(
  "V6 Phase 45 scheduled runner dry-run verification (verify-scheduled-runner-dry-run)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");
assert(existsSync(candidatesPath), "js/app/automation/scheduled-runner-candidates.js exists");
assert(existsSync(scheduledRunnerDocPath), "docs/v6-scheduled-runner.md exists");

const functionSource = readFileSync(functionPath, "utf8");
const candidatesSource = readFileSync(candidatesPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
const v5Doc = readFileSync(v5DocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-scheduled-runner-dry-run"',
  "package.json verify-scheduled-runner-dry-run script",
);

console.log("--- Edge Function structure (required) ---");

assertContains(functionSource, "Deno.serve", "index.ts defines Deno.serve handler");
assertContains(functionSource, 'req.method === "OPTIONS"', "index.ts handles OPTIONS");
assertContains(functionSource, 'req.method !== "POST"', "index.ts restricts to POST");
assertContains(functionSource, "Authorization", "index.ts validates Authorization header");
assertContains(functionSource, "validateRequestBody", "index.ts has validateRequestBody helper");
assertContains(functionSource, "organisationId is required", "index.ts validates organisationId");
assertContains(functionSource, "SCHEDULED_RUNNER_DRY_RUN_MODE", "index.ts exposes dry_run mode");
assertContains(functionSource, "totalCandidates", "index.ts returns totalCandidates summary");
assertContains(functionSource, "wouldSend", "index.ts returns wouldSend summary");
assertContains(functionSource, "wouldSkip", "index.ts returns wouldSkip summary");
assertContains(functionSource, "getActiveReminderType", "index.ts reuses reminder window detection");
assertContains(functionSource, "loadComplianceRows", "index.ts loads compliance rows read-only");
assertContains(functionSource, "loadReminderSettings", "index.ts loads reminder settings read-only");

console.log("--- safety gates: no email delivery or writes (required) ---");

const forbiddenNeedles = [
  "api.resend.com",
  "RESEND_API_KEY",
  "sendViaResend",
  "send-reminder-deliveries",
  "create_reminder_delivery_log",
  "mark_reminder_sent",
  "createAutomationRun",
  "automation_runs",
  ".rpc(",
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

assertNotContains(
  candidatesSource,
  "invokeSendReminderDeliveries",
  "scheduled-runner-candidates.js does not invoke delivery",
);
assertNotContains(
  candidatesSource,
  ".rpc(",
  "scheduled-runner-candidates.js has no RPC writes",
);

console.log("--- candidate parity with Manual Delivery Test preview (required) ---");

const localDryRun = computeAutomationDryRun(
  LOCAL_FIXTURE_ROWS,
  FIXTURE_SETTINGS,
  FIXTURE_AS_OF_DATE,
);
const localQueue = buildReminderQueueFromDryRun({
  dryRunResult: localDryRun,
  asOfDate: localDryRun.asOfDate,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});
const localSummary = computeScheduledRunnerDryRunSummary({
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
  asOfDate: FIXTURE_AS_OF_DATE,
  organisationId: "fixture-org",
});

assertDeepEqual(
  localSummary.summary,
  mapQueueSummaryToScheduledRunnerSummary(localQueue.summary),
  "local fixture summary matches Manual Delivery Test queue preview",
);
assertEqualSummaryParts(localSummary.summary, EXPECTED_REMINDER_QUEUE_SUMMARY);

const cloudSummary = computeScheduledRunnerDryRunSummary({
  rows: CLOUD_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
  asOfDate: FIXTURE_AS_OF_DATE,
  organisationId: "fixture-org",
});
const cloudDryRun = computeAutomationDryRun(
  CLOUD_FIXTURE_ROWS,
  FIXTURE_SETTINGS,
  FIXTURE_AS_OF_DATE,
);
const cloudQueue = buildReminderQueueFromDryRun({
  dryRunResult: cloudDryRun,
  asOfDate: cloudDryRun.asOfDate,
  rows: CLOUD_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assertDeepEqual(
  cloudSummary.summary,
  mapQueueSummaryToScheduledRunnerSummary(cloudQueue.summary),
  "cloud fixture summary matches Manual Delivery Test queue preview",
);
assertEqual(localSummary.mode, SCHEDULED_RUNNER_DRY_RUN_MODE, "dry_run mode constant");
assertEqual(localSummary.status, "ok", "dry_run status");

console.log("--- documentation (required) ---");

assertContains(
  deliveryArchDoc,
  "## Phase 45 — Scheduled automation runner dry run",
  "delivery architecture doc has Phase 45 section",
);
assertContains(
  scheduledRunnerDoc,
  "scheduled-reminder-runner",
  "scheduled runner doc references Edge Function",
);
assertContains(
  scheduledRunnerDoc,
  "verify-scheduled-runner-dry-run",
  "scheduled runner doc references dry-run verification script",
);
assertContains(
  scheduledRunnerDoc,
  "verify-scheduled-runner-deploy-smoke",
  "scheduled runner doc references deploy smoke verification script",
);
assertContains(
  v5Doc,
  "Phase 45",
  "v5 automation doc references Phase 45",
);
assertContains(
  roadmap,
  "V6 Phase 45",
  "ROADMAP references V6 Phase 45",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-dry-run: all checks OK");
console.log("  mode: dry_run — candidate scan only");
console.log("  parity: same reminder window rules as Manual Delivery Test queue preview");
console.log("  safety: no Resend, no delivery log writes, no mark-as-sent, no send-reminder-deliveries");

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} label
 */
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * @param {{
 *   totalCandidates: number;
 *   withEmail: number;
 *   missingEmail: number;
 *   wouldSend: number;
 *   wouldSkip: number;
 * }} summary
 * @param {{
 *   total: number;
 *   withEmail: number;
 *   missingEmail: number;
 * }} queueSummary
 */
function assertEqualSummaryParts(summary, queueSummary) {
  assertEqual(summary.totalCandidates, queueSummary.total, "totalCandidates");
  assertEqual(summary.withEmail, queueSummary.withEmail, "withEmail");
  assertEqual(summary.missingEmail, queueSummary.missingEmail, "missingEmail");
  assertEqual(summary.wouldSend, queueSummary.withEmail, "wouldSend equals withEmail");
  assertEqual(summary.wouldSkip, queueSummary.missingEmail, "wouldSkip equals missingEmail");
}
