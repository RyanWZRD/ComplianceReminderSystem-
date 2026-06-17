/**
 * V5-1B Phase 5 Reminder Template Preview alpha release gate.
 * Runs all reminder preview static verification scripts in order.
 * No Supabase, browser login, or cloud writes required.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-reminder-template-preview", script: "verify-reminder-template-preview" },
  { label: "verify-reminder-template-preview-ui", script: "verify-reminder-template-preview-ui" },
  { label: "verify-reminder-template-preview-actions", script: "verify-reminder-template-preview-actions" },
  { label: "verify-reminder-preview-dashboard", script: "verify-reminder-preview-dashboard" },
];

console.log("V5-1B Reminder Template Preview release verification (verify-reminder-suite)\n");

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-reminder-suite failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("verify-reminder-suite: all steps OK");
