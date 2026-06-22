/**
 * V6 Phase 54: Edge shared email provider foundation — disabled by default.
 * Provider abstraction and configuration/safety gates only.
 * Not wired into scheduled-reminder-runner; no live sends from this phase.
 */

export type EmailEnv = Record<string, string | undefined>;

export interface EmailProviderConfig {
  provider: string;
  emailSendingEnabled: boolean;
  resendApiKey: string;
  fromAddress: string;
}

export interface ReminderEmailInput {
  to: string;
  subject: string;
  bodyText: string;
  replyTo?: string;
}

export type SendReminderEmailResult =
  | { status: "disabled"; reason: "email_sending_disabled" }
  | { status: "error"; error: string; code: string }
  | { status: "sent"; providerMessageId: string };

export interface EmailProvider {
  readonly name: string;
  sendReminder(input: ReminderEmailInput): Promise<SendReminderEmailResult>;
}

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/**
 * EMAIL_SENDING_ENABLED defaults to false when unset or empty.
 */
function parseEmailSendingEnabled(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

/**
 * @param env Environment map (e.g. Deno.env entries).
 */
export function getEmailProviderConfig(env: EmailEnv): EmailProviderConfig {
  const providerRaw = (env.EMAIL_PROVIDER ?? "resend").trim();
  const provider = providerRaw || "resend";

  return {
    provider,
    emailSendingEnabled: parseEmailSendingEnabled(env.EMAIL_SENDING_ENABLED),
    resendApiKey: (env.RESEND_API_KEY ?? "").trim(),
    fromAddress: (env.EMAIL_FROM_ADDRESS ?? "").trim(),
  };
}

export function isEmailSendingEnabled(config: EmailProviderConfig): boolean {
  return config.emailSendingEnabled === true;
}

/**
 * @returns Config validation error code, or null when ready to send.
 */
function validateEnabledSendConfig(config: EmailProviderConfig): string | null {
  if (config.provider !== "resend") {
    return "unsupported_email_provider";
  }

  if (!config.resendApiKey) {
    return "provider_not_configured";
  }

  if (!config.fromAddress) {
    return "invalid_config";
  }

  return null;
}

async function sendViaResend(
  config: EmailProviderConfig,
  input: ReminderEmailInput,
): Promise<SendReminderEmailResult> {
  const validationError = validateEnabledSendConfig(config);

  if (validationError) {
    return { status: "error", error: validationError, code: validationError };
  }

  const payload: Record<string, unknown> = {
    from: config.fromAddress,
    to: [input.to],
    subject: input.subject,
    text: input.bodyText,
  };

  const replyTo = (input.replyTo ?? "").trim();

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  let response: Response;

  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "resend_network_error",
      code: "network_error",
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      error: `resend_http_${response.status}`,
      code: "provider_http_error",
    };
  }

  let body: { id?: string };

  try {
    body = await response.json();
  } catch {
    return {
      status: "error",
      error: "resend_invalid_response",
      code: "invalid_response",
    };
  }

  const providerMessageId = String(body?.id ?? "").trim();

  if (!providerMessageId) {
    return {
      status: "error",
      error: "resend_missing_message_id",
      code: "invalid_response",
    };
  }

  return { status: "sent", providerMessageId };
}

export function createEmailProvider(config: EmailProviderConfig): EmailProvider {
  const providerName = config.provider || "resend";

  return {
    name: providerName,
    sendReminder: (input) => sendViaResend(config, input),
  };
}

function readDenoEnv(): EmailEnv {
  const keys = [
    "RESEND_API_KEY",
    "EMAIL_SENDING_ENABLED",
    "EMAIL_FROM_ADDRESS",
    "EMAIL_PROVIDER",
  ] as const;

  const env: EmailEnv = {};

  for (const key of keys) {
    const value = Deno.env.get(key);

    if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
}

/**
 * Send a reminder email through the configured provider.
 * Returns a safe disabled result when EMAIL_SENDING_ENABLED is not explicitly true.
 */
export async function sendReminderEmail(
  input: ReminderEmailInput,
  config?: EmailProviderConfig,
): Promise<SendReminderEmailResult> {
  const resolvedConfig = config ?? getEmailProviderConfig(readDenoEnv());

  if (!isEmailSendingEnabled(resolvedConfig)) {
    return { status: "disabled", reason: "email_sending_disabled" };
  }

  const validationError = validateEnabledSendConfig(resolvedConfig);

  if (validationError) {
    return { status: "error", error: validationError, code: validationError };
  }

  const provider = createEmailProvider(resolvedConfig);
  return provider.sendReminder(input);
}
