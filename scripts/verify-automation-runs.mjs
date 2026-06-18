/**
 * V5-0 Phase 3: Automation Run Read RPCs.
 * Static checks plus cloud smoke for get_automation_runs / get_automation_run.
 * No UI, Edge Functions, cron, queue processing, email delivery, or automation execution.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

const ALPHA_ORG_ID = "11111111-1111-1111-1111-111111111111";
const SMOKE_RUN_OLDER_ID = "44444444-4444-4444-4444-444444444401";
const SMOKE_RUN_NEWER_ID = "44444444-4444-4444-4444-444444444402";

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

console.log("V5-0 Phase 3 automation run read RPC verification (verify-automation-runs)\n");

const rpcMigration = readMigration("20260401000004_automation_run_read_rpcs.sql");

assertContains(
  rpcMigration,
  "create or replace function public.get_automation_runs",
  "get_automation_runs RPC"
);
assertContains(
  rpcMigration,
  "create or replace function public.get_automation_run",
  "get_automation_run RPC"
);
assertContains(
  rpcMigration,
  "has_org_role(array['admin', 'editor'])",
  "automation run read admin+editor"
);
assertContains(rpcMigration, "order by ar.started_at desc", "get_automation_runs newest-first ordering");
assertNotContains(rpcMigration, "insert into public.automation_runs", "Phase 3 migration does not insert runs");
assertNotContains(rpcMigration, "notification_queue", "Phase 3 RPC migration has no notification_queue");
assertNotContains(rpcMigration, "delivery_log", "Phase 3 RPC migration has no delivery_log");

const cloudAutomationStoreJs = readFileSync(
  join(root, "js", "data", "cloud-automation-store.js"),
  "utf8"
);
assertContains(cloudAutomationStoreJs, "loadAutomationRuns", "CloudAutomationStore.loadAutomationRuns");
assertContains(cloudAutomationStoreJs, "loadAutomationRun", "CloudAutomationStore.loadAutomationRun");
assertContains(
  cloudAutomationStoreJs,
  'rpc("get_automation_runs")',
  "CloudAutomationStore uses get_automation_runs RPC"
);
assertContains(
  cloudAutomationStoreJs,
  'rpc("get_automation_run"',
  "CloudAutomationStore uses get_automation_run RPC"
);

const automationRunsJs = readFileSync(join(root, "js", "data", "automation-runs.js"), "utf8");
assertContains(automationRunsJs, "mapAutomationRunFromRpc", "automation-runs RPC response mapper");

const repositoryJs = readFileSync(join(root, "js", "data", "repository.js"), "utf8");
assertContains(repositoryJs, "automationRepository", "repository exports automationRepository");
assertContains(repositoryJs, "CloudAutomationStore", "repository imports CloudAutomationStore");

const permissionsJs = readFileSync(join(root, "js", "app", "permissions.js"), "utf8");
assertContains(permissionsJs, "canReadAutomationRuns", "permissions canReadAutomationRuns");

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

if (failures.length > 0) {
  console.error("FAIL verify-automation-runs (static):");
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
  console.error(".env must define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for run smoke seeding.");
  process.exit(1);
}

process.env.DATA_BACKEND = "cloud";
process.env.AUTH_MODE = "supabase";
process.env.CLOUD_WRITES_ENABLED = "true";

const { signInWithPassword, signOut } = await import("../js/auth/session.js");
const { CloudAutomationStore } = await import("../js/data/cloud-automation-store.js");
const { canMutateData, canReadAutomationRuns } = await import("../js/app/permissions.js");
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

async function deleteSmokeRuns() {
  const { error } = await serviceClient
    .from("automation_runs")
    .delete()
    .in("id", [SMOKE_RUN_OLDER_ID, SMOKE_RUN_NEWER_ID]);

  if (error) {
    console.error(`Cleanup automation runs failed: ${error.message}`);
    process.exit(1);
  }
}

async function seedSmokeRuns() {
  const { error } = await serviceClient.from("automation_runs").upsert(
    [
      {
        id: SMOKE_RUN_OLDER_ID,
        organisation_id: ALPHA_ORG_ID,
        started_at: "2026-03-01T10:00:00.000Z",
        completed_at: "2026-03-01T10:05:00.000Z",
        status: "completed",
        summary: { policiesApplied: 1, remindersQueued: 0 },
        error: null,
      },
      {
        id: SMOKE_RUN_NEWER_ID,
        organisation_id: ALPHA_ORG_ID,
        started_at: "2026-03-02T10:00:00.000Z",
        completed_at: null,
        status: "running",
        summary: {},
        error: null,
      },
    ],
    { onConflict: "id" }
  );

  if (error) {
    console.error(`Seed automation runs failed: ${error.message}`);
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

await deleteSmokeRuns();
const runsBefore = await countAutomationRuns();
await seedSmokeRuns();
const runsAfterSeed = await countAutomationRuns();

if (runsAfterSeed !== runsBefore + 2) {
  console.error("Expected two smoke automation runs after service-role seed.");
  process.exit(1);
}

// --- Admin: list + single run ---
await signInAs(adminEmail);

if (!canReadAutomationRuns()) {
  console.error("Admin must have automation run read permission.");
  process.exit(1);
}

const adminStore = new CloudAutomationStore();
const adminListResult = await adminStore.loadAutomationRuns();

if (!adminListResult.ok) {
  console.error(`Admin list failed: ${adminListResult.error?.message}`);
  process.exit(1);
}

const adminRuns = adminStore.getAutomationRuns();
const newerRun = adminRuns.find((entry) => entry.id === SMOKE_RUN_NEWER_ID);
const olderRun = adminRuns.find((entry) => entry.id === SMOKE_RUN_OLDER_ID);

if (!newerRun || !olderRun) {
  console.error("Admin list missing seeded automation runs.");
  process.exit(1);
}

const newerIndex = adminRuns.findIndex((entry) => entry.id === SMOKE_RUN_NEWER_ID);
const olderIndex = adminRuns.findIndex((entry) => entry.id === SMOKE_RUN_OLDER_ID);

if (newerIndex >= olderIndex) {
  console.error("get_automation_runs must return runs newest first.");
  process.exit(1);
}

const adminSingleResult = await adminStore.loadAutomationRun(SMOKE_RUN_NEWER_ID);

if (!adminSingleResult.ok || !adminSingleResult.run) {
  console.error(`Admin single run load failed: ${JSON.stringify(adminSingleResult)}`);
  process.exit(1);
}

if (adminSingleResult.run.status !== "running") {
  console.error("Admin single run status mismatch.");
  process.exit(1);
}

const runsAfterAdmin = await countAutomationRuns();

if (runsAfterAdmin !== runsAfterSeed) {
  console.error("automation_runs count changed during admin read smoke.");
  process.exit(1);
}

await signOut();

// --- Editor: list + single run ---
await signInAs(editorEmail);

if (!canReadAutomationRuns()) {
  console.error("Editor must have automation run read permission.");
  process.exit(1);
}

const editorStore = new CloudAutomationStore();
const editorListResult = await editorStore.loadAutomationRuns();

if (!editorListResult.ok) {
  console.error(`Editor list failed: ${editorListResult.error?.message}`);
  process.exit(1);
}

if (!editorStore.getAutomationRuns().some((entry) => entry.id === SMOKE_RUN_NEWER_ID)) {
  console.error("Editor list missing seeded automation run.");
  process.exit(1);
}

const editorSingleResult = await editorStore.loadAutomationRun(SMOKE_RUN_NEWER_ID);

if (!editorSingleResult.ok || !editorSingleResult.run) {
  console.error(`Editor single run load failed: ${JSON.stringify(editorSingleResult)}`);
  process.exit(1);
}

const runsAfterEditor = await countAutomationRuns();

if (runsAfterEditor !== runsAfterSeed) {
  console.error("automation_runs count changed during editor read smoke.");
  process.exit(1);
}

await signOut();

// --- Viewer: list and single denied ---
await signInAs(viewerEmail);

if (canReadAutomationRuns()) {
  console.error("Viewer must not have automation run read permission.");
  process.exit(1);
}

const viewerStore = new CloudAutomationStore();
const viewerListResult = await viewerStore.loadAutomationRuns();

if (viewerListResult.ok) {
  console.error("Viewer loadAutomationRuns should not succeed.");
  process.exit(1);
}

const supabase = getSupabaseClient();
const { error: viewerRpcError } = await supabase.rpc("get_automation_run", {
  p_run_id: SMOKE_RUN_NEWER_ID,
});

if (!viewerRpcError) {
  console.error("Viewer get_automation_run RPC should not succeed.");
  process.exit(1);
}

const runsAfterViewer = await countAutomationRuns();

if (runsAfterViewer !== runsAfterSeed) {
  console.error("automation_runs count changed during viewer denial smoke.");
  process.exit(1);
}

await signOut();
await deleteSmokeRuns();

const runsAfterCleanup = await countAutomationRuns();

if (runsAfterCleanup !== runsBefore) {
  console.error("Smoke automation runs were not cleaned up.");
  process.exit(1);
}

console.log("Cloud smoke: OK");
console.log("  Admin: list + single run read");
console.log("  Editor: list + single run read");
console.log("  Viewer: list and single run denied");
console.log("  automation_runs count unchanged during read RPC smoke (no execution)");
console.log("  canMutateData() remains false in cloud");
console.log("\nV5-0 Phase 3 automation run read RPCs: OK");
