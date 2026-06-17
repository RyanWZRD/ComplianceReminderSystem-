/**
 * V5-1B Phase 1: Reminder template preview foundation.
 * Deterministic checks for read-only template generation — no Supabase, browser, or email delivery.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_ORGANISATION_NAME,
  REMINDER_TEMPLATE_TYPES,
  buildReminderTemplatePreview,
  buildReminderTemplatePreviewFromRow,
  formatReminderExpiryDate,
  isSupportedReminderTemplateType,
} from "../js/app/reminders/reminder-templates.js";
import { REMINDER_UI_LABELS } from "../js/data/reminder-sent.js";
import { normalizeComplianceRow } from "../js/app/insights/insights-engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const templatesJs = readFileSync(
  join(root, "js/app/reminders/reminder-templates.js"),
  "utf8"
);
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");

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

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    fail(`${label}: expected ${expectedJson}, got ${actualJson}`);
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

function assertKeys(object, keys, label) {
  const actualKeys = Object.keys(object).sort();
  const expectedKeys = [...keys].sort();

  if (actualKeys.join(",") !== expectedKeys.join(",")) {
    fail(`${label}: expected keys [${expectedKeys.join(", ")}], got [${actualKeys.join(", ")}]`);
  }
}

console.log("Reminder template preview verification (V5-1B Phase 1)\n");

assertEqual(REMINDER_TEMPLATE_TYPES.length, 4, "supported template type count");
assertEqual(
  REMINDER_TEMPLATE_TYPES.join("|"),
  [
    REMINDER_UI_LABELS[30],
    REMINDER_UI_LABELS[14],
    REMINDER_UI_LABELS[7],
    REMINDER_UI_LABELS.expired,
  ].join("|"),
  "template types match REMINDER_UI_LABELS"
);

assertEqual(
  formatReminderExpiryDate("2026-06-25"),
  "25 Jun 2026",
  "expiry date formatting"
);

const baseInput = {
  personName: "Jordan Coordinator",
  complianceType: "Basic Awareness",
  expiryDate: "2026-06-25",
  recipientEmail: "Jordan.Coordinator@Example.COM",
  managerEmail: "manager@example.com",
  organisationName: "St Example Parish",
};

const expectedByType = {
  [REMINDER_UI_LABELS[30]]: {
    subject: "30-day reminder: Basic Awareness — Jordan Coordinator",
    windowLine: "This compliance item expires within 30 days.",
  },
  [REMINDER_UI_LABELS[14]]: {
    subject: "14-day reminder: Basic Awareness — Jordan Coordinator",
    windowLine: "This compliance item expires within 14 days.",
  },
  [REMINDER_UI_LABELS[7]]: {
    subject: "7-day reminder: Basic Awareness — Jordan Coordinator",
    windowLine: "This compliance item expires within 7 days.",
  },
  [REMINDER_UI_LABELS.expired]: {
    subject: "Expired compliance: Basic Awareness — Jordan Coordinator",
    windowLine: "This compliance item has expired and requires renewal.",
  },
};

for (const reminderType of REMINDER_TEMPLATE_TYPES) {
  const preview = buildReminderTemplatePreview({
    ...baseInput,
    reminderType,
  });

  assertKeys(
    preview,
    [
      "subject",
      "body",
      "recipientEmail",
      "managerEmail",
      "reminderType",
      "complianceType",
      "expiryDate",
    ],
    `output shape (${reminderType})`
  );

  assertEqual(preview.subject, expectedByType[reminderType].subject, `subject (${reminderType})`);
  assertEqual(preview.reminderType, reminderType, `reminderType (${reminderType})`);
  assertEqual(preview.complianceType, "Basic Awareness", `complianceType (${reminderType})`);
  assertEqual(preview.expiryDate, "2026-06-25", `expiryDate (${reminderType})`);
  assertEqual(
    preview.recipientEmail,
    "jordan.coordinator@example.com",
    `recipientEmail normalized (${reminderType})`
  );
  assertEqual(preview.managerEmail, "manager@example.com", `managerEmail (${reminderType})`);
  assertContains(
    preview.body,
    expectedByType[reminderType].windowLine,
    `body window line (${reminderType})`
  );
  assertContains(preview.body, "Expiry date: 25 Jun 2026", `body expiry (${reminderType})`);
  assertContains(preview.body, "St Example Parish", `body organisation (${reminderType})`);
  assertContains(
    preview.body,
    "Manager contact on file: manager@example.com (for your reference — not copied on this preview).",
    `body manager reference (${reminderType})`
  );
  assertContains(
    preview.body,
    "This is a preview of reminder content. No email has been sent.",
    `body preview disclaimer (${reminderType})`
  );
}

const withoutContacts = buildReminderTemplatePreview({
  personName: "Alex Volunteer",
  complianceType: "DBS",
  expiryDate: "2026-12-01",
  reminderType: REMINDER_UI_LABELS[30],
});

assertEqual(withoutContacts.recipientEmail, null, "missing recipientEmail returns null");
assertEqual(withoutContacts.managerEmail, null, "missing managerEmail returns null");
assertNotContains(
  withoutContacts.body,
  "Manager contact on file:",
  "body omits manager line when absent"
);
assertContains(
  withoutContacts.body,
  DEFAULT_ORGANISATION_NAME,
  "default organisation name when omitted"
);

const rowPreview = buildReminderTemplatePreviewFromRow(
  normalizeComplianceRow({
    personId: 2,
    recordId: 102,
    name: "Jordan Coordinator",
    role: "Coordinator",
    email: "jordan.coordinator@example.com",
    managerEmail: "manager@example.com",
    complianceType: "Basic Awareness",
    expiryDate: "2026-06-25",
    renewalCycle: "3-years",
    notes: "",
    history: [],
    evidence: [],
    actions: [],
  }),
  REMINDER_UI_LABELS[14],
  { organisationName: "St Example Parish" }
);

assertEqual(
  rowPreview.subject,
  "14-day reminder: Basic Awareness — Jordan Coordinator",
  "row helper subject"
);
assertEqual(rowPreview.recipientEmail, "jordan.coordinator@example.com", "row helper recipientEmail");

assertEqual(isSupportedReminderTemplateType("Unknown"), false, "unsupported reminder type guard");

assertNotContains(templatesJs, "sendEmail", "module must not send email");
assertNotContains(templatesJs, "SMTP", "module must not reference SMTP");
assertNotContains(templatesJs, "notification_queue", "module must not reference notification queue");
assertNotContains(templatesJs, "markReminderSent", "module must not mark reminders sent");
assertNotContains(templatesJs, "fetch(", "module must not perform network calls");

assertNotContains(appJs, "reminder-templates.js", "app.js must not wire preview UI yet");
assertNotContains(appBundleJs, "reminder-templates", "bundle must not include preview module yet");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-template-preview: all checks OK");
