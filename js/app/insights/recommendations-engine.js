import { COMPLIANCE_INSIGHT_DRILLDOWN_TYPES } from "./compliance-insights-drilldowns.js";

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

export const RECOMMENDATION_CATEGORIES = {
  EXPIRY: "expiry",
  EVIDENCE: "evidence",
  ACTIONS: "actions",
  FORECAST: "forecast",
};

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
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string}
 */
function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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

  if (risk.expiredRecords > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "expiry-expired-records",
        priority: RECOMMENDATION_PRIORITIES.CRITICAL,
        category: RECOMMENDATION_CATEGORIES.EXPIRY,
        title: "Renew expired records",
        description: `${countLabel(risk.expiredRecords, "expired record")} ${risk.expiredRecords === 1 ? "requires" : "require"} immediate renewal.`,
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
        title: "Resolve actions on expired records",
        description: `${countLabel(risk.expiredWithActiveActions, "expired record")} still ${risk.expiredWithActiveActions === 1 ? "has" : "have"} active actions.`,
        affectedCount: risk.expiredWithActiveActions,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED_ACTIVE_ACTIONS,
        sortOrder: 20,
      })
    );
  }

  if (forecast.expiringWithin30Days > thresholds.expiringWithin30Days) {
    recommendations.push(
      finalizeRecommendation({
        id: "expiry-expiring-within-30-days",
        priority: RECOMMENDATION_PRIORITIES.HIGH,
        category: RECOMMENDATION_CATEGORIES.EXPIRY,
        title: "Plan renewals within 30 days",
        description: `${countLabel(forecast.expiringWithin30Days, "record")} ${forecast.expiringWithin30Days === 1 ? "expires" : "expire"} within 30 days.`,
        affectedCount: forecast.expiringWithin30Days,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_30_DAYS,
        sortOrder: 30,
      })
    );
  }

  if (risk.missingEvidenceRecords > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "evidence-missing-evidence",
        priority: RECOMMENDATION_PRIORITIES.HIGH,
        category: RECOMMENDATION_CATEGORIES.EVIDENCE,
        title: "Attach missing evidence",
        description: `${countLabel(risk.missingEvidenceRecords, "record")} have no evidence attached.`,
        affectedCount: risk.missingEvidenceRecords,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_EVIDENCE,
        sortOrder: 40,
      })
    );
  }

  if (risk.overdueActions > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "actions-overdue-actions",
        priority: RECOMMENDATION_PRIORITIES.HIGH,
        category: RECOMMENDATION_CATEGORIES.ACTIONS,
        title: "Review overdue actions",
        description: `${countLabel(risk.overdueActions, "overdue action")} should be reviewed.`,
        affectedCount: risk.overdueActions,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.OVERDUE_ACTIONS,
        sortOrder: 50,
      })
    );
  }

  if (risk.staleEvidenceRecords > 0) {
    recommendations.push(
      finalizeRecommendation({
        id: "evidence-stale-evidence",
        priority: RECOMMENDATION_PRIORITIES.MEDIUM,
        category: RECOMMENDATION_CATEGORIES.EVIDENCE,
        title: "Refresh stale evidence",
        description: `${countLabel(risk.staleEvidenceRecords, "record")} ${risk.staleEvidenceRecords === 1 ? "has" : "have"} evidence older than 12 months.`,
        affectedCount: risk.staleEvidenceRecords,
        drilldownKey: COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE,
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
        title: "Prepare next month renewals",
        description: `${countLabel(forecast.expiringNextMonth, "record")} ${forecast.expiringNextMonth === 1 ? "expires" : "expire"} next month.`,
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
