/**
 * V6 Phase 55: Temporary staging verification — email provider disabled by default.
 * Invokes sendReminderEmail with harmless fake input; confirms no live send path.
 * No delivery_status/sent_at/provider_message_id writes; no mark_reminder_sent.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  getEmailProviderConfig,
  isEmailSendingEnabled,
  sendReminderEmail,
} from "../_shared/email-provider.ts";

const VERIFICATION_MODE = "provider_disabled_verification";

const FAKE_REMINDER_INPUT = {
  to: "provider-disabled-verify@example.invalid",
  subject: "[CRS] Provider disabled-mode verification (no send)",
  bodyText:
    "Harmless verification payload. EMAIL_SENDING_ENABLED must be false on staging.",
};

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

  const env = readDenoEnv();
  const config = getEmailProviderConfig(env);

  if (isEmailSendingEnabled(config)) {
    return jsonResponse(
      {
        status: "error",
        mode: VERIFICATION_MODE,
        error: "email_sending_enabled_on_staging",
        emailProviderStatus: "enabled",
      },
      409,
    );
  }

  const providerResult = await sendReminderEmail(FAKE_REMINDER_INPUT, config);

  if (providerResult.status !== "disabled") {
    return jsonResponse(
      {
        status: "error",
        mode: VERIFICATION_MODE,
        error: "expected_disabled_provider_result",
        emailProviderStatus: providerResult.status,
        providerResult,
      },
      500,
    );
  }

  return jsonResponse(
    {
      status: "ok",
      mode: VERIFICATION_MODE,
      emailProviderStatus: "disabled",
      providerResult,
    },
    200,
  );
});
