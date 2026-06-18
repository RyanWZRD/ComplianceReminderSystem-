/**
 * V6 Phase 19: Resend provider network implementation verification.
 * In-memory checks with mocked fetchImpl — no Supabase, browser, live API calls,
 * production sending, app wiring, or mark-as-sent automation.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createResendEmailProvider } from "../js/app/automation/providers/resend-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const resendProviderPath = join(root, "js/app/automation/providers/resend-provider.js");
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

/**
 * @param {number} status
 * @param {unknown} [body]
 * @returns {Response}
 */
function mockResponse(status, body = {}) {
  return {
    status,
    async json() {
      return body;
    },
  };
}

/** @type {typeof fetch} */
function unreachableFetch() {
  throw new Error("global fetch must not be used");
}

const validProductionConfig = {
  enabled: true,
  provider: "resend",
  mode: "production",
  apiKey: "re_test_key",
  fromEmail: "reminders@example.org",
};

const validTestConfig = {
  ...validProductionConfig,
  mode: "test",
  testRedirectTo: "staging-inbox@example.org",
};

const sendInput = {
  to: "safeguarding@example.org",
  subject: "DBS reminder",
  bodyText: "Please renew your DBS.",
};

console.log("V6 Phase 19 Resend provider verification (verify-resend-provider)\n");

assert(existsSync(resendProviderPath), "js/app/automation/providers/resend-provider.js exists");

const resendProviderSource = readFileSync(resendProviderPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(packageJson, '"verify-resend-provider"', "package.json verify script");
assertContains(resendProviderSource, "export function createResendEmailProvider", "resend provider export");
assertContains(resendProviderSource, "fetchImpl", "resend provider uses fetchImpl");
assertNotContains(resendProviderSource, "fetch(", "resend provider has no global fetch(");

const forbiddenMutationNeedles = [
  "markReminderSent",
  "mark_reminder_sent",
  "history_entries",
  "add_default_actions",
  "notification_queue",
  "enqueue_reminder_notifications",
];

for (const needle of forbiddenMutationNeedles) {
  assertNotContains(resendProviderSource, needle, `resend-provider.js has no ${needle}`);
}

assertNotContains(appJs, "resend-provider", "app.js is not wired to resend-provider");
assertNotContains(appJs, "createResendEmailProvider", "app.js does not import createResendEmailProvider");

const validProvider = createResendEmailProvider({
  config: validProductionConfig,
  fetchImpl: unreachableFetch,
});

const validHealth = await validProvider.healthCheck();

assertEqual(validHealth.status, "ok", "valid config healthCheck status");
assertEqual(validHealth.provider, "resend", "valid config healthCheck provider");
assertEqual(validHealth.mode, "production", "valid config healthCheck mode");

const disabledProvider = createResendEmailProvider({
  config: { provider: "resend", enabled: false },
  fetchImpl: unreachableFetch,
});

const disabledHealth = await disabledProvider.healthCheck();

assertEqual(disabledHealth.status, "disabled", "disabled config healthCheck status");

await assertRejects(
  () =>
    disabledProvider.sendReminder(sendInput),
  "Resend email provider is disabled",
  "disabled config blocks send"
);

const invalidProvider = createResendEmailProvider({
  config: { provider: "resend", enabled: true, mode: "production" },
  fetchImpl: unreachableFetch,
});

const invalidHealth = await invalidProvider.healthCheck();

assertEqual(invalidHealth.status, "invalid_config", "invalid config healthCheck status");

await assertRejects(
  () => invalidProvider.sendReminder(sendInput),
  "Resend email provider configuration is invalid",
  "invalid config blocks send"
);

/** @type {{ url: string; init: RequestInit } | null} */
let capturedRequest = null;

const testFetch = async (url, init) => {
  capturedRequest = { url, init };
  return mockResponse(200, { id: "email_test_123" });
};

const testProvider = createResendEmailProvider({
  config: validTestConfig,
  fetchImpl: testFetch,
});

const testResult = await testProvider.sendReminder(sendInput);

assertEqual(testResult.status, "delivered", "test mode 2xx delivered status");
assertEqual(testResult.providerMessageId, "email_test_123", "test mode providerMessageId");

assert(capturedRequest !== null, "test mode captured fetch request");

const testPayload = JSON.parse(String(capturedRequest.init.body));

assertEqual(testPayload.to[0], validTestConfig.testRedirectTo, "test mode redirects recipient");
assertEqual(testPayload.subject, "[TEST] DBS reminder", "test mode prefixes subject");

const productionFetch = async (url, init) => {
  capturedRequest = { url, init };
  return mockResponse(201, { id: "email_prod_456" });
};

const productionProvider = createResendEmailProvider({
  config: validProductionConfig,
  fetchImpl: productionFetch,
});

const productionResult = await productionProvider.sendReminder(sendInput);

assertEqual(productionResult.status, "delivered", "production mode 2xx delivered status");
assertEqual(productionResult.providerMessageId, "email_prod_456", "production mode providerMessageId");

const productionPayload = JSON.parse(String(capturedRequest.init.body));

assertEqual(productionPayload.to[0], sendInput.to, "production mode uses real recipient");
assertEqual(productionPayload.subject, sendInput.subject, "production mode does not prefix subject");

const transientStatuses = [429, 500, 502, 503, 504];

for (const status of transientStatuses) {
  const transientProvider = createResendEmailProvider({
    config: validProductionConfig,
    fetchImpl: async () => mockResponse(status),
  });

  const result = await transientProvider.sendReminder(sendInput);

  assertEqual(result.status, "failed", `HTTP ${status} status failed`);
  assertEqual(result.failureType, "transient", `HTTP ${status} failureType transient`);
}

const permanentStatuses = [400, 401, 403, 404, 422];

for (const status of permanentStatuses) {
  const permanentProvider = createResendEmailProvider({
    config: validProductionConfig,
    fetchImpl: async () => mockResponse(status),
  });

  const result = await permanentProvider.sendReminder(sendInput);

  assertEqual(result.status, "failed", `HTTP ${status} status failed`);
  assertEqual(result.failureType, "permanent", `HTTP ${status} failureType permanent`);
}

const unknownStatusProvider = createResendEmailProvider({
  config: validProductionConfig,
  fetchImpl: async () => mockResponse(418),
});

const unknownResult = await unknownStatusProvider.sendReminder(sendInput);

assertEqual(unknownResult.failureType, "transient", "unknown HTTP status maps to transient");

const networkErrorProvider = createResendEmailProvider({
  config: validProductionConfig,
  fetchImpl: async () => {
    throw new Error("network down");
  },
});

const networkResult = await networkErrorProvider.sendReminder(sendInput);

assertEqual(networkResult.status, "failed", "network error returns failed");
assertEqual(networkResult.failureType, "transient", "network error is transient");
assertEqual(networkResult.failureReason, "resend_network_error", "network error reason");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-resend-provider: all checks OK");
