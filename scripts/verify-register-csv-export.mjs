/**
 * RC-003: register CSV export respects active register filters.
 * Static checks against index.html, app.js, and the built bundle.
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

function assertRegex(source, pattern, label) {
  if (!pattern.test(source)) {
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

console.log("Register CSV export filter scope verification (RC-003)\n");

const peopleSection = extractPeopleSection(indexHtml);

if (!peopleSection) {
  fail("index.html contains people-section");
} else {
  assertContains(peopleSection, 'id="export-csv-btn"', "register Export CSV button");
  assertContains(peopleSection, ">Export CSV<", "register Export CSV label");
  assertContains(
    peopleSection,
    'id="export-all-csv-btn"',
    "register Export All Records CSV button"
  );
  assertContains(
    peopleSection,
    ">Export All Records CSV<",
    "register Export All Records CSV label"
  );
  assertContains(
    peopleSection,
    "Export CSV downloads the current register view (respecting active filters)",
    "register export helper text describes filtered export"
  );
  assertContains(
    peopleSection,
    "Export All Records CSV downloads every record",
    "register export helper text describes full export"
  );
  assertContains(
    peopleSection,
    'id="bulk-export-csv-btn"',
    "bulk Export selected CSV button retained"
  );
  assertContains(
    peopleSection,
    ">Export selected CSV<",
    "bulk Export selected CSV label unchanged"
  );
}

const exportToCsvBody = extractFunctionBody(appJs, "exportToCsv");
const exportAllRecordsToCsvBody = extractFunctionBody(appJs, "exportAllRecordsToCsv");
const exportSelectedToCsvBody = extractFunctionBody(appJs, "exportSelectedToCsv");
const getRegisterCsvExportRowsBody = extractFunctionBody(appJs, "getRegisterCsvExportRows");

assertContains(
  getRegisterCsvExportRowsBody,
  "getFilteredComplianceRows()",
  "getRegisterCsvExportRows uses filtered register rows"
);
assertContains(
  exportToCsvBody,
  "getRegisterCsvExportRows()",
  "exportToCsv uses filtered register rows helper"
);
assertNotContains(
  exportToCsvBody,
  "getAllComplianceRows()",
  "exportToCsv does not export all records directly"
);
assertContains(
  exportAllRecordsToCsvBody,
  "getAllComplianceRows()",
  "exportAllRecordsToCsv exports all records"
);
assertContains(
  exportAllRecordsToCsvBody,
  "compliance-reminder-all-records.csv",
  "exportAllRecordsToCsv uses all-records filename"
);
assertContains(
  exportSelectedToCsvBody,
  "getSelectedComplianceRows()",
  "exportSelectedToCsv still exports selected records only"
);
assertContains(appJs, 'getElementById("export-all-csv-btn")', "app.js wires export-all-csv-btn");
assertContains(
  appJs,
  "exportAllCsvBtn?.addEventListener(\"click\", exportAllRecordsToCsv)",
  "app.js wires exportAllRecordsToCsv click handler"
);

assertContains(appBundleJs, "function getRegisterCsvExportRows()", "bundle contains filtered export helper");
assertContains(appBundleJs, "function exportAllRecordsToCsv()", "bundle contains exportAllRecordsToCsv");
assertRegex(
  appBundleJs,
  /function exportToCsv\(\)\s*\{[\s\S]*?getRegisterCsvExportRows\(\)/,
  "bundle exportToCsv uses filtered register rows"
);

if (failures.length > 0) {
  console.error("FAIL register CSV export filter scope verification:");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("RC-003 register CSV export filter scope: OK");
console.log("  Export CSV respects active register filters");
console.log("  Export All Records CSV retains full-register export");
console.log("  Export selected CSV unchanged");
