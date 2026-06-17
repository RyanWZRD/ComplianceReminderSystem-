/**
 * RC-008: Renew workflow wording polish.
 * Static checks for standardized renewal copy in index.html, app.js, and the built bundle.
 * No Supabase, browser, or localStorage mutation required.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const drilldownsJs = readFileSync(
  join(root, "js/app/insights/compliance-insights-drilldowns.js"),
  "utf8"
);
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

/**
 * @param {string} html
 * @returns {string}
 */
function extractRenewModalSection(html) {
  const start = html.indexOf('id="renew-modal"');
  if (start === -1) {
    return "";
  }

  const end = html.indexOf('id="evidence-modal"', start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

console.log("Renew workflow wording polish verification (RC-008)\n");

const renewModalSection = extractRenewModalSection(indexHtml);

if (!renewModalSection) {
  fail("index.html contains renew-modal");
} else {
  assertContains(renewModalSection, ">Renew Compliance<", "renew modal title uses Renew Compliance");
  assertContains(renewModalSection, ">New Expiry Date:<", "renew modal shows New Expiry Date label");
  assertContains(renewModalSection, ">Renewal Date<", "renew modal date input uses Renewal Date label");
  assertContains(
    renewModalSection,
    "Use Suggested New Expiry Date",
    "renew modal primary action uses suggested New Expiry Date wording"
  );
  assertContains(
    renewModalSection,
    "Confirm Renewal Date",
    "renew modal secondary action uses Confirm Renewal Date wording"
  );
  assertContains(
    renewModalSection,
    "Renewal Date must be today or later",
    "renew modal helper explains Renewal Date rule"
  );
  assertNotContains(renewModalSection, "Custom Expiry Date", "renew modal does not use Custom Expiry Date");
  assertNotContains(renewModalSection, "Suggested New Expiry:", "renew modal does not use Suggested New Expiry label");
  assertNotContains(renewModalSection, ">Use Suggested Date<", "renew modal does not use Use Suggested Date button label");
  assertNotContains(renewModalSection, "Save Custom Date", "renew modal does not use Save Custom Date");
  assertNotContains(renewModalSection, "Current Expiry:", "renew modal does not use abbreviated Current Expiry label");
}

assertContains(indexHtml, ">Renew Compliance</button>", "workspace renew button uses Renew Compliance");
assertContains(indexHtml, ">Renew Compliance</th>", "register table header uses Renew Compliance");

assertContains(appJs, ">Renew Compliance</button>", "register renew button uses Renew Compliance");
assertContains(
  appJs,
  "Renewal completed: ${outcome.recordLabel}. New Expiry Date:",
  "local renew success toast uses Renewal completed wording"
);
assertContains(
  appJs,
  "Renewal completed: ${recordLabel}. New Expiry Date:",
  "cloud renew success toast uses Renewal completed wording"
);
assertContains(appJs, "formatRenewalHistoryDescription", "app.js display-transforms renewal history descriptions");
assertContains(appJs, "Please enter a Renewal Date.", "renew modal missing-date error uses Renewal Date");
assertContains(appJs, "Renewal Date must be today or later.", "renew modal date validation uses Renewal Date");
assertNotContains(appJs, "`Renewed: ${", "app.js does not use ambiguous Renewed success toast");
assertNotContains(appJs, "Please enter an expiry date.", "app.js renew modal does not use generic expiry date prompt");

assertContains(
  drilldownsJs,
  "Renew compliance on these records to restore compliance.",
  "expired-records drilldown uses renew compliance wording"
);
assertNotContains(
  drilldownsJs,
  "Renew or update these records",
  "expired-records drilldown does not use ambiguous update wording"
);

assertContains(appBundleJs, ">Renew Compliance</button>", "bundle register renew button uses Renew Compliance");
assertContains(appBundleJs, "Renewal completed:", "bundle includes Renewal completed success wording");
assertContains(appBundleJs, "formatRenewalHistoryDescription", "bundle display-transforms renewal history descriptions");

if (failures.length > 0) {
  console.error("FAIL renew workflow wording polish verification (RC-008):");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("RC-008 renew workflow wording polish: OK");
console.log("  Renew Compliance, Renewal Date, New Expiry Date, and Renewal completed wording verified");
