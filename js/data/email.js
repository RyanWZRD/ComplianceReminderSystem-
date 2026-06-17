/**
 * Person contact email helpers (V5-1A).
 * Optional fields: empty string means unset; non-empty must pass format check.
 */

/** Practical subset — non-empty values must match after trim + lowercase. */
export const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeEmail(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const trimmed = String(value).trim();

  if (trimmed === "") {
    return "";
  }

  return trimmed.toLowerCase();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidEmail(value) {
  const normalized = normalizeEmail(value);

  if (normalized === "") {
    return true;
  }

  return EMAIL_FORMAT_PATTERN.test(normalized);
}

/**
 * @param {{ email?: unknown; managerEmail?: unknown }} contact
 * @returns {{ ok: true } | { ok: false; field: 'email' | 'managerEmail'; reason: 'invalid_format' }}
 */
export function validatePersonContact(contact = {}) {
  const normalizedEmail = normalizeEmail(contact.email);

  if (normalizedEmail !== "" && !EMAIL_FORMAT_PATTERN.test(normalizedEmail)) {
    return { ok: false, field: "email", reason: "invalid_format" };
  }

  const normalizedManagerEmail = normalizeEmail(contact.managerEmail);

  if (
    normalizedManagerEmail !== "" &&
    !EMAIL_FORMAT_PATTERN.test(normalizedManagerEmail)
  ) {
    return { ok: false, field: "managerEmail", reason: "invalid_format" };
  }

  return { ok: true };
}

/**
 * Normalize optional person contact fields from app or Postgres-shaped sources.
 *
 * @param {Record<string, unknown>} source
 * @returns {{ email: string; managerEmail: string }}
 */
export function normalizePersonContactFields(source = {}) {
  const email = typeof source.email === "string" ? normalizeEmail(source.email) : "";

  const managerEmail =
    typeof source.managerEmail === "string"
      ? normalizeEmail(source.managerEmail)
      : typeof source.manager_email === "string"
        ? normalizeEmail(source.manager_email)
        : "";

  return { email, managerEmail };
}
