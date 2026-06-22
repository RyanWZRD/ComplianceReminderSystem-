/**
 * V6 Phase 28: Delivery pipeline foundation verification orchestrator.
 * Runs Resend provider foundation and delivery pipeline stack verification in order.
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
  { label: "verify-browser-resend-provider-foundation", script: "verify-browser-resend-provider-foundation" },
  { label: "verify-delivery-worker", script: "verify-delivery-worker" },
  { label: "verify-delivery-worker-persistence", script: "verify-delivery-worker-persistence" },
  { label: "verify-delivery-log-persistence-service", script: "verify-delivery-log-persistence-service" },
  { label: "verify-delivery-pipeline-service", script: "verify-delivery-pipeline-service" },
  { label: "verify-delivery-operations-log-ui", script: "verify-delivery-operations-log-ui" },
];

console.log(
  "V6 Phase 28 delivery pipeline foundation verification orchestrator (verify-delivery-pipeline-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-delivery-pipeline-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V6 delivery pipeline foundation verification: OK");
