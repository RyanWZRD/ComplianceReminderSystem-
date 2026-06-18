/**
 * V6 Phase 27: Delivery pipeline service.
 * Composes delivery execution, payload mapping, and log persistence.
 * Service composition only — no app wiring, scheduling, UI, or mark-as-sent.
 */

import { persistDeliveryLogPayloads } from "./delivery-log-persistence-service.js";
import { executeReminderDeliveries } from "./delivery-worker.js";
import { buildDeliveryLogPayloads } from "./delivery-worker-persistence.js";

/**
 * @typedef {import("./delivery-worker.js").ReminderDeliveryRecord} ReminderDeliveryRecord
 * @typedef {import("./delivery-worker.js").DeliveryExecutionSummary} DeliveryExecutionSummary
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
    throw new Error("runDeliveryPipeline requires organisationId.");
  }

  return resolved;
}

/**
 * Run delivery execution and persist resulting delivery logs.
 *
 * @param {{
 *   records: ReminderDeliveryRecord[];
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
 *   automationRunId?: string | null;
 *   now?: string | null;
 * }} input
 * @returns {Promise<{
 *   records: ReminderDeliveryRecord[];
 *   executionSummary: DeliveryExecutionSummary;
 *   persistenceSummary: DeliveryLogPersistenceSummary;
 *   persistenceResults: DeliveryLogPersistenceResult[];
 * }>}
 */
export async function runDeliveryPipeline({
  records,
  provider,
  db,
  organisationId,
  automationRunId,
  now,
}) {
  const resolvedOrganisationId = resolveOrganisationId(organisationId);

  if (!provider || typeof provider.sendReminder !== "function") {
    throw new Error("runDeliveryPipeline requires provider with sendReminder.");
  }

  if (!db || typeof db.createReminderDeliveryLog !== "function") {
    throw new Error("runDeliveryPipeline requires db with createReminderDeliveryLog.");
  }

  const executed = await executeReminderDeliveries({
    records,
    provider,
    now,
  });

  const payloads = buildDeliveryLogPayloads({
    records: executed.records,
    organisationId: resolvedOrganisationId,
    automationRunId,
  });

  const persisted = await persistDeliveryLogPayloads({
    db,
    payloads,
  });

  return {
    records: executed.records,
    executionSummary: executed.summary,
    persistenceSummary: persisted.summary,
    persistenceResults: persisted.results,
  };
}
