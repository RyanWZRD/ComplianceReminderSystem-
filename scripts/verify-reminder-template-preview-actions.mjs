/**
 * V5-1B Phase 3: Reminder template preview copy and export actions.
 * Deterministic checks for full-email text, export filename, and UI wiring.
 * No Supabase, browser, email delivery, or automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildReminderPreviewExportFilename,
  buildReminderTemplateFullEmailText,
  buildReminderTemplatePreview,
  slugifyReminderPreviewLabel,
} from "../js/app/reminders/reminder-templates.js";
import { REMINDER_UI_LABELS } from "../js/data/reminder-sent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const stylesCss = readFileSync(join(root, "styles.css"), "utf8");
const templatesJs = readFileSync(
  join(root, "js/app/reminders/reminder-templates.js"),
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

console.log("Reminder template preview actions verification (V5-1B Phase 3)\n");

const preview = buildReminderTemplatePreview({
  personName: "Jordan Coordinator",
  complianceType: "Basic Awareness",
  expiryDate: "2026-06-25",
  reminderType: REMINDER_UI_LABELS[14],
  recipientEmail: "jordan.coordinator@example.com",
  managerEmail: "manager@example.com",
  organisationName: "St Example Parish",
});

const fullEmail = buildReminderTemplateFullEmailText(preview);

assertContains(fullEmail, "To: jordan.coordinator@example.com", "full email includes To");
assertContains(fullEmail, "Manager email: manager@example.com", "full email includes manager email");
assertContains(fullEmail, "Reminder type: 14 Day Reminder", "full email includes reminder type");
assertContains(fullEmail, `Subject: ${preview.subject}`, "full email includes subject");
assertContains(fullEmail, "Body:", "full email includes body label");
assertContains(fullEmail, preview.body, "full email includes body content");
assertNotContains(fullEmail, "notes", "full email excludes record notes");
assertNotContains(fullEmail, "evidence", "full email excludes evidence content");

const withoutManager = buildReminderTemplatePreview({
  personName: "Alex Volunteer",
  complianceType: "DBS",
  expiryDate: "2026-12-01",
  reminderType: REMINDER_UI_LABELS[30],
});

const fullEmailNoManager = buildReminderTemplateFullEmailText(withoutManager);
assertContains(fullEmailNoManager, "To: —", "full email shows missing recipient placeholder");
assertNotContains(fullEmailNoManager, "Manager email:", "full email omits manager line when absent");

assertEqual(
  slugifyReminderPreviewLabel("Jordan Coordinator"),
  "jordan-coordinator",
  "person slug for export filename"
);
assertEqual(
  buildReminderPreviewExportFilename(preview, "Jordan Coordinator", "2026-06-17"),
  "reminder-preview-jordan-coordinator-2026-06-17.txt",
  "export filename pattern"
);

assertContains(indexHtml, 'id="reminder-preview-copy-subject-btn"', "index.html copy subject button");
assertContains(indexHtml, 'id="reminder-preview-copy-body-btn"', "index.html copy body button");
assertContains(indexHtml, 'id="reminder-preview-copy-full-btn"', "index.html copy full email button");
assertContains(indexHtml, 'id="reminder-preview-export-btn"', "index.html export preview button");
assertContains(indexHtml, "Copy full email", "index.html copy full email label");
assertContains(indexHtml, "Export preview text file", "index.html export label");
assertContains(indexHtml, 'id="reminder-preview-message"', "index.html preview action message");

assertContains(appJs, "buildReminderTemplateFullEmailText", "app.js imports full email helper");
assertContains(appJs, "buildReminderPreviewExportFilename", "app.js imports export filename helper");
assertContains(appJs, "copyReminderPreviewSubject", "app.js copy subject handler");
assertContains(appJs, "copyReminderPreviewBody", "app.js copy body handler");
assertContains(appJs, "copyReminderPreviewFullEmail", "app.js copy full email handler");
assertContains(appJs, "exportReminderPreviewTextFile", "app.js export preview handler");
assertContains(appJs, "reminderPreviewContext", "app.js stores preview context for actions");

const copyTextBody = extractFunctionBody(appJs, "copyReminderPreviewText");
assertContains(
  copyTextBody,
  "navigator.clipboard?.writeText",
  "copy checks clipboard API availability"
);
assertContains(
  copyTextBody,
  "Copy is not available in this browser. Use Export preview text file instead.",
  "copy shows clear message when clipboard unavailable"
);

const exportBody = extractFunctionBody(appJs, "exportReminderPreviewTextFile");
assertContains(exportBody, "buildReminderTemplateFullEmailText", "export uses full email content");
assertContains(exportBody, "buildReminderPreviewExportFilename", "export uses preview filename helper");
assertContains(exportBody, 'downloadFile(content, filename, "text/plain', "export uses downloadFile");

const listenerBody = extractFunctionBody(appJs, "setupReminderPreviewModalListeners");
assertContains(listenerBody, "reminder-preview-copy-subject-btn", "modal listener wires copy subject");
assertContains(listenerBody, "reminder-preview-copy-body-btn", "modal listener wires copy body");
assertContains(listenerBody, "reminder-preview-copy-full-btn", "modal listener wires copy full email");
assertContains(listenerBody, "reminder-preview-export-btn", "modal listener wires export");

assertContains(stylesCss, ".reminder-preview-actions", "styles include preview action row");
assertContains(stylesCss, ".reminder-preview-action-btn", "styles include preview action buttons");

assertNotContains(templatesJs, "sendEmail", "template module must not send email");
assertNotContains(appJs, "sendEmail", "app.js does not add email sending");
assertNotContains(appJs, "SMTP", "app.js does not reference SMTP");
assertNotContains(appJs, "notification_queue", "app.js does not add notification queue automation");

assertContains(appBundleJs, "buildReminderTemplateFullEmailText", "bundle includes full email helper");
assertContains(appBundleJs, "Export preview text file", "bundle includes export action label");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-template-preview-actions: all checks OK");
console.log("  Copy subject/body/full email actions verified");
console.log("  Full email text shape and export filename verified");
console.log("  Clipboard-unavailable message and export fallback verified");
console.log("  No email delivery or automation hooks added");
