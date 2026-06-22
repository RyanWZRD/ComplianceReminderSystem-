/**
 * V6 Phase 39/41/41c: Browser invoke client for send-reminder-deliveries Edge Function.
 * Authenticated direct fetch to /functions/v1 — no Resend API key or direct Resend HTTP fetch.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../data/supabase-env.js";

export const SEND_REMINDER_DELIVERIES_FUNCTION = "send-reminder-deliveries";

/**
 * @returns {string}
 */
export function buildSendReminderDeliveriesUrl() {
  const baseUrl = String(SUPABASE_URL ?? "").trim().replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("SUPABASE_URL is required for Edge Function delivery invoke.");
  }

  return `${baseUrl}/functions/v1/${SEND_REMINDER_DELIVERIES_FUNCTION}`;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {Promise<string>}
 */
async function resolveInvokeAccessToken(supabase) {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message || "Could not read Supabase session for Edge Function invoke.");
  }

  const accessToken = String(data?.session?.access_token ?? "").trim();

  if (!accessToken) {
    throw new Error("Active Supabase session access_token is required for Edge Function delivery invoke.");
  }

  return accessToken;
}

/**
 * @param {string} accessToken
 * @returns {Record<string, string>}
 */
export function buildEdgeDeliveryInvokeHeaders(accessToken) {
  const resolvedToken = String(accessToken ?? "").trim();
  const anonKey = String(SUPABASE_ANON_KEY ?? "").trim();

  if (!resolvedToken) {
    throw new Error("Active Supabase session access_token is required for Edge Function delivery invoke.");
  }

  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY is required for Edge Function delivery invoke.");
  }

  return {
    apikey: anonKey,
    Authorization: `Bearer ${resolvedToken}`,
    "Content-Type": "application/json",
  };
}

/**
 * @param {HeadersInit} headers
 * @returns {{ authorization: string; token: string }}
 */
export function assertEdgeDeliveryInvokeHeaders(headers) {
  const normalized = new Headers(headers);
  const authorization = String(normalized.get("Authorization") ?? "").trim();

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Edge Function invoke request is missing Authorization Bearer header.");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new Error("Edge Function invoke request has empty Bearer access_token.");
  }

  if (!String(normalized.get("apikey") ?? "").trim()) {
    throw new Error("Edge Function invoke request is missing apikey header.");
  }

  return { authorization, token };
}

/**
 * @param {import("./reminder-delivery-record-builder.js").ReminderDeliveryRecord[]} records
 * @returns {Array<{
 *   queueItemId: string;
 *   recipientEmail: string | null;
 *   subject: string;
 *   bodyText: string;
 *   complianceRecordId?: string | null;
 *   metadata?: Record<string, unknown>;
 * }>}
 */
export function mapDeliveryRecordsForEdgeInvoke(records) {
  return (Array.isArray(records) ? records : []).map((record) => ({
    queueItemId: record.queueItemId,
    recipientEmail: record.recipientEmail,
    subject: record.subject,
    bodyText: record.bodyText,
    complianceRecordId: record.complianceRecordId ?? null,
    metadata: record.metadata,
  }));
}

/**
 * @param {Response} response
 * @returns {Promise<never>}
 */
async function throwEdgeFunctionHttpError(response) {
  let message = `Edge Function invoke failed with status ${response.status}.`;

  try {
    const body = await response.json();

    if (body && typeof body === "object") {
      const record = /** @type {Record<string, unknown>} */ (body);
      const detail = record.message ?? record.error ?? record.code;

      if (detail) {
        message = String(detail);
      }
    }
  } catch {
    const text = await response.text().catch(() => "");

    if (text.trim()) {
      message = text.trim();
    }
  }

  throw new Error(message);
}

/**
 * @param {{
 *   supabase: import("@supabase/supabase-js").SupabaseClient;
 *   organisationId: string;
 *   automationRunId: string;
 *   deliveryRecords: ReturnType<typeof mapDeliveryRecordsForEdgeInvoke>;
 *   fetchImpl?: typeof fetch;
 * }} input
 * @returns {Promise<{
 *   status?: string;
 *   summary?: {
 *     total?: number;
 *     attempted?: number;
 *     delivered?: number;
 *     failed?: number;
 *     skipped?: number;
 *     persisted?: number;
 *     persistFailed?: number;
 *     markSent?: number;
 *     markSentFailed?: number;
 *     markSentSkipped?: number;
 *   };
 *   results?: Array<Record<string, unknown>>;
 * }>}
 */
export async function invokeSendReminderDeliveries({
  supabase,
  organisationId,
  automationRunId,
  deliveryRecords,
  fetchImpl = fetch,
}) {
  if (!supabase?.auth?.getSession) {
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

  const accessToken = await resolveInvokeAccessToken(supabase);
  const headers = buildEdgeDeliveryInvokeHeaders(accessToken);
  assertEdgeDeliveryInvokeHeaders(headers);

  const response = await fetchImpl(buildSendReminderDeliveriesUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      organisationId: resolvedOrganisationId,
      automationRunId: resolvedAutomationRunId,
      deliveryRecords: Array.isArray(deliveryRecords) ? deliveryRecords : [],
    }),
  });

  if (!response.ok) {
    await throwEdgeFunctionHttpError(response);
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Edge Function returned an invalid response.");
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
