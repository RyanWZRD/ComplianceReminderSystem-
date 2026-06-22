/**
 * V6 Phase 48: Staging verification for scheduled runner automation_runs persistence.
 * Invokes deployed scheduled-reminder-runner on staging, then confirms the HTTP
 * automationRunId matches exactly one automation_runs audit row.
 * Verification only — no delivery logs, mark-as-sent, or Resend checks.
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
 * @param {{
 *   totalCandidates: number;
 *   withEmail: number;
 *   missingEmail: number;
 *   wouldSend: number;
 *   wouldSkip: number;
 * }} summary
 * @param {Record<string, unknown>} row
 */
function assertSummaryMatchesRow(summary, row) {
  const rowSummary =
    row.summary && typeof row.summary === "object" && !Array.isArray(row.summary)
      ? row.summary
      : {};

  const pairs = [
    ["totalCandidates", "total_candidates"],
    ["withEmail", "with_email"],
    ["missingEmail", "missing_email"],
    ["wouldSend", "would_send"],
    ["wouldSkip", "would_skip"],
  ];

  for (const [responseKey, columnKey] of pairs) {
    assertEqual(summary[responseKey], rowSummary[responseKey], `summary JSON ${responseKey}`);
    assertEqual(summary[responseKey], row[columnKey], `column ${columnKey}`);
  }
}

console.log(
  "V6 Phase 48 scheduled runner automation_runs staging verification\n",
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
  console.error(".env must define SUPABASE_SERVICE_ROLE_KEY for automation_runs verification.");
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

const body =
  payload && typeof payload === "object" && !Array.isArray(payload)
    ? /** @type {Record<string, unknown>} */ (payload)
    : null;

assert(body !== null, "response body must be a JSON object");
assertEqual(body.status, "ok", "response.status");
assertEqual(body.mode, "dry_run", "response.mode");

if (!body.automationRunId) {
  fail(
    "response.automationRunId missing — apply Phase 47 migration and redeploy scheduled-reminder-runner to staging",
  );
}

assert(isUuidString(body.automationRunId), "response.automationRunId must be a UUID");
assertEqual(body.organisationId, organisationId, "response.organisationId");

const summary =
  body.summary && typeof body.summary === "object" && !Array.isArray(body.summary)
    ? /** @type {Record<string, unknown>} */ (body.summary)
    : null;

assert(summary !== null, "response.summary must be an object");

for (const key of [
  "totalCandidates",
  "withEmail",
  "missingEmail",
  "wouldSend",
  "wouldSkip",
]) {
  assert(
    typeof summary[key] === "number" && !Number.isNaN(summary[key]),
    `response.summary.${key} must be a number`,
  );
}

if (failures.length > 0) {
  console.error("FAILURES (response checks):");
  failures.forEach((message) => console.error(`  - ${message}`));
  if (body) {
    console.error(`Response body: ${JSON.stringify(body)}`);
  }
  process.exit(1);
}

console.log("Response checks: OK");
console.log(`  automationRunId: ${body.automationRunId}`);

console.log("\n--- query automation_runs by automation_run_id ---");

const automationRunId = String(body.automationRunId).trim();

const { data: rows, error: queryError } = await serviceClient
  .from("automation_runs")
  .select(
    "id, organisation_id, automation_run_id, run_type, mode, status, as_of_date, total_candidates, with_email, missing_email, would_send, would_skip, summary",
  )
  .eq("automation_run_id", automationRunId);

if (queryError) {
  console.error(`automation_runs query failed: ${queryError.message}`);
  process.exit(1);
}

assert(Array.isArray(rows), "automation_runs query must return an array");
assertEqual(rows.length, 1, "exactly one automation_runs row for automationRunId");

const row = rows[0];

assertEqual(row.organisation_id, organisationId, "row.organisation_id");
assertEqual(row.run_type, "scheduled_reminder_dry_run", "row.run_type");
assertEqual(row.mode, "dry_run", "row.mode");
assertEqual(row.status, "completed", "row.status");
assertEqual(row.automation_run_id, automationRunId, "row.automation_run_id");

assertSummaryMatchesRow(
  /** @type {{
   *   totalCandidates: number;
   *   withEmail: number;
   *   missingEmail: number;
   *   wouldSend: number;
   *   wouldSkip: number;
   * }} */ ({
    totalCandidates: summary.totalCandidates,
    withEmail: summary.withEmail,
    missingEmail: summary.missingEmail,
    wouldSend: summary.wouldSend,
    wouldSkip: summary.wouldSkip,
  }),
  row,
);

if (isNonEmptyString(body.asOfDate) && row.as_of_date) {
  assertEqual(String(row.as_of_date).slice(0, 10), body.asOfDate, "row.as_of_date");
}

if (failures.length > 0) {
  console.error("FAILURES (database checks):");
  failures.forEach((message) => console.error(`  - ${message}`));
  console.error(`Row: ${JSON.stringify(row)}`);
  process.exit(1);
}

console.log("\nverify-scheduled-runner-automation-run-staging: all checks OK");
console.log(`  organisation: ${organisationId}`);
console.log(`  automationRunId: ${automationRunId}`);
console.log("  scope: automation_runs audit row only — no delivery log or mark-as-sent checks");
