/**
 * V5-1A Phase 6: Contact Readiness workspace actions.
 * Static checks for drilldown Edit Contact flow, workspace contact section,
 * and row-to-workspace navigation. No Supabase, browser, email, or automation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const appJs = readFileSync(join(root, "app.js"), "utf8");
const appBundleJs = readFileSync(join(root, "app.bundle.js"), "utf8");
const drilldownsJs = readFileSync(
  join(root, "js/app/insights/compliance-insights-drilldowns.js"),
  "utf8"
);

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

console.log("Contact Readiness workspace verification (V5-1A Phase 6)\n");

assertContains(
  drilldownsJs,
  "export function resolveContactDrilldownWorkspaceRecord",
  "drilldowns resolveContactDrilldownWorkspaceRecord helper"
);
assertContains(
  drilldownsJs,
  "isRecordInReminderWindow(row, ctx)",
  "drilldown workspace record prefers reminder-window rows"
);

assertContains(
  appJs,
  "resolveContactDrilldownWorkspaceRecord",
  "app.js imports resolveContactDrilldownWorkspaceRecord"
);

const renderDrilldownBody = extractFunctionBody(appJs, "renderComplianceInsightDrilldownPreview");
assertContains(
  renderDrilldownBody,
  "edit-contact-btn",
  "drilldown preview renders Edit Contact action"
);
assertContains(renderDrilldownBody, "Edit Contact", "drilldown preview Edit Contact label");
assertContains(
  renderDrilldownBody,
  "compliance-insight-contact-row",
  "contact drilldown rows are interactive"
);

const drilldownClickBody = extractFunctionBody(appJs, "handleComplianceInsightDrilldownRowClick");
assertContains(
  drilldownClickBody,
  "startEdit(personId, recordId, { focusContact: true })",
  "Edit Contact opens edit form with contact focus"
);
assertContains(
  drilldownClickBody,
  "openRecordWorkspace(personId, recordId)",
  "contact drilldown row opens workspace"
);

const startEditBody = extractFunctionBody(appJs, "startEdit");
assertContains(appJs, "options.focusContact", "startEdit supports focusContact option");
assertContains(appJs, 'getElementById("edit-email")', "startEdit focuses email field");
assertContains(startEditBody, "options = {}", "startEdit accepts options argument");

const contactStatusBody = extractFunctionBody(appJs, "getContactEmailStatus");
assertContains(contactStatusBody, "Missing Email", "contact status helper Missing Email badge");
assertContains(contactStatusBody, "Email Present", "contact status helper Email Present badge");

const renderWorkspaceBody = extractFunctionBody(appJs, "renderRecordWorkspace");
assertContains(
  renderWorkspaceBody,
  'class="workspace-section workspace-contact"',
  "workspace includes Contact Information section"
);
assertContains(renderWorkspaceBody, "Contact Information", "workspace Contact Information title");
assertContains(renderWorkspaceBody, "getContactEmailStatus(person)", "workspace uses contact status helper");
assertContains(renderWorkspaceBody, "workspace-contact-email", "workspace displays Email prominently");
assertContains(
  renderWorkspaceBody,
  "workspace-contact-manager-email",
  "workspace displays Manager Email prominently"
);
assertNotContains(
  renderWorkspaceBody,
  '<dt>Email</dt>\n          <dd>${escapeHtml(person.email',
  "email removed from General Information section"
);

assertContains(
  appJs,
  "handleComplianceInsightDrilldownRowClick",
  "app.js wires contact drilldown row click handler"
);
assertContains(
  appJs,
  "handleComplianceInsightDrilldownRowKeydown",
  "app.js wires contact drilldown row keyboard handler"
);

assertNotContains(appJs, "sendEmail", "app.js does not add email sending");
assertNotContains(appJs, "sendReminderEmail", "app.js does not add reminder email delivery");
assertNotContains(appJs, "notification_queue", "app.js does not add notification queue automation");

assertContains(appBundleJs, "resolveContactDrilldownWorkspaceRecord", "bundle includes workspace record resolver");
assertContains(appBundleJs, "Edit Contact", "bundle includes Edit Contact drilldown action");
assertContains(appBundleJs, "Contact Information", "bundle includes workspace Contact Information section");

if (failures.length > 0) {
  console.error("FAIL contact readiness workspace verification:");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("V5-1A Phase 6 contact readiness workspace: OK");
console.log("  Contact drilldown Edit Contact action verified");
console.log("  Drilldown row opens workspace verified");
console.log("  Workspace Contact Information section and status badges verified");
console.log("  No email delivery or automation hooks added");
