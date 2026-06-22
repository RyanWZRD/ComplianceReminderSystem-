/**
 * V6 Phase 34: Manual delivery UI end-to-end foundation verification orchestrator.
 * Proves manual delivery UI, provider foundation, delivery pipeline, and operations log
 * work together safely. Verification-only — no scheduled/automatic execution,
 * mark-as-sent automation, or compliance/history mutation.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const emailProviderEnvJs = readFileSync(join(root, "js/data/email-provider-env.js"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const permissionsJs = readFileSync(join(root, "js/app/permissions.js"), "utf8");
const packageJson = readFileSync(join(root, "package.json"), "utf8");

/** @type {readonly { label: string; script: string }[]} */
const STEPS = [
  { label: "verify-manual-delivery-foundation", script: "verify-manual-delivery-foundation" },
  { label: "verify-browser-resend-provider-foundation", script: "verify-browser-resend-provider-foundation" },
  { label: "verify-delivery-operations-log-ui", script: "verify-delivery-operations-log-ui" },
  { label: "verify-manual-delivery-ui", script: "verify-manual-delivery-ui" },
];

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

function assert(condition, label) {
  if (!condition) {
    fail(label);
  }
}

function assertNotMatches(source, pattern, label) {
  if (pattern.test(source)) {
    fail(label);
  }
}

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  if (start === -1) {
    return "";
  }

  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) {
    return "";
  }

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return "";
}

/**
 * @param {string} source
 * @returns {string | null}
 */
function readResendApiKeyLiteral(source) {
  const patterns = [
    /RESEND_API_KEY\s*:\s*"([^"]+)"/,
    /RESEND_API_KEY\s*:\s*'([^']+)'/,
    /RESEND_API_KEY\s*=\s*"([^"]+)"/,
    /RESEND_API_KEY\s*=\s*'([^']+)'/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);

    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  return null;
}

console.log(
  "V6 Phase 34 manual delivery E2E foundation verification orchestrator (verify-manual-delivery-e2e-foundation)\n"
);

console.log("--- static safety checks ---");

assert(
  packageJson.includes('"verify-manual-delivery-e2e-foundation"'),
  "package.json verify script"
);

const envResendKey = readResendApiKeyLiteral(emailProviderEnvJs);

assert(
  envResendKey === null || envResendKey === "undefined",
  "email-provider-env.js must not contain a committed RESEND_API_KEY value"
);

assertNotMatches(
  emailProviderEnvJs,
  /re_[A-Za-z0-9]{12,}/,
  "email-provider-env.js must not contain a real-looking Resend API key"
);

assertNotMatches(
  appJs,
  /RESEND_API_KEY\s*[:=]\s*["']re_/,
  "app.js must not hardcode RESEND_API_KEY"
);

assertNotMatches(appJs, /re_[A-Za-z0-9]{20,}/, "app.js must not contain secret-looking Resend tokens");

assertNotMatches(
  emailProviderEnvJs,
  /re_[A-Za-z0-9]{20,}/,
  "email-provider-env.js must not contain secret-looking Resend tokens"
);

assert(
  permissionsJs.includes("export function canRunManualDeliveryTest"),
  "permissions exports canRunManualDeliveryTest"
);
assert(permissionsJs.includes("return canAdmin()"), "manual delivery test requires admin");
assert(permissionsJs.includes("CLOUD_WRITES_ENABLED"), "manual delivery test requires cloud writes");
assert(permissionsJs.includes("isCloudMode()"), "manual delivery test requires cloud mode");

const renderBody = extractFunctionBody(appJs, "renderManualDeliveryTest");
const runBody = extractFunctionBody(appJs, "handleManualDeliveryTestRun");

assert(renderBody.includes("canRunManualDeliveryTest()"), "renderManualDeliveryTest gates visibility");
assert(runBody.includes("canRunManualDeliveryTest()"), "handleManualDeliveryTestRun gates execution");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("static safety checks: OK\n");

for (const step of STEPS) {
  console.log(`--- ${step.label} ---`);

  const result = spawnSync("npm", ["run", step.script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\nverify-manual-delivery-e2e-foundation failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  console.log("");
}

console.log("V6 manual delivery E2E foundation verification: OK");
