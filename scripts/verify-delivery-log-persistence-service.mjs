/**
 * V6 Phase 26: Delivery log persistence service verification.
 * Deterministic checks for RPC persistence orchestration — no Supabase smoke,
 * browser, provider calls, app wiring, or mark-as-sent automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { persistDeliveryLogPayloads } from "../js/app/automation/delivery-log-persistence-service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const serviceJs = readFileSync(
  join(root, "js/app/automation/delivery-log-persistence-service.js"),
  "utf8"
);
const cloudAutomationStoreJs = readFileSync(
  join(root, "js/data/cloud-automation-store.js"),
  "utf8"
);
const appJs = readFileSync(join(root, "app.js"), "utf8");
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

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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

/**
 * @param {string} suffix
 * @returns {import("../js/app/automation/delivery-worker-persistence.js").CreateReminderDeliveryLogPayload}
 */
function createTestPayload(suffix) {
  return {
    p_organisation_id: "11111111-1111-4111-8111-111111111111",
    p_automation_run_id: "22222222-2222-4222-8222-222222222222",
    p_queue_item_id: `jordan|dbs|2026-07-15|14-day|2026-06-18|${suffix}`,
    p_compliance_record_id: "33333333-3333-4333-8333-333333333333",
    p_person_id: "44444444-4444-4444-8444-444444444444",
    p_recipient_email: "jordan.coordinator@example.com",
    p_subject: `DBS reminder ${suffix}`,
    p_body_text: "Please renew your DBS.",
    p_delivery_status: "delivered",
    p_prepared_at: "2026-06-18T09:00:00.000Z",
    p_sent_at: "2026-06-18T09:30:00.000Z",
    p_delivered_at: "2026-06-18T09:35:00.000Z",
    p_failed_at: null,
    p_failure_reason: null,
    p_metadata: {
      provider: "mock",
      providerMessageId: `mock-${suffix}`,
      reminderWindow: "14-day",
      complianceType: "dbs",
      expiryDate: "2026-07-15",
      source: "dry_run",
      emailMissing: false,
      statusHistory: [{ from: "prepared", to: "delivered", at: "2026-06-18T09:35:00.000Z", reason: null }],
    },
  };
}

console.log(
  "V6 Phase 26 delivery log persistence service verification (verify-delivery-log-persistence-service)\n"
);

assertContains(
  packageJson,
  '"verify-delivery-log-persistence-service"',
  "package.json verify script"
);
assertContains(
  serviceJs,
  "export async function persistDeliveryLogPayloads",
  "delivery-log-persistence-service export"
);
assertContains(
  cloudAutomationStoreJs,
  "async createReminderDeliveryLog(payload)",
  "cloud-automation-store createReminderDeliveryLog method"
);
assertContains(
  cloudAutomationStoreJs,
  'supabase.rpc("create_reminder_delivery_log", payload)',
  "cloud-automation-store uses create_reminder_delivery_log RPC"
);

const forbiddenNeedles = [
  "fetch(",
  "smtp",
  "resend",
  "nodemailer",
  "sendEmail",
  "sendReminder",
  "executeReminderDeliveries",
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "enqueue_reminder_notifications",
  "process_notification_queue",
  "history_entries",
  "add_default_actions",
  "getSupabaseClient",
  "supabase.rpc",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(serviceJs, needle, `delivery-log-persistence-service.js has no ${needle}`);
}

assertNotContains(appJs, "delivery-log-persistence-service", "app.js is not wired to persistence service");
assertNotContains(appJs, "persistDeliveryLogPayloads", "app.js does not import persistDeliveryLogPayloads");
assertNotContains(appJs, "createReminderDeliveryLog", "app.js does not call createReminderDeliveryLog");

const payloadA = createTestPayload("a");
const payloadB = createTestPayload("b");
const successSnapshots = [JSON.stringify(payloadA), JSON.stringify(payloadB)];
const successCalls = [];

const successDb = {
  async createReminderDeliveryLog(payload) {
    successCalls.push(payload);
    return {
      ok: true,
      log: {
        id: `log-${successCalls.length}`,
        deliveryStatus: payload.p_delivery_status,
        createdAt: "2026-06-18T10:00:00.000Z",
      },
    };
  },
};

const successResult = await persistDeliveryLogPayloads({
  db: successDb,
  payloads: [payloadA, payloadB],
});

assertEqual(successCalls.length, 2, "success path calls createReminderDeliveryLog once per payload");
assertEqual(successCalls[0], payloadA, "success path passes first payload by reference");
assertEqual(successCalls[1], payloadB, "success path passes second payload by reference");
assertDeepEqual(
  successResult.summary,
  { total: 2, persisted: 2, failed: 0 },
  "success path summary"
);
assertEqual(successResult.results[0].ok, true, "first success result ok");
assertEqual(successResult.results[0].log.id, "log-1", "first success result log id");
assertEqual(successResult.results[1].ok, true, "second success result ok");
assertDeepEqual(JSON.parse(successSnapshots[0]), payloadA, "success payload A not mutated");
assertDeepEqual(JSON.parse(successSnapshots[1]), payloadB, "success payload B not mutated");

const payloadFail = createTestPayload("fail");
const payloadOk = createTestPayload("ok");
const partialSnapshots = [JSON.stringify(payloadFail), JSON.stringify(payloadOk)];
const partialCalls = [];

const partialDb = {
  async createReminderDeliveryLog(payload) {
    partialCalls.push(payload);

    if (payload.p_queue_item_id.includes("|fail")) {
      return { ok: false, error: "Organisation mismatch" };
    }

    return {
      ok: true,
      log: {
        id: "log-partial-ok",
        deliveryStatus: payload.p_delivery_status,
        createdAt: "2026-06-18T10:05:00.000Z",
      },
    };
  },
};

const partialResult = await persistDeliveryLogPayloads({
  db: partialDb,
  payloads: [payloadFail, payloadOk],
});

assertEqual(partialCalls.length, 2, "partial failure continues processing all payloads");
assertDeepEqual(
  partialResult.summary,
  { total: 2, persisted: 1, failed: 1 },
  "partial failure summary"
);
assertEqual(partialResult.results[0].ok, false, "partial failure first result not ok");
assertEqual(
  partialResult.results[0].error,
  "Organisation mismatch",
  "partial failure captures error message"
);
assertEqual(partialResult.results[1].ok, true, "partial failure second result ok");
assertDeepEqual(JSON.parse(partialSnapshots[0]), payloadFail, "partial failure payload fail not mutated");
assertDeepEqual(JSON.parse(partialSnapshots[1]), payloadOk, "partial failure payload ok not mutated");

const payloadThrow = createTestPayload("throw");
const throwSnapshot = JSON.stringify(payloadThrow);

const throwDb = {
  async createReminderDeliveryLog() {
    throw new Error("RPC transport failure");
  },
};

const throwResult = await persistDeliveryLogPayloads({
  db: throwDb,
  payloads: [payloadThrow],
});

assertEqual(throwResult.summary.failed, 1, "thrown error increments failed count");
assertEqual(throwResult.results[0].error, "RPC transport failure", "thrown error captured in result");
assertDeepEqual(JSON.parse(throwSnapshot), payloadThrow, "thrown error payload not mutated");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-delivery-log-persistence-service: all checks OK");
