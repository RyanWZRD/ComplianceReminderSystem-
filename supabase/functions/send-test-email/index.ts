/**
 * V6 Phase 56–58: Controlled manual test-send Edge Function.
 * Phase 58: On successful provider send, persists one reminder_delivery_logs audit row.
 * No automation run records, mark-as-sent, or compliance writes.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  getEmailProviderConfig,
  isEmailSendingEnabled,
  sendReminderEmail,
} from "../_shared/email-provider.ts";

/** Alpha Test Organisation — seed / staging default (supabase/seed.sql). */
const ALPHA_STAGING_ORGANISATION_ID = "11111111-1111-1111-1111-111111111111";

const BODY_TEXT_PREVIEW_MAX_LENGTH = 500;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hasAuthorizationHeader(req: Request): boolean {
  const authorization = req.headers.get("Authorization");
  return Boolean(authorization && authorization.trim());
}

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

function createServiceSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function readDenoEnv(): Record<string, string | undefined> {
  const keys = [
    "RESEND_API_KEY",
    "EMAIL_SENDING_ENABLED",
    "EMAIL_FROM_ADDRESS",
    "EMAIL_PROVIDER",
    "TEST_EMAIL_ALLOWLIST",
  ] as const;

  const env: Record<string, string | undefined> = {};

  for (const key of keys) {
    const value = Deno.env.get(key);

    if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
}

/**
 * @param raw Comma-separated allowlist from TEST_EMAIL_ALLOWLIST.
 */
function parseTestEmailAllowlist(raw: string | undefined): Set<string> {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return new Set(entries);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

/**
 * @param bodyText Full plain-text body from the request.
 */
function buildBodyTextPreview(bodyText: string): string {
  const trimmed = bodyText.trim();

  if (trimmed.length <= BODY_TEXT_PREVIEW_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, BODY_TEXT_PREVIEW_MAX_LENGTH)}…`;
}

/**
 * Resolves organisation scope for the manual test-send audit row.
 * Uses request body organisationId when provided and accessible; otherwise Alpha staging org.
 */
async function resolveOrganisationId(
  payload: Record<string, unknown>,
  userSupabase: SupabaseClient,
): Promise<{ ok: true; organisationId: string } | { ok: false; error: string }> {
  const rawOrganisationId = payload.organisationId;

  if (typeof rawOrganisationId === "string" && rawOrganisationId.trim()) {
    const organisationId = rawOrganisationId.trim();

    if (!isUuidString(organisationId)) {
      return { ok: false, error: "invalid_organisation_id" };
    }

    const { error } = await userSupabase
      .from("reminder_settings")
      .select("organisation_id")
      .eq("organisation_id", organisationId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: "organisation_access_denied" };
    }

    return { ok: true, organisationId };
  }

  return { ok: true, organisationId: ALPHA_STAGING_ORGANISATION_ID };
}

/**
 * Persists one sent audit row after a successful provider send (service role).
 */
async function insertManualTestDeliveryLog(
  serviceSupabase: SupabaseClient,
  params: {
    organisationId: string;
    to: string;
    recipientName: string | null;
    subject: string;
    bodyTextPreview: string;
    providerMessageId: string;
    providerResultStatus: string;
  },
): Promise<{ ok: true; deliveryLogId: string } | { ok: false; error: string }> {
  const sentAt = new Date().toISOString();

  const { data, error } = await serviceSupabase
    .from("reminder_delivery_logs")
    .insert({
      organisation_id: params.organisationId,
      automation_run_id: null,
      compliance_record_id: null,
      person_id: null,
      recipient_email: params.to,
      recipient_name: params.recipientName,
      compliance_type: "manual_test_email",
      reminder_type: "manual_test",
      due_date: null,
      delivery_status: "sent",
      provider: "resend",
      provider_message_id: params.providerMessageId,
      payload: {
        mode: "manual_test_send",
        subject: params.subject,
        bodyTextPreview: params.bodyTextPreview,
        providerResult: {
          status: params.providerResultStatus,
        },
        function: "send-test-email",
      },
      sent_at: sentAt,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      ok: false,
      error: error?.message ?? "delivery_log_insert_failed",
    };
  }

  return { ok: true, deliveryLogId: String(data.id) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!hasAuthorizationHeader(req)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabase = createUserSupabaseClient(req);

  if (!supabase) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const env = readDenoEnv();
  const config = getEmailProviderConfig(env);

  if (!isEmailSendingEnabled(config)) {
    return jsonResponse(
      { status: "refused", reason: "email_sending_disabled" },
      403,
    );
  }

  const allowlist = parseTestEmailAllowlist(env.TEST_EMAIL_ALLOWLIST);

  if (allowlist.size === 0) {
    return jsonResponse(
      { status: "error", error: "test_email_allowlist_not_configured" },
      503,
    );
  }

  if (!config.resendApiKey) {
    return jsonResponse(
      {
        status: "error",
        error: "provider_not_configured",
        code: "provider_not_configured",
      },
      503,
    );
  }

  if (!config.fromAddress) {
    return jsonResponse(
      { status: "error", error: "invalid_config", code: "invalid_config" },
      503,
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ status: "error", error: "invalid_json" }, 400);
  }

  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const organisationResult = await resolveOrganisationId(payload, supabase);

  if (!organisationResult.ok) {
    return jsonResponse({ status: "error", error: organisationResult.error }, 400);
  }

  const organisationId = organisationResult.organisationId;

  const toRaw = payload.to;
  const subjectRaw = payload.subject;
  const bodyTextRaw = payload.bodyText;
  const recipientNameRaw = payload.recipientName;

  if (!isNonEmptyString(toRaw)) {
    return jsonResponse({ status: "error", error: "missing_recipient" }, 400);
  }

  const to = toRaw.trim();
  const normalizedTo = to.toLowerCase();

  if (!allowlist.has(normalizedTo)) {
    return jsonResponse(
      { status: "error", error: "recipient_not_allowlisted" },
      400,
    );
  }

  if (!isNonEmptyString(subjectRaw)) {
    return jsonResponse({ status: "error", error: "missing_subject" }, 400);
  }

  if (!isNonEmptyString(bodyTextRaw)) {
    return jsonResponse({ status: "error", error: "missing_body_text" }, 400);
  }

  const subject = subjectRaw.trim();
  const bodyText = bodyTextRaw.trim();
  const recipientName =
    typeof recipientNameRaw === "string" && recipientNameRaw.trim()
      ? recipientNameRaw.trim()
      : null;

  const providerResult = await sendReminderEmail(
    {
      to,
      subject,
      bodyText,
    },
    config,
  );

  if (providerResult.status === "disabled") {
    return jsonResponse(
      { status: "refused", reason: providerResult.reason },
      403,
    );
  }

  if (providerResult.status === "error") {
    return jsonResponse(
      {
        status: "error",
        error: providerResult.error,
        code: providerResult.code,
      },
      502,
    );
  }

  const serviceSupabase = createServiceSupabaseClient();

  if (!serviceSupabase) {
    return jsonResponse({ status: "error", error: "service_unavailable" }, 500);
  }

  const deliveryLogResult = await insertManualTestDeliveryLog(serviceSupabase, {
    organisationId,
    to,
    recipientName,
    subject,
    bodyTextPreview: buildBodyTextPreview(bodyText),
    providerMessageId: providerResult.providerMessageId,
    providerResultStatus: providerResult.status,
  });

  if (!deliveryLogResult.ok) {
    return jsonResponse(
      {
        status: "error",
        error: "delivery_log_persist_failed",
        message: deliveryLogResult.error,
        providerMessageId: providerResult.providerMessageId,
        providerResult,
      },
      500,
    );
  }

  return jsonResponse(
    {
      status: "sent",
      providerMessageId: providerResult.providerMessageId,
      deliveryLogId: deliveryLogResult.deliveryLogId,
      providerResult,
    },
    200,
  );
});
