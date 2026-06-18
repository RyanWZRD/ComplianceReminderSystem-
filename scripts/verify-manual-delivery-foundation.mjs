/**
 * V6 Phase 31: Manual delivery foundation verification orchestrator.
 * Runs delivery pipeline foundation and manual delivery runner verification in order.
 * Verification-only — no app behaviour changes, UI send button, scheduled execution,
 * or mark-as-sent automation.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-delivery-pipeline-foundation", script: "verify-delivery-pipeline-foundation" },
  { label: "verify-manual-delivery-runner", script: "verify-manual-delivery-runner" },
];

console.log(
  "V6 Phase 31 manual delivery foundation verification orchestrator (verify-manual-delivery-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-manual-delivery-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V6 manual delivery foundation verification: OK");
