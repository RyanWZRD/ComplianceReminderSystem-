/**
 * Compliance record notes RPC mapping (cloud workspace save).
 */

/**
 * @param {{ recordId: string; notes: string }} input
 * @returns {{ p_record_id: string; p_notes: string }}
 */
export function mapUpdateComplianceRecordNotesToRpc(input) {
  return {
    p_record_id: input.recordId,
    p_notes: input.notes ?? "",
  };
}
