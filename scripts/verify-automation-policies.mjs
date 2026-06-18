/**
 * V5-0 Phase 2: Automation Policy Admin RPCs.
 * Static checks plus cloud smoke for get_automation_policies / upsert_automation_policy.
 * No UI, Edge Functions, cron, queue processing, email delivery, or automation execution.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

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

console.log("V5-0 Phase 2 automation policy admin RPC verification (verify-automation-policies)\n");

const rpcMigration = readMigration("20260401000003_automation_policy_admin_rpcs.sql");

assertContains(
  rpcMigration,
  "create or replace function public.get_automation_policies",
  "get_automation_policies RPC"
);
assertContains(
  rpcMigration,
  "create or replace function public.upsert_automation_policy",
  "upsert_automation_policy RPC"
);
assertContains(rpcMigration, "policy_type text", "automation_policies.policy_type column");
assertContains(rpcMigration, "policy_type in ('reminder_digest', 'action_orchestration', 'escalation')", "policy_type check constraint");
assertContains(
  rpcMigration,
  "has_org_role(array['admin', 'editor'])",
  "get_automation_policies admin+editor read"
);
assertContains(
  rpcMigration,
  "current_user_role() <> 'admin'",
  "upsert_automation_policy admin-only write"
);
assertNotContains(rpcMigration, "automation_runs", "Phase 2 RPC migration does not touch automation_runs");
assertNotContains(rpcMigration, "notification_queue", "Phase 2 RPC migration has no notification_queue");
assertNotContains(rpcMigration, "delivery_log", "Phase 2 RPC migration has no delivery_log");

const cloudAutomationStoreJs = readFileSync(
  join(root, "js", "data", "cloud-automation-store.js"),
  "utf8"
);
assertContains(cloudAutomationStoreJs, "loadPolicies", "CloudAutomationStore.loadPolicies");
assertContains(
  cloudAutomationStoreJs,
  "upsertAutomationPolicy",
  "CloudAutomationStore.upsertAutomationPolicy"
);
assertContains(
  cloudAutomationStoreJs,
  'rpc("get_automation_policies")',
  "CloudAutomationStore uses get_automation_policies RPC"
);
assertContains(
  cloudAutomationStoreJs,
  'rpc("upsert_automation_policy"',
  "CloudAutomationStore uses upsert_automation_policy RPC"
);

const automationPoliciesJs = readFileSync(join(root, "js", "data", "automation-policies.js"), "utf8");
assertContains(automationPoliciesJs, "reminder_digest", "automation-policies reminder_digest type");
assertContains(automationPoliciesJs, "action_orchestration", "automation-policies action_orchestration type");
assertContains(automationPoliciesJs, "escalation", "automation-policies escalation type");
assertContains(automationPoliciesJs, "mapAutomationPolicyToRpc", "automation-policies RPC mapper");
assertContains(automationPoliciesJs, "mapAutomationPolicyFromRpc", "automation-policies RPC response mapper");

const repositoryJs = readFileSync(join(root, "js", "data", "repository.js"), "utf8");
assertContains(repositoryJs, "automationRepository", "repository exports automationRepository");
assertContains(repositoryJs, "CloudAutomationStore", "repository imports CloudAutomationStore");

const permissionsJs = readFileSync(join(root, "js", "app", "permissions.js"), "utf8");
assertContains(permissionsJs, "canReadAutomationPolicies", "permissions canReadAutomationPolicies");
assertContains(permissionsJs, "canMutateAutomationPolicies", "permissions canMutateAutomationPolicies");

const appJs = readFileSync(join(root, "app.js"), "utf8");
const forbiddenExecutionNeedles = [
  "daily_compliance_scan",
  "process_notification_queue",
  "apply_automation_policies",
  "enqueue_reminder_notifications",
  "list_automation_runs",
  "notification_queue",
  "delivery_log",
  "AUTOMATION_ENABLED",
];

for (const needle of forbiddenExecutionNeedles) {
  assertNotContains(appJs, needle, `app.js has no ${needle}`);
}

if (failures.length > 0) {
  console.error("FAIL verify-automation-policies (static):");
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

process.env.DATA_BACKEND = "cloud";
process.env.AUTH_MODE = "supabase";
process.env.CLOUD_WRITES_ENABLED = "true";

const { signInWithPassword, signOut } = await import("../js/auth/session.js");
const { CloudAutomationStore } = await import("../js/data/cloud-automation-store.js");
const {
  canMutateData,
  canReadAutomationPolicies,
  canMutateAutomationPolicies,
} = await import("../js/app/permissions.js");
const { getSupabaseClient } = await import("../js/data/supabase-client.js");

if (canMutateData()) {
  console.error("canMutateData() must stay false in cloud mode.");
  process.exit(1);
}

const testPolicyDocument = {
  version: 1,
  name: "Phase 2 smoke policy",
  schedule: {
    timezone: "Europe/London",
  },
};

async function countAutomationRuns() {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("automation_runs")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error(`automation_runs count failed: ${error.message}`);
    process.exit(1);
  }

  return count ?? 0;
}

async function signInAs(email) {
  const result = await signInWithPassword(email, password);

  if (!result.ok) {
    console.error(`Sign-in failed (${email}): ${result.error}`);
    process.exit(1);
  }
}

async function deleteSmokePolicies() {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("automation_policies")
    .delete()
    .in("policy_type", ["reminder_digest", "action_orchestration", "escalation"]);

  if (error) {
    console.error(`Cleanup automation policies failed: ${error.message}`);
    process.exit(1);
  }
}

// --- Admin: upsert all policy types + reload ---
await signInAs(adminEmail);

if (!canReadAutomationPolicies() || !canMutateAutomationPolicies()) {
  console.error("Admin must have automation policy read + mutate permissions.");
  process.exit(1);
}

const runsBefore = await countAutomationRuns();
await deleteSmokePolicies();

const adminStore = new CloudAutomationStore();
const emptyLoad = await adminStore.loadPolicies();

if (!emptyLoad.ok) {
  console.error(`Admin empty load failed: ${emptyLoad.error?.message}`);
  process.exit(1);
}

if (adminStore.getPolicies().length !== 0) {
  console.error("Expected zero automation policies before smoke upserts.");
  process.exit(1);
}

/** @type {import('../js/data/automation-policies.js').AutomationPolicyInput[]} */
const smokePolicies = [
  {
    policyType: "reminder_digest",
    policy: { ...testPolicyDocument, name: "Reminder digest smoke" },
    enabled: true,
    version: 1,
  },
  {
    policyType: "action_orchestration",
    policy: { ...testPolicyDocument, name: "Action orchestration smoke" },
    enabled: false,
    version: 1,
  },
  {
    policyType: "escalation",
    policy: { ...testPolicyDocument, name: "Escalation smoke" },
    enabled: false,
    version: 1,
  },
];

for (const input of smokePolicies) {
  const upsertResult = await adminStore.upsertAutomationPolicy(input);

  if (!upsertResult.ok || upsertResult.status !== "upserted") {
    console.error(`Admin upsert failed (${input.policyType}): ${JSON.stringify(upsertResult)}`);
    process.exit(1);
  }

  if (upsertResult.policy.policyType !== input.policyType) {
    console.error(`Upsert policy type mismatch for ${input.policyType}`);
    process.exit(1);
  }

  if (upsertResult.policy.policy?.type !== input.policyType) {
    console.error(`Policy document type not embedded for ${input.policyType}`);
    process.exit(1);
  }
}

const reloadStore = new CloudAutomationStore();
const reloadResult = await reloadStore.loadPolicies();

if (!reloadResult.ok) {
  console.error(`Admin reload failed: ${reloadResult.error?.message}`);
  process.exit(1);
}

const loadedPolicies = reloadStore.getPolicies();

if (loadedPolicies.length !== smokePolicies.length) {
  console.error(`Expected ${smokePolicies.length} policies after reload, got ${loadedPolicies.length}`);
  process.exit(1);
}

for (const input of smokePolicies) {
  const loaded = loadedPolicies.find((entry) => entry.policyType === input.policyType);

  if (!loaded) {
    console.error(`Missing loaded policy for ${input.policyType}`);
    process.exit(1);
  }

  if (loaded.enabled !== (input.enabled === true)) {
    console.error(`Enabled flag mismatch for ${input.policyType}`);
    process.exit(1);
  }
}

const runsAfter = await countAutomationRuns();

if (runsAfter !== runsBefore) {
  console.error("automation_runs count changed during policy admin smoke (no execution expected).");
  process.exit(1);
}

await deleteSmokePolicies();
await signOut();

// --- Editor: read allowed, upsert denied ---
await signInAs(editorEmail);

if (!canReadAutomationPolicies() || canMutateAutomationPolicies()) {
  console.error("Editor must have read-only automation policy permissions.");
  process.exit(1);
}

const editorStore = new CloudAutomationStore();
const editorLoad = await editorStore.loadPolicies();

if (!editorLoad.ok) {
  console.error(`Editor load failed: ${editorLoad.error?.message}`);
  process.exit(1);
}

const editorAttempt = await editorStore.upsertAutomationPolicy(smokePolicies[0]);

if (editorAttempt.ok) {
  console.error("Editor upsertAutomationPolicy should not succeed.");
  process.exit(1);
}

await signOut();

// --- Viewer: read and upsert denied ---
await signInAs(viewerEmail);

if (canReadAutomationPolicies() || canMutateAutomationPolicies()) {
  console.error("Viewer must not have automation policy permissions.");
  process.exit(1);
}

const viewerStore = new CloudAutomationStore();
const viewerLoad = await viewerStore.loadPolicies();

if (viewerLoad.ok) {
  console.error("Viewer loadPolicies should not succeed.");
  process.exit(1);
}

const viewerAttempt = await viewerStore.upsertAutomationPolicy(smokePolicies[0]);

if (viewerAttempt.ok) {
  console.error("Viewer upsertAutomationPolicy should not succeed.");
  process.exit(1);
}

await signOut();

console.log("Cloud smoke: OK");
console.log("  Admin: upsert + reload for reminder_digest, action_orchestration, escalation");
console.log("  Editor: read allowed, upsert denied");
console.log("  Viewer: read and upsert denied");
console.log("  automation_runs count unchanged (no execution)");
console.log("  canMutateData() remains false in cloud");
console.log("\nV5-0 Phase 2 automation policy admin RPCs: OK");
