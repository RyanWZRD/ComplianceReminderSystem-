/**
 * V6 Phase 45: Scheduled automation runner dry-run candidate summary.
 * Reuses the same reminder queue computation as Manual Delivery Test preview.
 * Read-only — no delivery, mark-sent, automation run writes, or compliance mutation.
 */

import { DEFAULT_REMINDER_SETTINGS } from "../../data/constants.js";
import { computeAutomationDryRun } from "./automation-dry-run.js";
import { buildReminderQueueFromDryRun } from "./reminder-queue.js";

export const SCHEDULED_RUNNER_DRY_RUN_MODE = "dry_run";

/**
 * @param {{
 *   total: number;
 *   withEmail: number;
 *   missingEmail: number;
 * }} queueSummary
 * @returns {{
 *   totalCandidates: number;
 *   withEmail: number;
 *   missingEmail: number;
 *   wouldSend: number;
 *   wouldSkip: number;
 * }}
 */
export function mapQueueSummaryToScheduledRunnerSummary(queueSummary) {
  const totalCandidates = Number(queueSummary?.total ?? 0);
  const withEmail = Number(queueSummary?.withEmail ?? 0);
  const missingEmail = Number(queueSummary?.missingEmail ?? 0);

  return {
    totalCandidates,
    withEmail,
    missingEmail,
    wouldSend: withEmail,
    wouldSkip: missingEmail,
  };
}

/**
 * Compute scheduled runner dry-run summary from compliance rows.
 * Matches Manual Delivery Test queue preview (`buildReminderQueuePreviewData`).
 *
 * @param {{
 *   rows: object[];
 *   settings?: object;
 *   asOfDate?: string | null;
 *   organisationId?: string | null;
 * }} input
 */
export function computeScheduledRunnerDryRunSummary({
  rows,
  settings = DEFAULT_REMINDER_SETTINGS,
  asOfDate,
  organisationId,
}) {
  const inputRows = Array.isArray(rows) ? rows : [];
  const dryRunResult = computeAutomationDryRun(inputRows, settings, asOfDate);
  const queue = buildReminderQueueFromDryRun({
    dryRunResult,
    asOfDate: dryRunResult.asOfDate,
    rows: inputRows,
    settings,
  });

  const resolvedOrganisationId = String(organisationId ?? "").trim();

  return {
    status: "ok",
    mode: SCHEDULED_RUNNER_DRY_RUN_MODE,
    asOfDate: queue.asOfDate,
    ...(resolvedOrganisationId ? { organisationId: resolvedOrganisationId } : {}),
    summary: mapQueueSummaryToScheduledRunnerSummary(queue.summary),
  };
}
