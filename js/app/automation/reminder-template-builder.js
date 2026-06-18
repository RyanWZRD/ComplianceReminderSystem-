/**
 * V5-2 Phase 1: Reminder email template builder.
 * Builds subject/body from reminder queue items — template generation only.
 * No email sending, mark-as-sent, compliance/action mutation, or history writes.
 */

import {
  DEFAULT_ORGANISATION_NAME,
  formatReminderExpiryDate,
} from "../reminders/reminder-templates.js";
import { REMINDER_UI_LABELS } from "../../data/reminder-sent.js";

/**
 * @typedef {import("./reminder-queue.js").ReturnType<import("./reminder-queue.js").buildReminderQueueFromDryRun>["items"][number]} ReminderQueueItem
 */

/**
 * @typedef {Object} ReminderEmailTemplateInput
 * @property {ReminderQueueItem} queueItem
 * @property {string | null | undefined} [organisationName]
 * @property {string | null | undefined} [contactName]
 */

/**
 * @typedef {Object} ReminderEmailTemplateMetadata
 * @property {string} source
 * @property {string} reminderWindow
 * @property {string} complianceType
 * @property {string} expiryDate
 */

/**
 * @typedef {Object} ReminderEmailTemplate
 * @property {string} subject
 * @property {string} bodyText
 * @property {ReminderEmailTemplateMetadata} metadata
 * @property {boolean} emailMissing
 */

/**
 * @param {string} reminderWindow
 * @param {string} reminderType
 * @returns {{ subjectLead: string; windowLine: string; actionLine: string }}
 */
function getReminderWindowCopy(reminderWindow, reminderType) {
  if (reminderWindow === "expired" || reminderType === REMINDER_UI_LABELS.expired) {
    return {
      subjectLead: "Expired compliance",
      windowLine: "This compliance item has expired and requires renewal.",
      actionLine:
        "Please renew this compliance record urgently and update the register once renewal is complete.",
    };
  }

  if (reminderWindow === "30-day" || reminderType === REMINDER_UI_LABELS[30]) {
    return {
      subjectLead: "30-day reminder",
      windowLine: "This compliance item expires within 30 days.",
      actionLine:
        "Please review this record and arrange renewal or follow-up before the expiry date.",
    };
  }

  if (reminderWindow === "14-day" || reminderType === REMINDER_UI_LABELS[14]) {
    return {
      subjectLead: "14-day reminder",
      windowLine: "This compliance item expires within 14 days.",
      actionLine:
        "Please review this record and arrange renewal or follow-up before the expiry date.",
    };
  }

  if (reminderWindow === "7-day" || reminderType === REMINDER_UI_LABELS[7]) {
    return {
      subjectLead: "7-day reminder",
      windowLine: "This compliance item expires within 7 days.",
      actionLine:
        "Please review this record and arrange renewal or follow-up before the expiry date.",
    };
  }

  return {
    subjectLead: "Compliance reminder",
    windowLine: "This compliance item needs your attention.",
    actionLine: "Please review this record and arrange renewal or follow-up as required.",
  };
}

/**
 * Build reusable reminder email content from a queue item (no delivery or writes).
 *
 * @param {ReminderEmailTemplateInput} input
 * @returns {ReminderEmailTemplate}
 */
export function buildReminderEmailTemplate({ queueItem, organisationName, contactName }) {
  if (!queueItem || typeof queueItem !== "object") {
    throw new Error("queueItem is required.");
  }

  const recordName = String(queueItem.personName ?? "").trim();
  const salutationName = String(contactName ?? recordName).trim();
  const complianceType = String(queueItem.complianceType ?? "").trim();
  const expiryDate = String(queueItem.expiryDate ?? "").trim();
  const reminderWindow = String(queueItem.reminderWindow ?? "").trim();
  const reminderType = String(queueItem.reminderType ?? "").trim();
  const source = String(queueItem.source ?? "").trim();
  const resolvedOrganisation =
    String(organisationName ?? "").trim() || DEFAULT_ORGANISATION_NAME;

  if (!recordName || !complianceType || !expiryDate) {
    throw new Error("queueItem must include personName, complianceType, and expiryDate.");
  }

  if (!salutationName) {
    throw new Error("contactName or queueItem.personName is required for the greeting.");
  }

  const formattedExpiry = formatReminderExpiryDate(expiryDate);
  const { subjectLead, windowLine, actionLine } = getReminderWindowCopy(
    reminderWindow,
    reminderType
  );

  const subject = `${subjectLead}: ${complianceType} — ${recordName}`;

  const bodyLines = [
    `Dear ${salutationName},`,
    "",
    windowLine,
    "",
    `Compliance type: ${complianceType}`,
    `Expiry date: ${formattedExpiry}`,
    `Reminder window: ${reminderWindow || reminderType}`,
    "",
    actionLine,
    "",
    "If you have already renewed this item, please ensure the compliance register is up to date.",
    "",
    resolvedOrganisation,
    "",
    "This is a reminder queue template preview. No email has been sent.",
  ];

  const emailMissing = queueItem.emailMissing === true || queueItem.email == null;

  return {
    subject,
    bodyText: bodyLines.join("\n"),
    metadata: {
      source,
      reminderWindow: reminderWindow || reminderType,
      complianceType,
      expiryDate,
    },
    emailMissing,
  };
}
