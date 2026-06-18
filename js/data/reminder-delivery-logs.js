/**
 * Reminder delivery log mapping (cloud RPC).
 */

/**
 * @typedef {Object} ReminderDeliveryLogView
 * @property {string} id
 * @property {string} organisationId
 * @property {string | null} automationRunId
 * @property {string} queueItemId
 * @property {string | null} complianceRecordId
 * @property {string | null} personId
 * @property {string | null} recipientEmail
 * @property {string} subject
 * @property {string} bodyText
 * @property {string} deliveryStatus
 * @property {string | null} preparedAt
 * @property {string | null} sentAt
 * @property {string | null} deliveredAt
 * @property {string | null} failedAt
 * @property {string | null} failureReason
 * @property {object} metadata
 * @property {string | null} createdBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {{
 *   id: string;
 *   organisation_id: string;
 *   automation_run_id?: string | null;
 *   queue_item_id: string;
 *   compliance_record_id?: string | null;
 *   person_id?: string | null;
 *   recipient_email?: string | null;
 *   subject: string;
 *   body_text: string;
 *   delivery_status: string;
 *   prepared_at?: string | null;
 *   sent_at?: string | null;
 *   delivered_at?: string | null;
 *   failed_at?: string | null;
 *   failure_reason?: string | null;
 *   metadata?: object;
 *   created_by?: string | null;
 *   created_at: string;
 *   updated_at: string;
 * }} row
 * @returns {ReminderDeliveryLogView}
 */
export function mapReminderDeliveryLogFromRpc(row) {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    automationRunId: row.automation_run_id ?? null,
    queueItemId: row.queue_item_id,
    complianceRecordId: row.compliance_record_id ?? null,
    personId: row.person_id ?? null,
    recipientEmail: row.recipient_email ?? null,
    subject: row.subject,
    bodyText: row.body_text,
    deliveryStatus: row.delivery_status,
    preparedAt: row.prepared_at ?? null,
    sentAt: row.sent_at ?? null,
    deliveredAt: row.delivered_at ?? null,
    failedAt: row.failed_at ?? null,
    failureReason: row.failure_reason ?? null,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : {},
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
