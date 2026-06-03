/**
 * Update evidence mapping and validation (local + cloud RPC).
 */

/**
 * @param {string} documentType
 * @returns {string}
 */
export function buildEvidenceUpdatedHistoryDescription(documentType) {
  return `Evidence updated: ${documentType}.`;
}

/**
 * @param {{ name: string; documentType: string }} input
 * @returns {{ valid: boolean; errors: string[]; name?: string; documentType?: string }}
 */
export function validateUpdateEvidenceInput(input) {
  const errors = [];
  const name = String(input.name ?? "").trim();
  const documentType = String(input.documentType ?? "").trim();

  if (!name) {
    errors.push("Document name cannot be blank.");
  }

  if (!documentType) {
    errors.push("Document type cannot be blank.");
  }

  return {
    valid: errors.length === 0,
    errors,
    name,
    documentType,
  };
}

/**
 * @param {{
 *   evidenceId: string;
 *   name: string;
 *   documentType: string;
 *   notes?: string;
 *   addedDate?: string;
 *   fileName?: string | null;
 * }} input
 * @returns {{
 *   p_evidence_id: string;
 *   p_name: string;
 *   p_document_type: string;
 *   p_notes: string;
 *   p_added_date?: string;
 *   p_file_name?: string;
 * }}
 */
export function mapUpdateEvidenceToRpc(input) {
  const rpcArgs = {
    p_evidence_id: input.evidenceId,
    p_name: input.name,
    p_document_type: input.documentType,
    p_notes: input.notes ?? "",
  };

  if (input.addedDate) {
    rpcArgs.p_added_date = input.addedDate;
  }

  if (input.fileName !== undefined && input.fileName !== null) {
    const trimmed = String(input.fileName).trim();

    if (trimmed) {
      rpcArgs.p_file_name = trimmed;
    }
  }

  return rpcArgs;
}
