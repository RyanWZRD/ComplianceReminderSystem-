/**
 * V6 Phase 33: Manual delivery test UI verification.
 * Static checks for admin-only manual delivery execution surface — no scheduling,
 * mark-as-sent automation, or compliance/history mutation hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MANUAL_DELIVERY_CONFIRMATION_MESSAGE,
  MANUAL_DELIVERY_RUN_BUTTON_LABEL,
  MANUAL_DELIVERY_TEST_SAFETY_NOTE,
  buildManualDeliveryResultSummary,
  computeManualDeliveryQueueSummary,
  formatManualDeliveryModeLabel,
} from "../js/app/automation/manual-delivery-ui.js";
import { executeManualDeliveryTest } from "../js/app/automation/manual-delivery-execution.js";
import {
  REMINDER_QUEUE_SOURCE,
  REMINDER_QUEUE_STATUS,
} from "../js/app/automation/reminder-queue.js";
import { REMINDER_UI_LABELS } from "../js/data/reminder-sent.js";
import { EMAIL_PROVIDER_RUNTIME } from "../js/data/email-provider-env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const permissionsJs = readFileSync(join(root, "js/app/permissions.js"), "utf8");
const manualDeliveryUiJs = readFileSync(
  join(root, "js/app/automation/manual-delivery-ui.js"),
  "utf8"
);
const manualDeliveryExecutionJs = readFileSync(
  join(root, "js/app/automation/manual-delivery-execution.js"),
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

console.log("V6 Phase 33 manual delivery test UI verification (verify-manual-delivery-ui)\n");

assertContains(packageJson, '"verify-manual-delivery-ui"', "package.json verify script");

assertContains(indexHtml, 'id="manual-delivery-test-section"', "index.html manual delivery test section");
assertContains(indexHtml, "Manual Delivery Test", "index.html manual delivery test title");
assertContains(indexHtml, MANUAL_DELIVERY_TEST_SAFETY_NOTE, "index.html manual delivery safety note");
assertContains(indexHtml, 'id="manual-delivery-test-total-count"', "index.html manual delivery total queued");
assertContains(indexHtml, 'id="manual-delivery-test-missing-email-count"', "index.html manual delivery missing email");
assertContains(indexHtml, 'id="manual-delivery-test-mode-value"', "index.html manual delivery mode");
assertContains(indexHtml, 'id="manual-delivery-test-run-btn"', "index.html manual delivery run button");
assertContains(indexHtml, MANUAL_DELIVERY_RUN_BUTTON_LABEL, "index.html run delivery test button label");
assertContains(
  indexHtml,
  'class="card manual-delivery-test-section hidden"',
  "index.html manual delivery section hidden by default"
);

assertContains(permissionsJs, "export function canRunManualDeliveryTest", "permissions exports canRunManualDeliveryTest");
assertContains(permissionsJs, "return canAdmin()", "manual delivery permission requires admin");

assertContains(appJs, 'from "./js/app/automation/manual-delivery-ui.js"', "app.js imports manual delivery UI module");
assertContains(
  appJs,
  'from "./js/app/automation/manual-delivery-execution.js"',
  "app.js imports manual delivery execution module"
);
assertContains(appJs, "canRunManualDeliveryTest", "app.js uses canRunManualDeliveryTest");
assertContains(appJs, "renderManualDeliveryTest", "app.js renders manual delivery test card");
assertContains(appJs, "handleManualDeliveryTestRun", "app.js handles manual delivery test run");
assertContains(appJs, "setupManualDeliveryTestListeners", "app.js wires manual delivery listeners");
assertContains(appJs, "executeManualDeliveryTest", "app.js calls executeManualDeliveryTest");
assertContains(appJs, "confirm(MANUAL_DELIVERY_CONFIRMATION_MESSAGE)", "app.js confirms before manual delivery test");
assertContains(appJs, "buildReminderQueuePreviewData", "manual delivery uses reminder preview queue");
assertContains(appJs, "getOrganisationId", "manual delivery resolves organisation id");

assertContains(manualDeliveryExecutionJs, "invokeSendReminderDeliveries", "execution module invokes Edge Function client");
assertContains(manualDeliveryExecutionJs, "send-reminder-deliveries", "execution module references send-reminder-deliveries");
assertContains(manualDeliveryUiJs, "export function computeManualDeliveryQueueSummary", "UI module queue summary");
assertContains(manualDeliveryUiJs, "MANUAL_DELIVERY_CONFIRMATION_MESSAGE", "UI module confirmation constant");
assertContains(manualDeliveryUiJs, "Emails may be sent", "UI module confirmation mentions sending");

const renderBody = extractFunctionBody(appJs, "renderManualDeliveryTest");
assertContains(renderBody, "canRunManualDeliveryTest()", "render gates admin-only visibility");
assertContains(renderBody, 'classList.toggle("hidden", !visible)', "render hides section for non-admin");

const runBody = extractFunctionBody(appJs, "handleManualDeliveryTestRun");
assertContains(runBody, "confirm(", "run handler uses confirmation dialog");
assertContains(runBody, "executeManualDeliveryTest", "run handler invokes execution coordinator");

const forbiddenHooks = [
  "markReminderSent",
  "mark_reminder_sent",
  "setInterval",
  "setTimeout",
  "cron",
  "add_default_actions",
  "history_entries",
  "enqueue_reminder_notifications",
  "process_notification_queue",
];

const manualDeliveryFunctionNames = [
  "renderManualDeliveryTest",
  "handleManualDeliveryTestRun",
  "setupManualDeliveryTestListeners",
];

for (const functionName of manualDeliveryFunctionNames) {
  const body = extractFunctionBody(appJs, functionName);

  for (const needle of forbiddenHooks) {
    assertNotContains(body, needle, `${functionName} has no ${needle}`);
  }
}

for (const needle of forbiddenHooks) {
  assertNotContains(manualDeliveryUiJs, needle, `manual-delivery-ui.js has no ${needle}`);
  assertNotContains(manualDeliveryExecutionJs, needle, `manual-delivery-execution.js has no ${needle}`);
}

assertContains(stylesCss, ".manual-delivery-test-section", "styles include manual delivery test section");
assertContains(appBundleJs, "executeManualDeliveryTest", "bundle includes manual delivery execution");
assertContains(appBundleJs, "invokeSendReminderDeliveries", "bundle includes Edge Function delivery invoke");
assertContains(appBundleJs, "send-reminder-deliveries", "bundle includes send-reminder-deliveries function name");

const queueSummary = computeManualDeliveryQueueSummary([
  { email: "a@example.com", emailMissing: false },
  { email: null, emailMissing: true },
]);

assertEqual(queueSummary.totalQueued, 2, "queue summary total queued");
assertEqual(queueSummary.missingEmail, 1, "queue summary missing email");

assertEqual(formatManualDeliveryModeLabel("test"), "test", "mode label test");
assertEqual(formatManualDeliveryModeLabel("production"), "production", "mode label production");
assertEqual(formatManualDeliveryModeLabel("disabled"), "disabled", "mode label disabled");

const resultSummary = buildManualDeliveryResultSummary({
  attempted: 2,
  delivered: 1,
  failed: 1,
  skipped: 3,
});

assertEqual(resultSummary.attempted, 2, "result summary attempted");
assertEqual(resultSummary.delivered, 1, "result summary delivered");
assertEqual(resultSummary.failed, 1, "result summary failed");
assertEqual(resultSummary.skipped, 3, "result summary skipped");

assertContains(MANUAL_DELIVERY_CONFIRMATION_MESSAGE, "Emails may be sent", "confirmation mentions emails may be sent");
assertContains(
  MANUAL_DELIVERY_CONFIRMATION_MESSAGE,
  "test mode",
  "confirmation mentions test mode redirect"
);
assertContains(
  MANUAL_DELIVERY_CONFIRMATION_MESSAGE,
  "cannot be undone",
  "confirmation mentions irreversibility"
);

const organisationId = "11111111-1111-4111-8111-111111111111";
const automationRunId = "22222222-2222-4222-8222-222222222222";

Object.assign(EMAIL_PROVIDER_RUNTIME, {
  EMAIL_PROVIDER: "resend",
  EMAIL_MODE: "test",
  EMAIL_PROVIDER_ENABLED: "true",
  EMAIL_FROM_ADDRESS: "onboarding@resend.dev",
  EMAIL_TEST_REDIRECT_TO: "staging-inbox@example.org",
});

const db = {
  async createAutomationRun() {
    return {
      ok: true,
      run: { id: automationRunId },
    };
  },
};

const mockSupabase = {
  functions: {
    async invoke(_functionName, { body }) {
      const records = Array.isArray(body?.deliveryRecords) ? body.deliveryRecords : [];
      const attempted = records.filter((record) => String(record.recipientEmail ?? "").trim()).length;

      return {
        data: {
          status: "ok",
          summary: {
            total: records.length,
            attempted,
            delivered: attempted,
            failed: 0,
            skipped: records.length - attempted,
          },
          results: records.map((record) => ({
            queueItemId: record.queueItemId,
            deliveryStatus: String(record.recipientEmail ?? "").trim() ? "delivered" : "skipped",
          })),
        },
        error: null,
      };
    },
  },
};

try {
  const executionResult = await executeManualDeliveryTest({
    queueItems: [
      {
        personName: "Alex Volunteer",
        complianceType: "DBS",
        expiryDate: "2026-07-15",
        reminderWindow: "14-day",
        reminderType: REMINDER_UI_LABELS[14],
        email: "alex.volunteer@example.com",
        emailMissing: false,
        status: REMINDER_QUEUE_STATUS,
        source: REMINDER_QUEUE_SOURCE,
        asOfDate: "2026-06-18",
        sent: false,
        delivered: false,
        markedSent: false,
        sentAt: null,
        deliveredAt: null,
        markedSentAt: null,
        failed: false,
        failureReason: null,
      },
    ],
    db,
    organisationId,
    organisationName: "Test Org",
    asOfDate: "2026-06-18",
    supabase: mockSupabase,
  });

  assertEqual(executionResult.executionSummary.attempted, 1, "execution coordinator attempted count");
  assertEqual(executionResult.persistenceSummary.persisted, 0, "execution coordinator skips delivery log writes in Phase 39");
} catch (error) {
  fail(`executeManualDeliveryTest smoke: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-manual-delivery-ui: all checks OK");
