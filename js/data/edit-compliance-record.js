/**
 * Edit compliance record mapping and validation (local + cloud RPC).
 * Notes are not editable in cloud Step 11 — RPC does not touch notes.
 */

import { isValidExpiryDate, normalizeExpiryDate } from "./dates.js";

/**
 * @param {{
 *   name: string;
 *   role: string;
 *   complianceType: string;
 *   expiryDate: string;
 *   renewalCycle: string;
 * }} input
 * @returns {{
 *   valid: boolean;
 *   errors: string[];
 *   name?: string;
 *   role?: string;
 *   complianceType?: string;
 *   expiryDate?: string;
 *   renewalCycle?: string;
 * }}
 */
export function validateEditComplianceRecordInput(input) {
  const errors = [];
  const name = String(input.name ?? "").trim();
  const role = String(input.role ?? "").trim();
  const complianceType = String(input.complianceType ?? "").trim();
  const expiryDate = normalizeExpiryDate(String(input.expiryDate ?? "").trim());
  const renewalCycle = String(input.renewalCycle ?? "").trim();

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

  if (!renewalCycle) {
    errors.push("Renewal cycle is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    name,
    role,
    complianceType,
    expiryDate,
    renewalCycle,
  };
}

/**
 * @param {{
 *   personId: string;
 *   recordId: string;
 *   name: string;
 *   role: string;
 *   complianceType: string;
 *   expiryDate: string;
 *   renewalCycle: string;
 * }} input
 * @returns {{
 *   p_person_id: string;
 *   p_record_id: string;
 *   p_name: string;
 *   p_role: string;
 *   p_compliance_type: string;
 *   p_expiry_date: string;
 *   p_renewal_cycle: string;
 * }}
 */
export function mapEditComplianceRecordToRpc(input) {
  return {
    p_person_id: input.personId,
    p_record_id: input.recordId,
    p_name: input.name,
    p_role: input.role,
    p_compliance_type: input.complianceType,
    p_expiry_date: input.expiryDate,
    p_renewal_cycle: input.renewalCycle,
  };
}
