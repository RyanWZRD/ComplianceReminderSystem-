import { computeComplianceInsights } from "./insights-engine.js";

/** @type {ReturnType<typeof computeComplianceInsights> | null} */
let cachedInsights = null;

/**
 * Clear cached insights before a dashboard refresh cycle.
 */
export function clearComplianceInsightsCache() {
  cachedInsights = null;
}

/**
 * Return cached compliance insights for the current dashboard refresh.
 *
 * @param {object[]} rows
 * @param {object} settings
 */
export function getComplianceInsights(rows, settings) {
  if (!cachedInsights) {
    cachedInsights = computeComplianceInsights(rows, settings);
  }

  return cachedInsights;
}

/**
 * Map insights expiry health to legacy register summary counts.
 *
 * Legacy `getStatus()` treats invalid expiry dates as "valid" for summary cards.
 */
export function mapInsightsToSummaryCounts(insights) {
  const expiry = insights.expiryHealth;

  return {
    total: insights.recordCount,
    valid: expiry.valid + expiry.invalidDate,
    dueSoon: expiry.dueSoon,
    expired: expiry.expired,
  };
}

/** Map insights action health to legacy global action dashboard metrics. */
export function mapInsightsToGlobalActionMetrics(insights) {
  const action = insights.actionHealth;

  return {
    openActions: action.openActions,
    inProgressActions: action.inProgressActions,
    dueThisWeek: action.dueThisWeekActions,
    overdueActions: action.overdueActions,
    completedActions: action.completedActions,
    expiredWithOpenActions: action.expiredRecordsWithActiveActions,
  };
}

/** Map insights evidence health to legacy management insight evidence fields. */
export function mapInsightsToEvidenceMetrics(insights) {
  return {
    missingEvidenceRecords: insights.evidenceHealth.missingEvidence,
    staleEvidenceRecords: insights.evidenceHealth.staleEvidence,
  };
}

/**
 * Legacy dashboard metrics that intentionally differ from V4-0A insights:
 *
 * - Management health score: valid records with evidence / total (not insights composite).
 * - expiredLinkedOpenActions: sum of active actions on expired records (not record count).
 * - Analytics register health: compliant / total including invalid dates as compliant.
 */
