/**
 * V6 Phase 2: Reminder delivery record builder verification.
 * Deterministic checks for in-memory delivery record preparation — no Supabase,
 * browser, email provider, delivery execution, or database writes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import { buildReminderDeliveryRecords } from "../js/app/automation/reminder-delivery-record-builder.js";
import { buildReminderEmailTemplate } from "../js/app/automation/reminder-template-builder.js";
import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";
import {
  EXPECTED_REMINDER_QUEUE_SUMMARY,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const builderJs = readFileSync(
  join(root, "js/app/automation/reminder-delivery-record-builder.js"),
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

function assertKeys(object, keys, label) {
  const actualKeys = Object.keys(object).sort();
  const expectedKeys = [...keys].sort();

  if (actualKeys.join(",") !== expectedKeys.join(",")) {
    fail(`${label}: expected keys [${expectedKeys.join(", ")}], got [${actualKeys.join(", ")}]`);
  }
}

console.log(
  "V6 Phase 2 reminder delivery record builder verification (verify-reminder-delivery-record-builder)\n"
);

assertContains(
  builderJs,
  "export function buildReminderDeliveryRecords",
  "reminder-delivery-record-builder module export"
);
assertContains(
  builderJs,
  "buildReminderEmailTemplate",
  "delivery record builder uses template builder"
);
assertContains(
  packageJson,
  '"verify-reminder-delivery-record-builder"',
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
];

for (const needle of forbiddenNeedles) {
  assertNotContains(builderJs, needle, `reminder-delivery-record-builder.js has no ${needle}`);
}

const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const queue = buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assert(queue.items.length > 0, "fixture queue has items");

const queueSnapshot = JSON.stringify(queue.items);
const organisationId = "11111111-1111-4111-8111-111111111111";
const automationRunId = "22222222-2222-4222-8222-222222222222";

const records = buildReminderDeliveryRecords({
  queueItems: queue.items,
  organisationId,
  automationRunId,
  organisationName: "St Example Parish",
  asOfDate: FIXTURE_AS_OF_DATE,
});

assertDeepEqual(JSON.parse(queueSnapshot), queue.items, "input queue items not mutated");
assertEqual(records.length, queue.items.length, "one delivery record per queue item");

const recordShapeKeys = [
  "id",
  "organisationId",
  "automationRunId",
  "queueItemId",
  "recipientEmail",
  "subject",
  "bodyText",
  "deliveryStatus",
  "preparedAt",
  "sentAt",
  "deliveredAt",
  "failedAt",
  "failureReason",
  "metadata",
];

const metadataShapeKeys = [
  "reminderWindow",
  "complianceType",
  "expiryDate",
  "source",
  "emailMissing",
];

const preparedRecords = records.filter((record) => record.deliveryStatus === "prepared");
const failedRecords = records.filter((record) => record.deliveryStatus === "failed");

assertEqual(preparedRecords.length, 0, "fixture queue has no prepared records (all missing email)");
assertEqual(
  failedRecords.length,
  EXPECTED_REMINDER_QUEUE_SUMMARY.missingEmail,
  "failed record count matches missingEmail summary"
);
assertEqual(failedRecords.length, records.length, "all fixture records failed (missing email)");

records.forEach((record, index) => {
  const queueItem = queue.items[index];

  assertKeys(record, recordShapeKeys, `record ${index} shape`);
  assertKeys(record.metadata, metadataShapeKeys, `record ${index} metadata shape`);

  assert(typeof record.id === "string" && record.id.length > 0, `record ${index} has id`);
  assertEqual(record.organisationId, organisationId, `record ${index} organisationId`);
  assertEqual(record.automationRunId, automationRunId, `record ${index} automationRunId`);
  assert(typeof record.queueItemId === "string" && record.queueItemId.length > 0, `record ${index} queueItemId`);

  const template = buildReminderEmailTemplate({
    queueItem,
    organisationName: "St Example Parish",
  });

  assertEqual(record.subject, template.subject, `record ${index} subject from template`);
  assertEqual(record.bodyText, template.bodyText, `record ${index} bodyText from template`);
  assertEqual(record.metadata.reminderWindow, template.metadata.reminderWindow, `record ${index} metadata.reminderWindow`);
  assertEqual(record.metadata.complianceType, template.metadata.complianceType, `record ${index} metadata.complianceType`);
  assertEqual(record.metadata.expiryDate, template.metadata.expiryDate, `record ${index} metadata.expiryDate`);
  assertEqual(record.metadata.source, template.metadata.source, `record ${index} metadata.source`);
  assertEqual(record.metadata.emailMissing, template.emailMissing, `record ${index} metadata.emailMissing`);

  assertEqual(record.sentAt, null, `record ${index} sentAt null`);
  assertEqual(record.deliveredAt, null, `record ${index} deliveredAt null`);

  if (template.emailMissing) {
    assertEqual(record.deliveryStatus, "failed", `record ${index} failed when email missing`);
    assertEqual(record.recipientEmail, null, `record ${index} recipientEmail null when missing`);
    assertEqual(record.preparedAt, null, `record ${index} preparedAt null when failed`);
    assertEqual(record.failedAt, `${FIXTURE_AS_OF_DATE}T12:00:00.000Z`, `record ${index} failedAt from asOfDate`);
    assertEqual(record.failureReason, "missing_recipient_email", `record ${index} failureReason`);
  } else {
    assertEqual(record.deliveryStatus, "prepared", `record ${index} prepared when email present`);
    assert(typeof record.recipientEmail === "string" && record.recipientEmail.length > 0, `record ${index} recipientEmail set`);
    assertEqual(record.preparedAt, `${FIXTURE_AS_OF_DATE}T12:00:00.000Z`, `record ${index} preparedAt from asOfDate`);
    assertEqual(record.failedAt, null, `record ${index} failedAt null when prepared`);
    assertEqual(record.failureReason, null, `record ${index} failureReason null when prepared`);
  }
});

const expiredItem = queue.items.find((item) => item.reminderWindow === "expired");
const upcomingItem = queue.items.find((item) => item.reminderWindow === "14-day");

assert(expiredItem, "fixture includes expired queue item");
assert(upcomingItem, "fixture includes upcoming queue item");

const expiredRecord = records.find(
  (record) => record.metadata.reminderWindow === "expired"
);
const upcomingRecord = records.find(
  (record) => record.metadata.reminderWindow === "14-day"
);

assert(expiredRecord, "delivery record for expired queue item");
assert(upcomingRecord, "delivery record for 14-day queue item");

assertEqual(expiredRecord.deliveryStatus, "failed", "expired fixture record failed (missing email)");
assertEqual(expiredRecord.failureReason, "missing_recipient_email", "expired fixture missing_recipient_email");
assertEqual(upcomingRecord.deliveryStatus, "failed", "14-day fixture record failed (missing email)");
assertContains(upcomingRecord.subject, "14-day reminder", "failed record subject still from template");
assertContains(upcomingRecord.bodyText, upcomingItem.personName, "failed record body still from template");

const withEmailQueue = buildReminderQueueFromDryRun({
  dryRunResult: computeAutomationDryRun(
    [
      {
        ...LOCAL_FIXTURE_ROWS[1],
        email: "jordan.coordinator@example.com",
      },
    ],
    FIXTURE_SETTINGS,
    FIXTURE_AS_OF_DATE
  ),
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: [
    {
      ...LOCAL_FIXTURE_ROWS[1],
      email: "jordan.coordinator@example.com",
    },
  ],
  settings: FIXTURE_SETTINGS,
});

const withEmailSnapshot = JSON.stringify(withEmailQueue.items);
const withEmailRecords = buildReminderDeliveryRecords({
  queueItems: withEmailQueue.items,
  organisationId,
  automationRunId,
  organisationName: "St Example Parish",
  asOfDate: FIXTURE_AS_OF_DATE,
});

assertDeepEqual(JSON.parse(withEmailSnapshot), withEmailQueue.items, "with-email queue not mutated");
assertEqual(withEmailRecords.length, 1, "one record for with-email queue item");

const preparedRecord = withEmailRecords[0];

assertEqual(preparedRecord.deliveryStatus, "prepared", "with-email record prepared");
assertEqual(preparedRecord.recipientEmail, "jordan.coordinator@example.com", "with-email recipientEmail");
assertEqual(preparedRecord.preparedAt, `${FIXTURE_AS_OF_DATE}T12:00:00.000Z`, "with-email preparedAt");
assertEqual(preparedRecord.failedAt, null, "with-email failedAt null");
assertEqual(preparedRecord.failureReason, null, "with-email failureReason null");
assertEqual(preparedRecord.metadata.emailMissing, false, "with-email metadata.emailMissing false");
assertContains(preparedRecord.subject, "14-day reminder", "with-email subject from template");
assertContains(preparedRecord.bodyText, withEmailQueue.items[0].personName, "with-email body from template");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-delivery-record-builder: all checks OK");
