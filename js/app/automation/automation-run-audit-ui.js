/**
 * V5-0 Phase 7: Automation run audit UI helpers.
 * Read-only display mapping for automation_runs rows — no execution hooks.
 */

/** @typedef {import("../../data/automation-runs.js").AutomationRunView} AutomationRunView */

export const AUTOMATION_RUN_EXECUTION_COUNTER_KEYS = [
  "policiesApplied",
  "policiesSkipped",
  "remindersQueued",
  "remindersSent",
  "actionsCreated",
  "escalationsFired",
];

export const AUTOMATION_RUN_AUDIT_COLUMNS = [
  { key: "runAt", label: "Run date/time" },
  { key: "runType", label: "Run type" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "totalRecords", label: "Records scanned" },
  { key: "reminderCandidatesTotal", label: "Reminder candidates" },
  { key: "actionCandidatesTotal", label: "Action candidates" },
  { key: "executionCounters", label: "Execution counters" },
  { key: "actions", label: "" },
];

const EXECUTION_COUNTER_LABELS = {
  policiesApplied: "Policies applied",
  policiesSkipped: "Policies skipped",
  remindersQueued: "Reminders queued",
  remindersSent: "Reminders sent",
  actionsCreated: "Actions created",
  escalationsFired: "Escalations fired",
};

/**
 * @param {string | null | undefined} isoString
 * @returns {string}
 */
export function formatAutomationRunTimestamp(isoString) {
  if (typeof isoString !== "string" || !isoString.trim()) {
    return "—";
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @param {object | null | undefined} actionCandidates
 * @returns {number | null}
 */
export function computeActionCandidatesTotal(actionCandidates) {
  if (!actionCandidates || typeof actionCandidates !== "object" || Array.isArray(actionCandidates)) {
    return null;
  }

  const values = [
    actionCandidates.expiredRecords,
    actionCandidates.criticalEvidenceGaps,
    actionCandidates.missingFollowUp,
  ];

  if (values.some((value) => typeof value !== "number" || Number.isNaN(value))) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0);
}

/**
 * @param {object} summary
 * @returns {string}
 */
export function formatAutomationRunExecutionCounters(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return "—";
  }

  const parts = AUTOMATION_RUN_EXECUTION_COUNTER_KEYS.map((key) => {
    const value = summary[key];
    const label = EXECUTION_COUNTER_LABELS[key] ?? key;
    const display = typeof value === "number" && !Number.isNaN(value) ? String(value) : "—";
    return `${label}: ${display}`;
  });

  return parts.join(" · ");
}

/**
 * @param {AutomationRunView} run
 * @returns {{
 *   id: string;
 *   runAt: string;
 *   runType: string;
 *   status: string;
 *   source: string;
 *   totalRecords: string;
 *   reminderCandidatesTotal: string;
 *   actionCandidatesTotal: string;
 *   executionCounters: string;
 *   summaryJson: string;
 * }}
 */
export function mapAutomationRunToAuditRow(run) {
  const summary = run?.summary && typeof run.summary === "object" ? run.summary : {};
  const dryRun =
    summary.dryRun && typeof summary.dryRun === "object" && !Array.isArray(summary.dryRun)
      ? summary.dryRun
      : null;

  const runAt = formatAutomationRunTimestamp(run.startedAt || run.completedAt || run.createdAt);
  const runType = typeof summary.runType === "string" && summary.runType.trim() ? summary.runType : "—";
  const status = typeof run.status === "string" && run.status.trim() ? run.status : "—";
  const source = typeof summary.source === "string" && summary.source.trim() ? summary.source : "—";

  const totalRecords =
    dryRun && typeof dryRun.totalRecords === "number" && !Number.isNaN(dryRun.totalRecords)
      ? String(dryRun.totalRecords)
      : "—";

  const reminderCandidatesTotal =
    dryRun?.reminderCandidates &&
    typeof dryRun.reminderCandidates.total === "number" &&
    !Number.isNaN(dryRun.reminderCandidates.total)
      ? String(dryRun.reminderCandidates.total)
      : "—";

  const actionTotalValue = dryRun ? computeActionCandidatesTotal(dryRun.actionCandidates) : null;
  const actionCandidatesTotal =
    actionTotalValue === null ? "—" : String(actionTotalValue);

  return {
    id: run.id,
    runAt,
    runType,
    status,
    source,
    totalRecords,
    reminderCandidatesTotal,
    actionCandidatesTotal,
    executionCounters: formatAutomationRunExecutionCounters(summary),
    summaryJson: JSON.stringify(summary, null, 2),
  };
}

/**
 * @param {AutomationRunView[]} runs
 * @returns {ReturnType<typeof mapAutomationRunToAuditRow>[]}
 */
export function mapAutomationRunsToAuditRows(runs) {
  if (!Array.isArray(runs)) {
    return [];
  }

  return runs.map((run) => mapAutomationRunToAuditRow(run));
}
