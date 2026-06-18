/**
 * V6 Phase 22: Delivery Operations Log CSV export.
 * Export-only — no email delivery, mark-sent, or compliance/action/history mutation.
 */

import { escapeCsvValue } from "../insights/insights-export.js";
import { formatDeliveryLogTimestamp } from "./delivery-operations-log-ui.js";

export const DELIVERY_OPERATIONS_LOG_EXPORT_COLUMNS = [
  { key: "status", label: "Status" },
  { key: "recipientEmail", label: "Recipient email" },
  { key: "subject", label: "Subject" },
  { key: "failureReason", label: "Failure reason" },
  { key: "createdAt", label: "Created at" },
  { key: "sentAt", label: "Sent at" },
  { key: "deliveredAt", label: "Delivered at" },
  { key: "failedAt", label: "Failed at" },
];

/**
 * @param {Date} [generatedAt]
 * @returns {string}
 */
export function getDeliveryOperationsLogExportFilename(generatedAt = new Date()) {
  const year = generatedAt.getFullYear();
  const month = String(generatedAt.getMonth() + 1).padStart(2, "0");
  const day = String(generatedAt.getDate()).padStart(2, "0");

  return `delivery-operations-log-${year}-${month}-${day}.csv`;
}

/**
 * @param {import("../../data/reminder-delivery-logs.js").ReminderDeliveryLogView} log
 * @returns {Record<string, string>}
 */
export function mapDeliveryLogToExportRow(log) {
  return {
    status: log.deliveryStatus || "",
    recipientEmail: log.recipientEmail || "",
    subject: log.subject || "",
    failureReason: log.failureReason || "",
    createdAt: formatDeliveryLogTimestamp(log.createdAt),
    sentAt: formatDeliveryLogTimestamp(log.sentAt),
    deliveredAt: formatDeliveryLogTimestamp(log.deliveredAt),
    failedAt: formatDeliveryLogTimestamp(log.failedAt),
  };
}

/**
 * @param {import("../../data/reminder-delivery-logs.js").ReminderDeliveryLogView[]} logs
 * @returns {string}
 */
export function buildDeliveryOperationsLogExportCsv(logs) {
  const entries = Array.isArray(logs) ? logs : [];
  const exportRows = entries.map((log) => mapDeliveryLogToExportRow(log));

  const headerRow = DELIVERY_OPERATIONS_LOG_EXPORT_COLUMNS.map((column) =>
    escapeCsvValue(column.label)
  ).join(",");

  const dataRows = exportRows.map((row) =>
    DELIVERY_OPERATIONS_LOG_EXPORT_COLUMNS.map((column) =>
      escapeCsvValue(row[column.key] ?? "")
    ).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}
