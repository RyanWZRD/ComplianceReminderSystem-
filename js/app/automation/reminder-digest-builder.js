/**
 * V5-2 Phase 4: Reminder digest builder.
 * Builds manager/admin digest content from reminder queue items — generation only.
 * No email sending, mark-as-sent, compliance/action mutation, or history writes.
 */

import {
  DEFAULT_ORGANISATION_NAME,
  formatReminderExpiryDate,
} from "../reminders/reminder-templates.js";
import {
  REMINDER_QUEUE_MISSING_EMAIL_LABEL,
  formatReminderQueueWindowLabel,
} from "./reminder-queue-ui.js";

/**
 * @typedef {import("./reminder-queue.js").ReturnType<import("./reminder-queue.js").buildReminderQueueFromDryRun>["items"][number]} ReminderQueueItem
 */

/**
 * @typedef {Object} ReminderDigestWindowCounts
 * @property {number} "30-day"
 * @property {number} "14-day"
 * @property {number} "7-day"
 * @property {number} expired
 */

/**
 * @typedef {Object} ReminderDigestMetadata
 * @property {string} asOfDate
 * @property {string} organisationName
 * @property {number} totalQueued
 * @property {number} missingEmail
 * @property {ReminderDigestWindowCounts} byWindow
 * @property {boolean} empty
 */

/**
 * @typedef {Object} ReminderDigest
 * @property {string} subject
 * @property {string} bodyText
 * @property {ReminderDigestMetadata} metadata
 */

const DIGEST_WINDOW_ORDER = ["expired", "7-day", "14-day", "30-day"];

const REMINDER_WINDOW_URGENCY = {
  expired: 0,
  "7-day": 1,
  "14-day": 2,
  "30-day": 3,
};

/**
 * @returns {ReminderDigestWindowCounts}
 */
function createEmptyWindowCounts() {
  return {
    "30-day": 0,
    "14-day": 0,
    "7-day": 0,
    expired: 0,
  };
}

/**
 * @param {ReminderQueueItem} left
 * @param {ReminderQueueItem} right
 * @returns {number}
 */
function compareDigestQueueItems(left, right) {
  const leftUrgency = REMINDER_WINDOW_URGENCY[left.reminderWindow] ?? 99;
  const rightUrgency = REMINDER_WINDOW_URGENCY[right.reminderWindow] ?? 99;

  if (leftUrgency !== rightUrgency) {
    return leftUrgency - rightUrgency;
  }

  const nameCompare = String(left.personName ?? "").localeCompare(
    String(right.personName ?? ""),
    "en-GB"
  );

  if (nameCompare !== 0) {
    return nameCompare;
  }

  return String(left.complianceType ?? "").localeCompare(
    String(right.complianceType ?? ""),
    "en-GB"
  );
}

/**
 * @param {ReminderQueueItem} item
 * @returns {string}
 */
function formatDigestEmailLabel(item) {
  const emailMissing = item.emailMissing === true || item.email == null;

  if (emailMissing) {
    return REMINDER_QUEUE_MISSING_EMAIL_LABEL;
  }

  return String(item.email ?? "").trim() || REMINDER_QUEUE_MISSING_EMAIL_LABEL;
}

/**
 * @param {ReminderQueueItem} item
 * @returns {string}
 */
function formatDigestItemLine(item) {
  const personName = String(item.personName ?? "").trim() || "—";
  const complianceType = String(item.complianceType ?? "").trim() || "—";
  const expiryDate = formatReminderExpiryDate(String(item.expiryDate ?? "").trim());
  const emailLabel = formatDigestEmailLabel(item);

  return `- ${personName} — ${complianceType} — expires ${expiryDate} — ${emailLabel}`;
}

/**
 * @param {ReminderQueueItem[]} items
 * @returns {string[]}
 */
function buildGroupedDigestSections(items) {
  /** @type {string[]} */
  const sections = [];

  DIGEST_WINDOW_ORDER.forEach((windowKey) => {
    const windowItems = items.filter((item) => item.reminderWindow === windowKey);

    if (windowItems.length === 0) {
      return;
    }

    const heading = formatReminderQueueWindowLabel(windowKey);
    sections.push(`${heading} (${windowItems.length})`);
    windowItems.forEach((item) => {
      sections.push(formatDigestItemLine(item));
    });
    sections.push("");
  });

  return sections;
}

/**
 * Build a manager/admin reminder digest from queue items (no delivery or writes).
 *
 * @param {{
 *   queueItems: ReminderQueueItem[];
 *   organisationName?: string | null;
 *   asOfDate?: string | null;
 * }} input
 * @returns {ReminderDigest}
 */
export function buildReminderDigest({ queueItems, organisationName, asOfDate }) {
  const resolvedOrganisation =
    String(organisationName ?? "").trim() || DEFAULT_ORGANISATION_NAME;
  const resolvedAsOfDate = String(asOfDate ?? "").trim();
  const inputItems = Array.isArray(queueItems) ? queueItems : [];
  const items = [...inputItems].sort(compareDigestQueueItems);

  const byWindow = createEmptyWindowCounts();
  let missingEmail = 0;

  items.forEach((item) => {
    if (item.emailMissing === true || item.email == null) {
      missingEmail += 1;
    }

    if (Object.prototype.hasOwnProperty.call(byWindow, item.reminderWindow)) {
      byWindow[item.reminderWindow] += 1;
    }
  });

  const totalQueued = items.length;
  const empty = totalQueued === 0;

  const metadata = {
    asOfDate: resolvedAsOfDate,
    organisationName: resolvedOrganisation,
    totalQueued,
    missingEmail,
    byWindow,
    empty,
  };

  if (empty) {
    const subject = `No reminders due — ${resolvedOrganisation}`;
    const bodyLines = [
      "Reminder digest",
      "",
      resolvedOrganisation,
      resolvedAsOfDate ? `As of ${resolvedAsOfDate}` : "",
      "",
      "No reminder queue items are due for follow-up on this scan.",
      "",
      "Summary",
      "- Total queued: 0",
      "- Missing email: 0",
      "- Expired: 0",
      "- 30-day: 0",
      "- 14-day: 0",
      "- 7-day: 0",
      "",
      "There is nothing to chase right now. Review the register again after the next compliance scan.",
      "",
      "Digest preview only — no email has been sent.",
    ].filter((line, index, allLines) => !(line === "" && allLines[index - 1] === ""));

    return {
      subject,
      bodyText: bodyLines.join("\n"),
      metadata,
    };
  }

  const subject = `Reminder digest — ${totalQueued} to chase — ${resolvedOrganisation}`;
  const summaryLines = [
    "Reminder digest",
    "",
    resolvedOrganisation,
    resolvedAsOfDate ? `As of ${resolvedAsOfDate}` : "",
    "",
    "Summary",
    `- Total queued: ${totalQueued}`,
    `- Missing email: ${missingEmail}`,
    `- Expired: ${byWindow.expired}`,
    `- 30-day: ${byWindow["30-day"]}`,
    `- 14-day: ${byWindow["14-day"]}`,
    `- 7-day: ${byWindow["7-day"]}`,
    "",
    "Records needing follow-up",
    "",
    ...buildGroupedDigestSections(items),
    "Digest preview only — no email has been sent.",
  ];

  return {
    subject,
    bodyText: summaryLines.join("\n"),
    metadata,
  };
}
