/**
 * V6 Phase 43: Edge Function mark-as-sent verification.
 * Static checks for test-mode mark_reminder_sent after delivered+log persistence,
 * browser safety (no browser mark-sent RPC), and outcome safeguards.
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
const markSentRpcMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260203000001_mark_reminder_sent_rpc.sql",
);
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const edgeDeliveryDocPath = join(root, "docs", "v6-edge-delivery-function.md");
const v5DocPath = join(root, "docs", "v5-automated-compliance-operations.md");
const roadmapPath = join(root, "ROADMAP.md");
const manualDeliveryExecutionPath = join(
  root,
  "js/app/automation/manual-delivery-execution.js",
);
const manualDeliveryUiPath = join(root, "js/app/automation/manual-delivery-ui.js");
const edgeDeliveryInvokePath = join(
  root,
  "js/app/automation/edge-delivery-invoke.js",
);
const reminderDeliveryRecordBuilderPath = join(
  root,
  "js/app/automation/reminder-delivery-record-builder.js",
);
const reminderQueuePath = join(root, "js/app/automation/reminder-queue.js");
const indexHtmlPath = join(root, "index.html");
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

/**
 * @param {string} source
 * @param {string} startNeedle
 * @param {string} endNeedle
 * @returns {string}
 */
function extractBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);

  if (start === -1) {
    return "";
  }

  const end = source.indexOf(endNeedle, start + startNeedle.length);

  if (end === -1) {
    return source.slice(start);
  }

  return source.slice(start, end);
}

console.log(
  "V6 Phase 43 Edge Function mark-as-sent verification (verify-edge-delivery-mark-sent)\n",
);

assert(existsSync(functionPath), "supabase/functions/send-reminder-deliveries/index.ts exists");
assert(existsSync(markSentRpcMigrationPath), "mark_reminder_sent RPC migration exists");

const functionSource = readFileSync(functionPath, "utf8");
const markSentRpcMigration = readFileSync(markSentRpcMigrationPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const edgeDeliveryDoc = readFileSync(edgeDeliveryDocPath, "utf8");
const v5Doc = readFileSync(v5DocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const manualDeliveryExecutionJs = readFileSync(manualDeliveryExecutionPath, "utf8");
const manualDeliveryUiJs = readFileSync(manualDeliveryUiPath, "utf8");
const edgeDeliveryInvokeJs = readFileSync(edgeDeliveryInvokePath, "utf8");
const reminderDeliveryRecordBuilderJs = readFileSync(reminderDeliveryRecordBuilderPath, "utf8");
const reminderQueueJs = readFileSync(reminderQueuePath, "utf8");
const indexHtml = readFileSync(indexHtmlPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-edge-delivery-mark-sent"',
  "package.json verify-edge-delivery-mark-sent script",
);

console.log("--- Edge Function mark-as-sent (required) ---");

assertContains(functionSource, "mark_reminder_sent", "index.ts calls mark_reminder_sent RPC");
assertContains(functionSource, "MARK_SENT_RPC", "index.ts defines MARK_SENT_RPC constant");
assertContains(functionSource, "markReminderSentAfterDelivery", "index.ts has markReminderSentAfterDelivery helper");
assertContains(functionSource, "maybeMarkReminderSentAfterDelivery", "index.ts gates mark-as-sent helper");
assertContains(functionSource, "mapReminderWindowToRpcCode", "index.ts maps reminderWindow to RPC codes");
assertContains(functionSource, 'config.emailMode !== "test"', "index.ts gates mark-as-sent to test mode");
assertContains(functionSource, "persistResult.persisted", "index.ts requires log persistence before mark-as-sent");
assertContains(functionSource, "markSent", "index.ts tracks markSent summary count");
assertContains(functionSource, "markSentFailed", "index.ts tracks markSentFailed summary count");
assertContains(functionSource, "markSentSkipped", "index.ts tracks markSentSkipped summary count");
assertContains(functionSource, "markSentStatus", "index.ts returns markSentStatus per result");
assertContains(functionSource, "markSentError", "index.ts can return markSentError per result");
assertContains(functionSource, "markSentSkippedReason", "index.ts can return markSentSkippedReason per result");

const deliveredBranch = extractBetween(
  functionSource,
  'if (outcome.deliveryStatus === "delivered")',
  'failed += 1;',
);

assertContains(
  deliveredBranch,
  "maybeMarkReminderSentAfterDelivery",
  "mark-as-sent runs only in delivered outcome branch",
);
assertContains(
  deliveredBranch,
  "if (persistResult.persisted)",
  "mark-as-sent runs only after successful log persistence",
);

const skippedBranch = extractBetween(
  functionSource,
  "if (skipReason)",
  "if (attempted >= config.rateLimitPerRun)",
);

assertNotContains(
  skippedBranch,
  "mark_reminder_sent",
  "skipped outcomes do not call mark_reminder_sent",
);
assertNotContains(
  skippedBranch,
  "maybeMarkReminderSentAfterDelivery",
  "skipped outcomes do not invoke mark-as-sent helper",
);

const failedBranch = extractBetween(functionSource, "failed += 1;", "return {");

assertNotContains(
  failedBranch,
  "mark_reminder_sent",
  "failed outcomes do not call mark_reminder_sent",
);
assertNotContains(
  failedBranch,
  "maybeMarkReminderSentAfterDelivery",
  "failed outcomes do not invoke mark-as-sent helper",
);

assertNotContains(
  functionSource,
  "SUPABASE_SERVICE_ROLE_KEY",
  "index.ts must not use SUPABASE_SERVICE_ROLE_KEY for mark-as-sent",
);

console.log("--- compliance record linkage (required) ---");

assertContains(
  reminderQueueJs,
  "complianceRecordId",
  "reminder-queue.js carries complianceRecordId on queue items",
);
assertContains(
  reminderDeliveryRecordBuilderJs,
  "complianceRecordId",
  "reminder-delivery-record-builder.js includes complianceRecordId",
);
assertContains(
  edgeDeliveryInvokeJs,
  "complianceRecordId",
  "edge-delivery-invoke.js forwards complianceRecordId to Edge Function",
);

console.log("--- RPC contract (required) ---");

assertContains(markSentRpcMigration, "create or replace function public.mark_reminder_sent", "RPC migration defines mark_reminder_sent");
assertContains(markSentRpcMigration, "p_record_id uuid", "RPC accepts p_record_id");
assertContains(markSentRpcMigration, "p_reminder_type text", "RPC accepts p_reminder_type");

console.log("--- browser safety (required) ---");

const forbiddenManualNeedles = [
  "markReminderSent",
  "mark_reminder_sent",
];

for (const needle of forbiddenManualNeedles) {
  assertNotContains(
    manualDeliveryExecutionJs,
    needle,
    `manual-delivery-execution.js has no ${needle}`,
  );
}

assertContains(
  manualDeliveryExecutionJs,
  "markSent",
  "manual-delivery-execution.js maps markSent summary from Edge response",
);
assertContains(
  manualDeliveryUiJs,
  "markSent",
  "manual-delivery-ui.js exposes markSent in result summary",
);
assertContains(
  indexHtml,
  "manual-delivery-test-result-mark-sent",
  "index.html shows mark-sent result counts",
);
assertContains(
  appJs,
  "manual-delivery-test-result-mark-sent-section",
  "app.js renders mark-sent result section",
);

console.log("--- documentation ---");

assertContains(
  edgeDeliveryDoc,
  "## Phase 43",
  "edge delivery doc has Phase 43 section",
);
assertContains(
  deliveryArchDoc,
  "## Phase 43",
  "delivery architecture doc has Phase 43 section",
);
assertContains(
  v5Doc,
  "Phase 43",
  "v5 automated compliance operations doc references Phase 43",
);
assertContains(
  roadmap,
  "V6 Phase 43",
  "ROADMAP.md references V6 Phase 43",
);
assertContains(
  edgeDeliveryDoc,
  "verify-edge-delivery-mark-sent",
  "edge delivery doc references verify-edge-delivery-mark-sent",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-edge-delivery-mark-sent: all checks OK");
console.log("  server: Edge Function marks reminders sent via mark_reminder_sent after delivered+log persistence (test mode)");
console.log("  safeguards: skipped/failed/unpersisted deliveries never call mark_reminder_sent");
console.log("  browser: no mark-sent RPC writes — summary display only");
