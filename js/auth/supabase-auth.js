/**
 * Internal Supabase auth helpers — import only from js/auth/session.js.
 */

import { getSupabaseClient, isSupabaseConfigured } from "../data/supabase-client.js";

/** @typedef {'admin' | 'editor' | 'viewer'} UserRole */

/**
 * @typedef {Object} SessionUser
 * @property {string} userId
 * @property {string} displayName
 * @property {UserRole} role
 * @property {string} organisationId
 */

const VALID_ROLES = /** @type {const} */ (["admin", "editor", "viewer"]);

/**
 * @param {unknown} role
 * @returns {role is UserRole}
 */
function isValidRole(role) {
  return typeof role === "string" && VALID_ROLES.includes(/** @type {UserRole} */ (role));
}

/**
 * @param {{ id: string; organisation_id: string; display_name: string; role: string }} row
 * @returns {SessionUser}
 */
export function mapProfileRowToSessionUser(row) {
  if (!isValidRole(row.role)) {
    throw new Error(`Invalid profile role: ${row.role}`);
  }

  return {
    userId: row.id,
    displayName: row.display_name,
    role: row.role,
    organisationId: row.organisation_id,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<{ ok: true, user: SessionUser } | { ok: false, error: string }>}
 */
export async function fetchProfileForUser(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, organisation_id, display_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return {
      ok: false,
      error: "No organisation profile exists for this account.",
    };
  }

  try {
    return { ok: true, user: mapProfileRowToSessionUser(data) };
  } catch (profileError) {
    const message =
      profileError instanceof Error ? profileError.message : "Invalid profile data.";
    return { ok: false, error: message };
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('@supabase/supabase-js').User} authUser
 * @returns {Promise<{ ok: true, user: SessionUser } | { ok: false, error: string }>}
 */
async function hydrateSessionUser(supabase, authUser) {
  const profileResult = await fetchProfileForUser(supabase, authUser.id);

  if (!profileResult.ok) {
    await supabase.auth.signOut();
    return profileResult;
  }

  return profileResult;
}

/**
 * @returns {Promise<{ ok: true, user: SessionUser } | { ok: false, error: string, user?: null }>}
 */
export async function restoreSessionFromClient() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data.session?.user) {
    return { ok: false, error: "No active session.", user: null };
  }

  return hydrateSessionUser(supabase, data.session.user);
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: true, user: SessionUser } | { ok: false, error: string }>}
 */
export async function signInWithPassword(email, password) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data.user) {
    return { ok: false, error: "Sign-in succeeded but no user was returned." };
  }

  return hydrateSessionUser(supabase, data.user);
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function signOutFromClient() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * @param {(event: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => void} handler
 * @returns {() => void}
 */
export function subscribeToAuthChanges(handler) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange(handler);
  return () => data.subscription.unsubscribe();
}
