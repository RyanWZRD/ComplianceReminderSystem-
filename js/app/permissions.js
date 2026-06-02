import { CLOUD_WRITES_ENABLED, DATA_BACKEND } from "../data/config.js";
import { canAdmin, canEdit } from "../auth/session.js";

export function isCloudMode() {
  return DATA_BACKEND === "cloud";
}

export function isCloudReadOnly() {
  return isCloudMode() && !CLOUD_WRITES_ENABLED;
}

/** @returns {boolean} */
export function canMutateData() {
  if (isCloudMode()) {
    return false;
  }

  return true;
}

/** @returns {boolean} */
export function canMarkReminderSent() {
  if (!isCloudMode()) {
    return canMutateData();
  }

  if (!CLOUD_WRITES_ENABLED) {
    return false;
  }

  return canEdit();
}

/** @returns {boolean} */
export function canSetActionStatus() {
  if (!isCloudMode()) {
    return canMutateData();
  }

  if (!CLOUD_WRITES_ENABLED) {
    return false;
  }

  return canEdit();
}

/** @returns {boolean} */
export function canMutateReminderSettings() {
  return canMutateData() && canAdmin();
}
