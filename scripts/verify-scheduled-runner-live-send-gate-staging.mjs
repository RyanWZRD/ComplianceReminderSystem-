/**
 * V6 Phase 59: Staging verification for scheduled runner live-send gate.
 * Invokes deployed scheduled-reminder-runner with mode live_send (refused, no writes),
 * then confirms dry_run behaviour still creates automation_runs and delivery logs.
 * Verification only — no Resend, email sends, mark-as-sent, or sent_at checks.
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

const LIVE_SEND_REFUSAL_REASONS = new Set([
  "scheduled_live_send_not_enabled",
  "scheduled_live_send_not_implemented",
]);

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
  "V6 Phase 59 scheduled runner live-send gate staging verification\n",
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

if (!supabaseUrl.includes(STAGING_PROJECT_REF)) {
  console.warn(
    `Warning: SUPABASE_URL does not include staging project ref ${STAGING_PROJECT_REF}.`,
  );
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("--- baseline row counts ---");

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

console.log(`  reminder_delivery_logs count before: ${deliveryLogCountBefore ?? 0}`);
console.log(`  automation_runs count before: ${automationRunCountBefore ?? 0}`);

console.log("\n--- sign in as staging admin ---");

let accessToken;

try {
  accessToken = await obtainAccessToken(supabaseUrl, anonKey, adminEmail, password);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

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

if (liveSendHttpStatus === 404) {
  console.error(
    "scheduled-reminder-runner not found on staging — deploy first:\n" +
      `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

if (liveSendHttpStatus === 200) {
  console.error(
    "scheduled-reminder-runner returned 200 for live_send — redeploy Phase 59 gate to staging:\n" +
      `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

assert(liveSendHttpStatus === 409, `live_send HTTP status must be 409 (got ${liveSendHttpStatus})`);

const liveSendBody = asObject(liveSendPayload);

assertEqual(liveSendBody.status, "refused", "live_send response.status");
assertEqual(liveSendBody.mode, "live_send", "live_send response.mode");
assert(
  typeof liveSendBody.reason === "string" &&
    LIVE_SEND_REFUSAL_REASONS.has(liveSendBody.reason),
  `live_send response.reason must be one of ${[...LIVE_SEND_REFUSAL_REASONS].join(", ")}`,
);

console.log("live_send refusal checks: OK");
console.log(`  reason: ${liveSendBody.reason}`);

console.log("\n--- row counts after live_send invoke ---");

const { count: deliveryLogCountAfterLiveSend, error: deliveryCountAfterLiveSendError } =
  await serviceClient
    .from("reminder_delivery_logs")
    .select("id", { count: "exact", head: true });

if (deliveryCountAfterLiveSendError) {
  console.error(
    `reminder_delivery_logs count failed: ${deliveryCountAfterLiveSendError.message}`,
  );
  process.exit(1);
}

const { count: automationRunCountAfterLiveSend, error: automationCountAfterLiveSendError } =
  await serviceClient
    .from("automation_runs")
    .select("id", { count: "exact", head: true });

if (automationCountAfterLiveSendError) {
  console.error(`automation_runs count failed: ${automationCountAfterLiveSendError.message}`);
  process.exit(1);
}

assertEqual(
  deliveryLogCountAfterLiveSend ?? 0,
  deliveryLogCountBefore ?? 0,
  "reminder_delivery_logs count unchanged after live_send invoke",
);
assertEqual(
  automationRunCountAfterLiveSend ?? 0,
  automationRunCountBefore ?? 0,
  "automation_runs count unchanged after live_send invoke",
);

console.log("\n--- invoke scheduled-reminder-runner (mode: dry_run) ---");

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

const { status: dryRunHttpStatus, payload: dryRunPayload } = dryRunResult;

assert(dryRunHttpStatus === 200, `dry_run HTTP status must be 200 (got ${dryRunHttpStatus})`);

const dryRunBody = asObject(dryRunPayload);

assertEqual(dryRunBody.status, "ok", "dry_run response.status");
assertEqual(dryRunBody.mode, "dry_run", "dry_run response.mode");
assertEqual(dryRunBody.organisationId, organisationId, "dry_run response.organisationId");

if (!dryRunBody.automationRunId) {
  fail("dry_run response.automationRunId missing");
}

assert(isUuidString(dryRunBody.automationRunId), "dry_run response.automationRunId must be a UUID");

const deliveryLogSummary = asObject(dryRunBody.deliveryLogSummary);

assert(
  Object.keys(deliveryLogSummary).length > 0,
  "dry_run response.deliveryLogSummary must be an object",
);

for (const key of ["total", "pending", "skipped", "failed", "sent"]) {
  assert(
    typeof deliveryLogSummary[key] === "number" && !Number.isNaN(deliveryLogSummary[key]),
    `dry_run response.deliveryLogSummary.${key} must be a number`,
  );
}

console.log("dry_run response checks: OK");
console.log(`  automationRunId: ${dryRunBody.automationRunId}`);
console.log(`  deliveryLogSummary: ${JSON.stringify(deliveryLogSummary)}`);

const automationRunId = String(dryRunBody.automationRunId).trim();

console.log("\n--- verify dry_run created automation_runs and delivery logs ---");

const { data: automationRows, error: automationQueryError } = await serviceClient
  .from("automation_runs")
  .select("id, organisation_id, automation_run_id, run_type, mode, status")
  .eq("automation_run_id", automationRunId);

if (automationQueryError) {
  console.error(`automation_runs query failed: ${automationQueryError.message}`);
  process.exit(1);
}

assert(Array.isArray(automationRows), "automation_runs query must return an array");
assertEqual(automationRows.length, 1, "dry_run created one automation_runs row");

const automationRow = automationRows[0];

assertEqual(automationRow.organisation_id, organisationId, "automation_runs.organisation_id");
assertEqual(automationRow.automation_run_id, automationRunId, "automation_runs.automation_run_id");
assertEqual(automationRow.run_type, "scheduled_reminder_dry_run", "automation_runs.run_type");
assertEqual(automationRow.mode, "dry_run", "automation_runs.mode");
assertEqual(automationRow.status, "completed", "automation_runs.status");

const { data: deliveryRows, error: deliveryQueryError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id, organisation_id, automation_run_id, delivery_status, payload")
  .eq("automation_run_id", automationRunId);

if (deliveryQueryError) {
  console.error(`reminder_delivery_logs query failed: ${deliveryQueryError.message}`);
  process.exit(1);
}

assert(Array.isArray(deliveryRows), "reminder_delivery_logs query must return an array");
assertEqual(deliveryRows.length, deliveryLogSummary.total, "dry_run delivery log row count");

for (const [index, row] of (deliveryRows ?? []).entries()) {
  const label = `dry_run delivery row[${index}]`;
  const payloadObj = asObject(row.payload);

  assertEqual(payloadObj.mode, "dry_run", `${label}.payload.mode`);
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-live-send-gate-staging: all checks OK");
console.log(`  organisation: ${organisationId}`);
console.log(`  live_send refused: ${liveSendBody.reason} (no row writes)`);
console.log(`  dry_run automationRunId: ${automationRunId}`);
console.log(`  dry_run delivery log rows: ${deliveryRows?.length ?? 0}`);
console.log("  scope: gate only — no scheduled email sends");
