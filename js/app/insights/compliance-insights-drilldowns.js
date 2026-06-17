import { ACTION_STATUSES } from "../../data/constants.js";
import { filterRecordsMissingReminderActivity, getActiveReminderType, hasReminderActivityForType } from "./metrics-operational.js";
import {
  EVIDENCE_GAP_TIERS,
  getNewestEvidenceDate,
  getEvidenceGapRecommendedAction,
  classifyEvidenceGapTier,
} from "./metrics-evidence-gaps.js";

/** @typedef {import("./insights-engine.js").NormalizedComplianceRow} NormalizedComplianceRow */
/** @typedef {import("./insights-engine.js").InsightsContext} InsightsContext */

export const COMPLIANCE_INSIGHT_DRILLDOWN_TYPES = {
  EXPIRED: "expired-records",
  MISSING_EVIDENCE: "missing-evidence",
  STALE_EVIDENCE: "stale-evidence",
  OVERDUE_ACTIONS: "overdue-actions",
  EXPIRED_ACTIVE_ACTIONS: "expired-active-actions",
  EXPIRING_THIS_MONTH: "expiring-this-month",
  EXPIRING_NEXT_MONTH: "expiring-next-month",
  EXPIRING_30_DAYS: "expiring-within-30-days",
  EXPIRING_90_DAYS: "expiring-within-90-days",
  MISSING_REMINDER_ACTIVITY: "missing-reminder-activity",
  CRITICAL_EVIDENCE_GAPS: "critical-evidence-gaps",
  HIGH_EVIDENCE_GAPS: "high-evidence-gaps",
  STALE_EVIDENCE_RECORDS: "stale-evidence-records",
};

export const COMPLIANCE_INSIGHT_REMINDER_ACTIVITY_PREVIEW_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "complianceType", label: "Compliance Type" },
  { key: "expiryDate", label: "Expiry Date" },
  { key: "status", label: "Status" },
  { key: "reminderWindow", label: "Reminder Window" },
  { key: "reminderActivityStatus", label: "Reminder Activity Status" },
];

export const COMPLIANCE_INSIGHT_EVIDENCE_GAP_PREVIEW_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "complianceType", label: "Compliance Type" },
  { key: "expiryDate", label: "Expiry Date" },
  { key: "status", label: "Status" },
  { key: "evidenceCount", label: "Evidence Count" },
  { key: "newestEvidenceDate", label: "Newest Evidence" },
  { key: "gapTier", label: "Gap Tier" },
  { key: "recommendedAction", label: "Recommended Action" },
];

export const COMPLIANCE_INSIGHT_RECORD_PREVIEW_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "complianceType", label: "Compliance Type" },
  { key: "expiryDate", label: "Expiry Date" },
  { key: "status", label: "Status" },
  { key: "evidenceCount", label: "Evidence Count" },
];

export const COMPLIANCE_INSIGHT_RECORD_WITH_ACTIONS_PREVIEW_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "complianceType", label: "Compliance Type" },
  { key: "expiryDate", label: "Expiry Date" },
  { key: "status", label: "Status" },
  { key: "evidenceCount", label: "Evidence Count" },
  { key: "activeActionCount", label: "Active Actions" },
];

export const COMPLIANCE_INSIGHT_ACTION_PREVIEW_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "complianceType", label: "Compliance Type" },
  { key: "actionTitle", label: "Action Title" },
  { key: "status", label: "Status" },
  { key: "dueDate", label: "Due Date" },
  { key: "expiryDate", label: "Expiry Date" },
];

const DRILLDOWN_META = {
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED]: {
    title: "Expired Records",
    emptyMessage: "No expired compliance records.",
    previewDescription:
      "Records whose expiry date is in the past. Renew or update these records to restore compliance.",
    filename: "compliance-insight-expired_records.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_EVIDENCE]: {
    title: "Records Missing Evidence",
    emptyMessage: "All records have at least one evidence item attached.",
    previewDescription:
      "Records with no evidence items on file. Attach supporting documentation to improve evidence health.",
    filename: "compliance-insight-missing_evidence.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE]: {
    title: "Records With Stale Evidence",
    emptyMessage: "No records have evidence older than 12 months.",
    previewDescription:
      "Records where at least one evidence item is older than 12 months. Refresh or replace outdated documentation.",
    filename: "compliance-insight-stale_evidence.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.OVERDUE_ACTIONS]: {
    title: "Overdue Actions",
    emptyMessage: "No actions are past their due date.",
    previewDescription:
      "Individual actions whose due date has passed. Each row is one overdue action linked to a compliance record.",
    filename: "compliance-insight-overdue_actions.csv",
    itemLabel: "Actions",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED_ACTIVE_ACTIONS]: {
    title: "Expired Records With Active Actions",
    emptyMessage: "No expired records have open or in-progress actions.",
    previewDescription:
      "Expired records that still have open or in-progress actions. Close or complete actions on expired records.",
    filename: "compliance-insight-expired_active_actions.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_THIS_MONTH]: {
    title: "Expiring This Month",
    emptyMessage: "No non-expired records expire in the current calendar month.",
    previewDescription:
      "Non-expired records whose expiry date falls in the current calendar month.",
    filename: "compliance-insight-expiring_this_month.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_NEXT_MONTH]: {
    title: "Expiring Next Month",
    emptyMessage: "No records expire in the next calendar month.",
    previewDescription: "Records whose expiry date falls in the next calendar month.",
    filename: "compliance-insight-expiring_next_month.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_30_DAYS]: {
    title: "Expiring Within 30 Days",
    emptyMessage: "No records expire within the next 30 days.",
    previewDescription:
      "Records expiring within the next 30 days (inclusive), based on expiry date.",
    filename: "compliance-insight-expiring_within_30_days.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_90_DAYS]: {
    title: "Expiring Within 90 Days",
    emptyMessage: "No records expire within the next 90 days.",
    previewDescription:
      "Records expiring within the next 90 days (inclusive), based on expiry date.",
    filename: "compliance-insight-expiring_within_90_days.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY]: {
    title: "Records Missing Reminder Follow-up",
    emptyMessage: "No records are missing reminder follow-up.",
    previewDescription:
      "These records are in an active reminder window (expired, 7-, 14-, or 30-day) but have no reminder sent marker in notes or reminder_sent history for that window.",
    filename: "compliance-insight-missing_reminder_activity.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS]: {
    title: "Critical Evidence Gaps",
    emptyMessage: "No records have critical evidence gaps.",
    previewDescription:
      "Records that are expired or expire within 30 days with no evidence, or where all evidence is stale.",
    filename: "compliance-insight-critical_evidence_gaps.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.HIGH_EVIDENCE_GAPS]: {
    title: "High Evidence Gaps",
    emptyMessage: "No records have high-priority evidence gaps.",
    previewDescription:
      "Records expiring within 31–90 days that have no evidence on file.",
    filename: "compliance-insight-high_evidence_gaps.csv",
    itemLabel: "Records",
  },
  [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE_RECORDS]: {
    title: "Stale Evidence Records",
    emptyMessage: "No records have stale evidence outside critical or high tiers.",
    previewDescription:
      "Records with evidence on file where the newest item is older than 12 months. Excludes records already classified as critical or high evidence gaps.",
    filename: "compliance-insight-stale_evidence_records.csv",
    itemLabel: "Records",
  },
};

/**
 * @param {string} drilldownType
 * @returns {boolean}
 */
export function isActionLevelDrilldown(drilldownType) {
  return drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.OVERDUE_ACTIONS;
}

/**
 * @param {NormalizedComplianceRow} row
 * @param {InsightsContext} ctx
 * @returns {number}
 */
function getActiveActionCount(row, ctx) {
  const actions = Array.isArray(row.actions) ? row.actions : [];

  return actions.filter((action) => {
    const status = ctx.getActionStatus(action);
    return status === ACTION_STATUSES.OPEN || status === ACTION_STATUSES.IN_PROGRESS;
  }).length;
}

/**
 * @param {string} drilldownType
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 * @returns {NormalizedComplianceRow[]}
 */
export function filterComplianceInsightDrilldownRecords(drilldownType, rows, ctx) {
  if (isActionLevelDrilldown(drilldownType)) {
    return [];
  }

  return rows.filter((row) => {
    const status = ctx.getExpiryStatus(row.expiryDate);
    const evidenceItems = Array.isArray(row.evidence) ? row.evidence : [];
    const daysRemaining = ctx.getDaysUntilExpiry(row.expiryDate);

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED) {
      return status.key === "expired";
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_EVIDENCE) {
      return evidenceItems.length === 0;
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE) {
      return (
        evidenceItems.length > 0 &&
        evidenceItems.some((item) => ctx.isEvidenceStale(item.addedDate))
      );
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED_ACTIVE_ACTIONS) {
      return status.key === "expired" && getActiveActionCount(row, ctx) > 0;
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_THIS_MONTH) {
      return status.key !== "expired" && ctx.isExpiryInMonthRange(row.expiryDate, 0);
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_NEXT_MONTH) {
      return ctx.isExpiryInMonthRange(row.expiryDate, 1);
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_30_DAYS) {
      return !Number.isNaN(daysRemaining) && daysRemaining >= 0 && daysRemaining <= 30;
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_90_DAYS) {
      return !Number.isNaN(daysRemaining) && daysRemaining >= 0 && daysRemaining <= 90;
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY) {
      return filterRecordsMissingReminderActivity([row], ctx).length > 0;
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS) {
      return classifyEvidenceGapTier(row, ctx) === EVIDENCE_GAP_TIERS.CRITICAL;
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.HIGH_EVIDENCE_GAPS) {
      return classifyEvidenceGapTier(row, ctx) === EVIDENCE_GAP_TIERS.HIGH;
    }

    if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE_RECORDS) {
      return classifyEvidenceGapTier(row, ctx) === EVIDENCE_GAP_TIERS.STALE;
    }

    return false;
  });
}

/**
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 * @returns {Array<{ row: NormalizedComplianceRow, action: object }>}
 */
export function flattenOverdueActionEntries(rows, ctx) {
  /** @type {Array<{ row: NormalizedComplianceRow, action: object }>} */
  const entries = [];

  rows.forEach((row) => {
    const actions = Array.isArray(row.actions) ? row.actions : [];

    actions.forEach((action) => {
      if (ctx.isActionOverdue(action)) {
        entries.push({ row, action });
      }
    });
  });

  return entries;
}

/**
 * Map a record to missing-reminder-activity preview fields (dates unformatted).
 *
 * @param {NormalizedComplianceRow} row
 * @param {InsightsContext} ctx
 */
export function mapMissingReminderActivityPreviewRow(row, ctx) {
  const status = ctx.getExpiryStatus(row.expiryDate);
  const reminderWindow = getActiveReminderType(row.expiryDate, ctx.settings, ctx) || "—";
  const hasActivity =
    reminderWindow !== "—" && hasReminderActivityForType(row, reminderWindow);

  return {
    name: row.name,
    role: row.role,
    complianceType: row.complianceType,
    expiryDate: row.expiryDate,
    status: status.label,
    reminderWindow,
    reminderActivityStatus: hasActivity ? "Recorded" : "Missing",
  };
}

export function mapEvidenceGapPreviewRow(row, ctx) {
  const status = ctx.getExpiryStatus(row.expiryDate);
  const evidenceItems = Array.isArray(row.evidence) ? row.evidence : [];
  const tier = classifyEvidenceGapTier(row, ctx);

  return {
    name: row.name,
    role: row.role,
    complianceType: row.complianceType,
    expiryDate: row.expiryDate,
    status: status.label,
    evidenceCount: String(evidenceItems.length),
    newestEvidenceDate: getNewestEvidenceDate(evidenceItems) || "—",
    gapTier: tier || "—",
    recommendedAction: tier ? getEvidenceGapRecommendedAction(tier) : "—",
  };
}

/**
 * @param {string} drilldownType
 * @returns {Array<{ key: string, label: string }>}
 */
export function getComplianceInsightDrilldownColumns(drilldownType) {
  if (isActionLevelDrilldown(drilldownType)) {
    return COMPLIANCE_INSIGHT_ACTION_PREVIEW_COLUMNS;
  }

  if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED_ACTIVE_ACTIONS) {
    return COMPLIANCE_INSIGHT_RECORD_WITH_ACTIONS_PREVIEW_COLUMNS;
  }

  if (drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY) {
    return COMPLIANCE_INSIGHT_REMINDER_ACTIVITY_PREVIEW_COLUMNS;
  }

  if (
    drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS ||
    drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.HIGH_EVIDENCE_GAPS ||
    drilldownType === COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE_RECORDS
  ) {
    return COMPLIANCE_INSIGHT_EVIDENCE_GAP_PREVIEW_COLUMNS;
  }

  return COMPLIANCE_INSIGHT_RECORD_PREVIEW_COLUMNS;
}

/**
 * @param {string} drilldownType
 * @returns {{ title: string, emptyMessage: string, filename: string, itemLabel: string }}
 */
export function getComplianceInsightDrilldownMeta(drilldownType) {
  return (
    DRILLDOWN_META[drilldownType] || {
      title: "Compliance Insight",
      emptyMessage: "No matching records.",
      previewDescription: "",
      filename: "compliance-insight-preview.csv",
      itemLabel: "Records",
    }
  );
}

/**
 * @param {string} drilldownType
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 * @returns {number}
 */
export function countComplianceInsightDrilldownMatches(drilldownType, rows, ctx) {
  if (isActionLevelDrilldown(drilldownType)) {
    return flattenOverdueActionEntries(rows, ctx).length;
  }

  return filterComplianceInsightDrilldownRecords(drilldownType, rows, ctx).length;
}

/**
 * Map drilldown counts to insights risk/forecast metrics for verification.
 *
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 * @returns {Record<string, number>}
 */
export function getExpectedDrilldownCounts(rows, ctx) {
  return {
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED]: countComplianceInsightDrilldownMatches(
      COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED,
      rows,
      ctx
    ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_EVIDENCE]: countComplianceInsightDrilldownMatches(
      COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_EVIDENCE,
      rows,
      ctx
    ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE]: countComplianceInsightDrilldownMatches(
      COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE,
      rows,
      ctx
    ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.OVERDUE_ACTIONS]: countComplianceInsightDrilldownMatches(
      COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.OVERDUE_ACTIONS,
      rows,
      ctx
    ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED_ACTIVE_ACTIONS]:
      countComplianceInsightDrilldownMatches(
        COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED_ACTIVE_ACTIONS,
        rows,
        ctx
      ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_THIS_MONTH]:
      countComplianceInsightDrilldownMatches(
        COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_THIS_MONTH,
        rows,
        ctx
      ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_NEXT_MONTH]:
      countComplianceInsightDrilldownMatches(
        COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_NEXT_MONTH,
        rows,
        ctx
      ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_30_DAYS]: countComplianceInsightDrilldownMatches(
      COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_30_DAYS,
      rows,
      ctx
    ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_90_DAYS]: countComplianceInsightDrilldownMatches(
      COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_90_DAYS,
      rows,
      ctx
    ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY]:
      countComplianceInsightDrilldownMatches(
        COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY,
        rows,
        ctx
      ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS]:
      countComplianceInsightDrilldownMatches(
        COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS,
        rows,
        ctx
      ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.HIGH_EVIDENCE_GAPS]:
      countComplianceInsightDrilldownMatches(
        COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.HIGH_EVIDENCE_GAPS,
        rows,
        ctx
      ),
    [COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE_RECORDS]:
      countComplianceInsightDrilldownMatches(
        COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE_RECORDS,
        rows,
        ctx
      ),
  };
}
