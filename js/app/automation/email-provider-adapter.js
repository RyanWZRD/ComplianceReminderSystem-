/**
 * V6 Phase 11: Email provider adapter factory.
 * Resolves config into a provider surface (disabled, mock, or skeleton real providers).
 * No fetch, SMTP, external SDKs, real delivery, mark-as-sent automation, or network calls.
 */

import { createMockEmailProvider } from "./mock-email-provider.js";
import { createResendEmailProvider } from "./providers/resend-provider.js";
import { createSendgridEmailProvider } from "./providers/sendgrid-provider.js";
import { createSmtpEmailProvider } from "./providers/smtp-provider.js";

/** @typedef {import("./email-provider-config.js").EmailProviderName | "mock"} AdapterProviderName */

/** @type {readonly AdapterProviderName[]} */
export const UNIMPLEMENTED_EMAIL_PROVIDERS = ["resend", "sendgrid", "smtp"];

/** @type {Record<string, (options: { config?: Record<string, unknown> }) => unknown>} */
const SKELETON_EMAIL_PROVIDER_FACTORIES = {
  resend: createResendEmailProvider,
  sendgrid: createSendgridEmailProvider,
  smtp: createSmtpEmailProvider,
};

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

  const skeletonFactory = SKELETON_EMAIL_PROVIDER_FACTORIES[resolvedConfig.provider];

  if (skeletonFactory) {
    return skeletonFactory({ config: resolvedConfig });
  }

  return createDisabledEmailProvider();
}
