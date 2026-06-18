/**
 * V6 Phase 11: Email provider adapter factory.
 * Resolves config into a provider surface (disabled, mock, or not-yet-implemented placeholders).
 * No fetch, SMTP, external SDKs, real delivery, mark-as-sent automation, or network calls.
 */

import { createMockEmailProvider } from "./mock-email-provider.js";

/** @typedef {import("./email-provider-config.js").EmailProviderName | "mock"} AdapterProviderName */

/** @type {readonly AdapterProviderName[]} */
export const UNIMPLEMENTED_EMAIL_PROVIDERS = ["resend", "sendgrid", "smtp"];

/**
 * @returns {{
 *   healthCheck: () => Promise<{ status: "disabled"; provider: "none" }>;
 *   sendReminder: (input: {
 *     to: string;
 *     subject: string;
 *     bodyText: string;
 *     metadata?: Record<string, unknown>;
 *   }) => Promise<never>;
 * }}
 */
function createDisabledEmailProvider() {
  return {
    async healthCheck() {
      return {
        status: "disabled",
        provider: "none",
      };
    },

    async sendReminder() {
      throw new Error("Email provider is disabled");
    },
  };
}

/**
 * @param {string} providerName
 * @returns {{
 *   healthCheck: () => Promise<{ status: "not_implemented"; provider: string }>;
 *   sendReminder: (input: {
 *     to: string;
 *     subject: string;
 *     bodyText: string;
 *     metadata?: Record<string, unknown>;
 *   }) => Promise<never>;
 * }}
 */
function createNotImplementedEmailProvider(providerName) {
  return {
    async healthCheck() {
      return {
        status: "not_implemented",
        provider: providerName,
      };
    },

    async sendReminder() {
      throw new Error(`Provider ${providerName} is not implemented yet`);
    },
  };
}

/**
 * Create an email provider adapter from configuration.
 *
 * @param {{
 *   config?: {
 *     provider: AdapterProviderName;
 *     mode: string;
 *     fromEmail: string | null;
 *     replyToEmail: string | null;
 *     rateLimitPerRun: number;
 *     enabled: boolean;
 *   };
 *   mockProvider?: {
 *     sendReminder: (input: {
 *       to: string;
 *       subject: string;
 *       bodyText: string;
 *       metadata?: Record<string, unknown>;
 *     }) => Promise<unknown>;
 *     healthCheck: () => Promise<unknown>;
 *   };
 * }} [options]
 */
export function createEmailProviderAdapter({ config, mockProvider } = {}) {
  const resolvedConfig = config ?? {
    provider: "none",
    mode: "disabled",
    fromEmail: null,
    replyToEmail: null,
    rateLimitPerRun: 50,
    enabled: false,
  };

  if (!resolvedConfig.enabled) {
    return createDisabledEmailProvider();
  }

  if (resolvedConfig.provider === "mock") {
    return mockProvider ?? createMockEmailProvider({ mode: "success" });
  }

  if (UNIMPLEMENTED_EMAIL_PROVIDERS.includes(resolvedConfig.provider)) {
    return createNotImplementedEmailProvider(resolvedConfig.provider);
  }

  return createDisabledEmailProvider();
}
