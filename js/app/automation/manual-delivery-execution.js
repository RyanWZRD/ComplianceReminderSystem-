/**
 * V6 Phase 42: Manual delivery test execution coordinator.
 * Invokes send-reminder-deliveries Edge Function for admin-initiated tests only.
 *
 * Server-side Resend + delivery log persistence via Edge Function — no browser Resend fetch,
 * no Resend API key in the browser, and no browser-side delivery log RPC writes.
 *
 * No scheduling, reminder mark-sent automation, or compliance/history mutation.
 */

import {
  invokeSendReminderDeliveries,
  mapDeliveryRecordsForEdgeInvoke,
} from "./edge-delivery-invoke.js";
import { buildReminderDeliveryRecords } from "./reminder-delivery-record-builder.js";
import { getSupabaseClient } from "../../data/supabase-client.js";

export const MANUAL_DELIVERY_RUN_TYPE = "manual_delivery_test";
export const MANUAL_DELIVERY_RUN_SOURCE = "admin_manual_delivery_ui";

/**
 * @param {Record<string, unknown>} edgeResponse
 * @param {number} recordCount
 * @returns {import("./delivery-log-persistence-service.js").DeliveryLogPersistenceSummary}
 */
function mapEdgeResponseToPersistenceSummary(edgeResponse, recordCount) {
  const summary =
    edgeResponse.summary && typeof edgeResponse.summary === "object"
      ? /** @type {Record<string, unknown>} */ (edgeResponse.summary)
      : {};

  const total = Number(summary.total ?? recordCount);
  const persisted = Number(summary.persisted ?? 0);
  const persistFailed = Number(summary.persistFailed ?? Math.max(0, total - persisted));

  return {
    total,
    persisted,
    failed: persistFailed,
  };
}

/**
 * @param {Record<string, unknown>} edgeResponse
 * @param {number} recordCount
 * @returns {import("./delivery-worker.js").DeliveryExecutionSummary}
 */
function mapEdgeResponseToExecutionSummary(edgeResponse, recordCount) {
  const summary =
    edgeResponse.summary && typeof edgeResponse.summary === "object"
      ? /** @type {Record<string, unknown>} */ (edgeResponse.summary)
      : {};

  return {
    total: Number(summary.total ?? recordCount),
    attempted: Number(summary.attempted ?? 0),
    delivered: Number(summary.delivered ?? 0),
    failed: Number(summary.failed ?? 0),
    skipped: Number(summary.skipped ?? 0),
  };
}

/**
 * @param {{
 *   queueItems: import("./reminder-queue.js").ReturnType<import("./reminder-queue.js").buildReminderQueueFromDryRun>["items"];
 *   db: {
 *     createAutomationRun: (input?: object) => Promise<{ ok: boolean; run?: { id: string }; error?: string }>;
 *   };
 *   organisationId: string;
 *   organisationName?: string | null;
 *   asOfDate?: string | null;
 *   now?: string | null;
 *   supabase?: import("@supabase/supabase-js").SupabaseClient;
 * }} input
 */
export async function executeManualDeliveryTest({
  queueItems,
  db,
  organisationId,
  organisationName,
  asOfDate,
  supabase,
}) {
  if (!db || typeof db.createAutomationRun !== "function") {
    throw new Error("Manual delivery test requires an automation store with createAutomationRun.");
  }

  const resolvedOrganisationId = String(organisationId ?? "").trim();

  if (!resolvedOrganisationId) {
    throw new Error("Manual delivery test requires organisationId.");
  }

  const runResult = await db.createAutomationRun({
    status: "completed",
    summary: {
      runType: MANUAL_DELIVERY_RUN_TYPE,
      source: MANUAL_DELIVERY_RUN_SOURCE,
      organisationId: resolvedOrganisationId,
      queueItemCount: Array.isArray(queueItems) ? queueItems.length : 0,
      providerMode: "edge_function",
      deliveryPath: "edge_function",
    },
  });

  if (!runResult.ok || !runResult.run?.id) {
    throw new Error(runResult.error ?? "Could not create automation run for manual delivery test.");
  }

  const deliveryRecords = buildReminderDeliveryRecords({
    queueItems,
    organisationId: resolvedOrganisationId,
    automationRunId: runResult.run.id,
    organisationName,
    asOfDate,
  });

  const edgeRecords = mapDeliveryRecordsForEdgeInvoke(deliveryRecords);
  const client = supabase ?? getSupabaseClient();

  const edgeResponse = await invokeSendReminderDeliveries({
    supabase: client,
    organisationId: resolvedOrganisationId,
    automationRunId: runResult.run.id,
    deliveryRecords: edgeRecords,
  });

  const persistenceSummary = mapEdgeResponseToPersistenceSummary(
    edgeResponse,
    deliveryRecords.length,
  );

  return {
    deliveryRecords,
    executionSummary: mapEdgeResponseToExecutionSummary(edgeResponse, deliveryRecords.length),
    persistenceSummary,
    persistenceResults: Array.isArray(edgeResponse.results) ? edgeResponse.results : [],
    edgeStatus: edgeResponse.status,
    edgeResults: edgeResponse.results,
  };
}
