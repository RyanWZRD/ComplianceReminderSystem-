import { formatOperationalHealthSummary } from "./metrics-operational.js";
import { getRecommendationPriorityLabel } from "./recommendations-engine.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeCsvValue(value) {
  const text = String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function formatInsightsExportDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function formatInsightsGeneratedDisplay(date = new Date()) {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function getComplianceInsightsSummaryFilename(date = new Date()) {
  return `compliance-insights-summary-${formatInsightsExportDate(date)}.csv`;
}

/**
 * @param {string} drilldownType
 * @param {Date} [date]
 * @returns {string}
 */
export function getComplianceInsightDrilldownFilename(drilldownType, date = new Date()) {
  const slug = String(drilldownType || "preview").replace(/-/g, "_");

  return `compliance-insights-drilldown-${slug}-${formatInsightsExportDate(date)}.csv`;
}

/**
 * @param {string} label
 * @param {unknown} value
 * @returns {string}
 */
function csvMetricLine(label, value) {
  return `"${escapeCsvValue(label)}","${escapeCsvValue(value)}"`;
}

/**
 * @param {number} score
 * @returns {"High" | "Medium" | "Low"}
 */
function getHealthBandLabel(score) {
  if (score >= 80) {
    return "High";
  }

  if (score >= 50) {
    return "Medium";
  }

  return "Low";
}

/**
 * Build a CSV summary from computed compliance insights and recommendations.
 * Uses metadata and counts only — no raw notes or evidence file content.
 *
 * @param {ReturnType<import("./insights-engine.js").computeComplianceInsights>} insights
 * @param {import("./recommendations-engine.js").ComplianceRecommendation[]} recommendations
 * @param {Date} [generatedAt]
 * @returns {string}
 */
export function buildComplianceInsightsSummaryCsv(insights, recommendations, generatedAt = new Date()) {
  const generatedDisplay = formatInsightsGeneratedDisplay(generatedAt);
  const operationalSummary = formatOperationalHealthSummary(insights.operationalHealth);
  const operational = insights.operationalHealth || {};
  const risk = insights.risk || {};
  const evidenceGaps = insights.evidenceGaps?.byTier || {};
  const forecast = insights.forecast || {};
  const recs = Array.isArray(recommendations) ? recommendations : [];

  const lines = [
    "Metric,Value",
    csvMetricLine("Generated", generatedDisplay),
    csvMetricLine("Record count", insights.recordCount ?? 0),
    csvMetricLine("Insights as of date", insights.asOfDate || ""),
    "",
    "Health Score,Value",
    csvMetricLine("Compliance health score", `${insights.compositeHealthScore ?? 0}%`),
    csvMetricLine("Health band", getHealthBandLabel(insights.compositeHealthScore ?? 0)),
    csvMetricLine("Expiry health score", `${insights.expiryHealth?.score ?? 0}%`),
    csvMetricLine("Evidence health score", `${insights.evidenceHealth?.score ?? 0}%`),
    csvMetricLine("Action health score", `${insights.actionHealth?.score ?? 0}%`),
    csvMetricLine("Operational health score", operationalSummary.scoreText),
    csvMetricLine("Operational health detail", operationalSummary.detailText),
    "",
    "Key Risk,Count",
    csvMetricLine("Expired records", risk.expiredRecords ?? 0),
    csvMetricLine("Missing evidence records", risk.missingEvidenceRecords ?? 0),
    csvMetricLine("Any stale evidence", risk.staleEvidenceRecords ?? 0),
    csvMetricLine("Overdue actions", risk.overdueActions ?? 0),
    csvMetricLine("Expired records with active actions", risk.expiredWithActiveActions ?? 0),
    "",
    "Evidence Gap Tier,Count",
    csvMetricLine("Critical evidence gaps", evidenceGaps.critical ?? 0),
    csvMetricLine("High evidence gaps", evidenceGaps.high ?? 0),
    csvMetricLine("Stale evidence only", evidenceGaps.stale ?? 0),
    "",
    "Renewal Forecast,Count",
    csvMetricLine("Expiring this month", forecast.expiringThisMonth ?? 0),
    csvMetricLine("Expiring next month", forecast.expiringNextMonth ?? 0),
    csvMetricLine("Expiring within 30 days", forecast.expiringWithin30Days ?? 0),
    csvMetricLine("Expiring within 90 days", forecast.expiringWithin90Days ?? 0),
    "",
    "Operational Health,Value",
    csvMetricLine("Records in active reminder windows", operational.recordsInReminderWindows ?? 0),
    csvMetricLine("Records with reminder follow-up", operational.recordsWithReminderActivity ?? 0),
    csvMetricLine(
      "Records missing reminder follow-up",
      operational.recordsMissingReminderActivity ?? 0
    ),
    csvMetricLine("Operational health note", operational.note || operationalSummary.title || ""),
  ];

  if (recs.length > 0) {
    lines.push("", "Priority,Title,Action");
    recs.forEach((recommendation) => {
      lines.push(
        [
          escapeCsvValue(getRecommendationPriorityLabel(recommendation.priority)),
          escapeCsvValue(recommendation.title),
          escapeCsvValue(recommendation.description),
        ].join(",")
      );
    });
  } else {
    lines.push("", "Recommendations", "None");
  }

  return lines.join("\n");
}

/**
 * Build CSV for an open compliance insight drilldown preview.
 *
 * @param {{
 *   title: string;
 *   generatedDisplay: string;
 *   itemLabel: string;
 *   totalCount: number;
 *   columns: Array<{ key: string; label: string }>;
 *   tableRows: Array<Record<string, string>>;
 * }} report
 * @returns {string}
 */
export function buildComplianceInsightDrilldownCsv(report) {
  const headerRow = report.columns.map((column) => escapeCsvValue(column.label)).join(",");
  const dataRows = report.tableRows.map((row) =>
    report.columns.map((column) => escapeCsvValue(row[column.key] ?? "")).join(",")
  );
  const summaryLines = [
    `"Insight","${escapeCsvValue(report.title)}"`,
    `"Generated","${escapeCsvValue(report.generatedDisplay)}"`,
    `"${escapeCsvValue(report.itemLabel)} included","${report.totalCount}"`,
    "",
  ];

  return [...summaryLines, headerRow, ...dataRows].join("\n");
}
