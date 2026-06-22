/**
 * V6 Phase 53 / 60: Edge-safe reminder email template framework.
 * Plain-text subject/body generation and preview only — no email sending.
 */

export const DEFAULT_ORGANISATION_NAME = "Compliance Reminder System";

export const REMINDER_EMAIL_TEMPLATE_TOKENS = [
  "recipientName",
  "personName",
  "complianceType",
  "reminderType",
  "dueDate",
  "organisationName",
  "contactName",
] as const;

const FALLBACK_RECIPIENT_NAME = "there";
const FALLBACK_PERSON_NAME = "team member";
const FALLBACK_COMPLIANCE_TYPE = "compliance item";
const FALLBACK_REMINDER_TYPE = "reminder";
const FALLBACK_DUE_DATE_ISO = "date not set";
const FALLBACK_DUE_DATE_TEXT = "a date not set";

const REMINDER_EMAIL_SUBJECT_TEMPLATE =
  "Reminder: {{complianceType}} expires on {{dueDate}}";

const REMINDER_EMAIL_BODY_TEMPLATE = [
  "Hello {{recipientName}},",
  "",
  "This is a reminder that {{personName}}'s {{complianceType}} is due to expire on {{dueDate}}.",
  "",
  "Please arrange renewal or update the compliance record once complete.",
  "",
  "Thank you,",
  "{{organisationName}}",
].join("\n");

export type ReminderEmailTemplateTokenMap = Record<
  (typeof REMINDER_EMAIL_TEMPLATE_TOKENS)[number],
  string
>;

export type ReminderEmailTemplateOptions = {
  organisationName?: string | null;
  contactName?: string | null;
  recipientName?: string | null;
  personName?: string | null;
};

export type ReminderEmailPreview = {
  subject: string;
  bodyText: string;
};

function normalizeText(value: unknown): string {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function parseDateAtMidnight(dateString: string): Date {
  const text = normalizeText(dateString);

  if (!text) {
    return new Date(NaN);
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : text.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(text)
      ? text.slice(0, 10)
      : text;

  const parts = normalized.split("-").map(Number);

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return new Date(NaN);
  }

  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

function resolveCandidateField(
  candidate: Record<string, unknown> | null | undefined,
  keys: string[],
  optionValue?: string | null,
): string {
  const optionText = normalizeText(optionValue);

  if (optionText) {
    return optionText;
  }

  if (!candidate || typeof candidate !== "object") {
    return "";
  }

  for (const key of keys) {
    const value = normalizeText(candidate[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function resolveDueDateIso(rawDueDate: string): string {
  const dueDate = normalizeText(rawDueDate);
  return dueDate || FALLBACK_DUE_DATE_ISO;
}

function formatReminderDueDateLong(dateString: string): string {
  const date = parseDateAtMidnight(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function resolveDueDateText(rawDueDate: string): string {
  const dueDate = normalizeText(rawDueDate);

  if (!dueDate) {
    return FALLBACK_DUE_DATE_TEXT;
  }

  const formatted = formatReminderDueDateLong(dueDate);
  return formatted === "Invalid date" ? FALLBACK_DUE_DATE_TEXT : formatted;
}

export function buildReminderEmailTokenMap(
  candidate: Record<string, unknown> | null | undefined,
  options: ReminderEmailTemplateOptions = {},
): ReminderEmailTemplateTokenMap {
  const recipientName =
    resolveCandidateField(
      candidate,
      ["recipientName", "recipient_name"],
      options.recipientName,
    ) || FALLBACK_RECIPIENT_NAME;

  const personName =
    resolveCandidateField(
      candidate,
      ["personName", "person_name", "name"],
      options.personName,
    ) || FALLBACK_PERSON_NAME;

  const complianceType =
    resolveCandidateField(candidate, ["complianceType", "compliance_type"]) ||
    FALLBACK_COMPLIANCE_TYPE;

  const reminderType =
    resolveCandidateField(candidate, ["reminderType", "reminder_type"]) ||
    FALLBACK_REMINDER_TYPE;

  const rawDueDate = resolveCandidateField(candidate, [
    "dueDate",
    "due_date",
    "expiryDate",
    "expiry_date",
  ]);

  const organisationName =
    resolveCandidateField(
      candidate,
      ["organisationName", "organisation_name"],
      options.organisationName,
    ) || DEFAULT_ORGANISATION_NAME;

  const contactName =
    resolveCandidateField(candidate, ["contactName", "contact_name"], options.contactName) ||
    recipientName ||
    organisationName;

  return {
    recipientName,
    personName,
    complianceType,
    reminderType,
    dueDate: resolveDueDateIso(rawDueDate),
    organisationName,
    contactName,
  };
}

export function replaceReminderEmailTokens(
  template: string,
  tokens: Partial<ReminderEmailTemplateTokenMap>,
): string {
  let output = String(template ?? "");

  for (const tokenName of REMINDER_EMAIL_TEMPLATE_TOKENS) {
    const replacement = normalizeText(tokens[tokenName]);

    if (!replacement) {
      continue;
    }

    output = output.replaceAll(`{{${tokenName}}}`, replacement);
  }

  return output;
}

function buildSubjectTokenMap(
  candidate: Record<string, unknown> | null | undefined,
  options: ReminderEmailTemplateOptions = {},
): ReminderEmailTemplateTokenMap {
  const tokens = buildReminderEmailTokenMap(candidate, options);
  const rawDueDate = resolveCandidateField(candidate, [
    "dueDate",
    "due_date",
    "expiryDate",
    "expiry_date",
  ]);

  return {
    ...tokens,
    dueDate: resolveDueDateIso(rawDueDate),
  };
}

function buildBodyTokenMap(
  candidate: Record<string, unknown> | null | undefined,
  options: ReminderEmailTemplateOptions = {},
): ReminderEmailTemplateTokenMap {
  const tokens = buildReminderEmailTokenMap(candidate, options);
  const rawDueDate = resolveCandidateField(candidate, [
    "dueDate",
    "due_date",
    "expiryDate",
    "expiry_date",
  ]);

  return {
    ...tokens,
    dueDate: resolveDueDateText(rawDueDate),
  };
}

export function buildReminderEmailSubject(
  candidate: Record<string, unknown> | null | undefined,
  options: ReminderEmailTemplateOptions = {},
): string {
  return replaceReminderEmailTokens(
    REMINDER_EMAIL_SUBJECT_TEMPLATE,
    buildSubjectTokenMap(candidate, options),
  );
}

export function buildReminderEmailBody(
  candidate: Record<string, unknown> | null | undefined,
  options: ReminderEmailTemplateOptions = {},
): string {
  return replaceReminderEmailTokens(
    REMINDER_EMAIL_BODY_TEMPLATE,
    buildBodyTokenMap(candidate, options),
  );
}

export function buildReminderEmailPreview(
  candidate: Record<string, unknown> | null | undefined,
  options: ReminderEmailTemplateOptions = {},
): ReminderEmailPreview {
  return {
    subject: buildReminderEmailSubject(candidate, options),
    bodyText: buildReminderEmailBody(candidate, options),
  };
}
