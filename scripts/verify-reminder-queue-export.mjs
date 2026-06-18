/**
 * V5-1 Phase 3: Reminder queue preview CSV export.
 * Static checks for export button, CSV headers/escaping, missing email clarity, and no execution hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";
import {
  REMINDER_QUEUE_EXPORT_COLUMNS,
  REMINDER_QUEUE_EXPORT_EMAIL_MISSING_NO,
  REMINDER_QUEUE_EXPORT_EMAIL_MISSING_YES,
  buildReminderQueueExportCsv,
  getReminderQueueExportFilename,
  mapReminderQueueItemToExportRow,
} from "../js/app/automation/reminder-queue-export.js";
import { escapeCsvValue } from "../js/app/insights/insights-export.js";
import {
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const exportJs = readFileSync(
  join(root, "js/app/automation/reminder-queue-export.js"),
  "utf8"
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");

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

function parseCsvLine(line) {
  /** @type {string[]} */
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseCsvRows(content) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(current);
      current = "";
    } else if (char === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else if (char === "\r") {
      continue;
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

console.log("V5-1 Phase 3 reminder queue export verification (verify-reminder-queue-export)\n");

assertContains(
  packageJson,
  '"verify-reminder-queue-export": "node scripts/verify-reminder-queue-export.mjs"',
  "package.json verify-reminder-queue-export script"
);

assertContains(indexHtml, 'id="export-reminder-queue-csv-btn"', "index.html export queue CSV button");
assertContains(indexHtml, "Export queue CSV", "index.html export queue CSV label");
assertContains(indexHtml, "disabled", "index.html export button starts disabled");

assertNotContains(indexHtml, "Send reminder", "index.html has no send reminder button in queue section");
assertNotContains(indexHtml, "Mark sent", "index.html has no mark sent button in queue section");
assertNotContains(indexHtml, "Execute automation", "index.html has no execute automation button in queue section");

assertContains(appJs, 'from "./js/app/automation/reminder-queue-export.js"', "app.js imports reminder queue export module");
assertContains(appJs, "buildReminderQueueExportCsv", "app.js uses reminder queue CSV builder");
assertContains(appJs, "exportReminderQueueCsv", "app.js defines exportReminderQueueCsv");
assertContains(appJs, "setupReminderQueuePreviewListeners", "app.js wires reminder queue preview listeners");

const exportBody = extractFunctionBody(appJs, "exportReminderQueueCsv");
const renderQueueBody = extractFunctionBody(appJs, "renderReminderQueuePreview");

assertContains(exportBody, "buildReminderQueuePreviewData", "export uses preview queue data");
assertContains(exportBody, "buildReminderQueueExportCsv", "export builds CSV from preview queue");
assertContains(exportBody, "downloadFile", "export downloads CSV file");
assertContains(renderQueueBody, "exportReminderQueueCsvBtn.disabled", "render disables export when queue empty");

const forbiddenExportHooks = [
  "sendEmail",
  "sendReminder",
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "enqueue_reminder_notifications",
  "process_notification_queue",
  "logAutomationDryRunRun",
  "createAutomationRun",
  "apply_automation_policies",
];

for (const needle of forbiddenExportHooks) {
  assertNotContains(exportBody, needle, `exportReminderQueueCsv has no ${needle}`);
  assertNotContains(exportJs, needle, `reminder-queue-export.js has no ${needle}`);
}

const forbiddenMutationHooks = [
  "repository.save",
  "saveCompliance",
  "createComplianceRecord",
  "updateComplianceRecord",
  "renewCompliance",
  "setActionStatus",
  "createAction",
  "deleteAction",
  "createEvidence",
  "deleteEvidence",
  "updateEvidence",
  "archiveComplianceRecord",
  "history_entries",
  "add_default_actions",
  ".rpc(",
];

for (const needle of forbiddenMutationHooks) {
  assertNotContains(exportBody, needle, `exportReminderQueueCsv has no ${needle}`);
  assertNotContains(exportJs, needle, `reminder-queue-export.js has no ${needle}`);
}

assertContains(appBundleJs, "buildReminderQueueExportCsv", "bundle includes reminder queue CSV builder");
assertContains(appBundleJs, "exportReminderQueueCsv", "bundle includes reminder queue CSV export handler");

const expectedHeaders = REMINDER_QUEUE_EXPORT_COLUMNS.map((column) => column.label);
assertEqual(
  expectedHeaders.join(","),
  [
    "Person name",
    "Compliance type",
    "Expiry date",
    "Reminder window/type",
    "Email",
    "Email missing",
    "Status",
    "Source",
    "As of date",
  ].join(","),
  "export column headers"
);

assertEqual(
  escapeCsvValue('Name, "quoted"'),
  '"Name, ""quoted"""',
  "escapeCsvValue handles commas and quotes"
);
assertEqual(
  escapeCsvValue("line\nbreak"),
  '"line\nbreak"',
  "escapeCsvValue handles newlines"
);
assertEqual(escapeCsvValue(""), "", "escapeCsvValue handles empty values");

const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const queue = buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assert(queue.items.length > 0, "fixture queue has export rows");

const csv = buildReminderQueueExportCsv(queue, (date) => `fmt:${date}`);
const lines = csv.split("\n");
assertEqual(lines[0], expectedHeaders.join(","), "CSV header row");

const firstDataRow = parseCsvLine(lines[1]);
assertEqual(firstDataRow.length, expectedHeaders.length, "first CSV data row column count");
assertEqual(firstDataRow[5], REMINDER_QUEUE_EXPORT_EMAIL_MISSING_YES, "fixture row flags missing email");

queue.items.forEach((item, index) => {
  const row = parseCsvLine(lines[index + 1]);
  assertEqual(row[5], REMINDER_QUEUE_EXPORT_EMAIL_MISSING_YES, `${item.personName} email missing column`);
  assertEqual(row[6], "queued", `${item.personName} status column`);
  assertEqual(row[7], "dry_run_candidate", `${item.personName} source column`);
  assertEqual(row[8], FIXTURE_AS_OF_DATE, `${item.personName} as of date column`);
  assertEqual(row[4], "", `${item.personName} email column empty when missing`);
});

const withEmailRow = mapReminderQueueItemToExportRow(
  {
    personName: 'Jordan "Coordinator"',
    complianceType: "DBS, Enhanced",
    expiryDate: "2026-06-01",
    reminderWindow: "30-day",
    email: "jordan@example.com",
    emailMissing: false,
    status: "queued",
    source: "dry_run_candidate",
    asOfDate: FIXTURE_AS_OF_DATE,
  },
  (date) => date
);

assertEqual(withEmailRow.email, "jordan@example.com", "export row retains email when present");
assertEqual(withEmailRow.emailMissing, REMINDER_QUEUE_EXPORT_EMAIL_MISSING_NO, "export row marks email present");

const specialCharsCsv = buildReminderQueueExportCsv(
  {
    asOfDate: FIXTURE_AS_OF_DATE,
    items: [
      {
        personName: 'Alex "Alpha"',
        complianceType: "Type, with comma",
        expiryDate: "2026-06-01",
        reminderWindow: "7-day",
        email: "alex@example.com",
        emailMissing: false,
        status: "queued",
        source: "dry_run_candidate",
        asOfDate: FIXTURE_AS_OF_DATE,
      },
      {
        personName: "Multi\nLine",
        complianceType: "DBS",
        expiryDate: "2026-06-02",
        reminderWindow: "14-day",
        email: null,
        emailMissing: true,
        status: "queued",
        source: "dry_run_candidate",
        asOfDate: FIXTURE_AS_OF_DATE,
      },
    ],
  },
  (date) => date
);

const specialLines = parseCsvRows(specialCharsCsv);
const quotedRow = specialLines[1];
assertEqual(quotedRow[0], 'Alex "Alpha"', "CSV parses quoted person name");
assertEqual(quotedRow[1], "Type, with comma", "CSV parses comma in compliance type");
assertEqual(quotedRow[4], "alex@example.com", "CSV parses email value");

const newlineRow = specialLines[2];
assertEqual(newlineRow[0], "Multi\nLine", "CSV parses newline in person name");
assertEqual(newlineRow[4], "", "CSV leaves email empty when missing");
assertEqual(newlineRow[5], REMINDER_QUEUE_EXPORT_EMAIL_MISSING_YES, "CSV marks missing email clearly");

assertEqual(
  getReminderQueueExportFilename(FIXTURE_AS_OF_DATE),
  `reminder-queue-preview-${FIXTURE_AS_OF_DATE}.csv`,
  "export filename uses scan as-of date"
);

const emptyCsv = buildReminderQueueExportCsv({ asOfDate: FIXTURE_AS_OF_DATE, items: [] });
assertEqual(emptyCsv, expectedHeaders.join(","), "empty queue exports header row only");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-queue-export: all checks OK");
console.log("  Export queue CSV button and wiring verified");
console.log("  CSV headers, escaping, and missing-email columns verified");
console.log("  No send/execute/mark-sent or app mutation hooks in export path");
