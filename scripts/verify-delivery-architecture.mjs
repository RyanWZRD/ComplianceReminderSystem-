/**
 * V6 Phase 1: Delivery Domain Model — architecture verification.
 * Static checks for docs/v6-delivery-architecture.md: lifecycle states,
 * delivery record fields, audit requirements, and provider abstraction.
 * No Supabase, browser, email provider, or delivery execution.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const docPath = join(root, "docs", "v6-delivery-architecture.md");

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

function assertContainsIgnoreCase(source, needle, label) {
  if (!source.toLowerCase().includes(needle.toLowerCase())) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

console.log("V6 Phase 1 delivery architecture verification (verify-delivery-architecture)\n");

assert(existsSync(docPath), "architecture document exists at docs/v6-delivery-architecture.md");

const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

/** @type {readonly string[]} */
const LIFECYCLE_STATES = [
  "queued",
  "prepared",
  "sending",
  "delivered",
  "failed",
  "cancelled",
];

for (const state of LIFECYCLE_STATES) {
  assertContains(doc, state, `lifecycle state "${state}"`);
}

/** @type {readonly string[]} */
const DELIVERY_RECORD_FIELDS = [
  "id",
  "organisationId",
  "automationRunId",
  "queueItemId",
  "recipientEmail",
  "subject",
  "deliveryStatus",
  "preparedAt",
  "sentAt",
  "deliveredAt",
  "failedAt",
  "failureReason",
];

for (const field of DELIVERY_RECORD_FIELDS) {
  assertContains(doc, field, `delivery record field "${field}"`);
}

/** @type {readonly string[]} */
const AUDIT_REQUIREMENTS = [
  "Every attempted delivery logged",
  "Delivery outcome retained",
  "Retries recorded",
  "No silent failures",
];

for (const requirement of AUDIT_REQUIREMENTS) {
  assertContains(doc, requirement, `audit requirement "${requirement}"`);
}

assertContains(doc, "## Future provider abstraction", "provider abstraction section heading");
assertContains(doc, "EmailProvider", "EmailProvider interface");
assertContains(doc, "sendReminder", "sendReminder method");
assertContains(doc, "healthCheck", "healthCheck method");

assertContainsIgnoreCase(doc, "duplicate-prevention", "duplicate-prevention section");
assertContainsIgnoreCase(doc, "same reminder window", "duplicate rule: same reminder window");
assertContainsIgnoreCase(doc, "same compliance record", "duplicate rule: same compliance record");
assertContainsIgnoreCase(doc, "same day", "duplicate rule: same day");

assertContainsIgnoreCase(doc, "transient failure", "retry strategy: transient failure");
assertContainsIgnoreCase(doc, "permanent failure", "retry strategy: permanent failure");
assertContainsIgnoreCase(doc, "retry limits", "retry strategy: retry limits");

assertContainsIgnoreCase(doc, "API keys", "security: API keys");
assertContainsIgnoreCase(doc, "audit trails", "security: audit trails");
assertContainsIgnoreCase(doc, "rate limiting", "security: rate limiting");
assertContainsIgnoreCase(doc, "GDPR", "security: GDPR considerations");

if (failures.length > 0) {
  console.error("Failures:");
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log("  Architecture document present");
console.log(`  Lifecycle states (${LIFECYCLE_STATES.length}): ${LIFECYCLE_STATES.join(", ")}`);
console.log(`  Delivery record fields (${DELIVERY_RECORD_FIELDS.length}): verified`);
console.log(`  Audit requirements (${AUDIT_REQUIREMENTS.length}): verified`);
console.log("  Provider abstraction section: EmailProvider, sendReminder(), healthCheck()");
console.log("\nV6 delivery architecture verification: OK");
