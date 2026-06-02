/**
 * Renew compliance mode mapping (local + cloud RPC).
 */

import { isValidExpiryDate, normalizeExpiryDate } from "./dates.js";

export const RENEWAL_MODES = {
  SUGGESTED: "suggested",
  CUSTOM: "custom",
};

/**
 * @param {string} mode
 * @returns {'suggested' | 'custom' | null}
 */
export function mapRenewalModeToRpc(mode) {
  if (mode === RENEWAL_MODES.SUGGESTED || mode === "suggested") {
    return RENEWAL_MODES.SUGGESTED;
  }

  if (mode === RENEWAL_MODES.CUSTOM || mode === "custom") {
    return RENEWAL_MODES.CUSTOM;
  }

  return null;
}

/**
 * London calendar date as YYYY-MM-DD (matches RPC "today" rule).
 * @param {Date} [date]
 * @returns {string}
 */
export function getLondonDateISOString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

/**
 * Custom renew date: valid ISO date and today or later (Europe/London).
 * Does not require date to be after current record expiry.
 *
 * @param {string} dateString
 * @returns {{ valid: boolean; reason?: 'missing' | 'invalid' | 'before_today' }}
 */
export function validateCustomRenewalDate(dateString) {
  const normalized = normalizeExpiryDate(String(dateString || "").trim());

  if (!normalized) {
    return { valid: false, reason: "missing" };
  }

  if (!isValidExpiryDate(normalized)) {
    return { valid: false, reason: "invalid" };
  }

  const todayLondon = getLondonDateISOString();

  if (normalized < todayLondon) {
    return { valid: false, reason: "before_today" };
  }

  return { valid: true };
}
