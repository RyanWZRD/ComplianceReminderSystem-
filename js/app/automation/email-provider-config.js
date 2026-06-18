/**
 * V6 Phase 10: Email provider configuration shape.
 * Reads environment-backed settings only — no provider implementation, no sending,
 * no mark-as-sent automation, or external network calls.
 */

/** @typedef {"none" | "resend" | "sendgrid" | "smtp"} EmailProviderName */
/** @typedef {"disabled" | "test" | "production"} EmailProviderMode */

/** @type {readonly EmailProviderName[]} */
export const SUPPORTED_EMAIL_PROVIDERS = ["none", "resend", "sendgrid", "smtp"];

/** @type {readonly EmailProviderMode[]} */
export const SUPPORTED_EMAIL_MODES = ["disabled", "test", "production"];

export const DEFAULT_EMAIL_RATE_LIMIT_PER_RUN = 50;

/**
 * @param {string | undefined | null} value
 * @returns {boolean}
 */
function parseBooleanEnv(value) {
  return value === "true" || value === "1";
}

/**
 * @param {string | undefined | null} value
 * @param {number} fallback
 * @returns {number}
 */
function parsePositiveIntEnv(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

/**
 * @param {string | undefined | null} value
 * @returns {EmailProviderName}
 */
function parseProvider(value) {
  const normalized = String(value ?? "none").trim().toLowerCase();

  if (SUPPORTED_EMAIL_PROVIDERS.includes(normalized)) {
    return /** @type {EmailProviderName} */ (normalized);
  }

  return "none";
}

/**
 * @param {string | undefined | null} value
 * @returns {EmailProviderMode}
 */
function parseMode(value) {
  const normalized = String(value ?? "disabled").trim().toLowerCase();

  if (SUPPORTED_EMAIL_MODES.includes(normalized)) {
    return /** @type {EmailProviderMode} */ (normalized);
  }

  return "disabled";
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{
 *   provider: EmailProviderName;
 *   mode: EmailProviderMode;
 *   fromEmail: string | null;
 *   replyToEmail: string | null;
 *   rateLimitPerRun: number;
 *   enabled: boolean;
 * }}
 */
export function getEmailProviderConfig(env) {
  const source =
    env ??
    (typeof process !== "undefined" && process.env ? process.env : /** @type {Record<string, string | undefined>} */ ({}));

  const provider = parseProvider(source.EMAIL_PROVIDER);
  const mode = parseMode(source.EMAIL_MODE);
  const fromEmail = String(source.EMAIL_FROM_ADDRESS ?? "").trim() || null;
  const replyToEmail = String(source.EMAIL_REPLY_TO_ADDRESS ?? "").trim() || null;
  const rateLimitPerRun = parsePositiveIntEnv(
    source.EMAIL_RATE_LIMIT_PER_RUN,
    DEFAULT_EMAIL_RATE_LIMIT_PER_RUN
  );

  const explicitlyEnabled = parseBooleanEnv(source.EMAIL_PROVIDER_ENABLED);
  const enabled = explicitlyEnabled && provider !== "none" && mode !== "disabled";

  if (
    source.EMAIL_PROVIDER === undefined &&
    source.EMAIL_MODE === undefined &&
    source.EMAIL_PROVIDER_ENABLED === undefined &&
    source.EMAIL_FROM_ADDRESS === undefined &&
    source.EMAIL_REPLY_TO_ADDRESS === undefined &&
    source.EMAIL_RATE_LIMIT_PER_RUN === undefined
  ) {
    return {
      provider: "none",
      mode: "disabled",
      fromEmail: null,
      replyToEmail: null,
      rateLimitPerRun: DEFAULT_EMAIL_RATE_LIMIT_PER_RUN,
      enabled: false,
    };
  }

  return {
    provider,
    mode,
    fromEmail,
    replyToEmail,
    rateLimitPerRun,
    enabled,
  };
}
