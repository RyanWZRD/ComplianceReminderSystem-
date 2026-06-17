import { ACTION_STATUSES } from "../../data/constants.js";

/**
 * @param {import("./insights-engine.js").NormalizedComplianceRow[]} rows
 * @param {import("./insights-engine.js").InsightsContext} ctx
 */
export function computeExpiryHealth(rows, ctx) {
  const counts = {
    total: rows.length,
    valid: 0,
    dueSoon: 0,
    expired: 0,
    invalidDate: 0,
    expiringWithin30: 0,
    expiringWithin60: 0,
    expiringWithin90: 0,
  };

  rows.forEach((row) => {
    const status = ctx.getExpiryStatus(row.expiryDate);

    if (status.key === "invalid") {
      counts.invalidDate += 1;
      return;
    }

    counts[status.key] += 1;

    const daysRemaining = ctx.getDaysUntilExpiry(row.expiryDate);

    if (daysRemaining >= 0 && daysRemaining <= 30) {
      counts.expiringWithin30 += 1;
    }
    if (daysRemaining >= 0 && daysRemaining <= 60) {
      counts.expiringWithin60 += 1;
    }
    if (daysRemaining >= 0 && daysRemaining <= 90) {
      counts.expiringWithin90 += 1;
    }
  });

  const scorableTotal = rows.length - counts.invalidDate;
  counts.score =
    scorableTotal === 0 ? 0 : Math.round((counts.valid / scorableTotal) * 100);

  return counts;
}

/**
 * @param {import("./insights-engine.js").NormalizedComplianceRow[]} rows
 * @param {import("./insights-engine.js").InsightsContext} ctx
 */
export function computeEvidenceHealth(rows, ctx) {
  const counts = {
    total: rows.length,
    withEvidence: 0,
    missingEvidence: 0,
    staleEvidence: 0,
  };

  rows.forEach((row) => {
    const evidenceItems = Array.isArray(row.evidence) ? row.evidence : [];

    if (evidenceItems.length === 0) {
      counts.missingEvidence += 1;
      return;
    }

    counts.withEvidence += 1;

    if (evidenceItems.some((item) => ctx.isEvidenceStale(item.addedDate))) {
      counts.staleEvidence += 1;
    }
  });

  counts.coveragePercent =
    counts.total === 0 ? 0 : Math.round((counts.withEvidence / counts.total) * 100);
  counts.score = counts.coveragePercent;

  return counts;
}

function summarizeActions(actions, ctx) {
  const items = Array.isArray(actions) ? actions : [];
  let openCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  let overdueCount = 0;
  let dueThisWeekCount = 0;

  items.forEach((item) => {
    const status = ctx.getActionStatus(item);

    if (status === ACTION_STATUSES.COMPLETED) {
      completedCount += 1;
    } else if (status === ACTION_STATUSES.IN_PROGRESS) {
      inProgressCount += 1;
    } else {
      openCount += 1;
    }

    if (ctx.isActionOverdue(item)) {
      overdueCount += 1;
    }

    if (ctx.isActionDueThisWeek(item)) {
      dueThisWeekCount += 1;
    }
  });

  return {
    openCount,
    inProgressCount,
    completedCount,
    activeCount: openCount + inProgressCount,
    overdueCount,
    dueThisWeekCount,
  };
}

/**
 * @param {import("./insights-engine.js").NormalizedComplianceRow[]} rows
 * @param {import("./insights-engine.js").InsightsContext} ctx
 */
export function computeActionHealth(rows, ctx) {
  const counts = {
    totalRecords: rows.length,
    openActions: 0,
    inProgressActions: 0,
    completedActions: 0,
    overdueActions: 0,
    dueThisWeekActions: 0,
    recordsWithActiveActions: 0,
    recordsWithoutActionRisk: 0,
    expiredRecordsWithActiveActions: 0,
  };

  rows.forEach((row) => {
    const summary = summarizeActions(row.actions, ctx);
    const status = ctx.getExpiryStatus(row.expiryDate);

    counts.openActions += summary.openCount;
    counts.inProgressActions += summary.inProgressCount;
    counts.completedActions += summary.completedCount;
    counts.overdueActions += summary.overdueCount;
    counts.dueThisWeekActions += summary.dueThisWeekCount;

    if (summary.activeCount > 0) {
      counts.recordsWithActiveActions += 1;
    }

    if (summary.activeCount > 0 && status.key === "expired") {
      counts.expiredRecordsWithActiveActions += 1;
    }

    const hasActionRisk =
      summary.overdueCount > 0 ||
      (summary.activeCount > 0 && status.key === "expired");

    if (!hasActionRisk) {
      counts.recordsWithoutActionRisk += 1;
    }
  });

  counts.score =
    counts.totalRecords === 0
      ? 0
      : Math.round((counts.recordsWithoutActionRisk / counts.totalRecords) * 100);

  return counts;
}

/**
 * Composite score = rounded average of expiry, evidence, and action dimension scores.
 *
 * @param {{ score: number }} expiryHealth
 * @param {{ score: number }} evidenceHealth
 * @param {{ score: number }} actionHealth
 */
export function computeCompositeHealthScore(expiryHealth, evidenceHealth, actionHealth) {
  return Math.round(
    (expiryHealth.score + evidenceHealth.score + actionHealth.score) / 3
  );
}
