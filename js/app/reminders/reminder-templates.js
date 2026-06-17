/**
 * Read-only reminder email template preview (V5-1B Phase 1).
 * Generates subject/body copy for preview only — no sending, queue, or automation.
 */

import { normalizePersonContactFields } from "../../data/email.js";
import { parseDateAtMidnight } from "../../data/dates.js";
import { REMINDER_UI_LABELS } from "../../data/reminder-sent.js";

/** Default organisation label when none is supplied. */
export const DEFAULT_ORGANISATION_NAME = "Compliance Reminder System";

/** Supported reminder types for template preview. */
export const REMINDER_TEMPLATE_TYPES = [
  REMINDER_UI_LABELS[30],
  REMINDER_UI_LABELS[14],
  REMINDER_UI_LABELS[7],
  REMINDER_UI_LABELS.expired,
];

/** @typedef {typeof REMINDER_TEMPLATE_TYPES[number]} ReminderTemplateType */

/**
 * @typedef {object} ReminderTemplatePreviewInput
 * @property {string} personName
 * @property {string} complianceType
 * @property {string} expiryDate — ISO date (YYYY-MM-DD)
 * @property {ReminderTemplateType} reminderType
 * @property {string | null | undefined} [recipientEmail]
 * @property {string | null | undefined} [managerEmail]
 * @property {string | null | undefined} [organisationName]
 */

/**
 * @typedef {object} ReminderTemplatePreview
 * @property {string} subject
 * @property {string} body
 * @property {string | null} recipientEmail
 * @property {string | null} managerEmail
 * @property {ReminderTemplateType} reminderType
 * @property {string} complianceType
 * @property {string} expiryDate
 */

/**
 * @param {string} reminderType
 * @returns {reminderType is ReminderTemplateType}
 */
export function isSupportedReminderTemplateType(reminderType) {
  return REMINDER_TEMPLATE_TYPES.includes(reminderType);
}

/**
 * Format expiry date for reminder copy (matches register en-GB display).
 *
 * @param {string} dateString
 * @returns {string}
 */
export function formatReminderExpiryDate(dateString) {
  const date = parseDateAtMidnight(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * @param {ReminderTemplateType} reminderType
 * @returns {{ subjectLead: string; windowLine: string }}
 */
function getReminderWindowCopy(reminderType) {
  if (reminderType === REMINDER_UI_LABELS[30]) {
    return {
      subjectLead: "30-day reminder",
      windowLine: "This compliance item expires within 30 days.",
    };
  }

  if (reminderType === REMINDER_UI_LABELS[14]) {
    return {
      subjectLead: "14-day reminder",
      windowLine: "This compliance item expires within 14 days.",
    };
  }

  if (reminderType === REMINDER_UI_LABELS[7]) {
    return {
      subjectLead: "7-day reminder",
      windowLine: "This compliance item expires within 7 days.",
    };
  }

  return {
    subjectLead: "Expired compliance",
    windowLine: "This compliance item has expired and requires renewal.",
  };
}

/**
 * Build read-only reminder email preview content.
 *
 * @param {ReminderTemplatePreviewInput} input
 * @returns {ReminderTemplatePreview}
 */
export function buildReminderTemplatePreview(input) {
  const personName = String(input.personName ?? "").trim();
  const complianceType = String(input.complianceType ?? "").trim();
  const expiryDate = String(input.expiryDate ?? "").trim();
  const reminderType = input.reminderType;
  const organisationName =
    String(input.organisationName ?? "").trim() || DEFAULT_ORGANISATION_NAME;

  if (!personName || !complianceType || !expiryDate) {
    throw new Error("personName, complianceType, and expiryDate are required.");
  }

  if (!isSupportedReminderTemplateType(reminderType)) {
    throw new Error(`Unsupported reminderType: ${reminderType}`);
  }

  const { email, managerEmail } = normalizePersonContactFields({
    email: input.recipientEmail,
    managerEmail: input.managerEmail,
  });

  const formattedExpiry = formatReminderExpiryDate(expiryDate);
  const { subjectLead, windowLine } = getReminderWindowCopy(reminderType);

  const subject = `${subjectLead}: ${complianceType} — ${personName}`;

  const bodyLines = [
    `Dear ${personName},`,
    "",
    windowLine,
    "",
    `Compliance type: ${complianceType}`,
    `Expiry date: ${formattedExpiry}`,
    "",
    "Please review this record and arrange renewal or follow-up as required.",
    "",
    organisationName,
  ];

  if (managerEmail) {
    bodyLines.push(
      "",
      `Manager contact on file: ${managerEmail} (for your reference — not copied on this preview).`
    );
  }

  bodyLines.push(
    "",
    "This is a preview of reminder content. No email has been sent."
  );

  return {
    subject,
    body: bodyLines.join("\n"),
    recipientEmail: email || null,
    managerEmail: managerEmail || null,
    reminderType,
    complianceType,
    expiryDate,
  };
}

/**
 * Build preview from a flattened compliance row and explicit reminder type.
 *
 * @param {import("../insights/insights-engine.js").NormalizedComplianceRow} row
 * @param {ReminderTemplateType} reminderType
 * @param {{ organisationName?: string | null }} [options]
 * @returns {ReminderTemplatePreview}
 */
export function buildReminderTemplatePreviewFromRow(row, reminderType, options = {}) {
  const contact = normalizePersonContactFields(row);

  return buildReminderTemplatePreview({
    personName: row.name,
    complianceType: row.complianceType,
    expiryDate: row.expiryDate,
    reminderType,
    recipientEmail: contact.email,
    managerEmail: contact.managerEmail,
    organisationName: options.organisationName,
  });
}
