/**
 * V6 Phase 14: Resend email provider skeleton.
 * Placeholder module for future Resend integration — no fetch, API keys, SDKs, or real sending.
 */

/**
 * Create a Resend email provider skeleton.
 *
 * @param {{ config?: Record<string, unknown> }} [options]
 * @returns {{
 *   healthCheck: () => Promise<{ status: "not_implemented"; provider: "resend" }>;
 *   sendReminder: (input: {
 *     to: string;
 *     subject: string;
 *     bodyText: string;
 *     metadata?: Record<string, unknown>;
 *   }) => Promise<never>;
 * }}
 */
export function createResendEmailProvider({ config } = {}) {
  void config;

  return {
    async healthCheck() {
      return {
        status: "not_implemented",
        provider: "resend",
      };
    },

    async sendReminder() {
      throw new Error("Provider resend is not implemented yet");
    },
  };
}
