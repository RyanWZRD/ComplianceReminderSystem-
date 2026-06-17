import { normalizeEmail } from "../../data/email.js";
import { REMINDER_UI_LABELS } from "../../data/reminder-sent.js";
import { getActiveReminderType, isRecordInReminderWindow } from "./metrics-operational.js";

/** @typedef {import("./insights-engine.js").NormalizedComplianceRow} NormalizedComplianceRow */
/** @typedef {import("./insights-engine.js").InsightsContext} InsightsContext */

const REMINDER_WINDOW_PRIORITY = {
  [REMINDER_UI_LABELS.expired]: 0,
  [REMINDER_UI_LABELS[7]]: 1,
  [REMINDER_UI_LABELS[14]]: 2,
  [REMINDER_UI_LABELS[30]]: 3,
};

/**
 * @param {NormalizedComplianceRow} row
 * @returns {boolean}
 */
export function personRowHasEmail(row) {
  return normalizeEmail(row.email) !== "";
}

/**
 * @param {string | null | undefined} current
 * @param {string | null} candidate
 * @returns {string | null}
 */
function pickMoreUrgentReminderWindow(current, candidate) {
  if (!candidate) {
    return current ?? null;
  }

  if (!current) {
    return candidate;
  }

  const currentRank = REMINDER_WINDOW_PRIORITY[current] ?? 99;
  const candidateRank = REMINDER_WINDOW_PRIORITY[candidate] ?? 99;

  return candidateRank < currentRank ? candidate : current;
}

/**
 * Build one summary per unique person from flattened compliance rows.
 *
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 */
export function buildPersonContactSummaries(rows, ctx) {
  /** @type {Map<string|number, object>} */
  const byPerson = new Map();

  rows.forEach((row) => {
    const personId = row.personId;
    let summary = byPerson.get(personId);

    if (!summary) {
      summary = {
        personId,
        name: row.name,
        role: row.role,
        email: normalizeEmail(row.email),
        hasEmail: personRowHasEmail(row),
        recordCount: 0,
        recordsInReminderWindow: 0,
        mostUrgentReminderWindow: null,
      };
      byPerson.set(personId, summary);
    }

    summary.recordCount += 1;

    if (isRecordInReminderWindow(row, ctx)) {
      summary.recordsInReminderWindow += 1;
      summary.mostUrgentReminderWindow = pickMoreUrgentReminderWindow(
        summary.mostUrgentReminderWindow,
        getActiveReminderType(row.expiryDate, ctx.settings, ctx)
      );
    }
  });

  return Array.from(byPerson.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 * @returns {ReturnType<typeof buildPersonContactSummaries>}
 */
export function filterPeopleMissingEmail(rows, ctx) {
  return buildPersonContactSummaries(rows, ctx).filter((person) => !person.hasEmail);
}

/**
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 * @returns {ReturnType<typeof buildPersonContactSummaries>}
 */
export function filterPeopleMissingEmailInReminderWindow(rows, ctx) {
  return buildPersonContactSummaries(rows, ctx).filter(
    (person) => !person.hasEmail && person.recordsInReminderWindow > 0
  );
}

/**
 * Contact readiness metrics from person email metadata on loaded rows.
 *
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 */
export function computeContactReadiness(rows, ctx) {
  const people = buildPersonContactSummaries(rows, ctx);
  const peopleWithEmail = people.filter((person) => person.hasEmail).length;
  const peopleMissingEmail = people.length - peopleWithEmail;
  const peopleInReminderWindowMissingEmail = people.filter(
    (person) => !person.hasEmail && person.recordsInReminderWindow > 0
  ).length;

  return {
    peopleTotal: people.length,
    peopleWithEmail,
    peopleMissingEmail,
    peopleInReminderWindowMissingEmail,
    people,
  };
}

/**
 * @param {{
 *   peopleTotal?: number;
 *   peopleWithEmail?: number;
 *   peopleMissingEmail?: number;
 *   peopleInReminderWindowMissingEmail?: number;
 * }} contactReadiness
 */
export function formatContactReadinessSummary(contactReadiness) {
  const peopleTotal = contactReadiness.peopleTotal ?? 0;
  const peopleWithEmail = contactReadiness.peopleWithEmail ?? 0;
  const peopleMissingEmail = contactReadiness.peopleMissingEmail ?? 0;
  const peopleInReminderWindowMissingEmail =
    contactReadiness.peopleInReminderWindowMissingEmail ?? 0;

  if (peopleTotal === 0) {
    const fallback = "No people on register";

    return {
      summaryText: fallback,
      detailText: "",
      title: "",
      ariaLabel: fallback,
    };
  }

  const summaryText = `${peopleWithEmail} of ${peopleTotal} people have email`;

  if (peopleMissingEmail === 0) {
    const note = "All people have email addresses on file.";

    return {
      summaryText,
      detailText: note,
      title: note,
      ariaLabel: `${summaryText}. ${note}`,
    };
  }

  const detailText = `${peopleMissingEmail} missing email · ${peopleInReminderWindowMissingEmail} in reminder windows`;
  const note = `${peopleMissingEmail} of ${peopleTotal} people are missing an email address. ${peopleInReminderWindowMissingEmail} of those people have compliance records in active reminder windows.`;

  return {
    summaryText,
    detailText,
    title: note,
    ariaLabel: `${summaryText}. ${detailText}. ${note}`,
  };
}
