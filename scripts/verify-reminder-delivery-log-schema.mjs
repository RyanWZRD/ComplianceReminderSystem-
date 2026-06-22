/**
 * V6 Phase 49: Reminder delivery log schema verification (scheduled email sends).
 * Static checks for reminder_delivery_logs migration: table, columns, constraints,
 * indexes, RLS select policy, and safety gates for scheduled-reminder-runner.
 * Schema and verification only — no Supabase smoke, browser, or live sends.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

const PHASE_49_MIGRATION = "20260401000009_reminder_delivery_logs_scheduled_send_schema.sql";
const SCHEDULED_RUNNER_PATH = join(
  root,
  "supabase",
  "functions",
  "scheduled-reminder-runner",
  "index.ts",
);

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

console.log(
  "V6 Phase 49 reminder delivery log schema verification (verify-reminder-delivery-log-schema)\n",
);

const migrationPath = join(migrationsDir, PHASE_49_MIGRATION);
assert(existsSync(migrationPath), `Phase 49 migration exists: ${PHASE_49_MIGRATION}`);

const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";

assertContains(migration, "create table public.reminder_delivery_logs", "reminder_delivery_logs table");

/** @type {readonly string[]} */
const REQUIRED_COLUMNS = [
  "id uuid primary key default gen_random_uuid()",
  "organisation_id uuid not null references public.organisations",
  "automation_run_id uuid references public.automation_runs (automation_run_id)",
  "compliance_record_id uuid references public.compliance_records",
  "person_id uuid references public.people",
  "recipient_email text",
  "recipient_name text",
  "compliance_type text",
  "reminder_type text",
  "due_date date",
  "delivery_status text not null default 'pending'",
  "provider text",
  "provider_message_id text",
  "error_code text",
  "error_message text",
  "payload jsonb not null default '{}'::jsonb",
  "created_at timestamptz not null default now()",
  "sent_at timestamptz",
];

for (const column of REQUIRED_COLUMNS) {
  assertContains(migration, column, `column definition ${column.split(" ")[0]}`);
}

assertContains(
  migration,
  "delivery_status in ('pending', 'sent', 'skipped', 'failed')",
  "delivery_status constraint",
);

const REQUIRED_INDEXES = [
  "reminder_delivery_logs_organisation_id_idx",
  "reminder_delivery_logs_automation_run_id_idx",
  "reminder_delivery_logs_compliance_record_id_idx",
  "reminder_delivery_logs_delivery_status_idx",
  "reminder_delivery_logs_created_at_desc_idx",
  "reminder_delivery_logs_provider_message_id_idx",
];

for (const indexName of REQUIRED_INDEXES) {
  assertContains(migration, indexName, `index ${indexName}`);
}

assertContains(
  migration,
  "where provider_message_id is not null",
  "partial provider_message_id index predicate",
);

assertContains(
  migration,
  "alter table public.reminder_delivery_logs enable row level security",
  "RLS enabled",
);

assertContains(migration, "reminder_delivery_logs_org_select", "organisation select policy");
assertContains(migration, "for select", "select policy present");
assertContains(
  migration,
  "organisation_id = public.current_organisation_id()",
  "select policy scoped to organisation",
);

assertNotContains(migration, "for insert", "no authenticated insert policy");
assertNotContains(migration, "for update", "no authenticated update policy");
assertNotContains(migration, "for delete", "no authenticated delete policy");

console.log("--- scheduled-reminder-runner safety gates (required) ---");

assert(existsSync(SCHEDULED_RUNNER_PATH), "scheduled-reminder-runner/index.ts exists");

const scheduledRunnerSource = readFileSync(SCHEDULED_RUNNER_PATH, "utf8");

assertContains(
  scheduledRunnerSource,
  "SCHEDULED_RUNNER_DRY_RUN_MODE",
  "scheduled-reminder-runner dry_run mode constant",
);
assertContains(scheduledRunnerSource, '"dry_run"', "scheduled-reminder-runner dry_run mode value");

const scheduledRunnerForbidden = [
  "create_reminder_delivery_log",
  "api.resend.com",
  "RESEND_API_KEY",
  "sendViaResend",
  "send-reminder-deliveries",
  "mark_reminder_sent",
];

for (const needle of scheduledRunnerForbidden) {
  assertNotContains(
    scheduledRunnerSource,
    needle,
    `scheduled-reminder-runner/index.ts has no ${needle}`,
  );
}

assertContains(
  scheduledRunnerSource,
  '.from("reminder_delivery_logs")',
  "scheduled-reminder-runner writes dry-run delivery logs (Phase 51)",
);
assertNotContains(scheduledRunnerSource, "sent_at:", "scheduled-reminder-runner does not assign sent_at");
assertNotContains(
  scheduledRunnerSource,
  'delivery_status: "sent"',
  "scheduled-reminder-runner does not set sent delivery_status",
);

console.log("--- npm script and documentation (required) ---");

const packageJson = readFileSync(join(root, "package.json"), "utf8");
assertContains(
  packageJson,
  '"verify-reminder-delivery-log-schema"',
  "package.json verify script",
);

const docPaths = [
  join(root, "docs", "v6-delivery-architecture.md"),
  join(root, "docs", "v6-automated-email-reminders.md"),
  join(root, "ROADMAP.md"),
];

for (const docPath of docPaths) {
  const docName = docPath.split(/[/\\]/).pop();
  assert(existsSync(docPath), `${docName} exists`);
  if (existsSync(docPath)) {
    const doc = readFileSync(docPath, "utf8");
    assertContains(doc, "Phase 49", `${docName} references Phase 49`);
    assertContains(doc, "verify-reminder-delivery-log-schema", `${docName} references verification script`);
  }
}

const migrationFiles = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
assert(
  migrationFiles.includes(PHASE_49_MIGRATION),
  `migration file ${PHASE_49_MIGRATION} listed in migrations directory`,
);

if (failures.length > 0) {
  console.error("Failures:");
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log(`  Migration: ${PHASE_49_MIGRATION}`);
console.log("  Table: public.reminder_delivery_logs");
console.log(`  Columns (${REQUIRED_COLUMNS.length}): verified`);
console.log("  delivery_status constraint: pending | sent | skipped | failed");
console.log(`  Indexes (${REQUIRED_INDEXES.length}): verified`);
console.log("  RLS: enabled — org-scoped select only");
console.log("  Write policies: none (server-side only)");
console.log("  scheduled-reminder-runner: dry-run delivery logs only (Phase 51), no Resend / mark-as-sent / sent_at");
console.log("\nV6 Phase 49 reminder delivery log schema verification: OK");
