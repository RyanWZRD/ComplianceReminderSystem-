/**
 * V5-2 Phase 1: Reminder email template builder verification.
 * Deterministic checks for queue-item template generation — no Supabase, browser, or email delivery.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";
import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";
import { buildReminderEmailTemplate } from "../js/app/automation/reminder-template-builder.js";
import { REMINDER_UI_LABELS } from "../js/data/reminder-sent.js";
import {
  FIXTURE_AS_OF_DATE,
  FIXTURE_SETTINGS,
  LOCAL_FIXTURE_ROWS,
} from "./fixtures/insights-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const builderJs = readFileSync(
  join(root, "js/app/automation/reminder-template-builder.js"),
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

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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

console.log("V5-2 Phase 1 reminder email template builder verification (verify-reminder-template-builder)\n");

assertContains(
  builderJs,
  "export function buildReminderEmailTemplate",
  "reminder-template-builder module export"
);
assertContains(packageJson, '"verify-reminder-template-builder"', "package.json verify script");

const forbiddenNeedles = [
  "sendEmail",
  "sendReminder",
  "markReminderSent",
  "mark_reminder_sent",
  "notification_queue",
  "enqueue_reminder_notifications",
  "process_notification_queue",
  "smtp",
  "resend",
  "history_entries",
  "add_default_actions",
  ".rpc(",
  "fetch(",
];

for (const needle of forbiddenNeedles) {
  assertNotContains(builderJs, needle, `reminder-template-builder.js has no ${needle}`);
}

const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);
const queue = buildReminderQueueFromDryRun({
  dryRunResult,
  asOfDate: FIXTURE_AS_OF_DATE,
  rows: LOCAL_FIXTURE_ROWS,
  settings: FIXTURE_SETTINGS,
});

assert(queue.items.length > 0, "fixture queue has items");

const expiredItem = queue.items.find((item) => item.reminderWindow === "expired");
const upcomingItem = queue.items.find((item) => item.reminderWindow === "14-day");

assert(expiredItem, "fixture includes expired queue item");
assert(upcomingItem, "fixture includes upcoming queue item");

const expiredSnapshot = JSON.stringify(expiredItem);
const upcomingSnapshot = JSON.stringify(upcomingItem);

const expiredTemplate = buildReminderEmailTemplate({
  queueItem: expiredItem,
  organisationName: "St Example Parish",
  contactName: "Sam",
});

const upcomingTemplate = buildReminderEmailTemplate({
  queueItem: upcomingItem,
  organisationName: "St Example Parish",
});

assertDeepEqual(JSON.parse(expiredSnapshot), expiredItem, "expired queue item not mutated");
assertDeepEqual(JSON.parse(upcomingSnapshot), upcomingItem, "upcoming queue item not mutated");

assertKeys(
  expiredTemplate,
  ["subject", "bodyText", "metadata", "emailMissing"],
  "template output shape"
);
assertKeys(
  expiredTemplate.metadata,
  ["source", "reminderWindow", "complianceType", "expiryDate"],
  "template metadata shape"
);

assert(typeof expiredTemplate.subject === "string" && expiredTemplate.subject.length > 0, "subject generated");
assert(typeof upcomingTemplate.bodyText === "string" && upcomingTemplate.bodyText.length > 0, "bodyText generated");

assertContains(expiredTemplate.subject, "Expired compliance", "expired subject lead");
assertContains(upcomingTemplate.subject, "14-day reminder", "upcoming subject lead");

assertContains(
  expiredTemplate.bodyText,
  "This compliance item has expired and requires renewal.",
  "expired window wording"
);
assertContains(
  upcomingTemplate.bodyText,
  "This compliance item expires within 14 days.",
  "upcoming window wording"
);
assertNotContains(
  upcomingTemplate.bodyText,
  "has expired and requires renewal",
  "upcoming body does not use expired wording"
);
assertNotContains(
  expiredTemplate.bodyText,
  "expires within 14 days",
  "expired body does not use upcoming expiry wording"
);

assertContains(expiredTemplate.bodyText, "renew this compliance record urgently", "expired action line");
assertContains(
  upcomingTemplate.bodyText,
  "arrange renewal or follow-up before the expiry date",
  "upcoming action line"
);

assertContains(expiredTemplate.bodyText, "Dear Sam,", "contactName used in greeting");
assertContains(upcomingTemplate.bodyText, `Dear ${upcomingItem.personName},`, "personName greeting fallback");

assertEqual(expiredTemplate.emailMissing, true, "missing email flagged on expired fixture");
assertEqual(expiredTemplate.metadata.source, "dry_run_candidate", "metadata source");
assertEqual(expiredTemplate.metadata.reminderWindow, "expired", "metadata reminderWindow");
assertEqual(expiredTemplate.metadata.complianceType, expiredItem.complianceType, "metadata complianceType");
assertEqual(expiredTemplate.metadata.expiryDate, expiredItem.expiryDate, "metadata expiryDate");

assertContains(
  expiredTemplate.bodyText,
  "No email has been sent.",
  "template preview disclaimer"
);
assertNotContains(expiredTemplate.bodyText, "http://", "body has no fake links");
assertNotContains(expiredTemplate.bodyText, "https://", "body has no fake links");

const syntheticWithEmail = {
  personName: "Alex Volunteer",
  complianceType: "DBS",
  expiryDate: "2026-12-01",
  reminderWindow: "30-day",
  reminderType: REMINDER_UI_LABELS[30],
  email: "alex.volunteer@example.com",
  emailMissing: false,
  status: "queued",
  source: "dry_run_candidate",
  asOfDate: FIXTURE_AS_OF_DATE,
  sent: false,
  delivered: false,
  markedSent: false,
  sentAt: null,
  deliveredAt: null,
  markedSentAt: null,
  failed: false,
  failureReason: null,
};

const withEmailTemplate = buildReminderEmailTemplate({
  queueItem: syntheticWithEmail,
  organisationName: "St Example Parish",
});

assertEqual(withEmailTemplate.emailMissing, false, "email present is not flagged missing");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-reminder-template-builder: all checks OK");
