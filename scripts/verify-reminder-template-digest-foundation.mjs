/**
 * V5-2 Phase 6 Template & Digest Foundation Verification Orchestrator.
 * Runs V5-1 queue foundation + V5-2 template/digest verification scripts in order.
 * Verification-only — no reminder/action/email execution or delivery.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-reminder-queue-foundation", script: "verify-reminder-queue-foundation" },
  { label: "verify-reminder-template-builder", script: "verify-reminder-template-builder" },
  {
    label: "verify-reminder-queue-template-preview-ui",
    script: "verify-reminder-queue-template-preview-ui",
  },
  { label: "verify-reminder-template-copy", script: "verify-reminder-template-copy" },
  { label: "verify-reminder-digest-builder", script: "verify-reminder-digest-builder" },
  { label: "verify-reminder-digest-preview-ui", script: "verify-reminder-digest-preview-ui" },
];

console.log(
  "V5-2 Phase 6 template and digest foundation verification orchestrator (verify-reminder-template-digest-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-reminder-template-digest-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V5-2 template and digest foundation verification: OK");
