/**
 * RC-009: Cloud evidence file input clarity.
 * Static checks that cloud mode hides/disables the evidence file input and shows metadata-only helper text.
 * No Supabase, browser, or localStorage mutation required.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");

const CLOUD_EVIDENCE_NOTICE =
  "Cloud mode stores evidence metadata only. File upload is not available in this version.";

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(label);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    fail(label);
  }
}

/**
 * @param {string} html
 * @returns {string}
 */
function extractEvidenceModalSection(html) {
  const start = html.indexOf('id="evidence-modal"');
  if (start === -1) {
    return "";
  }

  const end = html.indexOf('id="bulk-action-modal"', start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

console.log("Cloud evidence file input clarity verification (RC-009)\n");

const evidenceModalSection = extractEvidenceModalSection(indexHtml);

if (!evidenceModalSection) {
  fail("index.html contains evidence-modal");
} else {
  assertContains(
    evidenceModalSection,
    CLOUD_EVIDENCE_NOTICE,
    "evidence modal includes cloud metadata-only helper text"
  );
  assertContains(
    evidenceModalSection,
    'id="evidence-cloud-file-notice"',
    "evidence modal defines cloud file notice element"
  );
  assertContains(
    evidenceModalSection,
    'id="evidence-file-row"',
    "evidence modal defines local file input row"
  );
  assertContains(
    evidenceModalSection,
    "Stored locally in your browser only. Max 512 KB per file.",
    "evidence modal retains local-mode file hint"
  );
  assertNotContains(
    evidenceModalSection,
    "File upload and replacement are not available in cloud mode yet",
    "evidence modal does not use outdated cloud file notice wording"
  );
}

assertContains(appJs, "setEvidenceModalFileVisibility", "app.js manages evidence modal file visibility");
assertContains(appJs, "evidenceFileInput.disabled = hideFileInCloud", "app.js disables evidence file input in cloud mode");
assertContains(appJs, 'evidenceFileRow.classList.add("hidden")', "app.js hides evidence file row in cloud mode");
assertContains(appJs, "evidenceCloudFileNotice.classList.remove", "app.js shows cloud evidence notice in cloud mode");
assertContains(appJs, "isCloudMode() && file", "app.js blocks cloud file save if a file is selected");
assertContains(appJs, "readFileAsDataUrl", "app.js retains local evidence file read behaviour");
assertContains(appJs, "MAX_EVIDENCE_FILE_BYTES", "app.js retains local evidence file size limit");

assertContains(indexHtml, CLOUD_EVIDENCE_NOTICE, "index.html includes cloud evidence metadata-only notice");
assertContains(appBundleJs, "evidenceFileInput.disabled = hideFileInCloud", "bundle disables evidence file input in cloud mode");

if (failures.length > 0) {
  console.error("FAIL cloud evidence file input clarity verification (RC-009):");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("RC-009 cloud evidence file input clarity: OK");
console.log("  cloud metadata-only notice, hidden/disabled file input, and local file behaviour verified");
