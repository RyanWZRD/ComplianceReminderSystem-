/**
 * V6 Phase 65: Read-only cloud helpers for automation_runs visibility.
 * Direct SELECT only — RLS enforces org and role access.
 */

import {
  getOrganisationId,
  isAuthenticated,
  waitForAuthReady,
} from "../../auth/session.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../data/supabase-client.js";

const AUTOMATION_RUN_SELECT_COLUMNS = [
  "id",
  "organisation_id",
  "automation_run_id",
  "run_type",
  "mode",
  "as_of_date",
  "started_at",
  "completed_at",
  "status",
  "summary",
  "error",
  "created_at",
  "total_candidates",
  "with_email",
  "missing_email",
  "would_send",
  "would_skip",
].join(", ");

/**
 * @typedef {Object} AutomationRunVisibilityView
 * @property {string} id
 * @property {string} organisationId
 * @property {string} automationRunId
 * @property {string} runType
 * @property {string} mode
 * @property {string | null} asOfDate
 * @property {string} startedAt
 * @property {string | null} completedAt
 * @property {string} status
 * @property {object} summary
 * @property {string | null} error
 * @property {string} createdAt
 * @property {number} totalCandidates
 * @property {number} withEmail
 * @property {number} missingEmail
 * @property {number} wouldSend
 * @property {number} wouldSkip
 */

/**
 * @typedef {Object} AutomationRunVisibilitySummary
 * @property {number} totalCandidates
 * @property {number} wouldSend
 * @property {number} skipped
 * @property {number} failed
 * @property {number} sent
 * @property {number} pending
 */

/**
 * @typedef {Object} AutomationRunsLoadResult
 * @property {boolean} ok
 * @property {AutomationRunVisibilityView[]} [runs]
 * @property {Error | string} [error]
 */

/**
 * @param {unknown} value
 * @returns {number}
 */
function toCount(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value : 0;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {AutomationRunVisibilityView}
 */
export function mapAutomationRunFromRow(row) {
  return {
    id: String(row.id ?? ""),
    organisationId: String(row.organisation_id ?? ""),
    automationRunId: String(row.automation_run_id ?? ""),
    runType: typeof row.run_type === "string" ? row.run_type : "",
    mode: typeof row.mode === "string" ? row.mode : "",
    asOfDate: typeof row.as_of_date === "string" ? row.as_of_date : null,
    startedAt: String(row.started_at ?? ""),
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    status: typeof row.status === "string" ? row.status : "",
    summary:
      row.summary && typeof row.summary === "object" && !Array.isArray(row.summary)
        ? row.summary
        : {},
    error: typeof row.error === "string" ? row.error : null,
    createdAt: String(row.created_at ?? ""),
    totalCandidates: toCount(row.total_candidates),
    withEmail: toCount(row.with_email),
    missingEmail: toCount(row.missing_email),
    wouldSend: toCount(row.would_send),
    wouldSkip: toCount(row.would_skip),
  };
}

/**
 * @param {AutomationRunVisibilityView} run
 * @param {import("./delivery-logs.js").DeliveryLogVisibilityView[]} logs
 * @returns {AutomationRunVisibilitySummary}
 */
export function summariseAutomationRun(run, logs) {
  const logEntries = Array.isArray(logs) ? logs : [];

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let pending = 0;

  for (const log of logEntries) {
    const status = String(log.deliveryStatus ?? "").toLowerCase();

    if (status === "sent") {
      sent += 1;
    } else if (status === "skipped") {
      skipped += 1;
    } else if (status === "failed") {
      failed += 1;
    } else if (status === "pending") {
      pending += 1;
    }
  }

  const totalCandidates = run.totalCandidates > 0 ? run.totalCandidates : logEntries.length;
  const wouldSend = run.wouldSend > 0 ? run.wouldSend : pending + sent + failed;
  const skippedCount = logEntries.length > 0 ? skipped : run.wouldSkip;

  return {
    totalCandidates,
    wouldSend,
    skipped: skippedCount,
    failed,
    sent,
    pending,
  };
}

/**
 * @param {{ organisationId?: string; limit?: number }} [options]
 * @returns {Promise<AutomationRunsLoadResult>}
 */
export async function loadAutomationRuns(options = {}) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is not configured. Run npm run sync-env after setting .env.",
    };
  }

  await waitForAuthReady();

  if (!isAuthenticated()) {
    return { ok: false, error: "Not signed in. Sign in before loading automation runs." };
  }

  const sessionOrganisationId = getOrganisationId();
  const organisationId = options.organisationId ?? sessionOrganisationId;

  if (!organisationId) {
    return { ok: false, error: "No organisation on the current session profile." };
  }

  if (sessionOrganisationId && organisationId !== sessionOrganisationId) {
    return { ok: false, error: "Organisation mismatch for automation run read." };
  }

  const limit = typeof options.limit === "number" && options.limit > 0 ? options.limit : 25;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("automation_runs")
      .select(AUTOMATION_RUN_SELECT_COLUMNS)
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { ok: false, error: error.message };
    }

    const runs = (data ?? []).map((row) => mapAutomationRunFromRow(row));

    return { ok: true, runs };
  } catch (error) {
    const loadError = error instanceof Error ? error : new Error(String(error));
    return { ok: false, error: loadError };
  }
}
