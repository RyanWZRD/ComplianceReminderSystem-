/**
 * V6 Phase 33: Manual delivery test UI helpers.
 * Admin-only manual execution surface — no scheduling, mark-as-sent, or compliance mutation.
 *
 * Phase 39+: Manual delivery invokes send-reminder-deliveries via Supabase Edge Function.
 * Browser email provider settings and Resend API keys are not required.
 */

export const MANUAL_DELIVERY_TEST_SAFETY_NOTE =
  "Manual test execution only. No scheduling is enabled.";

export const MANUAL_DELIVERY_RUN_BUTTON_LABEL = "Run Delivery Test";

export const MANUAL_DELIVERY_DELIVERY_MODE = "edge_function";

export const MANUAL_DELIVERY_CONFIRMATION_MESSAGE = [
  "Run a manual delivery test using the current reminder preview queue?",
  "",
  "• Emails may be sent through the configured provider.",
  "• In test mode, recipients are redirected to the staging inbox.",
  "• Delivery outcomes and audit logs are written by the server Edge Function.",
  "• This action cannot be undone.",
].join("\n");

/**
 * @param {string} [mode]
 * @returns {string}
 */
export function formatManualDeliveryModeLabel(mode) {
  if (mode === "edge_function" || mode === "edge function") {
    return "edge function";
  }

  if (mode === "test" || mode === "production") {
    return mode;
  }

  return "disabled";
}

/**
 * Delivery mode label for the Manual Delivery Test card (Edge Function invoke path).
 *
 * @returns {string}
 */
export function getManualDeliveryDeliveryModeLabel() {
  return formatManualDeliveryModeLabel(MANUAL_DELIVERY_DELIVERY_MODE);
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
 * @param {{
 *   attempted?: number;
 *   delivered?: number;
 *   failed?: number;
 *   skipped?: number;
 * }} [executionSummary]
 * @returns {{ attempted: number; delivered: number; failed: number; skipped: number }}
 */
export function buildManualDeliveryResultSummary(executionSummary) {
  return {
    attempted: Number(executionSummary?.attempted ?? 0),
    delivered: Number(executionSummary?.delivered ?? 0),
    failed: Number(executionSummary?.failed ?? 0),
    skipped: Number(executionSummary?.skipped ?? 0),
  };
}
