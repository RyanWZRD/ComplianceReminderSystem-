/**
 * Browser-readable email provider settings synced from .env via npm run sync-env.
 * Do not commit secrets — keep RESEND_API_KEY empty in git defaults.
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
