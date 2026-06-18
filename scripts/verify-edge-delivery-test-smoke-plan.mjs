/**
 * V6 Phase 41: Edge Function test-mode deployment smoke test plan verification.
 * Validates smoke test documentation, preflight commands, manual checklist completeness,
 * UI summary wiring for attempted/delivered/failed/skipped, and runs preflight automated gates.
 * No live Supabase deploy, Resend calls, or delivery log writes.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const docPath = join(root, "docs", "v6-edge-delivery-test-deployment.md");
const edgeDeliveryDocPath = join(root, "docs", "v6-edge-delivery-function.md");
const deliveryArchDocPath = join(root, "docs", "v6-delivery-architecture.md");
const roadmapPath = join(root, "ROADMAP.md");
const v5DocPath = join(root, "docs", "v5-automated-compliance-operations.md");
const indexHtmlPath = join(root, "index.html");
const appJsPath = join(root, "app.js");
const manualDeliveryUiPath = join(root, "js/app/automation/manual-delivery-ui.js");
const packageJsonPath = join(root, "package.json");

/** @type {readonly string[]} */
const REQUIRED_SECRET_NAMES = [
  "RESEND_API_KEY",
  "EMAIL_MODE=test",
  "EMAIL_FROM_ADDRESS",
  "EMAIL_REPLY_TO_ADDRESS",
  "EMAIL_TEST_REDIRECT_TO",
  "EMAIL_RATE_LIMIT_PER_RUN",
];

/** @type {readonly string[]} */
const MANUAL_SMOKE_CHECKS = [
  "backend=cloud&cloudWrites=1",
  "sign in as admin",
  "Manual Delivery Test",
  "functions/v1/send-reminder-deliveries",
  "EMAIL_TEST_REDIRECT_TO",
  "[TEST]",
  "attempted",
  "delivered",
  "failed",
  "skipped",
  "delivery logs unchanged",
  "compliance/history unchanged",
  "no reminders marked sent",
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
    console.error(`\nverify-edge-delivery-test-smoke-plan failed at: ${script}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log(
  "V6 Phase 41 Edge Function test-mode deployment smoke plan (verify-edge-delivery-test-smoke-plan)\n",
);

console.log("--- documentation checks ---");

assert(existsSync(docPath), "docs/v6-edge-delivery-test-deployment.md exists");

const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const packageJson = readFileSync(packageJsonPath, "utf8");
const edgeDeliveryDoc = readFileSync(edgeDeliveryDocPath, "utf8");
const deliveryArchDoc = readFileSync(deliveryArchDocPath, "utf8");
const roadmap = readFileSync(roadmapPath, "utf8");
const v5Doc = readFileSync(v5DocPath, "utf8");
const indexHtml = readFileSync(indexHtmlPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const manualDeliveryUiJs = readFileSync(manualDeliveryUiPath, "utf8");

assertContains(
  packageJson,
  '"verify-edge-delivery-test-smoke-plan"',
  "package.json verify-edge-delivery-test-smoke-plan script",
);
assertContains(
  packageJson,
  '"verify-edge-delivery-test-deployment"',
  "package.json verify-edge-delivery-test-deployment script",
);
assertContains(doc, "## Phase 41 — Manual smoke test checklist", "Phase 41 manual smoke checklist section");
assertContains(doc, "## Preflight commands", "preflight commands section");
assertContains(doc, "npm run build", "document lists npm run build preflight");
assertContains(
  doc,
  "npm run verify-edge-delivery-test-deployment",
  "document lists verify-edge-delivery-test-deployment preflight",
);
assertContains(
  doc,
  "npm run verify-edge-delivery-test-smoke-plan",
  "document lists verify-edge-delivery-test-smoke-plan acceptance",
);
assertContains(doc, "## Required Supabase Edge Function secrets", "secret checklist section");
assertContains(doc, "supabase secrets set", "document includes secrets set command");
assertContains(doc, "supabase secrets list", "document includes secrets list command");
assertContains(
  doc,
  "supabase functions deploy send-reminder-deliveries",
  "document includes deploy command",
);
assertContains(doc, "EMAIL_MODE=test", "document requires EMAIL_MODE=test only");
assertContains(doc, "## What to check in Supabase", "Supabase dashboard checks section");
assertContains(doc, "## What to check in email inbox", "email inbox checks section");
assertContains(doc, "## Acceptance commands", "acceptance commands section");
assertContains(doc, "No delivery log writes", "document states no delivery log writes");
assertContains(doc, "No mark-as-sent", "document states no mark-as-sent");
assertContains(doc, "reminder_delivery_logs", "document checks delivery log table unchanged");

for (const secretName of REQUIRED_SECRET_NAMES) {
  assertContains(doc, secretName, `document lists secret ${secretName}`);
}

for (const check of MANUAL_SMOKE_CHECKS) {
  assertContains(doc, check, `manual smoke checklist documents ${check}`);
}

assertContains(
  edgeDeliveryDoc,
  "## Phase 41 — Test-mode deployment smoke test",
  "edge delivery doc has Phase 41 section",
);
assertContains(
  deliveryArchDoc,
  "## Phase 41 — Test-mode deployment smoke test",
  "delivery architecture doc has Phase 41 section",
);
assertContains(roadmap, "V6 Phase 41", "ROADMAP.md references V6 Phase 41");
assertContains(v5Doc, "Phase 41", "v5 automated compliance operations doc references Phase 41");
assertContains(
  v5Doc,
  "verify-edge-delivery-test-smoke-plan",
  "v5 doc references verify-edge-delivery-test-smoke-plan",
);

console.log("--- UI smoke summary wiring ---");

assertContains(indexHtml, 'id="manual-delivery-test-result-skipped"', "index.html skipped result field");
assertContains(indexHtml, ">Skipped<", "index.html skipped label");
assertNotContains(
  indexHtml,
  'id="manual-delivery-test-result-persisted"',
  "index.html must not use persisted result field for Phase 41 smoke UI",
);
assertContains(appJs, "manualDeliveryTestResultSkipped", "app.js wires skipped result element");
assertContains(manualDeliveryUiJs, "skipped", "manual-delivery-ui.js exposes skipped in result summary");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("documentation and static checks: OK\n");

runNpmScript("build");
runNpmScript("verify-edge-delivery-test-deployment");

console.log("verify-edge-delivery-test-smoke-plan: all checks OK");
console.log("  preflight: build + verify-edge-delivery-test-deployment passed");
console.log("  manual: run Phase 41 checklist in docs/v6-edge-delivery-test-deployment.md after deploy");
console.log("  secrets: EMAIL_MODE=test only — deploy send-reminder-deliveries to staging");
