/**
 * V6 Phase 39: Browser invoke client for send-reminder-deliveries Edge Function.
 * Authenticated Edge Function invoke only — no Resend API key or direct Resend HTTP fetch.
 */

export const SEND_REMINDER_DELIVERIES_FUNCTION = "send-reminder-deliveries";

/**
 * @param {import("./reminder-delivery-record-builder.js").ReminderDeliveryRecord[]} records
 * @returns {Array<{
 *   queueItemId: string;
 *   recipientEmail: string | null;
 *   subject: string;
 *   bodyText: string;
 *   metadata?: Record<string, unknown>;
 * }>}
 */
export function mapDeliveryRecordsForEdgeInvoke(records) {
  return (Array.isArray(records) ? records : []).map((record) => ({
    queueItemId: record.queueItemId,
    recipientEmail: record.recipientEmail,
    subject: record.subject,
    bodyText: record.bodyText,
    metadata: record.metadata,
  }));
}

/**
 * @param {{
 *   supabase: import("@supabase/supabase-js").SupabaseClient;
 *   organisationId: string;
 *   automationRunId: string;
 *   deliveryRecords: ReturnType<typeof mapDeliveryRecordsForEdgeInvoke>;
 * }} input
 * @returns {Promise<{
 *   status?: string;
 *   summary?: {
 *     total?: number;
 *     attempted?: number;
 *     delivered?: number;
 *     failed?: number;
 *     skipped?: number;
 *   };
 *   results?: Array<Record<string, unknown>>;
 * }>}
 */
export async function invokeSendReminderDeliveries({
  supabase,
  organisationId,
  automationRunId,
  deliveryRecords,
}) {
  if (!supabase?.functions?.invoke) {
    throw new Error("Supabase client is required for Edge Function delivery invoke.");
  }

  const resolvedOrganisationId = String(organisationId ?? "").trim();
  const resolvedAutomationRunId = String(automationRunId ?? "").trim();

  if (!resolvedOrganisationId) {
    throw new Error("organisationId is required for Edge Function delivery invoke.");
  }

  if (!resolvedAutomationRunId) {
    throw new Error("automationRunId is required for Edge Function delivery invoke.");
  }

  const { data, error } = await supabase.functions.invoke(SEND_REMINDER_DELIVERIES_FUNCTION, {
    body: {
      organisationId: resolvedOrganisationId,
      automationRunId: resolvedAutomationRunId,
      deliveryRecords: Array.isArray(deliveryRecords) ? deliveryRecords : [],
    },
  });

  if (error) {
    throw new Error(error.message || "Edge Function invoke failed.");
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Edge Function returned an invalid response.");
  }

  if ("error" in data && data.error && !("summary" in data)) {
    throw new Error(String(data.error));
  }

  return /** @type {{ status?: string; summary?: Record<string, number>; results?: Array<Record<string, unknown>> }} */ (
    data
  );
}
