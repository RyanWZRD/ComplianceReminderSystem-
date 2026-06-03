/**
 * Archive (delete) compliance record mapping (cloud RPC).
 */

import { formatCreatedExpiryDisplay } from "./create-compliance-record.js";

/**
 * @param {string} complianceType
 * @param {string} expiryDate
 * @returns {string}
 */
export function buildRecordDeletedHistoryDescription(complianceType, expiryDate) {
  return `Record deleted (${complianceType}, expires ${formatCreatedExpiryDisplay(expiryDate)}).`;
}

/**
 * @param {string} recordId
 * @returns {{ p_record_id: string }}
 */
export function mapArchiveComplianceRecordToRpc(recordId) {
  return { p_record_id: recordId };
}
