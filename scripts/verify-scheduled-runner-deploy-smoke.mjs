/**
 * V6 Phase 46: Scheduled runner staging deploy smoke test plan verification.
 * Validates deploy/smoke documentation, dry-run response contract, safety gates,
 * and runs preflight automated gates. No live Supabase deploy or email sends.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const STAGING_PROJECT_REF = "vmrotpztwoeifbdjwdis";

const scheduledRunnerDocPath = join(root, "docs", "v6-scheduled-runner.md");
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const v5DocPath = join(root, "docs", "v5-automated-compliance-operations.md");
const roadmapPath = join(root, "ROADMAP.md");
const functionPath = join(
  root,
  "supabase",
  "functions",
  "scheduled-reminder-runner",
  "index.ts",
);
const packageJsonPath = join(root, "package.json");

/** @type {readonly string[]} */
const REQUIRED_RESPONSE_FIELDS = [
  '"status": "ok"',
  '"mode": "dry_run"',
  "summary.totalCandidates",
  "summary.withEmail",
  "summary.missingEmail",
  "summary.wouldSend",
  "summary.wouldSkip",
];

/** @type {readonly string[]} */
const MANUAL_SMOKE_CHECKS = [
  "functions/v1/scheduled-reminder-runner",
  "Authorization: Bearer",
  "organisationId",
  "reminder_delivery_logs",
  "No Resend",
  "No `send-reminder-deliveries`",
  "No mark-as-sent",
  "No cron schedule",
  "No compliance/history mutation",
];

/** @type {readonly string[]} */
const FORBIDDEN_FUNCTION_NEEDLES = [
  "api.resend.com",
  "RESEND_API_KEY",
  "send-reminder-deliveries",
  "create_reminder_delivery_log",
  "mark_reminder_sent",
  "automation_runs",
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

function runNpmScript(script) {
  console.log(`--- ${script} ---`);

  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-scheduled-runner-deploy-smoke failed at: ${script}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log(
  "V6 Phase 46 scheduled runner deploy smoke plan (verify-scheduled-runner-deploy-smoke)\n",
);

console.log("--- documentation checks ---");

assert(existsSync(scheduledRunnerDocPath), "docs/v6-scheduled-runner.md exists");
assert(existsSync(functionPath), "supabase/functions/scheduled-reminder-runner/index.ts exists");

const scheduledRunnerDoc = readFileSync(scheduledRunnerDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const v5Doc = readFileSync(v5DocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");
const functionSource = readFileSync(functionPath, "utf8");

assertContains(
  packageJson,
  '"verify-scheduled-runner-deploy-smoke"',
  "package.json verify-scheduled-runner-deploy-smoke script",
);
assertContains(
  packageJson,
  '"verify-scheduled-runner-dry-run"',
  "package.json verify-scheduled-runner-dry-run script",
);

assertContains(
  scheduledRunnerDoc,
  "## Phase 46 — Deploy and smoke-test dry run",
  "scheduled runner doc has Phase 46 section",
);
assertContains(
  scheduledRunnerDoc,
  `supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
  "scheduled runner doc has exact staging deploy command",
);
assertContains(scheduledRunnerDoc, "## Preflight commands", "scheduled runner doc has preflight commands");
assertContains(scheduledRunnerDoc, "npm run build", "document lists npm run build preflight");
assertContains(
  scheduledRunnerDoc,
  "npm run verify-scheduled-runner-dry-run",
  "document lists verify-scheduled-runner-dry-run preflight",
);
assertContains(
  scheduledRunnerDoc,
  "npm run verify-scheduled-runner-deploy-smoke",
  "document lists verify-scheduled-runner-deploy-smoke acceptance",
);
assertContains(
  scheduledRunnerDoc,
  "## Manual invocation",
  "scheduled runner doc has manual invocation section",
);
assertContains(
  scheduledRunnerDoc,
  "Supabase Dashboard",
  "scheduled runner doc documents Dashboard invocation",
);
assertContains(
  scheduledRunnerDoc,
  "Invoke-RestMethod",
  "scheduled runner doc documents PowerShell invocation",
);
assertContains(
  scheduledRunnerDoc,
  "## Expected dry-run response",
  "scheduled runner doc documents expected response",
);
assertContains(
  scheduledRunnerDoc,
  "## What to check in Supabase",
  "scheduled runner doc has Supabase dashboard checks",
);
assertContains(
  scheduledRunnerDoc,
  "## Acceptance commands",
  "scheduled runner doc has acceptance commands",
);
assertContains(
  scheduledRunnerDoc,
  "No cron schedule",
  "document states no cron schedule",
);
assertContains(
  scheduledRunnerDoc,
  "No delivery log writes",
  "document states no delivery log writes",
);
assertContains(
  scheduledRunnerDoc,
  "No mark-as-sent",
  "document states no mark-as-sent",
);
assertContains(
  scheduledRunnerDoc,
  "No Resend",
  "document states no Resend calls",
);

for (const field of REQUIRED_RESPONSE_FIELDS) {
  assertContains(scheduledRunnerDoc, field, `document describes response field ${field}`);
}

for (const check of MANUAL_SMOKE_CHECKS) {
  assertContains(scheduledRunnerDoc, check, `manual smoke checklist documents ${check}`);
}

assertContains(
  deliveryArchDoc,
  "## Phase 46 — Deploy and smoke-test scheduled runner dry run",
  "delivery architecture doc has Phase 46 section",
);
assertContains(
  deliveryArchDoc,
  "verify-scheduled-runner-deploy-smoke",
  "delivery architecture doc references deploy smoke script",
);
assertContains(roadmap, "V6 Phase 46", "ROADMAP.md references V6 Phase 46");
assertContains(v5Doc, "Phase 46", "v5 automated compliance operations doc references Phase 46");
assertContains(
  v5Doc,
  "verify-scheduled-runner-deploy-smoke",
  "v5 doc references verify-scheduled-runner-deploy-smoke",
);

console.log("--- static safety gates (scheduled-reminder-runner) ---");

for (const needle of FORBIDDEN_FUNCTION_NEEDLES) {
  assertNotContains(
    functionSource,
    needle,
    `scheduled-reminder-runner/index.ts has no ${needle}`,
  );
}

assertContains(functionSource, 'mode: SCHEDULED_RUNNER_DRY_RUN_MODE', "index.ts returns dry_run mode");
assertContains(functionSource, "totalCandidates", "index.ts returns totalCandidates");
assertContains(functionSource, "wouldSend", "index.ts returns wouldSend");
assertContains(functionSource, "wouldSkip", "index.ts returns wouldSkip");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("documentation and static checks: OK\n");

runNpmScript("build");
runNpmScript("verify-scheduled-runner-dry-run");

console.log("verify-scheduled-runner-deploy-smoke: all checks OK");
console.log("  preflight: build + verify-scheduled-runner-dry-run passed");
console.log(
  `  manual: deploy with supabase functions deploy scheduled-reminder-runner --project-ref ${STAGING_PROJECT_REF}`,
);
console.log("  invoke: dry_run only — summary counts, no emails or writes");
