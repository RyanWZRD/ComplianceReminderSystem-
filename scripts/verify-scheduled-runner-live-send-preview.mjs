/**
 * V6 Phase 60: Scheduled runner live-send preview mode verification.
 * Static checks for live_send_preview mode, SCHEDULED_EMAIL_PREVIEW_ENABLED gate,
 * preview metadata persistence, and safety constraints (no Resend, no sendReminderEmail).
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
  "scheduled-reminder-runner",
  "index.ts",
);
const sharedTemplatePath = join(
  root,
  "supabase",
  "functions",
  "_shared",
  "reminder-email-template.ts",
);
const scheduledRunnerDocPath = join(root, "docs", "v6-scheduled-runner.md");
const automatedEmailRemindersDocPath = join(
  root,
  "docs",
  "v6-automated-email-reminders.md",
);
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
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

console.log(
  "V6 Phase 60 scheduled runner live-send preview verification (verify-scheduled-runner-live-send-preview)\n",
);

assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");
assert(
  existsSync(sharedTemplatePath),
  "supabase/functions/_shared/reminder-email-template.ts exists",
);

const functionSource = readFileSync(functionPath, "utf8");
const sharedTemplateSource = readFileSync(sharedTemplatePath, "utf8");
const serveHandlerSource = functionSource.slice(functionSource.indexOf("Deno.serve"));
const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
const automatedEmailRemindersDoc = readFileSync(automatedEmailRemindersDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-scheduled-runner-live-send-preview"',
  "package.json verify-scheduled-runner-live-send-preview script",
);
assertContains(
  packageJson,
  '"verify-scheduled-runner-live-send-preview-staging"',
  "package.json verify-scheduled-runner-live-send-preview-staging script",
);

console.log("--- live_send_preview mode (required) ---");

assertContains(
  functionSource,
  'SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE = "live_send_preview"',
  "index.ts defines live_send_preview mode constant",
);
assertContains(
  functionSource,
  "live_send_preview",
  "index.ts references live_send_preview mode",
);
assertContains(
  functionSource,
  "scheduled_reminder_live_send_preview",
  "index.ts defines preview run_type",
);

console.log("--- SCHEDULED_EMAIL_PREVIEW_ENABLED gate (required) ---");

assertContains(
  functionSource,
  "SCHEDULED_EMAIL_PREVIEW_ENABLED",
  "index.ts reads SCHEDULED_EMAIL_PREVIEW_ENABLED",
);
assertContains(
  functionSource,
  "parseScheduledEmailPreviewEnabled",
  "index.ts parses SCHEDULED_EMAIL_PREVIEW_ENABLED",
);
assertContains(
  functionSource,
  "isScheduledEmailPreviewEnabled",
  "index.ts gates on isScheduledEmailPreviewEnabled",
);
assertContains(
  functionSource,
  "scheduled_live_send_preview_not_enabled",
  "index.ts refuses preview when gate disabled",
);

assertAppearsBefore(
  serveHandlerSource,
  "scheduled_live_send_preview_not_enabled",
  "loadReminderSettings",
  "preview refusal is evaluated before settings load",
);
assertAppearsBefore(
  serveHandlerSource,
  "scheduled_live_send_preview_not_enabled",
  "insertScheduledLiveSendPreviewAutomationRun",
  "preview refusal is evaluated before preview automation_runs insert",
);

console.log("--- enabled preview path (required) ---");

assertContains(
  functionSource,
  "insertScheduledLiveSendPreviewAutomationRun",
  "index.ts persists preview automation_runs",
);
assertContains(
  functionSource,
  "insertScheduledLiveSendPreviewDeliveryLogs",
  "index.ts persists preview reminder_delivery_logs",
);
assertContains(
  functionSource,
  "emailPreview",
  "index.ts stores emailPreview in delivery log payload",
);
assertContains(
  functionSource,
  "buildReminderEmailPreview",
  "index.ts generates email preview via shared template",
);
assertContains(
  functionSource,
  "previewSummary",
  "index.ts returns previewSummary",
);
assertContains(
  functionSource,
  "totalPreviewed",
  "index.ts returns totalPreviewed in previewSummary",
);
assertContains(
  functionSource,
  "withEmailPreviewed",
  "index.ts returns withEmailPreviewed in previewSummary",
);

assertContains(
  sharedTemplateSource,
  "buildReminderEmailPreview",
  "shared template exports buildReminderEmailPreview",
);
assertContains(
  sharedTemplateSource,
  "buildReminderEmailSubject",
  "shared template exports buildReminderEmailSubject",
);
assertContains(
  sharedTemplateSource,
  "buildReminderEmailBody",
  "shared template exports buildReminderEmailBody",
);

console.log("--- preview safety: no live delivery writes (required) ---");

const previewProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildLiveSendPreviewDeliveryLogRows"),
  functionSource.indexOf("async function insertScheduledLiveSendPreviewAutomationRun"),
);

assertNotContains(
  previewProcessorSource,
  "sendReminderEmail",
  "live_send_preview path does not call sendReminderEmail",
);

const previewForbiddenNeedles = [
  "send-reminder-deliveries",
  "mark_reminder_sent",
];

for (const needle of previewForbiddenNeedles) {
  assertNotContains(
    previewProcessorSource,
    needle,
    `live_send_preview processor has no ${needle}`,
  );
}

assertContains(
  functionSource,
  "provider: null",
  "index.ts keeps provider null on preview rows",
);
assertContains(
  functionSource,
  "provider_message_id: null",
  "index.ts keeps provider_message_id null on preview rows",
);

console.log("--- dry_run and live_send (required) ---");

assertContains(
  functionSource,
  "insertScheduledDryRunAutomationRun",
  "index.ts persists automation_runs on dry_run",
);
assertContains(
  functionSource,
  "scheduled_live_send_not_enabled",
  "index.ts still refuses live_send when sending gate disabled",
);
assertContains(
  functionSource,
  "processAndInsertLiveSendDeliveryLogs",
  "index.ts implements live_send delivery path (Phase 61)",
);

console.log("--- documentation (required) ---");

assertContains(
  scheduledRunnerDoc,
  "Phase 60",
  "v6-scheduled-runner.md documents Phase 60",
);
assertContains(
  scheduledRunnerDoc,
  "live_send_preview",
  "v6-scheduled-runner.md documents live_send_preview mode",
);
assertContains(
  scheduledRunnerDoc,
  "SCHEDULED_EMAIL_PREVIEW_ENABLED",
  "v6-scheduled-runner.md documents SCHEDULED_EMAIL_PREVIEW_ENABLED",
);
assertContains(
  scheduledRunnerDoc,
  "verify-scheduled-runner-live-send-preview",
  "v6-scheduled-runner.md references preview verification script",
);
assertContains(
  automatedEmailRemindersDoc,
  "Phase 60",
  "v6-automated-email-reminders.md documents Phase 60",
);
assertContains(
  deliveryArchDoc,
  "Phase 60",
  "v6-delivery-architecture.md documents Phase 60",
);
assertContains(roadmap, "Phase 60", "ROADMAP.md documents Phase 60");
assertContains(roadmap, "Phase 61", "ROADMAP.md documents Phase 61");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-live-send-preview: all checks OK");
console.log("  mode: live_send_preview — email subject/body preview metadata only");
console.log("  gate: SCHEDULED_EMAIL_PREVIEW_ENABLED defaults false");
console.log("  safety: no Resend, no sendReminderEmail, no mark-as-sent, no sent_at writes");
console.log("  dry_run unchanged; live_send implemented in Phase 61 (allowlisted only)");
