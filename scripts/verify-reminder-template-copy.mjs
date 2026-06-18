/**
 * V5-2 Phase 3: Reminder queue template copy verification.
 * Static checks for copy button, clipboard path, success feedback, and no execution hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";
import {
  REMINDER_QUEUE_TEMPLATE_COPY_BUTTON_LABEL,
  REMINDER_QUEUE_TEMPLATE_COPY_SUCCESS_MESSAGE,
  REMINDER_QUEUE_TEMPLATE_COPY_UNAVAILABLE_MESSAGE,
  buildReminderQueueTemplateCopyText,
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log(
  "V5-2 Phase 3 reminder queue template copy verification (verify-reminder-template-copy)\n"
);

assertContains(
  packageJson,
  '"verify-reminder-template-copy": "node scripts/verify-reminder-template-copy.mjs"',
  "package.json verify-reminder-template-copy script"
);

assertContains(
  previewUiJs,
  "export const REMINDER_QUEUE_TEMPLATE_COPY_BUTTON_LABEL",
  "preview UI module exports copy button label"
);
assertContains(
  previewUiJs,
  "export const REMINDER_QUEUE_TEMPLATE_COPY_SUCCESS_MESSAGE",
  "preview UI module exports copy success message"
);
assertContains(
  previewUiJs,
  "export function buildReminderQueueTemplateCopyText",
  "preview UI module exports copy text builder"
);

assertEqual(REMINDER_QUEUE_TEMPLATE_COPY_BUTTON_LABEL, "Copy template", "copy button label constant");
assertEqual(
  REMINDER_QUEUE_TEMPLATE_COPY_SUCCESS_MESSAGE,
  "Template copied.",
  "copy success message constant"
);
assertContains(
  REMINDER_QUEUE_TEMPLATE_COPY_UNAVAILABLE_MESSAGE,
  "not available",
  "copy unavailable message is friendly"
);

assertContains(appJs, "buildReminderQueueTemplateCopyText", "app.js imports copy text builder");
assertContains(
  appJs,
  "REMINDER_QUEUE_TEMPLATE_COPY_BUTTON_LABEL",
  "app.js imports copy button label"
);
assertContains(appJs, "copyReminderQueueTemplate", "app.js defines copy handler");

const renderQueueBody = extractFunctionBody(appJs, "renderReminderQueuePreview");
const copyBody = extractFunctionBody(appJs, "copyReminderQueueTemplate");
const clickHandlerBody = extractFunctionBody(appJs, "handleReminderQueuePreviewTableClick");

assertContains(
  renderQueueBody,
  "reminder-queue-template-preview-copy-btn",
  "queue template detail renders copy template button"
);
assertContains(
  renderQueueBody,
  "REMINDER_QUEUE_TEMPLATE_COPY_BUTTON_LABEL",
  "copy button uses copy button label constant"
);
assertContains(
  renderQueueBody,
  "reminder-queue-template-preview-copy-message",
  "template detail row includes copy feedback message"
);

assertContains(
  copyBody,
  "buildReminderQueueTemplateCopyText",
  "copy handler uses copy text builder"
);
assertContains(
  copyBody,
  "navigator.clipboard?.writeText",
  "copy handler checks clipboard API availability"
);
assertContains(
  copyBody,
  "navigator.clipboard.writeText",
  "copy handler calls clipboard writeText"
);
assertContains(
  copyBody,
  "REMINDER_QUEUE_TEMPLATE_COPY_SUCCESS_MESSAGE",
  "copy handler shows Template copied success feedback constant"
);
assertContains(
  copyBody,
  "REMINDER_QUEUE_TEMPLATE_COPY_UNAVAILABLE_MESSAGE",
  "copy handler shows copy unavailable fallback message constant"
);

assertContains(
  clickHandlerBody,
  "reminder-queue-template-preview-copy-btn",
  "queue preview click handler wires copy button"
);
assertContains(clickHandlerBody, "copyReminderQueueTemplate", "click handler invokes copy handler");

assertContains(stylesCss, ".reminder-queue-template-preview-copy-btn", "styles include copy button");
assertContains(
  stylesCss,
  ".reminder-queue-template-preview-copy-message",
  "styles include copy feedback message"
);

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
  assertNotContains(copyBody, needle, `copyReminderQueueTemplate has no ${needle}`);
  assertNotContains(previewUiJs, needle, `preview UI module has no ${needle}`);
}

assertNotContains(renderQueueBody, "mark-sent", "queue template copy has no mark-sent control");
assertNotContains(renderQueueBody, "send-btn", "queue template copy has no send button");
assertNotContains(renderQueueBody, "Execute automation", "queue template copy has no execute control");
assertNotContains(copyBody, "mark-sent", "copy handler has no mark-sent hook");
assertNotContains(copyBody, "send-btn", "copy handler has no send button hook");

const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const queue = buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assert(queue.items.length > 0, "fixture queue has items for template copy");

const template = buildReminderEmailTemplate({ queueItem: queue.items[0] });
const copyText = buildReminderQueueTemplateCopyText(template);

assertContains(copyText, `Subject: ${template.subject}`, "copy text includes Subject line");
assertContains(copyText, template.bodyText, "copy text includes bodyText");
assert(
  copyText === `Subject: ${template.subject}\n\n${template.bodyText}`,
  "copy text format is Subject line, blank line, then body"
);

assertContains(appBundleJs, "buildReminderQueueTemplateCopyText", "bundle includes copy text builder");
assertContains(appBundleJs, "reminder-queue-template-preview-copy-btn", "bundle includes copy template button");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-template-copy: all checks OK");
console.log("  Copy template button in expanded queue preview");
console.log("  Copy text includes Subject and bodyText");
console.log("  Clipboard writeText path and success feedback wired");
console.log("  No send/execute/mark-sent hooks in copy path");
