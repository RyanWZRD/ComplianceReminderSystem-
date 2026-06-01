import { DATA_BACKEND } from "./config.js";
import { LocalComplianceStore } from "./local-store.js";
import { LocalSettingsStore } from "./settings-store.js";

export class CloudComplianceStore {
  get backend() {
    return "cloud";
  }

  throwUnavailable() {
    throw new Error(
      "Cloud data backend is not configured yet. Set DATA_BACKEND to 'local' in js/data/config.js."
    );
  }

  get people() {
    this.throwUnavailable();
  }

  set people(_value) {
    this.throwUnavailable();
  }

  save() {
    this.throwUnavailable();
  }

  load() {
    this.throwUnavailable();
  }

  buildBackup() {
    this.throwUnavailable();
  }

  validateBackupDryRun() {
    this.throwUnavailable();
  }

  applyBackup() {
    this.throwUnavailable();
  }

  normalizePerson() {
    this.throwUnavailable();
  }

  normalizeComplianceType() {
    this.throwUnavailable();
  }

  normalizeDocumentType() {
    this.throwUnavailable();
  }

  syncAllIds() {
    this.throwUnavailable();
  }
}

export class CloudSettingsStore {
  get backend() {
    return "cloud";
  }

  load() {
    throw new Error("Cloud settings backend is not configured yet.");
  }

  save() {
    throw new Error("Cloud settings backend is not configured yet.");
  }

  getSettings() {
    throw new Error("Cloud settings backend is not configured yet.");
  }

  setSettings() {
    throw new Error("Cloud settings backend is not configured yet.");
  }
}

function createComplianceStore() {
  if (DATA_BACKEND === "cloud") {
    return new CloudComplianceStore();
  }

  return new LocalComplianceStore();
}

function createSettingsStore() {
  if (DATA_BACKEND === "cloud") {
    return new CloudSettingsStore();
  }

  return new LocalSettingsStore();
}

/** @type {LocalComplianceStore | CloudComplianceStore} */
export const repository = createComplianceStore();

/** @type {LocalSettingsStore | CloudSettingsStore} */
export const settingsRepository = createSettingsStore();

export { DATA_BACKEND } from "./config.js";
export { APP_VERSION } from "./config.js";
