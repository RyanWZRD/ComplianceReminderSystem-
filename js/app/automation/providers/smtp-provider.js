/**
 * V6 Phase 14: SMTP email provider skeleton.
 * Placeholder module for future SMTP relay integration — no transport, credentials, or real sending.
 */

/**
 * Create an SMTP email provider skeleton.
 *
 * @param {{ config?: Record<string, unknown> }} [options]
 * @returns {{
 *   healthCheck: () => Promise<{ status: "not_implemented"; provider: "smtp" }>;
 *   sendReminder: (input: {
 *     to: string;
 *     subject: string;
 *     bodyText: string;
 *     metadata?: Record<string, unknown>;
 *   }) => Promise<never>;
 * }}
 */
export function createSmtpEmailProvider({ config } = {}) {
  void config;

  return {
    async healthCheck() {
      return {
        status: "not_implemented",
        provider: "smtp",
      };
    },

    async sendReminder() {
      throw new Error("Provider smtp is not implemented yet");
    },
  };
}
