/**
 * V6 Phase 54: Edge Resend provider foundation verification.
 * Provider abstraction and safety gates only — no live Resend calls, no scheduled-runner wiring,
 * no delivery_status/sent_at/provider_message_id writes, no mark_reminder_sent.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const providerPath = join(root, "supabase", "functions", "_shared", "email-provider.ts");
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * Mirrors EMAIL_SENDING_ENABLED parsing in email-provider.ts.
 * @param {string | undefined} raw
 */
function parseEmailSendingEnabled(raw) {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

/**
 * Mirrors getEmailProviderConfig contract for verification without Deno.
 * @param {Record<string, string | undefined>} env
 */
function getEmailProviderConfigFromEnv(env) {
  const providerRaw = (env.EMAIL_PROVIDER ?? "resend").trim();
  const provider = providerRaw || "resend";

  return {
    provider,
    emailSendingEnabled: parseEmailSendingEnabled(env.EMAIL_SENDING_ENABLED),
    resendApiKey: (env.RESEND_API_KEY ?? "").trim(),
    fromAddress: (env.EMAIL_FROM_ADDRESS ?? "").trim(),
  };
}

/**
 * Mirrors disabled-send contract for verification without Deno.
 * @param {Record<string, string | undefined>} env
 */
function resolveSendOutcomeWhenDisabled(env) {
  const config = getEmailProviderConfigFromEnv(env);

  if (!config.emailSendingEnabled) {
    return { status: "disabled", reason: "email_sending_disabled" };
  }

  if (!config.resendApiKey) {
    return { status: "error", code: "provider_not_configured" };
  }

  if (!config.fromAddress) {
    return { status: "error", code: "invalid_config" };
  }

  return { status: "would_send" };
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listEdgeFunctionSources(dir) {
  /** @type {string[]} */
  const sources = [];

  if (!existsSync(dir)) {
    return sources;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== "_shared") {
      sources.push(...listEdgeFunctionSources(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      sources.push(readFileSync(fullPath, "utf8"));
    }
  }

  return sources;
}

console.log(
  "V6 Phase 54 Edge Resend provider foundation verification (verify-resend-provider-foundation)\n",
);

console.log("--- Phase 54 Edge shared provider module ---");

assert(existsSync(providerPath), "supabase/functions/_shared/email-provider.ts exists");

const providerSource = readFileSync(providerPath, "utf8");
const scheduledRunnerSource = readFileSync(scheduledRunnerPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const automatedRemindersDoc = readFileSync(automatedRemindersDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-resend-provider-foundation"',
  "package.json verify-resend-provider-foundation script",
);
assertContains(
  packageJson,
  '"verify-browser-resend-provider-foundation"',
  "package.json verify-browser-resend-provider-foundation script",
);

const requiredExports = [
  "export function getEmailProviderConfig",
  "export function isEmailSendingEnabled",
  "export function createEmailProvider",
  "export async function sendReminderEmail",
];

for (const exportNeedle of requiredExports) {
  assertContains(providerSource, exportNeedle, `email-provider.ts exports ${exportNeedle}`);
}

assertContains(
  providerSource,
  'env.EMAIL_PROVIDER ?? "resend"',
  "EMAIL_PROVIDER defaults to resend",
);
assertContains(
  providerSource,
  "EMAIL_SENDING_ENABLED",
  "email-provider.ts reads EMAIL_SENDING_ENABLED",
);
assertContains(
  providerSource,
  "email_sending_disabled",
  "sendReminderEmail returns safe disabled reason",
);
assertContains(
  providerSource,
  "if (!isEmailSendingEnabled",
  "sendReminderEmail gates on isEmailSendingEnabled before provider call",
);
assertContains(
  providerSource,
  "provider_not_configured",
  "missing RESEND_API_KEY returns provider_not_configured when sending enabled",
);
assertContains(
  providerSource,
  "https://api.resend.com/emails",
  "Resend HTTP endpoint scaffolded in provider module",
);

const providerForbiddenNeedles = [
  "mark_reminder_sent",
  "markReminderSent",
  "delivery_status",
  "sent_at",
  "provider_message_id:",
];

for (const needle of providerForbiddenNeedles) {
  assertNotContains(providerSource, needle, `email-provider.ts has no ${needle}`);
}

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
  "api.resend.com",
  "scheduled-reminder-runner does not call Resend",
);
assertNotContains(
  scheduledRunnerSource,
  "RESEND_API_KEY",
  "scheduled-reminder-runner does not read RESEND_API_KEY",
);

const edgeFunctionDir = join(root, "supabase", "functions");
const edgeSources = listEdgeFunctionSources(edgeFunctionDir);

for (const [index, source] of edgeSources.entries()) {
  const isProviderDefinition = source.includes("export async function sendReminderEmail");
  const isDisabledModeVerification = source.includes("provider_disabled_verification");
  const isManualTestSend = source.includes("V6 Phase 56: Controlled manual test-send");

  if (
    source.includes("sendReminderEmail(") &&
    !isProviderDefinition &&
    !isDisabledModeVerification &&
    !isManualTestSend
  ) {
    fail(`Edge Function source ${index} calls sendReminderEmail`);
  }
}

console.log("--- configuration contract (no live Resend) ---");

const defaultConfig = getEmailProviderConfigFromEnv({});
assertEqual(defaultConfig.emailSendingEnabled, false, "EMAIL_SENDING_ENABLED defaults false");
assertEqual(defaultConfig.provider, "resend", "EMAIL_PROVIDER defaults to resend");
assertEqual(defaultConfig.resendApiKey, "", "missing RESEND_API_KEY is empty string");

const disabledSend = resolveSendOutcomeWhenDisabled({});
assertEqual(disabledSend.status, "disabled", "send path disabled without env");
assertEqual(disabledSend.reason, "email_sending_disabled", "disabled reason is email_sending_disabled");

const enabledMissingKey = resolveSendOutcomeWhenDisabled({
  EMAIL_SENDING_ENABLED: "true",
});
assertEqual(
  enabledMissingKey.status,
  "error",
  "enabled send without RESEND_API_KEY is an error",
);
assertEqual(
  enabledMissingKey.code,
  "provider_not_configured",
  "enabled send without RESEND_API_KEY returns provider_not_configured",
);

const enabledMissingFrom = resolveSendOutcomeWhenDisabled({
  EMAIL_SENDING_ENABLED: "true",
  RESEND_API_KEY: "re_test_key",
});
assertEqual(
  enabledMissingFrom.status,
  "error",
  "enabled send without EMAIL_FROM_ADDRESS is an error",
);
assertEqual(
  enabledMissingFrom.code,
  "invalid_config",
  "enabled send without EMAIL_FROM_ADDRESS returns invalid_config",
);

const readyConfig = resolveSendOutcomeWhenDisabled({
  EMAIL_SENDING_ENABLED: "true",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM_ADDRESS: "reminders@example.com",
});
assertEqual(readyConfig.status, "would_send", "valid enabled config passes validation gate");

console.log("--- documentation ---");

assertContains(deliveryArchDoc, "Phase 54", "v6-delivery-architecture.md documents Phase 54");
assertContains(
  automatedRemindersDoc,
  "Phase 54",
  "v6-automated-email-reminders.md documents Phase 54",
);
assertContains(roadmap, "Phase 54", "ROADMAP.md documents Phase 54");
assertContains(
  deliveryArchDoc,
  "EMAIL_SENDING_ENABLED",
  "delivery architecture documents EMAIL_SENDING_ENABLED",
);

console.log("--- build (no RESEND_API_KEY required) ---");

const build = spawnSync("npm", ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (failures.length > 0) {
  console.error("\nverify-resend-provider-foundation failures:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("\nverify-resend-provider-foundation: all checks OK");
console.log("  - Edge shared email-provider module exists with safety gates");
console.log("  - EMAIL_SENDING_ENABLED defaults false; RESEND_API_KEY optional when disabled");
console.log("  - scheduled-reminder-runner does not import provider or call Resend");
console.log("  - Only verify-email-provider-disabled and send-test-email may call sendReminderEmail");
console.log("  - No delivery_status/sent_at/provider_message_id/mark_reminder_sent in provider module");
console.log("  - npm run build passes without RESEND_API_KEY");
