import { DATA_BACKEND } from "../data/config.js";
import { canAdmin } from "../auth/session.js";

export function isCloudMode() {
  return DATA_BACKEND === "cloud";
}

export function isCloudReadOnly() {
  return isCloudMode();
}

/** @returns {boolean} */
export function canMutateData() {
  return !isCloudReadOnly();
}

/** @returns {boolean} */
export function canMutateReminderSettings() {
  return canMutateData() && canAdmin();
}
