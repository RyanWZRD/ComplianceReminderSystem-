/**
 * V6.1 Phase 1: Beta validation checklist verification.
 * Validates docs/v6-beta-validation.md is complete, maps all required test areas,
 * and runs automated verification scripts — no feature code changes required.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const docPath = join(root, "docs", "v6-beta-validation.md");
const packageJsonPath = join(root, "package.json");

/** @type {readonly { id: string; heading: string; requiredPhrases: readonly string[]; scripts: readonly string[] }[]} */
const TEST_AREAS = [
  {
    id: "1",
    heading: "## 1. Queue generation",
    requiredPhrases: [
      "reminder queue preview count",
      "verify-reminder-queue",
      "EXPECTED_REMINDER_QUEUE_SUMMARY",
    ],
    scripts: ["verify-reminder-queue", "verify-reminder-queue-ui"],
  },
  {
    id: "2",
    heading: "## 2. Template generation",
    requiredPhrases: [
      "preview template content",
      "digest content",
      "verify-reminder-template-builder",
      "verify-reminder-digest-builder",
    ],
    scripts: [
      "verify-reminder-template-builder",
      "verify-reminder-template-preview",
      "verify-reminder-digest-builder",
      "verify-reminder-digest-preview-ui",
    ],
  },
  {
    id: "3",
    heading: "## 3. Manual delivery UI",
    requiredPhrases: [
      "visible only for admin",
      "hidden for editor/viewer",
      "disabled when provider disabled",
      "verify-manual-delivery-ui",
    ],
    scripts: ["verify-manual-delivery-ui"],
  },
  {
    id: "4",
    heading: "## 4. Test-mode delivery",
    requiredPhrases: [
      "provider mode = test",
      "recipient redirected",
      "[TEST] subject prefix",
      "verify-resend-provider",
    ],
    scripts: ["verify-resend-provider"],
  },
  {
    id: "5",
    heading: "## 5. Real Resend send",
    requiredPhrases: [
      "successful delivery path",
      "delivery log created",
      "operations log updated",
      "verify-manual-delivery-runner",
    ],
    scripts: [
      "verify-manual-delivery-runner",
      "verify-manual-delivery-foundation",
      "verify-delivery-log-persistence-service",
      "verify-delivery-operations-log-ui",
    ],
  },
  {
    id: "6",
    heading: "## 6. Missing email",
    requiredPhrases: [
      "missing_recipient_email",
      "no crash",
      "verify-reminder-delivery-record-builder",
    ],
    scripts: ["verify-reminder-delivery-record-builder", "verify-manual-delivery-runner"],
  },
  {
    id: "7",
    heading: "## 7. Invalid email",
    requiredPhrases: [
      "failure recorded",
      "operations log",
      "verify-resend-provider",
    ],
    scripts: ["verify-resend-provider"],
  },
  {
    id: "8",
    heading: "## 8. CSV export",
    requiredPhrases: [
      "delivery logs export",
      "verify-delivery-operations-log-ui",
    ],
    scripts: ["verify-delivery-operations-log-ui"],
  },
  {
    id: "9",
    heading: "## 9. Permission checks",
    requiredPhrases: [
      "editor cannot run delivery",
      "viewer cannot run delivery",
      "canRunManualDeliveryTest",
    ],
    scripts: ["verify-manual-delivery-ui", "verify-manual-delivery-e2e-foundation"],
  },
  {
    id: "10",
    heading: "## 10. Safety checks",
    requiredPhrases: [
      "no compliance records changed",
      "no history entries created",
      "no reminders auto-marked sent",
      "verify-manual-delivery-e2e-foundation",
    ],
    scripts: ["verify-manual-delivery-e2e-foundation", "verify-manual-delivery-runner"],
  },
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

function assertContainsIgnoreCase(source, needle, label) {
  if (!source.toLowerCase().includes(needle.toLowerCase())) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

console.log(
  "V6.1 Phase 1 beta validation checklist verification (verify-beta-validation-checklist)\n"
);

console.log("--- documentation checks ---");

assert(existsSync(docPath), "docs/v6-beta-validation.md exists");

const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(packageJson, '"verify-beta-validation-checklist"', "package.json verify script");
assertContains(doc, "# V6.1 Phase 1 — Beta Validation Checklist", "document title");
assertContains(doc, "No new features", "document states no new features");
assertContains(doc, "No schema changes", "document states no schema changes");
assertContains(doc, "No RPC changes", "document states no RPC changes");
assertContains(doc, "npm run verify-beta-validation-checklist", "document references verify command");
assertContainsIgnoreCase(doc, "no feature code changes required", "document states no feature code changes required");

for (const area of TEST_AREAS) {
  assertContains(doc, area.heading, `test area ${area.id} heading`);

  for (const phrase of area.requiredPhrases) {
    assertContainsIgnoreCase(doc, phrase, `test area ${area.id} documents ${phrase}`);
  }

  for (const script of area.scripts) {
    assertContains(doc, script, `test area ${area.id} references ${script}`);
  }
}

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log(`documentation checks: OK (${TEST_AREAS.length} test areas documented)\n`);

/** @type {readonly string[]} */
const uniqueScripts = [...new Set(TEST_AREAS.flatMap((area) => area.scripts))];

for (const script of uniqueScripts) {
  console.log(`--- ${script} ---`);

  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-beta-validation-checklist failed at: ${script}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V6.1 beta validation checklist verification: OK");
console.log("  No feature code changes required for this phase.");
