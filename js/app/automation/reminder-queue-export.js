/**
 * V5-1 Phase 3: Reminder queue preview CSV export.
 * Export-only — no email delivery, mark-sent, or compliance/action/history mutation.
 */

import { escapeCsvValue } from "../insights/insights-export.js";
import {
  REMINDER_QUEUE_STATUS,
  REMINDER_QUEUE_SOURCE,
} from "./reminder-queue.js";
import { formatReminderQueueWindowLabel } from "./reminder-queue-ui.js";

export const REMINDER_QUEUE_EXPORT_EMAIL_MISSING_YES = "Yes";
export const REMINDER_QUEUE_EXPORT_EMAIL_MISSING_NO = "No";

export const REMINDER_QUEUE_EXPORT_COLUMNS = [
  { key: "personName", label: "Person name" },
  { key: "complianceType", label: "Compliance type" },
  { key: "expiryDate", label: "Expiry date" },
  { key: "reminderWindow", label: "Reminder window/type" },
  { key: "email", label: "Email" },
  { key: "emailMissing", label: "Email missing" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "asOfDate", label: "As of date" },
];

/**
 * @param {string} [asOfDate]
 * @param {Date} [generatedAt]
 * @returns {string}
 */
export function getReminderQueueExportFilename(asOfDate, generatedAt = new Date()) {
  const scanDate =
    typeof asOfDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate.trim())
      ? asOfDate.trim()
      : formatReminderQueueExportDate(generatedAt);

  return `reminder-queue-preview-${scanDate}.csv`;
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function formatReminderQueueExportDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * @param {{
 *   personName: string;
 *   complianceType: string;
 *   expiryDate: string;
 *   reminderWindow: string;
 *   email: string | null;
 *   emailMissing: boolean;
 *   status: string;
 *   source: string;
 *   asOfDate: string;
 * }} item
 * @param {(dateString: string) => string} [formatExpiryDate]
 * @returns {Record<string, string>}
 */
export function mapReminderQueueItemToExportRow(item, formatExpiryDate) {
  const formatDate =
    typeof formatExpiryDate === "function"
      ? formatExpiryDate
      : (dateString) => dateString;

  const emailMissing = item.emailMissing === true || item.email === null;
  const email = emailMissing ? "" : String(item.email || "").trim();

  return {
    personName: item.personName || "",
    complianceType: item.complianceType || "",
    expiryDate: formatDate(item.expiryDate),
    reminderWindow: formatReminderQueueWindowLabel(item.reminderWindow),
    email,
    emailMissing: emailMissing
      ? REMINDER_QUEUE_EXPORT_EMAIL_MISSING_YES
      : REMINDER_QUEUE_EXPORT_EMAIL_MISSING_NO,
    status: item.status || REMINDER_QUEUE_STATUS,
    source: item.source || REMINDER_QUEUE_SOURCE,
    asOfDate: item.asOfDate || "",
  };
}

/**
 * @param {{
 *   asOfDate: string;
 *   items: object[];
 * }} queue
 * @param {(dateString: string) => string} [formatExpiryDate]
 * @returns {string}
 */
export function buildReminderQueueExportCsv(queue, formatExpiryDate) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const exportRows = items.map((item) => mapReminderQueueItemToExportRow(item, formatExpiryDate));

  const headerRow = REMINDER_QUEUE_EXPORT_COLUMNS.map((column) =>
    escapeCsvValue(column.label)
  ).join(",");

  const dataRows = exportRows.map((row) =>
    REMINDER_QUEUE_EXPORT_COLUMNS.map((column) => escapeCsvValue(row[column.key] ?? "")).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}
