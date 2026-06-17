/**
 * V4-3E Compliance Insights release verification.
 * Runs the full Compliance Insights verification chain in order:
 * engine → browser smoke → build.
 * No Supabase, browser login, or cloud writes required.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-insights-engine", script: "verify-insights-engine" },
  { label: "verify-insights-browser", script: "verify-insights-browser" },
  { label: "build", script: "build" },
  { label: "verify-terminology-rc004", script: "verify-terminology-rc004" },
];

console.log("Compliance Insights release verification (verify-insights-release)\n");

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-insights-release failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("verify-insights-release: all steps OK");
