/**
 * Deterministic verification for the V4-0A Compliance Insights engine.
 * Uses fixture rows only — no Supabase or browser required.
 */

import { computeComplianceInsights } from "../js/app/insights/insights-engine.js";
import {
  CLOUD_FIXTURE_ROWS,
  EXPECTED_INSIGHTS,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

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

console.log("Compliance Insights engine verification (V4-0A)\n");

verifyInsights("local fixture rows", LOCAL_FIXTURE_ROWS);
verifyInsights("cloud-shaped fixture rows", CLOUD_FIXTURE_ROWS);

const emptyInsights = computeComplianceInsights([], FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);

assertEqual(emptyInsights.recordCount, 0, "empty recordCount");
assertEqual(emptyInsights.compositeHealthScore, 0, "empty compositeHealthScore");
assertEqual(emptyInsights.expiryHealth.score, 0, "empty expiry score");
assertEqual(emptyInsights.evidenceHealth.score, 0, "empty evidence score");
assertEqual(emptyInsights.actionHealth.score, 0, "empty action score");

console.log("Insights engine verification: OK");
console.log(`  asOfDate=${FIXTURE_AS_OF_DATE}`);
console.log(`  recordCount=${EXPECTED_INSIGHTS.recordCount}`);
console.log(`  compositeHealthScore=${EXPECTED_INSIGHTS.compositeHealthScore}`);
console.log("  local + cloud-shaped fixtures produce identical metrics");
