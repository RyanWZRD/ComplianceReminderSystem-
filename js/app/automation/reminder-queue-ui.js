/**
 * V5-1 Phase 2: Reminder queue preview UI helpers.
 * Read-only display mapping for dry-run queue items — no execution hooks.
 */

import { REMINDER_UI_LABELS } from "../../data/reminder-sent.js";
import {
  REMINDER_QUEUE_SOURCE,
  REMINDER_QUEUE_STATUS,
} from "./reminder-queue.js";

export const REMINDER_QUEUE_PREVIEW_SAFETY_NOTE =
  "Preview only — no reminders are sent.";

export const REMINDER_QUEUE_PREVIEW_EMPTY_MESSAGE =
  "No reminder queue items for this scan.";

export const REMINDER_QUEUE_MISSING_EMAIL_LABEL = "Missing email";

export const REMINDER_QUEUE_PREVIEW_COLUMNS = [
  { key: "personName", label: "Person name" },
  { key: "complianceType", label: "Compliance type" },
  { key: "expiryDate", label: "Expiry date" },
  { key: "reminderWindow", label: "Reminder window" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
];

const REMINDER_WINDOW_LABELS = {
  "30-day": REMINDER_UI_LABELS[30],
  "14-day": REMINDER_UI_LABELS[14],
  "7-day": REMINDER_UI_LABELS[7],
  expired: REMINDER_UI_LABELS.expired,
};

/**
 * @param {string} reminderWindow
 * @returns {string}
 */
export function formatReminderQueueWindowLabel(reminderWindow) {
  if (typeof reminderWindow !== "string" || !reminderWindow.trim()) {
    return "—";
  }

  return REMINDER_WINDOW_LABELS[reminderWindow] ?? reminderWindow;
}

/**
 * @param {{
 *   personName: string;
 *   complianceType: string;
 *   expiryDate: string;
 *   reminderWindow: string;
 *   reminderType: string;
 *   email: string | null;
 *   emailMissing: boolean;
 *   status: string;
 *   source: string;
 * }} item
 * @param {(dateString: string) => string} [formatExpiryDate]
 * @returns {{
 *   personName: string;
 *   complianceType: string;
 *   expiryDate: string;
 *   reminderWindow: string;
 *   email: string;
 *   emailMissing: boolean;
 *   status: string;
 *   source: string;
 * }}
 */
export function mapReminderQueueItemToPreviewRow(item, formatExpiryDate) {
  const formatDate =
    typeof formatExpiryDate === "function"
      ? formatExpiryDate
      : (dateString) => dateString;

  const emailMissing = item.emailMissing === true || item.email === null;
  const email = emailMissing
    ? REMINDER_QUEUE_MISSING_EMAIL_LABEL
    : String(item.email || "").trim() || REMINDER_QUEUE_MISSING_EMAIL_LABEL;

  return {
    personName: item.personName || "—",
    complianceType: item.complianceType || "—",
    expiryDate: formatDate(item.expiryDate),
    reminderWindow: formatReminderQueueWindowLabel(item.reminderWindow),
    email,
    emailMissing,
    status: item.status || REMINDER_QUEUE_STATUS,
    source: item.source || REMINDER_QUEUE_SOURCE,
  };
}

/**
 * @param {object[]} items
 * @param {(dateString: string) => string} [formatExpiryDate]
 * @returns {ReturnType<typeof mapReminderQueueItemToPreviewRow>[]}
 */
export function mapReminderQueueItemsToPreviewRows(items, formatExpiryDate) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => mapReminderQueueItemToPreviewRow(item, formatExpiryDate));
}
