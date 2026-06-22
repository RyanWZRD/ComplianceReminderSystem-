/**
 * V6 Phase 47: Automation run records for scheduled runner dry-runs.
 * Static checks for migration, Edge Function audit insert path, response contract,
 * and safety gates (no Resend, no mark-as-sent, no delivery logs, no reminder mutation).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const migrationsDir = join(root, "supabase", "migrations");
const functionPath = join(
  root,
  "supabase",
  "functions",
  "scheduled-reminder-runner",
  "index.ts",
);
const automatedEmailRemindersDocPath = join(
  root,
  "docs",
  "v6-automated-email-reminders.md",
);
const scheduledRunnerDocPath = join(root, "docs", "v6-scheduled-runner.md");
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const v5DocPath = join(root, "docs", "v5-automated-compliance-operations.md");
const roadmapPath = join(root, "ROADMAP.md");
const packageJsonPath = join(root, "package.json");

const PHASE_47_MIGRATION = "20260401000008_automation_runs_scheduled_dry_run.sql";

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

function readMigration(filename) {
  const path = join(migrationsDir, filename);

  if (!existsSync(path)) {
    fail(`missing migration file: ${filename}`);
    return "";
  }

  return readFileSync(path, "utf8");
}

console.log(
  "V6 Phase 47 automation run records verification (verify-automation-run-records)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");

const functionSource = readFileSync(functionPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");
const foundationMigration = readMigration("20260401000002_automation_runs.sql");
const phase47Migration = readMigration(PHASE_47_MIGRATION);

console.log("--- migration (required) ---");

assertContains(
  foundationMigration,
  "create table public.automation_runs",
  "foundation migration creates automation_runs table",
);
assertContains(
  foundationMigration,
  "alter table public.automation_runs enable row level security",
  "foundation migration enables RLS on automation_runs",
);
assertContains(
  phase47Migration,
  "automation_runs",
  "Phase 47 migration references automation_runs",
);
assertContains(
  phase47Migration,
  "automation_run_id",
  "Phase 47 migration adds automation_run_id",
);
assertContains(
  phase47Migration,
  "run_type",
  "Phase 47 migration adds run_type",
);
assertContains(
  phase47Migration,
  "as_of_date",
  "Phase 47 migration adds as_of_date",
);
assertContains(
  phase47Migration,
  "total_candidates",
  "Phase 47 migration adds total_candidates",
);
assertContains(
  phase47Migration,
  "row level security",
  "Phase 47 migration documents RLS",
);

const migrationFiles = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
assert(
  migrationFiles.includes(PHASE_47_MIGRATION),
  `migration file ${PHASE_47_MIGRATION} exists`,
);

console.log("--- Edge Function audit insert path (required) ---");

assertContains(
  functionSource,
  "createServiceSupabaseClient",
  "index.ts has service-role client for audit inserts",
);
assertContains(
  functionSource,
  "insertScheduledDryRunAutomationRun",
  "index.ts has automation run insert helper",
);
assertContains(
  functionSource,
  '.from("automation_runs")',
  "index.ts inserts into automation_runs",
);
assertContains(
  functionSource,
  "automation_run_id",
  "index.ts selects automation_run_id from insert",
);
assertContains(
  functionSource,
  "automationRunId",
  "index.ts returns automationRunId in response",
);
assertContains(
  functionSource,
  "automation_run_persist_failed",
  "index.ts returns structured error on insert failure",
);
assertContains(
  functionSource,
  "SCHEDULED_RUNNER_RUN_TYPE",
  "index.ts sets scheduled_reminder_dry_run run type",
);
assertContains(
  functionSource,
  "totalCandidates",
  "index.ts persists totalCandidates in summary",
);
assertContains(
  functionSource,
  "wouldSend",
  "index.ts persists wouldSend in summary",
);
assertContains(
  functionSource,
  "wouldSkip",
  "index.ts persists wouldSkip in summary",
);

console.log("--- safety gates: no email delivery or reminder mutation (required) ---");

const forbiddenNeedles = [
  "api.resend.com",
  "RESEND_API_KEY",
  "sendViaResend",
  "send-reminder-deliveries",
  "create_reminder_delivery_log",
  "mark_reminder_sent",
  "EMAIL_MODE",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(
    functionSource,
    needle,
    `scheduled-reminder-runner/index.ts has no ${needle}`,
  );
}

assertNotContains(functionSource, ".rpc(", "index.ts has no RPC writes");
assertNotContains(functionSource, ".update(", "index.ts has no table updates");
assertNotContains(functionSource, "sent_at:", "index.ts does not assign sent_at");

console.log("--- npm script and documentation (required) ---");

assertContains(
  packageJson,
  '"verify-automation-run-records"',
  "package.json verify-automation-run-records script",
);

if (existsSync(automatedEmailRemindersDocPath)) {
  const automatedEmailRemindersDoc = readFileSync(automatedEmailRemindersDocPath, "utf8");
  assertContains(
    automatedEmailRemindersDoc,
    "Phase 47",
    "v6-automated-email-reminders doc references Phase 47",
  );
  assertContains(
    automatedEmailRemindersDoc,
    "verify-automation-run-records",
    "v6-automated-email-reminders doc references verification script",
  );
  assertContains(
    automatedEmailRemindersDoc,
    "automationRunId",
    "v6-automated-email-reminders doc documents automationRunId",
  );
} else {
  fail("docs/v6-automated-email-reminders.md exists");
}

if (existsSync(scheduledRunnerDocPath)) {
  const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
  assertContains(
    scheduledRunnerDoc,
    "automationRunId",
    "scheduled runner doc documents automationRunId",
  );
}

if (existsSync(roadmapPath)) {
  const roadmap = readFileSync(roadmapPath, "utf8");
  assertContains(roadmap, "V6 Phase 47", "ROADMAP references V6 Phase 47");
}

if (existsSync(deliveryArchDocPath)) {
  const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
  assertContains(
    deliveryArchDoc,
    "Phase 47",
    "delivery architecture doc references Phase 47",
  );
}

if (existsSync(v5DocPath)) {
  const v5Doc = readFileSync(v5DocPath, "utf8");
  assertContains(v5Doc, "Phase 47", "v5 automation doc references Phase 47");
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-automation-run-records: all checks OK");
console.log("  audit: automation_runs insert via service role on dry-run success");
console.log("  response: automationRunId + summary counts");
console.log("  safety: no Resend, no mark-as-sent, no sent_at, no reminder mutation");
