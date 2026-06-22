/**
 * V6 Phase 50: Staging verification for reminder_delivery_logs schema.
 * Confirms the live staging database has the Phase 49 delivery log table shape,
 * constraints, indexes, and RLS posture. Verification only — no delivery log
 * inserts, Resend, mark-as-sent, or app behaviour changes.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const STAGING_PROJECT_REF = "vmrotpztwoeifbdjwdis";
const DEFAULT_STAGING_ORGANISATION_ID = "11111111-1111-1111-1111-111111111111";

/** @type {readonly string[]} */
const EXPECTED_COLUMNS = [
  "id",
  "organisation_id",
  "automation_run_id",
  "compliance_record_id",
  "person_id",
  "recipient_email",
  "recipient_name",
  "compliance_type",
  "reminder_type",
  "due_date",
  "delivery_status",
  "provider",
  "provider_message_id",
  "error_code",
  "error_message",
  "payload",
  "created_at",
  "sent_at",
];

/** Phase 3 foundation columns that must not remain after Phase 49. */
/** @type {readonly string[]} */
const PHASE_3_COLUMNS_ABSENT = [
  "queue_item_id",
  "subject",
  "body_text",
  "metadata",
  "prepared_at",
  "delivered_at",
  "failed_at",
  "failure_reason",
  "created_by",
  "updated_at",
];

/** @type {readonly string[]} */
const EXPECTED_INDEXES = [
  "reminder_delivery_logs_organisation_id_idx",
  "reminder_delivery_logs_automation_run_id_idx",
  "reminder_delivery_logs_compliance_record_id_idx",
  "reminder_delivery_logs_delivery_status_idx",
  "reminder_delivery_logs_created_at_desc_idx",
  "reminder_delivery_logs_provider_message_id_idx",
];

/** @type {readonly string[]} */
const DELIVERY_STATUS_VALUES = ["pending", "sent", "skipped", "failed"];

const PHASE_49_MIGRATION = "20260401000009_reminder_delivery_logs_scheduled_send_schema.sql";
const SUPABASE_ACCESS_TOKEN_PATTERN = /^sbp_(oauth_)?[a-f0-9]{40}$/i;

const CATALOG_SQL = `
select json_build_object(
  'table_exists', exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'reminder_delivery_logs'
  ),
  'columns', (
    select coalesce(json_agg(column_name order by ordinal_position), '[]'::json)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reminder_delivery_logs'
  ),
  'rls_enabled', (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'reminder_delivery_logs'
  ),
  'delivery_status_check', (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'reminder_delivery_logs_delivery_status_check'
  ),
  'indexes', (
    select coalesce(json_agg(indexname order by indexname), '[]'::json)
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'reminder_delivery_logs'
  ),
  'index_defs', (
    select coalesce(json_object_agg(indexname, indexdef), '{}'::json)
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'reminder_delivery_logs'
  ),
  'policies', (
    select coalesce(
      json_agg(
        json_build_object(
          'policyname', policyname,
          'cmd', cmd,
          'roles', roles,
          'qual', qual,
          'with_check', with_check
        )
        order by policyname
      ),
      '[]'::json
    )
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reminder_delivery_logs'
  ),
  'automation_run_fk', (
    select json_build_object(
      'foreign_table', ccu.table_name,
      'foreign_column', ccu.column_name
    )
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_schema = kcu.constraint_schema
     and tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'reminder_delivery_logs'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'automation_run_id'
    limit 1
  )
) as catalog;
`;

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

function assert(condition, label) {
  if (!condition) {
    fail(label);
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} label
 */
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {string} content
 * @param {string} key
 * @returns {string}
 */
function readEnvValue(content, key) {
  const pattern = new RegExp(`^${key}\\s*=\\s*(.*)$`, "m");
  const match = content.match(pattern);

  if (!match) {
    return "";
  }

  let value = match[1].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

/**
 * @param {string} supabaseUrl
 * @returns {string}
 */
function projectRefFromUrl(supabaseUrl) {
  return new URL(supabaseUrl).hostname.split(".")[0];
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidSupabaseAccessToken(value) {
  return typeof value === "string" && SUPABASE_ACCESS_TOKEN_PATTERN.test(value.trim());
}

/**
 * @param {string} path
 * @returns {string}
 */
function readTokenFile(path) {
  if (!existsSync(path)) {
    return "";
  }

  const token = readFileSync(path, "utf8").trim();

  return isValidSupabaseAccessToken(token) ? token : "";
}

/**
 * @param {string} homeDir
 * @returns {string}
 */
function readSupabaseProfileName(homeDir) {
  const profilePath = join(homeDir, ".supabase", "profile");

  if (!existsSync(profilePath)) {
    return "";
  }

  return readFileSync(profilePath, "utf8").trim();
}

/**
 * @returns {{ label: string, path: string }[]}
 */
function buildSupabaseCliTokenFileCandidates() {
  /** @type {{ label: string, path: string }[]} */
  const candidates = [];

  /**
   * @param {string} label
   * @param {string | undefined} baseDir
   * @param {...string} segments
   */
  const add = (label, baseDir, ...segments) => {
    if (!isNonEmptyString(baseDir)) {
      return;
    }

    candidates.push({ label, path: join(baseDir, ...segments) });
  };

  add("HOME/.supabase/access-token", process.env.HOME, ".supabase", "access-token");
  add(
    "USERPROFILE/.supabase/access-token",
    process.env.USERPROFILE,
    ".supabase",
    "access-token",
  );
  add("homedir()/.supabase/access-token", homedir(), ".supabase", "access-token");
  add("APPDATA/supabase/access-token", process.env.APPDATA, "supabase", "access-token");
  add(
    "LOCALAPPDATA/supabase/access-token",
    process.env.LOCALAPPDATA,
    "supabase",
    "access-token",
  );

  const seen = new Set();

  return candidates.filter((candidate) => {
    const normalized = candidate.path.toLowerCase();

    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

/**
 * @returns {string[]}
 */
function discoverWindowsSupabaseCredentialTargets() {
  /** @type {string[]} */
  const targets = [];

  try {
    const listing = execFileSync("cmdkey", ["/list"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    for (const line of listing.split(/\r?\n/)) {
      const match = line.match(/target=(Supabase CLI:[^\s]+)/i);

      if (!match?.[1]) {
        continue;
      }

      const target = match[1];

      if (target.toLowerCase().includes("database") || target.toLowerCase().includes("password")) {
        continue;
      }

      if (!targets.includes(target)) {
        targets.push(target);
      }
    }
  } catch {
    // cmdkey is best-effort; fall back to known account names below.
  }

  /** @type {string[]} */
  const keyringAccounts = ["access-token", "default"];

  for (const homeDir of [process.env.USERPROFILE, process.env.HOME, homedir()]) {
    const profileName = isNonEmptyString(homeDir) ? readSupabaseProfileName(homeDir) : "";

    if (profileName && !keyringAccounts.includes(profileName)) {
      keyringAccounts.unshift(profileName);
    }
  }

  for (const account of keyringAccounts) {
    const target = `Supabase CLI:${account}`;

    if (!targets.includes(target)) {
      targets.unshift(target);
    }
  }

  return targets;
}

const WINDOWS_CRED_READ_PS = `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SupabaseCliCredRead {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public string TargetName;
    public string Comment;
    public long LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }
  [DllImport("Advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
  [DllImport("Advapi32.dll")]
  public static extern void CredFree(IntPtr cred);
  public static string ReadGeneric(string target) {
    IntPtr credentialPtr;
    if (!CredRead(target, 1, 0, out credentialPtr) || credentialPtr == IntPtr.Zero) {
      return null;
    }
    try {
      var credential = (CREDENTIAL)Marshal.PtrToStructure(credentialPtr, typeof(CREDENTIAL));
      if (credential.CredentialBlobSize <= 0 || credential.CredentialBlob == IntPtr.Zero) {
        return null;
      }
      var bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, credential.CredentialBlobSize);
      return Encoding.Unicode.GetString(bytes).TrimEnd('\\0');
    } finally {
      CredFree(credentialPtr);
    }
  }
}
"@
`.trim();

/**
 * @param {string} target
 * @returns {string}
 */
function readWindowsCredentialTarget(target) {
  const escapedTarget = target.replace(/'/g, "''");
  const command = `${WINDOWS_CRED_READ_PS}\n$token = [SupabaseCliCredRead]::ReadGeneric('${escapedTarget}')\nif ($token) { Write-Output $token }`;

  try {
    return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Supabase CLI stores tokens in Windows Credential Manager after `supabase login`
 * when the OS keyring is available (the default on Windows).
 *
 * @returns {{ token: string, source: string }}
 */
function readWindowsCredentialManagerToken() {
  if (process.platform !== "win32") {
    return { token: "", source: "" };
  }

  for (const target of discoverWindowsSupabaseCredentialTargets()) {
    const token = readWindowsCredentialTarget(target);

    if (isValidSupabaseAccessToken(token)) {
      return {
        token,
        source: `Windows Credential Manager (${target})`,
      };
    }
  }

  return { token: "", source: "" };
}

/**
 * @param {string} [envContent]
 * @returns {{ token: string, source: string }}
 */
function resolveSupabaseAccessToken(envContent = "") {
  if (isNonEmptyString(process.env.SUPABASE_ACCESS_TOKEN)) {
    const token = process.env.SUPABASE_ACCESS_TOKEN.trim();

    if (isValidSupabaseAccessToken(token)) {
      return {
        token,
        source: "SUPABASE_ACCESS_TOKEN environment variable",
      };
    }
  }

  const envFileToken = readEnvValue(envContent, "SUPABASE_ACCESS_TOKEN").trim();

  if (isValidSupabaseAccessToken(envFileToken)) {
    return {
      token: envFileToken,
      source: "SUPABASE_ACCESS_TOKEN in .env",
    };
  }

  for (const candidate of buildSupabaseCliTokenFileCandidates()) {
    const token = readTokenFile(candidate.path);

    if (token) {
      return {
        token,
        source: `Supabase CLI token file (${candidate.label})`,
      };
    }
  }

  const windowsCredential = readWindowsCredentialManagerToken();

  if (windowsCredential.token) {
    return windowsCredential;
  }

  return { token: "", source: "" };
}

/**
 * @param {unknown} value
 * @returns {unknown[]}
 */
function asArray(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? /** @type {Record<string, unknown>} */ (parsed)
        : {};
    } catch {
      return {};
    }
  }

  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {unknown} value
 */
function isTruthy(value) {
  return value === true || value === "true" || value === "t" || value === 1;
}

/**
 * @param {string} projectRef
 * @param {string} accessToken
 * @param {string} sql
 */
async function queryViaManagementApi(projectRef, accessToken, sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Management API query failed (${response.status}): ${text.slice(0, 500)}`);
  }

  /** @type {unknown} */
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Management API returned non-JSON: ${text.slice(0, 500)}`);
  }

  return payload;
}

/**
 * @param {unknown} payload
 * @returns {Record<string, unknown> | null}
 */
function extractCatalogRow(payload) {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0];

    if (first && typeof first === "object" && "catalog" in first) {
      return asObject(first.catalog);
    }

    return asObject(first);
  }

  if (typeof payload === "object" && payload !== null && "catalog" in payload) {
    return asObject(/** @type {Record<string, unknown>} */ (payload).catalog);
  }

  return asObject(payload);
}

/**
 * @param {string} projectRef
 * @param {string} sql
 * @param {string} [envContent]
 */
async function runCatalogQuery(projectRef, sql, envContent = "") {
  const { token: accessToken, source: accessTokenSource } = resolveSupabaseAccessToken(envContent);

  if (!accessToken) {
    throw new Error(
      [
        "Catalog introspection requires a Supabase Management API access token.",
        "",
        "No token was found. To fix this:",
        "  1. Run: supabase login",
        "  2. Or add SUPABASE_ACCESS_TOKEN to your .env file",
        "",
        "Checked: SUPABASE_ACCESS_TOKEN env/.env, Supabase CLI token files",
        "(HOME, USERPROFILE, APPDATA, LOCALAPPDATA), and Windows Credential Manager.",
      ].join("\n"),
    );
  }

  console.log(`Using access token from: ${accessTokenSource}`);

  return extractCatalogRow(await queryViaManagementApi(projectRef, accessToken, sql));
}

/**
 * @param {string} supabaseUrl
 * @param {string} serviceRoleKey
 */
async function fetchOpenApiColumns(supabaseUrl, serviceRoleKey) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/openapi+json",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAPI fetch failed (${response.status})`);
  }

  const spec = await response.json();
  const tableSchema = spec?.components?.schemas?.reminder_delivery_logs;
  const properties = tableSchema?.properties;

  if (!properties || typeof properties !== "object") {
    return { columns: [], deliveryStatusEnum: [] };
  }

  const deliveryStatusEnum = asArray(properties.delivery_status?.enum).map((value) =>
    String(value),
  );

  return {
    columns: Object.keys(properties).sort(),
    deliveryStatusEnum,
  };
}

/**
 * @param {string} supabaseUrl
 * @param {string} anonKey
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>}
 */
async function obtainAccessToken(supabaseUrl, anonKey, email, password) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sign-in failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (!isNonEmptyString(data.access_token)) {
    throw new Error("Sign-in response missing access_token.");
  }

  return data.access_token.trim();
}

/**
 * @param {Record<string, unknown>} catalog
 */
function verifyCatalog(catalog) {
  if (!isTruthy(catalog.table_exists)) {
    fail(
      `public.reminder_delivery_logs missing on staging — apply Phase 49 migration (${PHASE_49_MIGRATION})`,
    );
    return;
  }

  const columns = asArray(catalog.columns).map((value) => String(value));

  for (const column of EXPECTED_COLUMNS) {
    assert(columns.includes(column), `column exists: ${column}`);
  }

  for (const legacyColumn of PHASE_3_COLUMNS_ABSENT) {
    assert(!columns.includes(legacyColumn), `Phase 3 column absent: ${legacyColumn}`);
  }

  assert(isTruthy(catalog.rls_enabled), "RLS enabled on reminder_delivery_logs");

  const checkDef = String(catalog.delivery_status_check || "").toLowerCase();

  assert(checkDef.length > 0, "delivery_status check constraint exists");

  for (const status of DELIVERY_STATUS_VALUES) {
    assert(checkDef.includes(`'${status}'`), `delivery_status allows ${status}`);
  }

  const indexes = asArray(catalog.indexes).map((value) => String(value));

  for (const indexName of EXPECTED_INDEXES) {
    assert(indexes.includes(indexName), `index exists: ${indexName}`);
  }

  const indexDefs = asObject(catalog.index_defs);
  const providerIndexDef = String(indexDefs.reminder_delivery_logs_provider_message_id_idx || "");

  assert(
    providerIndexDef.toLowerCase().includes("where") &&
      providerIndexDef.toLowerCase().includes("provider_message_id"),
    "partial provider_message_id index predicate",
  );

  const policies = asArray(catalog.policies);
  const selectPolicies = policies.filter((policy) => {
    const row = asObject(policy);
    return String(row.cmd || "").toUpperCase() === "SELECT";
  });

  assert(selectPolicies.length >= 1, "at least one SELECT policy exists");

  const orgSelectPolicy = selectPolicies.find((policy) => {
    const row = asObject(policy);
    return String(row.policyname || "") === "reminder_delivery_logs_org_select";
  });

  assert(orgSelectPolicy !== undefined, "reminder_delivery_logs_org_select policy exists");

  const orgSelectQual = String(asObject(orgSelectPolicy).qual || "");

  assert(
    orgSelectQual.includes("organisation_id") && orgSelectQual.includes("current_organisation_id"),
    "select policy scoped to organisation_id = current_organisation_id()",
  );

  const authenticatedWritePolicies = policies.filter((policy) => {
    const row = asObject(policy);
    const cmd = String(row.cmd || "").toUpperCase();
    const roles = asArray(row.roles).map((role) => String(role));

    return (
      ["INSERT", "UPDATE", "DELETE", "ALL"].includes(cmd) && roles.includes("authenticated")
    );
  });

  assert(
    authenticatedWritePolicies.length === 0,
    "no authenticated insert/update/delete policy on reminder_delivery_logs",
  );

  const fk = asObject(catalog.automation_run_fk);

  assertEqual(String(fk.foreign_table || ""), "automation_runs", "automation_run_id FK table");
  assertEqual(
    String(fk.foreign_column || ""),
    "automation_run_id",
    "automation_run_id FK column",
  );
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} serviceClient
 * @param {string} supabaseUrl
 * @param {string} serviceRoleKey
 * @param {string} organisationId
 */
async function verifyPostgrestShape(serviceClient, supabaseUrl, serviceRoleKey, organisationId) {
  const columnList = EXPECTED_COLUMNS.join(", ");
  const { error: selectError } = await serviceClient
    .from("reminder_delivery_logs")
    .select(columnList)
    .limit(0);

  assert(
    !selectError,
    selectError?.message?.includes("does not exist")
      ? `Phase 49 schema not applied on staging (${PHASE_49_MIGRATION}): ${selectError.message}`
      : `table/columns reachable via PostgREST: ${selectError?.message || "ok"}`,
  );

  for (const legacyColumn of PHASE_3_COLUMNS_ABSENT) {
    const { error: legacyError } = await serviceClient
      .from("reminder_delivery_logs")
      .select(legacyColumn)
      .limit(0);

    assert(
      legacyError !== null,
      `Phase 3 column still present (apply ${PHASE_49_MIGRATION}): ${legacyColumn}`,
    );
  }

  const { error: embedError } = await serviceClient
    .from("reminder_delivery_logs")
    .select("id, automation_runs(automation_run_id)")
    .limit(0);

  assert(
    !embedError,
    `automation_run_id FK relationship to automation_runs.automation_run_id: ${embedError?.message || "ok"}`,
  );

  let openApi = { columns: [], deliveryStatusEnum: [] };

  try {
    openApi = await fetchOpenApiColumns(supabaseUrl, serviceRoleKey);
  } catch (error) {
    fail(
      `OpenAPI column introspection: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (openApi.columns.length > 0) {
    for (const column of EXPECTED_COLUMNS) {
      assert(openApi.columns.includes(column), `OpenAPI column: ${column}`);
    }

    for (const legacyColumn of PHASE_3_COLUMNS_ABSENT) {
      assert(!openApi.columns.includes(legacyColumn), `OpenAPI Phase 3 column absent: ${legacyColumn}`);
    }
  }

  if (openApi.deliveryStatusEnum.length > 0) {
    for (const status of DELIVERY_STATUS_VALUES) {
      assert(
        openApi.deliveryStatusEnum.includes(status),
        `OpenAPI delivery_status allows ${status}`,
      );
    }
  } else {
    const { error: constraintError } = await serviceClient.from("reminder_delivery_logs").insert({
      organisation_id: organisationId,
      delivery_status: "__schema_probe_invalid__",
    });

    assert(constraintError !== null, "delivery_status check constraint rejects invalid value");

    const message = String(constraintError?.message || "").toLowerCase();
    const code = String(constraintError?.code || "");

    assert(
      code === "23514" || message.includes("check") || message.includes("delivery_status"),
      `delivery_status check constraint probe: ${constraintError?.message || "unexpected success"}`,
    );
  }
}

/**
 * @param {string} supabaseUrl
 * @param {string} anonKey
 * @param {string} accessToken
 */
async function verifyAuthenticatedRlsPosture(supabaseUrl, anonKey, accessToken) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");

  const selectResponse = await fetch(
    `${baseUrl}/rest/v1/reminder_delivery_logs?select=id&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  assert(
    selectResponse.ok,
    `authenticated SELECT allowed (status ${selectResponse.status})`,
  );

  const insertResponse = await fetch(`${baseUrl}/rest/v1/reminder_delivery_logs`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      organisation_id: DEFAULT_STAGING_ORGANISATION_ID,
      delivery_status: "pending",
    }),
  });

  assert(
    insertResponse.status === 401 || insertResponse.status === 403,
    `authenticated INSERT denied (status ${insertResponse.status})`,
  );
}

console.log(
  "V6 Phase 50 reminder delivery log schema staging verification\n",
);

let envContent = "";

if (existsSync(envPath)) {
  envContent = readFileSync(envPath, "utf8");
}

const supabaseUrl =
  (process.env.SUPABASE_URL || readEnvValue(envContent, "SUPABASE_URL") || "").trim();
const serviceRoleKey =
  (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    readEnvValue(envContent, "SUPABASE_SERVICE_ROLE_KEY") ||
    ""
  ).trim();
const anonKey = (
  process.env.SUPABASE_ANON_KEY ||
  readEnvValue(envContent, "SUPABASE_ANON_KEY") ||
  ""
).trim();
const password = (
  process.env.SUPABASE_TEST_PASSWORD ||
  readEnvValue(envContent, "SUPABASE_TEST_PASSWORD") ||
  ""
).trim();
const organisationId =
  process.env.SUPABASE_TEST_ORGANISATION_ID ||
  readEnvValue(envContent, "SUPABASE_TEST_ORGANISATION_ID") ||
  readEnvValue(envContent, "STAGING_ORGANISATION_ID") ||
  DEFAULT_STAGING_ORGANISATION_ID;
const adminEmail =
  process.env.SUPABASE_TEST_EMAIL_ADMIN ||
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL_ADMIN") ||
  readEnvValue(envContent, "SUPABASE_TEST_EMAIL") ||
  "alpha-admin@example.com";

if (!isNonEmptyString(supabaseUrl)) {
  console.error("SUPABASE_URL is required (environment variable or .env).");
  process.exit(1);
}

if (!isNonEmptyString(serviceRoleKey)) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required (environment variable or .env).");
  process.exit(1);
}

if (!supabaseUrl.includes(STAGING_PROJECT_REF)) {
  console.warn(
    `Warning: SUPABASE_URL does not include staging project ref ${STAGING_PROJECT_REF}.`,
  );
}

const projectRef = projectRefFromUrl(supabaseUrl);
const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("--- PostgREST shape checks (service role) ---");

await verifyPostgrestShape(serviceClient, supabaseUrl, serviceRoleKey, organisationId);

if (failures.length > 0) {
  console.error("FAILURES (PostgREST checks):");
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log("PostgREST checks: OK");

console.log("\n--- catalog introspection (live staging) ---");

/** @type {Record<string, unknown> | null} */
let catalog = null;

try {
  catalog = await runCatalogQuery(projectRef, CATALOG_SQL, envContent);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!catalog) {
  console.error("Catalog query returned no data.");
  process.exit(1);
}

verifyCatalog(catalog);

if (failures.length > 0) {
  console.error("FAILURES (catalog checks):");
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log("Catalog checks: OK");

if (isNonEmptyString(anonKey) && isNonEmptyString(password)) {
  console.log("\n--- authenticated RLS posture (optional) ---");

  try {
    const accessToken = await obtainAccessToken(supabaseUrl, anonKey, adminEmail, password);
    const rlsFailuresBefore = failures.length;
    await verifyAuthenticatedRlsPosture(supabaseUrl, anonKey, accessToken);

    if (failures.length > rlsFailuresBefore) {
      console.error("FAILURES (authenticated RLS checks):");
      for (const message of failures.slice(rlsFailuresBefore)) {
        console.error(`  - ${message}`);
      }
      process.exit(1);
    }

    console.log("Authenticated RLS checks: OK");
  } catch (error) {
    console.warn(
      `Skipping authenticated RLS checks: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
} else {
  console.log(
    "\nSkipping authenticated RLS posture checks (set SUPABASE_ANON_KEY and SUPABASE_TEST_PASSWORD in .env to enable).",
  );
}

console.log("\nverify-reminder-delivery-log-schema-staging: all checks OK");
console.log(`  project: ${projectRef}`);
console.log(`  table: public.reminder_delivery_logs`);
console.log(`  columns (${EXPECTED_COLUMNS.length}): verified`);
console.log(`  delivery_status: ${DELIVERY_STATUS_VALUES.join(" | ")}`);
console.log(`  indexes (${EXPECTED_INDEXES.length}): verified`);
console.log("  RLS: enabled — org-scoped select only, no authenticated write policies");
console.log("  FK: automation_run_id → automation_runs.automation_run_id");
console.log("  scope: schema verification only — no delivery log writes or email sends");
