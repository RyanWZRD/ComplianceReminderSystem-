/**
 * Phase 2 full verification — runs all automated checks in order.
 * Requires .env + staging Supabase with migrations through 20260203000005.
 * Does not enable CLOUD_WRITES_ENABLED globally; RPC scripts set env internally.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "sync-env", script: "sync-env" },
  { label: "verify-staging-config", script: "verify-staging-config" },
  { label: "verify-read-only-guards", script: "verify-read-only-guards" },
  { label: "verify-local-mode", script: "verify-local-mode" },
  { label: "verify-supabase", script: "verify-supabase" },
  { label: "verify-supabase-auth", script: "verify-supabase-auth" },
  { label: "verify-cloud-load", script: "verify-cloud-load" },
  { label: "verify-cloud-role-load", script: "verify-cloud-role-load" },
  { label: "verify-repository-cloud", script: "verify-repository-cloud" },
  { label: "verify-cloud-mark-reminder-sent", script: "verify-cloud-mark-reminder-sent" },
  { label: "verify-cloud-set-action-status", script: "verify-cloud-set-action-status" },
  { label: "verify-cloud-renew-compliance", script: "verify-cloud-renew-compliance" },
  { label: "verify-cloud-create-compliance-record", script: "verify-cloud-create-compliance-record" },
  { label: "verify-cloud-edit-compliance-record", script: "verify-cloud-edit-compliance-record" },
  { label: "build", script: "build" },
];

console.log("Phase 2 verification (verify:phase2)\n");

for (const { label, script } of STEPS) {
  console.log(`--- ${label} ---`);

  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify:phase2 failed at: ${label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("verify:phase2: all steps OK");
