/**
 * V6 Phase 62: Staging verification for scheduled runner mark-sent-after-delivery.
 * Ensures live_send marks reminders sent only after successful allowlisted delivery.
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
const PHASE_62_TEST_PERSON_PREFIX = "Phase 62 Test Person";

/**
 * Unique person name per run so Phase 63 duplicate prevention on prior sent logs
 * does not block repeat staging acceptance.
 * @returns {string}
 */
function buildPhase62TestPersonName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${PHASE_62_TEST_PERSON_PREFIX} ${stamp}`;
}

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
async function ensurePhase62TestRecord(userClient, personName, email, expiryDate) {
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
  "V6 Phase 62 scheduled runner mark-sent-after-delivery staging verification\n",
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
const asOfDate = readEnvValue(envContent, "SCHEDULED_RUNNER_AS_OF_DATE") || undefined;

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

const testPersonName = buildPhase62TestPersonName();

console.log("\n--- create Phase 62 staging test fixture (unique per run) ---");
console.log(`  person: ${testPersonName}`);
console.log(`  email: ${allowlistedRecipient}`);
console.log(`  expiry: ${testExpiryDate} (7-day reminder window)`);

/** @type {{ recordId: string; personId: string }} */
let testFixture;

try {
  testFixture = await ensurePhase62TestRecord(
    userClient,
    testPersonName,
    allowlistedRecipient,
    testExpiryDate,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { recordId: testRecordId, personId: testPersonId } = testFixture;

console.log(`  test personId: ${testPersonId}`);
console.log(`  test recordId: ${testRecordId}`);

const { count: historyCountBefore, error: historyBeforeError } = await serviceClient
  .from("history_entries")
  .select("id", { count: "exact", head: true })
  .eq("record_id", testRecordId)
  .eq("action", "reminder_sent");

if (historyBeforeError) {
  console.error(`history_entries baseline failed: ${historyBeforeError.message}`);
  process.exit(1);
}

const { data: complianceBefore, error: complianceBeforeError } = await serviceClient
  .from("compliance_records")
  .select("id, notes")
  .eq("organisation_id", organisationId);

if (complianceBeforeError) {
  console.error(`compliance_records baseline failed: ${complianceBeforeError.message}`);
  process.exit(1);
}

const complianceNotesBefore = new Map(
  (complianceBefore ?? []).map((row) => [String(row.id), String(row.notes ?? "")]),
);

assertEqual(
  complianceNotesBefore.get(testRecordId) ?? "",
  "",
  "test record notes cleared before live_send",
);

console.log("\n--- invoke scheduled-reminder-runner (mode: live_send) ---");

let liveSendResult;

try {
  liveSendResult = await invokeScheduledRunner(
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

const { status: liveSendHttpStatus, payload: liveSendPayload } = liveSendResult;
const liveSendBody = asObject(liveSendPayload);

if (liveSendHttpStatus === 404) {
  console.error(
    "scheduled-reminder-runner not found on staging — deploy Phase 62 first:\n" +
      `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

if (liveSendHttpStatus === 409 && liveSendBody.reason === "scheduled_live_send_not_enabled") {
  console.error("SCHEDULED_EMAIL_SENDING_ENABLED is not enabled on staging.");
  process.exit(1);
}

assert(liveSendHttpStatus === 200, `live_send HTTP status must be 200 (got ${liveSendHttpStatus})`);

if (liveSendBody.markSentSummary === undefined) {
  console.error(
    "live_send response missing markSentSummary — deploy Phase 62 scheduled-reminder-runner to staging:\n" +
      `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}
assert(
  liveSendBody.status === "ok" || liveSendBody.status === "completed_with_errors",
  "live_send response.status is ok or completed_with_errors",
);
assertEqual(liveSendBody.mode, "live_send", "live_send response.mode");
assert(isUuidString(liveSendBody.automationRunId), "live_send response.automationRunId");

const markSentSummary = asObject(liveSendBody.markSentSummary);
const sendSummary = asObject(liveSendBody.sendSummary);
const deliveryLogSummary = asObject(liveSendBody.deliveryLogSummary);

for (const key of ["attempted", "markedSent", "failed", "skipped"]) {
  assert(
    typeof markSentSummary[key] === "number" && !Number.isNaN(markSentSummary[key]),
    `markSentSummary.${key} must be a number`,
  );
}

assertEqual(markSentSummary.markedSent, 1, "markSentSummary.markedSent");
assertEqual(sendSummary.sent, 1, "sendSummary.sent for allowlisted test recipient");
assertEqual(liveSendBody.status, "ok", "live_send completed without mark-sent errors");

const automationRunId = String(liveSendBody.automationRunId).trim();

const { data: sentDeliveryRows, error: sentDeliveryError } = await serviceClient
  .from("reminder_delivery_logs")
  .select(
    "id, compliance_record_id, delivery_status, provider_message_id, sent_at, recipient_email",
  )
  .eq("automation_run_id", automationRunId)
  .eq("delivery_status", "sent");

if (sentDeliveryError) {
  console.error(`sent delivery log query failed: ${sentDeliveryError.message}`);
  process.exit(1);
}

assertEqual(sentDeliveryRows?.length ?? 0, 1, "exactly one sent delivery log row for test run");

const sentRow = sentDeliveryRows?.[0];

assertEqual(
  String(sentRow?.compliance_record_id ?? ""),
  testRecordId,
  "sent delivery log links to Phase 62 test record",
);
assertEqual(
  String(sentRow?.recipient_email ?? "").trim().toLowerCase(),
  allowlistedRecipient,
  "sent delivery log recipient matches SCHEDULED_TEST_EMAIL_TO",
);
assert(isNonEmptyString(sentRow?.provider_message_id), "sent delivery log has provider_message_id");
assert(sentRow?.sent_at != null, "sent delivery log has sent_at");

const { data: recordAfter, error: recordAfterError } = await serviceClient
  .from("compliance_records")
  .select("id, notes")
  .eq("id", testRecordId)
  .maybeSingle();

if (recordAfterError || !recordAfter) {
  console.error(`compliance_records after live_send failed: ${recordAfterError?.message ?? "not found"}`);
  process.exit(1);
}

const notesAfter = String(recordAfter.notes ?? "");

assert(
  notesAfter.includes(expectedSentLabel),
  `compliance record notes include "${expectedSentLabel}" after live_send`,
);

const { count: historyCountAfterLiveSend, error: historyAfterLiveSendError } =
  await serviceClient
    .from("history_entries")
    .select("id", { count: "exact", head: true })
    .eq("record_id", testRecordId)
    .eq("action", "reminder_sent");

if (historyAfterLiveSendError) {
  console.error(`history_entries after live_send failed: ${historyAfterLiveSendError.message}`);
  process.exit(1);
}

assert(
  (historyCountAfterLiveSend ?? 0) > (historyCountBefore ?? 0),
  "history_entries gained a reminder_sent entry after live_send",
);

const { data: skippedDeliveryRows, error: skippedDeliveryError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id, compliance_record_id, delivery_status, payload")
  .eq("automation_run_id", automationRunId)
  .eq("delivery_status", "skipped");

if (skippedDeliveryError) {
  console.error(`skipped delivery log query failed: ${skippedDeliveryError.message}`);
  process.exit(1);
}

for (const [index, row] of (skippedDeliveryRows ?? []).entries()) {
  const skippedRecordId = String(row.compliance_record_id ?? "");
  const { data: skippedRecord, error: skippedRecordError } = await serviceClient
    .from("compliance_records")
    .select("notes")
    .eq("id", skippedRecordId)
    .maybeSingle();

  if (skippedRecordError) {
    fail(`skipped row[${index}] compliance lookup failed: ${skippedRecordError.message}`);
    continue;
  }

  const skippedNotes = String(skippedRecord?.notes ?? "");
  const beforeNotes = complianceNotesBefore.get(skippedRecordId) ?? "";

  assertEqual(
    skippedNotes,
    beforeNotes,
    `skipped delivery row[${index}] compliance record notes unchanged`,
  );
}

console.log("\n--- dry_run and live_send_preview must not mark sent ---");

const historyAfterLiveSendCount = historyCountAfterLiveSend ?? 0;
const notesAfterLiveSend = notesAfter;

let dryRunResult;

try {
  dryRunResult = await invokeScheduledRunner(
    supabaseUrl,
    anonKey,
    accessToken,
    organisationId,
    "dry_run",
    asOfDate,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

assertEqual(dryRunResult.status, 200, "dry_run HTTP status");
assertNotPresentMarkSentSummary(dryRunResult.payload, "dry_run");

const { count: historyAfterDryRun, error: historyDryRunError } = await serviceClient
  .from("history_entries")
  .select("id", { count: "exact", head: true })
  .eq("record_id", testRecordId)
  .eq("action", "reminder_sent");

if (historyDryRunError) {
  console.error(`history_entries after dry_run failed: ${historyDryRunError.message}`);
  process.exit(1);
}

assertEqual(
  historyAfterDryRun ?? 0,
  historyAfterLiveSendCount,
  "dry_run did not add reminder_sent history",
);

const { data: recordAfterDryRun, error: recordDryRunError } = await serviceClient
  .from("compliance_records")
  .select("notes")
  .eq("id", testRecordId)
  .maybeSingle();

if (recordDryRunError) {
  console.error(`compliance_records after dry_run failed: ${recordDryRunError.message}`);
  process.exit(1);
}

assertEqual(
  String(recordAfterDryRun?.notes ?? ""),
  notesAfterLiveSend,
  "dry_run did not mutate compliance record notes",
);

let previewResult;

try {
  previewResult = await invokeScheduledRunner(
    supabaseUrl,
    anonKey,
    accessToken,
    organisationId,
    "live_send_preview",
    asOfDate,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const previewAvailable =
  previewResult.status === 200 ||
  (previewResult.status === 409 &&
    asObject(previewResult.payload).reason === "scheduled_live_send_preview_not_enabled");

assert(previewAvailable, "live_send_preview remains available (enabled or gate-off refusal)");
assertNotPresentMarkSentSummary(previewResult.payload, "live_send_preview");

const { count: historyAfterPreview, error: historyPreviewError } = await serviceClient
  .from("history_entries")
  .select("id", { count: "exact", head: true })
  .eq("record_id", testRecordId)
  .eq("action", "reminder_sent");

if (historyPreviewError) {
  console.error(`history_entries after preview failed: ${historyPreviewError.message}`);
  process.exit(1);
}

assertEqual(
  historyAfterPreview ?? 0,
  historyAfterLiveSendCount,
  "live_send_preview did not add reminder_sent history",
);

/**
 * @param {unknown} payload
 * @param {string} modeLabel
 */
function assertNotPresentMarkSentSummary(payload, modeLabel) {
  const body = asObject(payload);

  if (body.markSentSummary !== undefined) {
    fail(`${modeLabel} response must not include markSentSummary`);
  }
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-mark-sent-after-delivery-staging: all checks OK");
console.log(`  organisation: ${organisationId}`);
console.log(`  test person: ${testPersonName} (${testPersonId})`);
console.log(`  test record: ${testRecordId}`);
console.log(`  automationRunId: ${automationRunId}`);
console.log(`  markedSent: ${markSentSummary.markedSent}`);
console.log(`  sent delivery logs: ${sentDeliveryRows?.length ?? 0}`);
console.log(
  "\nUnique fixture per run — prior sent delivery logs on other records do not block repeat staging acceptance.",
);
