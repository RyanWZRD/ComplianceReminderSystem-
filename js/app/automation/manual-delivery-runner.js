/**
 * V6 Phase 30: Manual delivery pipeline runner.
 * Manually invoked end-to-end path: queue items → delivery records → pipeline.
 * Service layer only — no timed or recurring execution, app wiring, or mark-as-sent automation.
 */

import { runDeliveryPipeline } from "./delivery-pipeline-service.js";
import { buildReminderDeliveryRecords } from "./reminder-delivery-record-builder.js";

/**
 * @typedef {import("./reminder-delivery-record-builder.js").ReminderDeliveryRecord} ReminderDeliveryRecord
 * @typedef {import("./reminder-queue.js").ReturnType<import("./reminder-queue.js").buildReminderQueueFromDryRun>["items"][number]} ReminderQueueItem
 * @typedef {import("./delivery-pipeline-service.js").DeliveryExecutionSummary} DeliveryExecutionSummary
 * @typedef {import("./delivery-log-persistence-service.js").DeliveryLogPersistenceResult} DeliveryLogPersistenceResult
 * @typedef {import("./delivery-log-persistence-service.js").DeliveryLogPersistenceSummary} DeliveryLogPersistenceSummary
 */

/**
 * @param {string | null | undefined} organisationId
 * @returns {string}
 */
function resolveOrganisationId(organisationId) {
  const resolved = String(organisationId ?? "").trim();

  if (!resolved) {
    throw new Error("runManualDeliveryPipeline requires organisationId.");
  }

  return resolved;
}

/**
 * @param {string | null | undefined} automationRunId
 * @returns {string}
 */
function resolveAutomationRunId(automationRunId) {
  const resolved = String(automationRunId ?? "").trim();

  if (!resolved) {
    throw new Error("runManualDeliveryPipeline requires automationRunId.");
  }

  return resolved;
}

/**
 * Run the delivery pipeline manually from reminder queue items.
 *
 * @param {{
 *   queueItems: ReminderQueueItem[];
 *   provider: {
 *     sendReminder: (input: {
 *       to: string;
 *       subject: string;
 *       bodyText: string;
 *       metadata?: Record<string, unknown>;
 *     }) => Promise<
 *       | { status: "delivered"; providerMessageId?: string; deliveredAt?: string }
 *       | { status: "failed"; failureType?: string; failureReason: string }
 *     >;
 *   };
 *   db: {
 *     createReminderDeliveryLog: (
 *       payload: import("./delivery-worker-persistence.js").CreateReminderDeliveryLogPayload
 *     ) => Promise<
 *       | { ok: true; log: { id: string; deliveryStatus: string; createdAt: string } }
 *       | { ok: false; error: string }
 *     >;
 *   };
 *   organisationId: string;
 *   automationRunId: string;
 *   organisationName?: string | null;
 *   asOfDate?: string | null;
 *   now?: string | null;
 * }} input
 * @returns {Promise<{
 *   deliveryRecords: ReminderDeliveryRecord[];
 *   executionSummary: DeliveryExecutionSummary;
 *   persistenceSummary: DeliveryLogPersistenceSummary;
 *   persistenceResults: DeliveryLogPersistenceResult[];
 * }>}
 */
export async function runManualDeliveryPipeline({
  queueItems,
  provider,
  db,
  organisationId,
  automationRunId,
  organisationName,
  asOfDate,
  now,
}) {
  const resolvedOrganisationId = resolveOrganisationId(organisationId);
  const resolvedAutomationRunId = resolveAutomationRunId(automationRunId);

  if (!provider || typeof provider.sendReminder !== "function") {
    throw new Error("runManualDeliveryPipeline requires provider with sendReminder.");
  }

  if (!db || typeof db.createReminderDeliveryLog !== "function") {
    throw new Error("runManualDeliveryPipeline requires db with createReminderDeliveryLog.");
  }

  const deliveryRecords = buildReminderDeliveryRecords({
    queueItems,
    organisationId: resolvedOrganisationId,
    automationRunId: resolvedAutomationRunId,
    organisationName,
    asOfDate,
  });

  const pipelineResult = await runDeliveryPipeline({
    records: deliveryRecords,
    provider,
    db,
    organisationId: resolvedOrganisationId,
    automationRunId: resolvedAutomationRunId,
    now,
  });

  return {
    deliveryRecords: pipelineResult.records,
    executionSummary: pipelineResult.executionSummary,
    persistenceSummary: pipelineResult.persistenceSummary,
    persistenceResults: pipelineResult.persistenceResults,
  };
}
