/**
 * V6 Phase 40: Edge Function test-mode deployment readiness verification.
 * Validates deployment checklist doc, static safety gates for test-mode sends,
 * and runs prerequisite Edge Function verify scripts — no feature code changes required.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const docPath = join(root, "docs", "v6-edge-delivery-test-deployment.md");
const edgeDeliveryDocPath = join(root, "docs", "v6-edge-delivery-function.md");
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const roadmapPath = join(root, "ROADMAP.md");
const v5DocPath = join(root, "docs", "v5-automated-compliance-operations.md");
const functionPath = join(
  root,
  "supabase",
  "functions",
  "send-reminder-deliveries",
  "index.ts",
);
const manualDeliveryExecutionPath = join(
  root,
  "js/app/automation/manual-delivery-execution.js",
);
const edgeDeliveryInvokePath = join(
  root,
  "js/app/automation/edge-delivery-invoke.js",
);
const emailProviderEnvPath = join(root, "js/data/email-provider-env.js");
const packageJsonPath = join(root, "package.json");

/** @type {readonly string[]} */
const REQUIRED_SECRET_NAMES = [
  "RESEND_API_KEY",
  "EMAIL_MODE=test",
  "EMAIL_FROM_ADDRESS",
  "EMAIL_REPLY_TO_ADDRESS",
  "EMAIL_TEST_REDIRECT_TO",
  "EMAIL_RATE_LIMIT_PER_RUN",
];

/** @type {readonly string[]} */
const PREREQUISITE_SCRIPTS = [
  "verify-edge-delivery-function-skeleton",
  "verify-edge-delivery-resend",
  "verify-edge-delivery-browser-invoke",
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

function assertNotMatches(source, pattern, label) {
  if (pattern.test(source)) {
    fail(label);
  }
}

console.log(
  "V6 Phase 40 Edge Function test-mode deployment readiness (verify-edge-delivery-test-deployment)\n",
);

console.log("--- documentation checks ---");

assert(existsSync(docPath), "docs/v6-edge-delivery-test-deployment.md exists");

const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const packageJson = readFileSync(packageJsonPath, "utf8");
const edgeDeliveryDoc = readFileSync(edgeDeliveryDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const v5Doc = readFileSync(v5DocPath, "utf8");

assertContains(
  packageJson,
  '"verify-edge-delivery-test-deployment"',
  "package.json verify-edge-delivery-test-deployment script",
);
assertContains(doc, "# V6 Edge Function Test-Mode Deployment", "document title");
assertContains(doc, "No production sending", "document states no production sending");
assertContains(doc, "No mark-as-sent", "document states no mark-as-sent");
assertContains(doc, "No delivery log writes", "document states no delivery log writes");
assertContains(doc, "npm run verify-edge-delivery-test-deployment", "document references verify command");
assertContains(doc, "## Required Supabase Edge Function secrets", "secret checklist section");
assertContains(doc, "## Deployment checklist", "deployment checklist section");
assertContains(doc, "## Local smoke test plan", "local smoke test section");
assertContains(doc, "## Staging smoke test plan", "staging smoke test section");
assertContains(doc, "## What to check in Supabase", "Supabase dashboard checks section");
assertContains(doc, "## Acceptance commands", "acceptance commands section");
assertContains(doc, "supabase secrets set", "document includes secrets set command");
assertContains(doc, "supabase functions deploy send-reminder-deliveries", "document includes deploy command");
assertContains(doc, "EMAIL_TEST_REDIRECT_TO", "document covers test redirect");
assertContains(doc, "[TEST]", "document covers [TEST] subject prefix");
assertContains(doc, "provider_not_configured", "document covers missing RESEND_API_KEY failure");
assertContains(doc, "invalid_email_mode", "document covers invalid EMAIL_MODE failure");
assertContains(doc, "invalid_config", "document covers invalid_config failure");
assertContains(doc, "functions/v1/send-reminder-deliveries", "document references Edge Function invoke path");
assertContains(doc, "reminder_delivery_logs", "document checks delivery log table unchanged");

for (const secretName of REQUIRED_SECRET_NAMES) {
  assertContains(doc, secretName, `document lists secret ${secretName}`);
}

assertContains(
  edgeDeliveryDoc,
  "## Phase 40 — Edge Function test-mode deployment readiness",
  "edge delivery doc has Phase 40 section",
);
assertContains(
  deliveryArchDoc,
  "## Phase 40 — Edge Function test-mode deployment readiness",
  "delivery architecture doc has Phase 40 section",
);
assertContains(roadmap, "V6 Phase 40", "ROADMAP.md references V6 Phase 40");
assertContains(v5Doc, "Phase 40", "v5 automated compliance operations doc references Phase 40");

console.log("--- static safety gates (Edge Function) ---");

assert(existsSync(functionPath), "supabase/functions/send-reminder-deliveries/index.ts exists");

const functionSource = readFileSync(functionPath, "utf8");

assertContains(functionSource, "resolveOutboundEmail", "index.ts has resolveOutboundEmail");
assertContains(functionSource, "testRedirectTo", "index.ts redirects to EMAIL_TEST_REDIRECT_TO in test mode");
assertContains(functionSource, "[TEST]", "index.ts prefixes test-mode subject with [TEST]");
assertContains(functionSource, "provider_not_configured", "index.ts fails without RESEND_API_KEY");
assertContains(functionSource, "invalid_email_mode", "index.ts fails on invalid EMAIL_MODE");
assertContains(functionSource, "invalid_config", "index.ts fails on missing from/redirect config");

const forbiddenFunctionNeedles = [
  "create_reminder_delivery_log",
  "mark_reminder_sent",
  "markReminderSent",
  "mark-as-sent",
];

for (const needle of forbiddenFunctionNeedles) {
  assertNotContains(functionSource, needle, `index.ts has no ${needle}`);
}

console.log("--- static safety gates (browser invoke only) ---");

const manualDeliveryExecutionJs = readFileSync(manualDeliveryExecutionPath, "utf8");
const edgeDeliveryInvokeJs = readFileSync(edgeDeliveryInvokePath, "utf8");
const emailProviderEnvJs = readFileSync(emailProviderEnvPath, "utf8");

assertContains(
  edgeDeliveryInvokeJs,
  "functions/v1/",
  "edge-delivery-invoke.js calls /functions/v1/send-reminder-deliveries directly",
);
assertContains(
  edgeDeliveryInvokeJs,
  "buildEdgeDeliveryInvokeHeaders",
  "edge-delivery-invoke.js builds explicit invoke headers",
);
assertNotContains(
  edgeDeliveryInvokeJs,
  "functions.invoke",
  "edge-delivery-invoke.js must not use supabase.functions.invoke",
);
assertContains(
  edgeDeliveryInvokeJs,
  "send-reminder-deliveries",
  "edge-delivery-invoke.js references send-reminder-deliveries",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "api.resend.com",
  "manual-delivery-execution.js must not fetch api.resend.com",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "RESEND_API_KEY",
  "manual-delivery-execution.js must not read RESEND_API_KEY",
);
assertNotContains(
  edgeDeliveryInvokeJs,
  "api.resend.com",
  "edge-delivery-invoke.js must not fetch api.resend.com",
);

const forbiddenManualNeedles = [
  "createReminderDeliveryLog",
  "create_reminder_delivery_log",
  "markReminderSent",
  "mark_reminder_sent",
  "runManualDeliveryPipeline",
  "runDeliveryPipeline",
  "persistDeliveryLogPayloads",
];

for (const needle of forbiddenManualNeedles) {
  assertNotContains(
    manualDeliveryExecutionJs,
    needle,
    `manual-delivery-execution.js has no ${needle}`,
  );
}

assertContains(
  emailProviderEnvJs,
  "RESEND_API_KEY: undefined",
  "committed email-provider-env.js keeps RESEND_API_KEY undefined",
);
assertNotMatches(
  emailProviderEnvJs,
  /re_[A-Za-z0-9]{12,}/,
  "FORBIDDEN: email-provider-env.js must not contain a real-looking Resend API key",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("documentation and static checks: OK\n");

for (const script of PREREQUISITE_SCRIPTS) {
  console.log(`--- ${script} ---`);

  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-edge-delivery-test-deployment failed at: ${script}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("verify-edge-delivery-test-deployment: all checks OK");
console.log("  test mode: redirect to EMAIL_TEST_REDIRECT_TO + [TEST] subject prefix");
console.log("  secrets: missing RESEND_API_KEY / EMAIL_MODE / config → 503 documented and coded");
console.log("  browser: Edge Function invoke only — no delivery log / mark-sent / compliance writes");
console.log("  next: run verify-edge-delivery-test-smoke-plan, deploy secrets + function, then Phase 41 manual checklist");
