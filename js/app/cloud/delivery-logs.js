/**
 * V6 Phase 65: Read-only cloud helpers for reminder_delivery_logs visibility.
 * Direct SELECT only — RLS enforces org access.
 */

import {
  getOrganisationId,
  isAuthenticated,
  waitForAuthReady,
} from "../../auth/session.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../data/supabase-client.js";

const DELIVERY_LOG_SELECT_COLUMNS = [
  "id",
  "organisation_id",
  "automation_run_id",
  "compliance_record_id",
  "person_id",
  "recipient_email",
  "recipient_name",
  "compliance_type",
  "reminder_type",
  "due_date",
  "delivery_status",
  "provider",
  "provider_message_id",
  "error_code",
  "error_message",
  "payload",
  "created_at",
  "sent_at",
].join(", ");

const PAYLOAD_SAFE_KEYS = [
  "mode",
  "reason",
  "asOfDate",
  "duplicateOfDeliveryLogId",
  "duplicatePrevented",
  "organisationName",
  "complianceType",
  "reminderType",
  "personId",
  "recordId",
];

/**
 * @typedef {Object} DeliveryLogVisibilityView
 * @property {string} id
 * @property {string} organisationId
 * @property {string | null} automationRunId
 * @property {string | null} complianceRecordId
 * @property {string | null} personId
 * @property {string | null} recipientEmail
 * @property {string | null} recipientName
 * @property {string | null} complianceType
 * @property {string | null} reminderType
 * @property {string | null} dueDate
 * @property {string} deliveryStatus
 * @property {string | null} provider
 * @property {string | null} providerMessageId
 * @property {string | null} errorCode
 * @property {string | null} errorMessage
 * @property {object} payload
 * @property {object} safePayload
 * @property {string} createdAt
 * @property {string | null} sentAt
 */

/**
 * @typedef {Object} DeliveryLogsLoadResult
 * @property {boolean} ok
 * @property {DeliveryLogVisibilityView[]} [logs]
 * @property {Error | string} [error]
 */

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function toNullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * @param {unknown} payload
 * @returns {object}
 */
export function sanitizePayloadForDisplay(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  /** @type {Record<string, unknown>} */
  const safe = {};

  for (const key of PAYLOAD_SAFE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const value = payload[key];

      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        safe[key] = value;
      }
    }
  }

  return safe;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {DeliveryLogVisibilityView}
 */
export function mapDeliveryLogFromRow(row) {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload
      : {};

  return {
    id: String(row.id ?? ""),
    organisationId: String(row.organisation_id ?? ""),
    automationRunId: toNullableString(row.automation_run_id),
    complianceRecordId: toNullableString(row.compliance_record_id),
    personId: toNullableString(row.person_id),
    recipientEmail: toNullableString(row.recipient_email),
    recipientName: toNullableString(row.recipient_name),
    complianceType: toNullableString(row.compliance_type),
    reminderType: toNullableString(row.reminder_type),
    dueDate: toNullableString(row.due_date),
    deliveryStatus: typeof row.delivery_status === "string" ? row.delivery_status : "",
    provider: toNullableString(row.provider),
    providerMessageId: toNullableString(row.provider_message_id),
    errorCode: toNullableString(row.error_code),
    errorMessage: toNullableString(row.error_message),
    payload,
    safePayload: sanitizePayloadForDisplay(payload),
    createdAt: String(row.created_at ?? ""),
    sentAt: toNullableString(row.sent_at),
  };
}

/**
 * @param {{ organisationId?: string; automationRunId?: string | null; limit?: number }} [options]
 * @returns {Promise<DeliveryLogsLoadResult>}
 */
export async function loadDeliveryLogs(options = {}) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is not configured. Run npm run sync-env after setting .env.",
    };
  }

  await waitForAuthReady();

  if (!isAuthenticated()) {
    return { ok: false, error: "Not signed in. Sign in before loading delivery logs." };
  }

  const sessionOrganisationId = getOrganisationId();
  const organisationId = options.organisationId ?? sessionOrganisationId;

  if (!organisationId) {
    return { ok: false, error: "No organisation on the current session profile." };
  }

  if (sessionOrganisationId && organisationId !== sessionOrganisationId) {
    return { ok: false, error: "Organisation mismatch for delivery log read." };
  }

  const limit = typeof options.limit === "number" && options.limit > 0 ? options.limit : 100;

  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("reminder_delivery_logs")
      .select(DELIVERY_LOG_SELECT_COLUMNS)
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.automationRunId) {
      query = query.eq("automation_run_id", options.automationRunId);
    }

    const { data, error } = await query;

    if (error) {
      return { ok: false, error: error.message };
    }

    const logs = (data ?? []).map((row) => mapDeliveryLogFromRow(row));

    return { ok: true, logs };
  } catch (error) {
    const loadError = error instanceof Error ? error : new Error(String(error));
    return { ok: false, error: loadError };
  }
}
