/**
 * V5-1 Phase 1: Reminder queue foundation.
 * Builds in-memory queued reminder candidates from a dry-run scan.
 * Queue-only — no email delivery, mark-sent, compliance/action mutation, or history writes.
 */

import { DEFAULT_REMINDER_SETTINGS } from "../../data/constants.js";
import { normalizePersonContactFields } from "../../data/email.js";
import { REMINDER_UI_LABELS } from "../../data/reminder-sent.js";
import { AUTOMATION_REMINDER_TYPE_BUCKETS } from "./automation-dry-run.js";
import {
  createInsightsContext,
  normalizeComplianceRow,
} from "../insights/insights-engine.js";
import { getActiveReminderType } from "../insights/metrics-operational.js";

/** @typedef {import("../insights/insights-engine.js").NormalizedComplianceRow} NormalizedComplianceRow */

export const REMINDER_QUEUE_STATUS = "queued";
export const REMINDER_QUEUE_SOURCE = "dry_run_candidate";

/** Execution fields — always false/null for queue-only candidates. */
export const REMINDER_QUEUE_EXECUTION_DEFAULTS = Object.freeze({
  sent: false,
  delivered: false,
  markedSent: false,
  sentAt: null,
  deliveredAt: null,
  markedSentAt: null,
  failed: false,
  failureReason: null,
});

const REMINDER_TYPE_TO_BUCKET = Object.fromEntries(
  Object.entries(AUTOMATION_REMINDER_TYPE_BUCKETS).map(([bucket, reminderType]) => [
    reminderType,
    bucket,
  ])
);

const REMINDER_WINDOW_URGENCY = {
  expired: 0,
  "7-day": 1,
  "14-day": 2,
  "30-day": 3,
};

/**
 * @returns {{ "30-day": number, "14-day": number, "7-day": number, expired: number }}
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
 * @param {{
 *   personName: string;
 *   complianceType: string;
 *   expiryDate: string;
 *   reminderWindow: string;
 *   reminderType: string;
 *   email: string | null;
 *   emailMissing: boolean;
 *   complianceRecordId: string | null;
 *   status: typeof REMINDER_QUEUE_STATUS;
 *   source: typeof REMINDER_QUEUE_SOURCE;
 *   asOfDate: string;
 * }} fields
 */
function createReminderQueueItem(fields) {
  return {
    ...fields,
    ...REMINDER_QUEUE_EXECUTION_DEFAULTS,
  };
}

/**
 * @param {NormalizedComplianceRow} row
 * @param {string} reminderType
 * @returns {string | null}
 */
function getQueueEmailForRow(row) {
  const contact = normalizePersonContactFields(row);
  return contact.email || null;
}

/**
 * @param {ReturnType<typeof createReminderQueueItem>} left
 * @param {ReturnType<typeof createReminderQueueItem>} right
 * @returns {number}
 */
function compareReminderQueueItems(left, right) {
  const leftUrgency = REMINDER_WINDOW_URGENCY[left.reminderWindow] ?? 99;
  const rightUrgency = REMINDER_WINDOW_URGENCY[right.reminderWindow] ?? 99;

  if (leftUrgency !== rightUrgency) {
    return leftUrgency - rightUrgency;
  }

  const nameCompare = left.personName.localeCompare(right.personName, "en-GB");

  if (nameCompare !== 0) {
    return nameCompare;
  }

  return left.complianceType.localeCompare(right.complianceType, "en-GB");
}

/**
 * @typedef {Object} ReminderQueueBuildInput
 * @property {object} dryRunResult
 * @property {string} [asOfDate]
 * @property {object[]} rows
 * @property {object} [settings]
 */

/**
 * @typedef {Object} ReminderQueueBuildResult
 * @property {string} asOfDate
 * @property {ReturnType<typeof createReminderQueueItem>[]} items
 * @property {{
 *   total: number;
 *   withEmail: number;
 *   missingEmail: number;
 *   byWindow: ReturnType<typeof createEmptyWindowCounts>;
 * }} summary
 */

/**
 * Convert dry-run reminder candidates into in-memory queue items (no delivery or writes).
 *
 * @param {ReminderQueueBuildInput} input
 * @returns {ReminderQueueBuildResult}
 */
export function buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate,
  rows,
  settings = DEFAULT_REMINDER_SETTINGS,
}) {
  const resolvedAsOfDate =
    typeof asOfDate === "string" && asOfDate.trim()
      ? asOfDate.trim()
      : typeof dryRunResult?.asOfDate === "string" && dryRunResult.asOfDate.trim()
        ? dryRunResult.asOfDate.trim()
        : "";

  const inputRows = Array.isArray(rows) ? rows : [];
  const normalizedRows = inputRows.map(normalizeComplianceRow);
  const ctx = createInsightsContext(resolvedAsOfDate || undefined, settings);

  /** @type {ReturnType<typeof createReminderQueueItem>[]} */
  const items = [];

  normalizedRows.forEach((row) => {
    const reminderType = getActiveReminderType(row.expiryDate, ctx.settings, ctx);

    if (!reminderType) {
      return;
    }

    const reminderWindow = REMINDER_TYPE_TO_BUCKET[reminderType] ?? reminderType;
    const email = getQueueEmailForRow(row);
    const emailMissing = email === null;

    items.push(
      createReminderQueueItem({
        personName: row.name,
        complianceType: row.complianceType,
        expiryDate: row.expiryDate,
        reminderWindow,
        reminderType,
        email,
        emailMissing,
        complianceRecordId: String(row.recordId ?? "").trim() || null,
        status: REMINDER_QUEUE_STATUS,
        source: REMINDER_QUEUE_SOURCE,
        asOfDate: resolvedAsOfDate,
      })
    );
  });

  items.sort(compareReminderQueueItems);

  const summary = {
    total: items.length,
    withEmail: 0,
    missingEmail: 0,
    byWindow: createEmptyWindowCounts(),
  };

  items.forEach((item) => {
    if (item.emailMissing) {
      summary.missingEmail += 1;
    } else {
      summary.withEmail += 1;
    }

    if (Object.prototype.hasOwnProperty.call(summary.byWindow, item.reminderWindow)) {
      summary.byWindow[item.reminderWindow] += 1;
    }
  });

  return {
    asOfDate: resolvedAsOfDate,
    items,
    summary,
  };
}
