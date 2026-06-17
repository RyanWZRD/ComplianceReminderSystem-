/**
 * Reminder Preview Dashboard (V5-1B Phase 4).
 * Operational counts and drilldowns for previewable reminders (qualifying + email).
 * Read-only — no sending, queue, or automation.
 */

import { normalizePersonContactFields } from "../../data/email.js";
import { REMINDER_UI_LABELS } from "../../data/reminder-sent.js";
import { getActiveReminderType } from "../insights/metrics-operational.js";
import {
  buildReminderTemplateFullEmailText,
  buildReminderTemplatePreviewFromRow,
  formatReminderPreviewExportDate,
} from "./reminder-templates.js";

/** @typedef {import("../insights/insights-engine.js").NormalizedComplianceRow} NormalizedComplianceRow */
/** @typedef {import("../insights/insights-engine.js").InsightsContext} InsightsContext */

export const REMINDER_PREVIEW_DASHBOARD_TYPES = {
  DAYS_30: "30-day",
  DAYS_14: "14-day",
  DAYS_7: "7-day",
  EXPIRED: "expired",
  TOTAL: "total",
};

export const REMINDER_PREVIEW_DASHBOARD_COLUMNS = [
  { key: "name", label: "Person" },
  { key: "email", label: "Email" },
  { key: "complianceType", label: "Compliance Type" },
  { key: "expiryDate", label: "Expiry Date" },
  { key: "reminderType", label: "Reminder Type" },
];

const REMINDER_TYPE_BY_DASHBOARD = {
  [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_30]: REMINDER_UI_LABELS[30],
  [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_14]: REMINDER_UI_LABELS[14],
  [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_7]: REMINDER_UI_LABELS[7],
  [REMINDER_PREVIEW_DASHBOARD_TYPES.EXPIRED]: REMINDER_UI_LABELS.expired,
};

const REMINDER_URGENCY = {
  [REMINDER_UI_LABELS.expired]: 0,
  [REMINDER_UI_LABELS[7]]: 1,
  [REMINDER_UI_LABELS[14]]: 2,
  [REMINDER_UI_LABELS[30]]: 3,
};

const DASHBOARD_META = {
  [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_30]: {
    title: "30 Day Reminders",
    cardLabel: "30 Day Reminders",
    emptyMessage: "No previewable 30-day reminders with email on file.",
    previewDescription:
      "Records in the 30-day reminder window with a person email address. Preview reminder copy before any delivery.",
    itemLabel: "Reminders",
  },
  [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_14]: {
    title: "14 Day Reminders",
    cardLabel: "14 Day Reminders",
    emptyMessage: "No previewable 14-day reminders with email on file.",
    previewDescription:
      "Records in the 14-day reminder window with a person email address. Preview reminder copy before any delivery.",
    itemLabel: "Reminders",
  },
  [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_7]: {
    title: "7 Day Reminders",
    cardLabel: "7 Day Reminders",
    emptyMessage: "No previewable 7-day reminders with email on file.",
    previewDescription:
      "Records in the 7-day reminder window with a person email address. Preview reminder copy before any delivery.",
    itemLabel: "Reminders",
  },
  [REMINDER_PREVIEW_DASHBOARD_TYPES.EXPIRED]: {
    title: "Expired Reminders",
    cardLabel: "Expired Reminders",
    emptyMessage: "No previewable expired reminders with email on file.",
    previewDescription:
      "Expired records with a person email address. Preview reminder copy before any delivery.",
    itemLabel: "Reminders",
  },
  [REMINDER_PREVIEW_DASHBOARD_TYPES.TOTAL]: {
    title: "Total Previewable Reminders",
    cardLabel: "Total Previewable Reminders",
    emptyMessage: "No previewable reminders with email on file.",
    previewDescription:
      "All records currently in an active reminder window with a person email address.",
    itemLabel: "Reminders",
  },
};

/**
 * @param {string} reminderType
 * @returns {string | number | null}
 */
function getUrgencyKeyForReminderType(reminderType) {
  if (reminderType === REMINDER_UI_LABELS.expired) {
    return "expired";
  }

  if (reminderType === REMINDER_UI_LABELS[7]) {
    return 7;
  }

  if (reminderType === REMINDER_UI_LABELS[14]) {
    return 14;
  }

  if (reminderType === REMINDER_UI_LABELS[30]) {
    return 30;
  }

  return null;
}

/**
 * @param {NormalizedComplianceRow} row
 * @returns {boolean}
 */
export function hasPreviewableEmail(row) {
  return normalizePersonContactFields(row).email !== "";
}

/**
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext["settings"]} settings
 * @param {InsightsContext} ctx
 * @returns {Array<object>}
 */
export function buildPreviewableReminderEntries(rows, settings, ctx) {
  /** @type {Array<object>} */
  const entries = [];

  for (const row of rows) {
    if (!hasPreviewableEmail(row)) {
      continue;
    }

    const reminderType = getActiveReminderType(row.expiryDate, settings, ctx);

    if (!reminderType) {
      continue;
    }

    const contact = normalizePersonContactFields(row);

    entries.push({
      personId: row.personId,
      recordId: row.recordId,
      name: row.name,
      email: contact.email,
      complianceType: row.complianceType,
      expiryDate: row.expiryDate,
      reminderType,
      urgencyKey: getUrgencyKeyForReminderType(reminderType),
      daysRemaining: ctx.getDaysUntilExpiry(row.expiryDate),
      row,
    });
  }

  return sortPreviewableReminderEntries(entries);
}

/**
 * @param {Array<object>} entries
 * @returns {Array<object>}
 */
export function sortPreviewableReminderEntries(entries) {
  return [...entries].sort((a, b) => {
    const urgencyA = REMINDER_URGENCY[a.reminderType] ?? 99;
    const urgencyB = REMINDER_URGENCY[b.reminderType] ?? 99;

    if (urgencyA !== urgencyB) {
      return urgencyA - urgencyB;
    }

    return a.daysRemaining - b.daysRemaining || a.name.localeCompare(b.name);
  });
}

/**
 * @param {Array<object>} entries
 * @returns {Record<string, number>}
 */
export function countPreviewableReminderDashboardMetrics(entries) {
  const counts = {
    [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_30]: 0,
    [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_14]: 0,
    [REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_7]: 0,
    [REMINDER_PREVIEW_DASHBOARD_TYPES.EXPIRED]: 0,
    [REMINDER_PREVIEW_DASHBOARD_TYPES.TOTAL]: entries.length,
  };

  for (const entry of entries) {
    if (entry.reminderType === REMINDER_UI_LABELS[30]) {
      counts[REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_30] += 1;
    } else if (entry.reminderType === REMINDER_UI_LABELS[14]) {
      counts[REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_14] += 1;
    } else if (entry.reminderType === REMINDER_UI_LABELS[7]) {
      counts[REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_7] += 1;
    } else if (entry.reminderType === REMINDER_UI_LABELS.expired) {
      counts[REMINDER_PREVIEW_DASHBOARD_TYPES.EXPIRED] += 1;
    }
  }

  return counts;
}

/**
 * @param {Array<object>} entries
 * @param {string} dashboardType
 * @returns {Array<object>}
 */
export function filterPreviewableRemindersByDashboardType(entries, dashboardType) {
  if (dashboardType === REMINDER_PREVIEW_DASHBOARD_TYPES.TOTAL) {
    return entries;
  }

  const targetType = REMINDER_TYPE_BY_DASHBOARD[dashboardType];

  if (!targetType) {
    return [];
  }

  return entries.filter((entry) => entry.reminderType === targetType);
}

/**
 * @param {string} dashboardType
 * @returns {{ title: string; cardLabel: string; emptyMessage: string; previewDescription: string; itemLabel: string } | null}
 */
export function getReminderPreviewDashboardMeta(dashboardType) {
  return DASHBOARD_META[dashboardType] ?? null;
}

/**
 * @param {object} entry
 * @param {(dateString: string) => string} formatExpiryDate
 * @returns {object}
 */
export function mapReminderPreviewDashboardRow(entry, formatExpiryDate) {
  return {
    personId: entry.personId,
    recordId: entry.recordId,
    name: entry.name,
    email: entry.email,
    complianceType: entry.complianceType,
    expiryDate: formatExpiryDate(entry.expiryDate),
    reminderType: entry.reminderType,
    reminderTypeClass: entry.urgencyKey,
  };
}

/**
 * @param {string} dashboardType
 * @param {Array<object>} entries
 * @param {{ formatExpiryDate?: (dateString: string) => string; generatedAt?: string; generatedDisplay?: string; exportDate?: Date | string }} [options]
 * @returns {object}
 */
export function buildReminderPreviewDashboardReport(dashboardType, entries, options = {}) {
  const meta = getReminderPreviewDashboardMeta(dashboardType);

  if (!meta) {
    throw new Error(`Unsupported reminder preview dashboard type: ${dashboardType}`);
  }

  const formatExpiryDate = options.formatExpiryDate ?? ((dateString) => dateString);
  const filtered = filterPreviewableRemindersByDashboardType(entries, dashboardType);
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  return {
    type: dashboardType,
    title: meta.title,
    emptyMessage: meta.emptyMessage,
    previewDescription: meta.previewDescription,
    itemLabel: meta.itemLabel,
    generatedAt,
    generatedDisplay: options.generatedDisplay ?? generatedAt,
    totalCount: filtered.length,
    columns: REMINDER_PREVIEW_DASHBOARD_COLUMNS,
    entries: filtered,
    tableRows: filtered.map((entry) => mapReminderPreviewDashboardRow(entry, formatExpiryDate)),
    filename: buildReminderPreviewPackFilename(dashboardType, options.exportDate),
  };
}

/**
 * @param {Array<object>} entries
 * @param {{ organisationName?: string | null }} [options]
 * @returns {string}
 */
export function buildReminderPreviewPackText(entries, options = {}) {
  if (entries.length === 0) {
    return "";
  }

  const sections = entries.map((entry) => {
    const preview = buildReminderTemplatePreviewFromRow(entry.row, entry.reminderType, options);
    return buildReminderTemplateFullEmailText(preview);
  });

  return sections.join("\n\n---\n\n");
}

/**
 * @param {string} dashboardType
 * @param {Date | string} [date]
 * @returns {string}
 */
export function buildReminderPreviewPackFilename(dashboardType, date = new Date()) {
  const slug =
    dashboardType === REMINDER_PREVIEW_DASHBOARD_TYPES.TOTAL ? "total" : dashboardType;
  const datePart = formatReminderPreviewExportDate(date);

  return `reminder-preview-pack-${slug}-${datePart}.txt`;
}
