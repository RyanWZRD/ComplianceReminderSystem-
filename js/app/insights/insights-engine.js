import { ACTION_STATUSES, DEFAULT_REMINDER_SETTINGS } from "../../data/constants.js";
import {
  dateToISOString,
  normalizeExpiryDate,
  parseDateAtMidnight,
} from "../../data/dates.js";
import {
  computeActionHealth,
  computeCompositeHealthScore,
  computeEvidenceHealth,
  computeExpiryHealth,
} from "./metrics-health.js";
import { computeOperationalHealth } from "./metrics-operational.js";
import { computeRiskSummary } from "./metrics-risk.js";
import { computeRenewalForecast } from "./metrics-forecast.js";
import { computeEvidenceGaps } from "./metrics-evidence-gaps.js";
import { computeContactReadiness } from "./metrics-contact-readiness.js";
import { normalizePersonContactFields } from "../../data/email.js";

export const DUE_SOON_DAYS = 90;
export const STALE_EVIDENCE_DAYS = 365;

/**
 * @typedef {object} NormalizedComplianceRow
 * @property {string|number} personId
 * @property {string|number} recordId
 * @property {string} name
 * @property {string} role
 * @property {string} complianceType
 * @property {string} expiryDate
 * @property {string} renewalCycle
 * @property {string} notes
 * @property {Array<object>} history
 * @property {Array<object>} evidence
 * @property {Array<object>} actions
 * @property {string} email
 * @property {string} managerEmail
 */

/**
 * @typedef {typeof DEFAULT_REMINDER_SETTINGS} ReminderSettings
 */

/**
 * @typedef {object} InsightsContext
 * @property {Date} asOfDate
 * @property {string} asOfDateISO
 * @property {ReminderSettings} settings
 * @property {number} dueSoonDays
 * @property {number} staleEvidenceDays
 * @property {(expiryDate: string) => number} getDaysUntilExpiry
 * @property {(expiryDate: string) => { key: string, label: string }} getExpiryStatus
 * @property {(addedDate: string) => boolean} isEvidenceStale
 * @property {(actionItem: object) => string} getActionStatus
 * @property {(actionItem: object) => boolean} isActionOverdue
 * @property {(actionItem: object) => boolean} isActionDueThisWeek
 * @property {(monthOffset?: number) => { start: Date, end: Date }} getMonthDateRange
 * @property {(expiryDate: string, monthOffset: number) => boolean} isExpiryInMonthRange
 */

function normalizeEvidenceItem(item) {
  if (!item || typeof item !== "object") {
    return item;
  }

  return {
    ...item,
    addedDate: normalizeExpiryDate(item.addedDate ?? item.added_date ?? ""),
    documentType: item.documentType ?? item.document_type ?? "",
    fileName: item.fileName ?? item.file_name ?? "",
  };
}

function normalizeActionItem(item) {
  if (!item || typeof item !== "object") {
    return item;
  }

  return {
    ...item,
    dueDate: item.dueDate ?? item.due_date ?? null,
    createdAt: item.createdAt ?? item.created_at ?? null,
    completedAt: item.completedAt ?? item.completed_at ?? null,
    status: item.status,
    completed: Boolean(item.completed),
  };
}

/**
 * Normalize repository-loaded compliance rows from local or cloud shapes.
 *
 * @param {object} row
 * @returns {NormalizedComplianceRow}
 */
export function normalizeComplianceRow(row) {
  if (!row || typeof row !== "object") {
    throw new TypeError("Expected a compliance row object.");
  }

  const evidence = Array.isArray(row.evidence)
    ? row.evidence.map(normalizeEvidenceItem)
    : [];
  const actions = Array.isArray(row.actions)
    ? row.actions.map(normalizeActionItem)
    : [];
  const contact = normalizePersonContactFields(row);

  return {
    personId: row.personId ?? row.person_id,
    recordId: row.recordId ?? row.record_id,
    name: row.name ?? "",
    role: row.role ?? "",
    email: contact.email,
    managerEmail: contact.managerEmail,
    complianceType: row.complianceType ?? row.compliance_type ?? "",
    expiryDate: normalizeExpiryDate(row.expiryDate ?? row.expiry_date ?? ""),
    renewalCycle: row.renewalCycle ?? row.renewal_cycle ?? "manual",
    notes: row.notes ?? "",
    history: Array.isArray(row.history) ? row.history : [],
    evidence,
    actions,
  };
}

function normalizeReminderSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {};

  return {
    days30: source.days30 ?? source.days_30 ?? DEFAULT_REMINDER_SETTINGS.days30,
    days14: source.days14 ?? source.days_14 ?? DEFAULT_REMINDER_SETTINGS.days14,
    days7: source.days7 ?? source.days_7 ?? DEFAULT_REMINDER_SETTINGS.days7,
    hideSentReminders:
      source.hideSentReminders ??
      source.hide_sent_reminders ??
      DEFAULT_REMINDER_SETTINGS.hideSentReminders,
  };
}

function resolveAsOfDate(asOfDate) {
  if (asOfDate instanceof Date && !Number.isNaN(asOfDate.getTime())) {
    return new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());
  }

  if (typeof asOfDate === "string" && asOfDate.trim()) {
    const parsed = parseDateAtMidnight(asOfDate);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * @param {Date} referenceDate
 * @returns {InsightsContext}
 */
export function createInsightsContext(referenceDate, settings, options = {}) {
  const asOfDate = resolveAsOfDate(referenceDate);
  const normalizedSettings = normalizeReminderSettings(settings);
  const dueSoonDays = options.dueSoonDays ?? DUE_SOON_DAYS;
  const staleEvidenceDays = options.staleEvidenceDays ?? STALE_EVIDENCE_DAYS;

  function getDaysUntilExpiry(expiryDate) {
    const expiry = parseDateAtMidnight(expiryDate);

    if (Number.isNaN(expiry.getTime())) {
      return NaN;
    }

    const diffMs = expiry.getTime() - asOfDate.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  function getExpiryStatus(expiryDate) {
    const daysUntilExpiry = getDaysUntilExpiry(expiryDate);

    if (Number.isNaN(daysUntilExpiry)) {
      return { key: "invalid", label: "Invalid date" };
    }

    if (daysUntilExpiry < 0) {
      return { key: "expired", label: "Expired" };
    }

    if (daysUntilExpiry <= dueSoonDays) {
      return { key: "dueSoon", label: "Due soon" };
    }

    return { key: "valid", label: "Valid" };
  }

  function isEvidenceStale(addedDate) {
    const added = parseDateAtMidnight(addedDate);

    if (Number.isNaN(added.getTime())) {
      return false;
    }

    const ageDays = Math.floor((asOfDate.getTime() - added.getTime()) / (1000 * 60 * 60 * 24));
    return ageDays > staleEvidenceDays;
  }

  function getActionStatus(actionItem) {
    if (!actionItem || typeof actionItem !== "object") {
      return ACTION_STATUSES.OPEN;
    }

    if (
      actionItem.status === ACTION_STATUSES.IN_PROGRESS ||
      actionItem.status === ACTION_STATUSES.COMPLETED ||
      actionItem.status === ACTION_STATUSES.OPEN
    ) {
      return actionItem.status;
    }

    return actionItem.completed ? ACTION_STATUSES.COMPLETED : ACTION_STATUSES.OPEN;
  }

  function isActionOverdue(actionItem) {
    if (getActionStatus(actionItem) === ACTION_STATUSES.COMPLETED || !actionItem.dueDate) {
      return false;
    }

    const due = parseDateAtMidnight(actionItem.dueDate);
    return !Number.isNaN(due.getTime()) && due < asOfDate;
  }

  function getWeekDateRange() {
    const date = new Date(asOfDate);
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setDate(date.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  function isActionDueThisWeek(actionItem) {
    if (getActionStatus(actionItem) === ACTION_STATUSES.COMPLETED || !actionItem.dueDate) {
      return false;
    }

    const due = parseDateAtMidnight(actionItem.dueDate);

    if (Number.isNaN(due.getTime())) {
      return false;
    }

    const { start, end } = getWeekDateRange();
    return due >= start && due <= end;
  }

  function getMonthDateRange(monthOffset = 0) {
    const start = new Date(asOfDate.getFullYear(), asOfDate.getMonth() + monthOffset, 1);
    const end = new Date(asOfDate.getFullYear(), asOfDate.getMonth() + monthOffset + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  function isExpiryInMonthRange(expiryDate, monthOffset) {
    const expiry = parseDateAtMidnight(expiryDate);

    if (Number.isNaN(expiry.getTime())) {
      return false;
    }

    const { start, end } = getMonthDateRange(monthOffset);
    return expiry >= start && expiry <= end;
  }

  return {
    asOfDate,
    asOfDateISO: dateToISOString(asOfDate),
    settings: normalizedSettings,
    dueSoonDays,
    staleEvidenceDays,
    getDaysUntilExpiry,
    getExpiryStatus,
    isEvidenceStale,
    getActionStatus,
    isActionOverdue,
    isActionDueThisWeek,
    getMonthDateRange,
    isExpiryInMonthRange,
  };
}

/**
 * Compute shared compliance insights from repository-loaded compliance rows.
 *
 * @param {object[]} rows
 * @param {object} [settings]
 * @param {string|Date} [asOfDate]
 */
export function computeComplianceInsights(rows, settings = DEFAULT_REMINDER_SETTINGS, asOfDate) {
  const inputRows = Array.isArray(rows) ? rows : [];
  const normalizedRows = inputRows.map(normalizeComplianceRow);
  const ctx = createInsightsContext(asOfDate, settings);

  const expiryHealth = computeExpiryHealth(normalizedRows, ctx);
  const evidenceHealth = computeEvidenceHealth(normalizedRows, ctx);
  const actionHealth = computeActionHealth(normalizedRows, ctx);
  const operationalHealth = computeOperationalHealth(normalizedRows, ctx);
  const compositeHealthScore = computeCompositeHealthScore(
    expiryHealth,
    evidenceHealth,
    actionHealth,
    operationalHealth,
    normalizedRows.length
  );
  const risk = computeRiskSummary(normalizedRows, ctx);
  const forecast = computeRenewalForecast(normalizedRows, ctx);
  const evidenceGaps = computeEvidenceGaps(normalizedRows, ctx);
  const contactReadiness = computeContactReadiness(normalizedRows, ctx);

  return {
    recordCount: normalizedRows.length,
    asOfDate: ctx.asOfDateISO,
    expiryHealth,
    evidenceHealth,
    actionHealth,
    operationalHealth,
    compositeHealthScore,
    risk,
    forecast,
    evidenceGaps,
    contactReadiness,
  };
}
