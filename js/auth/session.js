import { AUTH_MODE } from "./config.js";

/** @typedef {'admin' | 'editor' | 'viewer'} UserRole */

/**
 * @typedef {Object} SessionUser
 * @property {string} userId
 * @property {string} displayName
 * @property {UserRole} role
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

function resolveSessionUser() {
  if (AUTH_MODE === "supabase-preview") {
    // Placeholder until Supabase Auth is wired in a future release.
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

export function initAuth() {
  currentUser = resolveSessionUser();
  renderHeaderUserBadge();
}

export function getCurrentUser() {
  return currentUser ? { ...currentUser } : null;
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

export function renderHeaderUserBadge() {
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
    } else {
      authModeEl.classList.add("hidden");
    }
  }
}

export { AUTH_MODE } from "./config.js";
