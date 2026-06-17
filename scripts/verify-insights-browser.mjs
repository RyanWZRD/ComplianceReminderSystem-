/**
 * V4-3D Compliance Insights browser smoke test pack.
 * V5-1A Phase 5 contact readiness section checks.
 * Deterministic static checks against index.html, app.js, and the built bundle.
 * No Supabase, browser login, localStorage mutation, or live DOM required.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(label);
  }
}

function assertRegex(source, pattern, label) {
  if (!pattern.test(source)) {
    fail(label);
  }
}

function extractComplianceInsightsSection(html) {
  const start = html.indexOf('id="compliance-insights-section"');
  if (start === -1) {
    return "";
  }

  const end = html.indexOf('id="management-insights-section"', start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

const insightsSection = extractComplianceInsightsSection(indexHtml);

console.log("Compliance Insights browser smoke test (V4-3D)\n");

if (!insightsSection) {
  fail("index.html contains compliance-insights-section");
} else {
  assertContains(insightsSection, 'id="compliance-insights-heading"', "section heading element");
  assertContains(insightsSection, ">Compliance Insights<", "Compliance Insights section title");

  const sectionHeadings = [
    "Health Overview",
    "Key Risks",
    "Evidence Gaps",
    "Renewal Forecast",
    "Recommendations",
    "Contact Readiness",
    "Operational Health",
  ];

  for (const heading of sectionHeadings) {
    assertContains(insightsSection, heading, `section heading: ${heading}`);
  }

  assertRegex(
    insightsSection,
    /class="compliance-insights-section-help"/,
    "section helper text elements"
  );

  assertContains(
    insightsSection,
    'id="export-compliance-insights-summary-btn"',
    "Export Insights Summary button element"
  );
  assertContains(
    insightsSection,
    ">Export Insights Summary<",
    "Export Insights Summary button label"
  );
  assertContains(
    insightsSection,
    'id="export-compliance-insights-drilldown-btn"',
    "header Export Drilldown Preview button element"
  );
  assertContains(
    insightsSection,
    ">Export Drilldown Preview<",
    "Export Drilldown Preview button label"
  );

  const evidenceGapDrilldowns = [
    "critical-evidence-gaps",
    "high-evidence-gaps",
    "stale-evidence-records",
  ];

  for (const drilldown of evidenceGapDrilldowns) {
    assertContains(
      insightsSection,
      `data-compliance-insight-drilldown="${drilldown}"`,
      `evidence gap card drilldown: ${drilldown}`
    );
  }

  assertContains(
    insightsSection,
    'id="compliance-insights-evidence-gaps-strip"',
    "evidence gaps card strip"
  );
  assertContains(
    insightsSection,
    'id="compliance-insights-operational-heading"',
    "operational health section heading"
  );
  assertContains(
    insightsSection,
    'id="compliance-insights-operational-cards"',
    "operational health cards container"
  );
  assertContains(
    insightsSection,
    'id="compliance-insights-contact-heading"',
    "contact readiness section heading"
  );
  assertContains(
    insightsSection,
    'id="compliance-insights-contact-cards"',
    "contact readiness cards container"
  );

  const contactDrilldowns = ["people-missing-email", "people-missing-email-reminder-window"];

  for (const drilldown of contactDrilldowns) {
    assertContains(
      insightsSection,
      `data-compliance-insight-drilldown="${drilldown}"`,
      `contact readiness card drilldown: ${drilldown}`
    );
  }

  assertContains(
    insightsSection,
    'id="compliance-insights-preview"',
    "drilldown preview panel"
  );
  assertContains(
    insightsSection,
    'id="compliance-insights-preview-table-head"',
    "drilldown preview table head"
  );
  assertContains(
    insightsSection,
    'id="compliance-insights-preview-table-body"',
    "drilldown preview table body"
  );
  assertContains(
    insightsSection,
    'id="clear-compliance-insights-preview-btn"',
    "clear preview button element"
  );
  assertContains(insightsSection, ">Clear Preview<", "clear preview button label");
  assertContains(
    insightsSection,
    'id="export-compliance-insights-preview-csv-btn"',
    "preview panel export button element"
  );

  const emptyStateIds = [
    "compliance-insights-empty",
    "compliance-insights-risk-empty",
    "compliance-insights-evidence-gaps-empty",
    "compliance-insights-forecast-empty",
    "compliance-insights-recommendations-empty",
    "compliance-insights-contact-empty",
    "compliance-insights-operational-empty",
    "compliance-insights-preview-empty-hint",
  ];

  for (const id of emptyStateIds) {
    assertContains(insightsSection, `id="${id}"`, `empty-state element: ${id}`);
  }
}

const domElementIds = [
  "compliance-insights-section",
  "compliance-insights-composite-score",
  "compliance-insights-risk-expired",
  "compliance-insights-evidence-gap-critical",
  "compliance-insights-evidence-gap-high",
  "compliance-insights-evidence-gap-stale",
  "compliance-insights-operational-score",
  "compliance-insights-contact-missing-count",
  "compliance-insights-contact-reminder-count",
  "compliance-insights-preview",
  "export-compliance-insights-summary-btn",
  "export-compliance-insights-drilldown-btn",
  "export-compliance-insights-preview-csv-btn",
  "clear-compliance-insights-preview-btn",
];

for (const id of domElementIds) {
  assertContains(appJs, `"${id}"`, `app.js getElementById wiring: ${id}`);
}

assertContains(appJs, "function renderComplianceInsights()", "app.js renderComplianceInsights");
assertContains(appJs, "function exportComplianceInsightsSummary()", "app.js exportComplianceInsightsSummary");
assertContains(
  appJs,
  "function exportComplianceInsightDrilldownCsv",
  "app.js exportComplianceInsightDrilldownCsv"
);
assertContains(
  appJs,
  "function clearComplianceInsightDrilldownPreview",
  "app.js clearComplianceInsightDrilldownPreview"
);
assertContains(
  appJs,
  'exportComplianceInsightsSummaryBtn?.addEventListener',
  "app.js summary export click handler"
);
assertContains(
  appJs,
  'exportComplianceInsightsDrilldownBtn?.addEventListener',
  "app.js drilldown export click handler"
);
assertContains(
  appJs,
  'clearComplianceInsightsPreviewBtn?.addEventListener',
  "app.js clear preview click handler"
);
assertContains(
  appJs,
  '"[data-compliance-insight-drilldown]"',
  "app.js compliance insights drilldown tile wiring"
);

assertContains(indexHtml, "app.bundle.js", "index.html loads built app bundle");
assertContains(appBundleJs, "renderComplianceInsights", "app.bundle.js includes renderComplianceInsights");
assertContains(
  appBundleJs,
  "buildComplianceInsightsSummaryCsv",
  "app.bundle.js includes summary export helper"
);
assertContains(
  appBundleJs,
  "buildComplianceInsightDrilldownCsv",
  "app.bundle.js includes drilldown export helper"
);

if (failures.length > 0) {
  console.error("Compliance Insights browser smoke test: FAIL");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("Compliance Insights browser smoke test: OK");
console.log("  index.html section, headings, helper text, and empty states verified");
console.log("  export buttons and drilldown preview panel verified");
console.log("  evidence gap cards and operational health section verified");
console.log("  contact readiness section and drilldown cards verified");
console.log("  app.js DOM wiring and export/drilldown handlers verified");
console.log("  app.bundle.js includes insights render and export helpers");
