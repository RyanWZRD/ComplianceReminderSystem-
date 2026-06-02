/**
 * Create compliance record mapping and validation (local + cloud RPC).
 */

import { DEFAULT_RENEWAL_CYCLE } from "./constants.js";
import { isValidExpiryDate, normalizeExpiryDate, parseDateAtMidnight } from "./dates.js";

/**
 * @param {string} dateString
 * @returns {string}
 */
export function formatCreatedExpiryDisplay(dateString) {
  const date = parseDateAtMidnight(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * @param {string} complianceType
 * @param {string} expiryDate
 * @returns {string}
 */
export function buildCreatedHistoryDescription(complianceType, expiryDate) {
  return `Record created (${complianceType}, expires ${formatCreatedExpiryDisplay(expiryDate)}).`;
}

/**
 * @param {{
 *   name: string;
 *   role: string;
 *   complianceType: string;
 *   expiryDate: string;
 * }} input
 * @returns {{ valid: boolean; errors: string[]; name?: string; role?: string; complianceType?: string; expiryDate?: string }}
 */
export function validateCreateComplianceRecordInput(input) {
  const errors = [];
  const name = String(input.name ?? "").trim();
  const role = String(input.role ?? "").trim();
  const complianceType = String(input.complianceType ?? "").trim();
  const expiryDate = normalizeExpiryDate(String(input.expiryDate ?? "").trim());

  if (!name) {
    errors.push("Name cannot be blank.");
  }

  if (!role) {
    errors.push("Role cannot be blank.");
  }

  if (!complianceType) {
    errors.push("Compliance type cannot be blank.");
  }

  if (!expiryDate) {
    errors.push("Expiry date is required.");
  } else if (!isValidExpiryDate(expiryDate)) {
    errors.push("Expiry date must be a valid date (YYYY-MM-DD).");
  }

  return {
    valid: errors.length === 0,
    errors,
    name,
    role,
    complianceType,
    expiryDate,
  };
}

/**
 * @param {{
 *   name: string;
 *   role: string;
 *   complianceType: string;
 *   expiryDate: string;
 *   renewalCycle?: string;
 * }} input
 * @returns {{
 *   p_name: string;
 *   p_role: string;
 *   p_compliance_type: string;
 *   p_expiry_date: string;
 *   p_renewal_cycle?: string;
 * }}
 */
export function mapCreateComplianceRecordToRpc(input) {
  const rpcArgs = {
    p_name: input.name,
    p_role: input.role,
    p_compliance_type: input.complianceType,
    p_expiry_date: input.expiryDate,
  };

  if (input.renewalCycle !== undefined && input.renewalCycle !== null && input.renewalCycle !== "") {
    rpcArgs.p_renewal_cycle = input.renewalCycle;
  } else {
    rpcArgs.p_renewal_cycle = DEFAULT_RENEWAL_CYCLE;
  }

  return rpcArgs;
}
