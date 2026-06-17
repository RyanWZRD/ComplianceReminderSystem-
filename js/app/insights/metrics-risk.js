/**
 * @param {import("./insights-engine.js").NormalizedComplianceRow[]} rows
 * @param {import("./insights-engine.js").InsightsContext} ctx
 */
export function computeRiskSummary(rows, ctx) {
  let expiredRecords = 0;
  let dueSoonRecords = 0;
  let invalidExpiryRecords = 0;
  let missingEvidenceRecords = 0;
  let staleEvidenceRecords = 0;
  let openActions = 0;
  let inProgressActions = 0;
  let overdueActions = 0;
  let expiredWithActiveActions = 0;
  let openActionsOnExpiredRecords = 0;

  rows.forEach((row) => {
    const status = ctx.getExpiryStatus(row.expiryDate);
    const evidenceItems = Array.isArray(row.evidence) ? row.evidence : [];
    const actions = Array.isArray(row.actions) ? row.actions : [];

    if (status.key === "expired") {
      expiredRecords += 1;
    } else if (status.key === "dueSoon") {
      dueSoonRecords += 1;
    } else if (status.key === "invalid") {
      invalidExpiryRecords += 1;
    }

    if (evidenceItems.length === 0) {
      missingEvidenceRecords += 1;
    } else if (evidenceItems.some((item) => ctx.isEvidenceStale(item.addedDate))) {
      staleEvidenceRecords += 1;
    }

    let activeCount = 0;

    actions.forEach((action) => {
      const actionStatus = ctx.getActionStatus(action);

      if (actionStatus === "open") {
        openActions += 1;
        activeCount += 1;
      } else if (actionStatus === "in_progress") {
        inProgressActions += 1;
        activeCount += 1;
      }

      if (ctx.isActionOverdue(action)) {
        overdueActions += 1;
      }
    });

    if (activeCount > 0 && status.key === "expired") {
      expiredWithActiveActions += 1;
      openActionsOnExpiredRecords += actions.filter(
        (action) => ctx.getActionStatus(action) === "open"
      ).length;
    }
  });

  return {
    expiredRecords,
    dueSoonRecords,
    invalidExpiryRecords,
    missingEvidenceRecords,
    staleEvidenceRecords,
    openActions,
    inProgressActions,
    overdueActions,
    expiredWithActiveActions,
    openActionsOnExpiredRecords,
    totalAtRiskRecords:
      expiredRecords +
      missingEvidenceRecords +
      staleEvidenceRecords +
      expiredWithActiveActions,
  };
}
