/**
 * V6 Phase 30: Manual delivery pipeline runner verification.
 * Deterministic checks for queue → records → pipeline composition — no Supabase smoke,
 * browser, scheduler, app wiring, or mark-as-sent automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runManualDeliveryPipeline } from "../js/app/automation/manual-delivery-runner.js";
import { createMockEmailProvider } from "../js/app/automation/mock-email-provider.js";
import {
  REMINDER_QUEUE_SOURCE,
  REMINDER_QUEUE_STATUS,
} from "../js/app/automation/reminder-queue.js";
import { REMINDER_UI_LABELS } from "../js/data/reminder-sent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const runnerJs = readFileSync(
  join(root, "js/app/automation/manual-delivery-runner.js"),
  "utf8"
);
const appJs = readFileSync(join(root, "app.js"), "utf8");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");
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
 * @returns {import("../js/app/automation/reminder-queue.js").ReturnType<import("../js/app/automation/reminder-queue.js").buildReminderQueueFromDryRun>["items"][number]}
 */
function createPreparedQueueItem() {
  return {
    personName: "Alex Volunteer",
    complianceType: "DBS",
    expiryDate: "2026-07-15",
    reminderWindow: "14-day",
    reminderType: REMINDER_UI_LABELS[14],
    email: "alex.volunteer@example.com",
    emailMissing: false,
    status: REMINDER_QUEUE_STATUS,
    source: REMINDER_QUEUE_SOURCE,
    asOfDate: "2026-06-18",
    sent: false,
    delivered: false,
    markedSent: false,
    sentAt: null,
    deliveredAt: null,
    markedSentAt: null,
    failed: false,
    failureReason: null,
  };
}

/**
 * @returns {import("../js/app/automation/reminder-queue.js").ReturnType<import("../js/app/automation/reminder-queue.js").buildReminderQueueFromDryRun>["items"][number]}
 */
function createMissingEmailQueueItem() {
  return {
    personName: "Jordan Coordinator",
    complianceType: "Basic Awareness",
    expiryDate: "2026-06-25",
    reminderWindow: "7-day",
    reminderType: REMINDER_UI_LABELS[7],
    email: null,
    emailMissing: true,
    status: REMINDER_QUEUE_STATUS,
    source: REMINDER_QUEUE_SOURCE,
    asOfDate: "2026-06-18",
    sent: false,
    delivered: false,
    markedSent: false,
    sentAt: null,
    deliveredAt: null,
    markedSentAt: null,
    failed: false,
    failureReason: null,
  };
}

console.log("V6 Phase 30 manual delivery pipeline runner verification (verify-manual-delivery-runner)\n");

assertContains(packageJson, '"verify-manual-delivery-runner"', "package.json verify script");
assertContains(runnerJs, "export async function runManualDeliveryPipeline", "manual-delivery-runner export");
assertContains(runnerJs, "buildReminderDeliveryRecords", "manual runner builds delivery records");
assertContains(runnerJs, "runDeliveryPipeline", "manual runner invokes delivery pipeline");

const forbiddenNeedles = [
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "enqueue_reminder_notifications",
  "process_notification_queue",
  "history_entries",
  "add_default_actions",
  "setInterval",
  "setTimeout",
  "cron",
  "getSupabaseClient",
  "supabase.rpc",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(runnerJs, needle, `manual-delivery-runner.js has no ${needle}`);
}

for (const needle of ["setInterval", "setTimeout", "cron"]) {
  assertNotContains(runnerJs, needle, `manual-delivery-runner.js has no ${needle}`);
}

const organisationId = "11111111-1111-4111-8111-111111111111";
const automationRunId = "22222222-2222-4222-8222-222222222222";
const now = "2026-06-18T10:00:00.000Z";
const asOfDate = "2026-06-18";

const preparedItem = createPreparedQueueItem();
const missingEmailItem = createMissingEmailQueueItem();
const queueItems = [preparedItem, missingEmailItem];
const queueSnapshots = queueItems.map((item) => JSON.stringify(item));

let providerCallCount = 0;
const provider = {
  async sendReminder(input) {
    providerCallCount += 1;
    return createMockEmailProvider({ mode: "success" }).sendReminder(input);
  },
};

const persistCalls = [];

const db = {
  async createReminderDeliveryLog(payload) {
    persistCalls.push(payload);
    return {
      ok: true,
      log: {
        id: `log-${persistCalls.length}`,
        deliveryStatus: payload.p_delivery_status,
        createdAt: now,
      },
    };
  },
};

const result = await runManualDeliveryPipeline({
  queueItems,
  provider,
  db,
  organisationId,
  automationRunId,
  organisationName: "St Example Parish",
  asOfDate,
  now,
});

assertEqual(result.deliveryRecords.length, 2, "delivery records created for each queue item");
assertEqual(providerCallCount, 1, "pipeline executes provider for prepared record only");
assertEqual(persistCalls.length, 2, "pipeline persists one payload per delivery record");
assertEqual(result.deliveryRecords[0].deliveryStatus, "delivered", "prepared queue item ends delivered");
assertEqual(result.deliveryRecords[1].deliveryStatus, "failed", "missing-email queue item stays failed");
assertEqual(result.deliveryRecords[0].organisationId, organisationId, "delivery record organisationId");
assertEqual(result.deliveryRecords[0].automationRunId, automationRunId, "delivery record automationRunId");
assertDeepEqual(
  result.executionSummary,
  { total: 2, attempted: 1, delivered: 1, failed: 0, skipped: 1 },
  "execution summary returned"
);
assertDeepEqual(
  result.persistenceSummary,
  { total: 2, persisted: 2, failed: 0 },
  "persistence summary returned"
);
assertEqual(result.persistenceResults.length, 2, "persistence results returned");
assertEqual(result.persistenceResults[0].ok, true, "first persistence result ok");

queueSnapshots.forEach((snapshot, index) => {
  assertDeepEqual(JSON.parse(snapshot), queueItems[index], `queue item ${index} not mutated`);
});

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-manual-delivery-runner: all checks OK");
