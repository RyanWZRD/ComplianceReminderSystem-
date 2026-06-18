/**
 * V6 Phase 22: Delivery Operations Log UI verification.
 * Static checks for read-only delivery log section, safe rendering, CSV export, and no execution hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DELIVERY_OPERATIONS_LOG_EMPTY_MESSAGE,
  computeDeliveryOperationsLogSummary,
  mapDeliveryLogToOperationsRow,
} from "../js/app/automation/delivery-operations-log-ui.js";
import {
  buildDeliveryOperationsLogExportCsv,
  getDeliveryOperationsLogExportFilename,
} from "../js/app/automation/delivery-operations-log-export.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const deliveryLogUiJs = readFileSync(
  join(root, "js/app/automation/delivery-operations-log-ui.js"),
  "utf8"
);
const deliveryLogExportJs = readFileSync(
  join(root, "js/app/automation/delivery-operations-log-export.js"),
  "utf8"
);
const cloudAutomationStoreJs = readFileSync(
  join(root, "js/data/cloud-automation-store.js"),
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

console.log("V6 Phase 22 Delivery Operations Log UI verification (verify-delivery-operations-log-ui)\n");

assertContains(packageJson, '"verify-delivery-operations-log-ui"', "package.json verify script");

assertContains(indexHtml, 'id="delivery-operations-log-section"', "index.html delivery operations log section");
assertContains(indexHtml, "Delivery Operations Log", "index.html delivery operations log title");
assertContains(indexHtml, 'id="delivery-operations-log-empty"', "index.html delivery log empty state");
assertContains(indexHtml, DELIVERY_OPERATIONS_LOG_EMPTY_MESSAGE, "index.html delivery log empty message");
assertContains(indexHtml, 'id="delivery-operations-log-error"', "index.html delivery log error state");
assertContains(indexHtml, 'id="delivery-operations-log-total-count"', "index.html delivery log summary total");
assertContains(indexHtml, 'id="delivery-operations-log-delivered-count"', "index.html delivery log summary delivered");
assertContains(indexHtml, 'id="delivery-operations-log-failed-count"', "index.html delivery log summary failed");
assertContains(indexHtml, 'id="delivery-operations-log-other-count"', "index.html delivery log summary other");
assertContains(indexHtml, 'id="export-delivery-operations-log-csv-btn"', "index.html delivery log CSV export button");
assertContains(
  indexHtml,
  "does not send email or execute delivery",
  "index.html delivery log read-only disclaimer"
);

assertContains(
  appJs,
  'from "./js/app/automation/delivery-operations-log-ui.js"',
  "app.js imports delivery operations log UI module"
);
assertContains(
  appJs,
  'from "./js/app/automation/delivery-operations-log-export.js"',
  "app.js imports delivery operations log export module"
);
assertContains(appJs, "loadDeliveryOperationsLog", "app.js loads delivery operations log");
assertContains(appJs, "renderDeliveryOperationsLog", "app.js renders delivery operations log");
assertContains(appJs, "setupDeliveryOperationsLogListeners", "app.js wires delivery operations log listeners");
assertContains(appJs, "exportDeliveryOperationsLogCsv", "app.js exports delivery operations log CSV");
assertContains(appJs, "loadReminderDeliveryLogs", "app.js loads delivery logs via repository");

const renderBody = extractFunctionBody(appJs, "renderDeliveryOperationsLog");
assertContains(renderBody, "bodyElement.textContent = row.bodyText", "detail body uses textContent");
assertContains(renderBody, "metadataElement.textContent = row.metadataJson", "detail metadata uses textContent");
assertContains(
  renderBody,
  "delivery-operations-log-view-details-btn",
  "delivery log table renders view details control"
);
assertContains(renderBody, "View details", "delivery log table view details label");
assertContains(
  renderBody,
  "Could not load delivery logs",
  "delivery log render shows friendly load failure message"
);
assertContains(renderBody, "computeDeliveryOperationsLogSummary", "delivery log render updates summary counts");

const exportBody = extractFunctionBody(appJs, "exportDeliveryOperationsLogCsv");
assertContains(exportBody, "buildDeliveryOperationsLogExportCsv", "export uses delivery log CSV builder");
assertContains(exportBody, "downloadFile", "export downloads CSV file");

assertContains(cloudAutomationStoreJs, "get_reminder_delivery_logs", "cloud store calls get_reminder_delivery_logs RPC");
assertContains(cloudAutomationStoreJs, "loadReminderDeliveryLogs", "cloud store exposes loadReminderDeliveryLogs");

const forbiddenHooks = [
  "sendReminder",
  "createResendEmailProvider",
  "executeMockReminderDelivery",
  "executeReminderDelivery",
  "Run delivery",
  "Send reminder",
  "Retry delivery",
  "Execute delivery",
  "Mark sent",
];

const deliveryLogFunctionNames = [
  "renderDeliveryOperationsLog",
  "loadDeliveryOperationsLog",
  "exportDeliveryOperationsLogCsv",
  "setupDeliveryOperationsLogListeners",
  "handleDeliveryOperationsLogTableClick",
  "toggleDeliveryOperationsLogDetails",
];

for (const functionName of deliveryLogFunctionNames) {
  const body = extractFunctionBody(appJs, functionName);

  for (const needle of [...forbiddenHooks, "markReminderSent", "mark_reminder_sent"]) {
    assertNotContains(body, needle, `${functionName} has no ${needle}`);
  }
}

for (const needle of forbiddenHooks) {
  assertNotContains(deliveryLogUiJs, needle, `delivery log UI module has no ${needle}`);
  assertNotContains(deliveryLogExportJs, needle, `delivery log export module has no ${needle}`);
}

assertNotContains(cloudAutomationStoreJs, "sendReminder", "cloud store has no sendReminder");
assertContains(
  cloudAutomationStoreJs,
  "createReminderDeliveryLog",
  "cloud store exposes createReminderDeliveryLog repository method"
);
assertNotContains(appJs, "createReminderDeliveryLog", "app.js does not call createReminderDeliveryLog");
assertNotContains(appJs, "persistDeliveryLogPayloads", "app.js does not call persistDeliveryLogPayloads");

for (const needle of ["Send reminder", "Retry delivery", "Execute delivery", "Mark sent"]) {
  assertNotContains(indexHtml, needle, `index.html has no ${needle}`);
}

assertContains(stylesCss, ".delivery-operations-log-section", "styles include delivery operations log section");
assertContains(stylesCss, ".delivery-operations-log-detail-panel", "styles include delivery log detail panel");

assertContains(appBundleJs, "mapDeliveryLogsToOperationsRows", "bundle includes delivery operations log UI");
assertContains(appBundleJs, "loadDeliveryOperationsLog", "bundle includes delivery operations log loader");
assertNotContains(appBundleJs, "sendReminder(", "bundle has no sendReminder calls");

const sampleLog = {
  id: "00000000-0000-4000-8000-000000000001",
  organisationId: "00000000-0000-4000-8000-000000000099",
  automationRunId: "00000000-0000-4000-8000-000000000002",
  queueItemId: "queue-item-1",
  complianceRecordId: null,
  personId: null,
  recipientEmail: "safeguarding@example.org",
  subject: "DBS reminder",
  bodyText: "Please renew your DBS.",
  deliveryStatus: "delivered",
  preparedAt: "2026-06-17T09:00:00.000Z",
  sentAt: "2026-06-17T09:00:01.000Z",
  deliveredAt: "2026-06-17T09:00:02.000Z",
  failedAt: null,
  failureReason: null,
  metadata: { providerMessageId: "email_123", testMode: true },
  createdBy: null,
  createdAt: "2026-06-17T09:00:00.000Z",
  updatedAt: "2026-06-17T09:00:02.000Z",
};

const row = mapDeliveryLogToOperationsRow(sampleLog);

assertEqual(row.deliveryStatus, "delivered", "operations row maps delivery status");
assertEqual(row.recipientEmail, "safeguarding@example.org", "operations row maps recipient");
assertEqual(row.providerMessageId, "email_123", "operations row maps provider message id");

const summary = computeDeliveryOperationsLogSummary([
  sampleLog,
  {
    ...sampleLog,
    id: "00000000-0000-4000-8000-000000000003",
    deliveryStatus: "failed",
  },
  {
    ...sampleLog,
    id: "00000000-0000-4000-8000-000000000004",
    deliveryStatus: "prepared",
  },
]);

assertEqual(summary.total, 3, "summary total count");
assertEqual(summary.delivered, 1, "summary delivered count");
assertEqual(summary.failed, 1, "summary failed count");
assertEqual(summary.preparedSendingCancelled, 1, "summary prepared/sending/cancelled count");

const csv = buildDeliveryOperationsLogExportCsv([sampleLog]);

assertContains(csv, "Recipient email", "CSV export includes recipient header");
assertContains(csv, "safeguarding@example.org", "CSV export includes recipient value");
assertContains(csv, "Delivered at", "CSV export includes delivered at header");

assert(
  typeof getDeliveryOperationsLogExportFilename() === "string" &&
    getDeliveryOperationsLogExportFilename().startsWith("delivery-operations-log-"),
  "export filename prefix"
);

const xssRow = mapDeliveryLogToOperationsRow({
  ...sampleLog,
  subject: '<script>alert("xss")</script>',
  bodyText: '<img onerror="alert(1)">',
  metadata: { note: "<b>bold</b>" },
});

assertContains(xssRow.metadataJson, "<b>", "metadata JSON preserves literal markup for textContent");

assertNotContains(deliveryLogUiJs, "sendReminder", "delivery log UI module has no sendReminder");
assertNotContains(deliveryLogExportJs, "sendReminder", "delivery log export module has no sendReminder");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-delivery-operations-log-ui: all checks OK");
