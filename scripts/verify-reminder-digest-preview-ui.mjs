/**
 * V5-2 Phase 5: Reminder digest preview UI verification.
 * Static checks for digest preview area, safe rendering, copy path, and no execution hooks.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import { buildReminderDigest } from "../js/app/automation/reminder-digest-builder.js";
import {
  REMINDER_DIGEST_COPY_BUTTON_LABEL,
  REMINDER_DIGEST_PREVIEW_SAFETY_NOTE,
  buildReminderDigestCopyText,
  mapReminderDigestPreviewMetadata,
} from "../js/app/automation/reminder-digest-preview-ui.js";
import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";
import {
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const digestPreviewUiJs = readFileSync(
  join(root, "js/app/automation/reminder-digest-preview-ui.js"),
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
  "V5-2 Phase 5 reminder digest preview UI verification (verify-reminder-digest-preview-ui)\n"
);

assertContains(
  packageJson,
  '"verify-reminder-digest-preview-ui": "node scripts/verify-reminder-digest-preview-ui.mjs"',
  "package.json verify-reminder-digest-preview-ui script"
);

assertContains(
  digestPreviewUiJs,
  "export const REMINDER_DIGEST_PREVIEW_SAFETY_NOTE",
  "digest preview UI module exports safety note"
);
assertContains(
  digestPreviewUiJs,
  "export const REMINDER_DIGEST_COPY_BUTTON_LABEL",
  "digest preview UI module exports copy button label"
);
assertContains(
  digestPreviewUiJs,
  "export function buildReminderDigestCopyText",
  "digest preview UI module exports copy text builder"
);
assertContains(
  digestPreviewUiJs,
  "export function mapReminderDigestPreviewMetadata",
  "digest preview UI module exports metadata mapper"
);

assertContains(indexHtml, 'id="reminder-digest-preview"', "index.html includes digest preview area");
assertContains(
  indexHtml,
  'id="reminder-digest-preview-copy-btn"',
  "index.html includes copy digest button"
);
assertContains(
  indexHtml,
  'id="reminder-digest-preview-subject"',
  "index.html includes digest subject field"
);
assertContains(
  indexHtml,
  'id="reminder-digest-preview-body"',
  "index.html includes digest body field"
);
assertContains(
  indexHtml,
  'data-digest-field="totalQueued"',
  "index.html includes digest metadata total queued field"
);
assertContains(
  indexHtml,
  'data-digest-field="missingEmail"',
  "index.html includes digest metadata missing email field"
);
assertContains(
  indexHtml,
  'data-digest-field="expired"',
  "index.html includes digest metadata expired field"
);
assertContains(
  indexHtml,
  'data-digest-field="day30"',
  "index.html includes digest metadata 30-day field"
);
assertContains(
  indexHtml,
  'data-digest-field="day14"',
  "index.html includes digest metadata 14-day field"
);
assertContains(
  indexHtml,
  'data-digest-field="day7"',
  "index.html includes digest metadata 7-day field"
);

assertContains(appJs, 'from "./js/app/automation/reminder-digest-builder.js"', "app.js imports digest builder");
assertContains(
  appJs,
  'from "./js/app/automation/reminder-digest-preview-ui.js"',
  "app.js imports digest preview UI module"
);
assertContains(appJs, "buildReminderDigest", "app.js uses buildReminderDigest");
assertContains(appJs, "renderReminderDigestPreview", "app.js renders digest preview");
assertContains(appJs, "copyReminderDigest", "app.js wires copy digest handler");

const renderDigestBody = extractFunctionBody(appJs, "renderReminderDigestPreview");
const copyDigestBody = extractFunctionBody(appJs, "copyReminderDigest");
const setupListenersBody = extractFunctionBody(appJs, "setupReminderQueuePreviewListeners");
const renderQueueBody = extractFunctionBody(appJs, "renderReminderQueuePreview");

assertContains(
  renderQueueBody,
  "renderReminderDigestPreview(queue)",
  "queue preview render calls digest preview render"
);

assertContains(
  renderDigestBody,
  "REMINDER_DIGEST_PREVIEW_SAFETY_NOTE",
  "digest preview sets safety note"
);
assertContains(
  renderDigestBody,
  "reminderDigestPreviewSubject.textContent = digest.subject",
  "digest subject rendered via textContent"
);
assertContains(
  renderDigestBody,
  "reminderDigestPreviewBody.textContent = digest.bodyText",
  "digest body rendered via textContent"
);
assertContains(
  renderDigestBody,
  "reminderDigestPreviewTotalCount.textContent",
  "digest metadata total queued rendered"
);
assertContains(
  renderDigestBody,
  "reminderDigestPreviewMissingEmailCount.textContent",
  "digest metadata missing email rendered"
);
assertContains(
  renderDigestBody,
  "reminderDigestPreviewExpiredCount.textContent",
  "digest metadata expired rendered"
);
assertContains(
  renderDigestBody,
  "reminderDigestPreview30Count.textContent",
  "digest metadata 30-day rendered"
);
assertContains(
  renderDigestBody,
  "reminderDigestPreview14Count.textContent",
  "digest metadata 14-day rendered"
);
assertContains(
  renderDigestBody,
  "reminderDigestPreview7Count.textContent",
  "digest metadata 7-day rendered"
);

assertContains(
  copyDigestBody,
  "navigator.clipboard?.writeText",
  "copy digest uses clipboard writeText"
);
assertContains(
  copyDigestBody,
  "buildReminderDigestCopyText",
  "copy digest uses copy text builder"
);

assertContains(
  setupListenersBody,
  "reminderDigestPreviewCopyBtn",
  "queue preview listeners wire copy digest button"
);
assertContains(
  setupListenersBody,
  "copyReminderDigest",
  "queue preview listeners call copyReminderDigest"
);

assertContains(stylesCss, ".reminder-digest-preview", "styles include digest preview area");
assertContains(stylesCss, ".reminder-digest-preview-body", "styles include digest body block");
assertContains(stylesCss, ".reminder-digest-preview-safety-note", "styles include digest safety note");

assertContains(appBundleJs, "buildReminderDigest", "bundle includes digest builder");
assertContains(appBundleJs, "reminder-digest-preview-copy-btn", "bundle includes copy digest button");

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
  assertNotContains(renderDigestBody, needle, `renderReminderDigestPreview has no ${needle}`);
  assertNotContains(copyDigestBody, needle, `copyReminderDigest has no ${needle}`);
  assertNotContains(digestPreviewUiJs, needle, `digest preview UI module has no ${needle}`);
}

assertNotContains(renderDigestBody, "mark-sent", "digest preview has no mark-sent control");
assertNotContains(renderDigestBody, "send-btn", "digest preview has no send button");
assertNotContains(renderDigestBody, "Execute automation", "digest preview has no execute control");
assertNotContains(copyDigestBody, "mark-sent", "copy digest has no mark-sent control");
assertNotContains(copyDigestBody, "send-btn", "copy digest has no send button");

const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const queue = buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assert(queue.items.length > 0, "fixture queue has items for digest preview");

const digest = buildReminderDigest({
  queueItems: queue.items,
  organisationName: "St Example Parish",
  asOfDate: FIXTURE_AS_OF_DATE,
});
const metadata = mapReminderDigestPreviewMetadata(digest.metadata);

assert(typeof digest.subject === "string" && digest.subject.length > 0, "digest subject available for preview");
assert(typeof digest.bodyText === "string" && digest.bodyText.length > 0, "digest body available for preview");
assert(metadata.totalQueued.length > 0, "metadata total queued mapped");
assert(metadata.missingEmail.length >= 0, "metadata missing email mapped");
assert(metadata.expired.length >= 0, "metadata expired mapped");
assert(metadata.day30.length >= 0, "metadata 30-day mapped");
assert(metadata.day14.length >= 0, "metadata 14-day mapped");
assert(metadata.day7.length >= 0, "metadata 7-day mapped");

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

assertEqual(
  REMINDER_DIGEST_PREVIEW_SAFETY_NOTE,
  "Digest preview only — no email is sent.",
  "digest preview safety note text"
);
assertEqual(REMINDER_DIGEST_COPY_BUTTON_LABEL, "Copy digest", "copy digest button label");
assertEqual(
  buildReminderDigestCopyText(digest),
  `Subject: ${digest.subject}\n\n${digest.bodyText}`,
  "copy digest text format"
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-digest-preview-ui: all checks OK");
console.log("  Digest preview area wired to digest builder");
console.log("  Subject/body fields and metadata counts rendered safely");
console.log("  Safety note and copy digest button present");
console.log("  No send/execute/mark-sent hooks in digest preview path");
