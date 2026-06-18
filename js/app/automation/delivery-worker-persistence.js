/**
 * V6 Phase 25: Delivery worker persistence adapter.
 * Maps delivery worker records to create_reminder_delivery_log RPC payloads.
 * Mapping only — no provider calls, RPC execution, database writes, or app wiring.
 */

/**
 * @typedef {import("./reminder-delivery-state-machine.js").ReminderDeliveryRecord & {
 *   complianceRecordId?: string | null;
 *   personId?: string | null;
 * }} PersistableReminderDeliveryRecord
 */

/**
 * @typedef {Object} CreateReminderDeliveryLogPayload
 * @property {string} p_organisation_id
 * @property {string | null} p_automation_run_id
 * @property {string} p_queue_item_id
 * @property {string | null} p_compliance_record_id
 * @property {string | null} p_person_id
 * @property {string | null} p_recipient_email
 * @property {string} p_subject
 * @property {string} p_body_text
 * @property {string} p_delivery_status
 * @property {string | null} p_prepared_at
 * @property {string | null} p_sent_at
 * @property {string | null} p_delivered_at
 * @property {string | null} p_failed_at
 * @property {string | null} p_failure_reason
 * @property {Record<string, unknown>} p_metadata
 */

/** @type {readonly (keyof CreateReminderDeliveryLogPayload)[]} */
export const CREATE_REMINDER_DELIVERY_LOG_PAYLOAD_KEYS = [
  "p_organisation_id",
  "p_automation_run_id",
  "p_queue_item_id",
  "p_compliance_record_id",
  "p_person_id",
  "p_recipient_email",
  "p_subject",
  "p_body_text",
  "p_delivery_status",
  "p_prepared_at",
  "p_sent_at",
  "p_delivered_at",
  "p_failed_at",
  "p_failure_reason",
  "p_metadata",
];

/** @type {readonly string[]} */
const PRESERVED_METADATA_KEYS = [
  "providerMessageId",
  "provider",
  "failureType",
  "reminderWindow",
  "complianceType",
  "expiryDate",
  "source",
  "emailMissing",
];

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
function resolveOptionalId(value) {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
function resolveOptionalText(value) {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
}

/**
 * @param {string | null | undefined} organisationId
 * @param {string | null | undefined} recordOrganisationId
 * @returns {string}
 */
function resolveOrganisationId(organisationId, recordOrganisationId) {
  const resolved = resolveOptionalId(organisationId) ?? resolveOptionalId(recordOrganisationId);

  if (!resolved) {
    throw new Error("buildDeliveryLogPayloads requires organisationId.");
  }

  return resolved;
}

/**
 * @param {PersistableReminderDeliveryRecord} record
 * @returns {Record<string, unknown>}
 */
function buildDeliveryLogMetadata(record) {
  const base =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? record.metadata
      : {};

  /** @type {Record<string, unknown>} */
  const metadata = {};

  for (const key of PRESERVED_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(base, key)) {
      metadata[key] = base[key];
    }
  }

  const statusHistory = Array.isArray(record.statusHistory)
    ? record.statusHistory
    : Array.isArray(base.statusHistory)
      ? base.statusHistory
      : null;

  if (statusHistory && statusHistory.length > 0) {
    metadata.statusHistory = statusHistory.map((entry) =>
      entry && typeof entry === "object" ? { ...entry } : entry
    );
  }

  return metadata;
}

/**
 * @param {PersistableReminderDeliveryRecord} record
 * @param {string} organisationId
 * @param {string | null} automationRunId
 * @returns {CreateReminderDeliveryLogPayload}
 */
function buildDeliveryLogPayload(record, organisationId, automationRunId) {
  const resolvedAutomationRunId =
    automationRunId ?? resolveOptionalId(record.automationRunId);

  return {
    p_organisation_id: organisationId,
    p_automation_run_id: resolvedAutomationRunId,
    p_queue_item_id: String(record.queueItemId ?? "").trim(),
    p_compliance_record_id: resolveOptionalId(record.complianceRecordId),
    p_person_id: resolveOptionalId(record.personId),
    p_recipient_email: resolveOptionalText(record.recipientEmail),
    p_subject: String(record.subject ?? "").trim(),
    p_body_text: String(record.bodyText ?? "").trim(),
    p_delivery_status: String(record.deliveryStatus ?? "").trim(),
    p_prepared_at: resolveOptionalText(record.preparedAt),
    p_sent_at: resolveOptionalText(record.sentAt),
    p_delivered_at: resolveOptionalText(record.deliveredAt),
    p_failed_at: resolveOptionalText(record.failedAt),
    p_failure_reason: resolveOptionalText(record.failureReason),
    p_metadata: buildDeliveryLogMetadata(record),
  };
}

/**
 * Map delivery worker records to create_reminder_delivery_log RPC payloads.
 *
 * @param {{
 *   records: PersistableReminderDeliveryRecord[];
 *   organisationId: string;
 *   automationRunId?: string | null;
 * }} input
 * @returns {CreateReminderDeliveryLogPayload[]}
 */
export function buildDeliveryLogPayloads({ records, organisationId, automationRunId }) {
  const inputRecords = Array.isArray(records) ? records : [];
  const resolvedOrganisationId = resolveOrganisationId(organisationId, null);
  const resolvedAutomationRunId = resolveOptionalId(automationRunId);

  return inputRecords.map((record) =>
    buildDeliveryLogPayload(
      record,
      resolvedOrganisationId,
      resolvedAutomationRunId ?? resolveOptionalId(record.automationRunId)
    )
  );
}
