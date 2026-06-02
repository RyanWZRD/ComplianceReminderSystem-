/**
 * Shared reminder-sent label and duplicate-check logic (local + cloud RPC).
 */

export const REMINDER_UI_LABELS = {
  30: "30 Day Reminder",
  14: "14 Day Reminder",
  7: "7 Day Reminder",
  expired: "Expired",
};

/** @typedef {'30' | '14' | '7' | 'expired'} ReminderRpcType */

/**
 * @param {string} reminderType
 * @returns {string}
 */
export function getReminderSentText(reminderType) {
  if (reminderType === REMINDER_UI_LABELS.expired) {
    return "Expired Reminder Sent";
  }

  return `${reminderType} Sent`;
}

/**
 * @param {string | null | undefined} notes
 * @param {string} reminderType
 * @returns {boolean}
 */
export function isReminderTypeMarkedSent(notes, reminderType) {
  if (!notes) {
    return false;
  }

  const sentLabel = getReminderSentText(reminderType);
  return notes.split(/\r?\n/).some((line) => line.includes(sentLabel));
}

/**
 * Maps UI reminder type strings to RPC codes.
 * @param {string} reminderType
 * @returns {ReminderRpcType | null}
 */
export function mapReminderTypeToRpcCode(reminderType) {
  if (reminderType === REMINDER_UI_LABELS.expired) {
    return "expired";
  }

  if (reminderType === REMINDER_UI_LABELS[30]) {
    return "30";
  }

  if (reminderType === REMINDER_UI_LABELS[14]) {
    return "14";
  }

  if (reminderType === REMINDER_UI_LABELS[7]) {
    return "7";
  }

  return null;
}
