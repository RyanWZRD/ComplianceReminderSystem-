import { DEFAULT_REMINDER_SETTINGS, REMINDER_SETTINGS_KEY } from "./constants.js";

export class LocalSettingsStore {
  constructor() {
    this.settings = { ...DEFAULT_REMINDER_SETTINGS };
  }

  get backend() {
    return "local";
  }

  load() {
    const saved = localStorage.getItem(REMINDER_SETTINGS_KEY);

    if (saved === null) {
      this.settings = { ...DEFAULT_REMINDER_SETTINGS };
      this.save();
      return { ok: true, isDefault: true };
    }

    try {
      const data = JSON.parse(saved);
      this.settings = {
        days30: data.days30 !== false,
        days14: data.days14 !== false,
        days7: data.days7 !== false,
        hideSentReminders: data.hideSentReminders === true,
      };
      return { ok: true, isDefault: false };
    } catch (error) {
      this.settings = { ...DEFAULT_REMINDER_SETTINGS };
      this.save();
      return { ok: false, isDefault: true, error };
    }
  }

  save() {
    localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(this.settings));
  }

  getSettings() {
    return this.settings;
  }

  setSettings(nextSettings) {
    this.settings = { ...nextSettings };
    this.save();
  }
}
