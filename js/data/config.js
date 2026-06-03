/** @typedef {'local' | 'cloud'} DataBackend */

import { STAGING_APP_HOSTNAMES } from "./supabase-env.js";

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
 * Hosts allowed to use ?cloudWrites=1 in the browser.
 * localhost/127.0.0.1 always allowed; staging hostnames come from .env via sync-env.
 * Never enable cloudWrites URL override on production hosts.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isCloudWritesUrlOverrideHostAllowed(hostname) {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }

  return Array.isArray(STAGING_APP_HOSTNAMES) && STAGING_APP_HOSTNAMES.includes(hostname);
}

/**
 * Browser-only: ?cloudWrites=1 on localhost or configured staging hostnames.
 * Not honoured on production domains. Node uses process.env.CLOUD_WRITES_ENABLED.
 * @returns {boolean}
 */
function readCloudWritesFromLocation() {
  if (typeof window === "undefined" || !window.location?.search) {
    return null;
  }

  const hostname = window.location.hostname;

  if (!isCloudWritesUrlOverrideHostAllowed(hostname)) {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get("cloudWrites");

  if (value === "1" || value === "true") {
    return true;
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

/**
 * Enables cloud Mark Reminder Sent (single-record RPC). Default false in git.
 * Node verify/staging: CLOUD_WRITES_ENABLED=true
 * Browser: ?cloudWrites=1 on localhost or STAGING_APP_HOSTNAMES only — never production.
 */
export const CLOUD_WRITES_ENABLED =
  readCloudWritesFromLocation() ??
  (typeof process !== "undefined" && process.env?.CLOUD_WRITES_ENABLED === "true");

export const APP_VERSION = "v3.0.0-rc1";
