/**
 * V6 Phase 52: Staging verification for scheduled runner dry-run delivery logs.
 * Invokes deployed scheduled-reminder-runner on staging, then confirms
 * reminder_delivery_logs rows are linked to the returned automationRunId.
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
 * @param {string | undefined} asOfDate
 */
async function invokeScheduledRunnerDryRun(
  supabaseUrl,
  anonKey,
  accessToken,
  organisationId,
  asOfDate,
) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  /** @type {Record<string, string>} */
  const body = { organisationId };

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
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

console.log(
  "V6 Phase 52 scheduled runner delivery log dry-run staging verification\n",
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
  console.error(".env must define SUPABASE_SERVICE_ROLE_KEY for delivery log verification.");
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

console.log("--- invoke scheduled-reminder-runner (staging dry run) ---");

let accessToken;

try {
  accessToken = await obtainAccessToken(supabaseUrl, anonKey, adminEmail, password);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let invokeResult;

try {
  invokeResult = await invokeScheduledRunnerDryRun(
    supabaseUrl,
    anonKey,
    accessToken,
    organisationId,
    asOfDate,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { status: httpStatus, payload } = invokeResult;

assert(httpStatus === 200, `HTTP status must be 200 (got ${httpStatus})`);

const body = asObject(payload);

assert(Object.keys(body).length > 0, "response body must be a JSON object");
assertEqual(body.status, "ok", "response.status");
assertEqual(body.mode, "dry_run", "response.mode");

if (!body.automationRunId) {
  fail(
    "response.automationRunId missing — apply Phase 47 migration and redeploy scheduled-reminder-runner to staging",
  );
}

assert(isUuidString(body.automationRunId), "response.automationRunId must be a UUID");
assertEqual(body.organisationId, organisationId, "response.organisationId");

const deliveryLogSummary = asObject(body.deliveryLogSummary);

assert(
  Object.keys(deliveryLogSummary).length > 0,
  "response.deliveryLogSummary must be an object — redeploy scheduled-reminder-runner with Phase 51 delivery log writes",
);

for (const key of ["total", "pending", "skipped", "failed", "sent"]) {
  assert(
    typeof deliveryLogSummary[key] === "number" && !Number.isNaN(deliveryLogSummary[key]),
    `response.deliveryLogSummary.${key} must be a number`,
  );
}

if (failures.length > 0) {
  console.error("FAILURES (response checks):");
  failures.forEach((message) => console.error(`  - ${message}`));
  console.error(`Response body: ${JSON.stringify(body)}`);
  process.exit(1);
}

console.log("Response checks: OK");
console.log(`  automationRunId: ${body.automationRunId}`);
console.log(`  deliveryLogSummary: ${JSON.stringify(deliveryLogSummary)}`);

const automationRunId = String(body.automationRunId).trim();

console.log("\n--- query reminder_delivery_logs by automation_run_id ---");

const { data: deliveryRows, error: deliveryQueryError } = await serviceClient
  .from("reminder_delivery_logs")
  .select(
    "id, organisation_id, automation_run_id, delivery_status, provider, provider_message_id, sent_at, payload",
  )
  .eq("automation_run_id", automationRunId);

if (deliveryQueryError) {
  console.error(`reminder_delivery_logs query failed: ${deliveryQueryError.message}`);
  process.exit(1);
}

assert(Array.isArray(deliveryRows), "reminder_delivery_logs query must return an array");

const rows = deliveryRows ?? [];

assertEqual(rows.length, deliveryLogSummary.total, "row count equals deliveryLogSummary.total");

let pendingCount = 0;
let skippedCount = 0;
let sentCount = 0;
let failedCount = 0;

for (const [index, row] of rows.entries()) {
  const label = `row[${index}]`;

  assertEqual(row.organisation_id, organisationId, `${label}.organisation_id`);
  assertEqual(row.automation_run_id, automationRunId, `${label}.automation_run_id`);

  const status = String(row.delivery_status || "");

  if (status === "pending") {
    pendingCount += 1;
  } else if (status === "skipped") {
    skippedCount += 1;
  } else if (status === "sent") {
    sentCount += 1;
  } else if (status === "failed") {
    failedCount += 1;
  } else {
    fail(`${label}.delivery_status unexpected: ${JSON.stringify(row.delivery_status)}`);
  }

  assert(row.sent_at === null || row.sent_at === undefined, `${label}.sent_at must be null`);
  assert(
    row.provider_message_id === null || row.provider_message_id === undefined,
    `${label}.provider_message_id must be null`,
  );
  assert(row.provider === null, `${label}.provider must be null`);

  const payloadObj = asObject(row.payload);

  assertEqual(payloadObj.mode, "dry_run", `${label}.payload.mode`);
}

assertEqual(pendingCount, deliveryLogSummary.pending, "pending count equals deliveryLogSummary.pending");
assertEqual(skippedCount, deliveryLogSummary.skipped, "skipped count equals deliveryLogSummary.skipped");
assertEqual(sentCount, 0, "sent count is 0");
assertEqual(failedCount, 0, "failed count is 0");
assertEqual(deliveryLogSummary.sent, 0, "deliveryLogSummary.sent is 0");
assertEqual(deliveryLogSummary.failed, 0, "deliveryLogSummary.failed is 0");

console.log("\n--- query automation_runs by automation_run_id ---");

const { data: automationRows, error: automationQueryError } = await serviceClient
  .from("automation_runs")
  .select("id, organisation_id, automation_run_id, run_type, mode, status")
  .eq("automation_run_id", automationRunId);

if (automationQueryError) {
  console.error(`automation_runs query failed: ${automationQueryError.message}`);
  process.exit(1);
}

assert(Array.isArray(automationRows), "automation_runs query must return an array");
assertEqual(automationRows.length, 1, "matching automation_runs row still exists");

const automationRow = automationRows[0];

assertEqual(automationRow.organisation_id, organisationId, "automation_runs.organisation_id");
assertEqual(automationRow.automation_run_id, automationRunId, "automation_runs.automation_run_id");
assertEqual(automationRow.run_type, "scheduled_reminder_dry_run", "automation_runs.run_type");
assertEqual(automationRow.mode, "dry_run", "automation_runs.mode");
assertEqual(automationRow.status, "completed", "automation_runs.status");

if (failures.length > 0) {
  console.error("FAILURES (database checks):");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-delivery-log-dry-run-staging: all checks OK");
console.log(`  organisation: ${organisationId}`);
console.log(`  automationRunId: ${automationRunId}`);
console.log(`  delivery log rows: ${rows.length} (pending=${pendingCount}, skipped=${skippedCount})`);
console.log("  scope: dry-run delivery logs only — no email delivery or mark-as-sent checks");
