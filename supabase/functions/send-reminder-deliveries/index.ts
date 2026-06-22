/**
 * V6 Phase 42: send-reminder-deliveries Edge Function with Resend integration
 * and delivery log persistence via create_reminder_delivery_log RPC.
 * Server-side Resend sends + audit rows only — no reminder mark-sent hooks.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DELIVERY_LOG_RPC = "create_reminder_delivery_log";
const SKIPPED_BODY_PLACEHOLDER = "[delivery skipped]";
const SKIPPED_SUBJECT_PLACEHOLDER = "[delivery skipped]";

/** @type {ReadonlySet<number>} */
const TRANSIENT_HTTP_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** @type {ReadonlySet<number>} */
const PERMANENT_HTTP_STATUS_CODES = new Set([400, 401, 403, 404, 422]);

/**
 * Local dev origins from supabase/config.toml site_url (port 8877).
 * Staging hostnames: set EDGE_DELIVERY_ALLOWED_ORIGINS secret (comma-separated) in a later phase.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:8877",
  "http://localhost:8877",
];

/**
 * @typedef {Object} DeliveryRecordInput
 * @property {string} [queueItemId]
 * @property {string} [recipientEmail]
 * @property {string} [subject]
 * @property {string} [bodyText]
 * @property {string} [bodyHtml]
 * @property {string} [complianceRecordId]
 * @property {string} [personId]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} resendApiKey
 * @property {"test" | "production"} emailMode
 * @property {string} fromEmail
 * @property {string} replyToEmail
 * @property {string} testRedirectTo
 * @property {number} rateLimitPerRun
 */

/**
 * @typedef {"delivered" | "failed" | "skipped"} DeliveryOutcomeStatus
 */

/**
 * @param {string | null} origin
 */
function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && DEFAULT_ALLOWED_ORIGINS.includes(origin)
      ? origin
      : DEFAULT_ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/**
 * @param {unknown} body
 * @param {number} status
 * @param {Record<string, string>} corsHeaders
 */
function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * @param {Request} req
 */
function hasAuthorizationHeader(req: Request): boolean {
  const authorization = req.headers.get("Authorization");
  return Boolean(authorization && authorization.trim());
}

/**
 * @param {Request} req
 * @returns {SupabaseClient | null}
 */
function createUserSupabaseClient(req: Request): SupabaseClient | null {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const supabaseAnonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  const authorization = req.headers.get("Authorization")?.trim() ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !authorization) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * @param {unknown} body
 */
function validateRequestBody(
  body: unknown,
): { ok: true; record: Record<string, unknown> } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_request" };
  }

  const record = body as Record<string, unknown>;

  if (
    typeof record.organisationId !== "string" ||
    !record.organisationId.trim()
  ) {
    return { ok: false, error: "organisationId is required" };
  }

  if (
    typeof record.automationRunId !== "string" ||
    !record.automationRunId.trim()
  ) {
    return { ok: false, error: "automationRunId is required" };
  }

  if (!Array.isArray(record.deliveryRecords)) {
    return { ok: false, error: "deliveryRecords is required" };
  }

  return { ok: true, record };
}

/**
 * @returns {{ ok: true; config: ProviderConfig } | { ok: false; error: string }}
 */
function loadProviderConfig():
  | { ok: true; config: ProviderConfig }
  | { ok: false; error: string } {
  const resendApiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();

  if (!resendApiKey) {
    return { ok: false, error: "provider_not_configured" };
  }

  const emailMode = (Deno.env.get("EMAIL_MODE") ?? "").trim();

  if (emailMode !== "test" && emailMode !== "production") {
    return { ok: false, error: "invalid_email_mode" };
  }

  const fromEmail = (Deno.env.get("EMAIL_FROM_ADDRESS") ?? "").trim();

  if (!fromEmail) {
    return { ok: false, error: "invalid_config" };
  }

  const replyToEmail = (Deno.env.get("EMAIL_REPLY_TO_ADDRESS") ?? "").trim();
  const testRedirectTo = (Deno.env.get("EMAIL_TEST_REDIRECT_TO") ?? "").trim();

  if (emailMode === "test" && !testRedirectTo) {
    return { ok: false, error: "invalid_config" };
  }

  const rateLimitRaw = (Deno.env.get("EMAIL_RATE_LIMIT_PER_RUN") ?? "50").trim();
  const parsedRateLimit = Number.parseInt(rateLimitRaw, 10);
  const rateLimitPerRun =
    Number.isFinite(parsedRateLimit) && parsedRateLimit > 0
      ? parsedRateLimit
      : 50;

  return {
    ok: true,
    config: {
      resendApiKey,
      emailMode,
      fromEmail,
      replyToEmail,
      testRedirectTo,
      rateLimitPerRun,
    },
  };
}

/**
 * @param {number} status
 */
function mapResendHttpFailure(status: number): {
  failureType: "transient" | "permanent";
  failureReason: string;
} {
  if (TRANSIENT_HTTP_STATUS_CODES.has(status)) {
    return {
      failureType: "transient",
      failureReason: `resend_http_${status}`,
    };
  }

  if (PERMANENT_HTTP_STATUS_CODES.has(status)) {
    return {
      failureType: "permanent",
      failureReason: `resend_http_${status}`,
    };
  }

  return {
    failureType: "transient",
    failureReason: `resend_http_${status}`,
  };
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function resolveOptionalId(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

/**
 * @param {DeliveryRecordInput} record
 */
function extractRecordIds(record: DeliveryRecordInput): {
  complianceRecordId: string | null;
  personId: string | null;
} {
  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? record.metadata
      : {};

  return {
    complianceRecordId:
      resolveOptionalId(record.complianceRecordId) ??
      resolveOptionalId(metadata.complianceRecordId) ??
      resolveOptionalId(metadata.compliance_record_id),
    personId:
      resolveOptionalId(record.personId) ??
      resolveOptionalId(metadata.personId) ??
      resolveOptionalId(metadata.person_id),
  };
}

/**
 * @param {DeliveryRecordInput} record
 */
function getSkipReason(record: DeliveryRecordInput): string | null {
  const queueItemId = String(record.queueItemId ?? "").trim();

  if (!queueItemId) {
    return "missing_queue_item_id";
  }

  const recipientEmail = String(record.recipientEmail ?? "").trim();

  if (!recipientEmail) {
    return "missing_recipient_email";
  }

  if (!String(record.subject ?? "").trim()) {
    return "missing_subject";
  }

  if (!String(record.bodyText ?? "").trim()) {
    return "missing_body_text";
  }

  return null;
}

/**
 * @param {ProviderConfig} config
 * @param {DeliveryRecordInput} record
 */
function resolveOutboundEmail(
  config: ProviderConfig,
  record: DeliveryRecordInput,
): { to: string; subject: string; bodyText: string; originalRecipient: string } {
  const recipient = String(record.recipientEmail ?? "").trim();
  const subject = String(record.subject ?? "").trim();
  const bodyText = String(record.bodyText ?? "").trim();

  if (config.emailMode === "test") {
    return {
      to: config.testRedirectTo,
      subject: `[TEST] ${subject}`,
      bodyText,
      originalRecipient: recipient,
    };
  }

  return {
    to: recipient,
    subject,
    bodyText,
    originalRecipient: recipient,
  };
}

/**
 * @param {ProviderConfig} config
 * @param {DeliveryRecordInput} record
 */
function resolveLogSubject(
  config: ProviderConfig,
  record: DeliveryRecordInput,
): string {
  const subject = String(record.subject ?? "").trim();

  if (!subject) {
    return SKIPPED_SUBJECT_PLACEHOLDER;
  }

  if (config.emailMode === "test") {
    return `[TEST] ${subject}`;
  }

  return subject;
}

/**
 * @param {DeliveryRecordInput} record
 */
function resolveLogBodyText(record: DeliveryRecordInput): string {
  const bodyText = String(record.bodyText ?? "").trim();
  return bodyText || SKIPPED_BODY_PLACEHOLDER;
}

/**
 * @param {ProviderConfig} config
 * @param {Record<string, unknown>} metadata
 */
function buildTestModeMetadata(
  config: ProviderConfig,
  metadata: Record<string, unknown>,
  originalRecipient: string | null,
): Record<string, unknown> {
  if (config.emailMode !== "test") {
    return metadata;
  }

  return {
    ...metadata,
    emailMode: "test",
    redirectedToEmail: config.testRedirectTo,
    originalRecipientEmail: originalRecipient,
  };
}

/**
 * @param {ProviderConfig} config
 * @param {DeliveryRecordInput} record
 */
async function sendViaResend(
  config: ProviderConfig,
  record: DeliveryRecordInput,
): Promise<
  | {
      deliveryStatus: "delivered";
      providerMessageId: string;
      outbound: ReturnType<typeof resolveOutboundEmail>;
    }
  | {
      deliveryStatus: "failed";
      failureType: "transient" | "permanent";
      failureReason: string;
      providerStatusCode?: number;
      outbound: ReturnType<typeof resolveOutboundEmail>;
    }
> {
  const outbound = resolveOutboundEmail(config, record);

  /** @type {Record<string, unknown>} */
  const payload: Record<string, unknown> = {
    from: config.fromEmail,
    to: [outbound.to],
    subject: outbound.subject,
    text: outbound.bodyText,
  };

  if (config.replyToEmail) {
    payload.reply_to = config.replyToEmail;
  }

  const bodyHtml = String(record.bodyHtml ?? "").trim();

  if (bodyHtml) {
    payload.html = bodyHtml;
  }

  let response: Response;

  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      deliveryStatus: "failed",
      failureType: "transient",
      failureReason: "resend_network_error",
      outbound,
    };
  }

  if (response.status >= 200 && response.status < 300) {
    let responseBody: Record<string, unknown> = {};

    try {
      responseBody = await response.json();
    } catch {
      responseBody = {};
    }

    const providerMessageId =
      typeof responseBody.id === "string" && responseBody.id.length > 0
        ? responseBody.id
        : `resend-${Date.now()}`;

    return {
      deliveryStatus: "delivered",
      providerMessageId,
      outbound,
    };
  }

  const failure = mapResendHttpFailure(response.status);

  return {
    deliveryStatus: "failed",
    failureType: failure.failureType,
    failureReason: failure.failureReason,
    providerStatusCode: response.status,
    outbound,
  };
}

/**
 * @param {Record<string, unknown>} metadata
 */
function preserveRecordMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const preservedKeys = [
    "providerMessageId",
    "provider",
    "failureType",
    "reminderWindow",
    "complianceType",
    "expiryDate",
    "source",
    "emailMissing",
  ];

  /** @type {Record<string, unknown>} */
  const preserved: Record<string, unknown> = {};

  for (const key of preservedKeys) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      preserved[key] = metadata[key];
    }
  }

  return preserved;
}

/**
 * @param {SupabaseClient} supabase
 * @param {{
 *   organisationId: string;
 *   automationRunId: string;
 *   record: DeliveryRecordInput;
 *   config: ProviderConfig;
 *   outcomeStatus: DeliveryOutcomeStatus;
 *   skipReason?: string;
 *   failureType?: "transient" | "permanent";
 *   failureReason?: string;
 *   providerMessageId?: string;
 *   providerStatusCode?: number;
 *   outbound?: ReturnType<typeof resolveOutboundEmail>;
 * }} input
 */
async function persistDeliveryLog(
  supabase: SupabaseClient,
  input: {
    organisationId: string;
    automationRunId: string;
    record: DeliveryRecordInput;
    config: ProviderConfig;
    outcomeStatus: DeliveryOutcomeStatus;
    skipReason?: string;
    failureType?: "transient" | "permanent";
    failureReason?: string;
    providerMessageId?: string;
    providerStatusCode?: number;
    outbound?: ReturnType<typeof resolveOutboundEmail>;
  },
): Promise<{ logId: string | null; persisted: boolean; persistError?: string }> {
  const queueItemId = String(input.record.queueItemId ?? "").trim() || "unknown";
  const now = new Date().toISOString();
  const baseMetadata =
    input.record.metadata &&
    typeof input.record.metadata === "object" &&
    !Array.isArray(input.record.metadata)
      ? preserveRecordMetadata(input.record.metadata)
      : {};
  const { complianceRecordId, personId } = extractRecordIds(input.record);
  const outbound =
    input.outbound ??
  resolveOutboundEmail(input.config, input.record);
  const originalRecipient = outbound.originalRecipient || null;

  /** @type {Record<string, unknown>} */
  const metadata = buildTestModeMetadata(input.config, {
    ...baseMetadata,
    provider: "resend",
    outcomeStatus: input.outcomeStatus,
  }, originalRecipient);

  if (input.providerMessageId) {
    metadata.providerMessageId = input.providerMessageId;
  }

  if (input.failureType) {
    metadata.failureType = input.failureType;
  }

  if (input.providerStatusCode != null) {
    metadata.providerStatusCode = input.providerStatusCode;
  }

  if (input.skipReason) {
    metadata.skipReason = input.skipReason;
  }

  let deliveryStatus = "failed";
  let sentAt: string | null = null;
  let deliveredAt: string | null = null;
  let failedAt: string | null = null;
  let failureReason: string | null = null;
  let recipientEmail = outbound.to;

  if (input.outcomeStatus === "delivered") {
    deliveryStatus = "delivered";
    sentAt = now;
    deliveredAt = now;
  } else if (input.outcomeStatus === "skipped") {
    deliveryStatus = "cancelled";
    failedAt = now;
    failureReason = input.skipReason ?? "skipped";
    recipientEmail = originalRecipient ?? outbound.to;
  } else {
    deliveryStatus = "failed";
    sentAt = now;
    failedAt = now;
    failureReason = input.failureReason ?? "delivery_failed";
  }

  const { data, error } = await supabase.rpc(DELIVERY_LOG_RPC, {
    p_organisation_id: input.organisationId,
    p_automation_run_id: input.automationRunId,
    p_queue_item_id: queueItemId,
    p_compliance_record_id: complianceRecordId,
    p_person_id: personId,
    p_recipient_email: recipientEmail,
    p_subject: resolveLogSubject(input.config, input.record),
    p_body_text: resolveLogBodyText(input.record),
    p_delivery_status: deliveryStatus,
    p_sent_at: sentAt,
    p_delivered_at: deliveredAt,
    p_failed_at: failedAt,
    p_failure_reason: failureReason,
    p_metadata: metadata,
  });

  if (error) {
    return {
      logId: null,
      persisted: false,
      persistError: error.message,
    };
  }

  const row =
    data && typeof data === "object" && !Array.isArray(data)
      ? /** @type {Record<string, unknown>} */ (data)
      : null;
  const logId = row && typeof row.id === "string" ? row.id : null;

  return {
    logId,
    persisted: Boolean(logId),
  };
}

/**
 * @param {ProviderConfig} config
 * @param {DeliveryRecordInput[]} deliveryRecords
 * @param {{
 *   organisationId: string;
 *   automationRunId: string;
 *   supabase: SupabaseClient;
 * }} context
 */
async function processDeliveryRecords(
  config: ProviderConfig,
  deliveryRecords: DeliveryRecordInput[],
  context: {
    organisationId: string;
    automationRunId: string;
    supabase: SupabaseClient;
  },
) {
  /** @type {Array<Record<string, unknown>>} */
  const results = [];
  let attempted = 0;
  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  let persisted = 0;
  let persistFailed = 0;

  for (const record of deliveryRecords) {
    const queueItemId = String(record.queueItemId ?? "").trim() || "unknown";
    const skipReason = getSkipReason(record);

    if (skipReason) {
      skipped += 1;

      const persistResult = await persistDeliveryLog(context.supabase, {
        organisationId: context.organisationId,
        automationRunId: context.automationRunId,
        record,
        config,
        outcomeStatus: "skipped",
        skipReason,
      });

      if (persistResult.persisted) {
        persisted += 1;
      } else {
        persistFailed += 1;
      }

      results.push({
        queueItemId,
        deliveryStatus: "skipped",
        skipReason,
        logId: persistResult.logId,
        persisted: persistResult.persisted,
        ...(persistResult.persistError
          ? { persistError: persistResult.persistError }
          : {}),
      });
      continue;
    }

    if (attempted >= config.rateLimitPerRun) {
      skipped += 1;

      const persistResult = await persistDeliveryLog(context.supabase, {
        organisationId: context.organisationId,
        automationRunId: context.automationRunId,
        record,
        config,
        outcomeStatus: "skipped",
        skipReason: "rate_limit_exceeded",
      });

      if (persistResult.persisted) {
        persisted += 1;
      } else {
        persistFailed += 1;
      }

      results.push({
        queueItemId,
        deliveryStatus: "skipped",
        skipReason: "rate_limit_exceeded",
        logId: persistResult.logId,
        persisted: persistResult.persisted,
        ...(persistResult.persistError
          ? { persistError: persistResult.persistError }
          : {}),
      });
      continue;
    }

    attempted += 1;

    const outcome = await sendViaResend(config, record);

    if (outcome.deliveryStatus === "delivered") {
      delivered += 1;

      const persistResult = await persistDeliveryLog(context.supabase, {
        organisationId: context.organisationId,
        automationRunId: context.automationRunId,
        record,
        config,
        outcomeStatus: "delivered",
        providerMessageId: outcome.providerMessageId,
        outbound: outcome.outbound,
      });

      if (persistResult.persisted) {
        persisted += 1;
      } else {
        persistFailed += 1;
      }

      results.push({
        queueItemId,
        deliveryStatus: "delivered",
        providerMessageId: outcome.providerMessageId,
        logId: persistResult.logId,
        persisted: persistResult.persisted,
        ...(persistResult.persistError
          ? { persistError: persistResult.persistError }
          : {}),
      });
      continue;
    }

    failed += 1;

    const persistResult = await persistDeliveryLog(context.supabase, {
      organisationId: context.organisationId,
      automationRunId: context.automationRunId,
      record,
      config,
      outcomeStatus: "failed",
      failureType: outcome.failureType,
      failureReason: outcome.failureReason,
      providerStatusCode: outcome.providerStatusCode,
      outbound: outcome.outbound,
    });

    if (persistResult.persisted) {
      persisted += 1;
    } else {
      persistFailed += 1;
    }

    results.push({
      queueItemId,
      deliveryStatus: "failed",
      failureType: outcome.failureType,
      failureReason: outcome.failureReason,
      logId: persistResult.logId,
      persisted: persistResult.persisted,
      ...(persistResult.persistError ? { persistError: persistResult.persistError } : {}),
    });
  }

  return {
    status: failed > 0 && delivered === 0 ? "error" : failed > 0 ? "partial" : "ok",
    summary: {
      total: deliveryRecords.length,
      attempted,
      delivered,
      failed,
      skipped,
      persisted,
      persistFailed,
    },
    results,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, corsHeaders);
  }

  if (!hasAuthorizationHeader(req)) {
    return jsonResponse({ error: "unauthorized" }, 401, corsHeaders);
  }

  const supabase = createUserSupabaseClient(req);

  if (!supabase) {
    return jsonResponse({ error: "unauthorized" }, 401, corsHeaders);
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, corsHeaders);
  }

  const validation = validateRequestBody(body);

  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400, corsHeaders);
  }

  const providerConfig = loadProviderConfig();

  if (!providerConfig.ok) {
    return jsonResponse({ error: providerConfig.error }, 503, corsHeaders);
  }

  const organisationId = String(validation.record.organisationId).trim();
  const automationRunId = String(validation.record.automationRunId).trim();
  const deliveryRecords = validation.record.deliveryRecords as DeliveryRecordInput[];
  const responseBody = await processDeliveryRecords(
    providerConfig.config,
    deliveryRecords,
    {
      organisationId,
      automationRunId,
      supabase,
    },
  );

  return jsonResponse(responseBody, 200, corsHeaders);
});
