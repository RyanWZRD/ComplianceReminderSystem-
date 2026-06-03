/**
 * Reminder settings mapping (local + cloud RPC).
 */

/**
 * @param {{
 *   days30: boolean;
 *   days14: boolean;
 *   days7: boolean;
 *   hideSentReminders: boolean;
 * }} settings
 * @returns {{
 *   p_days_30: boolean;
 *   p_days_14: boolean;
 *   p_days_7: boolean;
 *   p_hide_sent_reminders: boolean;
 * }}
 */
export function mapReminderSettingsToRpc(settings) {
  return {
    p_days_30: settings.days30 !== false,
    p_days_14: settings.days14 !== false,
    p_days_7: settings.days7 !== false,
    p_hide_sent_reminders: settings.hideSentReminders === true,
  };
}

/**
 * @param {{
 *   days_30?: boolean;
 *   days_14?: boolean;
 *   days_7?: boolean;
 *   hide_sent_reminders?: boolean;
 * }} row
 * @returns {{
 *   days30: boolean;
 *   days14: boolean;
 *   days7: boolean;
 *   hideSentReminders: boolean;
 * }}
 */
export function mapReminderSettingsFromRow(row) {
  return {
    days30: row.days_30 !== false,
    days14: row.days_14 !== false,
    days7: row.days_7 !== false,
    hideSentReminders: row.hide_sent_reminders === true,
  };
}
