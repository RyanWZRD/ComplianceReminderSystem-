/**
 * V6 Phase 45–47, 51, 59–61: scheduled-reminder-runner Edge Function.
 * Phase 47: persists one automation_runs audit row per successful dry run (service role).
 * Phase 51: persists reminder_delivery_logs rows per dry-run candidate (pending/skipped only).
 * Phase 59: explicit mode gate (dry_run default; live_send refused when sending gate off).
 * Phase 60: live_send_preview — email subject/body preview metadata only; still no sends.
 * Phase 61: live_send — allowlisted recipients only; delivery log audit.
 * Phase 62: live_send — mark reminders sent via mark_reminder_sent after successful send + log.
 * Phase 63: live_send — duplicate prevention via reminder_delivery_logs idempotency check.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  getEmailProviderConfig,
  isEmailSendingEnabled,
  sendReminderEmail,
  type EmailProviderConfig,
} from "../_shared/email-provider.ts";
import { buildReminderEmailPreview } from "../_shared/reminder-email-template.ts";

const SCHEDULED_RUNNER_DRY_RUN_MODE = "dry_run";
const SCHEDULED_RUNNER_LIVE_SEND_MODE = "live_send";
const SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE = "live_send_preview";
const SCHEDULED_RUNNER_DRY_RUN_RUN_TYPE = "scheduled_reminder_dry_run";
const SCHEDULED_RUNNER_PREVIEW_RUN_TYPE = "scheduled_reminder_live_send_preview";
const SCHEDULED_RUNNER_LIVE_SEND_RUN_TYPE = "scheduled_reminder_live_send";
const BODY_TEXT_PREVIEW_MAX_LENGTH = 500;
const MARK_SENT_RPC = "mark_reminder_sent";

/**
 * SCHEDULED_EMAIL_SENDING_ENABLED defaults to false when unset or empty.
 * Only explicit true / 1 / yes enables the gate (live send still refused in Phase 59).
 */
function parseScheduledEmailSendingEnabled(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function isScheduledEmailSendingEnabled(): boolean {
  return parseScheduledEmailSendingEnabled(
    Deno.env.get("SCHEDULED_EMAIL_SENDING_ENABLED"),
  );
}

/**
 * SCHEDULED_EMAIL_PREVIEW_ENABLED defaults to false when unset or empty.
 * Only explicit true / 1 / yes enables live_send_preview (Phase 60).
 */
function parseScheduledEmailPreviewEnabled(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function isScheduledEmailPreviewEnabled(): boolean {
  return parseScheduledEmailPreviewEnabled(
    Deno.env.get("SCHEDULED_EMAIL_PREVIEW_ENABLED"),
  );
}

function readLiveSendEnv(): Record<string, string | undefined> {
  const keys = [
    "RESEND_API_KEY",
    "EMAIL_SENDING_ENABLED",
    "EMAIL_FROM_ADDRESS",
    "EMAIL_PROVIDER",
    "SCHEDULED_EMAIL_ALLOWLIST",
  ] as const;

  const env: Record<string, string | undefined> = {};

  for (const key of keys) {
    const value = Deno.env.get(key);

    if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
}

/**
 * @param raw Comma-separated allowlist from SCHEDULED_EMAIL_ALLOWLIST.
 */
function parseScheduledEmailAllowlist(raw: string | undefined): Set<string> {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return new Set(entries);
}

/**
 * @param bodyText Full plain-text body from the email template.
 */
function buildBodyTextPreview(bodyText: string): string {
  const trimmed = bodyText.trim();

  if (trimmed.length <= BODY_TEXT_PREVIEW_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, BODY_TEXT_PREVIEW_MAX_LENGTH)}…`;
}

type LiveSendConfigValidationResult =
  | { ok: true; config: EmailProviderConfig; allowlist: Set<string> }
  | {
      ok: false;
      status: number;
      body: {
        status: "refused" | "error";
        mode: typeof SCHEDULED_RUNNER_LIVE_SEND_MODE;
        reason?: string;
        error?: string;
        code?: string;
      };
    };

function validateLiveSendConfiguration(
  env: Record<string, string | undefined>,
): LiveSendConfigValidationResult {
  const config = getEmailProviderConfig(env);

  if (!isEmailSendingEnabled(config)) {
    return {
      ok: false,
      status: 403,
      body: {
        status: "refused",
        mode: SCHEDULED_RUNNER_LIVE_SEND_MODE,
        reason: "email_sending_disabled",
      },
    };
  }

  if (!config.resendApiKey) {
    return {
      ok: false,
      status: 503,
      body: {
        status: "error",
        mode: SCHEDULED_RUNNER_LIVE_SEND_MODE,
        error: "provider_not_configured",
        code: "provider_not_configured",
      },
    };
  }

  if (!config.fromAddress) {
    return {
      ok: false,
      status: 503,
      body: {
        status: "error",
        mode: SCHEDULED_RUNNER_LIVE_SEND_MODE,
        error: "invalid_config",
        code: "invalid_config",
      },
    };
  }

  const allowlist = parseScheduledEmailAllowlist(env.SCHEDULED_EMAIL_ALLOWLIST);

  if (allowlist.size === 0) {
    return {
      ok: false,
      status: 503,
      body: {
        status: "error",
        mode: SCHEDULED_RUNNER_LIVE_SEND_MODE,
        error: "scheduled_email_allowlist_not_configured",
        code: "scheduled_email_allowlist_not_configured",
      },
    };
  }

  return { ok: true, config, allowlist };
}

const REMINDER_UI_LABELS = {
  30: "30 Day Reminder",
  14: "14 Day Reminder",
  7: "7 Day Reminder",
  expired: "Expired",
} as const;

const DEFAULT_REMINDER_SETTINGS = {
  days30: true,
  days14: true,
  days7: true,
  hideSentReminders: false,
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:8877",
  "http://localhost:8877",
];

/**
 * @typedef {Object} ReminderSettings
 * @property {boolean} days30
 * @property {boolean} days14
 * @property {boolean} days7
 * @property {boolean} hideSentReminders
 */

/**
 * @typedef {Object} ComplianceRow
 * @property {string} personId
 * @property {string} recordId
 * @property {string} name
 * @property {string} role
 * @property {string} email
 * @property {string} complianceType
 * @property {string} expiryDate
 */

/**
 * @param {string | null} origin
 */
function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && DEFAULT_ALLOWED_ORIGINS.includes(origin)
      ? origin
      : DEFAULT_ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/**
 * @param {unknown} body
 * @param {number} status
 * @param {Record<string, string>} corsHeaders
 */
function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * @param {Request} req
 */
function hasAuthorizationHeader(req: Request): boolean {
  const authorization = req.headers.get("Authorization");
  return Boolean(authorization && authorization.trim());
}

/**
 * @param {Request} req
 * @returns {SupabaseClient | null}
 */
function createUserSupabaseClient(req: Request): SupabaseClient | null {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const supabaseAnonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  const authorization = req.headers.get("Authorization")?.trim() ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !authorization) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Service-role client for automation_runs audit inserts only (bypasses RLS).
 */
function createServiceSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * @param {unknown} body
 */
function validateRequestBody(
  body: unknown,
): { ok: true; record: Record<string, unknown> } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_request" };
  }

  const record = body as Record<string, unknown>;

  if (
    typeof record.organisationId !== "string" ||
    !record.organisationId.trim()
  ) {
    return { ok: false, error: "organisationId is required" };
  }

  if (
    record.asOfDate != null &&
    (typeof record.asOfDate !== "string" || !record.asOfDate.trim())
  ) {
    return { ok: false, error: "asOfDate must be a non-empty string when provided" };
  }

  return { ok: true, record };
}

/**
 * @param {unknown} raw
 */
type ScheduledRunnerMode =
  | typeof SCHEDULED_RUNNER_DRY_RUN_MODE
  | typeof SCHEDULED_RUNNER_LIVE_SEND_MODE
  | typeof SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE;

function normalizeRequestMode(
  raw: unknown,
): { ok: true; mode: ScheduledRunnerMode } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, mode: SCHEDULED_RUNNER_DRY_RUN_MODE };
  }

  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "invalid_mode" };
  }

  const mode = raw.trim();

  if (mode === SCHEDULED_RUNNER_DRY_RUN_MODE) {
    return { ok: true, mode: SCHEDULED_RUNNER_DRY_RUN_MODE };
  }

  if (mode === SCHEDULED_RUNNER_LIVE_SEND_MODE) {
    return { ok: true, mode: SCHEDULED_RUNNER_LIVE_SEND_MODE };
  }

  if (mode === SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE) {
    return { ok: true, mode: SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE };
  }

  return { ok: false, error: "invalid_mode" };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeEmail(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : "";
}

/**
 * @param {unknown} dateString
 * @returns {string}
 */
function normalizeExpiryDate(dateString: unknown): string {
  if (!dateString) {
    return "";
  }

  const text = String(dateString).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (text.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  return text;
}

/**
 * @param {string} dateString
 * @returns {Date}
 */
function parseDateAtMidnight(dateString: string): Date {
  const normalized = normalizeExpiryDate(dateString);
  const parts = normalized.split("-").map(Number);

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return new Date(NaN);
  }

  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

/**
 * @param {string | Date | undefined | null} asOfDate
 * @returns {Date}
 */
function resolveAsOfDate(asOfDate: string | Date | undefined | null): Date {
  if (asOfDate instanceof Date && !Number.isNaN(asOfDate.getTime())) {
    return new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());
  }

  if (typeof asOfDate === "string" && asOfDate.trim()) {
    const parsed = parseDateAtMidnight(asOfDate);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * @param {Date} asOfDate
 * @returns {string}
 */
function formatAsOfDateISO(asOfDate: Date): string {
  const year = asOfDate.getFullYear();
  const month = String(asOfDate.getMonth() + 1).padStart(2, "0");
  const day = String(asOfDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @param {unknown} settings
 * @returns {ReminderSettings}
 */
function normalizeReminderSettings(settings: unknown): ReminderSettings {
  const source =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? settings as Record<string, unknown>
      : {};

  return {
    days30: source.days30 ?? source.days_30 ?? DEFAULT_REMINDER_SETTINGS.days30,
    days14: source.days14 ?? source.days_14 ?? DEFAULT_REMINDER_SETTINGS.days14,
    days7: source.days7 ?? source.days_7 ?? DEFAULT_REMINDER_SETTINGS.days7,
    hideSentReminders:
      source.hideSentReminders ??
      source.hide_sent_reminders ??
      DEFAULT_REMINDER_SETTINGS.hideSentReminders,
  };
}

/**
 * @param {string} expiryDate
 * @param {ReminderSettings} settings
 * @param {Date} asOfDate
 * @returns {string | null}
 */
function getActiveReminderType(
  expiryDate: string,
  settings: ReminderSettings,
  asOfDate: Date,
): string | null {
  const expiry = parseDateAtMidnight(expiryDate);

  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  const diffMs = expiry.getTime() - asOfDate.getTime();
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return REMINDER_UI_LABELS.expired;
  }

  if (settings.days7 && daysRemaining <= 7) {
    return REMINDER_UI_LABELS[7];
  }

  if (settings.days14 && daysRemaining <= 14) {
    return REMINDER_UI_LABELS[14];
  }

  if (settings.days30 && daysRemaining <= 30) {
    return REMINDER_UI_LABELS[30];
  }

  return null;
}

/**
 * @param {ComplianceRow} row
 * @returns {boolean}
 */
function personRowHasEmail(row: ComplianceRow): boolean {
  return normalizeEmail(row.email) !== "";
}

/**
 * @param {{
 *   total: number;
 *   withEmail: number;
 *   missingEmail: number;
 * }} queueSummary
 */
function mapQueueSummaryToScheduledRunnerSummary(queueSummary: {
  total: number;
  withEmail: number;
  missingEmail: number;
}) {
  return {
    totalCandidates: queueSummary.total,
    withEmail: queueSummary.withEmail,
    missingEmail: queueSummary.missingEmail,
    wouldSend: queueSummary.withEmail,
    wouldSkip: queueSummary.missingEmail,
  };
}

/**
 * @typedef {ComplianceRow & {
 *   reminderType: string;
 *   hasEmail: boolean;
 * }} DryRunCandidate
 */

/**
 * @param {ComplianceRow[]} rows
 * @param {ReminderSettings} settings
 * @param {Date} asOfDate
 * @returns {DryRunCandidate[]}
 */
function computeDryRunCandidates(
  rows: ComplianceRow[],
  settings: ReminderSettings,
  asOfDate: Date,
): Array<ComplianceRow & { reminderType: string; hasEmail: boolean }> {
  /** @type {DryRunCandidate[]} */
  const candidates = [];

  for (const row of rows) {
    const reminderType = getActiveReminderType(row.expiryDate, settings, asOfDate);

    if (!reminderType) {
      continue;
    }

    candidates.push({
      ...row,
      reminderType,
      hasEmail: personRowHasEmail(row),
    });
  }

  return candidates;
}

/**
 * @param {DryRunCandidate[]} candidates
 */
function buildSummaryFromDryRunCandidates(
  candidates: Array<ComplianceRow & { reminderType: string; hasEmail: boolean }>,
) {
  let withEmail = 0;
  let missingEmail = 0;

  for (const candidate of candidates) {
    if (candidate.hasEmail) {
      withEmail += 1;
    } else {
      missingEmail += 1;
    }
  }

  return mapQueueSummaryToScheduledRunnerSummary({
    total: candidates.length,
    withEmail,
    missingEmail,
  });
}

/**
 * @param {DryRunCandidate[]} candidates
 */
function buildDryRunDeliveryLogSummary(
  candidates: Array<ComplianceRow & { reminderType: string; hasEmail: boolean }>,
) {
  let pending = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (candidate.hasEmail) {
      pending += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    total: candidates.length,
    pending,
    skipped,
    failed: 0,
    sent: 0,
  };
}

/**
 * @param {DryRunCandidate[]} candidates
 * @param {string} organisationId
 * @param {string} automationRunId
 * @param {string} asOfDateIso
 */
function buildDryRunDeliveryLogRows(
  candidates: Array<ComplianceRow & { reminderType: string; hasEmail: boolean }>,
  organisationId: string,
  automationRunId: string,
  asOfDateIso: string,
) {
  return candidates.map((candidate) => {
    const hasEmail = candidate.hasEmail;
    const deliveryStatus = hasEmail ? "pending" : "skipped";
    const reason = hasEmail ? "would_send" : "missing_email";
    const recipientEmail = hasEmail ? normalizeEmail(candidate.email) : null;

    return {
      organisation_id: organisationId,
      automation_run_id: automationRunId,
      compliance_record_id: candidate.recordId,
      person_id: candidate.personId,
      recipient_email: recipientEmail,
      recipient_name: candidate.name || null,
      compliance_type: candidate.complianceType || null,
      reminder_type: candidate.reminderType,
      due_date: candidate.expiryDate || null,
      delivery_status: deliveryStatus,
      provider: null,
      provider_message_id: null,
      payload: {
        mode: SCHEDULED_RUNNER_DRY_RUN_MODE,
        reason,
        asOfDate: asOfDateIso,
        personId: candidate.personId,
        recordId: candidate.recordId,
        name: candidate.name,
        role: candidate.role,
        email: recipientEmail ?? "",
        complianceType: candidate.complianceType,
        reminderType: candidate.reminderType,
        expiryDate: candidate.expiryDate,
        hasEmail,
      },
    };
  });
}

/**
 * @param {SupabaseClient} supabase
 * @param {string} organisationId
 */
async function loadReminderSettings(
  supabase: SupabaseClient,
  organisationId: string,
): Promise<{ ok: true; settings: ReminderSettings } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("reminder_settings")
    .select("days_30, days_14, days_7, hide_sent_reminders")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    settings: normalizeReminderSettings(data ?? DEFAULT_REMINDER_SETTINGS),
  };
}

/**
 * @param {SupabaseClient} supabase
 * @param {string} organisationId
 */
async function loadComplianceRows(
  supabase: SupabaseClient,
  organisationId: string,
): Promise<{ ok: true; rows: ComplianceRow[] } | { ok: false; error: string }> {
  const [peopleResult, recordsResult] = await Promise.all([
    supabase
      .from("people")
      .select("id, name, role, email")
      .eq("organisation_id", organisationId),
    supabase
      .from("compliance_records")
      .select("id, person_id, compliance_type, expiry_date")
      .eq("organisation_id", organisationId),
  ]);

  const firstError = peopleResult.error ?? recordsResult.error;

  if (firstError) {
    return { ok: false, error: firstError.message };
  }

  const peopleRows = Array.isArray(peopleResult.data) ? peopleResult.data : [];
  const recordRows = Array.isArray(recordsResult.data) ? recordsResult.data : [];

  /** @type {Map<string, { id: string; name: string; role: string; email: string }>} */
  const peopleById = new Map();

  for (const person of peopleRows) {
    const id = String(person.id ?? "").trim();

    if (!id) {
      continue;
    }

    peopleById.set(id, {
      id,
      name: String(person.name ?? ""),
      role: String(person.role ?? ""),
      email: normalizeEmail(person.email),
    });
  }

  /** @type {ComplianceRow[]} */
  const rows = [];

  for (const record of recordRows) {
    const personId = String(record.person_id ?? "").trim();
    const recordId = String(record.id ?? "").trim();
    const person = peopleById.get(personId);

    if (!person || !recordId) {
      continue;
    }

    rows.push({
      personId,
      recordId,
      name: person.name,
      role: person.role,
      email: person.email,
      complianceType: String(record.compliance_type ?? ""),
      expiryDate: normalizeExpiryDate(record.expiry_date),
    });
  }

  return { ok: true, rows };
}

/**
 * @param {SupabaseClient} serviceSupabase
 * @param {string} organisationId
 * @param {string} asOfDateIso
 * @param {{
 *   totalCandidates: number;
 *   withEmail: number;
 *   missingEmail: number;
 *   wouldSend: number;
 *   wouldSkip: number;
 * }} summary
 */
async function insertScheduledDryRunAutomationRun(
  serviceSupabase: SupabaseClient,
  organisationId: string,
  asOfDateIso: string,
  summary: {
    totalCandidates: number;
    withEmail: number;
    missingEmail: number;
    wouldSend: number;
    wouldSkip: number;
  },
): Promise<{ ok: true; automationRunId: string } | { ok: false; error: string }> {
  const summaryPayload = {
    totalCandidates: summary.totalCandidates,
    withEmail: summary.withEmail,
    missingEmail: summary.missingEmail,
    wouldSend: summary.wouldSend,
    wouldSkip: summary.wouldSkip,
  };

  const { data, error } = await serviceSupabase
    .from("automation_runs")
    .insert({
      organisation_id: organisationId,
      run_type: SCHEDULED_RUNNER_DRY_RUN_RUN_TYPE,
      mode: SCHEDULED_RUNNER_DRY_RUN_MODE,
      status: "completed",
      as_of_date: asOfDateIso,
      total_candidates: summary.totalCandidates,
      with_email: summary.withEmail,
      missing_email: summary.missingEmail,
      would_send: summary.wouldSend,
      would_skip: summary.wouldSkip,
      summary: summaryPayload,
      completed_at: new Date().toISOString(),
    })
    .select("automation_run_id")
    .single();

  if (error || !data?.automation_run_id) {
    return {
      ok: false,
      error: error?.message ?? "automation_run_insert_failed",
    };
  }

  return {
    ok: true,
    automationRunId: String(data.automation_run_id),
  };
}

/**
 * Phase 51: one reminder_delivery_logs row per dry-run candidate (after automation_runs insert).
 * Not transactional with automation_runs — partial persistence is possible on failure.
 *
 * @param {SupabaseClient} serviceSupabase
 * @param {string} organisationId
 * @param {string} automationRunId
 * @param {DryRunCandidate[]} candidates
 * @param {string} asOfDateIso
 */
async function insertScheduledDryRunDeliveryLogs(
  serviceSupabase: SupabaseClient,
  organisationId: string,
  automationRunId: string,
  candidates: Array<ComplianceRow & { reminderType: string; hasEmail: boolean }>,
  asOfDateIso: string,
): Promise<
  | {
      ok: true;
      deliveryLogSummary: ReturnType<typeof buildDryRunDeliveryLogSummary>;
    }
  | { ok: false; error: string }
> {
  const deliveryLogSummary = buildDryRunDeliveryLogSummary(candidates);

  if (candidates.length === 0) {
    return { ok: true, deliveryLogSummary };
  }

  const rows = buildDryRunDeliveryLogRows(
    candidates,
    organisationId,
    automationRunId,
    asOfDateIso,
  );

  const { error } = await serviceSupabase.from("reminder_delivery_logs").insert(rows);

  if (error) {
    return {
      ok: false,
      error: error.message ?? "delivery_log_insert_failed",
    };
  }

  return { ok: true, deliveryLogSummary };
}

/**
 * @param {SupabaseClient} supabase
 * @param {string} organisationId
 */
async function loadOrganisationName(
  supabase: SupabaseClient,
  organisationId: string,
): Promise<{ ok: true; organisationName: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  const organisationName = String(data?.name ?? "").trim();

  return {
    ok: true,
    organisationName,
  };
}

/**
 * @param {DryRunCandidate[]} candidates
 */
function buildPreviewSummary(
  candidates: Array<ComplianceRow & { reminderType: string; hasEmail: boolean }>,
) {
  let withEmailPreviewed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (candidate.hasEmail) {
      withEmailPreviewed += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    totalPreviewed: candidates.length,
    withEmailPreviewed,
    skipped,
  };
}

/**
 * @param {DryRunCandidate[]} candidates
 * @param {string} organisationId
 * @param {string} automationRunId
 * @param {string} asOfDateIso
 * @param {string} organisationName
 */
function buildLiveSendPreviewDeliveryLogRows(
  candidates: Array<ComplianceRow & { reminderType: string; hasEmail: boolean }>,
  organisationId: string,
  automationRunId: string,
  asOfDateIso: string,
  organisationName: string,
) {
  return candidates.map((candidate) => {
    const hasEmail = candidate.hasEmail;
    const deliveryStatus = hasEmail ? "pending" : "skipped";
    const recipientEmail = hasEmail ? normalizeEmail(candidate.email) : null;

    const basePayload = {
      mode: SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE,
      asOfDate: asOfDateIso,
      personId: candidate.personId,
      recordId: candidate.recordId,
      name: candidate.name,
      role: candidate.role,
      email: recipientEmail ?? "",
      complianceType: candidate.complianceType,
      reminderType: candidate.reminderType,
      expiryDate: candidate.expiryDate,
      hasEmail,
    };

    if (!hasEmail) {
      return {
        organisation_id: organisationId,
        automation_run_id: automationRunId,
        compliance_record_id: candidate.recordId,
        person_id: candidate.personId,
        recipient_email: null,
        recipient_name: candidate.name || null,
        compliance_type: candidate.complianceType || null,
        reminder_type: candidate.reminderType,
        due_date: candidate.expiryDate || null,
        delivery_status: deliveryStatus,
        provider: null,
        provider_message_id: null,
        payload: {
          ...basePayload,
          reason: "missing_email",
        },
      };
    }

    const emailPreview = buildReminderEmailPreview(
      {
        recipientName: candidate.name,
        personName: candidate.name,
        complianceType: candidate.complianceType,
        reminderType: candidate.reminderType,
        expiryDate: candidate.expiryDate,
      },
      { organisationName },
    );

    return {
      organisation_id: organisationId,
      automation_run_id: automationRunId,
      compliance_record_id: candidate.recordId,
      person_id: candidate.personId,
      recipient_email: recipientEmail,
      recipient_name: candidate.name || null,
      compliance_type: candidate.complianceType || null,
      reminder_type: candidate.reminderType,
      due_date: candidate.expiryDate || null,
      delivery_status: deliveryStatus,
      provider: null,
      provider_message_id: null,
      payload: {
        ...basePayload,
        emailPreview,
      },
    };
  });
}

/**
 * @param {SupabaseClient} serviceSupabase
 * @param {string} organisationId
 * @param {string} asOfDateIso
 * @param {{
 *   totalCandidates: number;
 *   withEmail: number;
 *   missingEmail: number;
 *   wouldSend: number;
 *   wouldSkip: number;
 * }} summary
 */
async function insertScheduledLiveSendPreviewAutomationRun(
  serviceSupabase: SupabaseClient,
  organisationId: string,
  asOfDateIso: string,
  summary: {
    totalCandidates: number;
    withEmail: number;
    missingEmail: number;
    wouldSend: number;
    wouldSkip: number;
  },
): Promise<{ ok: true; automationRunId: string } | { ok: false; error: string }> {
  const summaryPayload = {
    totalCandidates: summary.totalCandidates,
    withEmail: summary.withEmail,
    missingEmail: summary.missingEmail,
    wouldSend: summary.wouldSend,
    wouldSkip: summary.wouldSkip,
  };

  const { data, error } = await serviceSupabase
    .from("automation_runs")
    .insert({
      organisation_id: organisationId,
      run_type: SCHEDULED_RUNNER_PREVIEW_RUN_TYPE,
      mode: SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE,
      status: "completed",
      as_of_date: asOfDateIso,
      total_candidates: summary.totalCandidates,
      with_email: summary.withEmail,
      missing_email: summary.missingEmail,
      would_send: summary.wouldSend,
      would_skip: summary.wouldSkip,
      summary: summaryPayload,
      completed_at: new Date().toISOString(),
    })
    .select("automation_run_id")
    .single();

  if (error || !data?.automation_run_id) {
    return {
      ok: false,
      error: error?.message ?? "automation_run_insert_failed",
    };
  }

  return {
    ok: true,
    automationRunId: String(data.automation_run_id),
  };
}

/**
 * @param {SupabaseClient} serviceSupabase
 * @param {string} organisationId
 * @param {string} automationRunId
 * @param {DryRunCandidate[]} candidates
 * @param {string} asOfDateIso
 * @param {string} organisationName
 */
async function insertScheduledLiveSendPreviewDeliveryLogs(
  serviceSupabase: SupabaseClient,
  organisationId: string,
  automationRunId: string,
  candidates: Array<ComplianceRow & { reminderType: string; hasEmail: boolean }>,
  asOfDateIso: string,
  organisationName: string,
): Promise<
  | {
      ok: true;
      deliveryLogSummary: ReturnType<typeof buildDryRunDeliveryLogSummary>;
    }
  | { ok: false; error: string }
> {
  const deliveryLogSummary = buildDryRunDeliveryLogSummary(candidates);

  if (candidates.length === 0) {
    return { ok: true, deliveryLogSummary };
  }

  const rows = buildLiveSendPreviewDeliveryLogRows(
    candidates,
    organisationId,
    automationRunId,
    asOfDateIso,
    organisationName,
  );

  const { error } = await serviceSupabase.from("reminder_delivery_logs").insert(rows);

  if (error) {
    return {
      ok: false,
      error: error.message ?? "delivery_log_insert_failed",
    };
  }

  return { ok: true, deliveryLogSummary };
}

/**
 * @param {{
 *   sent: number;
 *   skipped: number;
 *   failed: number;
 * }} counts
 */
function buildLiveSendDeliveryLogSummary(counts: {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}) {
  return {
    total: counts.total,
    sent: counts.sent,
    skipped: counts.skipped,
    failed: counts.failed,
    pending: 0,
  };
}

/**
 * @param {{
 *   attempted: number;
 *   sent: number;
 *   failed: number;
 *   skippedMissingEmail: number;
 *   skippedNotAllowlisted: number;
 * }} counts
 */
function buildSendSummary(counts: {
  attempted: number;
  sent: number;
  failed: number;
  skippedMissingEmail: number;
  skippedNotAllowlisted: number;
  skippedDuplicate: number;
}) {
  return {
    attempted: counts.attempted,
    sent: counts.sent,
    failed: counts.failed,
    skippedMissingEmail: counts.skippedMissingEmail,
    skippedNotAllowlisted: counts.skippedNotAllowlisted,
    skippedDuplicate: counts.skippedDuplicate,
  };
}

/**
 * @param {{ checked: number; duplicatesPrevented: number }} counts
 */
function buildDuplicatePreventionSummary(counts: {
  checked: number;
  duplicatesPrevented: number;
}) {
  return {
    checked: counts.checked,
    duplicatesPrevented: counts.duplicatesPrevented,
  };
}

type LiveSendCandidate = ComplianceRow & { reminderType: string; hasEmail: boolean };

/**
 * Phase 63: find an existing sent delivery log for the same scheduled reminder identity.
 *
 * @param {SupabaseClient} client Service role — bypasses RLS for idempotency lookup.
 * @param {LiveSendCandidate} candidate
 * @param {string} organisationId
 * @param {string} asOfDateIso
 */
async function findExistingSentDeliveryLog(
  client: SupabaseClient,
  candidate: LiveSendCandidate,
  organisationId: string,
  asOfDateIso: string,
): Promise<{ id: string } | null> {
  const recipientEmail = normalizeEmail(candidate.email);

  const { data, error } = await client
    .from("reminder_delivery_logs")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("compliance_record_id", candidate.recordId)
    .eq("reminder_type", candidate.reminderType)
    .eq("recipient_email", recipientEmail)
    .eq("due_date", candidate.expiryDate || null)
    .eq("delivery_status", "sent")
    .filter("payload->>asOfDate", "eq", asOfDateIso)
    .limit(1);

  if (error) {
    console.error("duplicate_check_failed", error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : null;
  const id = row?.id != null ? String(row.id).trim() : "";

  return id ? { id } : null;
}

/**
 * Maps scheduled-runner reminder UI labels to mark_reminder_sent RPC codes.
 *
 * @param {string} reminderType
 */
function mapReminderUiLabelToRpcCode(reminderType: string): string | null {
  if (reminderType === REMINDER_UI_LABELS.expired) {
    return "expired";
  }

  if (reminderType === REMINDER_UI_LABELS[30]) {
    return "30";
  }

  if (reminderType === REMINDER_UI_LABELS[14]) {
    return "14";
  }

  if (reminderType === REMINDER_UI_LABELS[7]) {
    return "7";
  }

  return null;
}

/**
 * @param {SupabaseClient} userSupabase Caller JWT — mark_reminder_sent is security invoker.
 * @param {string} complianceRecordId
 * @param {string} reminderTypeRpcCode
 */
async function markReminderSentAfterLiveDelivery(
  userSupabase: SupabaseClient,
  complianceRecordId: string,
  reminderTypeRpcCode: string,
): Promise<{
  marked: boolean;
  status: string;
  error?: string;
  reason?: string;
}> {
  const { data, error } = await userSupabase.rpc(MARK_SENT_RPC, {
    p_record_id: complianceRecordId,
    p_reminder_type: reminderTypeRpcCode,
  });

  if (error) {
    return {
      marked: false,
      status: "failed",
      error: error.message,
    };
  }

  const row =
    data && typeof data === "object" && !Array.isArray(data)
      ? /** @type {Record<string, unknown>} */ (data)
      : {};
  const status = typeof row.status === "string" ? row.status : "unknown";

  if (status === "marked") {
    return { marked: true, status: "marked" };
  }

  if (status === "skipped") {
    return {
      marked: false,
      status: "skipped",
      reason: typeof row.reason === "string" ? row.reason : "already_sent",
    };
  }

  if (status === "not_found") {
    return { marked: false, status: "not_found" };
  }

  return {
    marked: false,
    status: "failed",
    error: `unexpected_mark_sent_status:${status}`,
  };
}

/**
 * @param {{
 *   attempted: number;
 *   markedSent: number;
 *   failed: number;
 *   skipped: number;
 * }} counts
 */
function buildMarkSentSummary(counts: {
  attempted: number;
  markedSent: number;
  failed: number;
  skipped: number;
}) {
  return {
    attempted: counts.attempted,
    markedSent: counts.markedSent,
    failed: counts.failed,
    skipped: counts.skipped,
  };
}

/**
 * @param {SupabaseClient} serviceSupabase
 * @param {string} organisationId
 * @param {string} asOfDateIso
 * @param {{
 *   totalCandidates: number;
 *   withEmail: number;
 *   missingEmail: number;
 *   wouldSend: number;
 *   wouldSkip: number;
 * }} summary
 * @param {string} automationStatus
 */
async function insertScheduledLiveSendAutomationRun(
  serviceSupabase: SupabaseClient,
  organisationId: string,
  asOfDateIso: string,
  summary: {
    totalCandidates: number;
    withEmail: number;
    missingEmail: number;
    wouldSend: number;
    wouldSkip: number;
  },
  automationStatus: string,
): Promise<{ ok: true; automationRunId: string } | { ok: false; error: string }> {
  const summaryPayload = {
    totalCandidates: summary.totalCandidates,
    withEmail: summary.withEmail,
    missingEmail: summary.missingEmail,
    wouldSend: summary.wouldSend,
    wouldSkip: summary.wouldSkip,
  };

  const { data, error } = await serviceSupabase
    .from("automation_runs")
    .insert({
      organisation_id: organisationId,
      run_type: SCHEDULED_RUNNER_LIVE_SEND_RUN_TYPE,
      mode: SCHEDULED_RUNNER_LIVE_SEND_MODE,
      status: automationStatus,
      as_of_date: asOfDateIso,
      total_candidates: summary.totalCandidates,
      with_email: summary.withEmail,
      missing_email: summary.missingEmail,
      would_send: summary.wouldSend,
      would_skip: summary.wouldSkip,
      summary: summaryPayload,
      completed_at: new Date().toISOString(),
    })
    .select("automation_run_id")
    .single();

  if (error || !data?.automation_run_id) {
    return {
      ok: false,
      error: error?.message ?? "automation_run_insert_failed",
    };
  }

  return {
    ok: true,
    automationRunId: String(data.automation_run_id),
  };
}

/**
 * @param {DryRunCandidate} candidate
 * @param {string} organisationId
 * @param {string} automationRunId
 * @param {string} asOfDateIso
 * @param {string} organisationName
 */
function buildLiveSendCandidateBasePayload(
  candidate: ComplianceRow & { reminderType: string; hasEmail: boolean },
  asOfDateIso: string,
  organisationName: string,
) {
  const recipientEmail = candidate.hasEmail ? normalizeEmail(candidate.email) : null;

  return {
    mode: SCHEDULED_RUNNER_LIVE_SEND_MODE,
    asOfDate: asOfDateIso,
    organisationName,
    personId: candidate.personId,
    recordId: candidate.recordId,
    name: candidate.name,
    role: candidate.role,
    email: recipientEmail ?? "",
    complianceType: candidate.complianceType,
    reminderType: candidate.reminderType,
    expiryDate: candidate.expiryDate,
    hasEmail: candidate.hasEmail,
  };
}

/**
 * Phase 61–63: one reminder_delivery_logs row per candidate — send allowlisted only;
 * Phase 62 marks sent via mark_reminder_sent after successful send + delivery log;
 * Phase 63 skips duplicate sends when an equivalent sent log already exists.
 *
 * @param {SupabaseClient} serviceSupabase
 * @param {SupabaseClient} userSupabase Caller JWT for mark_reminder_sent
 * @param {string} organisationId
 * @param {string} automationRunId
 * @param {DryRunCandidate[]} candidates
 * @param {string} asOfDateIso
 * @param {string} organisationName
 * @param {Set<string>} allowlist
 * @param {EmailProviderConfig} emailConfig
 */
async function processAndInsertLiveSendDeliveryLogs(
  serviceSupabase: SupabaseClient,
  userSupabase: SupabaseClient,
  organisationId: string,
  automationRunId: string,
  candidates: Array<ComplianceRow & { reminderType: string; hasEmail: boolean }>,
  asOfDateIso: string,
  organisationName: string,
  allowlist: Set<string>,
  emailConfig: EmailProviderConfig,
): Promise<
  | {
      ok: true;
      deliveryLogSummary: ReturnType<typeof buildLiveSendDeliveryLogSummary>;
      sendSummary: ReturnType<typeof buildSendSummary>;
      markSentSummary: ReturnType<typeof buildMarkSentSummary>;
      duplicatePreventionSummary: ReturnType<typeof buildDuplicatePreventionSummary>;
      hasMarkSentErrors: boolean;
    }
  | { ok: false; error: string }
> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let attempted = 0;
  let skippedMissingEmail = 0;
  let skippedNotAllowlisted = 0;
  let skippedDuplicate = 0;
  let duplicateChecked = 0;
  let duplicatesPrevented = 0;
  let markSentAttempted = 0;
  let markSentMarked = 0;
  let markSentFailed = 0;
  let markSentSkipped = 0;

  for (const candidate of candidates) {
    const basePayload = buildLiveSendCandidateBasePayload(
      candidate,
      asOfDateIso,
      organisationName,
    );

    if (!candidate.hasEmail) {
      const { error } = await serviceSupabase.from("reminder_delivery_logs").insert({
        organisation_id: organisationId,
        automation_run_id: automationRunId,
        compliance_record_id: candidate.recordId,
        person_id: candidate.personId,
        recipient_email: null,
        recipient_name: candidate.name || null,
        compliance_type: candidate.complianceType || null,
        reminder_type: candidate.reminderType,
        due_date: candidate.expiryDate || null,
        delivery_status: "skipped",
        provider: null,
        provider_message_id: null,
        payload: {
          ...basePayload,
          reason: "missing_email",
        },
      });

      if (error) {
        return { ok: false, error: error.message ?? "delivery_log_insert_failed" };
      }

      skipped += 1;
      skippedMissingEmail += 1;
      continue;
    }

    const recipientEmail = normalizeEmail(candidate.email);

    if (!allowlist.has(recipientEmail)) {
      const { error } = await serviceSupabase.from("reminder_delivery_logs").insert({
        organisation_id: organisationId,
        automation_run_id: automationRunId,
        compliance_record_id: candidate.recordId,
        person_id: candidate.personId,
        recipient_email: recipientEmail,
        recipient_name: candidate.name || null,
        compliance_type: candidate.complianceType || null,
        reminder_type: candidate.reminderType,
        due_date: candidate.expiryDate || null,
        delivery_status: "skipped",
        provider: null,
        provider_message_id: null,
        payload: {
          ...basePayload,
          reason: "not_allowlisted",
        },
      });

      if (error) {
        return { ok: false, error: error.message ?? "delivery_log_insert_failed" };
      }

      skipped += 1;
      skippedNotAllowlisted += 1;
      continue;
    }

    duplicateChecked += 1;
    const existingSentLog = await findExistingSentDeliveryLog(
      serviceSupabase,
      candidate,
      organisationId,
      asOfDateIso,
    );

    if (existingSentLog) {
      const { error } = await serviceSupabase.from("reminder_delivery_logs").insert({
        organisation_id: organisationId,
        automation_run_id: automationRunId,
        compliance_record_id: candidate.recordId,
        person_id: candidate.personId,
        recipient_email: recipientEmail,
        recipient_name: candidate.name || null,
        compliance_type: candidate.complianceType || null,
        reminder_type: candidate.reminderType,
        due_date: candidate.expiryDate || null,
        delivery_status: "skipped",
        provider: null,
        provider_message_id: null,
        payload: {
          ...basePayload,
          reason: "duplicate_prevented",
          duplicateOfDeliveryLogId: existingSentLog.id,
        },
      });

      if (error) {
        return { ok: false, error: error.message ?? "delivery_log_insert_failed" };
      }

      skipped += 1;
      skippedDuplicate += 1;
      duplicatesPrevented += 1;
      continue;
    }

    attempted += 1;

    const emailPreview = buildReminderEmailPreview(
      {
        recipientName: candidate.name,
        personName: candidate.name,
        complianceType: candidate.complianceType,
        reminderType: candidate.reminderType,
        expiryDate: candidate.expiryDate,
      },
      { organisationName },
    );

    const providerResult = await sendReminderEmail(
      {
        to: String(candidate.email).trim(),
        subject: emailPreview.subject,
        bodyText: emailPreview.bodyText,
      },
      emailConfig,
    );

    if (providerResult.status === "sent") {
      const sentAt = new Date().toISOString();
      const { error } = await serviceSupabase.from("reminder_delivery_logs").insert({
        organisation_id: organisationId,
        automation_run_id: automationRunId,
        compliance_record_id: candidate.recordId,
        person_id: candidate.personId,
        recipient_email: recipientEmail,
        recipient_name: candidate.name || null,
        compliance_type: candidate.complianceType || null,
        reminder_type: candidate.reminderType,
        due_date: candidate.expiryDate || null,
        delivery_status: "sent",
        provider: "resend",
        provider_message_id: providerResult.providerMessageId,
        payload: {
          ...basePayload,
          emailPreview: {
            subject: emailPreview.subject,
            bodyText: buildBodyTextPreview(emailPreview.bodyText),
          },
        },
        sent_at: sentAt,
      });

      if (error) {
        return { ok: false, error: error.message ?? "delivery_log_insert_failed" };
      }

      sent += 1;

      markSentAttempted += 1;
      const reminderTypeRpcCode = mapReminderUiLabelToRpcCode(candidate.reminderType);

      if (!reminderTypeRpcCode) {
        markSentFailed += 1;
        continue;
      }

      const markResult = await markReminderSentAfterLiveDelivery(
        userSupabase,
        candidate.recordId,
        reminderTypeRpcCode,
      );

      if (markResult.marked) {
        markSentMarked += 1;
      } else if (markResult.status === "skipped" || markResult.status === "not_found") {
        markSentSkipped += 1;
      } else {
        markSentFailed += 1;
      }

      continue;
    }

    const errorCode =
      providerResult.status === "error"
        ? providerResult.code
        : providerResult.status === "disabled"
          ? providerResult.reason
          : "send_failed";
    const errorMessage =
      providerResult.status === "error"
        ? providerResult.error
        : providerResult.status === "disabled"
          ? providerResult.reason
          : "send_failed";

    const { error } = await serviceSupabase.from("reminder_delivery_logs").insert({
      organisation_id: organisationId,
      automation_run_id: automationRunId,
      compliance_record_id: candidate.recordId,
      person_id: candidate.personId,
      recipient_email: recipientEmail,
      recipient_name: candidate.name || null,
      compliance_type: candidate.complianceType || null,
      reminder_type: candidate.reminderType,
      due_date: candidate.expiryDate || null,
      delivery_status: "failed",
      provider: "resend",
      provider_message_id: null,
      error_code: errorCode,
      error_message: errorMessage,
      payload: {
        ...basePayload,
        emailPreview: {
          subject: emailPreview.subject,
          bodyText: buildBodyTextPreview(emailPreview.bodyText),
        },
      },
      sent_at: null,
    });

    if (error) {
      return { ok: false, error: error.message ?? "delivery_log_insert_failed" };
    }

    failed += 1;
  }

  return {
    ok: true,
    deliveryLogSummary: buildLiveSendDeliveryLogSummary({
      total: candidates.length,
      sent,
      skipped,
      failed,
    }),
    sendSummary: buildSendSummary({
      attempted,
      sent,
      failed,
      skippedMissingEmail,
      skippedNotAllowlisted,
      skippedDuplicate,
    }),
    markSentSummary: buildMarkSentSummary({
      attempted: markSentAttempted,
      markedSent: markSentMarked,
      failed: markSentFailed,
      skipped: markSentSkipped,
    }),
    duplicatePreventionSummary: buildDuplicatePreventionSummary({
      checked: duplicateChecked,
      duplicatesPrevented,
    }),
    hasMarkSentErrors: markSentFailed > 0,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, corsHeaders);
  }

  if (!hasAuthorizationHeader(req)) {
    return jsonResponse({ error: "unauthorized" }, 401, corsHeaders);
  }

  const supabase = createUserSupabaseClient(req);

  if (!supabase) {
    return jsonResponse({ error: "unauthorized" }, 401, corsHeaders);
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, corsHeaders);
  }

  const validation = validateRequestBody(body);

  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400, corsHeaders);
  }

  const organisationId = String(validation.record.organisationId).trim();

  const modeResult = normalizeRequestMode(validation.record.mode);

  if (!modeResult.ok) {
    return jsonResponse({ error: modeResult.error }, 400, corsHeaders);
  }

  if (modeResult.mode === SCHEDULED_RUNNER_LIVE_SEND_MODE) {
    if (!isScheduledEmailSendingEnabled()) {
      return jsonResponse(
        {
          status: "refused",
          mode: SCHEDULED_RUNNER_LIVE_SEND_MODE,
          reason: "scheduled_live_send_not_enabled",
        },
        409,
        corsHeaders,
      );
    }
  }

  if (modeResult.mode === SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE) {
    if (!isScheduledEmailPreviewEnabled()) {
      return jsonResponse(
        {
          status: "refused",
          mode: SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE,
          reason: "scheduled_live_send_preview_not_enabled",
        },
        409,
        corsHeaders,
      );
    }
  }

  const asOfDateInput =
    typeof validation.record.asOfDate === "string"
      ? validation.record.asOfDate.trim()
      : undefined;
  const asOfDate = resolveAsOfDate(asOfDateInput);

  const settingsResult = await loadReminderSettings(supabase, organisationId);

  if (!settingsResult.ok) {
    return jsonResponse({ error: "settings_load_failed" }, 500, corsHeaders);
  }

  const rowsResult = await loadComplianceRows(supabase, organisationId);

  if (!rowsResult.ok) {
    return jsonResponse({ error: "compliance_load_failed" }, 500, corsHeaders);
  }

  const candidates = computeDryRunCandidates(
    rowsResult.rows,
    settingsResult.settings,
    asOfDate,
  );
  const summary = buildSummaryFromDryRunCandidates(candidates);

  const asOfDateIso = formatAsOfDateISO(asOfDate);
  const serviceSupabase = createServiceSupabaseClient();

  if (!serviceSupabase) {
    return jsonResponse({ error: "service_unavailable" }, 500, corsHeaders);
  }

  if (modeResult.mode === SCHEDULED_RUNNER_LIVE_SEND_MODE) {
    const liveSendEnv = readLiveSendEnv();
    const liveSendConfigResult = validateLiveSendConfiguration(liveSendEnv);

    if (!liveSendConfigResult.ok) {
      return jsonResponse(liveSendConfigResult.body, liveSendConfigResult.status, corsHeaders);
    }

    const organisationResult = await loadOrganisationName(supabase, organisationId);

    if (!organisationResult.ok) {
      return jsonResponse({ error: "organisation_load_failed" }, 500, corsHeaders);
    }

    const liveSendInsertResult = await insertScheduledLiveSendAutomationRun(
      serviceSupabase,
      organisationId,
      asOfDateIso,
      summary,
      "completed",
    );

    if (!liveSendInsertResult.ok) {
      return jsonResponse(
        {
          error: "automation_run_persist_failed",
          message: liveSendInsertResult.error,
        },
        500,
        corsHeaders,
      );
    }

    const liveSendDeliveryResult = await processAndInsertLiveSendDeliveryLogs(
      serviceSupabase,
      supabase,
      organisationId,
      liveSendInsertResult.automationRunId,
      candidates,
      asOfDateIso,
      organisationResult.organisationName,
      liveSendConfigResult.allowlist,
      liveSendConfigResult.config,
    );

    if (!liveSendDeliveryResult.ok) {
      return jsonResponse(
        {
          error: "delivery_log_persist_failed",
          message: liveSendDeliveryResult.error,
          automationRunId: liveSendInsertResult.automationRunId,
        },
        500,
        corsHeaders,
      );
    }

    const {
      deliveryLogSummary,
      sendSummary,
      markSentSummary,
      duplicatePreventionSummary,
      hasMarkSentErrors,
    } = liveSendDeliveryResult;
    const automationStatus =
      deliveryLogSummary.skipped > 0 ||
      deliveryLogSummary.failed > 0 ||
      hasMarkSentErrors
        ? "completed_with_skips"
        : "completed";

    if (automationStatus === "completed_with_skips") {
      await serviceSupabase
        .from("automation_runs")
        .update({ status: automationStatus })
        .eq("automation_run_id", liveSendInsertResult.automationRunId);
    }

    return jsonResponse(
      {
        status: hasMarkSentErrors ? "completed_with_errors" : "ok",
        mode: SCHEDULED_RUNNER_LIVE_SEND_MODE,
        organisationId,
        automationRunId: liveSendInsertResult.automationRunId,
        summary,
        deliveryLogSummary,
        sendSummary,
        markSentSummary,
        duplicatePreventionSummary,
      },
      200,
      corsHeaders,
    );
  }

  if (modeResult.mode === SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE) {
    const organisationResult = await loadOrganisationName(supabase, organisationId);

    if (!organisationResult.ok) {
      return jsonResponse({ error: "organisation_load_failed" }, 500, corsHeaders);
    }

    const previewInsertResult = await insertScheduledLiveSendPreviewAutomationRun(
      serviceSupabase,
      organisationId,
      asOfDateIso,
      summary,
    );

    if (!previewInsertResult.ok) {
      return jsonResponse(
        {
          error: "automation_run_persist_failed",
          message: previewInsertResult.error,
        },
        500,
        corsHeaders,
      );
    }

    const previewDeliveryLogResult = await insertScheduledLiveSendPreviewDeliveryLogs(
      serviceSupabase,
      organisationId,
      previewInsertResult.automationRunId,
      candidates,
      asOfDateIso,
      organisationResult.organisationName,
    );

    if (!previewDeliveryLogResult.ok) {
      return jsonResponse(
        {
          error: "delivery_log_persist_failed",
          message: previewDeliveryLogResult.error,
          automationRunId: previewInsertResult.automationRunId,
        },
        500,
        corsHeaders,
      );
    }

    return jsonResponse(
      {
        status: "ok",
        mode: SCHEDULED_RUNNER_LIVE_SEND_PREVIEW_MODE,
        organisationId,
        automationRunId: previewInsertResult.automationRunId,
        summary,
        deliveryLogSummary: previewDeliveryLogResult.deliveryLogSummary,
        previewSummary: buildPreviewSummary(candidates),
      },
      200,
      corsHeaders,
    );
  }

  const insertResult = await insertScheduledDryRunAutomationRun(
    serviceSupabase,
    organisationId,
    asOfDateIso,
    summary,
  );

  if (!insertResult.ok) {
    return jsonResponse(
      {
        error: "automation_run_persist_failed",
        message: insertResult.error,
      },
      500,
      corsHeaders,
    );
  }

  const deliveryLogResult = await insertScheduledDryRunDeliveryLogs(
    serviceSupabase,
    organisationId,
    insertResult.automationRunId,
    candidates,
    asOfDateIso,
  );

  if (!deliveryLogResult.ok) {
    return jsonResponse(
      {
        error: "delivery_log_persist_failed",
        message: deliveryLogResult.error,
        automationRunId: insertResult.automationRunId,
      },
      500,
      corsHeaders,
    );
  }

  return jsonResponse(
    {
      status: "ok",
      mode: SCHEDULED_RUNNER_DRY_RUN_MODE,
      asOfDate: asOfDateIso,
      organisationId,
      automationRunId: insertResult.automationRunId,
      summary,
      deliveryLogSummary: deliveryLogResult.deliveryLogSummary,
    },
    200,
    corsHeaders,
  );
});
