/**
 * V5-2 Phase 5: Reminder digest preview UI helpers.
 * Read-only digest preview mapping for queue items — no delivery or writes.
 */

export const REMINDER_DIGEST_PREVIEW_SAFETY_NOTE =
  "Digest preview only — no email is sent.";

export const REMINDER_DIGEST_COPY_BUTTON_LABEL = "Copy digest";

export const REMINDER_DIGEST_COPY_SUCCESS_MESSAGE = "Digest copied.";

export const REMINDER_DIGEST_COPY_UNAVAILABLE_MESSAGE =
  "Copy is not available in this browser.";

/**
 * @param {{ subject: string; bodyText: string }} digest
 * @returns {string}
 */
export function buildReminderDigestCopyText(digest) {
  return `Subject: ${digest.subject}\n\n${digest.bodyText}`;
}

/**
 * @param {import("./reminder-digest-builder.js").ReminderDigestMetadata} metadata
 * @returns {{
 *   totalQueued: string;
 *   missingEmail: string;
 *   expired: string;
 *   day30: string;
 *   day14: string;
 *   day7: string;
 * }}
 */
export function mapReminderDigestPreviewMetadata(metadata) {
  return {
    totalQueued: String(metadata.totalQueued),
    missingEmail: String(metadata.missingEmail),
    expired: String(metadata.byWindow.expired),
    day30: String(metadata.byWindow["30-day"]),
    day14: String(metadata.byWindow["14-day"]),
    day7: String(metadata.byWindow["7-day"]),
  };
}
