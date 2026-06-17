/**
 * Deterministic verification for the V4-0A Compliance Insights engine,
 * V4-0B dashboard metric mappings, V4-0D drilldown filters, V4-1A recommendations,
 * V4-1B recommendation polish and thresholds, V4-1C alpha hardening, V4-2A operational health,
 * and V4-2B composite score including operational health, and V4-2C operational drilldown polish,
 * and V4-3A evidence gap tiers, and V4-3C export pack.
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
  filterComplianceInsightDrilldownRecords,
  getComplianceInsightDrilldownColumns,
  getComplianceInsightDrilldownMeta,
  getExpectedDrilldownCounts,
  mapMissingReminderActivityPreviewRow,
  mapEvidenceGapPreviewRow,
} from "../js/app/insights/compliance-insights-drilldowns.js";
import { formatOperationalHealthSummary } from "../js/app/insights/metrics-operational.js";
import {
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  generateComplianceRecommendations,
  getRecommendationPriorityLabel,
  getRecommendationPriorityOrder,
} from "../js/app/insights/recommendations-engine.js";
import {
  buildComplianceInsightDrilldownCsv,
  buildComplianceInsightsSummaryCsv,
  formatInsightsExportDate,
  getComplianceInsightDrilldownFilename,
  getComplianceInsightsSummaryFilename,
} from "../js/app/insights/insights-export.js";
import {
  CLOUD_FIXTURE_ROWS,
  EXPECTED_HEALTHY_INSIGHTS,
  EXPECTED_INSIGHTS,
  EXPECTED_RECOMMENDATIONS,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  HEALTHY_CLOUD_FIXTURE_ROWS,
  HEALTHY_FIXTURE_ROWS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";
import { ACTION_STATUSES, HISTORY_ACTIONS } from "../js/data/constants.js";
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
  assertDeepEqual(insights.evidenceGaps, EXPECTED_INSIGHTS.evidenceGaps, `${label} evidenceGaps`);
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
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY],
    insights.operationalHealth.recordsMissingReminderActivity,
    `${label} drilldown missing reminder activity`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS],
    insights.evidenceGaps.byTier.critical,
    `${label} drilldown critical evidence gaps`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.HIGH_EVIDENCE_GAPS],
    insights.evidenceGaps.byTier.high,
    `${label} drilldown high evidence gaps`
  );
  assertEqual(
    drilldownCounts[COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.STALE_EVIDENCE_RECORDS],
    insights.evidenceGaps.byTier.stale,
    `${label} drilldown stale evidence records`
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
    ["critical", "critical", "critical", "high", "high", "high", "medium"],
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

function verifyHealthyFixture(label, rows) {
  const insights = computeComplianceInsights(rows, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);

  assertEqual(insights.recordCount, EXPECTED_HEALTHY_INSIGHTS.recordCount, `${label} recordCount`);
  assertEqual(
    insights.compositeHealthScore,
    EXPECTED_HEALTHY_INSIGHTS.compositeHealthScore,
    `${label} compositeHealthScore`
  );
  assertDeepEqual(insights.expiryHealth, EXPECTED_HEALTHY_INSIGHTS.expiryHealth, `${label} expiryHealth`);
  assertDeepEqual(
    insights.evidenceHealth,
    EXPECTED_HEALTHY_INSIGHTS.evidenceHealth,
    `${label} evidenceHealth`
  );
  assertDeepEqual(insights.actionHealth, EXPECTED_HEALTHY_INSIGHTS.actionHealth, `${label} actionHealth`);
  assertDeepEqual(
    insights.operationalHealth,
    EXPECTED_HEALTHY_INSIGHTS.operationalHealth,
    `${label} operationalHealth`
  );
  assertDeepEqual(insights.risk, EXPECTED_HEALTHY_INSIGHTS.risk, `${label} risk`);
  assertDeepEqual(insights.forecast, EXPECTED_HEALTHY_INSIGHTS.forecast, `${label} forecast`);
  assertDeepEqual(
    insights.evidenceGaps,
    EXPECTED_HEALTHY_INSIGHTS.evidenceGaps,
    `${label} evidenceGaps`
  );

  const recommendations = generateComplianceRecommendations(insights, normalizeFixtureRows(rows));

  assertEqual(recommendations.length, 0, `${label} recommendations`);
  verifyDrilldownCounts(label, rows);
}

function verifyOperationalHealthScenarios() {
  const partialRows = [
    {
      personId: 1,
      recordId: 1,
      name: "Followed Up",
      role: "Volunteer",
      complianceType: "DBS",
      expiryDate: "2026-06-20",
      renewalCycle: "3-years",
      notes: "17/06/2026 - 7 Day Reminder Sent",
      history: [],
      evidence: [],
      actions: [],
    },
    {
      personId: 2,
      recordId: 2,
      name: "Not Followed Up",
      role: "Volunteer",
      complianceType: "DBS",
      expiryDate: "2026-06-25",
      renewalCycle: "3-years",
      notes: "",
      history: [],
      evidence: [],
      actions: [],
    },
  ];

  const partialInsights = computeComplianceInsights(
    partialRows,
    FIXTURE_SETTINGS,
    FIXTURE_AS_OF_DATE
  );

  assertEqual(
    partialInsights.operationalHealth.recordsInReminderWindows,
    2,
    "operational partial recordsInReminderWindows"
  );
  assertEqual(
    partialInsights.operationalHealth.recordsWithReminderActivity,
    1,
    "operational partial recordsWithReminderActivity"
  );
  assertEqual(partialInsights.operationalHealth.score, 50, "operational partial score");

  const historyRows = [
    {
      personId: 3,
      recordId: 3,
      name: "History Follow-up",
      role: "Volunteer",
      complianceType: "DBS",
      expiryDate: "2026-06-20",
      renewalCycle: "3-years",
      notes: "",
      history: [
        {
          action: HISTORY_ACTIONS.REMINDER_SENT,
          description: "7 Day Reminder Sent recorded.",
        },
      ],
      evidence: [],
      actions: [],
    },
  ];

  const historyInsights = computeComplianceInsights(
    historyRows,
    FIXTURE_SETTINGS,
    FIXTURE_AS_OF_DATE
  );

  assertEqual(
    historyInsights.operationalHealth.recordsWithReminderActivity,
    1,
    "operational history recordsWithReminderActivity"
  );
  assertEqual(historyInsights.operationalHealth.score, 100, "operational history score");
}

function verifyOperationalHealthDrilldownPolish() {
  const meta = getComplianceInsightDrilldownMeta(
    COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY
  );

  assertEqual(
    meta.emptyMessage,
    "No records are missing reminder follow-up.",
    "missing reminder activity empty message"
  );
  assertEqual(
    Boolean(meta.previewDescription),
    true,
    "missing reminder activity preview description"
  );

  const columns = getComplianceInsightDrilldownColumns(
    COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY
  );

  assertDeepEqual(
    columns.map((column) => column.key),
    [
      "name",
      "role",
      "complianceType",
      "expiryDate",
      "status",
      "reminderWindow",
      "reminderActivityStatus",
    ],
    "missing reminder activity preview columns"
  );

  const ctx = createInsightsContext(FIXTURE_AS_OF_DATE, FIXTURE_SETTINGS);
  const normalizedRows = normalizeFixtureRows(LOCAL_FIXTURE_ROWS);
  const missingRows = filterComplianceInsightDrilldownRecords(
    COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY,
    normalizedRows,
    ctx
  );

  assertEqual(missingRows.length, 3, "missing reminder activity drilldown row count");

  const samPriest = missingRows.find((row) => row.name === "Sam Priest");

  assertEqual(Boolean(samPriest), true, "Sam Priest in missing reminder activity drilldown");

  const previewRow = mapMissingReminderActivityPreviewRow(samPriest, ctx);

  assertEqual(previewRow.reminderActivityStatus, "Missing", "Sam Priest reminder activity status");
  assertEqual(previewRow.reminderWindow, "Expired", "Sam Priest reminder window");

  const operationalSummary = formatOperationalHealthSummary(EXPECTED_INSIGHTS.operationalHealth);

  assertEqual(operationalSummary.scoreText, "0%", "operational summary score text");
  assertEqual(
    operationalSummary.detailText,
    "3 in windows · 0 followed up · 3 missing",
    "operational summary detail text"
  );

  const healthySummary = formatOperationalHealthSummary(EXPECTED_HEALTHY_INSIGHTS.operationalHealth);

  assertEqual(
    healthySummary.detailText,
    "No records in active reminder windows",
    "healthy operational summary detail text"
  );

  const insights = computeComplianceInsights(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
  const recommendations = generateComplianceRecommendations(insights, normalizedRows);
  const operationalRecommendation = recommendations.find(
    (item) => item.id === "operational-missing-reminder-activity"
  );

  assertEqual(
    operationalRecommendation?.drilldownKey,
    COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.MISSING_REMINDER_ACTIVITY,
    "operational recommendation drilldown key"
  );
}

function verifyEvidenceGapDrilldownPolish() {
  const meta = getComplianceInsightDrilldownMeta(
    COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS
  );

  assertEqual(
    meta.title,
    "Critical Evidence Gaps",
    "critical evidence gaps drilldown title"
  );
  assertEqual(Boolean(meta.previewDescription), true, "critical evidence gaps preview description");

  const columns = getComplianceInsightDrilldownColumns(
    COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS
  );

  assertDeepEqual(
    columns.map((column) => column.key),
    [
      "name",
      "role",
      "complianceType",
      "expiryDate",
      "status",
      "evidenceCount",
      "newestEvidenceDate",
      "gapTier",
      "recommendedAction",
    ],
    "evidence gap preview columns"
  );

  const ctx = createInsightsContext(FIXTURE_AS_OF_DATE, FIXTURE_SETTINGS);
  const normalizedRows = normalizeFixtureRows(LOCAL_FIXTURE_ROWS);
  const criticalRows = filterComplianceInsightDrilldownRecords(
    COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS,
    normalizedRows,
    ctx
  );

  assertEqual(criticalRows.length, 3, "critical evidence gaps drilldown row count");

  const samPriest = criticalRows.find((row) => row.name === "Sam Priest");

  assertEqual(Boolean(samPriest), true, "Sam Priest in critical evidence gaps drilldown");

  const previewRow = mapEvidenceGapPreviewRow(samPriest, ctx);

  assertEqual(previewRow.gapTier, "critical", "Sam Priest evidence gap tier");
  assertEqual(previewRow.newestEvidenceDate, "2024-01-01", "Sam Priest newest evidence date");

  const insights = computeComplianceInsights(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
  const recommendations = generateComplianceRecommendations(insights, normalizedRows);
  const criticalRecommendation = recommendations.find((item) => item.id === "evidence-critical-gaps");

  assertEqual(
    criticalRecommendation?.drilldownKey,
    COMPLIANCE_INSIGHT_DRILLDOWN_TYPES.CRITICAL_EVIDENCE_GAPS,
    "critical evidence gaps recommendation drilldown key"
  );
  assertEqual(
    recommendations.some((item) => item.id === "evidence-missing-evidence"),
    false,
    "legacy missing evidence recommendation replaced by tier recommendations"
  );
  assertEqual(
    recommendations.some((item) => item.id === "evidence-stale-evidence"),
    false,
    "legacy stale evidence recommendation replaced when stale tier count is zero"
  );
}

console.log(
  "Compliance Insights engine verification (V4-0A through V4-3A)\n"
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
verifyHealthyFixture("healthy local fixture rows", HEALTHY_FIXTURE_ROWS);
verifyHealthyFixture("healthy cloud-shaped fixture rows", HEALTHY_CLOUD_FIXTURE_ROWS);
verifyOperationalHealthScenarios();
verifyOperationalHealthDrilldownPolish();
verifyEvidenceGapDrilldownPolish();

const emptyInsights = computeComplianceInsights([], FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);

assertEqual(emptyInsights.recordCount, 0, "empty recordCount");
assertEqual(emptyInsights.compositeHealthScore, 0, "empty compositeHealthScore");
assertEqual(emptyInsights.expiryHealth.score, 0, "empty expiry score");
assertEqual(emptyInsights.evidenceHealth.score, 0, "empty evidence score");
assertEqual(emptyInsights.actionHealth.score, 0, "empty action score");
assertEqual(emptyInsights.operationalHealth.score, 100, "empty operational score");
assertEqual(
  emptyInsights.operationalHealth.recordsInReminderWindows,
  0,
  "empty operational recordsInReminderWindows"
);
assertDeepEqual(
  mapInsightsToSummaryCounts(emptyInsights),
  { total: 0, valid: 0, dueSoon: 0, expired: 0 },
  "empty summary counts mapping"
);

const emptyRecommendations = generateComplianceRecommendations(emptyInsights, []);

assertEqual(emptyRecommendations.length, 0, "empty recommendations");

const exportDate = new Date("2026-06-17T12:00:00");
const summaryRecommendations = generateComplianceRecommendations(
  computeComplianceInsights(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE),
  LOCAL_FIXTURE_ROWS
);
const summaryCsv = buildComplianceInsightsSummaryCsv(
  computeComplianceInsights(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE),
  summaryRecommendations,
  exportDate
);

assertEqual(
  getComplianceInsightsSummaryFilename(exportDate),
  "compliance-insights-summary-2026-06-17.csv",
  "summary export filename"
);
assertEqual(
  getComplianceInsightDrilldownFilename("expired-records", exportDate),
  "compliance-insights-drilldown-expired_records-2026-06-17.csv",
  "drilldown export filename"
);
assertEqual(formatInsightsExportDate(exportDate), "2026-06-17", "export date format");

if (!summaryCsv.includes("Compliance health score")) {
  console.error("FAIL summary export missing health score");
  process.exit(1);
}

if (!summaryCsv.includes("Renew expired compliance records")) {
  console.error("FAIL summary export missing recommendation title");
  process.exit(1);
}

if (!summaryCsv.includes(getRecommendationPriorityLabel("critical"))) {
  console.error("FAIL summary export missing recommendation priority");
  process.exit(1);
}

const drilldownCsv = buildComplianceInsightDrilldownCsv({
  title: "Expired Records",
  generatedDisplay: "17 Jun 2026, 12:00",
  itemLabel: "Records",
  totalCount: 1,
  columns: [{ key: "name", label: "Name" }],
  tableRows: [{ name: "Jane Smith" }],
});

if (!drilldownCsv.includes("Name") || !drilldownCsv.includes("Jane Smith")) {
  console.error("FAIL drilldown export CSV content");
  process.exit(1);
}

console.log("Insights engine verification: OK");
console.log(`  asOfDate=${FIXTURE_AS_OF_DATE}`);
console.log(`  recordCount=${EXPECTED_INSIGHTS.recordCount}`);
console.log(`  compositeHealthScore=${EXPECTED_INSIGHTS.compositeHealthScore}`);
console.log("  local + cloud-shaped fixtures produce identical metrics");
console.log("  dashboard summary/action/evidence mappings match legacy formulas");
console.log("  compliance insight drilldown counts match risk/forecast tiles");
console.log(`  recommendations generated=${EXPECTED_RECOMMENDATIONS.length}`);
console.log("  recommendation thresholds and priority labels verified");
console.log("  healthy local + cloud-shaped fixtures produce 100% scores and zero recommendations");
console.log("  operational health scenarios (notes, history, empty windows) verified");
console.log("  operational health drilldown polish (columns, preview, summary) verified");
console.log("  evidence gap tiers, drilldowns, and recommendations verified");
console.log("  insights summary and drilldown export helpers verified");
