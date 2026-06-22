/**
 * V6 Phase 58: Staging verification — manual test-send delivery log audit row.
 * Invokes deployed send-test-email once; confirms one reminder_delivery_logs sent row
 * with manual_test metadata. Does not invoke scheduled-reminder-runner.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const scheduledRunnerPath = join(
  root,
  "supabase",
  "functions",
  "scheduled-reminder-runner",
  "index.ts",
);

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

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    fail(`${label}: must not contain ${JSON.stringify(needle)}`);
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
 * @param {string} to
 * @param {string} organisationId
 */
async function invokeSendTestEmail(supabaseUrl, anonKey, accessToken, to, organisationId) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/functions/v1/send-test-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organisationId,
      to,
      subject: "Compliance Reminder System manual test-send audit verification",
      bodyText:
        "This is a controlled staging test email from the Compliance Reminder System. One delivery log audit row should be created. No compliance records were changed.",
    }),
  });

  const text = await response.text();
  /** @type {unknown} */
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `send-test-email returned non-JSON (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  return { status: response.status, payload };
}

console.log(
  "V6 Phase 58 send-test-email delivery log audit staging verification\n",
);

console.log("--- scheduled-reminder-runner static safety ---");

const scheduledRunnerSource = readFileSync(scheduledRunnerPath, "utf8");

assertNotContains(
  scheduledRunnerSource,
  "email-provider",
  "scheduled-reminder-runner does not import email-provider",
);
assertNotContains(
  scheduledRunnerSource,
  "sendReminderEmail",
  "scheduled-reminder-runner does not call sendReminderEmail",
);
assertNotContains(
  scheduledRunnerSource,
  "send-test-email",
  "scheduled-reminder-runner does not reference send-test-email",
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
const testEmailTo = readEnvValue(envContent, "TEST_EMAIL_TO");
const adminEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_ADMIN") ||
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL") ||
  "alpha-admin@example.com";

if (!isNonEmptyString(supabaseUrl)) {
  console.error(".env must define SUPABASE_URL.");
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

if (!isNonEmptyString(testEmailTo)) {
  console.error(
    ".env must define TEST_EMAIL_TO — one allowlisted recipient for this live staging test.",
  );
  process.exit(1);
}

if (testEmailTo.includes(",")) {
  console.error(
    "TEST_EMAIL_TO must be a single recipient — comma-separated addresses are not allowed.",
  );
  process.exit(1);
}

if (!isNonEmptyString(serviceRoleKey)) {
  console.error(".env must define SUPABASE_SERVICE_ROLE_KEY for delivery log verification.");
  process.exit(1);
}

if (!supabaseUrl.includes(STAGING_PROJECT_REF)) {
  console.warn(
    `Warning: SUPABASE_URL does not include staging project ref ${STAGING_PROJECT_REF}.`,
  );
}

const recipient = testEmailTo.trim();
const organisationId = DEFAULT_STAGING_ORGANISATION_ID;

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

console.log(`  reminder_delivery_logs count before invoke: ${deliveryLogCountBefore ?? 0}`);
console.log(`  automation_runs count before invoke: ${automationRunCountBefore ?? 0}`);

console.log("\n--- invoke send-test-email (staging, one allowlisted recipient) ---");
console.log(`  recipient: ${recipient}`);
console.log(`  organisationId: ${organisationId}`);

let accessToken;

try {
  accessToken = await obtainAccessToken(supabaseUrl, anonKey, adminEmail, password);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let invokeResult;

try {
  invokeResult = await invokeSendTestEmail(
    supabaseUrl,
    anonKey,
    accessToken,
    recipient,
    organisationId,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { status: httpStatus, payload } = invokeResult;

if (httpStatus === 404) {
  console.error(
    "send-test-email not found on staging — deploy first:\n" +
      `  supabase functions deploy send-test-email --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

assert(httpStatus === 200, `HTTP status must be 200 ok (got ${httpStatus})`);

const body = asObject(payload);

assertEqual(body.status, "sent", "response.status");

const providerMessageId =
  typeof body.providerMessageId === "string" ? body.providerMessageId.trim() : "";

assert(isNonEmptyString(providerMessageId), "response.providerMessageId must be non-empty");

const deliveryLogId = typeof body.deliveryLogId === "string" ? body.deliveryLogId.trim() : "";

assert(isNonEmptyString(deliveryLogId), "response.deliveryLogId must be non-empty");

const providerResult = asObject(body.providerResult);

assertEqual(providerResult.status, "sent", "providerResult.status");

console.log("Response checks: OK");
console.log(`  status: ${body.status}`);
console.log(`  providerMessageId: ${providerMessageId}`);
console.log(`  deliveryLogId: ${deliveryLogId}`);

console.log("\n--- query reminder_delivery_logs by deliveryLogId ---");

const { data: deliveryLogRow, error: deliveryLogQueryError } = await serviceClient
  .from("reminder_delivery_logs")
  .select(
    "id, organisation_id, automation_run_id, compliance_record_id, person_id, recipient_email, compliance_type, reminder_type, delivery_status, provider, provider_message_id, sent_at, payload",
  )
  .eq("id", deliveryLogId)
  .maybeSingle();

if (deliveryLogQueryError) {
  console.error(`reminder_delivery_logs query failed: ${deliveryLogQueryError.message}`);
  process.exit(1);
}

assert(deliveryLogRow !== null, "exactly one reminder_delivery_logs row exists for deliveryLogId");
assertEqual(deliveryLogRow.delivery_status, "sent", "row.delivery_status");
assertEqual(deliveryLogRow.provider, "resend", "row.provider");
assertEqual(
  deliveryLogRow.provider_message_id,
  providerMessageId,
  "row.provider_message_id matches response.providerMessageId",
);
assertEqual(deliveryLogRow.recipient_email, recipient, "row.recipient_email");
assertEqual(deliveryLogRow.compliance_type, "manual_test_email", "row.compliance_type");
assertEqual(deliveryLogRow.reminder_type, "manual_test", "row.reminder_type");
assert(deliveryLogRow.sent_at !== null && deliveryLogRow.sent_at !== undefined, "row.sent_at is not null");
assertEqual(deliveryLogRow.automation_run_id, null, "row.automation_run_id");
assertEqual(deliveryLogRow.compliance_record_id, null, "row.compliance_record_id");
assertEqual(deliveryLogRow.person_id, null, "row.person_id");

const rowPayload = asObject(deliveryLogRow.payload);

assertEqual(rowPayload.mode, "manual_test_send", "row.payload.mode");

console.log("\n--- row counts after invoke ---");

const { count: deliveryLogCountAfter, error: deliveryCountAfterError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id", { count: "exact", head: true });

if (deliveryCountAfterError) {
  console.error(`reminder_delivery_logs count failed: ${deliveryCountAfterError.message}`);
  process.exit(1);
}

const { count: automationRunCountAfter, error: automationCountAfterError } = await serviceClient
  .from("automation_runs")
  .select("id", { count: "exact", head: true });

if (automationCountAfterError) {
  console.error(`automation_runs count failed: ${automationCountAfterError.message}`);
  process.exit(1);
}

assertEqual(
  deliveryLogCountAfter ?? 0,
  (deliveryLogCountBefore ?? 0) + 1,
  "exactly one new reminder_delivery_logs row was created",
);
assertEqual(
  automationRunCountAfter ?? 0,
  automationRunCountBefore ?? 0,
  "automation_runs row count unchanged after invoke",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  console.error(`Response body: ${JSON.stringify(body)}`);
  if (deliveryLogRow) {
    console.error(`Delivery log row: ${JSON.stringify(deliveryLogRow)}`);
  }
  process.exit(1);
}

console.log("\nverify-send-test-email-delivery-log-audit-staging: all checks OK");
console.log(`  one manual test email sent to allowlisted recipient: ${recipient}`);
console.log(`  one reminder_delivery_logs sent row persisted: ${deliveryLogId}`);
console.log("  automation_runs unchanged");
console.log("  scheduled-reminder-runner unchanged (not invoked)");
