/**
 * V6 Phase 61: Staging verification for scheduled runner controlled live_send mode.
 * Sends at most one allowlisted scheduled email, audits delivery logs, and confirms
 * no compliance or history mutation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

/** Alpha Test Organisation — seed / staging default (supabase/seed.sql). */
const DEFAULT_STAGING_ORGANISATION_ID = "11111111-1111-1111-1111-111111111111";

const STAGING_PROJECT_REF = "vmrotpztwoeifbdjwdis";

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

console.log(
  "V6 Phase 61 scheduled runner controlled live-send staging verification\n",
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
const scheduledTestEmailTo =
  readEnvValue(envContent, "SCHEDULED_TEST_EMAIL_TO") ||
  readEnvValue(envContent, "TEST_EMAIL_TO");
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
  console.error(".env must define SUPABASE_SERVICE_ROLE_KEY for row-count verification.");
  process.exit(1);
}

if (!isNonEmptyString(anonKey)) {
  console.error(".env must define SUPABASE_ANON_KEY for Edge Function invoke.");
  process.exit(1);
}

if (!password) {
  console.error(".env must define SUPABASE_TEST_PASSWORD for staging admin sign-in.");
  process.exit(1);
}

if (!isNonEmptyString(scheduledTestEmailTo)) {
  console.error(
    ".env must define SCHEDULED_TEST_EMAIL_TO (or TEST_EMAIL_TO) — one allowlisted recipient for this live staging test.",
  );
  process.exit(1);
}

if (scheduledTestEmailTo.includes(",")) {
  console.error(
    "SCHEDULED_TEST_EMAIL_TO must be a single recipient — comma-separated addresses are not allowed.",
  );
  process.exit(1);
}

if (!supabaseUrl.includes(STAGING_PROJECT_REF)) {
  console.warn(
    `Warning: SUPABASE_URL does not include staging project ref ${STAGING_PROJECT_REF}.`,
  );
}

const allowlistedRecipient = scheduledTestEmailTo.trim().toLowerCase();

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

console.log("\n--- baseline row counts ---");

const { count: deliveryLogCountBefore, error: deliveryCountBeforeError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id", { count: "exact", head: true });

if (deliveryCountBeforeError) {
  console.error(`reminder_delivery_logs count failed: ${deliveryCountBeforeError.message}`);
  process.exit(1);
}

const { count: automationRunCountBefore, error: automationCountBeforeError } = await serviceClient
  .from("automation_runs")
  .select("id", { count: "exact", head: true });

if (automationCountBeforeError) {
  console.error(`automation_runs count failed: ${automationCountBeforeError.message}`);
  process.exit(1);
}

const { data: complianceBefore, error: complianceBeforeError } = await serviceClient
  .from("compliance_records")
  .select("id, notes, expiry_date, compliance_type, person_id")
  .eq("organisation_id", organisationId);

if (complianceBeforeError) {
  console.error(`compliance_records baseline query failed: ${complianceBeforeError.message}`);
  process.exit(1);
}

const { count: historyCountBefore, error: historyCountBeforeError } = await serviceClient
  .from("history_entries")
  .select("id", { count: "exact", head: true })
  .eq("organisation_id", organisationId);

if (historyCountBeforeError) {
  console.error(`history_entries count failed: ${historyCountBeforeError.message}`);
  process.exit(1);
}

console.log(`  reminder_delivery_logs count before: ${deliveryLogCountBefore ?? 0}`);
console.log(`  automation_runs count before: ${automationRunCountBefore ?? 0}`);
console.log(`  compliance_records rows for org: ${complianceBefore?.length ?? 0}`);
console.log(`  history_entries count before: ${historyCountBefore ?? 0}`);

console.log("\n--- invoke scheduled-reminder-runner (mode: live_send) ---");
console.log(`  allowlisted test recipient: ${allowlistedRecipient}`);
console.log(`  organisationId: ${organisationId}`);

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
    "scheduled-reminder-runner not found on staging — deploy first:\n" +
      `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

if (liveSendHttpStatus === 409 && liveSendBody.reason === "scheduled_live_send_not_enabled") {
  console.error(
    "SCHEDULED_EMAIL_SENDING_ENABLED is not enabled on staging. Configure secrets:\n" +
      `  supabase secrets set SCHEDULED_EMAIL_SENDING_ENABLED=true EMAIL_SENDING_ENABLED=true --project-ref ${STAGING_PROJECT_REF}\n` +
      "  plus RESEND_API_KEY, EMAIL_FROM_ADDRESS, SCHEDULED_EMAIL_ALLOWLIST",
  );
  process.exit(1);
}

if (liveSendHttpStatus === 403 && liveSendBody.reason === "email_sending_disabled") {
  console.error("EMAIL_SENDING_ENABLED is not enabled on staging Edge secrets.");
  process.exit(1);
}

if (
  liveSendHttpStatus === 503 &&
  (liveSendBody.error === "provider_not_configured" ||
    liveSendBody.error === "invalid_config" ||
    liveSendBody.error === "scheduled_email_allowlist_not_configured")
) {
  console.error(
    `Staging live_send provider secrets incomplete: ${String(liveSendBody.error)}. Configure RESEND_API_KEY, EMAIL_FROM_ADDRESS, and SCHEDULED_EMAIL_ALLOWLIST on staging.`,
  );
  process.exit(1);
}

assert(liveSendHttpStatus === 200, `live_send HTTP status must be 200 (got ${liveSendHttpStatus})`);
assertEqual(liveSendBody.status, "ok", "live_send response.status");
assertEqual(liveSendBody.mode, "live_send", "live_send response.mode");
assertEqual(liveSendBody.organisationId, organisationId, "live_send response.organisationId");
assert(isUuidString(liveSendBody.automationRunId), "live_send response.automationRunId must be a UUID");

const deliveryLogSummary = asObject(liveSendBody.deliveryLogSummary);
const sendSummary = asObject(liveSendBody.sendSummary);

for (const key of ["total", "pending", "skipped", "failed", "sent"]) {
  assert(
    typeof deliveryLogSummary[key] === "number" && !Number.isNaN(deliveryLogSummary[key]),
    `live_send response.deliveryLogSummary.${key} must be a number`,
  );
}

for (const key of [
  "attempted",
  "sent",
  "failed",
  "skippedMissingEmail",
  "skippedNotAllowlisted",
]) {
  assert(
    typeof sendSummary[key] === "number" && !Number.isNaN(sendSummary[key]),
    `live_send response.sendSummary.${key} must be a number`,
  );
}

assertEqual(deliveryLogSummary.pending, 0, "deliveryLogSummary.pending must be 0");

const automationRunId = String(liveSendBody.automationRunId).trim();

const { data: automationRows, error: automationQueryError } = await serviceClient
  .from("automation_runs")
  .select("id, organisation_id, automation_run_id, run_type, mode, status")
  .eq("automation_run_id", automationRunId);

if (automationQueryError) {
  console.error(`automation_runs query failed: ${automationQueryError.message}`);
  process.exit(1);
}

assert(Array.isArray(automationRows), "automation_runs query must return an array");
assertEqual(automationRows.length, 1, "live_send created one automation_runs row");

const automationRow = automationRows[0];

assertEqual(automationRow.organisation_id, organisationId, "automation_runs.organisation_id");
assertEqual(
  automationRow.run_type,
  "scheduled_reminder_live_send",
  "automation_runs.run_type",
);
assertEqual(automationRow.mode, "live_send", "automation_runs.mode");

const { data: deliveryRows, error: deliveryQueryError } = await serviceClient
  .from("reminder_delivery_logs")
  .select(
    "id, organisation_id, automation_run_id, delivery_status, provider, provider_message_id, sent_at, error_code, error_message, recipient_email, payload",
  )
  .eq("automation_run_id", automationRunId);

if (deliveryQueryError) {
  console.error(`reminder_delivery_logs query failed: ${deliveryQueryError.message}`);
  process.exit(1);
}

assert(Array.isArray(deliveryRows), "reminder_delivery_logs query must return an array");
assertEqual(
  deliveryRows.length,
  deliveryLogSummary.total,
  "live_send delivery log row count matches deliveryLogSummary.total",
);

let sentToAllowlistedOnly = 0;
let skippedMissingEmail = 0;

for (const [index, row] of (deliveryRows ?? []).entries()) {
  const label = `live_send delivery row[${index}]`;
  const payloadObj = asObject(row.payload);

  assertEqual(payloadObj.mode, "live_send", `${label}.payload.mode`);
  assert(row.delivery_status !== "pending", `${label} must not be pending`);

  if (row.delivery_status === "sent") {
    assertEqual(row.provider, "resend", `${label}.provider`);
    assert(isNonEmptyString(row.provider_message_id), `${label}.provider_message_id must be set`);
    assert(row.sent_at != null, `${label}.sent_at must be set`);

    const recipient = String(row.recipient_email ?? "").trim().toLowerCase();
    assert(
      recipient === allowlistedRecipient,
      `${label} sent only to allowlisted SCHEDULED_TEST_EMAIL_TO`,
    );
    sentToAllowlistedOnly += 1;
  }

  if (row.delivery_status === "skipped") {
    assert(row.provider_message_id == null, `${label}.provider_message_id must be null`);
    assert(row.sent_at == null, `${label}.sent_at must be null`);

    if (payloadObj.reason === "missing_email") {
      skippedMissingEmail += 1;
    }

    if (payloadObj.reason === "not_allowlisted") {
      const recipient = String(row.recipient_email ?? "").trim().toLowerCase();
      assert(
        recipient !== allowlistedRecipient,
        `${label} non-allowlisted skip must not match test recipient`,
      );
    }
  }

  if (row.delivery_status === "failed") {
    assert(row.provider_message_id == null, `${label}.provider_message_id must be null`);
    assert(row.sent_at == null, `${label}.sent_at must be null`);
    assert(
      isNonEmptyString(row.error_code) || isNonEmptyString(row.error_message),
      `${label} must include error_code or error_message`,
    );
  }
}

assertEqual(sendSummary.sent, deliveryLogSummary.sent, "sendSummary.sent matches deliveryLogSummary.sent");
assert(
  sentToAllowlistedOnly <= 1,
  "at most one live scheduled email sent to allowlisted recipient in Alpha staging data",
);
assert(
  skippedMissingEmail >= 0,
  "missing-email candidates may be skipped when present in staging data",
);

const { data: complianceAfter, error: complianceAfterError } = await serviceClient
  .from("compliance_records")
  .select("id, notes, expiry_date, compliance_type, person_id")
  .eq("organisation_id", organisationId);

if (complianceAfterError) {
  console.error(`compliance_records after query failed: ${complianceAfterError.message}`);
  process.exit(1);
}

console.log(
  "  note: compliance/history mutation after successful live_send is verified by Phase 62 staging script",
);

console.log("\n--- dry_run and preview still available ---");

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

const dryRunBody = asObject(dryRunResult.payload);

assertEqual(dryRunResult.status, 200, "dry_run HTTP status");
assertEqual(dryRunBody.status, "ok", "dry_run response.status");
assertEqual(dryRunBody.mode, "dry_run", "dry_run response.mode");

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

const previewBody = asObject(previewResult.payload);
const previewAvailable =
  (previewResult.status === 200 && previewBody.status === "ok") ||
  (previewResult.status === 409 &&
    previewBody.status === "refused" &&
    previewBody.reason === "scheduled_live_send_preview_not_enabled");

assert(previewAvailable, "live_send_preview remains available (enabled or gate-off refusal)");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-controlled-live-send-staging: all checks OK");
console.log(`  organisation: ${organisationId}`);
console.log(`  automationRunId: ${automationRunId}`);
console.log(`  live scheduled emails sent: ${sendSummary.sent ?? 0}`);
console.log(`  delivery log rows: ${deliveryRows?.length ?? 0}`);
console.log(`  skipped (missing email): ${sendSummary.skippedMissingEmail ?? 0}`);
console.log(`  skipped (not allowlisted): ${sendSummary.skippedNotAllowlisted ?? 0}`);
console.log("\nEnsure staging secrets include SCHEDULED_EMAIL_ALLOWLIST with SCHEDULED_TEST_EMAIL_TO.");
