/**
 * V6 Phase 60: Staging verification for scheduled runner live-send preview mode.
 * Verifies preview gate refusal when disabled, optional enabled preview path,
 * and confirms live_send remains refused with no actual email sends.
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

const LIVE_SEND_REFUSAL_REASONS = new Set(["scheduled_live_send_not_enabled"]);

const LIVE_SEND_SUCCESS_OR_CONFIG_ERRORS = new Set([
  "scheduled_live_send_not_enabled",
  "email_sending_disabled",
  "provider_not_configured",
  "invalid_config",
  "scheduled_email_allowlist_not_configured",
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
  "V6 Phase 60 scheduled runner live-send preview staging verification\n",
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

console.log(`  reminder_delivery_logs count before: ${deliveryLogCountBefore ?? 0}`);
console.log(`  automation_runs count before: ${automationRunCountBefore ?? 0}`);

console.log("\n--- invoke scheduled-reminder-runner (mode: live_send_preview) ---");

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

const { status: previewHttpStatus, payload: previewPayload } = previewResult;

if (previewHttpStatus === 404) {
  console.error(
    "scheduled-reminder-runner not found on staging — deploy first:\n" +
      `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

const previewBody = asObject(previewPayload);
const previewRefused =
  previewHttpStatus === 409 &&
  previewBody.status === "refused" &&
  previewBody.reason === "scheduled_live_send_preview_not_enabled";

if (previewRefused) {
  console.log("preview gate disabled — verifying refusal path");

  assertEqual(previewBody.mode, "live_send_preview", "preview refusal response.mode");

  const { count: deliveryLogCountAfterRefusal, error: deliveryCountAfterRefusalError } =
    await serviceClient
      .from("reminder_delivery_logs")
      .select("id", { count: "exact", head: true });

  if (deliveryCountAfterRefusalError) {
    console.error(
      `reminder_delivery_logs count failed: ${deliveryCountAfterRefusalError.message}`,
    );
    process.exit(1);
  }

  const { count: automationRunCountAfterRefusal, error: automationCountAfterRefusalError } =
    await serviceClient
      .from("automation_runs")
      .select("id", { count: "exact", head: true });

  if (automationCountAfterRefusalError) {
    console.error(`automation_runs count failed: ${automationCountAfterRefusalError.message}`);
    process.exit(1);
  }

  assertEqual(
    deliveryLogCountAfterRefusal ?? 0,
    deliveryLogCountBefore ?? 0,
    "reminder_delivery_logs count unchanged after refused preview invoke",
  );
  assertEqual(
    automationRunCountAfterRefusal ?? 0,
    automationRunCountBefore ?? 0,
    "automation_runs count unchanged after refused preview invoke",
  );

  console.log("disabled preview refusal checks: OK");
} else if (previewHttpStatus === 200 && previewBody.status === "ok") {
  console.log("preview gate enabled — verifying enabled preview path");

  assertEqual(previewBody.mode, "live_send_preview", "preview response.mode");
  assertEqual(previewBody.organisationId, organisationId, "preview response.organisationId");

  if (!previewBody.automationRunId) {
    fail("preview response.automationRunId missing");
  }

  assert(isUuidString(previewBody.automationRunId), "preview response.automationRunId must be a UUID");

  const deliveryLogSummary = asObject(previewBody.deliveryLogSummary);
  const previewSummary = asObject(previewBody.previewSummary);

  for (const key of ["total", "pending", "skipped", "failed", "sent"]) {
    assert(
      typeof deliveryLogSummary[key] === "number" && !Number.isNaN(deliveryLogSummary[key]),
      `preview response.deliveryLogSummary.${key} must be a number`,
    );
  }

  for (const key of ["totalPreviewed", "withEmailPreviewed", "skipped"]) {
    assert(
      typeof previewSummary[key] === "number" && !Number.isNaN(previewSummary[key]),
      `preview response.previewSummary.${key} must be a number`,
    );
  }

  const automationRunId = String(previewBody.automationRunId).trim();

  const { data: automationRows, error: automationQueryError } = await serviceClient
    .from("automation_runs")
    .select("id, organisation_id, automation_run_id, run_type, mode, status")
    .eq("automation_run_id", automationRunId);

  if (automationQueryError) {
    console.error(`automation_runs query failed: ${automationQueryError.message}`);
    process.exit(1);
  }

  assert(Array.isArray(automationRows), "automation_runs query must return an array");
  assertEqual(automationRows.length, 1, "preview created one automation_runs row");

  const automationRow = automationRows[0];

  assertEqual(automationRow.organisation_id, organisationId, "automation_runs.organisation_id");
  assertEqual(
    automationRow.run_type,
    "scheduled_reminder_live_send_preview",
    "automation_runs.run_type",
  );
  assertEqual(automationRow.mode, "live_send_preview", "automation_runs.mode");
  assertEqual(automationRow.status, "completed", "automation_runs.status");

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
  assertEqual(
    deliveryRows.length,
    deliveryLogSummary.total,
    "preview delivery log row count matches deliveryLogSummary.total",
  );

  let pendingWithPreview = 0;

  for (const [index, row] of (deliveryRows ?? []).entries()) {
    const label = `preview delivery row[${index}]`;
    const payloadObj = asObject(row.payload);

    assertEqual(payloadObj.mode, "live_send_preview", `${label}.payload.mode`);
    assert(row.provider == null, `${label}.provider must be null`);
    assert(row.provider_message_id == null, `${label}.provider_message_id must be null`);
    assert(row.sent_at == null, `${label}.sent_at must be null`);

    if (row.delivery_status === "pending") {
      const emailPreview = asObject(payloadObj.emailPreview);
      assert(
        isNonEmptyString(emailPreview.subject),
        `${label}.payload.emailPreview.subject must be non-empty`,
      );
      assert(
        isNonEmptyString(emailPreview.bodyText),
        `${label}.payload.emailPreview.bodyText must be non-empty`,
      );
      pendingWithPreview += 1;
    }

    if (row.delivery_status === "skipped") {
      assertEqual(payloadObj.reason, "missing_email", `${label}.payload.reason`);
    }
  }

  assertEqual(
    pendingWithPreview,
    deliveryLogSummary.pending,
    "pending rows with emailPreview match deliveryLogSummary.pending",
  );

  console.log("enabled preview path checks: OK");
  console.log(`  automationRunId: ${automationRunId}`);
  console.log(`  delivery log rows: ${deliveryRows?.length ?? 0}`);
} else {
  fail(
    `unexpected live_send_preview response: HTTP ${previewHttpStatus}, body ${JSON.stringify(previewBody).slice(0, 300)}`,
  );
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

const liveSendBody = asObject(liveSendPayload);

if (liveSendHttpStatus === 200 && liveSendBody.status === "ok") {
  console.log("live_send enabled on staging (Phase 61) — preview staging does not re-verify sends");
  console.log(`  automationRunId: ${liveSendBody.automationRunId ?? "(missing)"}`);
  console.log(`  sent: ${asObject(liveSendBody.sendSummary).sent ?? 0}`);
} else if (liveSendHttpStatus === 409 && liveSendBody.status === "refused") {
  assertEqual(liveSendBody.mode, "live_send", "live_send response.mode");
  assert(
    typeof liveSendBody.reason === "string" &&
      LIVE_SEND_REFUSAL_REASONS.has(liveSendBody.reason),
    `live_send response.reason must be one of ${[...LIVE_SEND_REFUSAL_REASONS].join(", ")}`,
  );
  console.log("live_send gate off: OK");
  console.log(`  reason: ${liveSendBody.reason}`);
} else if (
  liveSendHttpStatus === 403 ||
  liveSendHttpStatus === 503
) {
  const configError = liveSendBody.error ?? liveSendBody.reason;
  assert(
    typeof configError === "string" && LIVE_SEND_SUCCESS_OR_CONFIG_ERRORS.has(configError),
    `live_send config response must be a known gate error (got ${JSON.stringify(liveSendBody).slice(0, 200)})`,
  );
  console.log(`live_send config incomplete on staging: ${configError}`);
} else {
  fail(
    `unexpected live_send response: HTTP ${liveSendHttpStatus}, body ${JSON.stringify(liveSendBody).slice(0, 300)}`,
  );
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nverify-scheduled-runner-live-send-preview-staging: all checks OK");
console.log(`  organisation: ${organisationId}`);
console.log(
  previewRefused
    ? "  preview gate: disabled (refusal verified, no row writes)"
    : "  preview gate: enabled (preview metadata persisted, no emails sent)",
);
console.log(`  live_send: ${liveSendHttpStatus === 200 ? "enabled (Phase 61)" : liveSendBody.reason ?? liveSendBody.error ?? liveSendHttpStatus}`);
console.log("\nTo enable preview verification on staging:");
console.log(
  `  supabase secrets set SCHEDULED_EMAIL_PREVIEW_ENABLED=true --project-ref ${STAGING_PROJECT_REF}`,
);
console.log(
  `  supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
);
