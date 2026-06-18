/**
 * V6 Phase 20: Resend provider foundation verification orchestrator.
 * Runs provider skeleton foundation, Resend plan, and Resend provider verification in order.
 * Verification-only — no app behaviour changes, app wiring, UI send button, automatic delivery
 * execution, or mark-as-sent automation.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-email-provider-skeleton-foundation", script: "verify-email-provider-skeleton-foundation" },
  { label: "verify-resend-provider-plan", script: "verify-resend-provider-plan" },
  { label: "verify-resend-provider", script: "verify-resend-provider" },
];

console.log(
  "V6 Phase 20 Resend provider foundation verification orchestrator (verify-resend-provider-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-resend-provider-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V6 Resend provider foundation verification: OK");
