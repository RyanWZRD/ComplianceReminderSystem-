import { DEFAULT_ACTION_TEMPLATES } from "./default-action-templates.js";

export { DEFAULT_ACTION_TEMPLATES };

/**
 * @param {string} recordId
 * @returns {{ p_record_id: string }}
 */
export function mapAddDefaultActionsToRpc(recordId) {
  return { p_record_id: recordId };
}

/**
 * @param {unknown} data
 * @returns {{
 *   ok: true;
 *   status: "completed";
 *   recordId: string;
 *   addedCount: number;
 *   skippedCount: number;
 *   added: { actionId: string; title: string }[];
 *   skippedTitles: string[];
 * } | { ok: true; status: "not_found" } | { ok: false; error: string }}
 */
export function parseAddDefaultActionsResponse(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Unexpected response from add_default_actions." };
  }

  const status = data.status;

  if (status === "not_found") {
    return { ok: true, status: "not_found" };
  }

  if (status !== "completed") {
    return {
      ok: false,
      error: `Unexpected add_default_actions status: ${String(status)}`,
    };
  }

  const added = Array.isArray(data.added)
    ? data.added
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          actionId: String(item.action_id ?? ""),
          title: typeof item.title === "string" ? item.title : "",
        }))
        .filter((item) => item.actionId && item.title)
    : [];

  const skippedTitles = Array.isArray(data.skipped_titles)
    ? data.skipped_titles.filter((title) => typeof title === "string")
    : [];

  return {
    ok: true,
    status: "completed",
    recordId: String(data.record_id ?? ""),
    addedCount: Number(data.added_count ?? 0),
    skippedCount: Number(data.skipped_count ?? 0),
    added,
    skippedTitles,
  };
}
