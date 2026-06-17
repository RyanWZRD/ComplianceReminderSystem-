/**
 * V5-1A Phase 4: register contact fields in table and CSV import/export.
 * Static checks against index.html, app.js, and the built bundle, plus
 * deterministic header/contact validation cases. No Supabase or browser required.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePersonContact } from "../js/data/email.js";

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

function findColumnIndex(headers, targetName) {
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  return normalizedHeaders.indexOf(targetName.toLowerCase());
}

console.log("Register CSV contact fields verification (V5-1A Phase 4)\n");

const peopleSection = extractPeopleSection(indexHtml);

if (!peopleSection) {
  fail("index.html contains people-section");
} else {
  assertContains(peopleSection, ">Email<", "register table includes Email column header");
  assertNotContains(
    peopleSection,
    ">Manager Email<",
    "register table does not include Manager Email column header"
  );
}

const getAllComplianceRowsBody = extractFunctionBody(appJs, "getAllComplianceRows");
const buildComplianceCsvRowBody = extractFunctionBody(appJs, "buildComplianceCsvRow");
const importPeopleFromCsvBody = extractFunctionBody(appJs, "importPeopleFromCsv");
const handleCsvImportBody = extractFunctionBody(appJs, "handleCsvImport");
const addComplianceRecordBody = extractFunctionBody(appJs, "addComplianceRecord");

assertContains(
  getAllComplianceRowsBody,
  "email: person.email",
  "getAllComplianceRows includes person email"
);
assertContains(
  getAllComplianceRowsBody,
  "managerEmail: person.managerEmail",
  "getAllComplianceRows includes person managerEmail"
);
assertContains(appJs, "escapeHtml(row.email", "renderTable displays email cell");
assertNotContains(
  appJs,
  "escapeHtml(row.managerEmail",
  "renderTable does not display manager email cell"
);

assertContains(appJs, '"Email"', "COMPLIANCE_CSV_HEADERS includes Email");
assertContains(appJs, '"Manager Email"', "COMPLIANCE_CSV_HEADERS includes Manager Email");
assertContains(buildComplianceCsvRowBody, "row.email", "buildComplianceCsvRow exports email");
assertContains(
  buildComplianceCsvRowBody,
  "row.managerEmail",
  "buildComplianceCsvRow exports managerEmail"
);

assertContains(
  importPeopleFromCsvBody,
  'findColumnIndex(headers, "email")',
  "importPeopleFromCsv parses Email column"
);
assertContains(
  importPeopleFromCsvBody,
  'findColumnIndex(headers, "manager email")',
  "importPeopleFromCsv parses Manager Email column"
);
assertContains(
  importPeopleFromCsvBody,
  "validatePersonContact(contactToValidate)",
  "importPeopleFromCsv validates contact fields"
);
assertContains(
  importPeopleFromCsvBody,
  "invalidEmail",
  "importPeopleFromCsv tracks invalid email skip reason"
);
assertContains(
  importPeopleFromCsvBody,
  "emailIndex === -1 ? undefined",
  "importPeopleFromCsv preserves contact fields when Email column absent"
);
assertContains(
  addComplianceRecordBody,
  "email !== undefined",
  "addComplianceRecord only updates email when provided"
);
assertContains(
  addComplianceRecordBody,
  "managerEmail !== undefined",
  "addComplianceRecord only updates managerEmail when provided"
);

assertContains(handleCsvImportBody, "rejectIfReadOnly()", "handleCsvImport blocks cloud CSV import");
assertContains(importPeopleFromCsvBody, "rejectIfReadOnly()", "importPeopleFromCsv blocks cloud CSV import");

assertContains(appBundleJs, '"Email"', "bundle CSV headers include Email");
assertContains(appBundleJs, '"Manager Email"', "bundle CSV headers include Manager Email");
assertRegex(
  appBundleJs,
  /function importPeopleFromCsv\([\s\S]*?rejectIfReadOnly\(\)/,
  "bundle importPeopleFromCsv retains read-only guard"
);

const headersMatch = appJs.match(/const COMPLIANCE_CSV_HEADERS = \[([\s\S]*?)\];/);

if (!headersMatch) {
  fail("COMPLIANCE_CSV_HEADERS array found in app.js");
} else {
  const headersBlock = headersMatch[1];
  const emailPos = headersBlock.indexOf('"Email"');
  const managerEmailPos = headersBlock.indexOf('"Manager Email"');
  const complianceTypePos = headersBlock.indexOf('"Compliance Type"');

  if (emailPos === -1 || managerEmailPos === -1 || complianceTypePos === -1) {
    fail("COMPLIANCE_CSV_HEADERS contains Email, Manager Email, and Compliance Type");
  } else if (!(emailPos < managerEmailPos && managerEmailPos < complianceTypePos)) {
    fail("COMPLIANCE_CSV_HEADERS orders contact fields before Compliance Type");
  }
}

const oldCsvHeaders = [
  "Name",
  "Role",
  "Compliance Type",
  "Renewal Cycle",
  "Expiry Date",
];
const newCsvHeaders = [
  "Name",
  "Role",
  "Email",
  "Manager Email",
  "Compliance Type",
  "Renewal Cycle",
  "Expiry Date",
];

if (findColumnIndex(oldCsvHeaders, "name") === -1) {
  fail("legacy CSV headers still include Name");
}
if (findColumnIndex(oldCsvHeaders, "email") !== -1) {
  fail("legacy CSV headers do not require Email");
}
if (findColumnIndex(newCsvHeaders, "email") === -1) {
  fail("extended CSV headers include Email");
}
if (findColumnIndex(newCsvHeaders, "manager email") === -1) {
  fail("extended CSV headers include Manager Email");
}

const validContact = validatePersonContact({
  email: "person@example.com",
  managerEmail: "manager@example.com",
});
if (!validContact.ok) {
  fail("validatePersonContact accepts well-formed contact emails");
}

const invalidContact = validatePersonContact({ email: "not-an-email" });
if (invalidContact.ok) {
  fail("validatePersonContact rejects malformed email values");
}

const emptyContact = validatePersonContact({});
if (!emptyContact.ok) {
  fail("validatePersonContact accepts absent contact fields");
}

if (failures.length > 0) {
  console.error("FAIL register CSV contact fields verification:");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("V5-1A Phase 4 register CSV contact fields: OK");
console.log("  Register table shows Email column only");
console.log("  CSV export includes Email and Manager Email");
console.log("  Local CSV import supports optional contact columns");
console.log("  Legacy CSV headers remain compatible");
console.log("  Cloud CSV import remains read-only guarded");
