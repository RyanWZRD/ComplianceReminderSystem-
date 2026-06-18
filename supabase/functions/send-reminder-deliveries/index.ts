/**
 * V6 Phase 38: send-reminder-deliveries Edge Function with Resend integration.
 * Server-side Resend sends only — no delivery log writes, no reminder mark-sent hooks,
 * no browser invoke wiring in this phase.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

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
): { to: string; subject: string; bodyText: string } {
  const recipient = String(record.recipientEmail ?? "").trim();
  const subject = String(record.subject ?? "").trim();
  const bodyText = String(record.bodyText ?? "").trim();

  if (config.emailMode === "test") {
    return {
      to: config.testRedirectTo,
      subject: `[TEST] ${subject}`,
      bodyText,
    };
  }

  return {
    to: recipient,
    subject,
    bodyText,
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
    }
  | {
      deliveryStatus: "failed";
      failureType: "transient" | "permanent";
      failureReason: string;
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
    };
  }

  const failure = mapResendHttpFailure(response.status);

  return {
    deliveryStatus: "failed",
    failureType: failure.failureType,
    failureReason: failure.failureReason,
  };
}

/**
 * @param {ProviderConfig} config
 * @param {DeliveryRecordInput[]} deliveryRecords
 */
async function processDeliveryRecords(
  config: ProviderConfig,
  deliveryRecords: DeliveryRecordInput[],
) {
  /** @type {Array<Record<string, unknown>>} */
  const results = [];
  let attempted = 0;
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const record of deliveryRecords) {
    const queueItemId = String(record.queueItemId ?? "").trim() || "unknown";
    const skipReason = getSkipReason(record);

    if (skipReason) {
      skipped += 1;
      results.push({
        queueItemId,
        deliveryStatus: "skipped",
        skipReason,
      });
      continue;
    }

    if (attempted >= config.rateLimitPerRun) {
      skipped += 1;
      results.push({
        queueItemId,
        deliveryStatus: "skipped",
        skipReason: "rate_limit_exceeded",
      });
      continue;
    }

    attempted += 1;

    const outcome = await sendViaResend(config, record);

    if (outcome.deliveryStatus === "delivered") {
      delivered += 1;
      results.push({
        queueItemId,
        deliveryStatus: "delivered",
        providerMessageId: outcome.providerMessageId,
      });
      continue;
    }

    failed += 1;
    results.push({
      queueItemId,
      deliveryStatus: "failed",
      failureType: outcome.failureType,
      failureReason: outcome.failureReason,
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

  const deliveryRecords = validation.record.deliveryRecords as DeliveryRecordInput[];
  const responseBody = await processDeliveryRecords(
    providerConfig.config,
    deliveryRecords,
  );

  return jsonResponse(responseBody, 200, corsHeaders);
});
