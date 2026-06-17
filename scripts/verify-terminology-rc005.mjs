/**
 * RC-005: Insights stale evidence label clarity.
 * Static checks against index.html, insight modules, and the built bundle.
 * No Supabase, browser, or localStorage mutation required.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const drilldownsJs = readFileSync(
  join(root, "js/app/insights/compliance-insights-drilldowns.js"),
  "utf8"
);
const recommendationsJs = readFileSync(
  join(root, "js/app/insights/recommendations-engine.js"),
  "utf8"
);
const insightsExportJs = readFileSync(join(root, "js/app/insights/insights-export.js"), "utf8");
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

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
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

console.log("Insights stale evidence label clarity verification (RC-005)\n");

const insightsSection = extractComplianceInsightsSection(indexHtml);

if (!insightsSection) {
  fail("index.html contains compliance-insights-section");
} else {
  assertContains(
    insightsSection,
    ">Any stale evidence<",
    "Key Risks tile uses Any stale evidence"
  );
  assertContains(
    insightsSection,
    ">Stale evidence only<",
    "Evidence Gaps tile uses Stale evidence only"
  );
  assertContains(
    insightsSection,
    "Critical and high tiers prioritise records near expiry",
    "Evidence Gaps helper explains critical/high prioritisation"
  );
  assertContains(
    insightsSection,
    "Counts may differ from Key Risks any stale evidence",
    "Evidence Gaps helper explains count difference from Key Risks"
  );
  assertNotContains(
    insightsSection,
    ">Stale evidence<",
    "Compliance Insights section does not use ambiguous Stale evidence tile label"
  );
  assertNotContains(
    insightsSection,
    ">Stale evidence records<",
    "Compliance Insights section does not use ambiguous Stale evidence records tile label"
  );
}

assertContains(drilldownsJs, 'title: "Any Stale Evidence"', "stale-evidence drilldown title clarified");
assertContains(
  drilldownsJs,
  "including records also counted in Evidence Gaps critical or high tiers",
  "stale-evidence drilldown description explains tier overlap"
);
assertContains(
  drilldownsJs,
  'title: "Stale Evidence Only"',
  "stale-evidence-records drilldown title clarified"
);
assertContains(
  drilldownsJs,
  "excluding records already prioritised as critical or high evidence gaps",
  "stale-evidence-records drilldown description explains tier exclusion"
);

assertContains(
  recommendationsJs,
  'title: "Refresh stale-only evidence"',
  "stale tier recommendation title clarified"
);
assertContains(
  recommendationsJs,
  "outside critical or high evidence gap tiers",
  "stale tier recommendation description explains tier scope"
);

assertContains(
  insightsExportJs,
  'csvMetricLine("Any stale evidence", risk.staleEvidenceRecords',
  "summary export uses Any stale evidence for Key Risks"
);
assertContains(
  insightsExportJs,
  'csvMetricLine("Stale evidence only", evidenceGaps.stale',
  "summary export uses Stale evidence only for Evidence Gaps"
);
assertNotContains(
  insightsExportJs,
  'csvMetricLine("Stale evidence records", risk.staleEvidenceRecords',
  "summary export does not use ambiguous Stale evidence records for Key Risks"
);

assertContains(appBundleJs, 'title: "Any Stale Evidence"', "bundle stale-evidence drilldown title clarified");
assertContains(appBundleJs, 'title: "Stale Evidence Only"', "bundle stale-evidence-records drilldown title clarified");
assertContains(appBundleJs, 'title: "Refresh stale-only evidence"', "bundle stale tier recommendation title clarified");
assertContains(appBundleJs, 'csvMetricLine("Any stale evidence", risk.staleEvidenceRecords', "bundle summary export uses Any stale evidence");
assertContains(appBundleJs, 'csvMetricLine("Stale evidence only", evidenceGaps.stale', "bundle summary export uses Stale evidence only");

if (failures.length > 0) {
  console.error("FAIL insights stale evidence label clarity verification (RC-005):");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("RC-005 insights stale evidence label clarity: OK");
console.log("  Key Risks any stale evidence vs Evidence Gaps stale evidence only labels verified");
