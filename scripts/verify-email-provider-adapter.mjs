/**
 * V6 Phase 11: Email provider adapter verification.
 * In-memory checks for adapter factory behaviour — no Supabase, browser,
 * real email provider, outbound delivery, or app wiring.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getEmailProviderConfig } from "../js/app/automation/email-provider-config.js";
import {
  createEmailProviderAdapter,
  UNIMPLEMENTED_EMAIL_PROVIDERS,
} from "../js/app/automation/email-provider-adapter.js";
import { createMockEmailProvider } from "../js/app/automation/mock-email-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const adapterJsPath = join(root, "js/app/automation/email-provider-adapter.js");
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

async function assertRejects(fn, expectedMessagePart, label) {
  try {
    await fn();
    fail(`${label}: expected rejection`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes(expectedMessagePart)) {
      fail(
        `${label}: expected message containing ${JSON.stringify(expectedMessagePart)}, got ${JSON.stringify(message)}`
      );
    }
  }
}

const sendInput = {
  to: "jordan.coordinator@example.com",
  subject: "DBS reminder",
  bodyText: "Please renew your DBS.",
};

console.log(
  "V6 Phase 11 email provider adapter verification (verify-email-provider-adapter)\n"
);

const adapterJs = readFileSync(adapterJsPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(packageJson, '"verify-email-provider-adapter"', "package.json verify script");
assertContains(adapterJs, "export function createEmailProviderAdapter", "adapter module export");

const forbiddenNeedles = [
  "fetch(",
  "XMLHttpRequest",
  "nodemailer",
  "createTransport",
  "smtp.",
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "process_notification_queue",
  ".rpc(",
  "supabase",
  "history_entries",
  "add_default_actions",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(adapterJs, needle, `email-provider-adapter.js has no ${needle}`);
}

assertNotContains(appJs, "email-provider-adapter", "app.js is not wired to email-provider-adapter");
assertNotContains(appJs, "createEmailProviderAdapter", "app.js does not import createEmailProviderAdapter");

const disabledConfig = getEmailProviderConfig({});
const disabledProvider = createEmailProviderAdapter({ config: disabledConfig });

const disabledHealth = await disabledProvider.healthCheck();

assertEqual(disabledHealth.status, "disabled", "disabled provider healthCheck status");
assertEqual(disabledHealth.provider, "none", "disabled provider healthCheck provider");

await assertRejects(
  () => disabledProvider.sendReminder(sendInput),
  "Email provider is disabled",
  "disabled provider sendReminder throws"
);

const mockConfig = {
  provider: "mock",
  mode: "test",
  fromEmail: "reminders@example.org",
  replyToEmail: null,
  rateLimitPerRun: 50,
  enabled: true,
};

const mockProvider = createMockEmailProvider({ mode: "success" });
const mockAdapter = createEmailProviderAdapter({ config: mockConfig, mockProvider });

const mockHealth = await mockAdapter.healthCheck();

assertEqual(mockHealth.status, "ok", "mock adapter healthCheck status");
assertEqual(mockHealth.provider, "mock", "mock adapter healthCheck provider");

const mockSendResult = await mockAdapter.sendReminder(sendInput);

assertEqual(mockSendResult.status, "delivered", "mock adapter sendReminder delivers");

const defaultMockAdapter = createEmailProviderAdapter({ config: mockConfig });

const defaultMockHealth = await defaultMockAdapter.healthCheck();

assertEqual(defaultMockHealth.provider, "mock", "default mock adapter uses createMockEmailProvider");

const defaultMockSendResult = await defaultMockAdapter.sendReminder(sendInput);

assertEqual(defaultMockSendResult.status, "delivered", "default mock adapter sendReminder delivers");

for (const providerName of UNIMPLEMENTED_EMAIL_PROVIDERS) {
  const placeholderConfig = {
    provider: providerName,
    mode: "production",
    fromEmail: "reminders@example.org",
    replyToEmail: null,
    rateLimitPerRun: 50,
    enabled: true,
  };

  const placeholderProvider = createEmailProviderAdapter({ config: placeholderConfig });
  const placeholderHealth = await placeholderProvider.healthCheck();

  assertEqual(placeholderHealth.status, "not_implemented", `${providerName} placeholder healthCheck status`);
  assertEqual(placeholderHealth.provider, providerName, `${providerName} placeholder healthCheck provider`);

  await assertRejects(
    () => placeholderProvider.sendReminder(sendInput),
    `Provider ${providerName} is not implemented yet`,
    `${providerName} placeholder sendReminder throws`
  );
}

const resendPlaceholderConfig = {
  provider: "resend",
  mode: "production",
  fromEmail: "reminders@example.org",
  replyToEmail: null,
  rateLimitPerRun: 50,
  enabled: true,
};

const resendPlaceholderProvider = createEmailProviderAdapter({ config: resendPlaceholderConfig });
const resendPlaceholderHealth = await resendPlaceholderProvider.healthCheck();

assertEqual(resendPlaceholderHealth.status, "invalid_config", "resend adapter placeholder healthCheck status");
assertEqual(resendPlaceholderHealth.provider, "resend", "resend adapter placeholder healthCheck provider");

await assertRejects(
  () => resendPlaceholderProvider.sendReminder(sendInput),
  "Resend email provider configuration is invalid",
  "resend adapter placeholder sendReminder throws config error"
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-email-provider-adapter: all checks OK");
