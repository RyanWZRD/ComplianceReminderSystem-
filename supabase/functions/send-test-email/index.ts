/**
 * V6 Phase 56: Controlled manual test-send Edge Function.
 * Sends exactly one email through the provider to an allowlisted recipient.
 * No delivery log persistence, automation run records, or compliance writes.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  getEmailProviderConfig,
  isEmailSendingEnabled,
  sendReminderEmail,
} from "../_shared/email-provider.ts";

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

function createUserSupabaseClient(req: Request) {
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

  const toRaw = payload.to;
  const subjectRaw = payload.subject;
  const bodyTextRaw = payload.bodyText;

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

  const providerResult = await sendReminderEmail(
    {
      to,
      subject: subjectRaw.trim(),
      bodyText: bodyTextRaw.trim(),
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

  return jsonResponse(
    {
      status: "sent",
      providerMessageId: providerResult.providerMessageId,
      providerResult,
    },
    200,
  );
});
