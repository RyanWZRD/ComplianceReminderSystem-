/**
 * V5-0 Phase 4: Automation Run Creation RPC.
 * Static checks plus cloud smoke for create_automation_run.
 * No UI, Edge Functions, cron, queue processing, email delivery, or automation execution.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

/** @type {string[]} */
const failures = [];

/** @type {string[]} */
const createdRunIds = [];

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

function readMigration(filename) {
  const path = join(migrationsDir, filename);

  if (!existsSync(path)) {
    fail(`missing migration file: ${filename}`);
    return "";
  }

  return readFileSync(path, "utf8");
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

console.log("V5-0 Phase 4 automation run creation RPC verification (verify-automation-run-create)\n");

const rpcMigration = readMigration("20260401000005_create_automation_run_rpc.sql");

assertContains(
  rpcMigration,
  "create or replace function public.create_automation_run",
  "create_automation_run RPC"
);
assertContains(
  rpcMigration,
  "p_status text default 'completed'",
  "create_automation_run status default"
);
assertContains(
  rpcMigration,
  "p_summary jsonb default '{}'::jsonb",
  "create_automation_run summary default"
);
assertContains(
  rpcMigration,
  "current_user_role() <> 'admin'",
  "create_automation_run admin-only write"
);
assertContains(
  rpcMigration,
  "array['running', 'completed', 'failed', 'cancelled']",
  "create_automation_run status validation"
);
assertContains(rpcMigration, "v_completed_at := null", "running status clears completed_at");
assertContains(rpcMigration, "v_completed_at := now()", "terminal status sets completed_at");
assertContains(rpcMigration, "'status', 'created'", "create_automation_run created status");
assertNotContains(rpcMigration, "automation_policies", "Phase 4 RPC migration does not touch policies");
assertNotContains(rpcMigration, "notification_queue", "Phase 4 RPC migration has no notification_queue");
assertNotContains(rpcMigration, "delivery_log", "Phase 4 RPC migration has no delivery_log");
assertNotContains(rpcMigration, "cron", "Phase 4 RPC migration has no cron");
assertNotContains(rpcMigration, "pg_cron", "Phase 4 RPC migration has no pg_cron");

const cloudAutomationStoreJs = readFileSync(
  join(root, "js", "data", "cloud-automation-store.js"),
  "utf8"
);
assertContains(
  cloudAutomationStoreJs,
  "createAutomationRun",
  "CloudAutomationStore.createAutomationRun"
);
assertContains(
  cloudAutomationStoreJs,
  'rpc("create_automation_run"',
  "CloudAutomationStore uses create_automation_run RPC"
);

const packageJson = readFileSync(join(root, "package.json"), "utf8");
assertContains(
  packageJson,
  '"verify-automation-run-create": "node scripts/verify-automation-run-create.mjs"',
  "package.json verify-automation-run-create script"
);

const appJs = readFileSync(join(root, "app.js"), "utf8");
const forbiddenExecutionNeedles = [
  "daily_compliance_scan",
  "process_notification_queue",
  "apply_automation_policies",
  "enqueue_reminder_notifications",
  "notification_queue",
  "delivery_log",
  "AUTOMATION_ENABLED",
];

for (const needle of forbiddenExecutionNeedles) {
  assertNotContains(appJs, needle, `app.js has no ${needle}`);
}

assertNotContains(appJs, "createAutomationRun", "app.js does not wire createAutomationRun yet");

if (failures.length > 0) {
  console.error("FAIL verify-automation-run-create (static):");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("Static checks: OK");

const envPath = join(root, ".env");
let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env file for cloud smoke.");
  process.exit(1);
}

const password = readEnvValue(envContent, "SUPABASE_TEST_PASSWORD");
const supabaseUrl = readEnvValue(envContent, "SUPABASE_URL");
const serviceRoleKey = readEnvValue(envContent, "SUPABASE_SERVICE_ROLE_KEY");
const adminEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_ADMIN") ||
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL") ||
  "alpha-admin@example.com";
const editorEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_EDITOR") || "alpha-editor@example.com";
const viewerEmail =
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_VIEWER") || "alpha-viewer@example.com";

if (!password) {
  console.error(".env must define SUPABASE_TEST_PASSWORD.");
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error(".env must define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for cleanup.");
  process.exit(1);
}

process.env.DATA_BACKEND = "cloud";
process.env.AUTH_MODE = "supabase";
process.env.CLOUD_WRITES_ENABLED = "true";

const { signInWithPassword, signOut } = await import("../js/auth/session.js");
const { CloudAutomationStore } = await import("../js/data/cloud-automation-store.js");
const { canMutateData } = await import("../js/app/permissions.js");
const { getSupabaseClient } = await import("../js/data/supabase-client.js");

if (canMutateData()) {
  console.error("canMutateData() must stay false in cloud mode.");
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function countAutomationRuns() {
  const { count, error } = await serviceClient
    .from("automation_runs")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error(`automation_runs count failed: ${error.message}`);
    process.exit(1);
  }

  return count ?? 0;
}

async function countAutomationPolicies() {
  const { count, error } = await serviceClient
    .from("automation_policies")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error(`automation_policies count failed: ${error.message}`);
    process.exit(1);
  }

  return count ?? 0;
}

async function deleteCreatedRuns() {
  if (createdRunIds.length === 0) {
    return;
  }

  const { error } = await serviceClient.from("automation_runs").delete().in("id", createdRunIds);

  if (error) {
    console.error(`Cleanup created automation runs failed: ${error.message}`);
    process.exit(1);
  }
}

async function signInAs(email) {
  const result = await signInWithPassword(email, password);

  if (!result.ok) {
    console.error(`Sign-in failed (${email}): ${result.error}`);
    process.exit(1);
  }
}

const runsBefore = await countAutomationRuns();
const policiesBefore = await countAutomationPolicies();

// --- Admin: create completed + running runs ---
await signInAs(adminEmail);

const adminStore = new CloudAutomationStore();
const completedResult = await adminStore.createAutomationRun({
  status: "completed",
  summary: { policiesApplied: 0, remindersQueued: 0 },
});

if (!completedResult.ok || completedResult.status !== "created" || !completedResult.run) {
  console.error(`Admin completed create failed: ${JSON.stringify(completedResult)}`);
  process.exit(1);
}

createdRunIds.push(completedResult.run.id);

if (completedResult.run.status !== "completed") {
  console.error("Created completed run has wrong status.");
  process.exit(1);
}

if (!completedResult.run.completedAt) {
  console.error("Created completed run must have completed_at set.");
  process.exit(1);
}

const runningResult = await adminStore.createAutomationRun({
  status: "running",
  summary: {},
});

if (!runningResult.ok || runningResult.status !== "created" || !runningResult.run) {
  console.error(`Admin running create failed: ${JSON.stringify(runningResult)}`);
  process.exit(1);
}

createdRunIds.push(runningResult.run.id);

if (runningResult.run.status !== "running") {
  console.error("Created running run has wrong status.");
  process.exit(1);
}

if (runningResult.run.completedAt !== null) {
  console.error("Created running run must have null completed_at.");
  process.exit(1);
}

const supabase = getSupabaseClient();
const { error: invalidStatusError } = await supabase.rpc("create_automation_run", {
  p_status: "bogus",
  p_summary: {},
});

if (!invalidStatusError) {
  console.error("Invalid automation run status should be rejected.");
  process.exit(1);
}

const listStore = new CloudAutomationStore();
const listResult = await listStore.loadAutomationRuns();

if (!listResult.ok) {
  console.error(`Admin list after create failed: ${listResult.error?.message}`);
  process.exit(1);
}

const listedRuns = listStore.getAutomationRuns();
const listedCompleted = listedRuns.find((entry) => entry.id === completedResult.run.id);
const listedRunning = listedRuns.find((entry) => entry.id === runningResult.run.id);

if (!listedCompleted || !listedRunning) {
  console.error("Created runs missing from get_automation_runs.");
  process.exit(1);
}

const singleResult = await listStore.loadAutomationRun(completedResult.run.id);

if (!singleResult.ok || !singleResult.run || singleResult.run.status !== "completed") {
  console.error(`get_automation_run failed for created run: ${JSON.stringify(singleResult)}`);
  process.exit(1);
}

const policiesAfterAdmin = await countAutomationPolicies();

if (policiesAfterAdmin !== policiesBefore) {
  console.error("automation_policies count changed during run create smoke (no execution expected).");
  process.exit(1);
}

await signOut();

// --- Editor: create denied ---
await signInAs(editorEmail);

const editorStore = new CloudAutomationStore();
const editorAttempt = await editorStore.createAutomationRun({ status: "completed", summary: {} });

if (editorAttempt.ok) {
  console.error("Editor createAutomationRun should not succeed.");
  process.exit(1);
}

const { error: editorRpcError } = await getSupabaseClient().rpc("create_automation_run", {
  p_status: "completed",
  p_summary: {},
});

if (!editorRpcError) {
  console.error("Editor create_automation_run RPC should not succeed.");
  process.exit(1);
}

await signOut();

// --- Viewer: create denied ---
await signInAs(viewerEmail);

const viewerStore = new CloudAutomationStore();
const viewerAttempt = await viewerStore.createAutomationRun({ status: "completed", summary: {} });

if (viewerAttempt.ok) {
  console.error("Viewer createAutomationRun should not succeed.");
  process.exit(1);
}

const { error: viewerRpcError } = await getSupabaseClient().rpc("create_automation_run", {
  p_status: "completed",
  p_summary: {},
});

if (!viewerRpcError) {
  console.error("Viewer create_automation_run RPC should not succeed.");
  process.exit(1);
}

await signOut();

const runsAfter = await countAutomationRuns();

if (runsAfter !== runsBefore + createdRunIds.length) {
  console.error("Unexpected automation_runs count after create smoke.");
  process.exit(1);
}

await deleteCreatedRuns();

const runsAfterCleanup = await countAutomationRuns();

if (runsAfterCleanup !== runsBefore) {
  console.error("Created automation runs were not cleaned up.");
  process.exit(1);
}

console.log("Cloud smoke: OK");
console.log("  Admin: create completed + running runs");
console.log("  Admin: invalid status rejected");
console.log("  Admin: created runs readable via get_automation_runs / get_automation_run");
console.log("  Editor: create denied");
console.log("  Viewer: create denied");
console.log("  automation_policies count unchanged (no policy execution)");
console.log("  canMutateData() remains false in cloud");
console.log("\nV5-0 Phase 4 automation run creation RPC: OK");
