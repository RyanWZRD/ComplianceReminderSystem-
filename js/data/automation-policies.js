/**
 * Automation policy mapping (cloud RPC).
 */

/** @type {readonly import('./cloud-mapper.js').AutomationPolicyType[]} */
export const AUTOMATION_POLICY_TYPES = [
  "reminder_digest",
  "action_orchestration",
  "escalation",
];

/**
 * @typedef {Object} AutomationPolicyInput
 * @property {import('./cloud-mapper.js').AutomationPolicyType} policyType
 * @property {import('./cloud-mapper.js').AutomationPolicyDocument | object} policy
 * @property {boolean} [enabled]
 * @property {number} [version]
 */

/**
 * @typedef {Object} AutomationPolicyView
 * @property {string} id
 * @property {import('./cloud-mapper.js').AutomationPolicyType} policyType
 * @property {import('./cloud-mapper.js').AutomationPolicyDocument | object} policy
 * @property {boolean} enabled
 * @property {number} version
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {AutomationPolicyInput} input
 * @returns {{
 *   p_policy_type: string;
 *   p_policy: object;
 *   p_enabled: boolean;
 *   p_version: number;
 * }}
 */
export function mapAutomationPolicyToRpc(input) {
  return {
    p_policy_type: input.policyType,
    p_policy: input.policy,
    p_enabled: input.enabled === true,
    p_version: input.version ?? 1,
  };
}

/**
 * @param {{
 *   id: string;
 *   policy_type: string;
 *   policy: object;
 *   enabled?: boolean;
 *   version?: number;
 *   created_at: string;
 *   updated_at: string;
 * }} row
 * @returns {AutomationPolicyView}
 */
export function mapAutomationPolicyFromRpc(row) {
  return {
    id: row.id,
    policyType: /** @type {import('./cloud-mapper.js').AutomationPolicyType} */ (row.policy_type),
    policy: row.policy,
    enabled: row.enabled === true,
    version: typeof row.version === "number" ? row.version : 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {unknown} value
 * @returns {value is import('./cloud-mapper.js').AutomationPolicyType}
 */
export function isAutomationPolicyType(value) {
  return typeof value === "string" && AUTOMATION_POLICY_TYPES.includes(value);
}
