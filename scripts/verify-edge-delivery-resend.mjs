/**
 * V6 Phase 38 + 39: Edge Function Resend integration verification.
 * Static checks for server-side Resend sends and post-Phase-39 browser invoke safety —
 * no delivery log writes, no mark-as-sent automation.
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
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const edgeDeliveryDocPath = join(root, "docs", "v6-edge-delivery-function.md");
const manualDeliveryExecutionPath = join(
  root,
  "js/app/automation/manual-delivery-execution.js",
);
const resendProviderPath = join(
  root,
  "js/app/automation/providers/resend-provider.js",
);
const emailProviderEnvPath = join(root, "js/data/email-provider-env.js");
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

function assertNotMatches(source, pattern, label) {
  if (pattern.test(source)) {
    fail(label);
  }
}

/**
 * @param {string} source
 * @returns {string | null}
 */
function readResendApiKeyLiteral(source) {
  const patterns = [
    /RESEND_API_KEY\s*:\s*"([^"]+)"/,
    /RESEND_API_KEY\s*:\s*'([^']+)'/,
    /RESEND_API_KEY\s*=\s*"([^"]+)"/,
    /RESEND_API_KEY\s*=\s*'([^']+)'/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);

    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  return null;
}

console.log(
  "V6 Phase 38 Edge Function Resend integration verification (verify-edge-delivery-resend)\n",
);

assert(existsSync(functionPath), "supabase/functions/send-reminder-deliveries/index.ts exists");

const functionSource = readFileSync(functionPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const edgeDeliveryDoc = readFileSync(edgeDeliveryDocPath, "utf8");
const manualDeliveryExecutionJs = readFileSync(manualDeliveryExecutionPath, "utf8");
const resendProviderJs = readFileSync(resendProviderPath, "utf8");
const emailProviderEnvJs = readFileSync(emailProviderEnvPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-edge-delivery-resend"',
  "package.json verify-edge-delivery-resend script",
);

console.log("--- server-side Edge Function (required) ---");

assertContains(
  functionSource,
  'Deno.env.get("RESEND_API_KEY")',
  "index.ts reads RESEND_API_KEY server-side",
);
assertContains(functionSource, 'Deno.env.get("EMAIL_MODE")', "index.ts reads EMAIL_MODE");
assertContains(
  functionSource,
  'Deno.env.get("EMAIL_FROM_ADDRESS")',
  "index.ts reads EMAIL_FROM_ADDRESS",
);
assertContains(
  functionSource,
  'Deno.env.get("EMAIL_REPLY_TO_ADDRESS")',
  "index.ts reads EMAIL_REPLY_TO_ADDRESS",
);
assertContains(
  functionSource,
  'Deno.env.get("EMAIL_TEST_REDIRECT_TO")',
  "index.ts reads EMAIL_TEST_REDIRECT_TO",
);
assertContains(
  functionSource,
  'Deno.env.get("EMAIL_RATE_LIMIT_PER_RUN")',
  "index.ts reads EMAIL_RATE_LIMIT_PER_RUN",
);

assertContains(functionSource, "provider_not_configured", "index.ts fails closed without RESEND_API_KEY");
assertContains(functionSource, "invalid_email_mode", "index.ts fails closed on invalid EMAIL_MODE");
assertContains(functionSource, '"production"', "index.ts supports production EMAIL_MODE gate");
assertContains(functionSource, '"test"', "index.ts supports test EMAIL_MODE");

assertContains(functionSource, "https://api.resend.com/emails", "index.ts calls Resend API");
assertContains(functionSource, "sendViaResend", "index.ts has sendViaResend helper");
assertContains(functionSource, "resolveOutboundEmail", "index.ts has resolveOutboundEmail helper");

assertContains(functionSource, "[TEST]", "index.ts prefixes test-mode subject with [TEST]");
assertContains(functionSource, "testRedirectTo", "index.ts applies test redirect recipient");
assertContains(functionSource, "rateLimitPerRun", "index.ts applies rate limit per run");
assertContains(functionSource, "rate_limit_exceeded", "index.ts skips records when rate limit exceeded");

assertContains(functionSource, "TRANSIENT_HTTP_STATUS_CODES", "index.ts maps transient HTTP failures");
assertContains(functionSource, "PERMANENT_HTTP_STATUS_CODES", "index.ts maps permanent HTTP failures");
assertContains(functionSource, "mapResendHttpFailure", "index.ts maps Resend HTTP failures");

assertContains(functionSource, "summary", "index.ts returns summary");
assertContains(functionSource, "attempted", "index.ts summary includes attempted");
assertContains(functionSource, "delivered", "index.ts summary includes delivered");
assertContains(functionSource, "failed", "index.ts summary includes failed");
assertContains(functionSource, "skipped", "index.ts summary includes skipped");
assertContains(functionSource, "results", "index.ts returns per-record results");

console.log("--- server-side mark-as-sent (Phase 43+) ---");
console.log("  mark-as-sent checks: npm run verify-edge-delivery-mark-sent");

console.log("--- browser transition safety (Phase 39) ---");

const envResendKey = readResendApiKeyLiteral(emailProviderEnvJs);

assert(
  envResendKey === null || envResendKey === "undefined",
  "FORBIDDEN: email-provider-env.js must not contain a committed RESEND_API_KEY value",
);

assertNotMatches(
  emailProviderEnvJs,
  /re_[A-Za-z0-9]{12,}/,
  "FORBIDDEN: email-provider-env.js must not contain a real-looking Resend API key",
);

assertNotMatches(
  appJs,
  /RESEND_API_KEY\s*[:=]\s*["']re_/,
  "FORBIDDEN: app.js must not hardcode RESEND_API_KEY",
);

assert(
  emailProviderEnvJs.includes("RESEND_API_KEY: undefined"),
  "ALLOWED: committed email-provider-env.js keeps RESEND_API_KEY undefined",
);

assertNotContains(
  manualDeliveryExecutionJs,
  "createResendEmailProvider",
  "manual-delivery-execution.js must not use createResendEmailProvider after Phase 39",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "RESEND_API_KEY",
  "manual-delivery-execution.js must not read RESEND_API_KEY after Phase 39",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "api.resend.com",
  "manual-delivery-execution.js must not fetch api.resend.com after Phase 39",
);
assertContains(
  manualDeliveryExecutionJs,
  "invokeSendReminderDeliveries",
  "manual-delivery-execution.js invokes send-reminder-deliveries client after Phase 39",
);
assertContains(resendProviderJs, "fetchImpl", "ALLOWED: resend-provider.js legacy scaffold retained");
assertContains(
  resendProviderJs,
  "https://api.resend.com/emails",
  "legacy browser module references Resend API URL (inert scaffold)",
);
assertNotContains(
  appJs,
  "send-reminder-deliveries",
  "app.js delegates delivery invoke to manual-delivery-execution.js",
);
assertNotContains(
  appJs,
  "functions.invoke",
  "app.js does not invoke Edge Functions directly",
);

console.log("--- documentation ---");

assertContains(
  deliveryArchDoc,
  "## Phase 38 — Edge Function Resend integration",
  "delivery architecture doc has Phase 38 section",
);
assertContains(
  edgeDeliveryDoc,
  "## Phase 38 — Edge Function Resend integration",
  "edge delivery doc has Phase 38 section",
);
assertContains(
  edgeDeliveryDoc,
  "## Phase 39 — Browser invoke wiring",
  "edge delivery doc has Phase 39 section",
);
assertContains(
  deliveryArchDoc,
  "browser must not be the production sending path",
  "delivery architecture documents post-Phase-39 browser rule",
);
assertContains(
  edgeDeliveryDoc,
  "verify-edge-delivery-resend",
  "edge delivery doc references verify-edge-delivery-resend",
);
assertContains(
  edgeDeliveryDoc,
  "verify-edge-delivery-browser-invoke",
  "edge delivery doc references verify-edge-delivery-browser-invoke",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-edge-delivery-resend: all checks OK");
console.log("  server-side: Edge Function uses Deno.env RESEND_API_KEY + Resend API");
console.log("  browser: Phase 39 Edge invoke wired; no browser Resend in manual execution path");
