/**
 * V6 Phase 25: Delivery worker persistence adapter verification.
 * Deterministic checks for RPC payload mapping — no Supabase, browser,
 * provider calls, app wiring, database writes, or mark-as-sent automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { executeReminderDeliveries } from "../js/app/automation/delivery-worker.js";
import {
  buildDeliveryLogPayloads,
  CREATE_REMINDER_DELIVERY_LOG_PAYLOAD_KEYS,
} from "../js/app/automation/delivery-worker-persistence.js";
import { createMockEmailProvider } from "../js/app/automation/mock-email-provider.js";
import { transitionReminderDeliveryRecord } from "../js/app/automation/reminder-delivery-state-machine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const persistenceJs = readFileSync(
  join(root, "js/app/automation/delivery-worker-persistence.js"),
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

function assertKeys(object, keys, label) {
  const actualKeys = Object.keys(object).sort();
  const expectedKeys = [...keys].sort();

  if (actualKeys.join(",") !== expectedKeys.join(",")) {
    fail(`${label}: expected keys [${expectedKeys.join(", ")}], got [${actualKeys.join(", ")}]`);
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
    complianceRecordId: "33333333-3333-4333-8333-333333333333",
    personId: "44444444-4444-4444-8444-444444444444",
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

console.log(
  "V6 Phase 25 delivery worker persistence verification (verify-delivery-worker-persistence)\n"
);

assertContains(
  packageJson,
  '"verify-delivery-worker-persistence"',
  "package.json verify script"
);
assertContains(
  persistenceJs,
  "export function buildDeliveryLogPayloads",
  "delivery-worker-persistence export"
);
assertContains(
  persistenceJs,
  "CREATE_REMINDER_DELIVERY_LOG_PAYLOAD_KEYS",
  "payload keys export"
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
  ".rpc(",
  "supabase",
  "XMLHttpRequest",
  "get_reminder_delivery_logs",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(persistenceJs, needle, `delivery-worker-persistence.js has no ${needle}`);
}

assertNotContains(appJs, "delivery-worker-persistence", "app.js is not wired to persistence adapter");
assertNotContains(appJs, "buildDeliveryLogPayloads", "app.js does not import buildDeliveryLogPayloads");

const organisationId = "11111111-1111-4111-8111-111111111111";
const automationRunId = "22222222-2222-4222-8222-222222222222";
const now = "2026-06-18T10:00:00.000Z";

const preparedRecord = createTestRecord("prepared");
const preparedSnapshot = JSON.stringify(preparedRecord);

const preparedPayloads = buildDeliveryLogPayloads({
  records: [preparedRecord],
  organisationId,
  automationRunId,
});

assertEqual(preparedPayloads.length, 1, "prepared record produces one payload");
assertKeys(
  preparedPayloads[0],
  CREATE_REMINDER_DELIVERY_LOG_PAYLOAD_KEYS,
  "payload uses create_reminder_delivery_log parameter names"
);
assertEqual(preparedPayloads[0].p_organisation_id, organisationId, "prepared payload organisation id");
assertEqual(preparedPayloads[0].p_automation_run_id, automationRunId, "prepared payload automation run id");
assertEqual(preparedPayloads[0].p_delivery_status, "prepared", "prepared payload delivery status");
assertEqual(preparedPayloads[0].p_prepared_at, "2026-06-18T09:00:00.000Z", "prepared payload preparedAt");
assertEqual(preparedPayloads[0].p_sent_at, null, "prepared payload sentAt null");
assertEqual(preparedPayloads[0].p_delivered_at, null, "prepared payload deliveredAt null");
assertEqual(preparedPayloads[0].p_failed_at, null, "prepared payload failedAt null");
assertEqual(preparedPayloads[0].p_failure_reason, null, "prepared payload failureReason null");
assertDeepEqual(
  preparedPayloads[0].p_metadata,
  {
    reminderWindow: "14-day",
    complianceType: "dbs",
    expiryDate: "2026-07-15",
    source: "dry_run",
    emailMissing: false,
  },
  "prepared payload metadata preserves builder fields"
);
assertDeepEqual(JSON.parse(preparedSnapshot), preparedRecord, "prepared input record not mutated");

const successResult = await executeReminderDeliveries({
  records: [createTestRecord("prepared", { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })],
  provider: createMockEmailProvider({ mode: "success" }),
  transitionRecord: transitionReminderDeliveryRecord,
  now,
});

const deliveredRecord = {
  ...successResult.records[0],
  metadata: {
    ...successResult.records[0].metadata,
    provider: "mock",
    providerMessageId: "mock-delivered-123",
  },
};
const deliveredSnapshot = JSON.stringify(deliveredRecord);

const deliveredPayloads = buildDeliveryLogPayloads({
  records: [deliveredRecord],
  organisationId,
  automationRunId,
});

assertEqual(deliveredPayloads[0].p_delivery_status, "delivered", "delivered payload delivery status");
assertEqual(deliveredPayloads[0].p_sent_at, now, "delivered payload sentAt");
assertEqual(
  deliveredPayloads[0].p_delivered_at,
  deliveredRecord.deliveredAt,
  "delivered payload deliveredAt"
);
assertEqual(deliveredPayloads[0].p_metadata.provider, "mock", "delivered metadata preserves provider");
assertEqual(
  deliveredPayloads[0].p_metadata.providerMessageId,
  "mock-delivered-123",
  "delivered metadata preserves providerMessageId"
);
assertEqual(
  deliveredPayloads[0].p_metadata.statusHistory?.length,
  2,
  "delivered metadata preserves statusHistory"
);
assertEqual(
  deliveredPayloads[0].p_metadata.statusHistory?.at(-1)?.to,
  "delivered",
  "delivered metadata statusHistory ends at delivered"
);
assertDeepEqual(JSON.parse(deliveredSnapshot), deliveredRecord, "delivered input record not mutated");

const failedResult = await executeReminderDeliveries({
  records: [createTestRecord("prepared", { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" })],
  provider: createMockEmailProvider({ mode: "permanent_failure" }),
  transitionRecord: transitionReminderDeliveryRecord,
  now,
});

const failedRecord = {
  ...failedResult.records[0],
  metadata: {
    ...failedResult.records[0].metadata,
    provider: "mock",
    failureType: "permanent",
  },
};
const failedSnapshot = JSON.stringify(failedRecord);

const failedPayloads = buildDeliveryLogPayloads({
  records: [failedRecord],
  organisationId,
  automationRunId,
});

assertEqual(failedPayloads[0].p_delivery_status, "failed", "failed payload delivery status");
assertEqual(failedPayloads[0].p_failed_at, now, "failed payload failedAt");
assertEqual(
  failedPayloads[0].p_failure_reason,
  "mock_permanent_provider_error",
  "failed payload failureReason"
);
assertEqual(failedPayloads[0].p_metadata.failureType, "permanent", "failed metadata preserves failureType");
assertEqual(failedPayloads[0].p_metadata.provider, "mock", "failed metadata preserves provider");
assertDeepEqual(JSON.parse(failedSnapshot), failedRecord, "failed input record not mutated");

const mixedRecords = [
  createTestRecord("prepared", { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
  createTestRecord("failed", {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    failedAt: "2026-06-18T08:00:00.000Z",
    failureReason: "missing_recipient_email",
    recipientEmail: null,
    preparedAt: null,
    metadata: {
      reminderWindow: "14-day",
      complianceType: "dbs",
      expiryDate: "2026-07-15",
      source: "dry_run",
      emailMissing: true,
    },
  }),
];
const mixedSnapshots = mixedRecords.map((record) => JSON.stringify(record));

const mixedPayloads = buildDeliveryLogPayloads({
  records: mixedRecords,
  organisationId,
  automationRunId,
});

assertEqual(mixedPayloads.length, 2, "mixed records produce two payloads");
mixedPayloads.forEach((payload) => {
  assertKeys(payload, CREATE_REMINDER_DELIVERY_LOG_PAYLOAD_KEYS, "mixed payload RPC keys");
});
mixedSnapshots.forEach((snapshot, index) => {
  assertDeepEqual(JSON.parse(snapshot), mixedRecords[index], `mixed input record ${index} not mutated`);
});

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-delivery-worker-persistence: all checks OK");
