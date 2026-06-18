/**
 * V5-1 Phase 4 Reminder Queue Foundation Verification Orchestrator.
 * Runs V5-0 foundation + V5-1 queue preview/export verification scripts in order.
 * Verification-only — no reminder/action/email execution.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-automation-v5-foundation", script: "verify-automation-v5-foundation" },
  { label: "verify-reminder-queue", script: "verify-reminder-queue" },
  { label: "verify-reminder-queue-ui", script: "verify-reminder-queue-ui" },
  { label: "verify-reminder-queue-export", script: "verify-reminder-queue-export" },
];

console.log(
  "V5-1 Phase 4 reminder queue foundation verification orchestrator (verify-reminder-queue-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-reminder-queue-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V5-1 reminder queue foundation verification: OK");
