import { HISTORY_ACTIONS } from "../../data/constants.js";
import {
  REMINDER_UI_LABELS,
  getReminderSentText,
  isReminderTypeMarkedSent,
} from "../../data/reminder-sent.js";

/**
 * Resolve the most urgent active reminder type for a record, matching app.js
 * `getReminderForRecord` (30 / 14 / 7 day windows and expired).
 *
 * @param {string} expiryDate
 * @param {import("./insights-engine.js").InsightsContext["settings"]} settings
 * @param {import("./insights-engine.js").InsightsContext} ctx
 * @returns {string | null}
 */
export function getActiveReminderType(expiryDate, settings, ctx) {
  const daysRemaining = ctx.getDaysUntilExpiry(expiryDate);

  if (Number.isNaN(daysRemaining)) {
    return null;
  }

  if (daysRemaining < 0) {
    return REMINDER_UI_LABELS.expired;
  }

  if (settings.days7 && daysRemaining <= 7) {
    return REMINDER_UI_LABELS[7];
  }

  if (settings.days14 && daysRemaining <= 14) {
    return REMINDER_UI_LABELS[14];
  }

  if (settings.days30 && daysRemaining <= 30) {
    return REMINDER_UI_LABELS[30];
  }

  return null;
}

/**
 * @param {object} entry
 * @returns {string}
 */
function getHistoryEntryAction(entry) {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  return entry.action ?? entry.action_type ?? "";
}

/**
 * @param {object} entry
 * @returns {string}
 */
function getHistoryEntryDescription(entry) {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  return entry.description ?? entry.details ?? "";
}

/**
 * Whether a record shows follow-up for the given reminder type via notes or history.
 *
 * @param {import("./insights-engine.js").NormalizedComplianceRow} row
 * @param {string} reminderType
 * @returns {boolean}
 */
export function hasReminderActivityForType(row, reminderType) {
  if (!reminderType) {
    return false;
  }

  const notes = typeof row.notes === "string" ? row.notes : "";

  if (isReminderTypeMarkedSent(notes, reminderType)) {
    return true;
  }

  const sentLabel = getReminderSentText(reminderType);
  const history = Array.isArray(row.history) ? row.history : [];

  return history.some((entry) => {
    const action = getHistoryEntryAction(entry);

    if (action !== HISTORY_ACTIONS.REMINDER_SENT) {
      return false;
    }

    return getHistoryEntryDescription(entry).includes(sentLabel);
  });
}

/**
 * @param {import("./insights-engine.js").NormalizedComplianceRow} row
 * @param {import("./insights-engine.js").InsightsContext} ctx
 * @returns {boolean}
 */
export function isRecordInReminderWindow(row, ctx) {
  return getActiveReminderType(row.expiryDate, ctx.settings, ctx) !== null;
}

/**
 * @param {import("./insights-engine.js").NormalizedComplianceRow} row
 * @param {import("./insights-engine.js").InsightsContext} ctx
 * @returns {boolean}
 */
export function recordHasReminderActivity(row, ctx) {
  const reminderType = getActiveReminderType(row.expiryDate, ctx.settings, ctx);

  if (!reminderType) {
    return false;
  }

  return hasReminderActivityForType(row, reminderType);
}

/**
 * @param {import("./insights-engine.js").NormalizedComplianceRow[]} rows
 * @param {import("./insights-engine.js").InsightsContext} ctx
 * @returns {import("./insights-engine.js").NormalizedComplianceRow[]}
 */
export function filterRecordsMissingReminderActivity(rows, ctx) {
  return rows.filter((row) => {
    const reminderType = getActiveReminderType(row.expiryDate, ctx.settings, ctx);

    if (!reminderType) {
      return false;
    }

    return !hasReminderActivityForType(row, reminderType);
  });
}

function buildOperationalHealthNote(recordsInReminderWindows, recordsMissingReminderActivity) {
  if (recordsInReminderWindows === 0) {
    return "No records are currently in 30-, 14-, or 7-day reminder windows (or expired).";
  }

  if (recordsMissingReminderActivity === 0) {
    return `All ${recordsInReminderWindows} record${recordsInReminderWindows === 1 ? "" : "s"} in active reminder windows have recorded reminder follow-up.`;
  }

  return `${recordsMissingReminderActivity} of ${recordsInReminderWindows} record${recordsInReminderWindows === 1 ? "" : "s"} in active reminder windows lack recorded reminder follow-up (notes or history).`;
}

/**
 * Operational health scores reminder follow-up for records in active reminder windows.
 *
 * Score = round(recordsWithReminderActivity / recordsInReminderWindows × 100).
 * When no records are in reminder windows, score is 100.
 *
 * Reminder activity is detected when the current window's sent label appears in
 * record notes (`isReminderTypeMarkedSent`) or in a `reminder_sent` history entry.
 *
 * @param {import("./insights-engine.js").NormalizedComplianceRow[]} rows
 * @param {import("./insights-engine.js").InsightsContext} ctx
 */
export function computeOperationalHealth(rows, ctx) {
  let recordsInReminderWindows = 0;
  let recordsWithReminderActivity = 0;

  rows.forEach((row) => {
    const reminderType = getActiveReminderType(row.expiryDate, ctx.settings, ctx);

    if (!reminderType) {
      return;
    }

    recordsInReminderWindows += 1;

    if (hasReminderActivityForType(row, reminderType)) {
      recordsWithReminderActivity += 1;
    }
  });

  const recordsMissingReminderActivity =
    recordsInReminderWindows - recordsWithReminderActivity;

  const score =
    recordsInReminderWindows === 0
      ? 100
      : Math.round((recordsWithReminderActivity / recordsInReminderWindows) * 100);

  return {
    available: true,
    score,
    recordsInReminderWindows,
    recordsWithReminderActivity,
    recordsMissingReminderActivity,
    note: buildOperationalHealthNote(recordsInReminderWindows, recordsMissingReminderActivity),
  };
}

/**
 * Format operational health for the Compliance Insights sub-score UI.
 *
 * @param {{
 *   available?: boolean;
 *   score?: number;
 *   recordsInReminderWindows?: number;
 *   recordsWithReminderActivity?: number;
 *   recordsMissingReminderActivity?: number;
 *   note?: string;
 * }} operationalHealth
 */
export function formatOperationalHealthSummary(operationalHealth) {
  if (!operationalHealth?.available) {
    const fallback = operationalHealth?.note || "Not available";

    return {
      scoreText: fallback,
      detailText: "",
      title: "",
      ariaLabel: fallback,
    };
  }

  const score = operationalHealth.score ?? 0;
  const recordsInReminderWindows = operationalHealth.recordsInReminderWindows ?? 0;
  const recordsWithReminderActivity = operationalHealth.recordsWithReminderActivity ?? 0;
  const recordsMissingReminderActivity = operationalHealth.recordsMissingReminderActivity ?? 0;
  const note = operationalHealth.note || "";

  const scoreText = `${score}%`;
  const detailText =
    recordsInReminderWindows === 0
      ? "No records in active reminder windows"
      : `${recordsInReminderWindows} in windows · ${recordsWithReminderActivity} followed up · ${recordsMissingReminderActivity} missing`;

  const ariaLabel = [
    `Operational Health ${score}%.`,
    `${recordsInReminderWindows} records in active reminder windows.`,
    `${recordsWithReminderActivity} with recorded reminder follow-up.`,
    `${recordsMissingReminderActivity} missing reminder follow-up.`,
    note,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    scoreText,
    detailText,
    title: note,
    ariaLabel,
  };
}
