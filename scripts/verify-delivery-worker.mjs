/**
 * V6 Phase 24: Worker delivery execution engine verification.
 * Deterministic checks for in-memory delivery execution — no Supabase, browser,
 * app wiring, database writes, RPC calls, or mark-as-sent automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { executeReminderDeliveries } from "../js/app/automation/delivery-worker.js";
import { createMockEmailProvider } from "../js/app/automation/mock-email-provider.js";
import { transitionReminderDeliveryRecord } from "../js/app/automation/reminder-delivery-state-machine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const workerJs = readFileSync(join(root, "js/app/automation/delivery-worker.js"), "utf8");
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
 * @param {import("../js/app/automation/reminder-delivery-state-machine.js").ReminderDeliveryRecord["deliveryStatus"]} deliveryStatus
 * @param {Partial<import("../js/app/automation/reminder-delivery-state-machine.js").ReminderDeliveryRecord>} overrides
 */
function createTestRecord(deliveryStatus, overrides = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    organisationId: "11111111-1111-4111-8111-111111111111",
    automationRunId: "22222222-2222-4222-8222-222222222222",
    queueItemId: "jordan|dbs|2026-07-15|14-day|2026-06-18",
    recipientEmail: "jordan.coordinator@example.com",
    subject: "DBS reminder",
    bodyText: "Please renew your DBS.",
    deliveryStatus,
    preparedAt: "2026-06-18T09:00:00.000Z",
    sentAt: null,
    deliveredAt: null,
    failedAt: null,
    failureReason: null,
    cancelledAt: null,
    cancellationReason: null,
    metadata: {
      reminderWindow: "14-day",
      complianceType: "dbs",
      expiryDate: "2026-07-15",
      source: "dry_run",
      emailMissing: false,
    },
    statusHistory: [],
    ...overrides,
  };
}

/**
 * @param {Awaited<ReturnType<typeof createMockEmailProvider>>} provider
 */
function createTrackingProvider(provider) {
  let callCount = 0;

  return {
    provider: {
      async sendReminder(input) {
        callCount += 1;
        return provider.sendReminder(input);
      },
    },
    getCallCount() {
      return callCount;
    },
  };
}

console.log("V6 Phase 24 worker delivery execution verification (verify-delivery-worker)\n");

assertContains(packageJson, '"verify-delivery-worker"', "package.json verify script");
assertContains(workerJs, "export async function executeReminderDeliveries", "delivery-worker export");
assertContains(workerJs, "transitionReminderDeliveryRecord", "delivery-worker uses state machine");

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
  "create_reminder_delivery_log",
  "get_reminder_delivery_logs",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(workerJs, needle, `delivery-worker.js has no ${needle}`);
}

assertNotContains(appJs, "delivery-worker", "app.js is not wired to delivery-worker");
assertNotContains(appJs, "executeReminderDeliveries", "app.js does not import executeReminderDeliveries");

const now = "2026-06-18T10:00:00.000Z";

const successTracking = createTrackingProvider(createMockEmailProvider({ mode: "success" }));
const preparedRecord = createTestRecord("prepared");
const preparedSnapshot = JSON.stringify(preparedRecord);

const successResult = await executeReminderDeliveries({
  records: [preparedRecord],
  provider: successTracking.provider,
  transitionRecord: transitionReminderDeliveryRecord,
  now,
});

assertDeepEqual(JSON.parse(preparedSnapshot), preparedRecord, "input record not mutated after delivered path");
assertEqual(successTracking.getCallCount(), 1, "delivered path calls provider once");
assertEqual(successResult.records[0].deliveryStatus, "delivered", "delivered path ends delivered");
assertEqual(successResult.records[0].sentAt, now, "delivered path sets sentAt");
assertEqual(successResult.records[0].statusHistory.at(-1)?.to, "delivered", "delivered path history ends at delivered");
assertDeepEqual(
  successResult.summary,
  { total: 1, attempted: 1, delivered: 1, failed: 0, skipped: 0 },
  "delivered path summary"
);

const failedTracking = createTrackingProvider(
  createMockEmailProvider({ mode: "permanent_failure" })
);
const failedPrepared = createTestRecord("prepared", {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
});

const failedResult = await executeReminderDeliveries({
  records: [failedPrepared],
  provider: failedTracking.provider,
  transitionRecord: transitionReminderDeliveryRecord,
  now,
});

assertEqual(failedTracking.getCallCount(), 1, "failed path calls provider once");
assertEqual(failedResult.records[0].deliveryStatus, "failed", "failed path ends failed");
assertEqual(
  failedResult.records[0].failureReason,
  "mock_permanent_provider_error",
  "failed path stores failureReason"
);
assertDeepEqual(
  failedResult.summary,
  { total: 1, attempted: 1, delivered: 0, failed: 1, skipped: 0 },
  "failed path summary"
);

const skipTracking = createTrackingProvider(createMockEmailProvider({ mode: "success" }));

const missingEmailRecord = createTestRecord("failed", {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  recipientEmail: null,
  preparedAt: null,
  failedAt: "2026-06-18T08:00:00.000Z",
  failureReason: "missing_recipient_email",
});
const deliveredRecord = createTestRecord("delivered", {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  sentAt: "2026-06-18T09:30:00.000Z",
  deliveredAt: "2026-06-18T09:35:00.000Z",
});
const cancelledRecord = createTestRecord("cancelled", {
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  cancelledAt: "2026-06-18T09:15:00.000Z",
  cancellationReason: "duplicate_prevented",
});
const attemptPrepared = createTestRecord("prepared", {
  id: "11111111-1111-4111-8111-111111111112",
});

const mixedInput = [missingEmailRecord, deliveredRecord, cancelledRecord, attemptPrepared];
const mixedSnapshots = mixedInput.map((record) => JSON.stringify(record));

const mixedResult = await executeReminderDeliveries({
  records: mixedInput,
  provider: skipTracking.provider,
  transitionRecord: transitionReminderDeliveryRecord,
  now,
});

assertEqual(skipTracking.getCallCount(), 1, "skipped records run calls provider only for prepared");
assertEqual(mixedResult.records[0], missingEmailRecord, "missing_recipient_email record unchanged");
assertEqual(mixedResult.records[1], deliveredRecord, "delivered record unchanged");
assertEqual(mixedResult.records[2], cancelledRecord, "cancelled record unchanged");
assertEqual(mixedResult.records[3].deliveryStatus, "delivered", "prepared record in mixed run delivered");
mixedSnapshots.forEach((snapshot, index) => {
  if (index === 3) {
    return;
  }

  assertDeepEqual(JSON.parse(snapshot), mixedInput[index], `mixed input record ${index} not mutated`);
});
assertDeepEqual(
  mixedResult.summary,
  { total: 4, attempted: 1, delivered: 1, failed: 0, skipped: 3 },
  "skipped records summary"
);

let transitionCallCount = 0;

const trackingTransition = (input) => {
  transitionCallCount += 1;
  return transitionReminderDeliveryRecord(input);
};

await executeReminderDeliveries({
  records: [createTestRecord("prepared", { id: "22222222-2222-4222-8222-222222222223" })],
  provider: createMockEmailProvider({ mode: "success" }),
  transitionRecord: trackingTransition,
  now,
});

assertEqual(transitionCallCount, 2, "delivered path uses transitionRecord twice");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-delivery-worker: all checks OK");
