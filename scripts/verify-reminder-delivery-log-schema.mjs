/**
 * V6 Phase 3: Reminder delivery log schema verification.
 * Static checks for reminder_delivery_logs migration: table, columns, constraints,
 * dedup index, RLS policies, and absence of delivery execution hooks.
 * No Supabase smoke, browser, email provider, or app wiring.
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

/**
 * @returns {{ filename: string, content: string }}
 */
function findDeliveryLogMigration() {
  const matches = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith("_create_reminder_delivery_logs.sql"))
    .sort();

  if (matches.length === 0) {
    fail("missing migration matching *_create_reminder_delivery_logs.sql");
    return { filename: "", content: "" };
  }

  const filename = matches[matches.length - 1];
  const content = readFileSync(join(migrationsDir, filename), "utf8");

  return { filename, content };
}

console.log(
  "V6 Phase 3 reminder delivery log schema verification (verify-reminder-delivery-log-schema)\n"
);

const { filename: migrationFilename, content: migration } = findDeliveryLogMigration();

assert(migrationFilename.length > 0, "delivery log migration file exists");

/** @type {readonly string[]} */
const REQUIRED_COLUMNS = [
  "id uuid primary key default gen_random_uuid()",
  "organisation_id uuid not null references public.organisations",
  "automation_run_id uuid references public.automation_runs",
  "queue_item_id text not null",
  "compliance_record_id uuid",
  "person_id uuid",
  "recipient_email text",
  "subject text not null",
  "body_text text not null",
  "delivery_status text not null",
  "prepared_at timestamptz",
  "sent_at timestamptz",
  "delivered_at timestamptz",
  "failed_at timestamptz",
  "failure_reason text",
  "metadata jsonb not null default '{}'::jsonb",
  "created_by uuid",
  "created_at timestamptz not null default now()",
  "updated_at timestamptz not null default now()",
];

assertContains(migration, "create table public.reminder_delivery_logs", "reminder_delivery_logs table");

for (const column of REQUIRED_COLUMNS) {
  assertContains(migration, column, `column definition ${column.split(" ")[0]}`);
}

assertContains(
  migration,
  "delivery_status in ('queued', 'prepared', 'sending', 'delivered', 'failed', 'cancelled')",
  "delivery_status lifecycle constraint"
);

assertContains(migration, "create unique index reminder_delivery_logs_dedup_idx", "dedup unique index");
assertContains(migration, "organisation_id", "dedup index organisation_id");
assertContains(migration, "compliance_record_id", "dedup index compliance_record_id");
assertContains(migration, "metadata->>'reminderWindow'", "dedup index reminderWindow metadata");
assertContains(migration, "(prepared_at::date)", "dedup index prepared_at date");
assertContains(migration, "where compliance_record_id is not null", "dedup partial index predicate");

assertContains(
  migration,
  "alter table public.reminder_delivery_logs enable row level security",
  "RLS enabled"
);

assertContains(
  migration,
  "reminder_delivery_logs_member_select",
  "admin/editor select policy"
);
assertContains(
  migration,
  "for select",
  "select policy present"
);
assertContains(
  migration,
  "has_org_role(array['admin', 'editor'])",
  "select policy admin+editor"
);

assertContains(
  migration,
  "reminder_delivery_logs_admin_insert",
  "admin insert policy"
);
assertContains(
  migration,
  "for insert",
  "insert policy present"
);
assertContains(
  migration,
  "reminder_delivery_logs_admin_update",
  "admin update policy"
);
assertContains(
  migration,
  "for update",
  "update policy present"
);

const insertPolicyStart = migration.indexOf("reminder_delivery_logs_admin_insert");
const updatePolicyStart = migration.indexOf("reminder_delivery_logs_admin_update");
const insertPolicySection =
  insertPolicyStart >= 0 ? migration.slice(insertPolicyStart, insertPolicyStart + 500) : "";
const updatePolicySection =
  updatePolicyStart >= 0 ? migration.slice(updatePolicyStart, updatePolicyStart + 500) : "";

assertContains(insertPolicySection, "has_org_role(array['admin'])", "insert policy admin-only");
assertContains(updatePolicySection, "has_org_role(array['admin'])", "update policy admin-only");
assertNotContains(insertPolicySection, "'viewer'", "insert policy excludes viewer");
assertNotContains(updatePolicySection, "'viewer'", "update policy excludes viewer");
assertNotContains(insertPolicySection, "'editor'", "insert policy excludes editor");
assertNotContains(updatePolicySection, "'editor'", "update policy excludes editor");

assertNotContains(migration, "for delete", "no delete policy yet");
assertNotContains(migration, "create or replace function", "migration has no RPCs");

assertContains(migration, "reminder_delivery_logs_set_updated_at", "updated_at trigger");
assertContains(migration, "execute function public.set_updated_at()", "shared set_updated_at trigger");

const packageJson = readFileSync(join(root, "package.json"), "utf8");
assertContains(
  packageJson,
  '"verify-reminder-delivery-log-schema"',
  "package.json verify script"
);

const appJs = readFileSync(join(root, "app.js"), "utf8");
const forbiddenExecutionNeedles = [
  "buildReminderDeliveryRecords",
  "sendReminder",
  "process_notification_queue",
  "enqueue_reminder_notifications",
  "EmailProvider",
  "createResendEmailProvider",
  "executeMockReminderDelivery",
];

for (const needle of forbiddenExecutionNeedles) {
  assertNotContains(appJs, needle, `app.js has no ${needle}`);
}

assertContains(appJs, "loadDeliveryOperationsLog", "app.js loads delivery operations log (read-only)");
assertNotContains(appJs, "create_reminder_delivery_log", "app.js does not create delivery logs");

const cloudAutomationStoreJs = readFileSync(
  join(root, "js", "data", "cloud-automation-store.js"),
  "utf8"
);
assertContains(
  cloudAutomationStoreJs,
  "get_reminder_delivery_logs",
  "cloud-automation-store loads delivery logs via get_reminder_delivery_logs"
);
assertContains(
  cloudAutomationStoreJs,
  "createReminderDeliveryLog",
  "cloud-automation-store exposes createReminderDeliveryLog repository method"
);
assertNotContains(
  appJs,
  "createReminderDeliveryLog",
  "app.js does not call createReminderDeliveryLog"
);

const repositoryJs = readFileSync(join(root, "js", "data", "repository.js"), "utf8");
assertNotContains(repositoryJs, "reminder_delivery_logs", "repository has no direct delivery log wiring");

const migrationFiles = readdirSync(migrationsDir).join("\n");
assertNotContains(migrationFiles, "process_notification_queue", "no queue processor migration");
assertNotContains(migrationFiles, "send_reminder", "no send_reminder migration");

if (failures.length > 0) {
  console.error("Failures:");
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log(`  Migration: ${migrationFilename}`);
console.log("  Table: public.reminder_delivery_logs");
console.log(`  Columns (${REQUIRED_COLUMNS.length}): verified`);
console.log("  Lifecycle status constraint: verified");
console.log("  Dedup unique index: verified");
console.log("  RLS: enabled");
console.log("  Policies: admin+editor select, admin insert/update, no delete");
console.log("  updated_at trigger: public.set_updated_at()");
console.log("  No app/provider/execution hooks wired");
console.log("\nV6 reminder delivery log schema verification: OK");
