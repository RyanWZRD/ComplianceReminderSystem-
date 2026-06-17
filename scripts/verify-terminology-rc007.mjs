/**
 * RC-007: Register count scope clarity.
 * Static checks that all-records vs filtered-view count areas have distinct scope wording.
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

  const end = html.indexOf('id="renew-modal"', start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

console.log("Register count scope clarity verification (RC-007)\n");

assertContains(
  indexHtml,
  "Status counts across all compliance records",
  "summary cards hint states all-records scope"
);
assertContains(
  indexHtml,
  'aria-describedby="summary-cards-hint"',
  "summary cards section references scope hint"
);

assertContains(
  indexHtml,
  "Counts across all compliance records",
  "compliance dashboard hint states all-records scope"
);

const peopleSection = extractPeopleSection(indexHtml);
if (!peopleSection) {
  fail("index.html contains people-section");
} else {
  assertContains(
    peopleSection,
    "Current register view (matches active filters):",
    "register summary strip states filtered-view scope"
  );
  assertContains(
    peopleSection,
    'aria-label="Current register view counts"',
    "register summary strip has accessible scope label"
  );
}

assertContains(
  indexHtml,
  "Based on all compliance records",
  "analytics dashboard retains all-records scope wording"
);

assertContains(
  appJs,
  "of ${filteredCount} matching records",
  "pagination summary uses matching-records filtered scope wording"
);
assertContains(
  appJs,
  "Showing ${filteredCount} of ${totalCount} matching records",
  "person-count badge uses matching-records filtered scope wording"
);

assertNotContains(
  appJs,
  "of ${filteredCount} records`;",
  "pagination summary no longer uses ambiguous records-only wording"
);

assertContains(appBundleJs, "matching records", "bundle includes filtered scope wording");

if (failures.length > 0) {
  console.error("FAIL register count scope clarity verification (RC-007):");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("RC-007 register count scope clarity: OK");
console.log("  all-records vs filtered-view count scope wording verified");
