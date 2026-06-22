/**
 * V6 Phase 53: Reminder email template framework.
 * Plain-text subject/body generation and preview only — no email sending,
 * provider integration, delivery status changes, or database writes.
 */

import {
  DEFAULT_ORGANISATION_NAME,
} from "../reminders/reminder-templates.js";
import { parseDateAtMidnight } from "../../data/dates.js";

/** Supported template token names (plain-text replacement). */
export const REMINDER_EMAIL_TEMPLATE_TOKENS = [
  "recipientName",
  "personName",
  "complianceType",
  "reminderType",
  "dueDate",
  "organisationName",
  "contactName",
];

const FALLBACK_RECIPIENT_NAME = "there";
const FALLBACK_PERSON_NAME = "team member";
const FALLBACK_COMPLIANCE_TYPE = "compliance item";
const FALLBACK_REMINDER_TYPE = "reminder";
const FALLBACK_DUE_DATE_ISO = "date not set";
const FALLBACK_DUE_DATE_TEXT = "a date not set";

const REMINDER_EMAIL_SUBJECT_TEMPLATE =
  "Reminder: {{complianceType}} expires on {{dueDate}}";

const REMINDER_EMAIL_BODY_TEMPLATE = [
  "Hello {{recipientName}},",
  "",
  "This is a reminder that {{personName}}'s {{complianceType}} is due to expire on {{dueDate}}.",
  "",
  "Please arrange renewal or update the compliance record once complete.",
  "",
  "Thank you,",
  "{{organisationName}}",
].join("\n");

/**
 * @typedef {Object} ReminderEmailTemplateOptions
 * @property {string | null | undefined} [organisationName]
 * @property {string | null | undefined} [contactName]
 * @property {string | null | undefined} [recipientName]
 * @property {string | null | undefined} [personName]
 */

/**
 * @typedef {Record<(typeof REMINDER_EMAIL_TEMPLATE_TOKENS)[number], string>} ReminderEmailTemplateTokenMap
 */

/**
 * @typedef {Object} ReminderEmailPreview
 * @property {string} subject
 * @property {string} bodyText
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

/**
 * @param {object | null | undefined} candidate
 * @param {string[]} keys
 * @param {string | null | undefined} [optionValue]
 * @returns {string}
 */
function resolveCandidateField(candidate, keys, optionValue) {
  const optionText = normalizeText(optionValue);

  if (optionText) {
    return optionText;
  }

  if (!candidate || typeof candidate !== "object") {
    return "";
  }

  for (const key of keys) {
    const value = normalizeText(candidate[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * @param {string} rawDueDate
 * @returns {string}
 */
function resolveDueDateIso(rawDueDate) {
  const dueDate = normalizeText(rawDueDate);

  if (!dueDate) {
    return FALLBACK_DUE_DATE_ISO;
  }

  return dueDate;
}

/**
 * @param {string} rawDueDate
 * @returns {string}
 */
function resolveDueDateText(rawDueDate) {
  const dueDate = normalizeText(rawDueDate);

  if (!dueDate) {
    return FALLBACK_DUE_DATE_TEXT;
  }

  const formatted = formatReminderDueDateLong(dueDate);

  if (formatted === "Invalid date") {
    return FALLBACK_DUE_DATE_TEXT;
  }

  return formatted;
}

/**
 * @param {string} dateString
 * @returns {string}
 */
function formatReminderDueDateLong(dateString) {
  const date = parseDateAtMidnight(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * @param {object | null | undefined} candidate
 * @param {ReminderEmailTemplateOptions} [options]
 * @returns {ReminderEmailTemplateTokenMap}
 */
export function buildReminderEmailTokenMap(candidate, options = {}) {
  const recipientName =
    resolveCandidateField(candidate, ["recipientName", "recipient_name"], options.recipientName) ||
    FALLBACK_RECIPIENT_NAME;

  const personName =
    resolveCandidateField(
      candidate,
      ["personName", "person_name", "name"],
      options.personName
    ) || FALLBACK_PERSON_NAME;

  const complianceType =
    resolveCandidateField(candidate, ["complianceType", "compliance_type"]) ||
    FALLBACK_COMPLIANCE_TYPE;

  const reminderType =
    resolveCandidateField(candidate, ["reminderType", "reminder_type"]) ||
    FALLBACK_REMINDER_TYPE;

  const rawDueDate = resolveCandidateField(candidate, [
    "dueDate",
    "due_date",
    "expiryDate",
    "expiry_date",
  ]);

  const organisationName =
    resolveCandidateField(candidate, ["organisationName", "organisation_name"], options.organisationName) ||
    DEFAULT_ORGANISATION_NAME;

  const contactName =
    resolveCandidateField(candidate, ["contactName", "contact_name"], options.contactName) ||
    recipientName ||
    organisationName;

  return {
    recipientName,
    personName,
    complianceType,
    reminderType,
    dueDate: resolveDueDateIso(rawDueDate),
    organisationName,
    contactName,
  };
}

/**
 * Replace supported `{{token}}` placeholders in plain-text template copy.
 *
 * @param {string} template
 * @param {Partial<ReminderEmailTemplateTokenMap>} tokens
 * @returns {string}
 */
export function replaceReminderEmailTokens(template, tokens) {
  let output = String(template ?? "");

  for (const tokenName of REMINDER_EMAIL_TEMPLATE_TOKENS) {
    const replacement = normalizeText(tokens[tokenName]);

    if (!replacement) {
      continue;
    }

    output = output.replaceAll(`{{${tokenName}}}`, replacement);
  }

  return output;
}

/**
 * @param {object | null | undefined} candidate
 * @param {ReminderEmailTemplateOptions} [options]
 * @returns {ReminderEmailTemplateTokenMap}
 */
function buildSubjectTokenMap(candidate, options = {}) {
  const tokens = buildReminderEmailTokenMap(candidate, options);
  const rawDueDate = resolveCandidateField(candidate, [
    "dueDate",
    "due_date",
    "expiryDate",
    "expiry_date",
  ]);

  return {
    ...tokens,
    dueDate: resolveDueDateIso(rawDueDate),
  };
}

/**
 * @param {object | null | undefined} candidate
 * @param {ReminderEmailTemplateOptions} [options]
 * @returns {ReminderEmailTemplateTokenMap}
 */
function buildBodyTokenMap(candidate, options = {}) {
  const tokens = buildReminderEmailTokenMap(candidate, options);
  const rawDueDate = resolveCandidateField(candidate, [
    "dueDate",
    "due_date",
    "expiryDate",
    "expiry_date",
  ]);

  return {
    ...tokens,
    dueDate: resolveDueDateText(rawDueDate),
  };
}

/**
 * Build reminder email subject line (plain text).
 *
 * @param {object | null | undefined} candidate
 * @param {ReminderEmailTemplateOptions} [options]
 * @returns {string}
 */
export function buildReminderEmailSubject(candidate, options = {}) {
  return replaceReminderEmailTokens(
    REMINDER_EMAIL_SUBJECT_TEMPLATE,
    buildSubjectTokenMap(candidate, options)
  );
}

/**
 * Build reminder email body (plain text).
 *
 * @param {object | null | undefined} candidate
 * @param {ReminderEmailTemplateOptions} [options]
 * @returns {string}
 */
export function buildReminderEmailBody(candidate, options = {}) {
  return replaceReminderEmailTokens(
    REMINDER_EMAIL_BODY_TEMPLATE,
    buildBodyTokenMap(candidate, options)
  );
}

/**
 * Build reminder email preview (subject + body, plain text).
 *
 * @param {object | null | undefined} candidate
 * @param {ReminderEmailTemplateOptions} [options]
 * @returns {ReminderEmailPreview}
 */
export function buildReminderEmailPreview(candidate, options = {}) {
  return {
    subject: buildReminderEmailSubject(candidate, options),
    bodyText: buildReminderEmailBody(candidate, options),
  };
}
