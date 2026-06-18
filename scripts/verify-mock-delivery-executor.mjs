/**
 * V6 Phase 7: Mock delivery executor verification.
 * Deterministic checks for in-memory mock delivery execution — no Supabase,
 * browser, real email provider, production delivery, or database writes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createMockEmailProvider } from "../js/app/automation/mock-email-provider.js";
import { executeMockReminderDelivery } from "../js/app/automation/mock-delivery-executor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const executorJs = readFileSync(
  join(root, "js/app/automation/mock-delivery-executor.js"),
  "utf8"
);
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

console.log(
  "V6 Phase 7 mock delivery executor verification (verify-mock-delivery-executor)\n"
);

assertContains(
  executorJs,
  "export async function executeMockReminderDelivery",
  "mock-delivery-executor module export"
);
assertContains(
  executorJs,
  "transitionReminderDeliveryRecord",
  "mock-delivery-executor uses state machine"
);
assertContains(
  packageJson,
  '"verify-mock-delivery-executor"',
  "package.json verify script"
);

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
  "createMockEmailProvider",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(executorJs, needle, `mock-delivery-executor.js has no ${needle}`);
}

const transitionAt = "2026-06-18T10:00:00.000Z";

const successTracking = createTrackingProvider(
  createMockEmailProvider({ mode: "success" })
);
const preparedRecord = createTestRecord("prepared");
const preparedSnapshot = JSON.stringify(preparedRecord);

const successResult = await executeMockReminderDelivery({
  records: [preparedRecord],
  provider: successTracking.provider,
  at: transitionAt,
});

assertDeepEqual(JSON.parse(preparedSnapshot), preparedRecord, "input record not mutated after success run");
assertEqual(successTracking.getCallCount(), 1, "success provider called once");
assertEqual(successResult.records.length, 1, "success run returns one record");
assertEqual(successResult.records[0].deliveryStatus, "delivered", "success run ends delivered");
assertEqual(successResult.records[0].sentAt, transitionAt, "success run sets sentAt on sending");
assert(
  typeof successResult.records[0].deliveredAt === "string" &&
    successResult.records[0].deliveredAt.length > 0,
  "success run sets deliveredAt"
);
assertEqual(successResult.records[0].statusHistory.length, 2, "success run appends two transitions");
assertEqual(successResult.records[0].statusHistory[0].from, "prepared", "success history prepared -> sending");
assertEqual(successResult.records[0].statusHistory[0].to, "sending", "success history to sending");
assertEqual(successResult.records[0].statusHistory[1].from, "sending", "success history sending -> delivered");
assertEqual(successResult.records[0].statusHistory[1].to, "delivered", "success history to delivered");
assertDeepEqual(
  successResult.summary,
  { total: 1, attempted: 1, delivered: 1, failed: 0, skipped: 0 },
  "success run summary"
);

const transientTracking = createTrackingProvider(
  createMockEmailProvider({ mode: "transient_failure" })
);
const transientPrepared = createTestRecord("prepared", {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
});

const transientResult = await executeMockReminderDelivery({
  records: [transientPrepared],
  provider: transientTracking.provider,
  at: transitionAt,
});

assertEqual(transientTracking.getCallCount(), 1, "transient provider called once");
assertEqual(transientResult.records[0].deliveryStatus, "failed", "transient run ends failed");
assertEqual(
  transientResult.records[0].failureReason,
  "mock_transient_provider_error",
  "transient run stores failureReason"
);
assertEqual(transientResult.records[0].statusHistory.at(-1)?.to, "failed", "transient history ends at failed");
assertDeepEqual(
  transientResult.summary,
  { total: 1, attempted: 1, delivered: 0, failed: 1, skipped: 0 },
  "transient run summary"
);

const permanentTracking = createTrackingProvider(
  createMockEmailProvider({ mode: "permanent_failure" })
);
const permanentPrepared = createTestRecord("prepared", {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
});

const permanentResult = await executeMockReminderDelivery({
  records: [permanentPrepared],
  provider: permanentTracking.provider,
  at: transitionAt,
});

assertEqual(permanentTracking.getCallCount(), 1, "permanent provider called once");
assertEqual(permanentResult.records[0].deliveryStatus, "failed", "permanent run ends failed");
assertEqual(
  permanentResult.records[0].failureReason,
  "mock_permanent_provider_error",
  "permanent run stores failureReason"
);
assertDeepEqual(
  permanentResult.summary,
  { total: 1, attempted: 1, delivered: 0, failed: 1, skipped: 0 },
  "permanent run summary"
);

const skipTracking = createTrackingProvider(
  createMockEmailProvider({ mode: "success" })
);

const missingEmailRecord = createTestRecord("failed", {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  recipientEmail: null,
  preparedAt: null,
  failedAt: "2026-06-18T08:00:00.000Z",
  failureReason: "missing_recipient_email",
  metadata: {
    reminderWindow: "14-day",
    complianceType: "dbs",
    expiryDate: "2026-07-15",
    source: "dry_run",
    emailMissing: true,
  },
});
const missingEmailSnapshot = JSON.stringify(missingEmailRecord);

const deliveredRecord = createTestRecord("delivered", {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  sentAt: "2026-06-18T09:30:00.000Z",
  deliveredAt: "2026-06-18T09:35:00.000Z",
});
const deliveredSnapshot = JSON.stringify(deliveredRecord);

const cancelledRecord = createTestRecord("cancelled", {
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  cancelledAt: "2026-06-18T09:15:00.000Z",
  cancellationReason: "duplicate_prevented",
});
const cancelledSnapshot = JSON.stringify(cancelledRecord);

const attemptPrepared = createTestRecord("prepared", {
  id: "11111111-1111-4111-8111-111111111112",
});

const mixedInput = [
  missingEmailRecord,
  deliveredRecord,
  cancelledRecord,
  attemptPrepared,
];
const mixedSnapshots = mixedInput.map((record) => JSON.stringify(record));

const mixedResult = await executeMockReminderDelivery({
  records: mixedInput,
  provider: skipTracking.provider,
  at: transitionAt,
});

assertEqual(skipTracking.getCallCount(), 1, "mixed run calls provider only for prepared record");
assertDeepEqual(JSON.parse(missingEmailSnapshot), missingEmailRecord, "missing-email input not mutated");
assertDeepEqual(JSON.parse(deliveredSnapshot), deliveredRecord, "delivered input not mutated");
assertDeepEqual(JSON.parse(cancelledSnapshot), cancelledRecord, "cancelled input not mutated");
assertEqual(mixedResult.records[0], missingEmailRecord, "missing-email record unchanged by reference");
assertEqual(mixedResult.records[1], deliveredRecord, "delivered record unchanged by reference");
assertEqual(mixedResult.records[2], cancelledRecord, "cancelled record unchanged by reference");
assertEqual(mixedResult.records[3].deliveryStatus, "delivered", "mixed run delivers prepared record");
mixedSnapshots.forEach((snapshot, index) => {
  if (index === 3) {
    return;
  }

  assertDeepEqual(
    JSON.parse(snapshot),
    mixedInput[index],
    `mixed input record ${index} not mutated`
  );
});
assertDeepEqual(
  mixedResult.summary,
  { total: 4, attempted: 1, delivered: 1, failed: 0, skipped: 3 },
  "mixed run summary"
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-mock-delivery-executor: all checks OK");
