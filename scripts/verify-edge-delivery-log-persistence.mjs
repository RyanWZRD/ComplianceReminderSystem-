/**
 * V6 Phase 42: Edge Function delivery log persistence verification.
 * Static checks for server-side create_reminder_delivery_log writes,
 * browser safety (no service role / no browser RPC writes), and outcome mapping.
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
  "send-reminder-deliveries",
  "index.ts",
);
const rpcMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260401000007_reminder_delivery_log_rpcs.sql",
);
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const edgeDeliveryDocPath = join(root, "docs", "v6-edge-delivery-function.md");
const v5DocPath = join(root, "docs", "v5-automated-compliance-operations.md");
const testDeploymentDocPath = join(root, "docs", "v6-edge-delivery-test-deployment.md");
const roadmapPath = join(root, "ROADMAP.md");
const manualDeliveryExecutionPath = join(
  root,
  "js/app/automation/manual-delivery-execution.js",
);
const edgeDeliveryInvokePath = join(
  root,
  "js/app/automation/edge-delivery-invoke.js",
);
const emailProviderEnvPath = join(root, "js/data/email-provider-env.js");
const appJsPath = join(root, "app.js");
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

function assertNotMatches(source, pattern, label) {
  if (pattern.test(source)) {
    fail(label);
  }
}

console.log(
  "V6 Phase 42 Edge Function delivery log persistence verification (verify-edge-delivery-log-persistence)\n",
);

assert(existsSync(functionPath), "supabase/functions/send-reminder-deliveries/index.ts exists");
assert(existsSync(rpcMigrationPath), "reminder delivery log RPC migration exists");

const functionSource = readFileSync(functionPath, "utf8");
const rpcMigration = readFileSync(rpcMigrationPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const edgeDeliveryDoc = readFileSync(edgeDeliveryDocPath, "utf8");
const v5Doc = readFileSync(v5DocPath, "utf8");
const testDeploymentDoc = readFileSync(testDeploymentDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const manualDeliveryExecutionJs = readFileSync(manualDeliveryExecutionPath, "utf8");
const edgeDeliveryInvokeJs = readFileSync(edgeDeliveryInvokePath, "utf8");
const emailProviderEnvJs = readFileSync(emailProviderEnvPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-edge-delivery-log-persistence"',
  "package.json verify-edge-delivery-log-persistence script",
);

console.log("--- Edge Function delivery log writes (required) ---");

assertContains(functionSource, "create_reminder_delivery_log", "index.ts calls create_reminder_delivery_log RPC");
assertContains(functionSource, "persistDeliveryLog", "index.ts has persistDeliveryLog helper");
assertContains(functionSource, "persisted", "index.ts tracks persisted count");
assertContains(functionSource, "logId", "index.ts returns logId per result");
assertContains(functionSource, "createUserSupabaseClient", "index.ts creates Supabase client from caller JWT");
assertContains(functionSource, "SUPABASE_ANON_KEY", "index.ts uses SUPABASE_ANON_KEY with caller JWT");
assertNotContains(
  functionSource,
  "SUPABASE_SERVICE_ROLE_KEY",
  "index.ts must not use SUPABASE_SERVICE_ROLE_KEY (caller JWT RPC path)",
);
assertNotContains(
  functionSource,
  "service_role",
  "index.ts must not reference service_role key",
);

assertContains(functionSource, 'outcomeStatus: "delivered"', "index.ts maps delivered outcomes");
assertContains(functionSource, 'outcomeStatus: "failed"', "index.ts maps failed outcomes");
assertContains(functionSource, 'outcomeStatus: "skipped"', "index.ts maps skipped outcomes");
assertContains(functionSource, "failureType", "index.ts stores failureType metadata");
assertContains(functionSource, "providerStatusCode", "index.ts stores providerStatusCode metadata");
assertContains(functionSource, "providerMessageId", "index.ts stores providerMessageId metadata");
assertContains(functionSource, 'provider: "resend"', "index.ts stores provider metadata");
assertContains(functionSource, "redirectedToEmail", "index.ts stores test redirect metadata");
assertContains(functionSource, "originalRecipientEmail", "index.ts stores original recipient in test mode");

const forbiddenFunctionNeedles = [
  "mark_reminder_sent",
  "markReminderSent",
  "mark-as-sent",
  "compliance_records",
  "history_entries",
];

for (const needle of forbiddenFunctionNeedles) {
  assertNotContains(functionSource, needle, `index.ts has no ${needle}`);
}

console.log("--- RPC / table assumptions (required) ---");

assertContains(rpcMigration, "create_reminder_delivery_log", "RPC migration defines create_reminder_delivery_log");
assertContains(rpcMigration, "insert into public.reminder_delivery_logs", "RPC inserts reminder_delivery_logs rows");
assertContains(rpcMigration, "get_reminder_delivery_logs", "RPC migration defines get_reminder_delivery_logs read RPC");

console.log("--- browser safety (required) ---");

assertNotContains(
  manualDeliveryExecutionJs,
  "createReminderDeliveryLog",
  "manual-delivery-execution.js must not call createReminderDeliveryLog",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "create_reminder_delivery_log",
  "manual-delivery-execution.js must not call create_reminder_delivery_log",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "persistDeliveryLogPayloads",
  "manual-delivery-execution.js must not call persistDeliveryLogPayloads",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "SERVICE_ROLE",
  "manual-delivery-execution.js must not reference service role key",
);
assertNotContains(
  edgeDeliveryInvokeJs,
  "SERVICE_ROLE",
  "edge-delivery-invoke.js must not reference service role key",
);
assertNotContains(
  appJs,
  "SUPABASE_SERVICE_ROLE_KEY",
  "app.js must not reference SUPABASE_SERVICE_ROLE_KEY",
);

assertContains(
  manualDeliveryExecutionJs,
  "mapEdgeResponseToPersistenceSummary",
  "manual-delivery-execution.js maps Edge Function persistence summary",
);
assertContains(
  manualDeliveryExecutionJs,
  "invokeSendReminderDeliveries",
  "manual-delivery-execution.js still invokes Edge Function only",
);

assert(
  emailProviderEnvJs.includes("RESEND_API_KEY: undefined"),
  "committed email-provider-env.js keeps RESEND_API_KEY undefined",
);
assertNotMatches(
  emailProviderEnvJs,
  /re_[A-Za-z0-9]{12,}/,
  "FORBIDDEN: email-provider-env.js must not contain a real-looking Resend API key",
);

const forbiddenManualNeedles = [
  "markReminderSent",
  "mark_reminder_sent",
  "runManualDeliveryPipeline",
  "runDeliveryPipeline",
];

for (const needle of forbiddenManualNeedles) {
  assertNotContains(
    manualDeliveryExecutionJs,
    needle,
    `manual-delivery-execution.js has no ${needle}`,
  );
}

console.log("--- documentation ---");

assertContains(
  edgeDeliveryDoc,
  "## Phase 42 — Delivery log persistence",
  "edge delivery doc has Phase 42 section",
);
assertContains(
  deliveryArchDoc,
  "## Phase 42 — Delivery log persistence",
  "delivery architecture doc has Phase 42 section",
);
assertContains(
  v5Doc,
  "Phase 42",
  "v5 automated compliance operations doc references Phase 42",
);
assertContains(
  roadmap,
  "V6 Phase 42",
  "ROADMAP.md references V6 Phase 42",
);
assertContains(
  edgeDeliveryDoc,
  "verify-edge-delivery-log-persistence",
  "edge delivery doc references verify-edge-delivery-log-persistence",
);
assertContains(
  testDeploymentDoc,
  "Phase 42",
  "test deployment doc references Phase 42",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-edge-delivery-log-persistence: all checks OK");
console.log("  server: Edge Function persists delivery logs via create_reminder_delivery_log (caller JWT)");
console.log("  browser: no service role key, no browser-side delivery log RPC writes");
console.log("  safety: no mark-sent, compliance, or history mutation in Edge Function path");
