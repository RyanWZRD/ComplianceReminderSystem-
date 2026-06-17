/**
 * RC-004: terminology consistency pass.
 * Static checks against index.html, app.js, login-panel.js, and the built bundle.
 * No Supabase, browser, or localStorage mutation required.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const loginPanelJs = readFileSync(join(root, "js/auth/login-panel.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");

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

function extractPeopleSection(html) {
  const start = html.indexOf('id="people-section"');
  if (start === -1) {
    return "";
  }

  const end = html.indexOf('id="record-workspace"', start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

console.log("Terminology consistency verification (RC-004)\n");

const registerSection = extractPeopleSection(indexHtml);

if (!registerSection) {
  fail("index.html contains people-section register block");
} else {
  assertContains(registerSection, ">Compliance Register<", "register heading uses Compliance Register");
  assertNotContains(registerSection, ">People<", "register heading does not use People");
  assertContains(registerSection, ">Expiring Soon<", "register status filter uses Expiring Soon");
  assertNotContains(registerSection, ">Due Soon<", "register status filter does not use Due Soon");
  assertContains(registerSection, "Compliance Type (A-Z)", "register sort uses Compliance Type");
  assertNotContains(registerSection, ">Category (", "register sort does not use Category");
}

assertContains(indexHtml, ">Expiring Soon<", "summary cards use Expiring Soon");
assertNotContains(indexHtml, ">Due Soon<", "index.html does not expose Due Soon label");
assertContains(indexHtml, ">Valid<", "analytics card uses Valid");
assertNotContains(indexHtml, ">Compliant<", "index.html does not expose Compliant label");
assertContains(indexHtml, ">Archive Record<", "workspace uses Archive Record");
assertNotContains(indexHtml, ">Delete Record<", "workspace does not use Delete Record");
assertNotContains(
  indexHtml,
  "until their DBS is renewed",
  "reminder hint avoids DBS-specific renewal wording"
);

assertContains(appJs, 'dueSoon: "Expiring Soon"', "STATUS_FILTER_LABELS uses Expiring Soon");
assertNotContains(appJs, 'dueSoon: "Due Soon"', "app.js does not define Due Soon filter label");
assertContains(appJs, 'label: "Expiring Soon"', "getStatus uses Expiring Soon");
assertContains(appJs, 'deleted: "Archived"', "history action label uses Archived for records");
assertContains(appJs, "Archive this compliance record?", "archive confirmation prompt");
assertContains(appJs, "Archived:", "archive success toast");
assertNotContains(appJs, "Delete this compliance record?", "app.js does not use delete compliance prompt");
assertContains(appJs, "formatHistoryDescription", "app.js displays archived history descriptions");
assertNotContains(appJs, "`Deleted: ${person.name}", "app.js does not use Deleted toast for records");

assertContains(
  loginPanelJs,
  "archive compliance records",
  "cloud banner uses archive compliance records"
);
assertNotContains(
  loginPanelJs,
  "delete compliance records",
  "cloud banner does not use delete compliance records"
);

assertContains(appBundleJs, 'dueSoon: "Expiring Soon"', "bundle STATUS_FILTER_LABELS uses Expiring Soon");
assertContains(appBundleJs, "Archive this compliance record?", "bundle archive confirmation prompt");
assertContains(appBundleJs, "archive compliance records", "bundle cloud banner uses archive compliance records");
assertNotContains(appBundleJs, 'dueSoon: "Due Soon"', "bundle does not define Due Soon filter label");
assertNotContains(appBundleJs, "Delete this compliance record?", "bundle does not use delete compliance prompt");

if (failures.length > 0) {
  console.error("FAIL terminology consistency verification (RC-004):");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("RC-004 terminology consistency: OK");
console.log("  Compliance Register, Expiring Soon, Valid, Compliance Type, and Archive terminology verified");
