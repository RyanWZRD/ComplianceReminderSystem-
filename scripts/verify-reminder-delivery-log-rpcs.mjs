/**
 * V6 Phase 4: Reminder delivery log RPC draft verification.
 * Static checks for create/get reminder delivery log RPC migration, role gates,
 * insert into reminder_delivery_logs, and absence of delivery execution hooks.
 * No Supabase smoke, browser, email provider, or app wiring.
 */

import { readFileSync, readdirSync } from "node:fs";
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
function findRpcMigration() {
  const matches = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith("_reminder_delivery_log_rpcs.sql"))
    .sort();

  if (matches.length === 0) {
    fail("missing migration matching *_reminder_delivery_log_rpcs.sql");
    return { filename: "", content: "" };
  }

  const filename = matches[matches.length - 1];
  const content = readFileSync(join(migrationsDir, filename), "utf8");

  return { filename, content };
}

console.log(
  "V6 Phase 4 reminder delivery log RPC verification (verify-reminder-delivery-log-rpcs)\n"
);

const { filename: migrationFilename, content: migration } = findRpcMigration();

assert(migrationFilename.length > 0, "delivery log RPC migration file exists");

assertContains(
  migration,
  "create or replace function public.create_reminder_delivery_log",
  "create_reminder_delivery_log RPC"
);
assertContains(
  migration,
  "create or replace function public.get_reminder_delivery_logs",
  "get_reminder_delivery_logs RPC"
);

assertContains(
  migration,
  "current_user_role() <> 'admin'",
  "create_reminder_delivery_log admin-only write"
);
assertContains(
  migration,
  "Insufficient role to create reminder delivery logs",
  "create_reminder_delivery_log admin denial message"
);

assertContains(
  migration,
  "has_org_role(array['admin', 'editor'])",
  "get_reminder_delivery_logs admin+editor read"
);
assertContains(
  migration,
  "Insufficient role to read reminder delivery logs",
  "get_reminder_delivery_logs role denial message"
);

const getRpcStart = migration.indexOf("create or replace function public.get_reminder_delivery_logs");
const getRpcSection = getRpcStart >= 0 ? migration.slice(getRpcStart) : "";

assertNotContains(getRpcSection, "'viewer'", "get RPC read gate excludes viewer role");
assertContains(getRpcSection, "order by rdl.created_at desc", "get RPC newest-first ordering");

assertContains(migration, "insert into public.reminder_delivery_logs", "create RPC inserts delivery log row");
assertContains(
  migration,
  "array['queued', 'prepared', 'sending', 'delivered', 'failed', 'cancelled']",
  "create RPC delivery status validation"
);
assertContains(migration, "'id', v_row.id", "create RPC returns id");
assertContains(migration, "'delivery_status', v_row.delivery_status", "create RPC returns delivery_status");
assertContains(migration, "'created_at', v_row.created_at", "create RPC returns created_at");

assertContains(migration, "grant execute on function public.create_reminder_delivery_log", "create RPC grant");
assertContains(migration, "grant execute on function public.get_reminder_delivery_logs", "get RPC grant");
assertContains(migration, "to authenticated", "RPC grants to authenticated");

assertNotContains(migration, "mark_reminder_sent", "RPC migration has no mark_reminder_sent");
assertNotContains(migration, "insert into public.compliance_records", "RPC migration does not insert compliance_records");
assertNotContains(migration, "update public.compliance_records", "RPC migration does not update compliance_records");
assertNotContains(migration, "insert into public.history_events", "RPC migration does not insert history_events");
assertNotContains(migration, "insert into public.actions", "RPC migration does not insert actions");
assertNotContains(migration, "EmailProvider", "RPC migration has no EmailProvider");
assertNotContains(migration, "send_reminder", "RPC migration has no send_reminder");
assertNotContains(migration, "process_notification_queue", "RPC migration has no queue processor");
assertNotContains(migration, "resend", "RPC migration has no resend provider");
assertNotContains(migration, "smtp", "RPC migration has no smtp provider");

const packageJson = readFileSync(join(root, "package.json"), "utf8");
assertContains(
  packageJson,
  '"verify-reminder-delivery-log-rpcs": "node scripts/verify-reminder-delivery-log-rpcs.mjs"',
  "package.json verify script"
);

const appJs = readFileSync(join(root, "app.js"), "utf8");
const forbiddenExecutionNeedles = [
  "create_reminder_delivery_log",
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
assertContains(appJs, "loadReminderDeliveryLogs", "app.js loads delivery logs via automation repository");

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
assertContains(
  cloudAutomationStoreJs,
  'supabase.rpc("create_reminder_delivery_log", payload)',
  "cloud-automation-store createReminderDeliveryLog uses create_reminder_delivery_log RPC"
);
assertNotContains(
  readFileSync(join(root, "app.js"), "utf8"),
  "createReminderDeliveryLog",
  "app.js does not call createReminderDeliveryLog"
);

const repositoryJs = readFileSync(join(root, "js", "data", "repository.js"), "utf8");
assertNotContains(repositoryJs, "reminder_delivery_logs", "repository has no direct delivery log wiring");

if (failures.length > 0) {
  console.error("Failures:");
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log(`  Migration: ${migrationFilename}`);
console.log("  RPCs: create_reminder_delivery_log, get_reminder_delivery_logs");
console.log("  Create: admin-only, inserts reminder_delivery_logs, returns id/delivery_status/created_at");
console.log("  Read: admin+editor, viewer denied via role gate, ordered by created_at desc");
console.log("  Grants: authenticated (internal role checks enforced)");
console.log("  No send/provider/app execution hooks wired");
console.log("\nV6 reminder delivery log RPC verification: OK");
