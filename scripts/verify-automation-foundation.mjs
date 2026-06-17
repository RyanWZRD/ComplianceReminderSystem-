/**
 * V5-0 Phase 1: Automation Platform Foundation.
 * Static checks for schema migrations, AUTOMATION_ENABLED flag (off by default),
 * cloud mapper row types, and absence of execution hooks.
 * No Supabase, browser, cron, Edge Functions, queue processing, or email delivery.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

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

console.log("V5-0 Phase 1 automation foundation verification (verify-automation-foundation)\n");

const policiesMigration = readMigration("20260401000001_automation_policies.sql");
const runsMigration = readMigration("20260401000002_automation_runs.sql");

assertContains(
  policiesMigration,
  "create table public.automation_policies",
  "automation_policies migration creates table"
);
assertContains(policiesMigration, "policy jsonb not null", "automation_policies.policy column");
assertContains(policiesMigration, "enabled boolean not null", "automation_policies.enabled column");
assertContains(policiesMigration, "version integer not null", "automation_policies.version column");
assertContains(
  policiesMigration,
  "organisation_id uuid not null references public.organisations",
  "automation_policies org scope"
);
assertContains(
  policiesMigration,
  "alter table public.automation_policies enable row level security",
  "automation_policies RLS enabled"
);
assertNotContains(
  policiesMigration,
  "create or replace function",
  "automation_policies migration has no RPCs"
);

assertContains(runsMigration, "create table public.automation_runs", "automation_runs migration creates table");
assertContains(runsMigration, "started_at timestamptz not null", "automation_runs.started_at column");
assertContains(runsMigration, "completed_at timestamptz", "automation_runs.completed_at column");
assertContains(runsMigration, "status text not null", "automation_runs.status column");
assertContains(runsMigration, "summary jsonb not null", "automation_runs.summary column");
assertContains(runsMigration, "error text", "automation_runs.error column");
assertContains(
  runsMigration,
  "organisation_id uuid not null references public.organisations",
  "automation_runs org scope"
);
assertContains(
  runsMigration,
  "alter table public.automation_runs enable row level security",
  "automation_runs RLS enabled"
);
assertContains(
  runsMigration,
  "has_org_role(array['admin', 'editor'])",
  "automation_runs admin+editor read policy"
);
assertNotContains(runsMigration, "create or replace function", "automation_runs migration has no RPCs");
assertNotContains(
  runsMigration,
  "automation_runs_admin_insert",
  "automation_runs has no authenticated insert policy"
);

const migrationFiles = readdirSync(migrationsDir);
assertNotContains(
  migrationFiles.join("\n"),
  "notification_queue",
  "no notification_queue migration in Phase 1"
);
assertNotContains(
  migrationFiles.join("\n"),
  "delivery_log",
  "no delivery_log migration in Phase 1"
);

const configJs = readFileSync(join(root, "js", "data", "config.js"), "utf8");
assertContains(configJs, "export const AUTOMATION_ENABLED", "config.js exports AUTOMATION_ENABLED");
assertContains(configJs, "readAutomationFromLocation", "config.js browser automation override");
assertContains(
  configJs,
  'process.env?.AUTOMATION_ENABLED === "true"',
  "config.js Node automation env override"
);
assertContains(
  configJs,
  "Committed default is false",
  "config.js documents automation default off"
);

const cloudMapperJs = readFileSync(join(root, "js", "data", "cloud-mapper.js"), "utf8");
assertContains(cloudMapperJs, "@typedef {Object} AutomationPolicyRow", "cloud-mapper AutomationPolicyRow typedef");
assertContains(cloudMapperJs, "@typedef {Object} AutomationRunRow", "cloud-mapper AutomationRunRow typedef");
assertContains(
  cloudMapperJs,
  "@typedef {Object} AutomationPolicyDocument",
  "cloud-mapper AutomationPolicyDocument typedef"
);
assertContains(
  cloudMapperJs,
  "@typedef {Object} AutomationRunSummary",
  "cloud-mapper AutomationRunSummary typedef"
);
assertNotContains(
  cloudMapperJs,
  "function mapAutomation",
  "cloud-mapper has no automation mapper functions in Phase 1"
);

const appJs = readFileSync(join(root, "app.js"), "utf8");
const forbiddenExecutionNeedles = [
  "daily_compliance_scan",
  "process_notification_queue",
  "apply_automation_policies",
  "enqueue_reminder_notifications",
  "get_automation_policies",
  "upsert_automation_policy",
  "list_automation_runs",
  "notification_queue",
  "delivery_log",
];

for (const needle of forbiddenExecutionNeedles) {
  assertNotContains(appJs, needle, `app.js has no ${needle}`);
}

assertNotContains(appJs, "AUTOMATION_ENABLED", "app.js does not wire AUTOMATION_ENABLED yet");

const supabaseFunctionsDir = join(root, "supabase", "functions");
if (existsSync(supabaseFunctionsDir)) {
  const edgeFunctions = readdirSync(supabaseFunctionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .join("\n");

  assertNotContains(edgeFunctions, "daily_compliance_scan", "no daily_compliance_scan Edge Function");
  assertNotContains(edgeFunctions, "process_notification_queue", "no process_notification_queue Edge Function");
}

const savedAutomationEnv = process.env.AUTOMATION_ENABLED;
delete process.env.AUTOMATION_ENABLED;

const { AUTOMATION_ENABLED } = await import("../js/data/config.js");

if (AUTOMATION_ENABLED !== false && AUTOMATION_ENABLED !== undefined) {
  fail(`AUTOMATION_ENABLED default must be false/undefined, got ${JSON.stringify(AUTOMATION_ENABLED)}`);
}

if (savedAutomationEnv === undefined) {
  delete process.env.AUTOMATION_ENABLED;
} else {
  process.env.AUTOMATION_ENABLED = savedAutomationEnv;
}

if (failures.length > 0) {
  console.error("FAIL verify-automation-foundation:");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("V5-0 Phase 1 automation foundation: OK");
console.log("  automation_policies + automation_runs migrations present");
console.log("  AUTOMATION_ENABLED defaults off");
console.log("  cloud-mapper automation row types present (no mappers)");
console.log("  No UI, Edge Functions, cron, queue, email, or automation execution hooks");
