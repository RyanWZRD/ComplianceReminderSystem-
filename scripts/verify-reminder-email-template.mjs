/**
 * V6 Phase 53: Reminder email template framework verification.
 * Template/preview generation only — no Supabase, Resend, fetch, or email delivery.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REMINDER_EMAIL_TEMPLATE_TOKENS,
  buildReminderEmailBody,
  buildReminderEmailPreview,
  buildReminderEmailSubject,
  buildReminderEmailTokenMap,
  replaceReminderEmailTokens,
} from "../js/app/automation/reminder-email-template.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const templateJs = readFileSync(
  join(root, "js/app/automation/reminder-email-template.js"),
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

function assertKeys(object, keys, label) {
  const actualKeys = Object.keys(object).sort();
  const expectedKeys = [...keys].sort();

  if (actualKeys.join(",") !== expectedKeys.join(",")) {
    fail(`${label}: expected keys [${expectedKeys.join(", ")}], got [${actualKeys.join(", ")}]`);
  }
}

console.log("V6 Phase 53 reminder email template verification (verify-reminder-email-template)\n");

assertContains(
  templateJs,
  "export function buildReminderEmailSubject",
  "reminder-email-template module export buildReminderEmailSubject"
);
assertContains(
  templateJs,
  "export function buildReminderEmailBody",
  "reminder-email-template module export buildReminderEmailBody"
);
assertContains(
  templateJs,
  "export function buildReminderEmailPreview",
  "reminder-email-template module export buildReminderEmailPreview"
);
assertContains(
  templateJs,
  "export function replaceReminderEmailTokens",
  "reminder-email-template module export replaceReminderEmailTokens"
);
assertContains(packageJson, '"verify-reminder-email-template"', "package.json verify script");

const forbiddenNeedles = [
  "sendEmail",
  "sendReminder",
  "markReminderSent",
  "mark_reminder_sent",
  "sent_at",
  "provider_message_id",
  "resend",
  "Resend",
  "smtp",
  "fetch(",
  ".rpc(",
  "notification_queue",
  "enqueue_reminder_notifications",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(templateJs, needle, `reminder-email-template.js has no ${needle}`);
}

assertDeepEqualTokens();

const candidate = {
  recipientName: "Sarah",
  personName: "John Smith",
  complianceType: "DBS",
  reminderType: "14 Day Reminder",
  dueDate: "2026-07-22",
};

const options = {
  organisationName: "Alpha Test Organisation",
  contactName: "Safeguarding Lead",
};

const subject = buildReminderEmailSubject(candidate, options);
const body = buildReminderEmailBody(candidate, options);
const preview = buildReminderEmailPreview(candidate, options);

assertEqual(subject, "Reminder: DBS expires on 2026-07-22", "subject with compliance type and ISO due date");
assertContains(body, "Hello Sarah,", "body greeting uses recipient name");
assertContains(body, "John Smith", "body includes person name");
assertContains(body, "DBS", "body includes compliance type");
assertContains(body, "22 July 2026", "body includes formatted due date");
assertContains(body, "Alpha Test Organisation", "body includes organisation name");

assertKeys(preview, ["subject", "bodyText"], "preview output shape");
assertEqual(preview.subject, subject, "preview subject matches buildReminderEmailSubject");
assertEqual(preview.bodyText, body, "preview bodyText matches buildReminderEmailBody");

const tokenReplacement = replaceReminderEmailTokens(
  "To {{recipientName}} about {{personName}} ({{complianceType}}, {{reminderType}}, {{dueDate}}) — {{organisationName}} / {{contactName}}",
  buildReminderEmailTokenMap(candidate, options)
);

assertContains(tokenReplacement, "Sarah", "token replacement recipientName");
assertContains(tokenReplacement, "John Smith", "token replacement personName");
assertContains(tokenReplacement, "DBS", "token replacement complianceType");
assertContains(tokenReplacement, "14 Day Reminder", "token replacement reminderType");
assertContains(tokenReplacement, "2026-07-22", "token replacement dueDate");
assertContains(tokenReplacement, "Alpha Test Organisation", "token replacement organisationName");
assertContains(tokenReplacement, "Safeguarding Lead", "token replacement contactName");
assertNotContains(tokenReplacement, "{{", "token replacement leaves no placeholders");

const sparseCandidate = {};
const sparseSubject = buildReminderEmailSubject(sparseCandidate);
const sparseBody = buildReminderEmailBody(sparseCandidate);
const sparsePreview = buildReminderEmailPreview(sparseCandidate);

for (const output of [sparseSubject, sparseBody, sparsePreview.subject, sparsePreview.bodyText]) {
  assertNotContains(output, "undefined", "missing fields do not render undefined");
  assertNotContains(output, "null", "missing fields do not render null");
  assert(typeof output === "string" && output.length > 0, "sparse candidate still returns non-empty strings");
}

assertContains(sparseSubject, "compliance item", "sparse subject compliance fallback");
assertContains(sparseSubject, "date not set", "sparse subject due date fallback");
assertContains(sparseBody, "Hello there,", "sparse body recipient fallback");
assertContains(sparseBody, "team member", "sparse body person fallback");

const snakeCaseCandidate = {
  recipient_name: "Alex",
  person_name: "Jamie Lee",
  compliance_type: "Safeguarding Training",
  reminder_type: "7 Day Reminder",
  expiry_date: "2026-08-01",
  organisation_name: "St Example Parish",
};

const snakeCasePreview = buildReminderEmailPreview(snakeCaseCandidate);

assertContains(snakeCasePreview.subject, "Safeguarding Training", "snake_case compliance type");
assertContains(snakeCasePreview.subject, "2026-08-01", "snake_case expiry_date in subject");
assertContains(snakeCasePreview.bodyText, "Jamie Lee", "snake_case person name in body");

assertEqual(
  REMINDER_EMAIL_TEMPLATE_TOKENS.length,
  7,
  "supported token list length"
);

for (const tokenName of [
  "recipientName",
  "personName",
  "complianceType",
  "reminderType",
  "dueDate",
  "organisationName",
  "contactName",
]) {
  assert(REMINDER_EMAIL_TEMPLATE_TOKENS.includes(tokenName), `token list includes ${tokenName}`);
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-email-template: all checks OK");

function assertDeepEqualTokens() {
  const tokens = buildReminderEmailTokenMap(
    { personName: "Test Person", complianceType: "DBS", dueDate: "2026-01-15" },
    { organisationName: "Org" }
  );

  assertKeys(tokens, REMINDER_EMAIL_TEMPLATE_TOKENS, "token map shape");
  assertEqual(tokens.personName, "Test Person", "token map personName");
  assertEqual(tokens.complianceType, "DBS", "token map complianceType");
}
