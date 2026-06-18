/**
 * V6 Phase 6: Mock email provider verification.
 * Deterministic checks for the mock provider adapter — no Supabase, browser,
 * real email provider, delivery execution, or database writes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createMockEmailProvider } from "../js/app/automation/mock-email-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const mockProviderJs = readFileSync(
  join(root, "js/app/automation/mock-email-provider.js"),
  "utf8"
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");

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

const sendInput = {
  to: "jordan.coordinator@example.com",
  subject: "DBS reminder",
  bodyText: "Please renew your DBS.",
  metadata: {
    reminderWindow: "14-day",
    complianceType: "dbs",
  },
};

console.log(
  "V6 Phase 6 mock email provider verification (verify-mock-email-provider)\n"
);

assertContains(
  mockProviderJs,
  "export function createMockEmailProvider",
  "mock-email-provider module export"
);
assertContains(
  packageJson,
  '"verify-mock-email-provider"',
  "package.json verify script"
);

const forbiddenNeedles = [
  "fetch(",
  "smtp",
  "resend",
  "nodemailer",
  "sendEmail",
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "enqueue_reminder_notifications",
  "process_notification_queue",
  "history_entries",
  "add_default_actions",
  ".rpc(",
  "supabase",
  "XMLHttpRequest",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(mockProviderJs, needle, `mock-email-provider.js has no ${needle}`);
}

const successProvider = createMockEmailProvider({ mode: "success" });

assert(typeof successProvider.sendReminder === "function", "provider exposes sendReminder");
assert(typeof successProvider.healthCheck === "function", "provider exposes healthCheck");

const successResult = await successProvider.sendReminder(sendInput);

assertEqual(successResult.status, "delivered", "success mode status");
assert(
  typeof successResult.providerMessageId === "string" &&
    successResult.providerMessageId.startsWith("mock-"),
  "success mode providerMessageId"
);
assert(
  typeof successResult.deliveredAt === "string" &&
    !Number.isNaN(Date.parse(successResult.deliveredAt)),
  "success mode deliveredAt is ISO timestamp"
);

const transientProvider = createMockEmailProvider({ mode: "transient_failure" });
const transientResult = await transientProvider.sendReminder(sendInput);

assertEqual(transientResult.status, "failed", "transient failure mode status");
assertEqual(transientResult.failureType, "transient", "transient failure mode failureType");
assert(
  typeof transientResult.failureReason === "string" && transientResult.failureReason.length > 0,
  "transient failure mode failureReason"
);

const permanentProvider = createMockEmailProvider({ mode: "permanent_failure" });
const permanentResult = await permanentProvider.sendReminder(sendInput);

assertEqual(permanentResult.status, "failed", "permanent failure mode status");
assertEqual(permanentResult.failureType, "permanent", "permanent failure mode failureType");
assert(
  typeof permanentResult.failureReason === "string" && permanentResult.failureReason.length > 0,
  "permanent failure mode failureReason"
);

const healthResult = await successProvider.healthCheck();

assertEqual(healthResult.status, "ok", "healthCheck status");
assertEqual(healthResult.provider, "mock", "healthCheck provider");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-mock-email-provider: all checks OK");
