/**
 * V6 Phase 66: Production readiness and safety verification gate.
 * Orchestrates core V6 safety scripts and static posture checks — verification only.
 * No feature code changes required for this phase.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sanitizePayloadForDisplay } from "../js/app/cloud/delivery-logs.js";
import { shortenDisplayId } from "../js/app/automation/email-automation-visibility-ui.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const productionReadinessDocPath = join(root, "docs", "v6-production-readiness.md");
const automatedEmailRemindersDocPath = join(root, "docs", "v6-automated-email-reminders.md");
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const scheduledRunnerDocPath = join(root, "docs", "v6-scheduled-runner.md");
const roadmapPath = join(root, "ROADMAP.md");
const packageJsonPath = join(root, "package.json");
const functionPath = join(root, "supabase", "functions", "scheduled-reminder-runner", "index.ts");
const emailProviderPath = join(root, "supabase", "functions", "_shared", "email-provider.ts");
const emailProviderEnvPath = join(root, "js", "data", "email-provider-env.js");
const deliveryLogsJsPath = join(root, "js", "app", "cloud", "delivery-logs.js");
const visibilityUiJsPath = join(root, "js", "app", "automation", "email-automation-visibility-ui.js");
const appBundlePath = join(root, "app.bundle.js");

/** @type {readonly string[]} */
const CORE_VERIFICATION_SCRIPTS = [
  "verify-scheduled-runner-controlled-live-send",
  "verify-scheduled-runner-mark-sent-after-delivery",
  "verify-scheduled-runner-duplicate-prevention",
  "verify-scheduled-runner-failure-handling",
  "verify-automation-visibility-ui",
];

/** @type {readonly { env: string; docs: readonly string[] }[]} */
const REQUIRED_SECRETS = [
  {
    env: "EMAIL_SENDING_ENABLED",
    docs: [productionReadinessDocPath, automatedEmailRemindersDocPath, deliveryArchDocPath],
  },
  {
    env: "SCHEDULED_EMAIL_SENDING_ENABLED",
    docs: [productionReadinessDocPath, automatedEmailRemindersDocPath, deliveryArchDocPath],
  },
  {
    env: "SCHEDULED_EMAIL_ALLOWLIST",
    docs: [productionReadinessDocPath, automatedEmailRemindersDocPath, deliveryArchDocPath],
  },
  {
    env: "EMAIL_FROM_ADDRESS",
    docs: [productionReadinessDocPath, automatedEmailRemindersDocPath, deliveryArchDocPath],
  },
  {
    env: "RESEND_API_KEY",
    docs: [productionReadinessDocPath, automatedEmailRemindersDocPath, deliveryArchDocPath],
  },
  {
    env: "SCHEDULED_EMAIL_PREVIEW_ENABLED",
    docs: [productionReadinessDocPath, automatedEmailRemindersDocPath, deliveryArchDocPath],
  },
];

/** @type {readonly string[]} */
const STAGING_VERIFICATION_COMMANDS = [
  "verify-scheduled-runner-controlled-live-send-staging",
  "verify-scheduled-runner-mark-sent-after-delivery-staging",
  "verify-scheduled-runner-duplicate-prevention-staging",
  "verify-scheduled-runner-failure-handling-staging",
  "verify-automation-visibility-cloud-load",
];

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

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    fail(`${label}: must not contain ${JSON.stringify(needle)}`);
  }
}

/**
 * @param {string} source
 * @param {string} startNeedle
 * @param {string} endNeedle
 * @returns {string}
 */
function extractBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);

  if (start === -1) {
    return "";
  }

  const end = source.indexOf(endNeedle, start + startNeedle.length);

  if (end === -1) {
    return source.slice(start);
  }

  return source.slice(start, end);
}

/**
 * @param {string} scriptName
 */
function runNpmScript(scriptName) {
  console.log(`--- ${scriptName} ---`);

  const result = spawnSync("npm", ["run", scriptName], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-v6-production-readiness failed at: ${scriptName}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log(
  "V6 Phase 66 production readiness and safety verification (verify-v6-production-readiness)\n",
);

console.log("--- A. Build and core verification scripts exist ---");

const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-v6-production-readiness"',
  "package.json verify-v6-production-readiness script",
);

for (const script of CORE_VERIFICATION_SCRIPTS) {
  const scriptPath = join(root, "scripts", `${script}.mjs`);

  assert(existsSync(scriptPath), `scripts/${script}.mjs exists`);
  assertContains(packageJson, `"${script}"`, `package.json ${script} script`);
}

console.log("--- B. Scheduled runner safety (static) ---");

assert(existsSync(functionPath), "scheduled-reminder-runner/index.ts exists");

const functionSource = readFileSync(functionPath, "utf8");

const dryRunProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildDryRunDeliveryLogRows"),
  functionSource.indexOf("async function loadReminderSettings"),
);

const previewProcessorSource = functionSource.slice(
  functionSource.indexOf("function buildLiveSendPreviewDeliveryLogRows"),
  functionSource.indexOf("async function insertScheduledLiveSendPreviewAutomationRun"),
);

const liveSendProcessorSource = extractBetween(
  functionSource,
  "async function processAndInsertLiveSendDeliveryLogs",
  "Deno.serve",
);

const duplicateHelperSource = extractBetween(
  functionSource,
  "async function findExistingSentDeliveryLog",
  "function mapReminderUiLabelToRpcCode",
);

const normalizeModeSource = extractBetween(
  functionSource,
  "function normalizeRequestMode",
  "function resolveAsOfDate",
);

assertContains(
  normalizeModeSource,
  "mode: SCHEDULED_RUNNER_DRY_RUN_MODE",
  "dry_run is default when mode omitted",
);
assertContains(functionSource, "SCHEDULED_RUNNER_LIVE_SEND_MODE", "live_send mode constant exists");
assertContains(functionSource, "SCHEDULED_EMAIL_SENDING_ENABLED", "live_send requires SCHEDULED_EMAIL_SENDING_ENABLED");
assertContains(functionSource, "isEmailSendingEnabled", "live_send requires EMAIL_SENDING_ENABLED");
assertContains(functionSource, "SCHEDULED_EMAIL_ALLOWLIST", "live_send requires SCHEDULED_EMAIL_ALLOWLIST");
assertContains(functionSource, 'reason: "not_allowlisted"', "live_send uses allowlist before sending");

assertNotContains(dryRunProcessorSource, "sendReminderEmail", "dry_run does not call sendReminderEmail");
assertNotContains(
  previewProcessorSource,
  "sendReminderEmail",
  "live_send_preview does not call sendReminderEmail",
);

assertAppearsBeforeMarkSent(liveSendProcessorSource);
assertContains(
  duplicateHelperSource,
  'delivery_status", "sent"',
  "duplicate prevention checks existing sent logs only",
);
assertNotContains(
  duplicateHelperSource,
  'delivery_status", "failed"',
  "failed logs do not block retry",
);
assertNotContains(
  duplicateHelperSource,
  'delivery_status", "skipped"',
  "skipped logs do not block retry",
);

console.log("--- C. Delivery log safety (static) ---");

assert(existsSync(emailProviderPath), "email-provider.ts exists");

const emailProviderSource = readFileSync(emailProviderPath, "utf8");
const sentBranch = extractBetween(
  liveSendProcessorSource,
  'if (providerResult.status === "sent")',
  "normalizeProviderError(providerResult)",
);
const failedBranch = extractBetween(
  liveSendProcessorSource,
  "normalizeProviderError(providerResult)",
  "failed += 1",
);
const skippedLiveSendSource = extractBetween(
  liveSendProcessorSource,
  'delivery_status: "skipped"',
  "attempted += 1",
);

assertContains(sentBranch, "provider_message_id:", "sent rows include provider_message_id");
assertContains(sentBranch, "sent_at:", "sent rows include sent_at");
assertContains(failedBranch, "error_code:", "failed rows include error_code");
assertContains(failedBranch, "error_message:", "failed rows include error_message");
assertContains(failedBranch, "sent_at: null", "failed rows have no sent_at");
assertContains(failedBranch, "provider_message_id: null", "failed rows have no provider_message_id");
assertContains(skippedLiveSendSource, "provider_message_id: null", "skipped rows have no provider_message_id");
assertNotContains(
  skippedLiveSendSource,
  "sent_at:",
  "skipped rows do not set sent_at",
);

const basePayloadSource = extractBetween(
  functionSource,
  "function buildLiveSendCandidateBasePayload",
  "async function processAndInsertLiveSendDeliveryLogs",
);
assertNotContains(basePayloadSource, "apiKey", "live_send payload does not include apiKey");
assertNotContains(basePayloadSource, "RESEND_API_KEY", "live_send payload does not include RESEND_API_KEY");

const loggingSource = functionSource.match(/console\.(log|error|warn)\([^)]*\)/g)?.join("\n") ?? "";
assertNotContains(loggingSource, "RESEND_API_KEY", "scheduled runner does not log RESEND_API_KEY");

assertContains(emailProviderSource, "SECRET_REDACTION_PATTERNS", "provider errors redact secrets");
assertContains(emailProviderSource, "normalizeProviderError", "provider errors normalized before persistence");

console.log("--- D. UI safety (static) ---");

assert(existsSync(deliveryLogsJsPath), "delivery-logs.js exists");
assert(existsSync(visibilityUiJsPath), "email-automation-visibility-ui.js exists");

const deliveryLogsJs = readFileSync(deliveryLogsJsPath, "utf8");
const visibilityUiJs = readFileSync(visibilityUiJsPath, "utf8");

for (const verb of [".insert(", ".update(", ".delete(", ".upsert("]) {
  assertNotContains(deliveryLogsJs, verb, `delivery-logs helper has no write ${verb}`);
}

for (const needle of ["Retry delivery", "Mark sent", "sendReminderEmail", "markReminderSent"]) {
  assertNotContains(visibilityUiJs, needle, `visibility UI has no ${needle}`);
}

assertNotContains(visibilityUiJs, "RESEND_API_KEY", "visibility UI does not render RESEND_API_KEY");
assertNotContains(deliveryLogsJs, "RESEND_API_KEY", "delivery-logs helper does not expose RESEND_API_KEY in payloads");

assertContains(visibilityUiJs, "shortenDisplayId", "provider message IDs shortened for display");
assertContains(deliveryLogsJs, "sanitizePayloadForDisplay", "payload sanitization helper exists");
assertContains(deliveryLogsJs, "PAYLOAD_SAFE_KEYS", "payload allowlist for safe display");

const sanitized = sanitizePayloadForDisplay({
  reason: "would_send",
  apiKey: "re_secret_should_not_appear",
  RESEND_API_KEY: "re_another_secret",
  subject: "Full subject hidden by default",
});
assert(sanitized.reason === "would_send", "sanitized payload keeps safe reason");
assert(!Object.prototype.hasOwnProperty.call(sanitized, "apiKey"), "sanitized payload omits apiKey");
assert(
  !Object.prototype.hasOwnProperty.call(sanitized, "RESEND_API_KEY"),
  "sanitized payload omits RESEND_API_KEY",
);
assert(!Object.prototype.hasOwnProperty.call(sanitized, "subject"), "sanitized payload omits subject by default");

const shortened = shortenDisplayId("email_abcdefghijklmnop");
assert(shortened.includes("…"), "shortenDisplayId truncates long provider message IDs");

if (existsSync(appBundlePath)) {
  const appBundleJs = readFileSync(appBundlePath, "utf8");
  assertNotContains(
    appBundleJs,
    "RESEND_API_KEY",
    "app.bundle.js does not expose RESEND_API_KEY",
  );
} else {
  console.log("  (app.bundle.js not found — run npm run build before release tag)");
}

const emailProviderEnv = readFileSync(emailProviderEnvPath, "utf8");
assertContains(
  emailProviderEnv,
  "RESEND_API_KEY: undefined",
  "email-provider-env.js keeps RESEND_API_KEY undefined in git defaults",
);

console.log("--- E. Secrets and documentation ---");

assert(existsSync(productionReadinessDocPath), "docs/v6-production-readiness.md exists");

const productionReadinessDoc = readFileSync(productionReadinessDocPath, "utf8");
const automatedEmailRemindersDoc = readFileSync(automatedEmailRemindersDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");

assertContains(productionReadinessDoc, "# V6 Production Readiness", "production readiness doc title");
assertContains(
  productionReadinessDoc,
  "verification only",
  "production readiness doc states verification only",
);
assertContains(
  productionReadinessDoc,
  "npm run verify-v6-production-readiness",
  "production readiness doc references verify command",
);

for (const { env, docs } of REQUIRED_SECRETS) {
  for (const docPath of docs) {
    const doc = readFileSync(docPath, "utf8");
    assertContains(doc, env, `${docPath} documents ${env}`);
  }
}

assertContains(
  productionReadinessDoc,
  "must not be committed",
  "production readiness doc warns RESEND_API_KEY must not be committed",
);
assertContains(
  productionReadinessDoc,
  "verified with Resend",
  "production readiness doc notes from-address must be verified with Resend/domain",
);

const knownLimitations = [
  "no automatic retries",
  "allowlist",
  "read-only",
  "no retry UI",
];

for (const phrase of knownLimitations) {
  assert(
    productionReadinessDoc.toLowerCase().includes(phrase.toLowerCase()),
    `production readiness doc documents limitation: ${phrase}`,
  );
}

console.log("--- F. Staging acceptance notes ---");

for (const command of STAGING_VERIFICATION_COMMANDS) {
  assertContains(
    productionReadinessDoc,
    command,
    `production readiness doc mentions staging command ${command}`,
  );
}

assertContains(roadmap, "Phase 66", "ROADMAP.md documents Phase 66");
assertContains(roadmap, "verification only", "ROADMAP.md states Phase 66 is verification only");
assertContains(automatedEmailRemindersDoc, "Phase 66", "v6-automated-email-reminders.md documents Phase 66");
assertContains(deliveryArchDoc, "Phase 66", "v6-delivery-architecture.md documents Phase 66");
const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
assertContains(
  scheduledRunnerDoc,
  "verify-v6-production-readiness",
  "v6-scheduled-runner.md references production readiness gate",
);

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("static safety posture checks: OK\n");

for (const script of CORE_VERIFICATION_SCRIPTS) {
  runNpmScript(script);
}

console.log("V6 production readiness and safety verification: OK");
console.log("  Verification only — no new sending, retry, or mutation behaviour.");
console.log(`  Core gates: ${CORE_VERIFICATION_SCRIPTS.join(", ")}`);
console.log("  Staging acceptance: see docs/v6-production-readiness.md");

/**
 * @param {string} liveSendProcessorSource
 */
function assertAppearsBeforeMarkSent(liveSendProcessorSource) {
  const sentIndex = liveSendProcessorSource.indexOf('delivery_status: "sent"');
  const markSentIndex = liveSendProcessorSource.indexOf("markReminderSentAfterLiveDelivery(");

  if (sentIndex === -1) {
    fail("mark-sent check: missing delivery_status sent insert");
    return;
  }

  if (markSentIndex === -1) {
    fail("mark-sent check: missing markReminderSentAfterLiveDelivery call");
    return;
  }

  if (sentIndex >= markSentIndex) {
    fail("mark_reminder_sent is called only after successful provider send and sent delivery log");
  }
}
