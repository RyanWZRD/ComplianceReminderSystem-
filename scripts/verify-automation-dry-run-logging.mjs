/**
 * V5-0 Phase 6: Dry-Run Run Logging.
 * Static checks, in-memory mock logging, and cloud smoke for dry-run audit rows.
 * No email delivery, reminder execution, action mutation, or compliance writes.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import {
  buildAutomationDryRunRunSummary,
  DEFAULT_DRY_RUN_RUN_SOURCE,
  DRY_RUN_RUN_TYPE,
  logAutomationDryRunRun,
} from "../js/app/automation/automation-run-logging.js";
import {
  EXPECTED_AUTOMATION_DRY_RUN,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {string[]} */
const failures = [];

/** @type {string[]} */
const createdRunIds = [];

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

/**
 * @param {string} content
 * @param {string} key
 * @returns {string}
 */
function readEnvValue(content, key) {
  const pattern = new RegExp(`^${key}\\s*=\\s*(.*)$`, "m");
  const match = content.match(pattern);

  if (!match) {
    return "";
  }

  let value = match[1].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

/**
 * @returns {{ runs: object[]; createAutomationRun: (input?: object) => Promise<object> }}
 */
function createMockAutomationDb() {
  const runs = [];
  let nextId = 1;

  return {
    runs,
    async createAutomationRun(input = {}) {
      const run = {
        id: `mock-run-${nextId}`,
        startedAt: new Date("2026-06-17T10:00:00.000Z").toISOString(),
        completedAt: new Date("2026-06-17T10:00:01.000Z").toISOString(),
        status: input.status ?? "completed",
        summary: input.summary ?? {},
        error: input.error ?? null,
        createdAt: new Date("2026-06-17T10:00:01.000Z").toISOString(),
      };

      nextId += 1;
      runs.push(run);

      return { ok: true, status: "created", run };
    },
  };
}

console.log(
  "V5-0 Phase 6 automation dry-run logging verification (verify-automation-dry-run-logging)\n"
);

const loggingJs = readFileSync(
  join(root, "js", "app", "automation", "automation-run-logging.js"),
  "utf8"
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const dryRunJs = readFileSync(
  join(root, "js", "app", "automation", "automation-dry-run.js"),
  "utf8"
);

assertContains(loggingJs, "export async function logAutomationDryRunRun", "logging module export");
assertContains(loggingJs, "export function buildAutomationDryRunRunSummary", "summary builder export");
assertContains(loggingJs, 'DRY_RUN_RUN_TYPE = "dry_run"', "dry_run run type constant");
assertContains(loggingJs, "createAutomationRun", "logging uses db.createAutomationRun only");
assertContains(
  packageJson,
  '"verify-automation-dry-run-logging": "node scripts/verify-automation-dry-run-logging.mjs"',
  "package.json verify-automation-dry-run-logging script"
);
assertNotContains(appJs, "logAutomationDryRunRun", "app.js does not wire dry-run logging yet");
assertNotContains(dryRunJs, "logAutomationDryRunRun", "dry-run module does not import logging");

const forbiddenNeedles = [
  "getSupabaseClient",
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
  assertNotContains(loggingJs, needle, `automation-run-logging.js has no ${needle}`);
}

const dryRunResult = computeAutomationDryRun(
  LOCAL_FIXTURE_ROWS,
  FIXTURE_SETTINGS,
  FIXTURE_AS_OF_DATE
);
assertDeepEqual(dryRunResult, EXPECTED_AUTOMATION_DRY_RUN, "fixture dry-run output");

const summary = buildAutomationDryRunRunSummary(dryRunResult, {
  organisationId: "11111111-1111-1111-1111-111111111111",
  actorProfileId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  source: DEFAULT_DRY_RUN_RUN_SOURCE,
});

assertEqual(summary.runType, DRY_RUN_RUN_TYPE, "summary runType");
assertEqual(summary.source, DEFAULT_DRY_RUN_RUN_SOURCE, "summary source");
assertDeepEqual(summary.dryRun, dryRunResult, "summary dryRun payload");
assertEqual(summary.policiesApplied, 0, "summary policiesApplied zero");
assertEqual(summary.remindersQueued, 0, "summary remindersQueued zero");
assertEqual(summary.remindersSent, 0, "summary remindersSent zero");
assertEqual(summary.actionsCreated, 0, "summary actionsCreated zero");
assertEqual(summary.escalationsFired, 0, "summary escalationsFired zero");

const mockDb = createMockAutomationDb();
const runsBeforeMock = mockDb.runs.length;

const firstLog = await logAutomationDryRunRun({
  db: mockDb,
  organisationId: "11111111-1111-1111-1111-111111111111",
  actorProfileId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  dryRunResult,
  source: DEFAULT_DRY_RUN_RUN_SOURCE,
});

assert(firstLog.ok && firstLog.run, "mock first log succeeds");
assertEqual(mockDb.runs.length, runsBeforeMock + 1, "mock first log creates one row");
assertEqual(firstLog.run.status, "completed", "mock logged run status completed");
assert(firstLog.run.startedAt, "mock logged run has started_at");
assert(firstLog.run.completedAt, "mock logged run has completed_at");
assertDeepEqual(firstLog.run.summary.dryRun, dryRunResult, "mock logged summary dryRun");

const secondLog = await logAutomationDryRunRun({
  db: mockDb,
  organisationId: "11111111-1111-1111-1111-111111111111",
  dryRunResult,
});

assert(secondLog.ok && secondLog.run, "mock second log succeeds");
assertEqual(mockDb.runs.length, runsBeforeMock + 2, "mock repeat log appends audit row");
assert(
  secondLog.run.id !== firstLog.run.id,
  "mock repeat log creates separate audit row, not overwrite"
);

const mutableRows = structuredClone(LOCAL_FIXTURE_ROWS);
const beforeSnapshot = structuredClone(mutableRows);

await logAutomationDryRunRun({
  db: mockDb,
  dryRunResult: computeAutomationDryRun(mutableRows, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE),
});

assertDeepEqual(mutableRows, beforeSnapshot, "logging path does not mutate fixture rows");

if (failures.length > 0) {
  console.error("FAIL verify-automation-dry-run-logging (static + mock):");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("Static + mock checks: OK");

const envPath = join(root, ".env");
let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env file for cloud smoke.");
  process.exit(1);
}

const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");
const supabaseUrl = readEnvValue(envContent, "SUPABASE_URL");
const serviceRoleKey = readEnvValue(envContent, "SUPABASE_SERVICE_ROLE_KEY");
const adminEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_ADMIN") ||
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL") ||
  "alpha-admin@example.com";

if (!password) {
  console.error(".env must define SUPABASE_TEST_PASSWORD.");
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error(".env must define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for cleanup.");
  process.exit(1);
}

process.env.DATA_BACKEND = "cloud";
process.env.AUTH_MODE = "supabase";
process.env.CLOUD_WRITES_ENABLED = "true";

const { signInWithPassword, signOut } = await import("../js/auth/session.js");
const { CloudAutomationStore } = await import("../js/data/cloud-automation-store.js");
const { canMutateData } = await import("../js/app/permissions.js");

if (canMutateData()) {
  console.error("canMutateData() must stay false in cloud mode.");
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function countTable(table) {
  const { count, error } = await serviceClient.from(table).select("id", { count: "exact", head: true });

  if (error) {
    console.error(`${table} count failed: ${error.message}`);
    process.exit(1);
  }

  return count ?? 0;
}

async function deleteCreatedRuns() {
  if (createdRunIds.length === 0) {
    return;
  }

  const { error } = await serviceClient.from("automation_runs").delete().in("id", createdRunIds);

  if (error) {
    console.error(`Cleanup created automation runs failed: ${error.message}`);
    process.exit(1);
  }
}

const runsBefore = await countTable("automation_runs");
const complianceBefore = await countTable("compliance_records");
const actionsBefore = await countTable("actions");
const evidenceBefore = await countTable("evidence_items");
const historyBefore = await countTable("history_entries");
const peopleBefore = await countTable("people");

await signInWithPassword(adminEmail, password);

const adminStore = new CloudAutomationStore();
const cloudDryRun = computeAutomationDryRun(
  LOCAL_FIXTURE_ROWS,
  FIXTURE_SETTINGS,
  FIXTURE_AS_OF_DATE
);

const cloudLog = await logAutomationDryRunRun({
  db: adminStore,
  organisationId: "11111111-1111-1111-1111-111111111111",
  actorProfileId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  dryRunResult: cloudDryRun,
  source: DEFAULT_DRY_RUN_RUN_SOURCE,
});

if (!cloudLog.ok || !cloudLog.run) {
  console.error(`Cloud dry-run log failed: ${JSON.stringify(cloudLog)}`);
  process.exit(1);
}

createdRunIds.push(cloudLog.run.id);

if (cloudLog.run.status !== "completed" || !cloudLog.run.completedAt) {
  console.error("Cloud dry-run log must be completed with completed_at set.");
  process.exit(1);
}

assertDeepEqual(cloudLog.run.summary.dryRun, cloudDryRun, "cloud logged summary dryRun");
assertEqual(cloudLog.run.summary.runType, DRY_RUN_RUN_TYPE, "cloud logged runType");
assertEqual(cloudLog.run.summary.source, DEFAULT_DRY_RUN_RUN_SOURCE, "cloud logged source");
assertEqual(cloudLog.run.summary.remindersSent, 0, "cloud logged remindersSent zero");

const repeatCloudLog = await logAutomationDryRunRun({
  db: adminStore,
  dryRunResult: cloudDryRun,
});

if (!repeatCloudLog.ok || !repeatCloudLog.run) {
  console.error(`Cloud repeat dry-run log failed: ${JSON.stringify(repeatCloudLog)}`);
  process.exit(1);
}

createdRunIds.push(repeatCloudLog.run.id);

if (repeatCloudLog.run.id === cloudLog.run.id) {
  console.error("Repeat dry-run logging must create a separate audit row.");
  process.exit(1);
}

const runsAfter = await countTable("automation_runs");

if (runsAfter !== runsBefore + createdRunIds.length) {
  console.error("Unexpected automation_runs count after dry-run logging smoke.");
  process.exit(1);
}

if ((await countTable("compliance_records")) !== complianceBefore) {
  console.error("compliance_records count changed during dry-run logging (no mutation expected).");
  process.exit(1);
}

if ((await countTable("actions")) !== actionsBefore) {
  console.error("actions count changed during dry-run logging (no mutation expected).");
  process.exit(1);
}

if ((await countTable("evidence_items")) !== evidenceBefore) {
  console.error("evidence_items count changed during dry-run logging (no mutation expected).");
  process.exit(1);
}

if ((await countTable("history_entries")) !== historyBefore) {
  console.error("history_entries count changed during dry-run logging (no mutation expected).");
  process.exit(1);
}

if ((await countTable("people")) !== peopleBefore) {
  console.error("people count changed during dry-run logging (no mutation expected).");
  process.exit(1);
}

const singleResult = await adminStore.loadAutomationRun(cloudLog.run.id);

if (!singleResult.ok || !singleResult.run) {
  console.error(`get_automation_run failed for logged dry-run: ${JSON.stringify(singleResult)}`);
  process.exit(1);
}

assertDeepEqual(singleResult.run.summary.dryRun, cloudDryRun, "loaded run summary dryRun");

await signOut();
await deleteCreatedRuns();

const runsAfterCleanup = await countTable("automation_runs");

if (runsAfterCleanup !== runsBefore) {
  console.error("Created dry-run audit runs were not cleaned up.");
  process.exit(1);
}

console.log("Cloud smoke: OK");
console.log("  Admin: log dry-run audit row via create_automation_run");
console.log("  Repeat log creates separate audit row");
console.log("  Summary stores dry-run result with execution counters at zero");
console.log("  compliance_records, actions, evidence_items, history_entries, people unchanged");
console.log("  canMutateData() remains false in cloud");
console.log("\nV5-0 Phase 6 dry-run run logging: OK");
