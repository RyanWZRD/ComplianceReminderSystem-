/**
 * V6 Phase 68: Production go-live preparation verification gate.
 * Static checks for go-live documentation, Phase 67 staging references, and
 * verification-only scope — no runtime delivery code changes in this phase.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const goLiveDocPath = join(root, "docs", "v6-production-go-live.md");
const productionReadinessDocPath = join(root, "docs", "v6-production-readiness.md");
const roadmapPath = join(root, "ROADMAP.md");
const packageJsonPath = join(root, "package.json");

/** @type {readonly string[]} */
const PHASE_67_STAGING_GATES = [
  "verify-scheduled-runner-controlled-live-send-staging",
  "verify-scheduled-runner-mark-sent-after-delivery-staging",
  "verify-scheduled-runner-duplicate-prevention-staging",
  "verify-scheduled-runner-failure-handling-staging",
  "verify-automation-visibility-cloud-load",
];

/** Runtime delivery sources — Phase 68 must not modify these. */
/** @type {readonly string[]} */
const RUNTIME_DELIVERY_PATHS = [
  "supabase/functions/scheduled-reminder-runner/index.ts",
  "supabase/functions/_shared/email-provider.ts",
  "supabase/functions/send-test-email/index.ts",
  "supabase/functions/send-reminder-deliveries/index.ts",
  "js/data/email.js",
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

/**
 * @returns {readonly string[]}
 */
function collectGitChangedPaths() {
  const result = spawnSync("git", ["diff", "--name-only", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });

  const unstaged = (result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const stagedResult = spawnSync("git", ["diff", "--name-only", "--cached", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });

  const staged = (stagedResult.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return [...new Set([...unstaged, ...staged])];
}

console.log(
  "V6 Phase 68 production go-live preparation verification (verify-v6-production-go-live-readiness)\n",
);

console.log("--- A. Go-live documentation exists ---");

assert(existsSync(goLiveDocPath), "docs/v6-production-go-live.md exists");

const goLiveDoc = readFileSync(goLiveDocPath, "utf8");

assertContains(goLiveDoc, "# V6 Production Go-Live Preparation", "go-live doc title");
assertContains(goLiveDoc, "verification only", "go-live doc states verification only");
assertContains(
  goLiveDoc,
  "no runtime sending behaviour",
  "go-live doc states no runtime sending behaviour changes",
);
assertContains(
  goLiveDoc,
  "npm run verify-v6-production-go-live-readiness",
  "go-live doc references verify command",
);

console.log("--- B. Required production secrets and safe defaults ---");

for (const secret of [
  "EMAIL_SENDING_ENABLED",
  "SCHEDULED_EMAIL_SENDING_ENABLED",
  "SCHEDULED_EMAIL_ALLOWLIST",
  "EMAIL_FROM_ADDRESS",
  "RESEND_API_KEY",
  "SCHEDULED_EMAIL_PREVIEW_ENABLED",
]) {
  assertContains(goLiveDoc, secret, `go-live doc documents ${secret}`);
}

assertContains(goLiveDoc, "Safe default", "go-live doc documents safe defaults");
assertContains(goLiveDoc, "`false`", "go-live doc documents false defaults for sending gates");

console.log("--- C. Sending gate behaviour and allowlist transition ---");

assertContains(
  goLiveDoc,
  "SCHEDULED_EMAIL_SENDING_ENABLED",
  "go-live doc explains SCHEDULED_EMAIL_SENDING_ENABLED behaviour",
);
assertContains(goLiveDoc, "EMAIL_SENDING_ENABLED", "go-live doc explains EMAIL_SENDING_ENABLED behaviour");
assertContains(
  goLiveDoc,
  "allowlist transition",
  "go-live doc includes allowlist transition plan",
);
assertContains(goLiveDoc, "not_allowlisted", "go-live doc documents not_allowlisted skip reason");

console.log("--- D. Resend and sender domain checks ---");

assertContains(goLiveDoc, "RESEND_API_KEY", "go-live doc covers RESEND_API_KEY checks");
assertContains(goLiveDoc, "verified", "go-live doc covers domain/sender verification");
assertContains(goLiveDoc, "EMAIL_FROM_ADDRESS", "go-live doc covers EMAIL_FROM_ADDRESS checks");

console.log("--- E. First live-send checklist ---");

assertContains(goLiveDoc, "First live-send checklist", "go-live doc includes first live-send checklist");
assertContains(goLiveDoc, "dry_run", "go-live doc includes dry_run pre-check");

console.log("--- F. Rollback and emergency disable ---");

assertContains(goLiveDoc, "Rollback instructions", "go-live doc includes rollback section");
assertContains(
  goLiveDoc,
  "SCHEDULED_EMAIL_SENDING_ENABLED=false",
  "rollback references SCHEDULED_EMAIL_SENDING_ENABLED=false",
);
assertContains(goLiveDoc, "EMAIL_SENDING_ENABLED=false", "rollback references EMAIL_SENDING_ENABLED=false");
assertContains(goLiveDoc, "Emergency disable", "go-live doc includes emergency disable section");
assertContains(
  goLiveDoc,
  "Immediately",
  "emergency disable includes immediate action steps",
);

console.log("--- G. Phase 67 acceptance evidence ---");

assertContains(goLiveDoc, "Phase 67", "go-live doc references Phase 67");
assertContains(goLiveDoc, "Staging fixture isolation", "go-live doc references staging fixture isolation");
assertContains(goLiveDoc, "Phase 62 Test Person", "go-live doc documents unique Phase 62 fixture");

for (const gate of PHASE_67_STAGING_GATES) {
  assertContains(goLiveDoc, gate, `go-live doc references Phase 67 staging gate ${gate}`);
}

console.log("--- H. Known limitations ---");

const knownLimitations = [
  "no automatic retries",
  "allowlist",
  "read-only",
  "no retry UI",
];

for (const phrase of knownLimitations) {
  assert(
    goLiveDoc.toLowerCase().includes(phrase.toLowerCase()),
    `go-live doc documents limitation: ${phrase}`,
  );
}

console.log("--- I. Package script and cross-links ---");

const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(
  packageJson,
  '"verify-v6-production-go-live-readiness"',
  "package.json verify-v6-production-go-live-readiness script",
);

assert(existsSync(productionReadinessDocPath), "docs/v6-production-readiness.md exists");

const productionReadinessDoc = readFileSync(productionReadinessDocPath, "utf8");

assertContains(
  productionReadinessDoc,
  "v6-production-go-live.md",
  "v6-production-readiness.md cross-links go-live doc",
);
assertContains(
  productionReadinessDoc,
  "verify-v6-production-go-live-readiness",
  "v6-production-readiness.md references go-live verify command",
);

console.log("--- J. ROADMAP Phase 67 complete and Phase 68 current ---");

const roadmap = readFileSync(roadmapPath, "utf8");

assertContains(roadmap, "Phase 67", "ROADMAP.md documents Phase 67");
assertContains(roadmap, "Phase 68", "ROADMAP.md documents Phase 68");
assertContains(roadmap, "verification only", "ROADMAP.md states Phase 68 is verification only");

const currentReleaseIndex = roadmap.indexOf("# Current Release");
const phase67Index = roadmap.indexOf("Phase 67", currentReleaseIndex);
const phase68Index = roadmap.indexOf("Phase 68", currentReleaseIndex);

assert(currentReleaseIndex !== -1, "ROADMAP.md has Current Release section");
assert(phase67Index !== -1, "ROADMAP.md lists Phase 67 in Current Release");
assert(phase68Index !== -1, "ROADMAP.md lists Phase 68 in Current Release");
assert(
  phase68Index < phase67Index,
  "ROADMAP.md lists Phase 68 before Phase 67 under Current Release (Phase 68 is current)",
);

console.log("--- K. No runtime delivery code changed (Phase 68 scope) ---");

const changedPaths = collectGitChangedPaths();
const touchedRuntimeDelivery = changedPaths.filter((changed) =>
  RUNTIME_DELIVERY_PATHS.some(
    (runtimePath) => changed === runtimePath || changed.replace(/\\/g, "/") === runtimePath,
  ),
);

if (touchedRuntimeDelivery.length > 0) {
  for (const path of touchedRuntimeDelivery) {
    fail(`runtime delivery code must not change in Phase 68: ${path}`);
  }
} else {
  console.log("  runtime delivery paths unchanged in working tree");
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("\nV6 production go-live preparation verification: OK");
console.log("  Verification only — no runtime sending behaviour changes.");
console.log(`  Phase 67 staging gates documented: ${PHASE_67_STAGING_GATES.join(", ")}`);
console.log("  Operator runbook: docs/v6-production-go-live.md");
