/**
 * V6 Phase 36: Server-side delivery architecture plan verification.
 * Static checks for Edge Function delivery plan documentation and safety gates —
 * no Supabase deploy, browser invoke wiring, live Resend calls, or app changes.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const edgeDeliveryDocPath = join(root, "docs", "v6-edge-delivery-function.md");
const emailProviderEnvPath = join(root, "js/data/email-provider-env.js");
const manualDeliveryExecutionPath = join(root, "js/app/automation/manual-delivery-execution.js");
const supabaseFunctionsDir = join(root, "supabase", "functions");
const packageJsonPath = join(root, "package.json");
const roadmapPath = join(root, "ROADMAP.md");

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
  "V6 Phase 36 server-side delivery architecture plan verification (verify-edge-delivery-plan)\n"
);

assert(existsSync(deliveryArchDocPath), "docs/v6-delivery-architecture.md exists");
assert(existsSync(edgeDeliveryDocPath), "docs/v6-edge-delivery-function.md exists");

const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const edgeDeliveryDoc = readFileSync(edgeDeliveryDocPath, "utf8");
const emailProviderEnvJs = readFileSync(emailProviderEnvPath, "utf8");
const manualDeliveryExecutionJs = readFileSync(manualDeliveryExecutionPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");

assertContains(packageJson, '"verify-edge-delivery-plan"', "package.json verify-edge-delivery-plan script");

assertContains(
  deliveryArchDoc,
  "## Phase 36 — Server-side delivery architecture plan",
  "delivery architecture doc has Phase 36 section"
);
assertContains(edgeDeliveryDoc, "send-reminder-deliveries", "edge delivery doc names send-reminder-deliveries");

assertContains(deliveryArchDoc, "CORS", "delivery architecture documents CORS issue");
assertContains(edgeDeliveryDoc, "CORS", "edge delivery doc documents CORS issue");
assertContains(deliveryArchDoc, "exposed API key", "delivery architecture documents API key exposure");
assertContains(edgeDeliveryDoc, "Secret exposure", "edge delivery doc documents secret exposure");

assertContains(
  deliveryArchDoc,
  "browser must never contain, read, or transmit the Resend API key",
  "delivery architecture states browser must not hold RESEND_API_KEY"
);
assertContains(
  edgeDeliveryDoc,
  "Browser must never receive `RESEND_API_KEY`",
  "edge delivery doc states browser must not receive RESEND_API_KEY"
);
assertContains(
  edgeDeliveryDoc,
  "RESEND_API_KEY",
  "edge delivery doc documents RESEND_API_KEY secret handling"
);
assertContains(
  edgeDeliveryDoc,
  "Supabase Edge Function secrets",
  "edge delivery doc documents Edge Function secrets"
);

assertContains(
  deliveryArchDoc,
  "Browser Manual Delivery UI",
  "delivery architecture documents browser manual delivery UI layer"
);
assertContains(
  deliveryArchDoc,
  "Supabase Edge Function",
  "delivery architecture documents Edge Function layer"
);
assertContains(
  deliveryArchDoc,
  "create_reminder_delivery_log",
  "delivery architecture documents delivery log RPC"
);
assertContains(
  edgeDeliveryDoc,
  "create_reminder_delivery_log",
  "edge delivery doc documents delivery log persistence"
);

assertContains(
  deliveryArchDoc,
  "must not call Resend directly",
  "delivery architecture documents browser must not call Resend directly"
);
assertContains(
  edgeDeliveryDoc,
  "NO api.resend.com fetch",
  "edge delivery doc documents no browser Resend fetch"
);

assertContains(edgeDeliveryDoc, "## Admin-only authorization", "edge delivery doc has admin authorization section");
assertContains(edgeDeliveryDoc, "## Provider mode: test vs production", "edge delivery doc has test/production mode section");
assertContains(edgeDeliveryDoc, "## Resend secret handling", "edge delivery doc has Resend secret handling section");
assertContains(edgeDeliveryDoc, "## Delivery log persistence", "edge delivery doc has delivery log persistence section");
assertContains(edgeDeliveryDoc, "## Error handling", "edge delivery doc has error handling section");
assertContains(edgeDeliveryDoc, "## Rollback plan", "edge delivery doc has rollback plan section");
assertContains(edgeDeliveryDoc, "SendReminderDeliveriesRequest", "edge delivery doc documents request payload");

assertContains(
  deliveryArchDoc,
  "no deployed Edge Function",
  "delivery architecture states no deployed Edge Function in Phase 36"
);
assertContains(
  edgeDeliveryDoc,
  "No deployed function",
  "edge delivery doc states no deployed function in Phase 36"
);

const envResendKey = readResendApiKeyLiteral(emailProviderEnvJs);

assert(
  envResendKey === null || envResendKey === "undefined",
  "email-provider-env.js must not contain a committed RESEND_API_KEY value (server-side only)"
);

if (existsSync(supabaseFunctionsDir)) {
  const skeletonPath = join(supabaseFunctionsDir, "send-reminder-deliveries", "index.ts");

  assert(existsSync(skeletonPath), "supabase/functions/send-reminder-deliveries/index.ts exists");
}

assertNotContains(
  manualDeliveryExecutionJs,
  "functions.invoke",
  "manual-delivery-execution.js must not wire Edge Function invoke yet"
);
assertNotContains(
  manualDeliveryExecutionJs,
  "send-reminder-deliveries",
  "manual-delivery-execution.js must not reference send-reminder-deliveries yet"
);

assertContains(roadmap, "V6 Phase 36", "ROADMAP.md references V6 Phase 36");
assertContains(roadmap, "verify-edge-delivery-plan", "ROADMAP.md references verify-edge-delivery-plan");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-edge-delivery-plan: all checks OK");
