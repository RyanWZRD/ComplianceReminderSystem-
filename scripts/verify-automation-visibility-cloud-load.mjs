/**
 * V6 Phase 65: Staging smoke test for read-only automation visibility cloud loads.
 * Signs in as staging admin, loads automation_runs and delivery logs, asserts no writes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const DEFAULT_STAGING_ORGANISATION_ID = "11111111-1111-1111-1111-111111111111";

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

let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env file. Copy .env.example to .env and configure Supabase test credentials.");
  process.exit(1);
}

const email =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_ADMIN") ||
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL");
const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");

if (!email || !password) {
  console.error(
    ".env must define SUPABASE_TEST_PASSWORD and SUPABASE_TEST_EMAIL (or SUPABASE_TEST_EMAIL_ADMIN)."
  );
  process.exit(1);
}

process.env.AUTH_MODE = "supabase";

const automationRunsJs = readFileSync(join(root, "js/app/cloud/automation-runs.js"), "utf8");
const deliveryLogsJs = readFileSync(join(root, "js/app/cloud/delivery-logs.js"), "utf8");

for (const verb of [".insert(", ".update(", ".delete(", ".upsert("]) {
  if (automationRunsJs.includes(verb) || deliveryLogsJs.includes(verb)) {
    console.error(`Cloud visibility helpers must not perform writes (${verb}).`);
    process.exit(1);
  }
}

const { signInWithPassword, signOut, getOrganisationId } = await import("../js/auth/session.js");
const { loadAutomationRuns } = await import("../js/app/cloud/automation-runs.js");
const { loadDeliveryLogs } = await import("../js/app/cloud/delivery-logs.js");

try {
  const signInResult = await signInWithPassword(email, password);

  if (!signInResult.ok) {
    console.error(`Sign-in failed: ${signInResult.error}`);
    process.exit(1);
  }

  const organisationId = getOrganisationId() || DEFAULT_STAGING_ORGANISATION_ID;

  const runsResult = await loadAutomationRuns({ organisationId, limit: 10 });

  if (!runsResult.ok) {
    console.error(
      `loadAutomationRuns failed: ${
        runsResult.error instanceof Error ? runsResult.error.message : String(runsResult.error ?? "")
      }`
    );
    process.exit(1);
  }

  const runs = runsResult.runs ?? [];
  console.log(`Loaded ${runs.length} automation run(s) for organisation ${organisationId}.`);

  if (runs.length === 0) {
    console.log(
      "No automation runs found on staging — read path succeeded with empty result (no writes performed)."
    );
    await signOut();
    console.log("verify-automation-visibility-cloud-load: all checks OK");
    process.exit(0);
  }

  const latestRun = runs[0];

  if (!latestRun.automationRunId) {
    console.error("Latest automation run is missing automationRunId.");
    process.exit(1);
  }

  const logsResult = await loadDeliveryLogs({
    organisationId,
    automationRunId: latestRun.automationRunId,
    limit: 25,
  });

  if (!logsResult.ok) {
    console.error(
      `loadDeliveryLogs failed: ${
        logsResult.error instanceof Error ? logsResult.error.message : String(logsResult.error ?? "")
      }`
    );
    process.exit(1);
  }

  const logs = logsResult.logs ?? [];
  console.log(
    `Loaded ${logs.length} delivery log(s) for automation run ${latestRun.automationRunId}.`
  );

  for (const log of logs) {
    if (log.automationRunId && log.automationRunId !== latestRun.automationRunId) {
      console.error("Delivery log automation_run_id does not match selected run.");
      process.exit(1);
    }
  }

  await signOut();
  console.log("verify-automation-visibility-cloud-load: all checks OK (read-only, no writes)");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
