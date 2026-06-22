/**
 * V6 Phase 55: Staging verification — email provider disabled by default.
 * Invokes deployed verify-email-provider-disabled on staging; confirms no live send,
 * no provider_message_id/sent_at in response, no delivery log writes, and
 * scheduled-reminder-runner still does not import email-provider.
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
 */
async function invokeProviderDisabledVerification(supabaseUrl, anonKey, accessToken) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/functions/v1/verify-email-provider-disabled`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const text = await response.text();
  /** @type {unknown} */
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `verify-email-provider-disabled returned non-JSON (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  return { status: response.status, payload };
}

console.log(
  "V6 Phase 55 email provider disabled-mode staging verification\n",
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
  "api.resend.com",
  "scheduled-reminder-runner does not call Resend",
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

if (!isNonEmptyString(serviceRoleKey)) {
  console.error(".env must define SUPABASE_SERVICE_ROLE_KEY for delivery log count verification.");
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

console.log("--- delivery log baseline (no rows created by verification) ---");

const { count: deliveryLogCountBefore, error: countBeforeError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id", { count: "exact", head: true });

if (countBeforeError) {
  console.error(`reminder_delivery_logs count failed: ${countBeforeError.message}`);
  process.exit(1);
}

console.log(`  reminder_delivery_logs count before invoke: ${deliveryLogCountBefore ?? 0}`);

console.log("\n--- invoke verify-email-provider-disabled (staging) ---");

let accessToken;

try {
  accessToken = await obtainAccessToken(supabaseUrl, anonKey, adminEmail, password);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let invokeResult;

try {
  invokeResult = await invokeProviderDisabledVerification(supabaseUrl, anonKey, accessToken);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { status: httpStatus, payload } = invokeResult;

if (httpStatus === 404) {
  console.error(
    "verify-email-provider-disabled not found on staging — deploy first:\n" +
      `  supabase functions deploy verify-email-provider-disabled --project-ref ${STAGING_PROJECT_REF}`,
  );
  process.exit(1);
}

assert(httpStatus === 200, `HTTP status must be 200 (got ${httpStatus})`);

const body = asObject(payload);

assertEqual(body.status, "ok", "response.status");
assertEqual(body.mode, "provider_disabled_verification", "response.mode");
assertEqual(body.emailProviderStatus, "disabled", "response.emailProviderStatus");

assert(
  body.providerMessageId === undefined && body.provider_message_id === undefined,
  "response must not include providerMessageId",
);
assert(body.sent_at === undefined && body.sentAt === undefined, "response must not include sent_at");

const providerResult = asObject(body.providerResult);

assertEqual(providerResult.status, "disabled", "providerResult.status");
assertEqual(
  providerResult.reason,
  "email_sending_disabled",
  "providerResult.reason",
);
assert(
  providerResult.providerMessageId === undefined &&
    providerResult.provider_message_id === undefined,
  "providerResult must not include providerMessageId",
);

console.log("Response checks: OK");
console.log(`  emailProviderStatus: ${body.emailProviderStatus}`);
console.log(`  providerResult: ${JSON.stringify(providerResult)}`);

console.log("\n--- delivery log count after invoke ---");

const { count: deliveryLogCountAfter, error: countAfterError } = await serviceClient
  .from("reminder_delivery_logs")
  .select("id", { count: "exact", head: true });

if (countAfterError) {
  console.error(`reminder_delivery_logs count failed: ${countAfterError.message}`);
  process.exit(1);
}

assertEqual(
  deliveryLogCountAfter ?? 0,
  deliveryLogCountBefore ?? 0,
  "reminder_delivery_logs row count unchanged after verification invoke",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  console.error(`Response body: ${JSON.stringify(body)}`);
  process.exit(1);
}

console.log("\nverify-email-provider-disabled-staging: all checks OK");
console.log("  provider disabled on staging — no live email send");
console.log("  no provider_message_id or sent_at in response");
console.log("  no reminder_delivery_logs rows created");
console.log("  scheduled-reminder-runner unchanged (no email-provider import)");
