/**
 * V5-1 Phase 2: Reminder queue preview UI.
 * Static checks for read-only queue preview section, field rendering, and no execution hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";
import {
  REMINDER_QUEUE_MISSING_EMAIL_LABEL,
  REMINDER_QUEUE_PREVIEW_COLUMNS,
  REMINDER_QUEUE_PREVIEW_EMPTY_MESSAGE,
  REMINDER_QUEUE_PREVIEW_SAFETY_NOTE,
  mapReminderQueueItemToPreviewRow,
  mapReminderQueueItemsToPreviewRows,
} from "../js/app/automation/reminder-queue-ui.js";
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
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const queueUiJs = readFileSync(join(root, "js/app/automation/reminder-queue-ui.js"), "utf8");
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

console.log("V5-1 Phase 2 reminder queue preview UI verification (verify-reminder-queue-ui)\n");

assertContains(
  packageJson,
  '"verify-reminder-queue-ui": "node scripts/verify-reminder-queue-ui.mjs"',
  "package.json verify-reminder-queue-ui script"
);

assertContains(indexHtml, 'id="reminder-queue-preview-section"', "index.html reminder queue preview section");
assertContains(indexHtml, "Reminder Queue Preview", "index.html reminder queue preview title");
assertContains(
  indexHtml,
  REMINDER_QUEUE_PREVIEW_SAFETY_NOTE,
  "index.html reminder queue preview safety note"
);
assertContains(
  indexHtml,
  'id="reminder-queue-preview-empty"',
  "index.html reminder queue preview empty state"
);
assertContains(
  indexHtml,
  REMINDER_QUEUE_PREVIEW_EMPTY_MESSAGE,
  "index.html reminder queue preview empty message"
);
assertContains(
  indexHtml,
  'id="reminder-queue-preview-table-body"',
  "index.html reminder queue preview table body"
);
assertContains(indexHtml, 'id="reminder-queue-preview-total-count"', "index.html total queued count");
assertContains(
  indexHtml,
  'id="reminder-queue-preview-missing-email-count"',
  "index.html missing email count"
);
assertContains(indexHtml, 'id="reminder-queue-preview-expired-count"', "index.html expired count");
assertContains(indexHtml, 'id="reminder-queue-preview-30-count"', "index.html 30-day count");
assertContains(indexHtml, 'id="reminder-queue-preview-14-count"', "index.html 14-day count");
assertContains(indexHtml, 'id="reminder-queue-preview-7-count"', "index.html 7-day count");

assertNotContains(indexHtml, "Run automation", "index.html has no run automation button");
assertNotContains(indexHtml, "Run dry run", "index.html has no run dry run button");
assertNotContains(indexHtml, "Execute automation", "index.html has no execute automation button");
assertNotContains(indexHtml, "Mark sent", "index.html has no mark sent button in queue preview");
assertNotContains(indexHtml, "Send reminder", "index.html has no send reminder button");

assertContains(appJs, 'from "./js/app/automation/reminder-queue.js"', "app.js imports reminder queue module");
assertContains(
  appJs,
  'from "./js/app/automation/reminder-queue-ui.js"',
  "app.js imports reminder queue UI module"
);
assertContains(appJs, "computeAutomationDryRun", "app.js uses dry-run scan engine");
assertContains(appJs, "buildReminderQueueFromDryRun", "app.js builds reminder queue from dry-run");
assertContains(appJs, "renderReminderQueuePreview", "app.js renders reminder queue preview");
assertContains(appJs, "buildReminderQueuePreviewData", "app.js builds reminder queue preview data");

const renderQueueBody = extractFunctionBody(appJs, "renderReminderQueuePreview");
const buildQueueBody = extractFunctionBody(appJs, "buildReminderQueuePreviewData");

assertContains(renderQueueBody, "escapeHtml(row.personName)", "queue table escapes person name");
assertContains(renderQueueBody, "escapeHtml(row.complianceType)", "queue table escapes compliance type");
assertContains(renderQueueBody, "escapeHtml(row.email)", "queue table escapes email");
assertContains(renderQueueBody, "reminder-queue-preview-email-missing", "queue table marks missing email rows");
assertContains(
  renderQueueBody,
  "reminderQueuePreviewEmpty.classList.remove",
  "queue render shows empty state"
);
assertContains(buildQueueBody, "computeAutomationDryRun", "queue preview data uses dry-run scan");
assertContains(buildQueueBody, "buildReminderQueueFromDryRun", "queue preview data uses queue builder");

const forbiddenQueueHooks = [
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

for (const needle of forbiddenQueueHooks) {
  assertNotContains(renderQueueBody, needle, `renderReminderQueuePreview has no ${needle}`);
  assertNotContains(buildQueueBody, needle, `buildReminderQueuePreviewData has no ${needle}`);
  assertNotContains(queueUiJs, needle, `reminder-queue-ui.js has no ${needle}`);
}

assertNotContains(appJs, "Run automation", "app.js has no run automation button");
assertNotContains(appJs, "Run dry run", "app.js has no run dry run button");
assertNotContains(appJs, "Execute automation", "app.js has no execute automation button");
assertNotContains(renderQueueBody, "mark-sent", "queue preview has no mark-sent control");
assertNotContains(renderQueueBody, "send-btn", "queue preview has no send button");

assertContains(stylesCss, ".reminder-queue-preview-section", "styles include reminder queue preview section");
assertContains(stylesCss, ".reminder-queue-preview-email-missing", "styles include missing email state");

assertContains(appBundleJs, "renderReminderQueuePreview", "bundle includes reminder queue preview renderer");
assertContains(appBundleJs, "buildReminderQueueFromDryRun", "bundle includes reminder queue builder");

const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const queue = buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assert(queue.items.length > 0, "fixture queue has preview rows");

const previewRows = mapReminderQueueItemsToPreviewRows(queue.items, (date) => `fmt:${date}`);
assertEqual(previewRows.length, queue.items.length, "preview rows match queue items");

previewRows.forEach((row) => {
  assertEqual(row.status, "queued", `${row.personName} preview status is queued`);
  assertEqual(row.source, "dry_run_candidate", `${row.personName} preview source is dry_run_candidate`);
  assert(row.emailMissing, `${row.personName} preview row flagged missing email`);
  assertEqual(row.email, REMINDER_QUEUE_MISSING_EMAIL_LABEL, `${row.personName} preview email label`);
});

const withEmailPreview = mapReminderQueueItemToPreviewRow(
  {
    personName: "Jordan",
    complianceType: "DBS",
    expiryDate: "2026-06-01",
    reminderWindow: "30-day",
    reminderType: "30 Day Reminder",
    email: "jordan@example.com",
    emailMissing: false,
    status: "queued",
    source: "dry_run_candidate",
  },
  (date) => date
);

assertEqual(withEmailPreview.email, "jordan@example.com", "preview row shows email when present");
assertEqual(withEmailPreview.emailMissing, false, "preview row not flagged when email present");

REMINDER_QUEUE_PREVIEW_COLUMNS.forEach((column) => {
  assertContains(queueUiJs, column.label, `queue UI module defines ${column.key} column label`);
});

const xssPreview = mapReminderQueueItemToPreviewRow(
  {
    personName: '<script>alert("xss")</script>',
    complianceType: "DBS",
    expiryDate: "2026-06-01",
    reminderWindow: "7-day",
    reminderType: "7 Day Reminder",
    email: null,
    emailMissing: true,
    status: "queued",
    source: "dry_run_candidate",
  },
  (date) => date
);

assertContains(xssPreview.personName, "<script>", "preview row preserves literal script text for escapeHtml");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-queue-ui: all checks OK");
console.log("  Reminder queue preview UI elements verified");
console.log("  Queue fields render from dry-run dataset logic");
console.log("  Missing email state and safety note present");
console.log("  No send/execute/mark-sent hooks in queue preview path");
