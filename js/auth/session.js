import { isSupabaseConfigured } from "../data/supabase-client.js";
import { AUTH_MODE } from "./config.js";
import {
  restoreSessionFromClient,
  signInWithPassword as supabaseSignIn,
  signOutFromClient,
  subscribeToAuthChanges,
} from "./supabase-auth.js";

/** @typedef {'admin' | 'editor' | 'viewer'} UserRole */

/**
 * @typedef {Object} SessionUser
 * @property {string} userId
 * @property {string} displayName
 * @property {UserRole} role
 * @property {string} [organisationId] — present in supabase mode
 */

const LOCAL_SESSION_USER = {
  userId: "local-user",
  displayName: "Local User",
  role: "admin",
};

const SUPABASE_PREVIEW_SESSION_USER = {
  userId: "supabase-preview-user",
  displayName: "Preview User",
  role: "admin",
};

/** @type {SessionUser | null} */
let currentUser = null;

/** @type {Promise<void> | null} */
let authReadyPromise = null;

/** @type {(() => void) | null} */
let unsubscribeAuth = null;

function resolveSessionUser() {
  if (AUTH_MODE === "supabase-preview") {
    return { ...SUPABASE_PREVIEW_SESSION_USER };
  }

  return { ...LOCAL_SESSION_USER };
}

function formatRoleLabel(role) {
  if (!role || typeof role !== "string") {
    return "—";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function requireSupabaseAuthMode(methodName) {
  if (AUTH_MODE !== "supabase") {
    throw new Error(`${methodName} is only available when AUTH_MODE is "supabase".`);
  }
}

/**
 * @param {SessionUser | null} user
 */
function setCurrentUser(user) {
  currentUser = user ? { ...user } : null;
}

function initLocalAuth() {
  currentUser = resolveSessionUser();
  renderHeaderUserBadge();
}

function initSupabaseAuth() {
  if (!isSupabaseConfigured()) {
    console.error(
      "AUTH_MODE is supabase but Supabase is not configured. Run npm run sync-env."
    );
    currentUser = null;
    authReadyPromise = Promise.resolve();
    renderHeaderUserBadge();
    return;
  }

  currentUser = null;
  authReadyPromise = restoreSupabaseSession();

  if (unsubscribeAuth) {
    unsubscribeAuth();
  }

  unsubscribeAuth = subscribeToAuthChanges((event) => {
    if (event === "SIGNED_OUT") {
      setCurrentUser(null);
      renderHeaderUserBadge();
      return;
    }

    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      authReadyPromise = restoreSupabaseSession();
    }
  });

  renderHeaderUserBadge();
}

/**
 * @returns {Promise<void>}
 */
async function restoreSupabaseSession() {
  const result = await restoreSessionFromClient();

  if (result.ok) {
    setCurrentUser(result.user);
  } else {
    setCurrentUser(null);
  }

  renderHeaderUserBadge();
}

export function initAuth() {
  if (AUTH_MODE === "supabase") {
    initSupabaseAuth();
    return;
  }

  initLocalAuth();
}

export function getCurrentUser() {
  return currentUser ? { ...currentUser } : null;
}

export function getOrganisationId() {
  return currentUser?.organisationId ?? null;
}

export function isAuthenticated() {
  return currentUser !== null;
}

export function getCurrentUserRole() {
  return currentUser?.role ?? null;
}

export function canView() {
  if (!isAuthenticated()) {
    return false;
  }

  const role = getCurrentUserRole();
  return role === "admin" || role === "editor" || role === "viewer";
}

export function canEdit() {
  if (!isAuthenticated()) {
    return false;
  }

  const role = getCurrentUserRole();
  return role === "admin" || role === "editor";
}

export function canAdmin() {
  return getCurrentUserRole() === "admin";
}

/**
 * @returns {Promise<void>}
 */
export function waitForAuthReady() {
  if (AUTH_MODE !== "supabase") {
    return Promise.resolve();
  }

  if (!authReadyPromise) {
    authReadyPromise = restoreSupabaseSession();
  }

  return authReadyPromise;
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: true, user: SessionUser } | { ok: false, error: string }>}
 */
export async function signInWithPassword(email, password) {
  requireSupabaseAuthMode("signInWithPassword");

  const result = await supabaseSignIn(email, password);

  if (result.ok) {
    setCurrentUser(result.user);
    renderHeaderUserBadge();
  } else {
    setCurrentUser(null);
    renderHeaderUserBadge();
  }

  return result;
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function signOut() {
  requireSupabaseAuthMode("signOut");

  const result = await signOutFromClient();
  setCurrentUser(null);
  renderHeaderUserBadge();
  return result;
}

function isBrowserDocumentAvailable() {
  return typeof document !== "undefined" && document !== null;
}

export function renderHeaderUserBadge() {
  if (!isBrowserDocumentAvailable()) {
    return;
  }

  const nameEl = document.getElementById("header-user-name");
  const roleEl = document.getElementById("header-user-role");
  const authModeEl = document.getElementById("auth-mode-badge");

  if (!currentUser) {
    if (nameEl) {
      nameEl.textContent = "—";
    }
    if (roleEl) {
      roleEl.textContent = "—";
    }

    if (authModeEl && AUTH_MODE === "supabase") {
      authModeEl.textContent = "Supabase";
      authModeEl.classList.remove("hidden");
    }

    return;
  }

  if (nameEl) {
    nameEl.textContent = currentUser.displayName;
  }

  if (roleEl) {
    roleEl.textContent = formatRoleLabel(currentUser.role);
  }

  if (authModeEl) {
    if (AUTH_MODE === "supabase-preview") {
      authModeEl.textContent = "Supabase preview";
      authModeEl.classList.remove("hidden");
    } else if (AUTH_MODE === "supabase") {
      authModeEl.textContent = "Supabase";
      authModeEl.classList.remove("hidden");
    } else {
      authModeEl.classList.add("hidden");
    }
  }
}

export { AUTH_MODE } from "./config.js";
