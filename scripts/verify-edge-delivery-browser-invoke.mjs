/**
 * V6 Phase 39: Manual Delivery browser Edge Function invoke verification.
 * Static checks for send-reminder-deliveries wiring, no browser Resend path,
 * and no delivery log / mark-sent / compliance / history mutation in manual execution.
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
const v5DocPath = join(root, "docs", "v5-automated-compliance-operations.md");
const roadmapPath = join(root, "ROADMAP.md");
const manualDeliveryExecutionPath = join(
  root,
  "js/app/automation/manual-delivery-execution.js",
);
const edgeDeliveryInvokePath = join(
  root,
  "js/app/automation/edge-delivery-invoke.js",
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
  "V6 Phase 39/41 browser Edge Function invoke verification (verify-edge-delivery-browser-invoke)\n",
);

assert(existsSync(manualDeliveryExecutionPath), "manual-delivery-execution.js exists");
assert(existsSync(edgeDeliveryInvokePath), "edge-delivery-invoke.js exists");
assert(existsSync(functionPath), "supabase/functions/send-reminder-deliveries/index.ts exists");

const manualDeliveryExecutionJs = readFileSync(manualDeliveryExecutionPath, "utf8");
const edgeDeliveryInvokeJs = readFileSync(edgeDeliveryInvokePath, "utf8");
const resendProviderJs = readFileSync(resendProviderPath, "utf8");
const emailProviderEnvJs = readFileSync(emailProviderEnvPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const edgeDeliveryDoc = readFileSync(edgeDeliveryDocPath, "utf8");
const v5Doc = readFileSync(v5DocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");

assertContains(
  packageJson,
  '"verify-edge-delivery-browser-invoke"',
  "package.json verify-edge-delivery-browser-invoke script",
);

console.log("--- manual delivery browser invoke (required) ---");

assertContains(
  manualDeliveryExecutionJs,
  "invokeSendReminderDeliveries",
  "manual-delivery-execution.js invokes send-reminder-deliveries client",
);
assertContains(
  edgeDeliveryInvokeJs,
  "functions.invoke",
  "edge-delivery-invoke.js uses supabase.functions.invoke",
);
assertContains(
  edgeDeliveryInvokeJs,
  "send-reminder-deliveries",
  "edge-delivery-invoke.js references send-reminder-deliveries",
);
assertContains(
  edgeDeliveryInvokeJs,
  "organisationId",
  "edge-delivery-invoke.js passes organisationId",
);
assertContains(
  edgeDeliveryInvokeJs,
  "automationRunId",
  "edge-delivery-invoke.js passes automationRunId",
);
assertContains(
  edgeDeliveryInvokeJs,
  "deliveryRecords",
  "edge-delivery-invoke.js passes deliveryRecords",
);

console.log("--- Phase 41 Authorization header (required) ---");

assertContains(
  edgeDeliveryInvokeJs,
  "getSession",
  "edge-delivery-invoke.js reads Supabase session before invoke",
);
assertContains(
  edgeDeliveryInvokeJs,
  "access_token",
  "edge-delivery-invoke.js requires session access_token",
);
assertContains(
  edgeDeliveryInvokeJs,
  "Authorization",
  "edge-delivery-invoke.js sets Authorization header on invoke",
);
assertContains(
  edgeDeliveryInvokeJs,
  "Bearer",
  "edge-delivery-invoke.js sends Bearer JWT on invoke",
);
assertNotContains(
  edgeDeliveryInvokeJs,
  "SERVICE_ROLE",
  "edge-delivery-invoke.js must not reference service role key",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "SERVICE_ROLE",
  "manual-delivery-execution.js must not reference service role key",
);
assertNotContains(
  edgeDeliveryInvokeJs,
  "service_role",
  "edge-delivery-invoke.js must not reference service_role",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "service_role",
  "manual-delivery-execution.js must not reference service_role",
);

assertContains(
  manualDeliveryExecutionJs,
  "getSupabaseClient",
  "manual-delivery-execution.js uses authenticated Supabase client",
);
assertContains(
  manualDeliveryExecutionJs,
  "mapDeliveryRecordsForEdgeInvoke",
  "manual-delivery-execution.js maps delivery records for Edge Function",
);

console.log("--- no browser email provider gate (Phase 39+) ---");

assertNotContains(
  manualDeliveryExecutionJs,
  "Email provider is not enabled",
  "manual-delivery-execution.js must not gate on browser email provider enabled",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "getEmailProviderConfig",
  "manual-delivery-execution.js must not read browser email provider config",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "EMAIL_PROVIDER_RUNTIME",
  "manual-delivery-execution.js must not read EMAIL_PROVIDER_RUNTIME",
);

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  if (start === -1) {
    return "";
  }

  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) {
    return "";
  }

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return "";
}

const manualDeliveryRunBody = extractFunctionBody(appJs, "handleManualDeliveryTestRun");
const manualDeliveryRenderBody = extractFunctionBody(appJs, "renderManualDeliveryTest");

assertNotContains(
  manualDeliveryRunBody,
  "Email provider is not enabled",
  "handleManualDeliveryTestRun must not block on browser email provider enabled",
);
assertNotContains(
  manualDeliveryRunBody,
  "providerConfig.enabled",
  "handleManualDeliveryTestRun must not gate on providerConfig.enabled",
);
assertNotContains(
  manualDeliveryRenderBody,
  "providerConfig.enabled",
  "renderManualDeliveryTest must not disable run button on providerConfig.enabled",
);
assertNotContains(
  appJs,
  "getManualDeliveryProviderConfig",
  "app.js must not use getManualDeliveryProviderConfig for manual delivery",
);

console.log("--- no legacy browser Resend path (required) ---");

assertNotContains(
  manualDeliveryExecutionJs,
  "createResendEmailProvider",
  "manual-delivery-execution.js must not import/use createResendEmailProvider",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "resend-provider.js",
  "manual-delivery-execution.js must not import resend-provider.js",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "RESEND_API_KEY",
  "manual-delivery-execution.js must not read RESEND_API_KEY",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "api.resend.com",
  "manual-delivery-execution.js must not fetch api.resend.com",
);
assertNotContains(
  edgeDeliveryInvokeJs,
  "api.resend.com",
  "edge-delivery-invoke.js must not fetch api.resend.com",
);
assertNotContains(
  appJs,
  "api.resend.com",
  "app.js must not fetch api.resend.com for manual delivery",
);
assertNotContains(
  appJs,
  "createResendEmailProvider",
  "app.js must not use createResendEmailProvider",
);

console.log("--- legacy scaffold retained but inert ---");

assertContains(
  resendProviderJs,
  "https://api.resend.com/emails",
  "resend-provider.js legacy scaffold retained",
);
assertContains(
  resendProviderJs,
  "deprecated",
  "resend-provider.js marked deprecated/inert",
);

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

console.log("--- Phase 39 safety gates (required) ---");

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
  manualDeliveryExecutionJs,
  "persistenceSummary",
  "manual-delivery-execution.js returns persistenceSummary for UI compatibility",
);
assertContains(
  manualDeliveryExecutionJs,
  "executionSummary",
  "manual-delivery-execution.js returns executionSummary from Edge Function",
);

console.log("--- documentation ---");

assertContains(
  deliveryArchDoc,
  "## Phase 39 — Browser invoke wiring",
  "delivery architecture doc has Phase 39 section",
);
assertContains(
  edgeDeliveryDoc,
  "## Phase 39 — Browser invoke wiring",
  "edge delivery doc has Phase 39 section",
);
assertContains(
  v5Doc,
  "Phase 39",
  "v5 automated compliance operations doc references Phase 39",
);
assertContains(
  roadmap,
  "V6 Phase 39",
  "ROADMAP.md references V6 Phase 39",
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

console.log("\nverify-edge-delivery-browser-invoke: all checks OK");
console.log("  browser: manual delivery invokes send-reminder-deliveries with Authorization Bearer JWT");
console.log("  browser: session access_token required; no service role key in execution path");
console.log("  browser: no createResendEmailProvider, RESEND_API_KEY, or api.resend.com in execution path");
console.log("  server: resend-provider.js retained as deprecated scaffold only");
