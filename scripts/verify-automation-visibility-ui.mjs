/**
 * V6 Phase 65: Email automation visibility UI verification.
 * Static checks for read-only cloud helpers, UI section, and no execution hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { summariseAutomationRun } from "../js/app/cloud/automation-runs.js";
import { sanitizePayloadForDisplay } from "../js/app/cloud/delivery-logs.js";
import {
  EMAIL_AUTOMATION_VISIBILITY_EMPTY_MESSAGE,
  mapAutomationRunToVisibilityRow,
  mapDeliveryLogToVisibilityRow,
} from "../js/app/automation/email-automation-visibility-ui.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const automationRunsJs = readFileSync(join(root, "js/app/cloud/automation-runs.js"), "utf8");
const deliveryLogsJs = readFileSync(join(root, "js/app/cloud/delivery-logs.js"), "utf8");
const visibilityUiJs = readFileSync(
  join(root, "js/app/automation/email-automation-visibility-ui.js"),
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

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    fail(`${label}: must not contain ${JSON.stringify(needle)}`);
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

console.log("V6 Phase 65 automation visibility UI verification (verify-automation-visibility-ui)\n");

assertContains(packageJson, '"verify-automation-visibility-ui"', "package.json verify script");
assertContains(packageJson, '"verify-automation-visibility-cloud-load"', "package.json cloud-load script");

assertContains(automationRunsJs, "export async function loadAutomationRuns", "automation-runs helper");
assertContains(automationRunsJs, "export function summariseAutomationRun", "summariseAutomationRun helper");
assertContains(deliveryLogsJs, "export async function loadDeliveryLogs", "delivery-logs helper");

assertContains(automationRunsJs, '.from("automation_runs")', "automation_runs table read");
assertContains(automationRunsJs, ".select(", "automation_runs select read-only");
assertContains(deliveryLogsJs, '.from("reminder_delivery_logs")', "reminder_delivery_logs table read");
assertContains(deliveryLogsJs, ".select(", "reminder_delivery_logs select read-only");

for (const helperSource of [automationRunsJs, deliveryLogsJs]) {
  for (const verb of [".insert(", ".update(", ".delete(", ".upsert("]) {
    assertNotContains(helperSource, verb, `cloud helper has no write ${verb}`);
  }
}

assertContains(indexHtml, 'id="email-automation-visibility-section"', "index.html email automation section");
assertContains(indexHtml, "Email Automation", "index.html email automation title");
assertContains(indexHtml, EMAIL_AUTOMATION_VISIBILITY_EMPTY_MESSAGE, "index.html empty message");
assertContains(
  indexHtml,
  "does not send email, retry delivery, or change delivery status",
  "index.html read-only disclaimer"
);

assertContains(appJs, 'from "./js/app/cloud/automation-runs.js"', "app.js imports automation-runs cloud helper");
assertContains(appJs, 'from "./js/app/cloud/delivery-logs.js"', "app.js imports delivery-logs cloud helper");
assertContains(
  appJs,
  'from "./js/app/automation/email-automation-visibility-ui.js"',
  "app.js imports visibility UI module"
);
assertContains(appJs, "loadEmailAutomationVisibility", "app.js loads email automation visibility");
assertContains(appJs, "renderEmailAutomationVisibility", "app.js renders email automation visibility");
assertContains(appJs, "setupEmailAutomationVisibilityListeners", "app.js wires visibility listeners");
assertContains(appJs, "loadAutomationRuns", "app.js uses loadAutomationRuns");
assertContains(appJs, "loadDeliveryLogs", "app.js uses loadDeliveryLogs");

const renderBody = extractFunctionBody(appJs, "renderEmailAutomationVisibility");
assertContains(renderBody, "deliveryStatus", "delivery status column rendered");
assertContains(renderBody, "skipReason", "skip reason column rendered");
assertContains(renderBody, "duplicateInfo", "duplicate info column rendered");
assertContains(
  renderBody,
  "Could not load automation runs",
  "visibility render shows friendly load failure message"
);

const forbiddenHooks = [
  "sendReminderEmail",
  "sendReminder",
  "mark_reminder_sent",
  "markReminderSent",
  "createResendEmailProvider",
  "Resend",
  "Retry delivery",
  "Mark sent",
  "Execute delivery",
];

const visibilityFunctionNames = [
  "renderEmailAutomationVisibility",
  "loadEmailAutomationVisibility",
  "loadEmailAutomationDeliveryLogs",
  "selectEmailAutomationRun",
  "handleEmailAutomationVisibilityRunsClick",
  "setupEmailAutomationVisibilityListeners",
];

for (const functionName of visibilityFunctionNames) {
  const body = extractFunctionBody(appJs, functionName);

  for (const needle of forbiddenHooks) {
    assertNotContains(body, needle, `${functionName} has no ${needle}`);
  }
}

for (const needle of forbiddenHooks) {
  assertNotContains(visibilityUiJs, needle, `visibility UI module has no ${needle}`);
  assertNotContains(automationRunsJs, needle, `automation-runs helper has no ${needle}`);
  assertNotContains(deliveryLogsJs, needle, `delivery-logs helper has no ${needle}`);
}

for (const needle of ["Retry", "Send reminder", "Mark sent", "Execute delivery"]) {
  const sectionStart = indexHtml.indexOf('id="email-automation-visibility-section"');
  const sectionEnd = indexHtml.indexOf("</section>", sectionStart);
  const sectionHtml =
    sectionStart >= 0 && sectionEnd > sectionStart
      ? indexHtml.slice(sectionStart, sectionEnd)
      : indexHtml;
  assertNotContains(sectionHtml, needle, `email automation section has no ${needle} action label`);
}

assertContains(stylesCss, ".email-automation-visibility-section", "styles include visibility section");
assertContains(appBundleJs, "loadAutomationRuns", "bundle includes loadAutomationRuns");
assertContains(appBundleJs, "loadEmailAutomationVisibility", "bundle includes visibility loader");

const sampleRun = {
  id: "00000000-0000-4000-8000-000000000001",
  organisationId: "00000000-0000-4000-8000-000000000099",
  automationRunId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  runType: "scheduled_reminder_dry_run",
  mode: "dry_run",
  asOfDate: "2026-06-22",
  startedAt: "2026-06-22T09:00:00.000Z",
  completedAt: "2026-06-22T09:00:01.000Z",
  status: "completed",
  summary: {},
  error: null,
  createdAt: "2026-06-22T09:00:00.000Z",
  totalCandidates: 3,
  withEmail: 2,
  missingEmail: 1,
  wouldSend: 2,
  wouldSkip: 1,
};

const sampleLogs = [
  {
    id: "00000000-0000-4000-8000-000000000010",
    organisationId: sampleRun.organisationId,
    automationRunId: sampleRun.automationRunId,
    complianceRecordId: null,
    personId: null,
    recipientEmail: "safeguarding@example.org",
    recipientName: "Test Person",
    complianceType: "DBS",
    reminderType: "30_day",
    dueDate: "2026-07-01",
    deliveryStatus: "sent",
    provider: "resend",
    providerMessageId: "email_abcdefghijklmnop",
    errorCode: null,
    errorMessage: null,
    payload: { mode: "live_send", reason: "would_send" },
    safePayload: { mode: "live_send", reason: "would_send" },
    createdAt: "2026-06-22T09:00:02.000Z",
    sentAt: "2026-06-22T09:00:03.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    organisationId: sampleRun.organisationId,
    automationRunId: sampleRun.automationRunId,
    complianceRecordId: null,
    personId: null,
    recipientEmail: null,
    recipientName: "No Email",
    complianceType: "DBS",
    reminderType: "14_day",
    dueDate: "2026-07-01",
    deliveryStatus: "skipped",
    provider: null,
    providerMessageId: null,
    errorCode: null,
    errorMessage: null,
    payload: {
      reason: "duplicate_prevented",
      duplicateOfDeliveryLogId: "00000000-0000-4000-8000-000000000010",
    },
    safePayload: {
      reason: "duplicate_prevented",
      duplicateOfDeliveryLogId: "00000000-0000-4000-8000-000000000010",
    },
    createdAt: "2026-06-22T09:00:04.000Z",
    sentAt: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    organisationId: sampleRun.organisationId,
    automationRunId: sampleRun.automationRunId,
    complianceRecordId: null,
    personId: null,
    recipientEmail: "ops@example.org",
    recipientName: "Ops",
    complianceType: "DBS",
    reminderType: "7_day",
    dueDate: "2026-07-01",
    deliveryStatus: "failed",
    provider: "resend",
    providerMessageId: null,
    errorCode: "provider_error",
    errorMessage: "Provider unavailable",
    payload: { reason: "would_send" },
    safePayload: { reason: "would_send" },
    createdAt: "2026-06-22T09:00:05.000Z",
    sentAt: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    organisationId: sampleRun.organisationId,
    automationRunId: sampleRun.automationRunId,
    complianceRecordId: null,
    personId: null,
    recipientEmail: "pending@example.org",
    recipientName: "Pending",
    complianceType: "DBS",
    reminderType: "30_day",
    dueDate: "2026-07-01",
    deliveryStatus: "pending",
    provider: null,
    providerMessageId: null,
    errorCode: null,
    errorMessage: null,
    payload: { reason: "would_send" },
    safePayload: { reason: "would_send" },
    createdAt: "2026-06-22T09:00:06.000Z",
    sentAt: null,
  },
];

const summary = summariseAutomationRun(sampleRun, sampleLogs);
assert(summary.sent === 1, "summary counts sent");
assert(summary.skipped === 1, "summary counts skipped");
assert(summary.failed === 1, "summary counts failed");
assert(summary.pending === 1, "summary counts pending");

const runRow = mapAutomationRunToVisibilityRow(sampleRun, sampleLogs);
assert(runRow.wouldSend === "2", "run row maps would send");
assert(runRow.sent === "1", "run row maps sent count");

const sentRow = mapDeliveryLogToVisibilityRow(sampleLogs[0]);
assert(sentRow.deliveryStatus === "sent", "log row maps sent status");
assert(sentRow.providerMessageId.includes("…"), "provider message id shortened");

const skippedRow = mapDeliveryLogToVisibilityRow(sampleLogs[1]);
assert(skippedRow.skipReason === "duplicate_prevented", "log row maps skip reason");
assert(skippedRow.duplicateInfo.includes("Prevented duplicate"), "log row maps duplicate info");

const sanitized = sanitizePayloadForDisplay({
  reason: "would_send",
  apiKey: "secret-should-not-appear",
  subject: "Full subject should not appear by default",
});
assert(sanitized.reason === "would_send", "sanitized payload keeps reason");
assert(!Object.prototype.hasOwnProperty.call(sanitized, "apiKey"), "sanitized payload omits secrets");
assert(!Object.prototype.hasOwnProperty.call(sanitized, "subject"), "sanitized payload omits subject");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-automation-visibility-ui: all checks OK");
