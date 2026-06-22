/**
 * V6 Phase 45: scheduled-reminder-runner Edge Function — dry run only.
 * Computes reminder candidates for an organisation using the same rules as
 * Manual Delivery Test preview. No Resend calls, delivery log writes,
 * mark-as-sent, or delivery Edge Function invocation.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SCHEDULED_RUNNER_DRY_RUN_MODE = "dry_run";

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
 * @param {ComplianceRow[]} rows
 * @param {ReminderSettings} settings
 * @param {Date} asOfDate
 */
function computeReminderCandidateSummary(
  rows: ComplianceRow[],
  settings: ReminderSettings,
  asOfDate: Date,
) {
  let total = 0;
  let withEmail = 0;
  let missingEmail = 0;

  for (const row of rows) {
    const reminderType = getActiveReminderType(row.expiryDate, settings, asOfDate);

    if (!reminderType) {
      continue;
    }

    total += 1;

    if (personRowHasEmail(row)) {
      withEmail += 1;
    } else {
      missingEmail += 1;
    }
  }

  return mapQueueSummaryToScheduledRunnerSummary({
    total,
    withEmail,
    missingEmail,
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

  const summary = computeReminderCandidateSummary(
    rowsResult.rows,
    settingsResult.settings,
    asOfDate,
  );

  return jsonResponse(
    {
      status: "ok",
      mode: SCHEDULED_RUNNER_DRY_RUN_MODE,
      asOfDate: formatAsOfDateISO(asOfDate),
      organisationId,
      summary,
    },
    200,
    corsHeaders,
  );
});
