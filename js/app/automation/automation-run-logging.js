/**
 * V5-0 Phase 6: Dry-run run logging.
 * Persists dry-run scan results to automation_runs for audit only.
 * Does not execute reminders, emails, actions, or compliance mutations.
 */

/** @typedef {import("../../data/automation-runs.js").AutomationRunView} AutomationRunView */

export const DRY_RUN_RUN_TYPE = "dry_run";
export const DEFAULT_DRY_RUN_RUN_SOURCE = "manual_dry_run";

/** Execution outcome counters — always zero for dry-run audit rows. */
const DRY_RUN_EXECUTION_SUMMARY_ZEROS = Object.freeze({
  policiesApplied: 0,
  policiesSkipped: 0,
  remindersQueued: 0,
  remindersSent: 0,
  actionsCreated: 0,
  escalationsFired: 0,
});

/**
 * @typedef {Object} AutomationDryRunRunSummary
 * @property {typeof DRY_RUN_RUN_TYPE} runType
 * @property {string} source
 * @property {object} dryRun
 * @property {string} [organisationId]
 * @property {string} [actorProfileId]
 * @property {0} policiesApplied
 * @property {0} policiesSkipped
 * @property {0} remindersQueued
 * @property {0} remindersSent
 * @property {0} actionsCreated
 * @property {0} escalationsFired
 */

/**
 * @typedef {Object} LogAutomationDryRunRunInput
 * @property {{ createAutomationRun: (input?: object) => Promise<{ ok: boolean; run?: AutomationRunView; error?: string }> }} db
 * @property {string} [organisationId]
 * @property {string} [actorProfileId]
 * @property {object} dryRunResult
 * @property {string} [source]
 */

/**
 * @typedef {Object} LogAutomationDryRunRunResult
 * @property {boolean} ok
 * @property {AutomationRunView} [run]
 * @property {string} [error]
 */

/**
 * Build the automation_runs.summary payload for a dry-run audit row.
 *
 * @param {object} dryRunResult
 * @param {{ source?: string; organisationId?: string; actorProfileId?: string }} [options]
 * @returns {AutomationDryRunRunSummary}
 */
export function buildAutomationDryRunRunSummary(dryRunResult, options = {}) {
  const source =
    typeof options.source === "string" && options.source.trim()
      ? options.source.trim()
      : DEFAULT_DRY_RUN_RUN_SOURCE;

  /** @type {AutomationDryRunRunSummary} */
  const summary = {
    runType: DRY_RUN_RUN_TYPE,
    source,
    dryRun: dryRunResult,
    ...DRY_RUN_EXECUTION_SUMMARY_ZEROS,
  };

  if (typeof options.organisationId === "string" && options.organisationId.trim()) {
    summary.organisationId = options.organisationId.trim();
  }

  if (typeof options.actorProfileId === "string" && options.actorProfileId.trim()) {
    summary.actorProfileId = options.actorProfileId.trim();
  }

  return summary;
}

/**
 * Log a completed dry-run scan to automation_runs (audit only — no automation execution).
 *
 * @param {LogAutomationDryRunRunInput} input
 * @returns {Promise<LogAutomationDryRunRunResult>}
 */
export async function logAutomationDryRunRun({
  db,
  organisationId,
  actorProfileId,
  dryRunResult,
  source,
}) {
  if (!db || typeof db.createAutomationRun !== "function") {
    return { ok: false, error: "Automation store does not support run creation." };
  }

  if (!dryRunResult || typeof dryRunResult !== "object" || Array.isArray(dryRunResult)) {
    return { ok: false, error: "dryRunResult must be a non-null object." };
  }

  const summary = buildAutomationDryRunRunSummary(dryRunResult, {
    source,
    organisationId,
    actorProfileId,
  });

  const result = await db.createAutomationRun({
    status: "completed",
    summary,
  });

  if (!result.ok || !result.run) {
    return {
      ok: false,
      error: result.error ?? "Failed to create automation run audit record.",
    };
  }

  return { ok: true, run: result.run };
}
