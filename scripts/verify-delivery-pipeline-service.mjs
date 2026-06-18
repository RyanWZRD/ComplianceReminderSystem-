/**
 * V6 Phase 27: Delivery pipeline service verification.
 * Deterministic checks for execution + persistence composition — no Supabase smoke,
 * browser, app wiring, schedules, UI, or mark-as-sent automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runDeliveryPipeline } from "../js/app/automation/delivery-pipeline-service.js";
import { createMockEmailProvider } from "../js/app/automation/mock-email-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const pipelineJs = readFileSync(
  join(root, "js/app/automation/delivery-pipeline-service.js"),
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
  "V6 Phase 27 delivery pipeline service verification (verify-delivery-pipeline-service)\n"
);

assertContains(packageJson, '"verify-delivery-pipeline-service"', "package.json verify script");
assertContains(pipelineJs, "export async function runDeliveryPipeline", "pipeline export");
assertContains(pipelineJs, "executeReminderDeliveries", "pipeline calls execution worker");
assertContains(pipelineJs, "buildDeliveryLogPayloads", "pipeline calls payload builder");
assertContains(pipelineJs, "persistDeliveryLogPayloads", "pipeline calls persistence service");

const forbiddenNeedles = [
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "enqueue_reminder_notifications",
  "process_notification_queue",
  "history_entries",
  "add_default_actions",
  "getSupabaseClient",
  "supabase.rpc",
  "setInterval",
  "setTimeout",
  "cron",
  "schedule",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(pipelineJs, needle, `delivery-pipeline-service.js has no ${needle}`);
}

assertNotContains(appJs, "delivery-pipeline-service", "app.js is not wired to pipeline service");
assertNotContains(appJs, "runDeliveryPipeline", "app.js does not import runDeliveryPipeline");

for (const needle of ["Send reminder", "Retry delivery", "Execute delivery", "Run delivery pipeline"]) {
  assertNotContains(indexHtml, needle, `index.html has no ${needle}`);
}

const organisationId = "11111111-1111-4111-8111-111111111111";
const automationRunId = "22222222-2222-4222-8222-222222222222";
const now = "2026-06-18T10:00:00.000Z";

const preparedRecord = createTestRecord("prepared");
const skippedRecord = createTestRecord("delivered", {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sentAt: "2026-06-18T09:30:00.000Z",
  deliveredAt: "2026-06-18T09:35:00.000Z",
});
const inputRecords = [preparedRecord, skippedRecord];
const inputSnapshots = inputRecords.map((record) => JSON.stringify(record));

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

const successResult = await runDeliveryPipeline({
  records: inputRecords,
  provider,
  db,
  organisationId,
  automationRunId,
  now,
});

assertEqual(providerCallCount, 1, "execution worker runs provider for prepared record only");
assertEqual(persistCalls.length, 2, "persistence service persists one payload per executed record");
assertEqual(
  persistCalls[0].p_organisation_id,
  organisationId,
  "payload builder applies organisationId"
);
assertEqual(
  persistCalls[0].p_automation_run_id,
  automationRunId,
  "payload builder applies automationRunId"
);
assertEqual(successResult.records[0].deliveryStatus, "delivered", "pipeline returns executed records");
assertDeepEqual(
  successResult.executionSummary,
  { total: 2, attempted: 1, delivered: 1, failed: 0, skipped: 1 },
  "pipeline returns execution summary"
);
assertDeepEqual(
  successResult.persistenceSummary,
  { total: 2, persisted: 2, failed: 0 },
  "pipeline returns persistence summary"
);
assertEqual(successResult.persistenceResults.length, 2, "pipeline returns persistence results");
assertEqual(successResult.persistenceResults[0].ok, true, "first persistence result ok");

inputSnapshots.forEach((snapshot, index) => {
  assertDeepEqual(JSON.parse(snapshot), inputRecords[index], `input record ${index} not mutated`);
});

const partialPrepared = createTestRecord("prepared", {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  queueItemId: "jordan|dbs|2026-07-15|14-day|2026-06-18|partial-fail",
});
const partialOk = createTestRecord("prepared", {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  queueItemId: "jordan|dbs|2026-07-15|14-day|2026-06-18|partial-ok",
});
const partialSnapshots = [JSON.stringify(partialPrepared), JSON.stringify(partialOk)];

const partialDb = {
  async createReminderDeliveryLog(payload) {
    if (payload.p_queue_item_id.includes("partial-fail")) {
      return { ok: false, error: "Organisation mismatch" };
    }

    return {
      ok: true,
      log: {
        id: "log-partial-ok",
        deliveryStatus: payload.p_delivery_status,
        createdAt: now,
      },
    };
  },
};

const partialResult = await runDeliveryPipeline({
  records: [partialPrepared, partialOk],
  provider: createMockEmailProvider({ mode: "success" }),
  db: partialDb,
  organisationId,
  automationRunId,
  now,
});

assertDeepEqual(
  partialResult.executionSummary,
  { total: 2, attempted: 2, delivered: 2, failed: 0, skipped: 0 },
  "partial persistence still completes execution summary"
);
assertDeepEqual(
  partialResult.persistenceSummary,
  { total: 2, persisted: 1, failed: 1 },
  "partial persistence failure summary"
);
assertEqual(partialResult.persistenceResults[0].ok, false, "partial persistence first result failed");
assertEqual(
  partialResult.persistenceResults[0].error,
  "Organisation mismatch",
  "partial persistence failure surfaced"
);
assertEqual(partialResult.persistenceResults[1].ok, true, "partial persistence second result ok");

partialSnapshots.forEach((snapshot, index) => {
  assertDeepEqual(
    JSON.parse(snapshot),
    [partialPrepared, partialOk][index],
    `partial failure input record ${index} not mutated`
  );
});

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-delivery-pipeline-service: all checks OK");
