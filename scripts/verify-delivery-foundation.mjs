/**
 * V6 Phase 8 Delivery Foundation Verification Orchestrator.
 * Runs all V6 delivery foundation verification scripts in order.
 * Verification-only — no real email provider, production delivery, or mark-as-sent automation.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-delivery-architecture", script: "verify-delivery-architecture" },
  { label: "verify-reminder-delivery-record-builder", script: "verify-reminder-delivery-record-builder" },
  { label: "verify-reminder-delivery-log-schema", script: "verify-reminder-delivery-log-schema" },
  { label: "verify-reminder-delivery-log-rpcs", script: "verify-reminder-delivery-log-rpcs" },
  { label: "verify-reminder-delivery-state-machine", script: "verify-reminder-delivery-state-machine" },
  { label: "verify-mock-email-provider", script: "verify-mock-email-provider" },
  { label: "verify-mock-delivery-executor", script: "verify-mock-delivery-executor" },
];

console.log(
  "V6 Phase 8 delivery foundation verification orchestrator (verify-delivery-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-delivery-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V6 delivery foundation verification: OK");
