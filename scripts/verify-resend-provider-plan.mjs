/**
 * V6 Phase 17 + 19: Resend implementation plan verification.
 * Static checks for Resend plan documentation and isolated provider module —
 * no Supabase, browser, live API calls, production sending, or app wiring.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createResendEmailProvider } from "../js/app/automation/providers/resend-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const providerConfigDocPath = join(root, "docs", "v6-email-provider-configuration.md");
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const resendProviderPath = join(root, "js/app/automation/providers/resend-provider.js");
const verifyResendProviderPath = join(root, "scripts", "verify-resend-provider.mjs");
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

console.log("V6 Phase 17 Resend implementation plan verification (verify-resend-provider-plan)\n");

assert(existsSync(providerConfigDocPath), "docs/v6-email-provider-configuration.md exists");
assert(existsSync(deliveryArchDocPath), "docs/v6-delivery-architecture.md exists");
assert(existsSync(resendProviderPath), "js/app/automation/providers/resend-provider.js exists");
assert(existsSync(verifyResendProviderPath), "scripts/verify-resend-provider.mjs exists");

const providerConfigDoc = readFileSync(providerConfigDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const resendProviderSource = readFileSync(resendProviderPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(packageJson, '"verify-resend-provider-plan"', "package.json verify-resend-provider-plan script");
assertContains(packageJson, '"verify-resend-provider"', "package.json verify-resend-provider script");

assertContains(
  providerConfigDoc,
  "## Phase 17 — Resend implementation plan",
  "provider config doc has Resend implementation plan section"
);
assertContains(
  providerConfigDoc,
  "## Phase 19 — Resend network implementation",
  "provider config doc has Phase 19 section"
);

assertContains(providerConfigDoc, "RESEND_API_KEY", "plan documents RESEND_API_KEY");
assertContains(providerConfigDoc, "EMAIL_FROM_ADDRESS", "plan documents EMAIL_FROM_ADDRESS");
assertContains(providerConfigDoc, "EMAIL_REPLY_TO_ADDRESS", "plan documents EMAIL_REPLY_TO_ADDRESS");
assertContains(providerConfigDoc, "EMAIL_TEST_REDIRECT_TO", "plan documents EMAIL_TEST_REDIRECT_TO");
assertContains(providerConfigDoc, "### From and Reply-To validation", "plan documents from/reply-to validation");
assertContains(providerConfigDoc, "### Test mode behaviour", "plan documents test mode behaviour");
assertContains(providerConfigDoc, "### Production mode gates", "plan documents production mode gates");
assertContains(providerConfigDoc, "### Failure mapping", "plan documents failure mapping");
assertContains(providerConfigDoc, "### Rollback plan", "plan documents rollback plan");
assertContains(providerConfigDoc, "EMAIL_MODE=production", "plan documents production mode gate");
assertContains(providerConfigDoc, "EMAIL_MODE=test", "plan documents test mode gate");
assertContains(providerConfigDoc, "resend_rate_limited", "plan documents transient failure mapping");
assertContains(providerConfigDoc, "verify-resend-provider", "provider config doc references verify-resend-provider");

assertContains(
  deliveryArchDoc,
  "## Phase 17 — Resend implementation plan",
  "delivery architecture doc has Phase 17 section"
);
assertContains(
  deliveryArchDoc,
  "## Phase 19 — Resend network implementation",
  "delivery architecture doc has Phase 19 section"
);
assertContains(deliveryArchDoc, "verify-resend-provider-plan", "delivery architecture references verify-resend-provider-plan");
assertContains(deliveryArchDoc, "verify-resend-provider", "delivery architecture references verify-resend-provider");

assertContains(resendProviderSource, "fetchImpl", "resend-provider.js uses injected fetchImpl");
assertNotContains(resendProviderSource, "fetch(", "resend-provider.js has no global fetch(");
assertContains(resendProviderSource, "api.resend.com", "resend-provider.js references Resend API URL");

const forbiddenWiringNeedles = [
  "markReminderSent",
  "mark_reminder_sent",
  "XMLHttpRequest",
  "nodemailer",
  "createTransport",
];

for (const needle of forbiddenWiringNeedles) {
  assertNotContains(resendProviderSource, needle, `resend-provider.js has no ${needle}`);
}

const invalidProvider = createResendEmailProvider({
  config: { provider: "resend", enabled: true, mode: "production" },
});

const invalidHealth = await invalidProvider.healthCheck();

assertEqual(invalidHealth.status, "invalid_config", "resend provider invalid config healthCheck");

assertNotContains(appJs, "resend-provider", "app.js is not wired to resend-provider");
assertNotContains(appJs, "createResendEmailProvider", "app.js does not import createResendEmailProvider");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-resend-provider-plan: all checks OK");
