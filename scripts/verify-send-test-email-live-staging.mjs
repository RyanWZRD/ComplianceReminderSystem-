/**
 * V6 Phase 57: Staging verification — one real allowlisted manual test email.
 * Invokes deployed send-test-email on staging; confirms exactly one provider send,
 * no delivery log writes, and no automation run writes. Does not invoke
 * scheduled-reminder-runner.
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
 */
async function invokeSendTestEmailLive(supabaseUrl, anonKey, accessToken, to) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/functions/v1/send-test-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      subject: "Compliance Reminder System test email",
      bodyText:
        "This is a controlled staging test email from the Compliance Reminder System. No compliance records were changed.",
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
  "V6 Phase 57 send-test-email live staging verification (one allowlisted recipient)\n",
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
  console.error(".env must define SUPABASE_SERVICE_ROLE_KEY for row-count verification.");
  process.exit(1);
}

if (!supabaseUrl.includes(STAGING_PROJECT_REF)) {
  console.warn(
    `Warning: SUPABASE_URL does not include staging project ref ${STAGING_PROJECT_REF}.`,
  );
}

const recipient = testEmailTo.trim();

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("--- baseline row counts (no rows created by verification) ---");

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

let accessToken;

try {
  accessToken = await obtainAccessToken(supabaseUrl, anonKey, adminEmail, password);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let invokeResult;

try {
  invokeResult = await invokeSendTestEmailLive(supabaseUrl, anonKey, accessToken, recipient);
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

const providerResult = asObject(body.providerResult);

assert(
  body.providerResult !== undefined &&
    body.providerResult !== null &&
    typeof body.providerResult === "object" &&
    !Array.isArray(body.providerResult),
  "response must include exactly one providerResult object",
);

assertEqual(providerResult.status, "sent", "providerResult.status");

const topLevelMessageId =
  typeof body.providerMessageId === "string" ? body.providerMessageId.trim() : "";
const nestedMessageId =
  typeof providerResult.providerMessageId === "string"
    ? providerResult.providerMessageId.trim()
    : "";

if (topLevelMessageId || nestedMessageId) {
  assert(isNonEmptyString(topLevelMessageId), "response.providerMessageId must be non-empty when returned");
  assert(
    isNonEmptyString(nestedMessageId),
    "providerResult.providerMessageId must be non-empty when returned",
  );
  assertEqual(
    topLevelMessageId,
    nestedMessageId,
    "response.providerMessageId matches providerResult.providerMessageId",
  );
}

assert(body.sent_at === undefined && body.sentAt === undefined, "response must not include sent_at");

console.log("Response checks: OK");
console.log(`  status: ${body.status}`);
if (topLevelMessageId) {
  console.log(`  providerMessageId: ${topLevelMessageId}`);
}
console.log(`  providerResult: ${JSON.stringify(providerResult)}`);

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
  deliveryLogCountBefore ?? 0,
  "reminder_delivery_logs row count unchanged after invoke",
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
  process.exit(1);
}

console.log("\nverify-send-test-email-live-staging: all checks OK");
console.log(`  one manual test email sent to allowlisted recipient: ${recipient}`);
console.log("  providerResult.status: sent");
console.log("  no reminder_delivery_logs or automation_runs rows created");
console.log("  scheduled-reminder-runner unchanged (not invoked)");
