/** @typedef {'local' | 'supabase-preview' | 'supabase'} AuthMode */

/**
 * Browser default is local. Node scripts may set process.env.AUTH_MODE before importing session.js.
 * @type {AuthMode}
 */
export const AUTH_MODE =
  typeof process !== "undefined" && process.env?.AUTH_MODE === "supabase"
    ? "supabase"
    : typeof process !== "undefined" && process.env?.AUTH_MODE === "supabase-preview"
      ? "supabase-preview"
      : "local";
