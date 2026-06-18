/**
 * V6 Phase 14: SendGrid email provider skeleton.
 * Placeholder module for future SendGrid integration — no fetch, API keys, SDKs, or real sending.
 */

/**
 * Create a SendGrid email provider skeleton.
 *
 * @param {{ config?: Record<string, unknown> }} [options]
 * @returns {{
 *   healthCheck: () => Promise<{ status: "not_implemented"; provider: "sendgrid" }>;
 *   sendReminder: (input: {
 *     to: string;
 *     subject: string;
 *     bodyText: string;
 *     metadata?: Record<string, unknown>;
 *   }) => Promise<never>;
 * }}
 */
export function createSendgridEmailProvider({ config } = {}) {
  void config;

  return {
    async healthCheck() {
      return {
        status: "not_implemented",
        provider: "sendgrid",
      };
    },

    async sendReminder() {
      throw new Error("Provider sendgrid is not implemented yet");
    },
  };
}
