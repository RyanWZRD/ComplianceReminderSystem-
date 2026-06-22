/**
 * V6 Phase 58: send-test-email manual test-send delivery log audit verification.
 * Static checks for reminder_delivery_logs insert after provider success only,
 * sent_at / provider_message_id audit path isolation, and safety gates.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const sendTestEmailPath = join(
  root,
  "supabase",
  "functions",
  "send-test-email",
  "index.ts",
);
const scheduledRunnerPath = join(
  root,
  "supabase",
  "functions",
  "scheduled-reminder-runner",
  "index.ts",
);
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const automatedRemindersDocPath = join(root, "docs", "v6-automated-email-reminders.md");
const roadmapPath = join(root, "ROADMAP.md");
const packageJsonPath = join(root, "package.json");

const edgeFunctionPaths = [
  scheduledRunnerPath,
  join(root, "supabase", "functions", "verify-email-provider-disabled", "index.ts"),
];

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
 * @param {string} beforeNeedle
 * @param {string} afterNeedle
 * @param {string} label
 */
function assertAppearsBefore(source, beforeNeedle, afterNeedle, label) {
  const beforeIndex = source.indexOf(beforeNeedle);
  const afterIndex = source.indexOf(afterNeedle);

  if (beforeIndex === -1) {
    fail(`${label}: missing ${JSON.stringify(beforeNeedle)}`);
    return;
  }

  if (afterIndex === -1) {
    fail(`${label}: missing ${JSON.stringify(afterNeedle)}`);
    return;
  }

  if (beforeIndex >= afterIndex) {
    fail(
      `${label}: ${JSON.stringify(beforeNeedle)} must appear before ${JSON.stringify(afterNeedle)}`,
    );
  }
}

/**
 * @param {string} source
 * @param {string} label
 */
function assertSendReminderEmailCalledAtMostOnce(source, label) {
  const matches = source.match(/sendReminderEmail\s*\(/g) ?? [];
  assert(matches.length <= 1, `${label}: sendReminderEmail called at most once`);
}

console.log(
  "V6 Phase 58 send-test-email delivery log audit verification (verify-send-test-email-delivery-log-audit)\n",
);

assert(existsSync(sendTestEmailPath), "supabase/functions/send-test-email/index.ts exists");

const sendTestEmailSource = readFileSync(sendTestEmailPath, "utf8");
const scheduledRunnerSource = readFileSync(scheduledRunnerPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const automatedRemindersDoc = readFileSync(automatedRemindersDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

console.log("--- send-test-email delivery log audit path (required) ---");

assertContains(
  packageJson,
  '"verify-send-test-email-delivery-log-audit"',
  "package.json verify-send-test-email-delivery-log-audit script",
);
assertContains(
  packageJson,
  '"verify-send-test-email-delivery-log-audit-staging"',
  "package.json verify-send-test-email-delivery-log-audit-staging script",
);

assertContains(
  sendTestEmailSource,
  'from("reminder_delivery_logs")',
  "send-test-email inserts into reminder_delivery_logs",
);
assertContains(
  sendTestEmailSource,
  "insertManualTestDeliveryLog",
  "send-test-email has delivery log insert helper",
);
assertContains(
  sendTestEmailSource,
  "createServiceSupabaseClient",
  "send-test-email uses service-role client for audit insert",
);
assertContains(
  sendTestEmailSource,
  'delivery_status: "sent"',
  "send-test-email sets delivery_status sent",
);
assertContains(sendTestEmailSource, "sent_at:", "send-test-email sets sent_at on audit row");
assertContains(
  sendTestEmailSource,
  "provider_message_id:",
  "send-test-email persists provider_message_id",
);
assertContains(sendTestEmailSource, 'provider: "resend"', "send-test-email sets provider resend");
assertContains(
  sendTestEmailSource,
  'compliance_type: "manual_test_email"',
  "send-test-email sets compliance_type manual_test_email",
);
assertContains(
  sendTestEmailSource,
  'reminder_type: "manual_test"',
  "send-test-email sets reminder_type manual_test",
);
assertContains(
  sendTestEmailSource,
  'mode: "manual_test_send"',
  "payload includes mode manual_test_send",
);
assertContains(sendTestEmailSource, "deliveryLogId", "response includes deliveryLogId");

const serveHandlerSource = sendTestEmailSource.slice(
  sendTestEmailSource.indexOf("Deno.serve"),
);

assertAppearsBefore(
  serveHandlerSource,
  "sendReminderEmail",
  "insertManualTestDeliveryLog",
  "delivery log insert only after provider send in request handler",
);
assertAppearsBefore(
  serveHandlerSource,
  'providerResult.status === "error"',
  "insertManualTestDeliveryLog",
  "delivery log insert only after provider error guard in request handler",
);

assertNotContains(
  sendTestEmailSource,
  'delivery_status: "failed"',
  "send-test-email does not insert failed delivery_status in this phase",
);

assertSendReminderEmailCalledAtMostOnce(sendTestEmailSource, "send-test-email");

assertNotContains(
  sendTestEmailSource,
  'from("automation_runs")',
  "send-test-email does not write automation_runs",
);
assertNotContains(sendTestEmailSource, "mark_reminder_sent", "send-test-email has no mark_reminder_sent");
assertNotContains(
  sendTestEmailSource,
  'from("compliance_records")',
  "send-test-email does not mutate compliance records",
);

const bulkSendPatterns = [
  /for\s*\([^)]*\)\s*\{[^}]*sendReminderEmail/s,
  /\.map\s*\([^)]*\)\s*=>\s*[^;{]*sendReminderEmail/s,
  /Promise\.all\s*\([^)]*sendReminderEmail/s,
];

for (const pattern of bulkSendPatterns) {
  assert(!pattern.test(sendTestEmailSource), "send-test-email has no bulk loop sends");
}

console.log("--- sent_at / provider_message_id path isolation (required) ---");

assertContains(sendTestEmailSource, "sent_at:", "send-test-email sets sent_at in manual test audit path");
assert(
  /provider_message_id:\s*params\.providerMessageId/.test(sendTestEmailSource),
  "send-test-email persists provider_message_id from provider result",
);

for (const functionPath of edgeFunctionPaths) {
  const source = readFileSync(functionPath, "utf8");
  const relativePath = functionPath.replace(root + "\\", "").replace(root + "/", "");

  assertNotContains(source, "sent_at:", `${relativePath} does not assign sent_at`);
  assertNotContains(
    source,
    "provider_message_id: params",
    `${relativePath} does not persist provider_message_id from send result`,
  );
}

assertContains(
  scheduledRunnerSource,
  "provider_message_id: null",
  "scheduled-reminder-runner dry-run rows keep provider_message_id null",
);

console.log("--- scheduled-reminder-runner safety ---");

assertNotContains(
  scheduledRunnerSource,
  "email-provider",
  "scheduled-reminder-runner does not import email-provider",
);
assertNotContains(
  scheduledRunnerSource,
  "sendReminderEmail",
  "scheduled-reminder-runner does not call sendReminderEmail",
);
assertNotContains(
  scheduledRunnerSource,
  "send-test-email",
  "scheduled-reminder-runner does not reference send-test-email",
);

console.log("--- documentation ---");

assertContains(deliveryArchDoc, "Phase 58", "v6-delivery-architecture.md documents Phase 58");
assertContains(
  automatedRemindersDoc,
  "Phase 58",
  "v6-automated-email-reminders.md documents Phase 58",
);
assertContains(roadmap, "Phase 58", "ROADMAP.md documents Phase 58");
assertContains(
  deliveryArchDoc,
  "manual_test_send",
  "delivery architecture documents manual_test_send payload mode",
);

console.log("--- build ---");

const build = spawnSync("npm", ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (failures.length > 0) {
  console.error("\nverify-send-test-email-delivery-log-audit failures:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("\nverify-send-test-email-delivery-log-audit: all checks OK");
console.log("  - send-test-email persists one sent reminder_delivery_logs row after provider success");
console.log("  - sent_at and provider_message_id only in send-test-email audit path");
console.log("  - scheduled-reminder-runner unchanged (no email-provider import)");
console.log("  - no mark_reminder_sent, compliance mutation, or bulk sends");
console.log("  - response includes deliveryLogId");
console.log("  - npm run build passes");
