/**
 * V5-1B Phase 2: Reminder template preview UI.
 * Static checks for preview modal, Action Required actions, and workspace wiring.
 * No Supabase, browser, email delivery, or automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
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

console.log("Reminder template preview UI verification (V5-1B Phase 2)\n");

assertContains(indexHtml, 'id="reminder-preview-modal"', "index.html reminder preview modal");
assertContains(indexHtml, "Preview only — no email is sent", "index.html preview disclaimer");
assertContains(indexHtml, 'id="reminder-preview-missing-recipient"', "index.html missing recipient warning");
assertContains(indexHtml, 'id="reminder-preview-recipient-email"', "index.html recipient email field");
assertContains(indexHtml, 'id="reminder-preview-manager-email"', "index.html manager email field");
assertContains(indexHtml, 'id="reminder-preview-subject"', "index.html subject field");
assertContains(indexHtml, 'id="reminder-preview-body"', "index.html body field");
assertContains(indexHtml, 'id="workspace-preview-reminder-btn"', "index.html workspace preview action");

assertContains(
  appJs,
  'from "./js/app/reminders/reminder-templates.js"',
  "app.js imports reminder template module"
);
assertContains(appJs, "buildReminderTemplatePreviewFromRow", "app.js uses buildReminderTemplatePreviewFromRow");
assertContains(appJs, "openReminderTemplatePreview", "app.js openReminderTemplatePreview helper");
assertContains(appJs, "closeReminderTemplatePreviewModal", "app.js closeReminderTemplatePreviewModal helper");
assertContains(appJs, "populateReminderTemplatePreviewModal", "app.js populateReminderTemplatePreviewModal helper");
assertContains(appJs, "setupReminderPreviewModalListeners", "app.js wires preview modal listeners");

const renderRemindersBody = extractFunctionBody(appJs, "renderReminders");
assertContains(renderRemindersBody, "reminder-preview-btn", "Action Required rows render preview button");
assertContains(renderRemindersBody, "Preview Reminder Email", "Action Required preview button label");

const populatePreviewBody = extractFunctionBody(appJs, "populateReminderTemplatePreviewModal");
assertContains(
  populatePreviewBody,
  'preview.recipientEmail || "—"',
  "preview shows placeholder when recipient email missing"
);
assertContains(
  populatePreviewBody,
  "reminderPreviewMissingRecipient.classList.toggle",
  "preview shows missing recipient warning without blocking"
);

const renderWorkspaceBody = extractFunctionBody(appJs, "renderRecordWorkspace");
assertContains(
  renderWorkspaceBody,
  "workspacePreviewReminderBtn",
  "workspace toggles preview action for active reminder"
);
assertContains(
  renderWorkspaceBody,
  "getReminderForRecord({ expiryDate: record.expiryDate })",
  "workspace preview uses active reminder window"
);

assertContains(stylesCss, ".reminder-preview-btn", "styles include preview button");
assertContains(stylesCss, ".reminder-preview-modal", "styles include preview modal");
assertContains(stylesCss, ".reminder-preview-missing-recipient", "styles include missing recipient warning");

assertNotContains(appJs, "sendEmail", "app.js does not add email sending");
assertNotContains(appJs, "sendReminderEmail", "app.js does not add reminder email delivery");
assertNotContains(appJs, "SMTP", "app.js does not reference SMTP");
assertNotContains(appJs, "notification_queue", "app.js does not add notification queue automation");

assertContains(appBundleJs, "buildReminderTemplatePreviewFromRow", "bundle includes reminder template preview");
assertContains(appBundleJs, "Preview Reminder Email", "bundle includes preview action label");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-template-preview-ui: all checks OK");
console.log("  Action Required preview action verified");
console.log("  Preview modal fields and disclaimer verified");
console.log("  Missing recipient warning verified");
console.log("  Workspace reminder preview action verified");
console.log("  No email delivery or automation hooks added");
