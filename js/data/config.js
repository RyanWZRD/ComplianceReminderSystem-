/** @typedef {'local' | 'cloud'} DataBackend */

/**
 * @returns {DataBackend | null}
 */
function readBackendFromLocation() {
  if (typeof window === "undefined" || !window.location?.search) {
    return null;
  }

  const backend = new URLSearchParams(window.location.search).get("backend");

  if (backend === "cloud") {
    return "cloud";
  }

  if (backend === "local") {
    return "local";
  }

  return null;
}

/**
 * Committed default is local. Node: process.env.DATA_BACKEND=cloud. Browser dev: ?backend=cloud
 * @type {DataBackend}
 */
export const DATA_BACKEND =
  readBackendFromLocation() ??
  (typeof process !== "undefined" && process.env?.DATA_BACKEND === "cloud" ? "cloud" : "local");

export const APP_VERSION = "3.0.0-alpha-phase2-step5";
