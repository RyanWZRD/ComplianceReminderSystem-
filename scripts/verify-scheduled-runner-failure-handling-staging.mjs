/**
 * V6 Phase 64: Staging verification for scheduled runner failure handling and retry posture.
 * Forces a safe provider failure, asserts failed delivery log + no mark-sent, then retries successfully.
 */

import { execSync } from "node:child_process";
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
const PHASE_64_TEST_PERSON_NAME = "Phase 64 Failure Test Person";

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
 * @param {string} key
 * @param {string} value
 */
function setStagingSecret(key, value) {
  execSync(`supabase secrets set ${key}=${value} --project-ref ${STAGING_PROJECT_REF}`, {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
  });
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
async function ensurePhase64TestRecord(userClient, personName, email, expiryDate) {
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
  "V6 Phase 64 scheduled runner failure handling staging verification\n",
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

let forceFailureSecretChanged = false;

async function runStagingVerification() {
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

  console.log("\n--- ensure Phase 64 staging test fixture ---");
  console.log(`  person: ${PHASE_64_TEST_PERSON_NAME}`);
  console.log(`  email: ${allowlistedRecipient}`);
  console.log(`  expiry: ${testExpiryDate} (7-day reminder window)`);
  console.log(`  asOfDate: ${asOfDate}`);

  const { data: existingPeople, error: peopleQueryError } = await serviceClient
    .from("people")
    .select("id, name, email")
    .eq("organisation_id", organisationId)
    .ilike("name", PHASE_64_TEST_PERSON_NAME);

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
      testFixture = await ensurePhase64TestRecord(
        userClient,
        PHASE_64_TEST_PERSON_NAME,
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
    testFixture = await ensurePhase64TestRecord(
      userClient,
      PHASE_64_TEST_PERSON_NAME,
      allowlistedRecipient,
      testExpiryDate,
    );
  }

  const { recordId: testRecordId, personId: testPersonId } = testFixture;

  console.log(`  test personId: ${testPersonId}`);
  console.log(`  test recordId: ${testRecordId}`);

  console.log("\n--- reset prior sent delivery logs for repeatable retry test ---");

  const { data: priorSentLogs, error: priorSentQueryError } = await serviceClient
    .from("reminder_delivery_logs")
    .select("id, payload")
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
      console.error(`sent delivery log cleanup failed: ${cleanupError.message}`);
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

  console.log("\n--- enable FORCE_EMAIL_PROVIDER_FAILURE on staging ---");

  try {
    setStagingSecret("FORCE_EMAIL_PROVIDER_FAILURE", "true");
    forceFailureSecretChanged = true;
    console.log("  FORCE_EMAIL_PROVIDER_FAILURE=true");
  } catch (error) {
    console.error(
      "Failed to set FORCE_EMAIL_PROVIDER_FAILURE — ensure Supabase CLI is logged in:\n" +
        `  supabase secrets set FORCE_EMAIL_PROVIDER_FAILURE=true --project-ref ${STAGING_PROJECT_REF}`,
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log("\n--- first invoke scheduled-reminder-runner (forced provider failure) ---");

  let failureRunResult;

  try {
    failureRunResult = await invokeScheduledRunner(
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

  const failureBody = asObject(failureRunResult.payload);

  if (failureRunResult.status === 404) {
    console.error(
      "scheduled-reminder-runner not found on staging — deploy Phase 64 first:\n" +
        `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
    );
    process.exit(1);
  }

  if (failureRunResult.status === 409 && failureBody.reason === "scheduled_live_send_not_enabled") {
    console.error("SCHEDULED_EMAIL_SENDING_ENABLED is not enabled on staging.");
    process.exit(1);
  }

  if (failureBody.retrySummary === undefined) {
    console.error(
      "forced-failure live_send missing retrySummary — deploy Phase 64 scheduled-reminder-runner to staging:\n" +
        `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
    );
    process.exit(1);
  }

  assert(failureRunResult.status === 200, `forced-failure live_send HTTP status (got ${failureRunResult.status})`);
  assertEqual(failureBody.status, "completed_with_errors", "forced-failure response.status");
  assertEqual(failureBody.mode, "live_send", "forced-failure response.mode");
  assert(isUuidString(failureBody.automationRunId), "forced-failure response.automationRunId");

  const failureAutomationRunId = String(failureBody.automationRunId).trim();
  const failureSendSummary = asObject(failureBody.sendSummary);
  const failureDeliveryLogSummary = asObject(failureBody.deliveryLogSummary);
  const failureMarkSentSummary = asObject(failureBody.markSentSummary);
  const failureRetrySummary = asObject(failureBody.retrySummary);

  assertEqual(failureSendSummary.failed, 1, "forced-failure sendSummary.failed");
  assertEqual(failureDeliveryLogSummary.failed, 1, "forced-failure deliveryLogSummary.failed");
  assertEqual(failureMarkSentSummary.markedSent, 0, "forced-failure markSentSummary.markedSent");
  assert(
    Number(failureRetrySummary.retryableFailures) >= 1,
    "forced-failure retrySummary.retryableFailures >= 1",
  );

  const { data: failedRows, error: failedRowsError } = await serviceClient
    .from("reminder_delivery_logs")
    .select(
      "id, delivery_status, provider, provider_message_id, sent_at, error_code, error_message, payload",
    )
    .eq("automation_run_id", failureAutomationRunId)
    .eq("compliance_record_id", testRecordId)
    .eq("delivery_status", "failed");

  if (failedRowsError) {
    console.error(`forced-failure failed log query failed: ${failedRowsError.message}`);
    process.exit(1);
  }

  assertEqual(failedRows?.length ?? 0, 1, "forced-failure creates exactly one failed log for test record");
  const failedRow = failedRows?.[0];
  assertEqual(failedRow?.provider, "resend", "failed log provider");
  assert(failedRow?.provider_message_id == null, "failed log provider_message_id is null");
  assert(failedRow?.sent_at == null, "failed log sent_at is null");
  assert(isNonEmptyString(failedRow?.error_code), "failed log has error_code");
  assert(isNonEmptyString(failedRow?.error_message), "failed log has error_message");

  const failedPayload = asObject(failedRow?.payload);
  assertEqual(failedPayload.mode, "live_send", "failed log payload.mode");
  assertEqual(failedPayload.asOfDate, asOfDate, "failed log payload.asOfDate");

  const { count: historyAfterFailure, error: historyAfterFailureError } = await serviceClient
    .from("history_entries")
    .select("id", { count: "exact", head: true })
    .eq("record_id", testRecordId)
    .eq("action", "reminder_sent");

  if (historyAfterFailureError) {
    console.error(`history_entries after forced failure failed: ${historyAfterFailureError.message}`);
    process.exit(1);
  }

  assertEqual(
    historyAfterFailure ?? 0,
    historyCountBefore ?? 0,
    "no reminder_sent history entry after forced provider failure",
  );

  console.log("\n--- disable FORCE_EMAIL_PROVIDER_FAILURE on staging ---");

  try {
    setStagingSecret("FORCE_EMAIL_PROVIDER_FAILURE", "false");
    console.log("  FORCE_EMAIL_PROVIDER_FAILURE=false");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log("\n--- second invoke scheduled-reminder-runner (retry after failure) ---");

  let retryRunResult;

  try {
    retryRunResult = await invokeScheduledRunner(
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

  assert(retryRunResult.status === 200, `retry live_send HTTP status (got ${retryRunResult.status})`);

  const retryBody = asObject(retryRunResult.payload);
  assertEqual(retryBody.status, "ok", "retry response.status");
  assertEqual(retryBody.mode, "live_send", "retry response.mode");
  assert(isUuidString(retryBody.automationRunId), "retry response.automationRunId");

  const retryAutomationRunId = String(retryBody.automationRunId).trim();
  const retrySendSummary = asObject(retryBody.sendSummary);
  const retryMarkSentSummary = asObject(retryBody.markSentSummary);

  assertEqual(retrySendSummary.sent, 1, "retry sendSummary.sent");
  assertEqual(retryMarkSentSummary.markedSent, 1, "retry markSentSummary.markedSent");

  const { data: retrySentRows, error: retrySentError } = await serviceClient
    .from("reminder_delivery_logs")
    .select("id, provider_message_id, payload")
    .eq("automation_run_id", retryAutomationRunId)
    .eq("compliance_record_id", testRecordId)
    .eq("delivery_status", "sent");

  if (retrySentError) {
    console.error(`retry sent log query failed: ${retrySentError.message}`);
    process.exit(1);
  }

  assertEqual(retrySentRows?.length ?? 0, 1, "retry creates exactly one sent log for test record");
  assert(
    isNonEmptyString(retrySentRows?.[0]?.provider_message_id),
    "retry sent log has provider_message_id",
  );

  const retryPayload = asObject(retrySentRows?.[0]?.payload);
  assertEqual(retryPayload.asOfDate, asOfDate, "retry sent log payload.asOfDate");

  const { data: recordAfterRetry, error: recordAfterRetryError } = await serviceClient
    .from("compliance_records")
    .select("notes")
    .eq("id", testRecordId)
    .maybeSingle();

  if (recordAfterRetryError || !recordAfterRetry) {
    console.error(`compliance_records after retry failed: ${recordAfterRetryError?.message ?? "not found"}`);
    process.exit(1);
  }

  assert(
    String(recordAfterRetry.notes ?? "").includes(expectedSentLabel),
    `compliance record notes include "${expectedSentLabel}" after retry live_send`,
  );

  console.log("\n--- third invoke scheduled-reminder-runner (duplicate prevention) ---");

  let duplicateRunResult;

  try {
    duplicateRunResult = await invokeScheduledRunner(
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

  assert(
    duplicateRunResult.status === 200,
    `duplicate live_send HTTP status (got ${duplicateRunResult.status})`,
  );

  const duplicateBody = asObject(duplicateRunResult.payload);
  const duplicateSendSummary = asObject(duplicateBody.sendSummary);
  const duplicateMarkSentSummary = asObject(duplicateBody.markSentSummary);
  const duplicatePreventionSummary = asObject(duplicateBody.duplicatePreventionSummary);

  assertEqual(duplicateSendSummary.sent, 0, "duplicate run sendSummary.sent");
  assertEqual(duplicateMarkSentSummary.markedSent, 0, "duplicate run markSentSummary.markedSent");
  assert(
    Number(duplicatePreventionSummary.duplicatesPrevented) >= 1,
    "duplicate run duplicatePreventionSummary.duplicatesPrevented >= 1",
  );
  assert(
    Number(duplicateSendSummary.skippedDuplicate) >= 1,
    "duplicate run sendSummary.skippedDuplicate >= 1",
  );

  if (failures.length > 0) {
    console.error("FAILURES:");
    failures.forEach((message) => console.error(`  - ${message}`));
    process.exit(1);
  }

  console.log("\nverify-scheduled-runner-failure-handling-staging: all checks OK");
  console.log(`  organisation: ${organisationId}`);
  console.log(`  test person: ${PHASE_64_TEST_PERSON_NAME} (${testPersonId})`);
  console.log(`  test record: ${testRecordId}`);
  console.log(`  asOfDate: ${asOfDate}`);
  console.log(`  failure automationRunId: ${failureAutomationRunId}`);
  console.log(`  retry automationRunId: ${retryAutomationRunId}`);
  console.log("  failed log did not block retry; duplicate prevention blocked third run");
}

try {
  await runStagingVerification();
} finally {
  if (forceFailureSecretChanged) {
    try {
      setStagingSecret("FORCE_EMAIL_PROVIDER_FAILURE", "false");
      console.log("\nRestored FORCE_EMAIL_PROVIDER_FAILURE=false on staging.");
    } catch (error) {
      console.error(
        "WARNING: failed to restore FORCE_EMAIL_PROVIDER_FAILURE=false — set manually:\n" +
          `  supabase secrets set FORCE_EMAIL_PROVIDER_FAILURE=false --project-ref ${STAGING_PROJECT_REF}`,
      );
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}
