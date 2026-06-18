/**
 * V6 Phase 39: Manual delivery test execution coordinator.
 * Invokes send-reminder-deliveries Edge Function for admin-initiated tests only.
 *
 * Server-side Resend via authenticated Edge Function invoke — no browser Resend fetch,
 * no Resend API key in the browser, and no delivery log writes in this phase.
 *
 * No scheduling, reminder mark-sent automation, or compliance/history mutation.
 */

import {
  invokeSendReminderDeliveries,
  mapDeliveryRecordsForEdgeInvoke,
} from "./edge-delivery-invoke.js";
import { getEmailProviderConfig } from "./email-provider-config.js";
import { buildReminderDeliveryRecords } from "./reminder-delivery-record-builder.js";
import { EMAIL_PROVIDER_RUNTIME } from "../../data/email-provider-env.js";
import { getSupabaseClient } from "../../data/supabase-client.js";

export const MANUAL_DELIVERY_RUN_TYPE = "manual_delivery_test";
export const MANUAL_DELIVERY_RUN_SOURCE = "admin_manual_delivery_ui";

/** @type {import("./delivery-log-persistence-service.js").DeliveryLogPersistenceSummary} */
const EMPTY_PERSISTENCE_SUMMARY = {
  total: 0,
  persisted: 0,
  failed: 0,
};

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

  const providerConfig = getEmailProviderConfig(EMAIL_PROVIDER_RUNTIME);

  if (!providerConfig.enabled) {
    throw new Error("Email provider is not enabled for manual delivery tests.");
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
      providerMode: providerConfig.mode,
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

  return {
    deliveryRecords,
    executionSummary: mapEdgeResponseToExecutionSummary(edgeResponse, deliveryRecords.length),
    persistenceSummary: EMPTY_PERSISTENCE_SUMMARY,
    persistenceResults: [],
    edgeStatus: edgeResponse.status,
    edgeResults: edgeResponse.results,
  };
}
