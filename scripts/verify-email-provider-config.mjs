/**
 * V6 Phase 10: Email provider configuration verification.
 * Static and in-memory checks for provider config documentation and module —
 * no Supabase, browser, real email provider, outbound delivery, or app wiring.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getEmailProviderConfig } from "../js/app/automation/email-provider-config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const docPath = join(root, "docs", "v6-email-provider-configuration.md");
const configJsPath = join(root, "js/app/automation/email-provider-config.js");
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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
  "V6 Phase 10 email provider configuration verification (verify-email-provider-config)\n"
);

assert(existsSync(docPath), "docs/v6-email-provider-configuration.md exists");
assert(existsSync(configJsPath), "js/app/automation/email-provider-config.js exists");

const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const configJs = existsSync(configJsPath) ? readFileSync(configJsPath, "utf8") : "";
const appJs = existsSync(appJsPath) ? readFileSync(appJsPath, "utf8") : "";
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(packageJson, '"verify-email-provider-config"', "package.json verify script");

/** @type {readonly string[]} */
const REQUIRED_DOC_SECTIONS = [
  "## Supported future provider options",
  "## Required environment variables",
  "## Sender address rules",
  "## Reply-To address rules",
  "## Test mode vs production mode",
  "## Rate limits",
  "## Provider health checks",
  "## Secret and API key handling",
  "## Audit requirements",
  "## GDPR and data handling notes",
];

for (const section of REQUIRED_DOC_SECTIONS) {
  assertContains(doc, section, `documentation section ${section}`);
}

assertContains(doc, "Resend", "documentation mentions Resend");
assertContains(doc, "SendGrid", "documentation mentions SendGrid");
assertContains(doc, "SMTP", "documentation mentions SMTP");
assertContains(doc, "EMAIL_PROVIDER", "documentation mentions EMAIL_PROVIDER");
assertContains(doc, "getEmailProviderConfig", "documentation mentions getEmailProviderConfig");

assertContains(configJs, "export function getEmailProviderConfig", "config module export");

const forbiddenConfigNeedles = [
  "fetch(",
  "XMLHttpRequest",
  "nodemailer",
  "createTransport",
  "smtp.",
  "sendReminder",
  "sendEmail",
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "process_notification_queue",
  ".rpc(",
  "supabase",
  "history_entries",
  "add_default_actions",
];

for (const needle of forbiddenConfigNeedles) {
  assertNotContains(configJs, needle, `email-provider-config.js has no ${needle}`);
}

assertNotContains(appJs, "email-provider-config", "app.js is not wired to email-provider-config");
assertNotContains(appJs, "getEmailProviderConfig", "app.js does not import getEmailProviderConfig");

const defaultConfig = getEmailProviderConfig({});

assertDeepEqual(
  defaultConfig,
  {
    provider: "none",
    mode: "disabled",
    fromEmail: null,
    replyToEmail: null,
    rateLimitPerRun: 50,
    enabled: false,
  },
  "default config is safely disabled"
);

const emptyEnvConfig = getEmailProviderConfig(undefined);

assertEqual(emptyEnvConfig.enabled, false, "undefined env defaults to enabled: false");
assertEqual(emptyEnvConfig.provider, "none", "undefined env defaults to provider: none");
assertEqual(emptyEnvConfig.mode, "disabled", "undefined env defaults to mode: disabled");

const partialEnvConfig = getEmailProviderConfig({
  EMAIL_PROVIDER: "resend",
  EMAIL_MODE: "production",
});

assertEqual(partialEnvConfig.enabled, false, "provider/mode without EMAIL_PROVIDER_ENABLED stays disabled");

const enabledConfig = getEmailProviderConfig({
  EMAIL_PROVIDER: "resend",
  EMAIL_MODE: "production",
  EMAIL_PROVIDER_ENABLED: "true",
  EMAIL_FROM_ADDRESS: "reminders@example.org",
  EMAIL_REPLY_TO_ADDRESS: "safeguarding@example.org",
  EMAIL_RATE_LIMIT_PER_RUN: "25",
});

assertEqual(enabledConfig.provider, "resend", "parsed provider");
assertEqual(enabledConfig.mode, "production", "parsed mode");
assertEqual(enabledConfig.enabled, true, "explicit opt-in enables config");
assertEqual(enabledConfig.fromEmail, "reminders@example.org", "parsed fromEmail");
assertEqual(enabledConfig.replyToEmail, "safeguarding@example.org", "parsed replyToEmail");
assertEqual(enabledConfig.rateLimitPerRun, 25, "parsed rateLimitPerRun");

const disabledExplicitConfig = getEmailProviderConfig({
  EMAIL_PROVIDER: "sendgrid",
  EMAIL_MODE: "disabled",
  EMAIL_PROVIDER_ENABLED: "true",
});

assertEqual(disabledExplicitConfig.enabled, false, "disabled mode cannot enable sending");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-email-provider-config: all checks OK");
