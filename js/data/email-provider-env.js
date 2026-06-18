/**
 * Browser-readable email provider settings synced from .env via npm run sync-env.
 *
 * SAFETY: Do not commit secrets — keep RESEND_API_KEY undefined in git defaults.
 * Committed undefined values disable the browser provider (see getEmailProviderConfig).
 * RESEND_API_KEY belongs in Supabase Edge Function secrets for server-side sends (Phase 38+).
 * After Phase 39, the Manual Delivery UI must use the server-side Edge Function — not browser Resend.
 */

/** @type {Record<string, string | undefined>} */
export const EMAIL_PROVIDER_RUNTIME = {
  EMAIL_PROVIDER: undefined,
  EMAIL_MODE: undefined,
  EMAIL_PROVIDER_ENABLED: undefined,
  EMAIL_FROM_ADDRESS: undefined,
  EMAIL_REPLY_TO_ADDRESS: undefined,
  EMAIL_RATE_LIMIT_PER_RUN: undefined,
  EMAIL_TEST_REDIRECT_TO: undefined,
  RESEND_API_KEY: undefined,
};
