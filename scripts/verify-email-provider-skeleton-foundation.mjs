/**
 * V6 Phase 15: Provider skeleton foundation verification orchestrator.
 * Runs provider foundation and skeleton verification in order.
 * Verification-only — no real email provider, network calls, production sending,
 * mark-as-sent automation, or app behaviour changes.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-email-provider-foundation", script: "verify-email-provider-foundation" },
  { label: "verify-email-provider-skeletons", script: "verify-email-provider-skeletons" },
];

console.log(
  "V6 Phase 15 provider skeleton foundation verification orchestrator (verify-email-provider-skeleton-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-email-provider-skeleton-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V6 email provider skeleton foundation verification: OK");
