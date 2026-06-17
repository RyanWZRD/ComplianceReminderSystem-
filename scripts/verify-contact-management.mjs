/**
 * V5-1A Phase 7 Contact Management alpha release gate.
 * Runs contact-specific static checks plus the Compliance Insights release chain.
 * No Supabase, browser login, or cloud writes required.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-register-csv-contact-fields", script: "verify-register-csv-contact-fields" },
  { label: "verify-contact-readiness-workspace", script: "verify-contact-readiness-workspace" },
  { label: "verify-insights-engine", script: "verify-insights-engine" },
  { label: "verify-insights-browser", script: "verify-insights-browser" },
  { label: "build", script: "build" },
  { label: "verify-terminology-rc004", script: "verify-terminology-rc004" },
  { label: "verify-terminology-rc005", script: "verify-terminology-rc005" },
  { label: "verify-terminology-rc006", script: "verify-terminology-rc006" },
  { label: "verify-terminology-rc007", script: "verify-terminology-rc007" },
  { label: "verify-terminology-rc008", script: "verify-terminology-rc008" },
  { label: "verify-terminology-rc009", script: "verify-terminology-rc009" },
];

console.log("V5-1A Contact Management alpha release verification (verify-contact-management)\n");

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-contact-management failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("verify-contact-management: all steps OK");
