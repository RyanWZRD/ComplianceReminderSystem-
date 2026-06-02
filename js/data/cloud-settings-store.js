import {
  getOrganisationId,
  isAuthenticated,
  waitForAuthReady,
} from "../auth/session.js";
import { DEFAULT_REMINDER_SETTINGS } from "./constants.js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

const READ_ONLY_MESSAGE =
  "Cloud settings store is read-only in this release. Writes are not enabled yet.";

/**
 * @typedef {Object} SettingsLoadResult
 * @property {boolean} ok
 * @property {boolean} isDefault
 * @property {Error} [error]
 */

export class CloudSettingsStore {
  constructor() {
    /** @type {typeof DEFAULT_REMINDER_SETTINGS} */
    this.settings = { ...DEFAULT_REMINDER_SETTINGS };
  }

  get backend() {
    return "cloud";
  }

  save() {
    // Read-only alpha.
  }

  setSettings() {
    throw new Error(READ_ONLY_MESSAGE);
  }

  getSettings() {
    return this.settings;
  }

  /**
   * @returns {Promise<SettingsLoadResult>}
   */
  async load() {
    if (!isSupabaseConfigured()) {
      const error = new Error(
        "Supabase is not configured. Run npm run sync-env after setting .env."
      );
      return { ok: false, isDefault: true, error };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      const error = new Error("Not signed in. Sign in before loading cloud settings.");
      return { ok: false, isDefault: true, error };
    }

    const organisationId = getOrganisationId();

    if (!organisationId) {
      const error = new Error("No organisation on the current session profile.");
      return { ok: false, isDefault: true, error };
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("reminder_settings")
        .select("days_30, days_14, days_7, hide_sent_reminders")
        .eq("organisation_id", organisationId)
        .maybeSingle();

      if (error) {
        return { ok: false, isDefault: true, error: new Error(error.message) };
      }

      if (!data) {
        this.settings = { ...DEFAULT_REMINDER_SETTINGS };
        return { ok: true, isDefault: true };
      }

      this.settings = {
        days30: data.days_30 !== false,
        days14: data.days_14 !== false,
        days7: data.days_7 !== false,
        hideSentReminders: data.hide_sent_reminders === true,
      };

      return { ok: true, isDefault: false };
    } catch (error) {
      const loadError = error instanceof Error ? error : new Error(String(error));
      return { ok: false, isDefault: true, error: loadError };
    }
  }
}
