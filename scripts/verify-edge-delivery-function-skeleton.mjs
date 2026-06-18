/**
 * V6 Phase 37 + 38: send-reminder-deliveries Edge Function structural verification.
 * Static checks for handler skeleton, validation, and safety gates —
 * no delivery log writes, no mark-as-sent automation, no browser invoke wiring.
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

console.log(
  "V6 Phase 37 Edge Function skeleton verification (verify-edge-delivery-function-skeleton)\n",
);

assert(existsSync(functionPath), "supabase/functions/send-reminder-deliveries/index.ts exists");

const functionSource = readFileSync(functionPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const edgeDeliveryDoc = readFileSync(edgeDeliveryDocPath, "utf8");
const manualDeliveryExecutionJs = readFileSync(manualDeliveryExecutionPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-edge-delivery-function-skeleton"',
  "package.json verify-edge-delivery-function-skeleton script",
);

assertContains(functionSource, "Deno.serve", "index.ts defines Deno.serve handler");
assertContains(functionSource, 'req.method === "OPTIONS"', "index.ts handles OPTIONS");
assertContains(functionSource, 'req.method !== "POST"', "index.ts restricts to POST");
assertContains(functionSource, "Authorization", "index.ts validates Authorization header");

assertContains(functionSource, "organisationId", "index.ts validates organisationId");
assertContains(functionSource, "automationRunId", "index.ts validates automationRunId");
assertContains(functionSource, "deliveryRecords", "index.ts validates deliveryRecords");
assertContains(functionSource, "validateRequestBody", "index.ts has validateRequestBody helper");

assertContains(functionSource, "Access-Control-Allow-Origin", "index.ts sets CORS headers");
assertContains(functionSource, "127.0.0.1:8877", "index.ts allows local dev origin");

const forbiddenNeedles = [
  "create_reminder_delivery_log",
  "mark_reminder_sent",
  "markReminderSent",
  "mark-as-sent",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(functionSource, needle, `index.ts has no ${needle}`);
}

assertNotContains(
  manualDeliveryExecutionJs,
  "functions.invoke",
  "manual-delivery-execution.js must not wire Edge Function invoke yet",
);
assertNotContains(
  manualDeliveryExecutionJs,
  "send-reminder-deliveries",
  "manual-delivery-execution.js must not reference send-reminder-deliveries yet",
);

assertContains(
  deliveryArchDoc,
  "## Phase 37 — Edge Function skeleton",
  "delivery architecture doc has Phase 37 section",
);
assertContains(
  edgeDeliveryDoc,
  "## Phase 37 — Edge Function skeleton",
  "edge delivery doc has Phase 37 section",
);
assertContains(
  edgeDeliveryDoc,
  "verify-edge-delivery-function-skeleton",
  "edge delivery doc references verify-edge-delivery-function-skeleton",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-edge-delivery-function-skeleton: all checks OK");
