/**
 * V6 Phase 19: Resend email provider adapter.
 * LEGACY BROWSER MODULE — used by manual-delivery-execution.js until Phase 39 Edge Function wiring.
 * Network implementation uses injected fetchImpl only (browser fetch when wired from manual delivery UI).
 * Server-side sends use the Supabase Edge Function — not this module.
 * No mark-as-sent automation, compliance/action/history mutation, or app wiring beyond manual delivery.
 */

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/** @type {ReadonlySet<number>} */
const TRANSIENT_HTTP_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** @type {ReadonlySet<number>} */
const PERMANENT_HTTP_STATUS_CODES = new Set([400, 401, 403, 404, 422]);

/**
 * @param {Record<string, unknown> | undefined} config
 * @returns {{ status: "disabled"; provider: "resend" } | { status: "invalid_config"; provider: "resend" } | { status: "ok"; provider: "resend"; mode: string }}
 */
function resolveResendConfigHealth(config) {
  if (!config || config.enabled !== true) {
    return { status: "disabled", provider: "resend" };
  }

  if (config.provider !== "resend") {
    return { status: "invalid_config", provider: "resend" };
  }

  if (config.mode !== "test" && config.mode !== "production") {
    return { status: "invalid_config", provider: "resend" };
  }

  if (!String(config.apiKey ?? "").trim()) {
    return { status: "invalid_config", provider: "resend" };
  }

  if (!String(config.fromEmail ?? "").trim()) {
    return { status: "invalid_config", provider: "resend" };
  }

  if (config.mode === "test" && !String(config.testRedirectTo ?? "").trim()) {
    return { status: "invalid_config", provider: "resend" };
  }

  return {
    status: "ok",
    provider: "resend",
    mode: String(config.mode),
  };
}

/**
 * @param {Record<string, unknown> | undefined} config
 * @returns {string}
 */
function assertResendConfigForSend(config) {
  const health = resolveResendConfigHealth(config);

  if (health.status === "disabled") {
    throw new Error("Resend email provider is disabled");
  }

  if (health.status === "invalid_config") {
    throw new Error("Resend email provider configuration is invalid");
  }

  return health.mode;
}

/**
 * @param {number} status
 * @returns {{ failureType: "transient" | "permanent"; failureReason: string }}
 */
function mapResendHttpFailure(status) {
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
 * Create a Resend email provider.
 *
 * @param {{
 *   config?: Record<string, unknown>;
 *   fetchImpl?: typeof fetch;
 * }} options
 * @returns {{
 *   healthCheck: () => Promise<
 *     | { status: "disabled"; provider: "resend" }
 *     | { status: "invalid_config"; provider: "resend" }
 *     | { status: "ok"; provider: "resend"; mode: string }
 *   >;
 *   sendReminder: (input: {
 *     to: string;
 *     subject: string;
 *     bodyText: string;
 *     metadata?: Record<string, unknown>;
 *   }) => Promise<
 *     | { status: "delivered"; providerMessageId: string; deliveredAt: string }
 *     | { status: "failed"; failureType: "transient" | "permanent"; failureReason: string }
 *   >;
 * }}
 */
export function createResendEmailProvider({ config, fetchImpl } = {}) {
  return {
    async healthCheck() {
      return resolveResendConfigHealth(config);
    },

    /**
     * @param {{
     *   to: string;
     *   subject: string;
     *   bodyText: string;
     *   metadata?: Record<string, unknown>;
     * }} input
     */
    async sendReminder({ to, subject, bodyText, metadata }) {
      const mode = assertResendConfigForSend(config);

      const recipient = String(to ?? "").trim();

      if (!recipient) {
        throw new Error("sendReminder requires a recipient address.");
      }

      if (!String(subject ?? "").trim()) {
        throw new Error("sendReminder requires a subject.");
      }

      if (!String(bodyText ?? "").trim()) {
        throw new Error("sendReminder requires bodyText.");
      }

      void metadata;

      if (typeof fetchImpl !== "function") {
        throw new Error("Resend email provider requires fetchImpl");
      }

      const resolvedRecipient =
        mode === "test" ? String(config.testRedirectTo).trim() : recipient;

      const resolvedSubject =
        mode === "test" ? `[TEST] ${String(subject).trim()}` : String(subject).trim();

      /** @type {Record<string, unknown>} */
      const payload = {
        from: String(config.fromEmail).trim(),
        to: [resolvedRecipient],
        subject: resolvedSubject,
        text: String(bodyText).trim(),
      };

      const replyTo = String(config.replyToEmail ?? "").trim();

      if (replyTo) {
        payload.reply_to = replyTo;
      }

      let response;

      try {
        response = await fetchImpl(RESEND_EMAILS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${String(config.apiKey).trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        return {
          status: "failed",
          failureType: "transient",
          failureReason: "resend_network_error",
        };
      }

      if (response.status >= 200 && response.status < 300) {
        let responseBody = {};

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
          status: "delivered",
          providerMessageId,
          deliveredAt: new Date().toISOString(),
        };
      }

      const failure = mapResendHttpFailure(response.status);

      return {
        status: "failed",
        failureType: failure.failureType,
        failureReason: failure.failureReason,
      };
    },
  };
}
