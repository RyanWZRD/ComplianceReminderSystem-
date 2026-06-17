import { COMPLIANCE_INSIGHT_DRILLDOWN_TYPES } from "./compliance-insights-drilldowns.js";
import { STALE_EVIDENCE_DAYS } from "./insights-engine.js";

/** @typedef {import("./insights-engine.js").NormalizedComplianceRow} NormalizedComplianceRow */

/**
 * @typedef {"critical" | "high" | "medium" | "low"} RecommendationPriority
 * @typedef {"expiry" | "evidence" | "actions" | "forecast"} RecommendationCategory
 */

/**
 * @typedef {object} ComplianceRecommendation
 * @property {string} id
 * @property {RecommendationPriority} priority
 * @property {RecommendationCategory} category
 * @property {string} title
 * @property {string} description
 * @property {number} affectedCount
 * @property {string} drilldownKey
 * @property {number} sortOrder
 */

/**
 * Minimum counts before a forecast/expiry recommendation is shown.
 * Each rule fires when the metric is **strictly greater than** the threshold
 * (e.g. threshold `0` means any count ≥ 1 triggers the recommendation).
 *
 * @typedef {object} RecommendationThresholds
 * @property {number} expiringWithin30Days
 * @property {number} expiringNextMonth
 */

export const RECOMMENDATION_PRIORITIES = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export const RECOMMENDATION_PRIORITY_LABELS = {
  critical: "Critical",
  high: "High priority",
  medium: "Medium",
  low: "Low",
};

export const RECOMMENDATION_CATEGORIES = {
  EXPIRY: "expiry",
  EVIDENCE: "evidence",
  ACTIONS: "actions",
  FORECAST: "forecast",
  OPERATIONAL: "operational",
};

/** Default recommendation count thresholds (override via `generateComplianceRecommendations`). */
export const DEFAULT_RECOMMENDATION_THRESHOLDS = {
  expiringWithin30Days: 0,
  expiringNextMonth: 0,
};

const PRIORITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * @param {RecommendationPriority} priority
 * @returns {string}
 */
export function getRecommendationPriorityLabel(priority) {
  return RECOMMENDATION_PRIORITY_LABELS[priority] || priority;
}

/**
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string}
 */
function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Human-readable stale-evidence age derived from {@link STALE_EVIDENCE_DAYS}.
 * @returns {string}
 */
function staleEvidenceAgeLabel() {
  const months = Math.round(STALE_EVIDENCE_DAYS / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

/**
 * @param {ComplianceRecommendation} recommendation
 * @returns {ComplianceRecommendation}
 */
function finalizeRecommendation(recommendation) {
  return {
    ...recommendation,
    affectedCount: Number(recommendation.affectedCount) || 0,
  };
}

/**
 * @param {ReturnType<import("./insights-engine.js").computeComplianceInsights>} insights
 * @param {RecommendationThresholds} thresholds
 * @returns {ComplianceRecommendation[]}
 */
function buildRecommendationRules(insights, thresholds) {
  const { risk, forecast } = insights;
  /** @type {ComplianceRecommendation[]} */
  const recommendations = [];
  const staleAge = staleEvidenceAgeLabel();

  if (risk.expiredRecords > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "expiry-expired-records",
        priority: RECOMMENDATION_PRIORITIES.CRITICAL,
        category: RECOMMENDATION_CATEGORIES.EXPIRY,
        title: "Renew expired compliance records",
        description: `${countLabel(risk.expiredRecords, "expired record")} ${risk.expiredRecords === 1 ? "needs" : "need"} immediate renewal.`,
        affectedCount: risk.expiredRecords,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED,
        sortOrder: 10,
      })
    );
  }

  if (risk.expiredWithActiveActions > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "actions-expired-active-actions",
        priority: RECOMMENDATION_PRIORITIES.CRITICAL,
        category: RECOMMENDATION_CATEGORIES.ACTIONS,
        title: "Complete actions on expired records",
        description: `${countLabel(risk.expiredWithActiveActions, "expired record")} still ${risk.expiredWithActiveActions === 1 ? "has" : "have"} open or in-progress actions.`,
        affectedCount: risk.expiredWithActiveActions,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED_ACTIVE_ACTIONS,
        sortOrder: 20,
      })
    );
  }

  const evidenceGaps = insights.evidenceGaps?.byTier;

  if (evidenceGaps?.critical > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "evidence-critical-gaps",
        priority: RECOMMENDATION_PRIORITIES.CRITICAL,
        category: RECOMMENDATION_CATEGORIES.EVIDENCE,
        title: "Close critical evidence gaps",
        description: `${countLabel(evidenceGaps.critical, "record")} ${evidenceGaps.critical === 1 ? "has" : "have"} a critical evidence gap — expired or due within 30 days with no valid evidence.`,
        affectedCount: evidenceGaps.critical,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS,
        sortOrder: 15,
      })
    );
  }

  if (forecast.expiringWithin30Days > thresholds.expiringWithin30Days) {
    recommendations.push(
      finalizeRecommendation({
        id: "expiry-expiring-within-30-days",
        priority: RECOMMENDATION_PRIORITIES.HIGH,
        category: RECOMMENDATION_CATEGORIES.EXPIRY,
        title: "Schedule renewals within 30 days",
        description: `${countLabel(forecast.expiringWithin30Days, "record")} ${forecast.expiringWithin30Days === 1 ? "expires" : "expire"} in the next 30 days.`,
        affectedCount: forecast.expiringWithin30Days,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_30_DAYS,
        sortOrder: 30,
      })
    );
  }

  if (evidenceGaps?.high > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "evidence-high-gaps",
        priority: RECOMMENDATION_PRIORITIES.HIGH,
        category: RECOMMENDATION_CATEGORIES.EVIDENCE,
        title: "Add evidence for upcoming renewals",
        description: `${countLabel(evidenceGaps.high, "record")} expiring within 31–90 days ${evidenceGaps.high === 1 ? "has" : "have"} no evidence on file.`,
        affectedCount: evidenceGaps.high,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.HIGH_EVIDENCE_GAPS,
        sortOrder: 35,
      })
    );
  }

  if (risk.overdueActions > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "actions-overdue-actions",
        priority: RECOMMENDATION_PRIORITIES.HIGH,
        category: RECOMMENDATION_CATEGORIES.ACTIONS,
        title: "Follow up overdue actions",
        description: `${countLabel(risk.overdueActions, "overdue action")} ${risk.overdueActions === 1 ? "is" : "are"} past ${risk.overdueActions === 1 ? "its" : "their"} due date.`,
        affectedCount: risk.overdueActions,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.OVERDUE_ACTIONS,
        sortOrder: 50,
      })
    );
  }

  const operational = insights.operationalHealth;

  if (
    operational?.available &&
    operational.recordsMissingReminderActivity > 0
  ) {
    recommendations.push(
      finalizeRecommendation({
        id: "operational-missing-reminder-activity",
        priority: RECOMMENDATION_PRIORITIES.HIGH,
        category: RECOMMENDATION_CATEGORIES.OPERATIONAL,
        title: "Record reminder follow-up",
        description: `${countLabel(operational.recordsMissingReminderActivity, "record")} in active reminder windows ${operational.recordsMissingReminderActivity === 1 ? "has" : "have"} no recorded reminder follow-up.`,
        affectedCount: operational.recordsMissingReminderActivity,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY,
        sortOrder: 45,
      })
    );
  }

  if (evidenceGaps?.stale > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "evidence-stale-records",
        priority: RECOMMENDATION_PRIORITIES.MEDIUM,
        category: RECOMMENDATION_CATEGORIES.EVIDENCE,
        title: "Refresh stale-only evidence",
        description: `${countLabel(evidenceGaps.stale, "record")} outside critical or high evidence gap tiers ${evidenceGaps.stale === 1 ? "has" : "have"} evidence older than ${staleAge}.`,
        affectedCount: evidenceGaps.stale,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE_RECORDS,
        sortOrder: 60,
      })
    );
  }

  if (forecast.expiringNextMonth > thresholds.expiringNextMonth) {
    recommendations.push(
      finalizeRecommendation({
        id: "forecast-expiring-next-month",
        priority: RECOMMENDATION_PRIORITIES.MEDIUM,
        category: RECOMMENDATION_CATEGORIES.FORECAST,
        title: "Plan renewals for next month",
        description: `${countLabel(forecast.expiringNextMonth, "record")} ${forecast.expiringNextMonth === 1 ? "expires" : "expire"} during the next calendar month.`,
        affectedCount: forecast.expiringNextMonth,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_NEXT_MONTH,
        sortOrder: 70,
      })
    );
  }

  return recommendations;
}

/**
 * Generate actionable recommendations from computed compliance insights.
 *
 * Rule-based only — no AI/LLM. Each recommendation links to an existing
 * compliance insight drilldown via `drilldownKey`.
 *
 * @param {ReturnType<import("./insights-engine.js").computeComplianceInsights>} insights
 * @param {NormalizedComplianceRow[] | object[]} [rows]
 * @param {Partial<RecommendationThresholds>} [thresholdOverrides]
 * @returns {ComplianceRecommendation[]}
 */
export function generateComplianceRecommendations(
  insights,
  rows = [],
  thresholdOverrides = {}
) {
  if (!insights || insights.recordCount === 0) {
    return [];
  }

  const inputRows = Array.isArray(rows) ? rows : [];

  if (inputRows.length === 0 && insights.recordCount === 0) {
    return [];
  }

  const thresholds = {
    ...DEFAULT_RECOMMENDATION_THRESHOLDS,
    ...thresholdOverrides,
  };

  const recommendations = buildRecommendationRules(insights, thresholds);

  return recommendations.sort((a, b) => {
    const priorityCompare = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

    if (priorityCompare !== 0) {
      return priorityCompare;
    }

    return a.sortOrder - b.sortOrder;
  });
}

/**
 * @param {ComplianceRecommendation[]} recommendations
 * @returns {ComplianceRecommendation["priority"][]}
 */
export function getRecommendationPriorityOrder(recommendations) {
  return recommendations.map((item) => item.priority);
}
