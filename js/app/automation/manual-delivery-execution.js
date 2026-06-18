/**
 * V6 Phase 33: Manual delivery test execution coordinator.
 * Invokes runManualDeliveryPipeline for admin-initiated tests only.
 *
 * LEGACY BROWSER SEND PATH (pre-Phase 39):
 * Still wired to the Manual Delivery UI via app.js → executeManualDeliveryTest.
 * When email-provider-env.js is synced from .env with provider enabled + RESEND_API_KEY,
 * this path calls createResendEmailProvider with browser fetch (CORS-blocked; key exposure risk).
 * Committed git defaults keep the provider disabled — see email-provider-env.js.
 *
 * Phase 38+ production sends must use the Supabase Edge Function (server-side Resend).
 * Phase 39 will replace this browser provider with Edge Function invoke — do not use browser
 * fetch to api.resend.com as the production sending path after Phase 39.
 *
 * No scheduling, mark-as-sent automation, or compliance/history mutation.
 */

import { createEmailProviderAdapter } from "./email-provider-adapter.js";
import { getEmailProviderConfig } from "./email-provider-config.js";
import { runManualDeliveryPipeline } from "./manual-delivery-runner.js";
import { createResendEmailProvider } from "./providers/resend-provider.js";
import { EMAIL_PROVIDER_RUNTIME } from "../../data/email-provider-env.js";

export const MANUAL_DELIVERY_RUN_TYPE = "manual_delivery_test";
export const MANUAL_DELIVERY_RUN_SOURCE = "admin_manual_delivery_ui";

/**
 * @returns {Record<string, unknown>}
 */
function buildProviderAdapterConfig() {
  const base = getEmailProviderConfig(EMAIL_PROVIDER_RUNTIME);

  if (!base.enabled || base.provider !== "resend") {
    return { ...base };
  }

  return {
    ...base,
    apiKey: String(EMAIL_PROVIDER_RUNTIME.RESEND_API_KEY ?? "").trim(),
    testRedirectTo: String(EMAIL_PROVIDER_RUNTIME.EMAIL_TEST_REDIRECT_TO ?? "").trim(),
  };
}

/**
 * @returns {ReturnType<typeof createEmailProviderAdapter>}
 */
export function createManualDeliveryEmailProvider() {
  const config = buildProviderAdapterConfig();

  if (!config.enabled) {
    return createEmailProviderAdapter({ config });
  }

  if (config.provider === "resend") {
    const fetchImpl = typeof fetch === "function" ? fetch.bind(globalThis) : undefined;

    return createResendEmailProvider({ config, fetchImpl });
  }

  return createEmailProviderAdapter({ config });
}

/**
 * @param {{
 *   queueItems: import("./reminder-queue.js").ReturnType<import("./reminder-queue.js").buildReminderQueueFromDryRun>["items"];
 *   db: {
 *     createAutomationRun: (input?: object) => Promise<{ ok: boolean; run?: { id: string }; error?: string }>;
 *     createReminderDeliveryLog: (
 *       payload: import("./delivery-worker-persistence.js").CreateReminderDeliveryLogPayload
 *     ) => Promise<
 *       | { ok: true; log: { id: string; deliveryStatus: string; createdAt: string } }
 *       | { ok: false; error: string }
 *     >;
 *   };
 *   organisationId: string;
 *   organisationName?: string | null;
 *   asOfDate?: string | null;
 *   now?: string | null;
 * }} input
 */
export async function executeManualDeliveryTest({
  queueItems,
  db,
  organisationId,
  organisationName,
  asOfDate,
  now,
}) {
  if (!db || typeof db.createAutomationRun !== "function") {
    throw new Error("Manual delivery test requires an automation store with createAutomationRun.");
  }

  if (!db || typeof db.createReminderDeliveryLog !== "function") {
    throw new Error("Manual delivery test requires an automation store with createReminderDeliveryLog.");
  }

  const providerConfig = buildProviderAdapterConfig();

  if (!providerConfig.enabled) {
    throw new Error("Email provider is not enabled for manual delivery tests.");
  }

  const runResult = await db.createAutomationRun({
    status: "completed",
    summary: {
      runType: MANUAL_DELIVERY_RUN_TYPE,
      source: MANUAL_DELIVERY_RUN_SOURCE,
      organisationId,
      queueItemCount: Array.isArray(queueItems) ? queueItems.length : 0,
      providerMode: providerConfig.mode,
    },
  });

  if (!runResult.ok || !runResult.run?.id) {
    throw new Error(runResult.error ?? "Could not create automation run for manual delivery test.");
  }

  const provider = createManualDeliveryEmailProvider();

  return runManualDeliveryPipeline({
    queueItems,
    provider,
    db,
    organisationId,
    automationRunId: runResult.run.id,
    organisationName,
    asOfDate,
    now,
  });
}
