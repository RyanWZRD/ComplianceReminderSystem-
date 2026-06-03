/**
 * Delete evidence mapping (cloud RPC).
 */

/**
 * @param {string} documentType
 * @returns {string}
 */
export function buildEvidenceDeletedHistoryDescription(documentType) {
  return `Evidence deleted: ${documentType}.`;
}

/**
 * @param {string} evidenceId
 * @returns {{ p_evidence_id: string }}
 */
export function mapDeleteEvidenceToRpc(evidenceId) {
  return { p_evidence_id: evidenceId };
}
