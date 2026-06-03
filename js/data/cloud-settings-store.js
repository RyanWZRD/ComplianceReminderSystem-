import {
  getOrganisationId,
  isAuthenticated,
  waitForAuthReady,
} from "../auth/session.js";
import { DEFAULT_REMINDER_SETTINGS } from "./constants.js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import {
  mapReminderSettingsFromRow,
  mapReminderSettingsToRpc,
} from "./reminder-settings.js";

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
   * @param {typeof DEFAULT_REMINDER_SETTINGS} nextSettings
   * @returns {Promise<
   *   | { ok: true; status: "updated" }
   *   | { ok: false; error: string }
   * >}
   */
  async updateReminderSettings(nextSettings) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapReminderSettingsToRpc(nextSettings);
    const { data, error } = await supabase.rpc("update_reminder_settings", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object" || data.status !== "updated") {
      return {
        ok: false,
        error: `Unexpected response from update_reminder_settings: ${JSON.stringify(data)}`,
      };
    }

    this.settings = {
      days30: nextSettings.days30 !== false,
      days14: nextSettings.days14 !== false,
      days7: nextSettings.days7 !== false,
      hideSentReminders: nextSettings.hideSentReminders === true,
    };

    return { ok: true, status: "updated" };
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

      this.settings = mapReminderSettingsFromRow(data);

      return { ok: true, isDefault: false };
    } catch (error) {
      const loadError = error instanceof Error ? error : new Error(String(error));
      return { ok: false, isDefault: true, error: loadError };
    }
  }
}
