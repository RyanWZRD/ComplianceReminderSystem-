/**
 * V5-2 Phase 2: Reminder queue template preview UI helpers.
 * Read-only template preview mapping for queue rows — no delivery or writes.
 */

import { formatReminderExpiryDate } from "../reminders/reminder-templates.js";
import { formatReminderQueueWindowLabel } from "./reminder-queue-ui.js";

export const REMINDER_QUEUE_TEMPLATE_PREVIEW_SAFETY_NOTE =
  "Template preview only — no email is sent.";

export const REMINDER_QUEUE_TEMPLATE_PREVIEW_BUTTON_LABEL = "Preview template";

export const REMINDER_QUEUE_TEMPLATE_MISSING_EMAIL_WARNING =
  "No recipient email on file — a reminder could not be delivered until contact email is added.";

export const REMINDER_QUEUE_TEMPLATE_COPY_BUTTON_LABEL = "Copy template";

export const REMINDER_QUEUE_TEMPLATE_COPY_SUCCESS_MESSAGE = "Template copied.";

export const REMINDER_QUEUE_TEMPLATE_COPY_UNAVAILABLE_MESSAGE =
  "Copy is not available in this browser.";

/**
 * @param {{ subject: string; bodyText: string }} template
 * @returns {string}
 */
export function buildReminderQueueTemplateCopyText(template) {
  return `Subject: ${template.subject}\n\n${template.bodyText}`;
}

/**
 * @param {number} index
 * @returns {string}
 */
export function getReminderQueueTemplatePreviewRowKey(index) {
  return `queue-template-${index}`;
}

/**
 * @param {boolean} isExpanded
 * @returns {string}
 */
export function getReminderQueueTemplatePreviewButtonLabel(isExpanded) {
  return isExpanded ? "Hide template" : REMINDER_QUEUE_TEMPLATE_PREVIEW_BUTTON_LABEL;
}

/**
 * @param {import("./reminder-template-builder.js").ReminderEmailTemplateMetadata} metadata
 * @returns {{
 *   reminderWindow: string;
 *   complianceType: string;
 *   expiryDate: string;
 *   source: string;
 * }}
 */
export function mapReminderQueueTemplatePreviewMetadata(metadata) {
  return {
    reminderWindow: formatReminderQueueWindowLabel(metadata.reminderWindow),
    complianceType: metadata.complianceType || "—",
    expiryDate: formatReminderExpiryDate(metadata.expiryDate) || metadata.expiryDate || "—",
    source: metadata.source || "—",
  };
}
