/**
 * Deterministic verification for the V4-0A Compliance Insights engine,
 * V4-0B dashboard metric mappings, V4-0D drilldown filters, V4-1A recommendations,
 * and V4-1B recommendation polish and thresholds.
 * Uses fixture rows only — no Supabase or browser required.
 */

import { computeComplianceInsights, createInsightsContext, normalizeComplianceRow } from "../js/app/insights/insights-engine.js";
import {
  mapInsightsToEvidenceMetrics,
  mapInsightsToGlobalActionMetrics,
  mapInsightsToSummaryCounts,
} from "../js/app/insights/compliance-insights.js";
import {
  COMPLIANCE_INSIGHT_DRILLDOWN_TYPES,
  getExpectedDrilldownCounts,
} from "../js/app/insights/compliance-insights-drilldowns.js";
import {
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  generateComplianceRecommendations,
  getRecommendationPriorityLabel,
  getRecommendationPriorityOrder,
} from "../js/app/insights/recommendations-engine.js";
import {
  CLOUD_FIXTURE_ROWS,
  EXPECTED_INSIGHTS,
  EXPECTED_RECOMMENDATIONS,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";
import { ACTION_STATUSES } from "../js/data/constants.js";
import { parseDateAtMidnight } from "../js/data/dates.js";

const DUE_SOON_DAYS = 90;
const STALE_EVIDENCE_DAYS = 365;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    console.error(`FAIL ${label}`);
    console.error("Expected:", expectedJson);
    console.error("Actual:  ", actualJson);
    process.exit(1);
  }
}

function verifyInsights(label, rows) {
  const insights = computeComplianceInsights(rows, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);

  assertEqual(insights.recordCount, EXPECTED_INSIGHTS.recordCount, `${label} recordCount`);
  assertEqual(insights.asOfDate, EXPECTED_INSIGHTS.asOfDate, `${label} asOfDate`);
  assertEqual(
    insights.compositeHealthScore,
    EXPECTED_INSIGHTS.compositeHealthScore,
    `${label} compositeHealthScore`
  );
  assertDeepEqual(insights.expiryHealth, EXPECTED_INSIGHTS.expiryHealth, `${label} expiryHealth`);
  assertDeepEqual(insights.evidenceHealth, EXPECTED_INSIGHTS.evidenceHealth, `${label} evidenceHealth`);
  assertDeepEqual(insights.actionHealth, EXPECTED_INSIGHTS.actionHealth, `${label} actionHealth`);
  assertDeepEqual(
    insights.operationalHealth,
    EXPECTED_INSIGHTS.operationalHealth,
    `${label} operationalHealth`
  );
  assertDeepEqual(insights.risk, EXPECTED_INSIGHTS.risk, `${label} risk`);
  assertDeepEqual(insights.forecast, EXPECTED_INSIGHTS.forecast, `${label} forecast`);
}

function getLegacyStatus(expiryDate, asOfDate) {
  const expiry = parseDateAtMidnight(expiryDate);
  const asOf = parseDateAtMidnight(asOfDate);
  const diffMs = expiry.getTime() - asOf.getTime();
  const daysUntilExpiry = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Number.isNaN(daysUntilExpiry)) {
    return "valid";
  }
  if (daysUntilExpiry < 0) {
    return "expired";
  }
  if (daysUntilExpiry <= DUE_SOON_DAYS) {
    return "dueSoon";
  }
  return "valid";
}

function getLegacyActionStatus(actionItem) {
  if (
    actionItem.status === ACTION_STATUSES.IN_PROGRESS ||
    actionItem.status === ACTION_STATUSES.COMPLETED ||
    actionItem.status === ACTION_STATUSES.OPEN
  ) {
    return actionItem.status;
  }

  return actionItem.completed ? ACTION_STATUSES.COMPLETED : ACTION_STATUSES.OPEN;
}

function normalizeFixtureRows(rows) {
  return rows.map(normalizeComplianceRow);
}

function computeLegacySummaryCounts(rows, asOfDate) {
  const counts = { total: 0, valid: 0, dueSoon: 0, expired: 0 };

  normalizeFixtureRows(rows).forEach((row) => {
    counts.total += 1;
    const status = getLegacyStatus(row.expiryDate, asOfDate);
    counts[status] += 1;
  });

  return counts;
}

function computeLegacyGlobalActionMetrics(rows, asOfDate) {
  let openActions = 0;
  let inProgressActions = 0;
  let dueThisWeek = 0;
  let overdueActions = 0;
  let completedActions = 0;
  let expiredWithOpenActions = 0;
  const asOf = parseDateAtMidnight(asOfDate);
  const day = asOf.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(asOf);
  weekStart.setDate(asOf.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  rows.forEach((row) => {
    const normalizedRow = normalizeComplianceRow(row);
    const actions = Array.isArray(normalizedRow.actions) ? normalizedRow.actions : [];
    let openCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let activeCount = 0;

    actions.forEach((action) => {
      const status = getLegacyActionStatus(action);

      if (status === ACTION_STATUSES.COMPLETED) {
        completedCount += 1;
        return;
      }

      if (status === ACTION_STATUSES.IN_PROGRESS) {
        inProgressCount += 1;
      } else {
        openCount += 1;
      }

      activeCount += 1;

      if (action.dueDate) {
        const due = parseDateAtMidnight(action.dueDate);
        if (!Number.isNaN(due.getTime()) && due < asOf) {
          overdueActions += 1;
        }
        if (!Number.isNaN(due.getTime()) && due >= weekStart && due <= weekEnd) {
          dueThisWeek += 1;
        }
      }
    });

    openActions += openCount;
    inProgressActions += inProgressCount;
    completedActions += completedCount;

    if (activeCount > 0 && getLegacyStatus(normalizedRow.expiryDate, asOfDate) === "expired") {
      expiredWithOpenActions += 1;
    }
  });

  return {
    openActions,
    inProgressActions,
    dueThisWeek,
    overdueActions,
    completedActions,
    expiredWithOpenActions,
  };
}

function computeLegacyEvidenceMetrics(rows, asOfDate) {
  const asOf = parseDateAtMidnight(asOfDate);
  let missingEvidenceRecords = 0;
  let staleEvidenceRecords = 0;

  normalizeFixtureRows(rows).forEach((row) => {
    const evidence = Array.isArray(row.evidence) ? row.evidence : [];

    if (evidence.length === 0) {
      missingEvidenceRecords += 1;
      return;
    }

    const hasStale = evidence.some((item) => {
      const added = parseDateAtMidnight(item.addedDate);
      if (Number.isNaN(added.getTime())) {
        return false;
      }
      const ageDays = Math.floor((asOf.getTime() - added.getTime()) / (1000 * 60 * 60 * 24));
      return ageDays > STALE_EVIDENCE_DAYS;
    });

    if (hasStale) {
      staleEvidenceRecords += 1;
    }
  });

  return { missingEvidenceRecords, staleEvidenceRecords };
}

function verifyDashboardMappings(label, rows) {
  const insights = computeComplianceInsights(rows, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
  const summaryCounts = mapInsightsToSummaryCounts(insights);
  const actionMetrics = mapInsightsToGlobalActionMetrics(insights);
  const evidenceMetrics = mapInsightsToEvidenceMetrics(insights);

  assertDeepEqual(
    summaryCounts,
    computeLegacySummaryCounts(rows, FIXTURE_AS_OF_DATE),
    `${label} summary counts mapping`
  );
  assertDeepEqual(
    actionMetrics,
    computeLegacyGlobalActionMetrics(rows, FIXTURE_AS_OF_DATE),
    `${label} action metrics mapping`
  );
  assertDeepEqual(
    evidenceMetrics,
    computeLegacyEvidenceMetrics(rows, FIXTURE_AS_OF_DATE),
    `${label} evidence metrics mapping`
  );
}

function verifyDrilldownCounts(label, rows) {
  const normalizedRows = normalizeFixtureRows(rows);
  const ctx = createInsightsContext(FIXTURE_AS_OF_DATE, FIXTURE_SETTINGS);
  const insights = computeComplianceInsights(rows, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
  const drilldownCounts = getExpectedDrilldownCounts(normalizedRows, ctx);

  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED],
    insights.risk.expiredRecords,
    `${label} drilldown expired records`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_EVIDENCE],
    insights.risk.missingEvidenceRecords,
    `${label} drilldown missing evidence`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE],
    insights.risk.staleEvidenceRecords,
    `${label} drilldown stale evidence`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.OVERDUE_ACTIONS],
    insights.risk.overdueActions,
    `${label} drilldown overdue actions`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRED_ACTIVE_ACTIONS],
    insights.risk.expiredWithActiveActions,
    `${label} drilldown expired with active actions`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_THIS_MONTH],
    insights.forecast.expiringThisMonth,
    `${label} drilldown expiring this month`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_NEXT_MONTH],
    insights.forecast.expiringNextMonth,
    `${label} drilldown expiring next month`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_30_DAYS],
    insights.forecast.expiringWithin30Days,
    `${label} drilldown expiring within 30 days`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.EXPIRING_90_DAYS],
    insights.forecast.expiringWithin90Days,
    `${label} drilldown expiring within 90 days`
  );
}

function verifyRecommendations(label, rows) {
  const insights = computeComplianceInsights(rows, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
  const normalizedRows = normalizeFixtureRows(rows);
  const recommendations = generateComplianceRecommendations(insights, normalizedRows);

  assertEqual(
    recommendations.length,
    EXPECTED_RECOMMENDATIONS.length,
    `${label} recommendation count`
  );
  assertDeepEqual(recommendations, EXPECTED_RECOMMENDATIONS, `${label} recommendations`);
  assertDeepEqual(
    getRecommendationPriorityOrder(recommendations),
    ["critical", "critical", "high", "high", "high", "medium", "medium"],
    `${label} recommendation priority order`
  );

  recommendations.forEach((recommendation) => {
    assertEqual(
      recommendation.affectedCount > 0,
      true,
      `${label} recommendation ${recommendation.id} affectedCount > 0`
    );
    assertEqual(
      recommendation.drilldownKey in getExpectedDrilldownCounts(normalizedRows, createInsightsContext(FIXTURE_AS_OF_DATE, FIXTURE_SETTINGS)),
      true,
      `${label} recommendation ${recommendation.id} drilldownKey maps to drilldown`
    );
  });
}

function verifyRecommendationThresholds(label, rows) {
  const insights = computeComplianceInsights(rows, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
  const normalizedRows = normalizeFixtureRows(rows);

  const suppressed = generateComplianceRecommendations(insights, normalizedRows, {
    expiringWithin30Days: insights.forecast.expiringWithin30Days,
    expiringNextMonth: insights.forecast.expiringNextMonth,
  });

  assertEqual(
    suppressed.some((item) => item.id === "expiry-expiring-within-30-days"),
    false,
    `${label} threshold suppresses 30-day expiry recommendation`
  );
  assertEqual(
    suppressed.some((item) => item.id === "forecast-expiring-next-month"),
    false,
    `${label} threshold suppresses next-month forecast recommendation`
  );

  assertDeepEqual(
    DEFAULT_RECOMMENDATION_THRESHOLDS,
    { expiringWithin30Days: 0, expiringNextMonth: 0 },
    `${label} default recommendation thresholds`
  );
  assertEqual(getRecommendationPriorityLabel("high"), "High priority", `${label} priority label`);
}

console.log(
  "Compliance Insights engine verification (V4-0A + V4-0B + V4-0D + V4-1A + V4-1B)\n"
);

verifyInsights("local fixture rows", LOCAL_FIXTURE_ROWS);
verifyInsights("cloud-shaped fixture rows", CLOUD_FIXTURE_ROWS);
verifyDashboardMappings("local fixture rows", LOCAL_FIXTURE_ROWS);
verifyDashboardMappings("cloud-shaped fixture rows", CLOUD_FIXTURE_ROWS);
verifyDrilldownCounts("local fixture rows", LOCAL_FIXTURE_ROWS);
verifyDrilldownCounts("cloud-shaped fixture rows", CLOUD_FIXTURE_ROWS);
verifyRecommendations("local fixture rows", LOCAL_FIXTURE_ROWS);
verifyRecommendations("cloud-shaped fixture rows", CLOUD_FIXTURE_ROWS);
verifyRecommendationThresholds("local fixture rows", LOCAL_FIXTURE_ROWS);

const emptyInsights = computeComplianceInsights([], FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);

assertEqual(emptyInsights.recordCount, 0, "empty recordCount");
assertEqual(emptyInsights.compositeHealthScore, 0, "empty compositeHealthScore");
assertEqual(emptyInsights.expiryHealth.score, 0, "empty expiry score");
assertEqual(emptyInsights.evidenceHealth.score, 0, "empty evidence score");
assertEqual(emptyInsights.actionHealth.score, 0, "empty action score");
assertDeepEqual(
  mapInsightsToSummaryCounts(emptyInsights),
  { total: 0, valid: 0, dueSoon: 0, expired: 0 },
  "empty summary counts mapping"
);

const emptyRecommendations = generateComplianceRecommendations(emptyInsights, []);

assertEqual(emptyRecommendations.length, 0, "empty recommendations");

console.log("Insights engine verification: OK");
console.log(`  asOfDate=${FIXTURE_AS_OF_DATE}`);
console.log(`  recordCount=${EXPECTED_INSIGHTS.recordCount}`);
console.log(`  compositeHealthScore=${EXPECTED_INSIGHTS.compositeHealthScore}`);
console.log("  local + cloud-shaped fixtures produce identical metrics");
console.log("  dashboard summary/action/evidence mappings match legacy formulas");
console.log("  compliance insight drilldown counts match risk/forecast tiles");
console.log(`  recommendations generated=${EXPECTED_RECOMMENDATIONS.length}`);
console.log("  recommendation thresholds and priority labels verified");
