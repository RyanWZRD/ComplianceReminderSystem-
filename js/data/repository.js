import { DATA_BACKEND } from "./config.js";
import { CloudComplianceStore } from "./cloud-store.js";
import { CloudSettingsStore } from "./cloud-settings-store.js";
import { LocalComplianceStore } from "./local-store.js";
import { LocalSettingsStore } from "./settings-store.js";

export { CloudComplianceStore } from "./cloud-store.js";
export { CloudSettingsStore } from "./cloud-settings-store.js";

export function isCloudDataBackend() {
  return DATA_BACKEND === "cloud";
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
