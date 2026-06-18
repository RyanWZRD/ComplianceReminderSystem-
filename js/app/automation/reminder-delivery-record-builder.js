/**
 * V6 Phase 2: Reminder delivery record builder.
 * Builds in-memory delivery records from reminder queue items and templates.
 * Record preparation only — no email provider, delivery, mark-as-sent, or database writes.
 */

import { buildReminderEmailTemplate } from "./reminder-template-builder.js";

/**
 * @typedef {import("./reminder-queue.js").ReturnType<import("./reminder-queue.js").buildReminderQueueFromDryRun>["items"][number]} ReminderQueueItem
 */

/**
 * @typedef {"queued" | "prepared" | "sending" | "delivered" | "failed" | "cancelled"} DeliveryStatus
 */

/**
 * @typedef {Object} ReminderDeliveryRecordMetadata
 * @property {string} reminderWindow
 * @property {string} complianceType
 * @property {string} expiryDate
 * @property {string} source
 * @property {boolean} emailMissing
 */

/**
 * @typedef {Object} ReminderDeliveryRecord
 * @property {string} id
 * @property {string} organisationId
 * @property {string} automationRunId
 * @property {string} queueItemId
 * @property {string | null} recipientEmail
 * @property {string} subject
 * @property {string} bodyText
 * @property {DeliveryStatus} deliveryStatus
 * @property {string | null} preparedAt
 * @property {string | null} sentAt
 * @property {string | null} deliveredAt
 * @property {string | null} failedAt
 * @property {string | null} failureReason
 * @property {ReminderDeliveryRecordMetadata} metadata
 */

const MISSING_RECIPIENT_EMAIL_REASON = "missing_recipient_email";

/**
 * @returns {string}
 */
function createDeliveryRecordId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  throw new Error("crypto.randomUUID is not available.");
}

/**
 * @param {ReminderQueueItem} queueItem
 * @returns {string}
 */
function deriveQueueItemId(queueItem) {
  const existingId = queueItem?.id;

  if (existingId != null && String(existingId).trim()) {
    return String(existingId).trim();
  }

  return [
    queueItem.personName,
    queueItem.complianceType,
    queueItem.expiryDate,
    queueItem.reminderWindow,
    queueItem.asOfDate,
  ]
    .map((value) => String(value ?? "").trim())
    .join("|");
}

/**
 * @param {string} asOfDate
 * @returns {string}
 */
function resolveRecordTimestamp(asOfDate) {
  const resolvedAsOfDate = String(asOfDate ?? "").trim();

  if (resolvedAsOfDate) {
    return `${resolvedAsOfDate}T12:00:00.000Z`;
  }

  return new Date().toISOString();
}

/**
 * Build in-memory reminder delivery records from queue items (no delivery or writes).
 *
 * @param {{
 *   queueItems: ReminderQueueItem[];
 *   organisationId: string;
 *   automationRunId: string;
 *   organisationName?: string | null;
 *   asOfDate?: string | null;
 * }} input
 * @returns {ReminderDeliveryRecord[]}
 */
export function buildReminderDeliveryRecords({
  queueItems,
  organisationId,
  automationRunId,
  organisationName,
  asOfDate,
}) {
  const inputItems = Array.isArray(queueItems) ? queueItems : [];
  const resolvedOrganisationId = String(organisationId ?? "").trim();
  const resolvedAutomationRunId = String(automationRunId ?? "").trim();
  const recordTimestamp = resolveRecordTimestamp(asOfDate);

  return inputItems.map((queueItem) => {
    const template = buildReminderEmailTemplate({
      queueItem,
      organisationName,
    });

    const queueItemId = deriveQueueItemId(queueItem);
    const emailMissing = template.emailMissing;

    const metadata = {
      reminderWindow: template.metadata.reminderWindow,
      complianceType: template.metadata.complianceType,
      expiryDate: template.metadata.expiryDate,
      source: template.metadata.source,
      emailMissing,
    };

    if (emailMissing) {
      return {
        id: createDeliveryRecordId(),
        organisationId: resolvedOrganisationId,
        automationRunId: resolvedAutomationRunId,
        queueItemId,
        recipientEmail: null,
        subject: template.subject,
        bodyText: template.bodyText,
        deliveryStatus: "failed",
        preparedAt: null,
        sentAt: null,
        deliveredAt: null,
        failedAt: recordTimestamp,
        failureReason: MISSING_RECIPIENT_EMAIL_REASON,
        metadata,
      };
    }

    return {
      id: createDeliveryRecordId(),
      organisationId: resolvedOrganisationId,
      automationRunId: resolvedAutomationRunId,
      queueItemId,
      recipientEmail: String(queueItem.email ?? "").trim(),
      subject: template.subject,
      bodyText: template.bodyText,
      deliveryStatus: "prepared",
      preparedAt: recordTimestamp,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      failureReason: null,
      metadata,
    };
  });
}
