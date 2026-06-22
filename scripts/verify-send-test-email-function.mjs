/**
 * V6 Phase 56: send-test-email Edge Function verification.
 * Static/config checks only — no live email sends.
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
 * @param {string} label
 */
function assertSendReminderEmailCalledAtMostOnce(source, label) {
  const matches = source.match(/sendReminderEmail\s*\(/g) ?? [];
  assert(matches.length <= 1, `${label}: sendReminderEmail called at most once`);
}

console.log(
  "V6 Phase 56 send-test-email function verification (verify-send-test-email-function)\n",
);

assert(existsSync(sendTestEmailPath), "supabase/functions/send-test-email/index.ts exists");

const sendTestEmailSource = readFileSync(sendTestEmailPath, "utf8");
const scheduledRunnerSource = readFileSync(scheduledRunnerPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const automatedRemindersDoc = readFileSync(automatedRemindersDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

console.log("--- send-test-email function contract ---");

assertContains(
  packageJson,
  '"verify-send-test-email-function"',
  "package.json verify-send-test-email-function script",
);
assertContains(
  packageJson,
  '"verify-send-test-email-disabled-staging"',
  "package.json verify-send-test-email-disabled-staging script",
);

assertContains(sendTestEmailSource, 'req.method !== "POST"', "POST only");
assertContains(sendTestEmailSource, "hasAuthorizationHeader", "requires Authorization header");
assertContains(sendTestEmailSource, "auth.getUser", "requires authenticated user");
assertContains(sendTestEmailSource, "EMAIL_SENDING_ENABLED", "reads EMAIL_SENDING_ENABLED");
assertContains(sendTestEmailSource, "isEmailSendingEnabled", "gates on isEmailSendingEnabled");
assertContains(sendTestEmailSource, "TEST_EMAIL_ALLOWLIST", "reads TEST_EMAIL_ALLOWLIST");
assertContains(sendTestEmailSource, "parseTestEmailAllowlist", "parses TEST_EMAIL_ALLOWLIST");
assertContains(sendTestEmailSource, "recipient_not_allowlisted", "rejects non-allowlisted recipients");
assertContains(sendTestEmailSource, "missing_recipient", "rejects missing recipient");
assertContains(sendTestEmailSource, "missing_subject", "rejects missing subject");
assertContains(sendTestEmailSource, "missing_body_text", "rejects missing bodyText");
assertContains(sendTestEmailSource, "RESEND_API_KEY", "requires RESEND_API_KEY via config");
assertContains(sendTestEmailSource, "EMAIL_FROM_ADDRESS", "requires EMAIL_FROM_ADDRESS via config");
assertContains(sendTestEmailSource, "providerMessageId", "returns providerMessageId when sent");
assertSendReminderEmailCalledAtMostOnce(sendTestEmailSource, "send-test-email");

assertNotContains(
  sendTestEmailSource,
  "scheduled-reminder-runner",
  "send-test-email does not import scheduled-reminder-runner",
);
assertNotContains(
  sendTestEmailSource,
  'from("reminder_delivery_logs")',
  "send-test-email does not write reminder_delivery_logs",
);
assertNotContains(
  sendTestEmailSource,
  'from("automation_runs")',
  "send-test-email does not write automation_runs",
);
assertNotContains(
  sendTestEmailSource,
  "mark_reminder_sent",
  "send-test-email has no mark_reminder_sent RPC",
);
assertNotContains(sendTestEmailSource, "sent_at", "send-test-email has no sent_at writes");
assertNotContains(
  sendTestEmailSource,
  "provider_message_id:",
  "send-test-email has no provider_message_id delivery-log writes",
);

const bulkSendPatterns = [
  /for\s*\([^)]*\)\s*\{[^}]*sendReminderEmail/s,
  /\.map\s*\([^)]*\)\s*=>\s*[^;{]*sendReminderEmail/s,
  /Promise\.all\s*\([^)]*sendReminderEmail/s,
];

for (const pattern of bulkSendPatterns) {
  assert(!pattern.test(sendTestEmailSource), "send-test-email has no bulk loop sends");
}

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

assertContains(deliveryArchDoc, "Phase 56", "v6-delivery-architecture.md documents Phase 56");
assertContains(
  automatedRemindersDoc,
  "Phase 56",
  "v6-automated-email-reminders.md documents Phase 56",
);
assertContains(roadmap, "Phase 56", "ROADMAP.md documents Phase 56");
assertContains(
  deliveryArchDoc,
  "TEST_EMAIL_ALLOWLIST",
  "delivery architecture documents TEST_EMAIL_ALLOWLIST",
);
assertContains(
  automatedRemindersDoc,
  "manual only",
  "automated reminders doc notes manual-only test send",
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
  console.error("\nverify-send-test-email-function failures:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("\nverify-send-test-email-function: all checks OK");
console.log("  - send-test-email exists with allowlist + auth + single-send contract");
console.log("  - scheduled-reminder-runner unchanged (no email-provider import)");
console.log("  - no reminder_delivery_logs, automation_runs, mark_reminder_sent, or sent_at writes");
console.log("  - npm run build passes");
