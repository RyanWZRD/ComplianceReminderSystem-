/**
 * V6 Phase 22: Delivery Operations Log UI helpers.
 * Read-only display mapping for reminder_delivery_logs rows — no execution hooks.
 */

/** @typedef {import("../../data/reminder-delivery-logs.js").ReminderDeliveryLogView} ReminderDeliveryLogView */

export const DELIVERY_OPERATIONS_LOG_EMPTY_MESSAGE = "No delivery logs yet.";

export const DELIVERY_OPERATIONS_LOG_COLUMNS = [
  { key: "createdAt", label: "Created" },
  { key: "deliveryStatus", label: "Status" },
  { key: "recipientEmail", label: "Recipient" },
  { key: "subject", label: "Subject" },
  { key: "failureReason", label: "Failure reason" },
  { key: "providerMessageId", label: "Provider / message ID" },
  { key: "automationRunId", label: "Automation run" },
  { key: "actions", label: "" },
];

/**
 * @param {string | null | undefined} isoString
 * @returns {string}
 */
export function formatDeliveryLogTimestamp(isoString) {
  if (typeof isoString !== "string" || !isoString.trim()) {
    return "—";
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @param {object | null | undefined} metadata
 * @returns {string}
 */
export function formatDeliveryLogProviderMessageId(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "—";
  }

  const providerMessageId =
    typeof metadata.providerMessageId === "string" && metadata.providerMessageId.trim()
      ? metadata.providerMessageId.trim()
      : typeof metadata.provider_message_id === "string" && metadata.provider_message_id.trim()
        ? metadata.provider_message_id.trim()
        : "";

  if (providerMessageId) {
    return providerMessageId;
  }

  const provider =
    typeof metadata.provider === "string" && metadata.provider.trim() ? metadata.provider.trim() : "";

  return provider || "—";
}

/**
 * @param {ReminderDeliveryLogView} log
 * @returns {{
 *   id: string;
 *   createdAt: string;
 *   deliveryStatus: string;
 *   recipientEmail: string;
 *   subject: string;
 *   failureReason: string;
 *   providerMessageId: string;
 *   automationRunId: string;
 *   bodyText: string;
 *   metadataJson: string;
 *   preparedAt: string;
 *   sentAt: string;
 *   deliveredAt: string;
 *   failedAt: string;
 * }}
 */
export function mapDeliveryLogToOperationsRow(log) {
  return {
    id: log.id,
    createdAt: formatDeliveryLogTimestamp(log.createdAt),
    deliveryStatus:
      typeof log.deliveryStatus === "string" && log.deliveryStatus.trim()
        ? log.deliveryStatus
        : "—",
    recipientEmail:
      typeof log.recipientEmail === "string" && log.recipientEmail.trim()
        ? log.recipientEmail.trim()
        : "—",
    subject: typeof log.subject === "string" && log.subject.trim() ? log.subject : "—",
    failureReason:
      typeof log.failureReason === "string" && log.failureReason.trim()
        ? log.failureReason.trim()
        : "—",
    providerMessageId: formatDeliveryLogProviderMessageId(log.metadata),
    automationRunId:
      typeof log.automationRunId === "string" && log.automationRunId.trim()
        ? log.automationRunId
        : "—",
    bodyText: typeof log.bodyText === "string" ? log.bodyText : "",
    metadataJson: JSON.stringify(log.metadata ?? {}, null, 2),
    preparedAt: formatDeliveryLogTimestamp(log.preparedAt),
    sentAt: formatDeliveryLogTimestamp(log.sentAt),
    deliveredAt: formatDeliveryLogTimestamp(log.deliveredAt),
    failedAt: formatDeliveryLogTimestamp(log.failedAt),
  };
}

/**
 * @param {ReminderDeliveryLogView[]} logs
 * @returns {ReturnType<typeof mapDeliveryLogToOperationsRow>[]}
 */
export function mapDeliveryLogsToOperationsRows(logs) {
  if (!Array.isArray(logs)) {
    return [];
  }

  return logs.map((log) => mapDeliveryLogToOperationsRow(log));
}

/**
 * @param {ReminderDeliveryLogView[]} logs
 * @returns {{
 *   total: number;
 *   delivered: number;
 *   failed: number;
 *   preparedSendingCancelled: number;
 * }}
 */
export function computeDeliveryOperationsLogSummary(logs) {
  const entries = Array.isArray(logs) ? logs : [];

  let delivered = 0;
  let failed = 0;
  let preparedSendingCancelled = 0;

  for (const log of entries) {
    const status = String(log.deliveryStatus ?? "").toLowerCase();

    if (status === "delivered") {
      delivered += 1;
    } else if (status === "failed") {
      failed += 1;
    } else if (
      status === "prepared" ||
      status === "sending" ||
      status === "cancelled" ||
      status === "queued"
    ) {
      preparedSendingCancelled += 1;
    }
  }

  return {
    total: entries.length,
    delivered,
    failed,
    preparedSendingCancelled,
  };
}
