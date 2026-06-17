/**
 * V5-1B Phase 4: Reminder Preview Dashboard.
 * Deterministic checks for dashboard metrics, drilldown, export pack, and UI wiring.
 * No Supabase, browser, email delivery, or automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_REMINDER_SETTINGS } from "../js/data/constants.js";
import { REMINDER_UI_LABELS } from "../js/data/reminder-sent.js";
import { createInsightsContext, normalizeComplianceRow } from "../js/app/insights/insights-engine.js";
import {
  REMINDER_PREVIEW_DASHBOARD_TYPES,
  buildPreviewableReminderEntries,
  buildReminderPreviewDashboardReport,
  buildReminderPreviewPackFilename,
  buildReminderPreviewPackText,
  countPreviewableReminderDashboardMetrics,
  filterPreviewableRemindersByDashboardType,
  hasPreviewableEmail,
} from "../js/app/reminders/reminder-preview-dashboard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const dashboardJs = readFileSync(
  join(root, "js/app/reminders/reminder-preview-dashboard.js"),
  "utf8"
);

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
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

console.log("Reminder preview dashboard verification (V5-1B Phase 4)\n");

const FIXTURE_AS_OF = new Date("2026-06-17T12:00:00");
const FIXTURE_SETTINGS = { ...DEFAULT_REMINDER_SETTINGS };

const fixtureRows = [
  normalizeComplianceRow({
    personId: 1,
    recordId: 101,
    name: "Jordan Coordinator",
    role: "Coordinator",
    email: "jordan.coordinator@example.com",
    managerEmail: "manager@example.com",
    complianceType: "Basic Awareness",
    expiryDate: "2026-07-10",
    renewalCycle: "manual",
    notes: "",
    history: [],
    evidence: [],
    actions: [],
  }),
  normalizeComplianceRow({
    personId: 2,
    recordId: 102,
    name: "Alex Volunteer",
    role: "Volunteer",
    email: "",
    managerEmail: "",
    complianceType: "DBS",
    expiryDate: "2026-06-20",
    renewalCycle: "manual",
    notes: "",
    history: [],
    evidence: [],
    actions: [],
  }),
  normalizeComplianceRow({
    personId: 3,
    recordId: 103,
    name: "Sam Leader",
    role: "Leader",
    email: "sam.leader@example.com",
    managerEmail: "",
    complianceType: "Leadership",
    expiryDate: "2026-06-24",
    renewalCycle: "manual",
    notes: "",
    history: [],
    evidence: [],
    actions: [],
  }),
  normalizeComplianceRow({
    personId: 4,
    recordId: 104,
    name: "Taylor Admin",
    role: "Admin",
    email: "taylor.admin@example.com",
    managerEmail: "",
    complianceType: "Foundations",
    expiryDate: "2025-12-01",
    renewalCycle: "manual",
    notes: "",
    history: [],
    evidence: [],
    actions: [],
  }),
  normalizeComplianceRow({
    personId: 5,
    recordId: 105,
    name: "Riley Worker",
    role: "Worker",
    email: "riley.worker@example.com",
    managerEmail: "",
    complianceType: "DBS",
    expiryDate: "2027-01-01",
    renewalCycle: "manual",
    notes: "",
    history: [],
    evidence: [],
    actions: [],
  }),
];

const ctx = createInsightsContext(FIXTURE_AS_OF, FIXTURE_SETTINGS);
const entries = buildPreviewableReminderEntries(fixtureRows, FIXTURE_SETTINGS, ctx);

assertEqual(hasPreviewableEmail(fixtureRows[0]), true, "row with email is previewable");
assertEqual(hasPreviewableEmail(fixtureRows[1]), false, "row without email is not previewable");
assertEqual(entries.length, 3, "previewable entries exclude no-email and out-of-window records");

const metrics = countPreviewableReminderDashboardMetrics(entries);
assertEqual(metrics[REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_30], 1, "30-day count");
assertEqual(metrics[REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_14], 0, "14-day count");
assertEqual(metrics[REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_7], 1, "7-day count");
assertEqual(metrics[REMINDER_PREVIEW_DASHBOARD_TYPES.EXPIRED], 1, "expired count");
assertEqual(metrics[REMINDER_PREVIEW_DASHBOARD_TYPES.TOTAL], 3, "total previewable count");

const sevenDayEntries = filterPreviewableRemindersByDashboardType(
  entries,
  REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_7
);
assertEqual(sevenDayEntries.length, 1, "7-day drilldown count");
assertEqual(
  sevenDayEntries[0].reminderType,
  REMINDER_UI_LABELS[7],
  "7-day drilldown reminder type"
);

const report = buildReminderPreviewDashboardReport(
  REMINDER_PREVIEW_DASHBOARD_TYPES.TOTAL,
  entries,
  {
    formatExpiryDate: (date) => date,
    generatedDisplay: "17 Jun 2026, 12:00",
    exportDate: "2026-06-17",
  }
);

assertEqual(report.totalCount, 3, "report total count");
assertEqual(report.columns.length, 5, "report has five data columns");
assertEqual(report.tableRows.length, 3, "report table rows");
assertContains(report.tableRows[0].email, "@", "table row includes email");

const packText = buildReminderPreviewPackText(sevenDayEntries);
assertContains(packText, "To: sam.leader@example.com", "pack includes recipient email");
assertContains(packText, "Subject:", "pack includes subject");
assertContains(packText, "Body:", "pack includes body");
assertNotContains(packText, "notes", "pack excludes record notes");

assertEqual(
  buildReminderPreviewPackFilename(REMINDER_PREVIEW_DASHBOARD_TYPES.DAYS_7, "2026-06-17"),
  "reminder-preview-pack-7-day-2026-06-17.txt",
  "export pack filename"
);
assertEqual(
  buildReminderPreviewPackFilename(REMINDER_PREVIEW_DASHBOARD_TYPES.TOTAL, "2026-06-17"),
  "reminder-preview-pack-total-2026-06-17.txt",
  "total export pack filename"
);

assertContains(indexHtml, 'id="reminder-preview-dashboard-section"', "index.html dashboard section");
assertContains(indexHtml, 'data-reminder-preview-dashboard="30-day"', "index.html 30-day card");
assertContains(indexHtml, 'data-reminder-preview-dashboard="14-day"', "index.html 14-day card");
assertContains(indexHtml, 'data-reminder-preview-dashboard="7-day"', "index.html 7-day card");
assertContains(indexHtml, 'data-reminder-preview-dashboard="expired"', "index.html expired card");
assertContains(indexHtml, 'data-reminder-preview-dashboard="total"', "index.html total card");
assertContains(indexHtml, 'id="export-reminder-preview-pack-btn"', "index.html export pack button");
assertContains(indexHtml, "Export Reminder Pack", "index.html export pack label");
assertContains(indexHtml, "No emails are sent from this dashboard", "index.html no-send disclaimer");

assertContains(appJs, "buildPreviewableReminderEntries", "app.js imports previewable entries helper");
assertContains(appJs, "renderReminderPreviewDashboardCards", "app.js renders dashboard cards");
assertContains(appJs, "showReminderPreviewDashboardPreview", "app.js shows drilldown preview");
assertContains(appJs, "exportReminderPreviewPack", "app.js export pack handler");
assertContains(appJs, "setupReminderPreviewDashboardListeners", "app.js dashboard listeners");
assertContains(appJs, "openReminderTemplatePreview", "app.js reuses preview modal");
assertContains(appJs, "openRecordWorkspace", "app.js reuses workspace open");
assertContains(appJs, "startEdit(personId, recordId, { focusContact: true })", "app.js reuses edit contact");
assertContains(appJs, "Preview Reminder", "app.js preview reminder action label");
assertContains(appJs, "Open Workspace", "app.js open workspace action label");
assertContains(appJs, "Edit Contact", "app.js edit contact action label");

const exportBody = extractFunctionBody(appJs, "exportReminderPreviewPack");
assertContains(exportBody, "buildReminderPreviewPackText", "export pack uses pack text helper");
assertContains(exportBody, 'downloadFile(content, filename, "text/plain', "export pack uses downloadFile");

assertContains(stylesCss, ".reminder-preview-dashboard-section", "styles include dashboard section");
assertContains(stylesCss, ".reminder-preview-dashboard-card", "styles include dashboard cards");
assertContains(stylesCss, ".reminder-preview-dashboard-row-actions", "styles include row actions");

assertNotContains(dashboardJs, "sendEmail", "dashboard module must not send email");
assertNotContains(dashboardJs, "SMTP", "dashboard module must not reference SMTP");
assertNotContains(dashboardJs, "notification_queue", "dashboard module must not add queue");
assertNotContains(appJs, "sendEmail", "app.js does not add email sending for dashboard");

assertContains(appBundleJs, "buildReminderPreviewPackText", "bundle includes pack export helper");
assertContains(appBundleJs, "exportReminderPreviewPack", "bundle includes export pack handler");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-preview-dashboard: all checks OK");
console.log("  Previewable reminder metrics and drilldown filtering verified");
console.log("  Export reminder pack text and filename verified");
console.log("  Dashboard UI wiring and action reuse verified");
console.log("  No email delivery or automation hooks added");
