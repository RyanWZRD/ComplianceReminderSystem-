/**
 * V6 Phase 5: Reminder delivery state machine verification.
 * Deterministic checks for in-memory delivery record transitions — no Supabase,
 * browser, email provider, delivery execution, or database writes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DELIVERY_STATUSES,
  isValidReminderDeliveryTransition,
  transitionReminderDeliveryRecord,
} from "../js/app/automation/reminder-delivery-state-machine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const stateMachineJs = readFileSync(
  join(root, "js/app/automation/reminder-delivery-state-machine.js"),
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

function assertThrows(fn, expectedMessagePart, label) {
  try {
    fn();
    fail(`${label}: expected throw`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes(expectedMessagePart)) {
      fail(
        `${label}: expected message containing ${JSON.stringify(expectedMessagePart)}, got ${JSON.stringify(message)}`
      );
    }
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
    preparedAt: null,
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

console.log(
  "V6 Phase 5 reminder delivery state machine verification (verify-reminder-delivery-state-machine)\n"
);

assertContains(
  stateMachineJs,
  "export function transitionReminderDeliveryRecord",
  "reminder-delivery-state-machine module export"
);
assertContains(
  packageJson,
  '"verify-reminder-delivery-state-machine"',
  "package.json verify script"
);

const forbiddenNeedles = [
  "sendEmail",
  "sendReminder",
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "enqueue_reminder_notifications",
  "process_notification_queue",
  "smtp",
  "resend",
  "history_entries",
  "add_default_actions",
  ".rpc(",
  "fetch(",
  "supabase",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(stateMachineJs, needle, `reminder-delivery-state-machine.js has no ${needle}`);
}

assertDeepEqual(
  [...DELIVERY_STATUSES],
  ["queued", "prepared", "sending", "delivered", "failed", "cancelled"],
  "DELIVERY_STATUSES"
);

/** @type {readonly [import("../js/app/automation/reminder-delivery-state-machine.js").ReminderDeliveryRecord["deliveryStatus"], import("../js/app/automation/reminder-delivery-state-machine.js").ReminderDeliveryRecord["deliveryStatus"]][]} */
const VALID_TRANSITION_PAIRS = [
  ["queued", "prepared"],
  ["queued", "cancelled"],
  ["prepared", "sending"],
  ["prepared", "cancelled"],
  ["prepared", "failed"],
  ["sending", "delivered"],
  ["sending", "failed"],
  ["failed", "queued"],
  ["failed", "cancelled"],
];

for (const [from, to] of VALID_TRANSITION_PAIRS) {
  assert(
    isValidReminderDeliveryTransition(from, to),
    `valid transition ${from} -> ${to}`
  );
}

/** @type {readonly [import("../js/app/automation/reminder-delivery-state-machine.js").ReminderDeliveryRecord["deliveryStatus"], import("../js/app/automation/reminder-delivery-state-machine.js").ReminderDeliveryRecord["deliveryStatus"]][]} */
const INVALID_TRANSITION_PAIRS = [
  ["queued", "sending"],
  ["queued", "delivered"],
  ["queued", "failed"],
  ["prepared", "delivered"],
  ["prepared", "queued"],
  ["sending", "prepared"],
  ["sending", "cancelled"],
  ["sending", "queued"],
  ["delivered", "failed"],
  ["delivered", "queued"],
  ["delivered", "prepared"],
  ["delivered", "sending"],
  ["delivered", "cancelled"],
  ["cancelled", "queued"],
  ["cancelled", "prepared"],
  ["cancelled", "sending"],
  ["cancelled", "delivered"],
  ["cancelled", "failed"],
  ["failed", "delivered"],
  ["failed", "prepared"],
  ["failed", "sending"],
];

for (const [from, to] of INVALID_TRANSITION_PAIRS) {
  assert(
    !isValidReminderDeliveryTransition(from, to),
    `invalid transition ${from} -> ${to}`
  );
}

const transitionAt = "2026-06-18T10:00:00.000Z";

const queuedRecord = createTestRecord("queued");
const queuedSnapshot = JSON.stringify(queuedRecord);

const preparedFromQueued = transitionReminderDeliveryRecord({
  record: queuedRecord,
  nextStatus: "prepared",
  at: transitionAt,
});

assertDeepEqual(JSON.parse(queuedSnapshot), queuedRecord, "input record not mutated after queued -> prepared");
assertEqual(preparedFromQueued.deliveryStatus, "prepared", "queued -> prepared status");
assertEqual(preparedFromQueued.preparedAt, transitionAt, "queued -> prepared sets preparedAt");
assertEqual(preparedFromQueued.statusHistory.length, 1, "queued -> prepared appends statusHistory");
assertEqual(preparedFromQueued.statusHistory[0].from, "queued", "history from queued");
assertEqual(preparedFromQueued.statusHistory[0].to, "prepared", "history to prepared");
assertEqual(preparedFromQueued.statusHistory[0].at, transitionAt, "history at timestamp");

const preparedWithExistingPreparedAt = createTestRecord("queued", {
  preparedAt: "2026-06-18T09:00:00.000Z",
});

const preparedPreservesPreparedAt = transitionReminderDeliveryRecord({
  record: preparedWithExistingPreparedAt,
  nextStatus: "prepared",
  at: transitionAt,
});

assertEqual(
  preparedPreservesPreparedAt.preparedAt,
  "2026-06-18T09:00:00.000Z",
  "prepared transition preserves existing preparedAt"
);

const preparedRecord = createTestRecord("prepared", {
  preparedAt: transitionAt,
});

const sendingRecord = transitionReminderDeliveryRecord({
  record: preparedRecord,
  nextStatus: "sending",
  at: "2026-06-18T10:05:00.000Z",
});

assertEqual(sendingRecord.deliveryStatus, "sending", "prepared -> sending status");
assertEqual(sendingRecord.sentAt, "2026-06-18T10:05:00.000Z", "prepared -> sending sets sentAt");
assertEqual(sendingRecord.preparedAt, transitionAt, "prepared -> sending preserves preparedAt");

const sendingWithExistingSentAt = createTestRecord("prepared", {
  preparedAt: transitionAt,
  sentAt: "2026-06-18T09:30:00.000Z",
});

const sendingPreservesSentAt = transitionReminderDeliveryRecord({
  record: sendingWithExistingSentAt,
  nextStatus: "sending",
  at: "2026-06-18T10:05:00.000Z",
});

assertEqual(
  sendingPreservesSentAt.sentAt,
  "2026-06-18T09:30:00.000Z",
  "sending transition preserves existing sentAt"
);

const inFlightSending = createTestRecord("sending", {
  preparedAt: transitionAt,
  sentAt: "2026-06-18T10:05:00.000Z",
  statusHistory: [
    { from: "queued", to: "prepared", at: transitionAt, reason: null },
    { from: "prepared", to: "sending", at: "2026-06-18T10:05:00.000Z", reason: null },
  ],
});

const deliveredRecord = transitionReminderDeliveryRecord({
  record: inFlightSending,
  nextStatus: "delivered",
  at: "2026-06-18T10:10:00.000Z",
});

assertEqual(deliveredRecord.deliveryStatus, "delivered", "sending -> delivered status");
assertEqual(deliveredRecord.deliveredAt, "2026-06-18T10:10:00.000Z", "sending -> delivered sets deliveredAt");
assertEqual(deliveredRecord.statusHistory.length, 3, "sending -> delivered appends history");

assertThrows(
  () =>
    transitionReminderDeliveryRecord({
      record: deliveredRecord,
      nextStatus: "failed",
      reason: "too late",
      at: "2026-06-18T10:11:00.000Z",
    }),
  'Invalid delivery status transition from "delivered" to "failed"',
  "delivered terminal rejects further transitions"
);

const cancelledFromQueued = transitionReminderDeliveryRecord({
  record: createTestRecord("queued"),
  nextStatus: "cancelled",
  reason: "duplicate_prevented",
  at: "2026-06-18T10:01:00.000Z",
});

assertEqual(cancelledFromQueued.deliveryStatus, "cancelled", "queued -> cancelled status");
assertEqual(cancelledFromQueued.cancelledAt, "2026-06-18T10:01:00.000Z", "queued -> cancelled sets cancelledAt");
assertEqual(
  cancelledFromQueued.cancellationReason,
  "duplicate_prevented",
  "queued -> cancelled stores cancellationReason"
);

assertThrows(
  () =>
    transitionReminderDeliveryRecord({
      record: cancelledFromQueued,
      nextStatus: "queued",
      at: "2026-06-18T10:02:00.000Z",
    }),
  'Invalid delivery status transition from "cancelled" to "queued"',
  "cancelled terminal rejects further transitions"
);

const failedFromPrepared = transitionReminderDeliveryRecord({
  record: createTestRecord("prepared", { preparedAt: transitionAt }),
  nextStatus: "failed",
  reason: "invalid_recipient",
  at: "2026-06-18T10:02:00.000Z",
});

assertEqual(failedFromPrepared.deliveryStatus, "failed", "prepared -> failed status");
assertEqual(failedFromPrepared.failedAt, "2026-06-18T10:02:00.000Z", "prepared -> failed sets failedAt");
assertEqual(failedFromPrepared.failureReason, "invalid_recipient", "prepared -> failed stores failureReason");

const failedFromSending = transitionReminderDeliveryRecord({
  record: createTestRecord("sending", {
    preparedAt: transitionAt,
    sentAt: "2026-06-18T10:05:00.000Z",
  }),
  nextStatus: "failed",
  reason: "provider_timeout",
  at: "2026-06-18T10:06:00.000Z",
});

assertEqual(failedFromSending.failureReason, "provider_timeout", "sending -> failed stores failureReason");

const retriedRecord = transitionReminderDeliveryRecord({
  record: failedFromSending,
  nextStatus: "queued",
  reason: "retry_scheduled",
  at: "2026-06-18T10:07:00.000Z",
});

assertEqual(retriedRecord.deliveryStatus, "queued", "failed -> queued status");
assertEqual(retriedRecord.failedAt, "2026-06-18T10:06:00.000Z", "failed -> queued retains failedAt");
assertEqual(retriedRecord.failureReason, "provider_timeout", "failed -> queued retains failureReason");
assertEqual(retriedRecord.statusHistory.at(-1)?.reason, "retry_scheduled", "failed -> queued records reason in history");

for (const [from, to] of INVALID_TRANSITION_PAIRS) {
  assertThrows(
    () =>
      transitionReminderDeliveryRecord({
        record: createTestRecord(from),
        nextStatus: to,
        at: transitionAt,
      }),
    `Invalid delivery status transition from "${from}" to "${to}"`,
    `transition throws for invalid ${from} -> ${to}`
  );
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-delivery-state-machine: all checks OK");
