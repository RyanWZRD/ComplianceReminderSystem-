/**
 * V5-0 Phase 7: Automation run audit UI.
 * Static checks for read-only audit section, safe summary rendering, and no execution hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTOMATION_RUN_EXECUTION_COUNTER_KEYS,
  computeActionCandidatesTotal,
  formatAutomationRunExecutionCounters,
  mapAutomationRunToAuditRow,
} from "../js/app/automation/automation-run-audit-ui.js";
import { buildAutomationDryRunRunSummary } from "../js/app/automation/automation-run-logging.js";
import { EXPECTED_AUTOMATION_DRY_RUN } from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const auditUiJs = readFileSync(
  join(root, "js/app/automation/automation-run-audit-ui.js"),
  "utf8"
);

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

function assert(condition, label) {
  if (!condition) {
    fail(label);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
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

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  if (start === -1) {
    return "";
  }

  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) {
    return "";
  }

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return "";
}

console.log("Automation run audit UI verification (V5-0 Phase 7)\n");

assertContains(indexHtml, 'id="automation-run-audit-section"', "index.html automation audit section");
assertContains(indexHtml, "Automation Audit", "index.html automation audit title");
assertContains(indexHtml, 'id="automation-run-audit-empty"', "index.html automation audit empty state");
assertContains(
  indexHtml,
  "No automation runs logged yet.",
  "index.html automation audit empty message"
);
assertContains(indexHtml, 'id="automation-run-audit-error"', "index.html automation audit error state");
assertContains(indexHtml, 'id="automation-run-audit-table-body"', "index.html automation audit table body");
assertContains(
  indexHtml,
  "does not execute automation",
  "index.html automation audit read-only disclaimer"
);

assertContains(
  appJs,
  'from "./js/app/automation/automation-run-audit-ui.js"',
  "app.js imports automation run audit UI module"
);
assertContains(appJs, "automationRepository", "app.js uses automationRepository");
assertContains(appJs, "loadAutomationRunAudit", "app.js loads automation run audit");
assertContains(appJs, "renderAutomationRunAudit", "app.js renders automation run audit");
assertContains(appJs, "setupAutomationRunAuditListeners", "app.js wires automation run audit listeners");

const renderAuditBody = extractFunctionBody(appJs, "renderAutomationRunAudit");
assertContains(renderAuditBody, "escapeHtml(row.runAt)", "audit table escapes run date/time");
assertContains(renderAuditBody, "escapeHtml(row.runType)", "audit table escapes run type");
assertContains(renderAuditBody, "escapeHtml(row.source)", "audit table escapes source");
assertContains(
  renderAuditBody,
  "summaryElement.textContent = row.summaryJson",
  "audit summary JSON uses textContent"
);
assertContains(
  renderAuditBody,
  "automation-run-audit-view-summary-btn",
  "audit table renders view summary control"
);
assertContains(renderAuditBody, "View summary", "audit table view summary label");
assertContains(
  renderAuditBody,
  "automationRunAuditEmpty.classList.remove",
  "audit render shows empty state element"
);
assertContains(
  renderAuditBody,
  "Could not load automation runs",
  "audit render shows friendly load failure message"
);

assertContains(appJs, "computeAutomationDryRun", "app.js wires dry-run for reminder queue preview");
assertNotContains(appJs, "logAutomationDryRunRun", "app.js does not wire dry-run logging");
assertNotContains(appJs, "createAutomationRun", "app.js does not create automation runs");
assertNotContains(appJs, "Run automation", "app.js has no run automation button");
assertNotContains(appJs, "Run dry run", "app.js has no run dry run button");
assertNotContains(appJs, "Execute automation", "app.js has no execute automation button");
assertNotContains(appJs, "sendEmail", "app.js does not add email sending");
assertNotContains(appJs, "notification_queue", "app.js does not add notification queue automation");

assertNotContains(indexHtml, "Run automation", "index.html has no run automation button");
assertNotContains(indexHtml, "Run dry run", "index.html has no run dry run button");
assertNotContains(indexHtml, "Execute automation", "index.html has no execute automation button");

assertContains(stylesCss, ".automation-run-audit-section", "styles include automation audit section");
assertContains(stylesCss, ".automation-run-audit-summary-json", "styles include summary JSON block");

assertContains(appBundleJs, "mapAutomationRunsToAuditRows", "bundle includes automation run audit UI");
assertContains(appBundleJs, "loadAutomationRunAudit", "bundle includes automation run audit loader");

const dryRunSummary = buildAutomationDryRunRunSummary(EXPECTED_AUTOMATION_DRY_RUN, {
  source: "manual_dry_run",
});
const auditRow = mapAutomationRunToAuditRow({
  id: "00000000-0000-4000-8000-000000000001",
  startedAt: "2026-06-17T10:00:00.000Z",
  completedAt: "2026-06-17T10:00:01.000Z",
  status: "completed",
  summary: dryRunSummary,
  error: null,
  createdAt: "2026-06-17T10:00:00.000Z",
});

assertEqual(auditRow.runType, "dry_run", "audit row maps dry_run run type");
assertEqual(auditRow.source, "manual_dry_run", "audit row maps dry_run source");
assertEqual(auditRow.totalRecords, "6", "audit row maps total records scanned");
assertEqual(auditRow.reminderCandidatesTotal, "3", "audit row maps reminder candidates total");
assertEqual(
  auditRow.actionCandidatesTotal,
  "7",
  "audit row maps action candidates total (1 + 3 + 3)"
);
assertContains(auditRow.executionCounters, "Reminders queued: 0", "audit row shows zero reminders queued");
assertContains(auditRow.executionCounters, "Actions created: 0", "audit row shows zero actions created");

assertEqual(
  computeActionCandidatesTotal({
    expiredRecords: 1,
    criticalEvidenceGaps: 3,
    missingFollowUp: 3,
  }),
  7,
  "action candidates total sums dry-run counters"
);

const counterLine = formatAutomationRunExecutionCounters(dryRunSummary);
AUTOMATION_RUN_EXECUTION_COUNTER_KEYS.forEach((key) => {
  assertContains(counterLine, ": 0", `execution counters include zero for ${key}`);
});

const xssSummary = buildAutomationDryRunRunSummary(
  {
    ...EXPECTED_AUTOMATION_DRY_RUN,
    note: '<script>alert("xss")</script>',
  },
  { source: '<img onerror="alert(1)">' }
);
const xssRow = mapAutomationRunToAuditRow({
  id: "00000000-0000-4000-8000-000000000002",
  startedAt: "2026-06-17T10:00:00.000Z",
  completedAt: null,
  status: "completed",
  summary: xssSummary,
  error: null,
  createdAt: "2026-06-17T10:00:00.000Z",
});

assertContains(xssRow.summaryJson, "<script>", "summary JSON preserves literal script text for textContent");
assertContains(xssRow.source, "<img", "audit row source preserves literal markup for escapeHtml");

assertNotContains(auditUiJs, "createAutomationRun", "audit UI module does not create runs");
assertNotContains(auditUiJs, "computeAutomationDryRun", "audit UI module does not execute dry-run");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-automation-run-ui: all checks OK");
console.log("  Automation audit UI elements verified");
console.log("  No execution buttons or automation hooks in app.js");
console.log("  Dry-run summary fields mapped and execution counters zero");
console.log("  Summary JSON rendered via textContent path");
