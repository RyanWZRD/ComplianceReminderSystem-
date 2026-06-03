/**
 * Reset Alpha Test Organisation staging data to seed-equivalent state.
 * Node-only: requires SUPABASE_SERVICE_ROLE_KEY in .env (never in the browser bundle).
 * Idempotent — safe to run before and after verify:phase2 write smoke tests.
 * Mirrors supabase/seed.sql for org 11111111-1111-1111-1111-111111111111.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const ALPHA_ORG_ID = "11111111-1111-1111-1111-111111111111";

const SEED_PERSON_IDS = [
  "22222222-2222-2222-2222-222222222201",
  "22222222-2222-2222-2222-222222222202",
  "22222222-2222-2222-2222-222222222203",
  "22222222-2222-2222-2222-222222222204",
  "22222222-2222-2222-2222-222222222205",
];

const SEED_RECORD_IDS = [
  "33333333-3333-3333-3333-333333333301",
  "33333333-3333-3333-3333-333333333302",
  "33333333-3333-3333-3333-333333333303",
  "33333333-3333-3333-3333-333333333304",
  "33333333-3333-3333-3333-333333333305",
  "33333333-3333-3333-3333-333333333306",
];

const SEED_HISTORY_IDS = [
  "44444444-4444-4444-4444-444444444401",
  "44444444-4444-4444-4444-444444444402",
];

const SEED_ACTION_IDS = [
  "66666666-6666-6666-6666-666666666601",
  "66666666-6666-6666-6666-666666666602",
  "66666666-6666-6666-6666-666666666603",
];

const CANONICAL_COUNTS = {
  people: 5,
  records: 6,
  history: 2,
  evidence: 2,
  actions: 3,
  deletedSnapshots: 1,
};

/** @type {readonly { id: string; name: string; role: string }[]} */
const SEED_PEOPLE = [
  { id: SEED_PERSON_IDS[0], name: "Alex Volunteer", role: "Volunteer" },
  { id: SEED_PERSON_IDS[1], name: "Jordan Coordinator", role: "Coordinator" },
  { id: SEED_PERSON_IDS[2], name: "Sam Priest", role: "Clergy" },
  { id: SEED_PERSON_IDS[3], name: "Taylor Warden", role: "Church Warden" },
  { id: SEED_PERSON_IDS[4], name: "Riley Safeguarding", role: "Safeguarding Officer" },
];

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
 * @param {number} dayOffset
 * @returns {string}
 */
function dateFromToday(dayOffset) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

/**
 * @param {number} dayOffset
 * @returns {string}
 */
function isoDaysAgo(dayOffset) {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  return date.toISOString();
}

/**
 * @returns {readonly { id: string; person_id: string; compliance_type: string; expiry_date: string; renewal_cycle: string; notes: string }[]}
 */
function buildSeedRecords() {
  return [
    {
      id: SEED_RECORD_IDS[0],
      person_id: SEED_PERSON_IDS[0],
      compliance_type: "DBS",
      expiry_date: dateFromToday(45),
      renewal_cycle: "3-years",
      notes: "Sample valid record with upcoming expiry.",
    },
    {
      id: SEED_RECORD_IDS[1],
      person_id: SEED_PERSON_IDS[1],
      compliance_type: "Basic Awareness",
      expiry_date: dateFromToday(20),
      renewal_cycle: "3-years",
      notes: "Due soon window.",
    },
    {
      id: SEED_RECORD_IDS[2],
      person_id: SEED_PERSON_IDS[2],
      compliance_type: "Leadership",
      expiry_date: dateFromToday(-5),
      renewal_cycle: "3-years",
      notes: "Expired sample record.",
    },
    {
      id: SEED_RECORD_IDS[3],
      person_id: SEED_PERSON_IDS[3],
      compliance_type: "DBS",
      expiry_date: dateFromToday(120),
      renewal_cycle: "3-years",
      notes: "Valid with evidence below.",
    },
    {
      id: SEED_RECORD_IDS[4],
      person_id: SEED_PERSON_IDS[4],
      compliance_type: "Foundations",
      expiry_date: dateFromToday(60),
      renewal_cycle: "1-year",
      notes: "Record with open and overdue actions.",
    },
    {
      id: SEED_RECORD_IDS[5],
      person_id: SEED_PERSON_IDS[0],
      compliance_type: "First Aid",
      expiry_date: dateFromToday(200),
      renewal_cycle: "manual",
      notes: "Second record for same person.",
    },
  ];
}

/**
 * @returns {readonly object[]}
 */
function buildSeedActions() {
  return [
    {
      id: SEED_ACTION_IDS[0],
      record_id: SEED_RECORD_IDS[4],
      title: "Chase renewal paperwork",
      status: "open",
      completed: false,
      due_date: dateFromToday(-3),
      owner: "Safeguarding Officer",
      notes: "Overdue open action.",
      created_at: isoDaysAgo(14),
      completed_at: null,
    },
    {
      id: SEED_ACTION_IDS[1],
      record_id: SEED_RECORD_IDS[4],
      title: "Book training session",
      status: "in_progress",
      completed: false,
      due_date: dateFromToday(7),
      owner: "Coordinator",
      notes: "In progress action.",
      created_at: isoDaysAgo(7),
      completed_at: null,
    },
    {
      id: SEED_ACTION_IDS[2],
      record_id: SEED_RECORD_IDS[2],
      title: "Renew expired certificate",
      status: "completed",
      completed: true,
      due_date: dateFromToday(-10),
      owner: "Clergy",
      notes: "Completed action on expired record.",
      created_at: isoDaysAgo(20),
      completed_at: isoDaysAgo(2),
    },
  ];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} label
 * @param {{ error: { message: string } | null }} result
 */
function assertNoError(label, result) {
  if (result.error) {
    console.error(`${label}: ${result.error.message}`);
    process.exit(1);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function deleteNonSeedRecords(supabase) {
  const { data, error } = await supabase
    .from("compliance_records")
    .select("id")
    .eq("organisation_id", ALPHA_ORG_ID);

  assertNoError("fetch compliance_records", { error });

  const seedSet = new Set(SEED_RECORD_IDS);
  const extraIds = (data ?? []).map((row) => row.id).filter((id) => !seedSet.has(id));

  if (extraIds.length === 0) {
    return 0;
  }

  const { error: deleteError } = await supabase
    .from("compliance_records")
    .delete()
    .in("id", extraIds);

  assertNoError("delete non-seed compliance_records", { error: deleteError });
  return extraIds.length;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function deleteNonSeedPeople(supabase) {
  const { data, error } = await supabase
    .from("people")
    .select("id, name")
    .eq("organisation_id", ALPHA_ORG_ID);

  assertNoError("fetch people", { error });

  const seedSet = new Set(SEED_PERSON_IDS);
  const extraIds = (data ?? [])
    .filter((row) => !seedSet.has(row.id) || /^Step10 Verify/i.test(row.name))
    .map((row) => row.id);

  const uniqueExtraIds = [...new Set(extraIds)];

  if (uniqueExtraIds.length === 0) {
    return 0;
  }

  const { error: deleteError } = await supabase.from("people").delete().in("id", uniqueExtraIds);

  assertNoError("delete non-seed people", { error: deleteError });
  return uniqueExtraIds.length;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function restoreSeedPeople(supabase) {
  for (const person of SEED_PEOPLE) {
    const { error } = await supabase
      .from("people")
      .update({ name: person.name, role: person.role })
      .eq("id", person.id)
      .eq("organisation_id", ALPHA_ORG_ID);

    assertNoError(`restore person ${person.name}`, { error });
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function restoreSeedRecords(supabase) {
  for (const record of buildSeedRecords()) {
    const { error } = await supabase
      .from("compliance_records")
      .update({
        person_id: record.person_id,
        compliance_type: record.compliance_type,
        expiry_date: record.expiry_date,
        renewal_cycle: record.renewal_cycle,
        notes: record.notes,
      })
      .eq("id", record.id)
      .eq("organisation_id", ALPHA_ORG_ID);

    assertNoError(`restore record ${record.id}`, { error });
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function pruneNonSeedHistory(supabase) {
  const { data, error } = await supabase
    .from("history_entries")
    .select("id")
    .eq("organisation_id", ALPHA_ORG_ID);

  assertNoError("fetch history_entries", { error });

  const seedSet = new Set(SEED_HISTORY_IDS);
  const extraIds = (data ?? []).map((row) => row.id).filter((id) => !seedSet.has(id));

  if (extraIds.length === 0) {
    return 0;
  }

  const { error: deleteError } = await supabase.from("history_entries").delete().in("id", extraIds);

  assertNoError("delete non-seed history_entries", { error: deleteError });
  return extraIds.length;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function restoreSeedActions(supabase) {
  for (const action of buildSeedActions()) {
    const { error } = await supabase
      .from("actions")
      .update({
        record_id: action.record_id,
        title: action.title,
        status: action.status,
        completed: action.completed,
        due_date: action.due_date,
        owner: action.owner,
        notes: action.notes,
        created_at: action.created_at,
        completed_at: action.completed_at,
      })
      .eq("id", action.id)
      .eq("organisation_id", ALPHA_ORG_ID);

    assertNoError(`restore action ${action.id}`, { error });
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function assertCanonicalState(supabase) {
  const { data: step10People, error: step10Error } = await supabase
    .from("people")
    .select("id")
    .eq("organisation_id", ALPHA_ORG_ID)
    .ilike("name", "Step10 Verify%");

  assertNoError("check Step10 Verify people", { error: step10Error });

  if ((step10People ?? []).length > 0) {
    console.error("Step10 Verify people remain after reset.");
    process.exit(1);
  }

  const { count: alexRecordCount, error: alexError } = await supabase
    .from("compliance_records")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", ALPHA_ORG_ID)
    .eq("person_id", SEED_PERSON_IDS[0]);

  assertNoError("count Alex Volunteer records", { error: alexError });

  if (alexRecordCount !== 2) {
    console.error(`Expected 2 records for Alex Volunteer, got ${alexRecordCount}.`);
    process.exit(1);
  }

  const tables = [
    ["people", CANONICAL_COUNTS.people],
    ["compliance_records", CANONICAL_COUNTS.records],
    ["history_entries", CANONICAL_COUNTS.history],
    ["evidence_items", CANONICAL_COUNTS.evidence],
    ["actions", CANONICAL_COUNTS.actions],
    ["deleted_record_snapshots", CANONICAL_COUNTS.deletedSnapshots],
  ];

  for (const [table, expected] of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", ALPHA_ORG_ID);

    assertNoError(`count ${table}`, { error });

    if (count !== expected) {
      console.error(`Expected ${table} count ${expected}, got ${count}.`);
      process.exit(1);
    }
  }
}

let envContent = "";

try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Missing .env file.");
  process.exit(1);
}

const supabaseUrl = readEnvValue(envContent, "SUPABASE_URL");
const serviceRoleKey = readEnvValue(envContent, "SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || supabaseUrl.includes("YOUR_PROJECT")) {
  console.error(".env must define SUPABASE_URL for staging reset.");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error(".env must define SUPABASE_SERVICE_ROLE_KEY (Node-only, never in browser bundle).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const deletedRecords = await deleteNonSeedRecords(supabase);
const deletedPeople = await deleteNonSeedPeople(supabase);
await restoreSeedPeople(supabase);
await restoreSeedRecords(supabase);
const deletedHistory = await pruneNonSeedHistory(supabase);
await restoreSeedActions(supabase);
await assertCanonicalState(supabase);

console.log("reset-alpha-staging-data: OK");
console.log(`  Organisation: ${ALPHA_ORG_ID}`);
console.log(`  Removed non-seed records: ${deletedRecords}`);
console.log(`  Removed non-seed people: ${deletedPeople}`);
console.log(`  Removed non-seed history: ${deletedHistory}`);
console.log(`  People: ${CANONICAL_COUNTS.people}`);
console.log(`  Records: ${CANONICAL_COUNTS.records}`);
console.log(`  History: ${CANONICAL_COUNTS.history}`);
console.log(`  Evidence: ${CANONICAL_COUNTS.evidence}`);
console.log(`  Actions: ${CANONICAL_COUNTS.actions}`);
console.log(`  Deleted snapshots: ${CANONICAL_COUNTS.deletedSnapshots}`);
