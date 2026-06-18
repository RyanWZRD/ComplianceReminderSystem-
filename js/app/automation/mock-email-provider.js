/**
 * V6 Phase 6: Mock email provider adapter.
 * Simulated provider for testing delivery flow without real email sends.
 * No fetch, SMTP, external APIs, compliance/action/history mutation, or mark-as-sent.
 */

/** @typedef {"success" | "transient_failure" | "permanent_failure"} MockEmailProviderMode */

/** @type {readonly MockEmailProviderMode[]} */
export const MOCK_EMAIL_PROVIDER_MODES = [
  "success",
  "transient_failure",
  "permanent_failure",
];

let mockMessageSequence = 0;

/**
 * @param {string} prefix
 * @returns {string}
 */
function nextMockProviderMessageId(prefix) {
  mockMessageSequence += 1;
  return `${prefix}-${mockMessageSequence}`;
}

/**
 * Create a mock email provider for delivery-flow testing.
 *
 * @param {{ mode?: MockEmailProviderMode }} [options]
 * @returns {{
 *   sendReminder: (input: {
 *     to: string;
 *     subject: string;
 *     bodyText: string;
 *     metadata?: Record<string, unknown>;
 *   }) => Promise<
 *     | { status: "delivered"; providerMessageId: string; deliveredAt: string }
 *     | { status: "failed"; failureType: "transient" | "permanent"; failureReason: string }
 *   >;
 *   healthCheck: () => Promise<{ status: "ok"; provider: "mock" }>;
 * }}
 */
export function createMockEmailProvider({ mode = "success" } = {}) {
  if (!MOCK_EMAIL_PROVIDER_MODES.includes(mode)) {
    throw new Error(`Invalid mock email provider mode "${String(mode)}".`);
  }

  return {
    /**
     * @param {{
     *   to: string;
     *   subject: string;
     *   bodyText: string;
     *   metadata?: Record<string, unknown>;
     * }} input
     */
    async sendReminder({ to, subject, bodyText, metadata }) {
      if (!String(to ?? "").trim()) {
        throw new Error("sendReminder requires a recipient address.");
      }

      if (!String(subject ?? "").trim()) {
        throw new Error("sendReminder requires a subject.");
      }

      if (!String(bodyText ?? "").trim()) {
        throw new Error("sendReminder requires bodyText.");
      }

      void metadata;

      if (mode === "success") {
        return {
          status: "delivered",
          providerMessageId: nextMockProviderMessageId("mock"),
          deliveredAt: new Date().toISOString(),
        };
      }

      if (mode === "transient_failure") {
        return {
          status: "failed",
          failureType: "transient",
          failureReason: "mock_transient_provider_error",
        };
      }

      return {
        status: "failed",
        failureType: "permanent",
        failureReason: "mock_permanent_provider_error",
      };
    },

    async healthCheck() {
      return {
        status: "ok",
        provider: "mock",
      };
    },
  };
}
