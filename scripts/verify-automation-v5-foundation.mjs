/**
 * V5-0 Phase 8 Automation Foundation Verification Orchestrator.
 * Runs all V5-0 automation foundation verification scripts in order.
 * Verification-only — no reminder/action/email execution.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-automation-foundation", script: "verify-automation-foundation" },
  { label: "verify-automation-policies", script: "verify-automation-policies" },
  { label: "verify-automation-runs", script: "verify-automation-runs" },
  { label: "verify-automation-run-create", script: "verify-automation-run-create" },
  { label: "verify-automation-dry-run", script: "verify-automation-dry-run" },
  { label: "verify-automation-dry-run-logging", script: "verify-automation-dry-run-logging" },
  { label: "verify-automation-run-ui", script: "verify-automation-run-ui" },
];

console.log(
  "V5-0 Phase 8 automation foundation verification orchestrator (verify-automation-v5-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-automation-v5-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V5-0 automation foundation verification: OK");
