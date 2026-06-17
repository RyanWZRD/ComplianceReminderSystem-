/**
 * RC-006: Error and warning message styling consistency.
 * Static checks that message-* classes use distinct, semantically correct colours.
 * No Supabase, browser, or localStorage mutation required.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const stylesCss = readFileSync(join(root, "styles.css"), "utf8");

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

/**
 * @param {string} css
 * @param {string} className
 * @returns {string}
 */
function extractRuleBlock(css, className) {
  const marker = `.${className} {`;
  const start = css.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const openBrace = css.indexOf("{", start);
  if (openBrace === -1) {
    return "";
  }

  let depth = 0;
  for (let i = openBrace; i < css.length; i += 1) {
    if (css[i] === "{") {
      depth += 1;
    } else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openBrace + 1, i);
      }
    }
  }

  return "";
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

console.log("Message styling consistency verification (RC-006)\n");

const messageSuccess = extractRuleBlock(stylesCss, "message-success");
const messageError = extractRuleBlock(stylesCss, "message-error");
const messageWarning = extractRuleBlock(stylesCss, "message-warning");
const messageInfo = extractRuleBlock(stylesCss, "message-info");

if (!messageSuccess) {
  fail("styles.css defines .message-success");
} else {
  assertContains(messageSuccess, "#e6f4ea", "message-success uses green background");
  assertContains(messageSuccess, "#1e7e34", "message-success uses green text");
}

if (!messageError) {
  fail("styles.css defines .message-error");
} else {
  assertContains(messageError, "#fef2f2", "message-error uses red-tinted background");
  assertContains(messageError, "#991b1b", "message-error uses red text");
  assertNotContains(messageError, "#fff3cd", "message-error does not use warning background");
  assertNotContains(messageError, "#856404", "message-error does not use warning text");
}

if (!messageWarning) {
  fail("styles.css defines .message-warning");
} else {
  assertContains(messageWarning, "#fff3cd", "message-warning uses amber background");
  assertContains(messageWarning, "#856404", "message-warning uses amber text");
  assertNotContains(messageWarning, "#991b1b", "message-warning does not use error text");
}

if (!messageInfo) {
  fail("styles.css defines .message-info");
} else {
  assertContains(messageInfo, "#eff6ff", "message-info uses blue background");
  assertContains(messageInfo, "#1e40af", "message-info uses blue text");
  assertNotContains(messageInfo, "#fff3cd", "message-info does not use warning background");
}

if (failures.length > 0) {
  console.error("FAIL message styling consistency verification (RC-006):");
  for (const label of failures) {
    console.error(`  - ${label}`);
  }
  process.exit(1);
}

console.log("RC-006 message styling consistency: OK");
console.log("  success, error, warning, and info message classes use distinct colours");
