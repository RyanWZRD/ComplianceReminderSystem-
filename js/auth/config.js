/** @typedef {'local' | 'supabase-preview' | 'supabase'} AuthMode */

/**
 * @returns {AuthMode | null}
 */
function readAuthFromLocation() {
  if (typeof window === "undefined" || !window.location?.search) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");

  if (auth === "supabase" || auth === "supabase-preview" || auth === "local") {
    return auth;
  }

  if (params.get("backend") === "cloud") {
    return "supabase";
  }

  return null;
}

/**
 * Browser default is local. Node: process.env.AUTH_MODE. Cloud browser dev: ?backend=cloud → supabase
 * @type {AuthMode}
 */
export const AUTH_MODE =
  readAuthFromLocation() ??
  (typeof process !== "undefined" && process.env?.AUTH_MODE === "supabase"
    ? "supabase"
    : typeof process !== "undefined" && process.env?.AUTH_MODE === "supabase-preview"
      ? "supabase-preview"
      : "local");
