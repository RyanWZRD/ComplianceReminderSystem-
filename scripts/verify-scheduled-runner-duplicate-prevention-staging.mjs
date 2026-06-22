/**
 * V6 Phase 63: Staging verification for scheduled runner duplicate prevention.
 * Ensures a second live_send for the same asOfDate does not resend or re-mark.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { getReminderSentText } from "../js/data/reminder-sent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** Alpha Test Organisation — seed / staging default (supabase/seed.sql). */
const DEFAULT_STAGING_ORGANISATION_ID = "11111111-1111-1111-1111-111111111111";

const STAGING_PROJECT_REF = "vmrotpztwoeifbdjwdis";
const PHASE_63_TEST_PERSON_NAME = "Phase 63 Duplicate Test Person";

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

/**
 * @param {string} content
 * @param {string} key
 * @returns {string}
 */
function readEnvValue(content, key) {
  const pattern = new RegExp(`^${key}\\s*=\\s*(.*)$`, "m");
  const match = content.match(pattern);

  if (!match) {
    return "";
  }

  let value = match[1].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {unknown} value
 */
function isUuidString(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {number} daysFromToday
 * @returns {string}
 */
function formatDateDaysFromToday(daysFromToday) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @param {Date} date
 * @returns {string}
 */
function formatAsOfDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} supabaseUrl
 * @param {string} anonKey
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>}
 */
async function obtainAccessToken(supabaseUrl, anonKey, email, password) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sign-in failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (!isNonEmptyString(data.access_token)) {
    throw new Error("Sign-in response missing access_token.");
  }

  return data.access_token.trim();
}

/**
 * @param {string} supabaseUrl
 * @param {string} anonKey
 * @param {string} accessToken
 * @param {string} organisationId
 * @param {string} mode
 * @param {string | undefined} asOfDate
 */
async function invokeScheduledRunner(
  supabaseUrl,
  anonKey,
  accessToken,
  organisationId,
  mode,
  asOfDate,
) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  /** @type {Record<string, string>} */
  const body = { organisationId, mode };

  if (asOfDate) {
    body.asOfDate = asOfDate;
  }

  const response = await fetch(`${baseUrl}/functions/v1/scheduled-reminder-runner`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  /** @type {unknown} */
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `scheduled-reminder-runner returned non-JSON (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  return { status: response.status, payload };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} userClient
 * @param {string} personName
 * @param {string} email
 * @param {string} expiryDate
 */
async function ensurePhase63TestRecord(userClient, personName, email, expiryDate) {
  const { data, error } = await userClient.rpc("create_compliance_record", {
    p_name: personName,
    p_role: "Volunteer",
    p_compliance_type: "DBS",
    p_expiry_date: expiryDate,
    p_renewal_cycle: "3-years",
    p_email: email,
  });

  if (error) {
    throw new Error(`create_compliance_record failed: ${error.message}`);
  }

  const result = asObject(data);
  const status = String(result.status ?? "");

  if (status !== "created") {
    throw new Error(
      `create_compliance_record unexpected status: ${status} ${JSON.stringify(result)}`,
    );
  }

  const recordId = String(result.record_id ?? "").trim();
  const personId = String(result.person_id ?? "").trim();

  if (!isUuidString(recordId) || !isUuidString(personId)) {
    throw new Error("create_compliance_record missing record_id or person_id.");
  }

  return { recordId, personId };
}

console.log(
  "V6 Phase 63 scheduled runner duplicate prevention staging verification\n",
);

let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env — copy .env.example to .env and configure staging values.");
  process.exit(1);
}

const supabaseUrl = readEnvValue(envContent, "SUPABASE_URL");
const anonKey = readEnvValue(envContent, "SUPABASE_ANON_KEY");
const serviceRoleKey = readEnvValue(envContent, "SUPABASE_SERVICE_ROLE_KEY");
const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");
const scheduledTestEmailTo = readEnvValue(envContent, "SCHEDULED_TEST_EMAIL_TO");
const adminEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_ADMIN") ||
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL") ||
  "alpha-admin@example.com";
const organisationId =
  readEnvValue(envContent, "SUPABASE_TEST_ORGANISATION_ID") ||
  readEnvValue(envContent, "STAGING_ORGANISATION_ID") ||
  DEFAULT_STAGING_ORGANISATION_ID;

const asOfDate =
  readEnvValue(envContent, "SCHEDULED_RUNNER_AS_OF_DATE") ||
  formatAsOfDateISO(new Date());

if (!isNonEmptyString(supabaseUrl)) {
  console.error(".env must define SUPABASE_URL.");
  process.exit(1);
}

if (!isNonEmptyString(serviceRoleKey)) {
  console.error(".env must define SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!isNonEmptyString(anonKey)) {
  console.error(".env must define SUPABASE_ANON_KEY.");
  process.exit(1);
}

if (!password) {
  console.error(".env must define SUPABASE_TEST_PASSWORD.");
  process.exit(1);
}

if (!isNonEmptyString(scheduledTestEmailTo)) {
  console.error(".env must define SCHEDULED_TEST_EMAIL_TO — one allowlisted recipient.");
  process.exit(1);
}

if (scheduledTestEmailTo.includes(",")) {
  console.error("SCHEDULED_TEST_EMAIL_TO must be a single recipient — no comma-separated list.");
  process.exit(1);
}

if (!supabaseUrl.includes(STAGING_PROJECT_REF)) {
  console.warn(
    `Warning: SUPABASE_URL does not include staging project ref ${STAGING_PROJECT_REF}.`,
  );
}

const allowlistedRecipient = scheduledTestEmailTo.trim().toLowerCase();
const testExpiryDate = formatDateDaysFromToday(5);
const expectedReminderUiLabel = "7 Day Reminder";
const expectedSentLabel = getReminderSentText(expectedReminderUiLabel);

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("--- sign in as staging admin ---");

let accessToken;

try {
  accessToken = await obtainAccessToken(supabaseUrl, anonKey, adminEmail, password);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const userClient = createClient(supabaseUrl, anonKey, {
  global: {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  },
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("\n--- ensure Phase 63 staging test fixture ---");
console.log(`  person: ${PHASE_63_TEST_PERSON_NAME}`);
console.log(`  email: ${allowlistedRecipient}`);
console.log(`  expiry: ${testExpiryDate} (7-day reminder window)`);
console.log(`  asOfDate: ${asOfDate}`);

const { data: existingPeople, error: peopleQueryError } = await serviceClient
  .from("people")
  .select("id, name, email")
  .eq("organisation_id", organisationId)
  .ilike("name", PHASE_63_TEST_PERSON_NAME);

if (peopleQueryError) {
  console.error(`people query failed: ${peopleQueryError.message}`);
  process.exit(1);
}

/** @type {{ recordId: string; personId: string }} */
let testFixture;

if ((existingPeople ?? []).length > 0) {
  const person = existingPeople[0];
  const personId = String(person.id);

  await serviceClient
    .from("people")
    .update({ email: allowlistedRecipient })
    .eq("id", personId);

  const { data: records, error: recordsError } = await serviceClient
    .from("compliance_records")
    .select("id, expiry_date, notes")
    .eq("person_id", personId)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (recordsError) {
    console.error(`compliance_records query failed: ${recordsError.message}`);
    process.exit(1);
  }

  let recordId = String(records?.[0]?.id ?? "").trim();

  if (!isUuidString(recordId)) {
    testFixture = await ensurePhase63TestRecord(
      userClient,
      PHASE_63_TEST_PERSON_NAME,
      allowlistedRecipient,
      testExpiryDate,
    );
  } else {
    await serviceClient
      .from("compliance_records")
      .update({ expiry_date: testExpiryDate, notes: "" })
      .eq("id", recordId);

    testFixture = { recordId, personId };
  }
} else {
  testFixture = await ensurePhase63TestRecord(
    userClient,
    PHASE_63_TEST_PERSON_NAME,
    allowlistedRecipient,
    testExpiryDate,
  );
}

const { recordId: testRecordId, personId: testPersonId } = testFixture;

console.log(`  test personId: ${testPersonId}`);
console.log(`  test recordId: ${testRecordId}`);

console.log("\n--- reset prior sent delivery logs for repeatable first send ---");

const { data: priorSentLogs, error: priorSentQueryError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id, due_date, reminder_type, payload")
  .eq("organisation_id", organisationId)
  .eq("compliance_record_id", testRecordId)
  .eq("recipient_email", allowlistedRecipient)
  .eq("delivery_status", "sent");

if (priorSentQueryError) {
  console.error(`prior sent log query failed: ${priorSentQueryError.message}`);
  process.exit(1);
}

const priorSentIds = (priorSentLogs ?? [])
  .filter((row) => {
    const payload = asObject(row.payload);
    return payload.asOfDate === asOfDate;
  })
  .map((row) => String(row.id));

if (priorSentIds.length > 0) {
  const { error: cleanupError } = await serviceClient
    .from("reminder_delivery_logs")
    .delete()
    .in("id", priorSentIds);

  if (cleanupError) {
    console.error(`delivery log cleanup failed: ${cleanupError.message}`);
    process.exit(1);
  }

  console.log(`  removed ${priorSentIds.length} prior sent log(s) for asOfDate ${asOfDate}`);
}

await serviceClient
  .from("compliance_records")
  .update({ notes: "" })
  .eq("id", testRecordId);

const { count: historyCountBefore, error: historyBeforeError } = await serviceClient
  .from("history_entries")
  .select("id", { count: "exact", head: true })
  .eq("record_id", testRecordId)
  .eq("action", "reminder_sent");

if (historyBeforeError) {
  console.error(`history_entries baseline failed: ${historyBeforeError.message}`);
  process.exit(1);
}

const { count: sentLogsBefore, error: sentLogsBeforeError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id", { count: "exact", head: true })
  .eq("organisation_id", organisationId)
  .eq("compliance_record_id", testRecordId)
  .eq("delivery_status", "sent")
  .not("provider_message_id", "is", null);

if (sentLogsBeforeError) {
  console.error(`sent delivery log baseline failed: ${sentLogsBeforeError.message}`);
  process.exit(1);
}

console.log("\n--- first invoke scheduled-reminder-runner (mode: live_send) ---");

let firstRunResult;

try {
  firstRunResult = await invokeScheduledRunner(
    supabaseUrl,
    anonKey,
    accessToken,
    organisationId,
    "live_send",
    asOfDate,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const firstBody = asObject(firstRunResult.payload);

if (firstRunResult.status === 404) {
  console.error(
    "scheduled-reminder-runner not found on staging — deploy Phase 63 first:\n" +
      `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

if (firstRunResult.status === 409 && firstBody.reason === "scheduled_live_send_not_enabled") {
  console.error("SCHEDULED_EMAIL_SENDING_ENABLED is not enabled on staging.");
  process.exit(1);
}

assert(firstRunResult.status === 200, `first live_send HTTP status must be 200 (got ${firstRunResult.status})`);

if (firstBody.duplicatePreventionSummary === undefined) {
  console.error(
    "first live_send response missing duplicatePreventionSummary — deploy Phase 63 scheduled-reminder-runner to staging:\n" +
      `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

assertEqual(firstBody.mode, "live_send", "first run response.mode");
assert(isUuidString(firstBody.automationRunId), "first run response.automationRunId");

const firstAutomationRunId = String(firstBody.automationRunId).trim();
const firstSendSummary = asObject(firstBody.sendSummary);
const firstMarkSentSummary = asObject(firstBody.markSentSummary);
const firstDuplicateSummary = asObject(firstBody.duplicatePreventionSummary);

assertEqual(firstSendSummary.sent, 1, "first run sendSummary.sent");
assertEqual(firstMarkSentSummary.markedSent, 1, "first run markSentSummary.markedSent");

const { data: firstSentRows, error: firstSentError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id, provider_message_id, payload")
  .eq("automation_run_id", firstAutomationRunId)
  .eq("compliance_record_id", testRecordId)
  .eq("delivery_status", "sent");

if (firstSentError) {
  console.error(`first run sent log query failed: ${firstSentError.message}`);
  process.exit(1);
}

assertEqual(firstSentRows?.length ?? 0, 1, "first run creates exactly one sent log for test record");
assert(
  isNonEmptyString(firstSentRows?.[0]?.provider_message_id),
  "first run sent log has provider_message_id",
);

const firstPayload = asObject(firstSentRows?.[0]?.payload);
assertEqual(firstPayload.asOfDate, asOfDate, "first run sent log payload.asOfDate");

const { data: recordAfterFirst, error: recordAfterFirstError } = await serviceClient
  .from("compliance_records")
  .select("notes")
  .eq("id", testRecordId)
  .maybeSingle();

if (recordAfterFirstError || !recordAfterFirst) {
  console.error(`compliance_records after first run failed: ${recordAfterFirstError?.message ?? "not found"}`);
  process.exit(1);
}

assert(
  String(recordAfterFirst.notes ?? "").includes(expectedSentLabel),
  `compliance record notes include "${expectedSentLabel}" after first live_send`,
);

const { count: historyAfterFirst, error: historyAfterFirstError } = await serviceClient
  .from("history_entries")
  .select("id", { count: "exact", head: true })
  .eq("record_id", testRecordId)
  .eq("action", "reminder_sent");

if (historyAfterFirstError) {
  console.error(`history_entries after first run failed: ${historyAfterFirstError.message}`);
  process.exit(1);
}

assert(
  (historyAfterFirst ?? 0) > (historyCountBefore ?? 0),
  "history_entries gained a reminder_sent entry after first live_send",
);

const { count: sentLogsAfterFirst, error: sentLogsAfterFirstError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id", { count: "exact", head: true })
  .eq("organisation_id", organisationId)
  .eq("compliance_record_id", testRecordId)
  .eq("delivery_status", "sent")
  .not("provider_message_id", "is", null);

if (sentLogsAfterFirstError) {
  console.error(`sent log count after first run failed: ${sentLogsAfterFirstError.message}`);
  process.exit(1);
}

console.log("\n--- second invoke scheduled-reminder-runner (same asOfDate) ---");

let secondRunResult;

try {
  secondRunResult = await invokeScheduledRunner(
    supabaseUrl,
    anonKey,
    accessToken,
    organisationId,
    "live_send",
    asOfDate,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

assert(secondRunResult.status === 200, `second live_send HTTP status must be 200 (got ${secondRunResult.status})`);

const secondBody = asObject(secondRunResult.payload);
assertEqual(secondBody.mode, "live_send", "second run response.mode");
assert(isUuidString(secondBody.automationRunId), "second run response.automationRunId");

const secondAutomationRunId = String(secondBody.automationRunId).trim();
const secondSendSummary = asObject(secondBody.sendSummary);
const secondMarkSentSummary = asObject(secondBody.markSentSummary);
const secondDuplicateSummary = asObject(secondBody.duplicatePreventionSummary);

assertEqual(secondSendSummary.sent, 0, "second run sendSummary.sent");
assert(
  Number(secondDuplicateSummary.duplicatesPrevented) >= 1,
  "second run duplicatePreventionSummary.duplicatesPrevented >= 1",
);
assert(
  Number(secondSendSummary.skippedDuplicate) >= 1,
  "second run sendSummary.skippedDuplicate >= 1",
);
assertEqual(secondMarkSentSummary.markedSent, 0, "second run markSentSummary.markedSent");

const { data: secondSentRows, error: secondSentError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id, provider_message_id")
  .eq("automation_run_id", secondAutomationRunId)
  .eq("compliance_record_id", testRecordId)
  .eq("delivery_status", "sent");

if (secondSentError) {
  console.error(`second run sent log query failed: ${secondSentError.message}`);
  process.exit(1);
}

assertEqual(secondSentRows?.length ?? 0, 0, "second run creates zero sent logs for test record");

const { data: duplicateSkippedRows, error: duplicateSkippedError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id, delivery_status, payload")
  .eq("automation_run_id", secondAutomationRunId)
  .eq("compliance_record_id", testRecordId)
  .eq("delivery_status", "skipped");

if (duplicateSkippedError) {
  console.error(`second run skipped log query failed: ${duplicateSkippedError.message}`);
  process.exit(1);
}

const duplicatePreventedRow = (duplicateSkippedRows ?? []).find((row) => {
  const payload = asObject(row.payload);
  return payload.reason === "duplicate_prevented";
});

assert(duplicatePreventedRow != null, "second run creates skipped duplicate_prevented log");

const { count: historyAfterSecond, error: historyAfterSecondError } = await serviceClient
  .from("history_entries")
  .select("id", { count: "exact", head: true })
  .eq("record_id", testRecordId)
  .eq("action", "reminder_sent");

if (historyAfterSecondError) {
  console.error(`history_entries after second run failed: ${historyAfterSecondError.message}`);
  process.exit(1);
}

assertEqual(
  historyAfterSecond ?? 0,
  historyAfterFirst ?? 0,
  "history_entries unchanged after duplicate run",
);

const { count: sentLogsAfterSecond, error: sentLogsAfterSecondError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id", { count: "exact", head: true })
  .eq("organisation_id", organisationId)
  .eq("compliance_record_id", testRecordId)
  .eq("delivery_status", "sent")
  .not("provider_message_id", "is", null);

if (sentLogsAfterSecondError) {
  console.error(`sent log count after second run failed: ${sentLogsAfterSecondError.message}`);
  process.exit(1);
}

assertEqual(
  sentLogsAfterSecond ?? 0,
  sentLogsAfterFirst ?? 0,
  "provider_message_id sent log count unchanged after duplicate run",
);

const { data: recordAfterSecond, error: recordAfterSecondError } = await serviceClient
  .from("compliance_records")
  .select("notes")
  .eq("id", testRecordId)
  .maybeSingle();

if (recordAfterSecondError) {
  console.error(`compliance_records after second run failed: ${recordAfterSecondError.message}`);
  process.exit(1);
}

assertEqual(
  String(recordAfterSecond?.notes ?? ""),
  String(recordAfterFirst.notes ?? ""),
  "compliance record notes unchanged after duplicate run",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-duplicate-prevention-staging: all checks OK");
console.log(`  organisation: ${organisationId}`);
console.log(`  test person: ${PHASE_63_TEST_PERSON_NAME} (${testPersonId})`);
console.log(`  test record: ${testRecordId}`);
console.log(`  asOfDate: ${asOfDate}`);
console.log(`  first automationRunId: ${firstAutomationRunId}`);
console.log(`  second automationRunId: ${secondAutomationRunId}`);
console.log(`  first sent: ${firstSendSummary.sent}, second sent: ${secondSendSummary.sent}`);
console.log(`  duplicatesPrevented (second run): ${secondDuplicateSummary.duplicatesPrevented}`);
console.log("\nStaging fixture left in place — prior sent logs for this asOfDate were cleared before first run.");
