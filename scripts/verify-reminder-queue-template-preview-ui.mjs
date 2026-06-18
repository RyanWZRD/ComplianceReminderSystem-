/**
 * V5-2 Phase 2: Reminder queue template preview UI verification.
 * Static checks for expandable queue template preview, safe rendering, and no execution hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";
import {
  REMINDER_QUEUE_TEMPLATE_MISSING_EMAIL_WARNING,
  REMINDER_QUEUE_TEMPLATE_PREVIEW_BUTTON_LABEL,
  REMINDER_QUEUE_TEMPLATE_PREVIEW_SAFETY_NOTE,
  getReminderQueueTemplatePreviewButtonLabel,
  mapReminderQueueTemplatePreviewMetadata,
} from "../js/app/automation/reminder-queue-template-preview-ui.js";
import { buildReminderEmailTemplate } from "../js/app/automation/reminder-template-builder.js";
import {
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const previewUiJs = readFileSync(
  join(root, "js/app/automation/reminder-queue-template-preview-ui.js"),
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

console.log(
  "V5-2 Phase 2 reminder queue template preview UI verification (verify-reminder-queue-template-preview-ui)\n"
);

assertContains(
  packageJson,
  '"verify-reminder-queue-template-preview-ui": "node scripts/verify-reminder-queue-template-preview-ui.mjs"',
  "package.json verify-reminder-queue-template-preview-ui script"
);

assertContains(
  previewUiJs,
  "export const REMINDER_QUEUE_TEMPLATE_PREVIEW_SAFETY_NOTE",
  "preview UI module exports safety note"
);
assertContains(
  previewUiJs,
  "export const REMINDER_QUEUE_TEMPLATE_PREVIEW_BUTTON_LABEL",
  "preview UI module exports button label"
);
assertContains(
  previewUiJs,
  "export const REMINDER_QUEUE_TEMPLATE_MISSING_EMAIL_WARNING",
  "preview UI module exports missing email warning"
);

assertContains(appJs, 'from "./js/app/automation/reminder-template-builder.js"', "app.js imports template builder");
assertContains(
  appJs,
  'from "./js/app/automation/reminder-queue-template-preview-ui.js"',
  "app.js imports queue template preview UI module"
);
assertContains(appJs, "buildReminderEmailTemplate", "app.js uses buildReminderEmailTemplate");
assertContains(appJs, "populateReminderQueueTemplatePreviewDetail", "app.js populates template preview detail");
assertContains(appJs, "handleReminderQueuePreviewTableClick", "app.js wires queue template preview click handler");

const renderQueueBody = extractFunctionBody(appJs, "renderReminderQueuePreview");
const populateDetailBody = extractFunctionBody(appJs, "populateReminderQueueTemplatePreviewDetail");
const setupListenersBody = extractFunctionBody(appJs, "setupReminderQueuePreviewListeners");

assertContains(
  renderQueueBody,
  "reminder-queue-template-preview-btn",
  "queue table renders preview template button"
);
assertContains(
  renderQueueBody,
  "getReminderQueueTemplatePreviewButtonLabel",
  "queue table uses preview template button label helper"
);
assertContains(
  renderQueueBody,
  "reminder-queue-template-preview-detail-row",
  "queue table renders expandable template detail row"
);
assertContains(
  renderQueueBody,
  'data-template-field="subject"',
  "template detail row includes subject field"
);
assertContains(
  renderQueueBody,
  'data-template-field="bodyText"',
  "template detail row includes body field"
);
assertContains(
  renderQueueBody,
  "reminder-queue-template-preview-safety-note",
  "template detail row includes safety note element"
);
assertContains(
  renderQueueBody,
  "reminder-queue-template-preview-missing-email",
  "template detail row includes missing email warning element"
);

assertContains(
  populateDetailBody,
  "bodyField.textContent = template.bodyText",
  "body text rendered via textContent"
);
assertContains(
  populateDetailBody,
  "subjectField.textContent = template.subject",
  "subject rendered via textContent"
);
assertContains(
  populateDetailBody,
  "REMINDER_QUEUE_TEMPLATE_PREVIEW_SAFETY_NOTE",
  "populate sets template preview safety note"
);
assertContains(
  populateDetailBody,
  "missingEmailWarning.classList.toggle",
  "populate toggles missing email warning"
);

assertContains(
  setupListenersBody,
  "handleReminderQueuePreviewTableClick",
  "queue preview listeners wire template preview clicks"
);

assertContains(stylesCss, ".reminder-queue-template-preview-detail-row", "styles include template detail row");
assertContains(stylesCss, ".reminder-queue-template-preview-body", "styles include template body block");
assertContains(stylesCss, ".reminder-queue-template-preview-missing-email", "styles include missing email warning");

assertContains(appBundleJs, "buildReminderEmailTemplate", "bundle includes template builder");
assertContains(appBundleJs, "reminder-queue-template-preview-btn", "bundle includes preview template button");

const forbiddenHooks = [
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

for (const needle of forbiddenHooks) {
  assertNotContains(renderQueueBody, needle, `renderReminderQueuePreview has no ${needle}`);
  assertNotContains(populateDetailBody, needle, `populateReminderQueueTemplatePreviewDetail has no ${needle}`);
  assertNotContains(previewUiJs, needle, `preview UI module has no ${needle}`);
}

assertNotContains(renderQueueBody, "mark-sent", "queue template preview has no mark-sent control");
assertNotContains(renderQueueBody, "send-btn", "queue template preview has no send button");
assertNotContains(renderQueueBody, "Execute automation", "queue template preview has no execute control");

const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const queue = buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assert(queue.items.length > 0, "fixture queue has items for template preview");

const template = buildReminderEmailTemplate({ queueItem: queue.items[0] });
const metadata = mapReminderQueueTemplatePreviewMetadata(template.metadata);

assert(typeof template.subject === "string" && template.subject.length > 0, "template subject available for preview");
assert(typeof template.bodyText === "string" && template.bodyText.length > 0, "template body available for preview");
assert(metadata.reminderWindow.length > 0, "metadata reminder window mapped");
assert(metadata.complianceType.length > 0, "metadata compliance type mapped");
assert(metadata.expiryDate.length > 0, "metadata expiry date mapped");
assert(metadata.source.length > 0, "metadata source mapped");

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

assertEqual(
  getReminderQueueTemplatePreviewButtonLabel(false),
  REMINDER_QUEUE_TEMPLATE_PREVIEW_BUTTON_LABEL,
  "collapsed preview button label"
);
assertEqual(getReminderQueueTemplatePreviewButtonLabel(true), "Hide template", "expanded preview button label");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-queue-template-preview-ui: all checks OK");
console.log("  Queue template preview UI wired to template builder");
console.log("  Subject/body fields and metadata rendered safely");
console.log("  Safety note and missing email warning present");
console.log("  No send/execute/mark-sent hooks in preview path");
