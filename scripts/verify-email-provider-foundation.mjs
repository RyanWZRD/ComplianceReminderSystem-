/**
 * V6 Phase 12 Email Provider Foundation Verification Orchestrator.
 * Runs provider config, adapter, and delivery foundation verification in order.
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
  { label: "verify-email-provider-config", script: "verify-email-provider-config" },
  { label: "verify-email-provider-adapter", script: "verify-email-provider-adapter" },
  { label: "verify-delivery-foundation", script: "verify-delivery-foundation" },
];

console.log(
  "V6 Phase 12 email provider foundation verification orchestrator (verify-email-provider-foundation)\n"
);

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-email-provider-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V6 email provider foundation verification: OK");
