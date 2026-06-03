/**
 * Update action metadata mapping and validation (local + cloud RPC).
 */

/**
 * @param {string} title
 * @returns {string}
 */
export function buildActionUpdatedHistoryDescription(title) {
  return `Action updated: ${title}.`;
}

/**
 * @param {{ title: string }} input
 * @returns {{ valid: boolean; errors: string[]; title?: string }}
 */
export function validateUpdateActionInput(input) {
  const errors = [];
  const title = String(input.title ?? "").trim();

  if (!title) {
    errors.push("Action title cannot be blank.");
  }

  return {
    valid: errors.length === 0,
    errors,
    title,
  };
}

/**
 * @param {{
 *   actionId: string;
 *   title: string;
 *   notes?: string;
 *   dueDate?: string | null;
 *   owner?: string;
 * }} input
 * @returns {{
 *   p_action_id: string;
 *   p_title: string;
 *   p_notes: string;
 *   p_due_date?: string;
 *   p_owner: string;
 * }}
 */
export function mapUpdateActionToRpc(input) {
  const rpcArgs = {
    p_action_id: input.actionId,
    p_title: input.title,
    p_notes: input.notes ?? "",
    p_owner: input.owner ?? "",
  };

  if (input.dueDate) {
    rpcArgs.p_due_date = input.dueDate;
  }

  return rpcArgs;
}
