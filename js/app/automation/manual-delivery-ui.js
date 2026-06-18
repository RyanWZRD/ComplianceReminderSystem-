/**
 * V6 Phase 33: Manual delivery test UI helpers.
 * Admin-only manual execution surface — no scheduling, mark-as-sent, or compliance mutation.
 */

import { getEmailProviderConfig } from "./email-provider-config.js";
import { EMAIL_PROVIDER_RUNTIME } from "../../data/email-provider-env.js";

export const MANUAL_DELIVERY_TEST_SAFETY_NOTE =
  "Manual test execution only. No scheduling is enabled.";

export const MANUAL_DELIVERY_RUN_BUTTON_LABEL = "Run Delivery Test";

export const MANUAL_DELIVERY_CONFIRMATION_MESSAGE = [
  "Run a manual delivery test using the current reminder preview queue?",
  "",
  "• Emails may be sent through the configured provider.",
  "• In test mode, recipients are redirected to the staging inbox.",
  "• Delivery log rows will be written; reminders will not be marked sent.",
  "• This action cannot be undone.",
].join("\n");

/**
 * @param {import("./email-provider-config.js").EmailProviderMode | string} mode
 * @returns {string}
 */
export function formatManualDeliveryModeLabel(mode) {
  if (mode === "test" || mode === "production") {
    return mode;
  }

  return "disabled";
}

/**
 * @param {readonly { email?: string | null; emailMissing?: boolean }[]} queueItems
 * @returns {{ totalQueued: number; missingEmail: number }}
 */
export function computeManualDeliveryQueueSummary(queueItems) {
  const items = Array.isArray(queueItems) ? queueItems : [];

  let missingEmail = 0;

  for (const item of items) {
    if (item?.emailMissing === true || item?.email == null || String(item.email).trim() === "") {
      missingEmail += 1;
    }
  }

  return {
    totalQueued: items.length,
    missingEmail,
  };
}

/**
 * @returns {ReturnType<typeof getEmailProviderConfig>}
 */
export function getManualDeliveryProviderConfig() {
  return getEmailProviderConfig(EMAIL_PROVIDER_RUNTIME);
}

/**
 * @param {{
 *   attempted?: number;
 *   delivered?: number;
 *   failed?: number;
 * }} [executionSummary]
 * @param {{ persisted?: number }} [persistenceSummary]
 * @returns {{ attempted: number; delivered: number; failed: number; persisted: number }}
 */
export function buildManualDeliveryResultSummary(executionSummary, persistenceSummary) {
  return {
    attempted: Number(executionSummary?.attempted ?? 0),
    delivered: Number(executionSummary?.delivered ?? 0),
    failed: Number(executionSummary?.failed ?? 0),
    persisted: Number(persistenceSummary?.persisted ?? 0),
  };
}
