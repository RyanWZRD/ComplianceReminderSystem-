/**

 * V5-2 Phase 4: Reminder digest builder verification.

 * Deterministic checks for manager/admin digest generation — no Supabase, browser, or email delivery.

 */



import { readFileSync } from "node:fs";

import { dirname, join } from "node:path";

import { fileURLToPath } from "node:url";



import { computeAutomationDryRun } from "../js/app/automation/automation-dry-run.js";

import { buildReminderDigest } from "../js/app/automation/reminder-digest-builder.js";

import { buildReminderQueueFromDryRun } from "../js/app/automation/reminder-queue.js";

import { REMINDER_QUEUE_MISSING_EMAIL_LABEL } from "../js/app/automation/reminder-queue-ui.js";

import {

  EXPECTED_REMINDER_QUEUE_SUMMARY,

  FIXTURE_AS_OF_DATE,

  FIXTURE_SETTINGS,

  LOCAL_FIXTURE_ROWS,

} from "./fixtures/insights-fixtures.mjs";



const __dirname = dirname(fileURLToPath(import.meta.url));

const root = join(__dirname, "..");



const builderJs = readFileSync(

  join(root, "js/app/automation/reminder-digest-builder.js"),

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



console.log("V5-2 Phase 4 reminder digest builder verification (verify-reminder-digest-builder)\n");



assertContains(

  builderJs,

  "export function buildReminderDigest",

  "reminder-digest-builder module export"

);

assertContains(packageJson, '"verify-reminder-digest-builder"', "package.json verify script");



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

  assertNotContains(builderJs, needle, `reminder-digest-builder.js has no ${needle}`);

}



const dryRunResult = computeAutomationDryRun(LOCAL_FIXTURE_ROWS, FIXTURE_SETTINGS, FIXTURE_AS_OF_DATE);

const queue = buildReminderQueueFromDryRun({

  dryRunResult,

  asOfDate: FIXTURE_AS_OF_DATE,

  rows: LOCAL_FIXTURE_ROWS,

  settings: FIXTURE_SETTINGS,

});



assert(queue.items.length > 0, "fixture queue has items");



const queueSnapshot = JSON.stringify(queue.items);



const digest = buildReminderDigest({

  queueItems: queue.items,

  organisationName: "St Example Parish",

  asOfDate: FIXTURE_AS_OF_DATE,

});



assertDeepEqual(JSON.parse(queueSnapshot), queue.items, "input queue items not mutated");



assertKeys(digest, ["subject", "bodyText", "metadata"], "digest output shape");

assertKeys(

  digest.metadata,

  ["asOfDate", "organisationName", "totalQueued", "missingEmail", "byWindow", "empty"],

  "digest metadata shape"

);

assertKeys(

  digest.metadata.byWindow,

  ["30-day", "14-day", "7-day", "expired"],

  "digest byWindow shape"

);



assert(typeof digest.subject === "string" && digest.subject.length > 0, "subject generated");

assert(typeof digest.bodyText === "string" && digest.bodyText.length > 0, "bodyText generated");



assertEqual(digest.metadata.empty, false, "non-empty digest metadata.empty");

assertEqual(digest.metadata.totalQueued, EXPECTED_REMINDER_QUEUE_SUMMARY.total, "totalQueued count");

assertEqual(

  digest.metadata.missingEmail,

  EXPECTED_REMINDER_QUEUE_SUMMARY.missingEmail,

  "missingEmail count"

);

assertDeepEqual(

  digest.metadata.byWindow,

  EXPECTED_REMINDER_QUEUE_SUMMARY.byWindow,

  "byWindow counts"

);

assertEqual(digest.metadata.asOfDate, FIXTURE_AS_OF_DATE, "metadata asOfDate");

assertEqual(digest.metadata.organisationName, "St Example Parish", "metadata organisationName");



assertContains(digest.subject, "Reminder digest", "digest subject lead");

assertContains(digest.subject, "St Example Parish", "digest subject organisation");

assertContains(digest.bodyText, `Total queued: ${EXPECTED_REMINDER_QUEUE_SUMMARY.total}`, "body total queued");

assertContains(

  digest.bodyText,

  `Missing email: ${EXPECTED_REMINDER_QUEUE_SUMMARY.missingEmail}`,

  "body missing email count"

);

assertContains(

  digest.bodyText,

  `Expired: ${EXPECTED_REMINDER_QUEUE_SUMMARY.byWindow.expired}`,

  "body expired count"

);

assertContains(

  digest.bodyText,

  `30-day: ${EXPECTED_REMINDER_QUEUE_SUMMARY.byWindow["30-day"]}`,

  "body 30-day count"

);

assertContains(

  digest.bodyText,

  `14-day: ${EXPECTED_REMINDER_QUEUE_SUMMARY.byWindow["14-day"]}`,

  "body 14-day count"

);

assertContains(

  digest.bodyText,

  `7-day: ${EXPECTED_REMINDER_QUEUE_SUMMARY.byWindow["7-day"]}`,

  "body 7-day count"

);



const expiredItem = queue.items.find((item) => item.reminderWindow === "expired");

const upcoming14Item = queue.items.find((item) => item.reminderWindow === "14-day");

const upcoming30Item = queue.items.find((item) => item.reminderWindow === "30-day");



assert(expiredItem, "fixture includes expired queue item");

assert(upcoming14Item, "fixture includes 14-day queue item");

assert(upcoming30Item, "fixture includes 30-day queue item");



assertContains(digest.bodyText, "Expired (1)", "grouped expired section heading");

assertContains(digest.bodyText, "14 Day Reminder (1)", "grouped 14-day section heading");

assertContains(digest.bodyText, "30 Day Reminder (1)", "grouped 30-day section heading");



assertContains(digest.bodyText, expiredItem.personName, "expired person name in body");

assertContains(digest.bodyText, expiredItem.complianceType, "expired compliance type in body");

assertContains(digest.bodyText, REMINDER_QUEUE_MISSING_EMAIL_LABEL, "missing email label in body");



const expiredIndex = digest.bodyText.indexOf("Expired (1)");

const upcoming14Index = digest.bodyText.indexOf("14 Day Reminder (1)");

const upcoming30Index = digest.bodyText.indexOf("30 Day Reminder (1)");



assert(expiredIndex < upcoming14Index, "expired section before 14-day section");

assert(upcoming14Index < upcoming30Index, "14-day section before 30-day section");



assertContains(

  digest.bodyText,

  "Digest preview only — no email has been sent.",

  "digest preview disclaimer"

);



const emptyDigest = buildReminderDigest({

  queueItems: [],

  organisationName: "St Example Parish",

  asOfDate: FIXTURE_AS_OF_DATE,

});



assertEqual(emptyDigest.metadata.empty, true, "empty digest metadata.empty");

assertEqual(emptyDigest.metadata.totalQueued, 0, "empty digest totalQueued");

assertContains(emptyDigest.subject, "No reminders due", "empty digest subject");

assertContains(

  emptyDigest.bodyText,

  "No reminder queue items are due for follow-up on this scan.",

  "empty digest body message"

);

assertContains(emptyDigest.bodyText, "Total queued: 0", "empty digest zero total");



if (failures.length > 0) {

  console.error("FAILURES:");

  failures.forEach((message) => console.error(`  - ${message}`));

  process.exit(1);

}



console.log("verify-reminder-digest-builder: all checks OK");


