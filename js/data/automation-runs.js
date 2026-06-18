/**
 * Automation run mapping (cloud RPC).
 */

/**
 * @typedef {Object} AutomationRunView
 * @property {string} id
 * @property {string} startedAt
 * @property {string | null} completedAt
 * @property {import('./cloud-mapper.js').AutomationRunStatus} status
 * @property {import('./cloud-mapper.js').AutomationRunSummary | object} summary
 * @property {string | null} error
 * @property {string} createdAt
 */

/**
 * @param {{
 *   id: string;
 *   started_at: string;
 *   completed_at?: string | null;
 *   status: string;
 *   summary?: object;
 *   error?: string | null;
 *   created_at: string;
 * }} row
 * @returns {AutomationRunView}
 */
export function mapAutomationRunFromRpc(row) {
  return {
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    status: /** @type {import('./cloud-mapper.js').AutomationRunStatus} */ (row.status),
    summary: row.summary ?? {},
    error: row.error ?? null,
    createdAt: row.created_at,
  };
}
