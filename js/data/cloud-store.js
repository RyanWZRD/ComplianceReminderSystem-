import {
  getOrganisationId,
  isAuthenticated,
  waitForAuthReady,
} from "../auth/session.js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { buildPeopleTree, mapDeletedSnapshots } from "./cloud-mapper.js";
import { LocalComplianceStore } from "./local-store.js";

const READ_ONLY_MESSAGE =
  "Cloud compliance store is read-only in this release. Writes are not enabled yet.";

/**
 * @typedef {Object} LoadResult
 * @property {boolean} ok
 * @property {boolean} usedSample
 * @property {boolean} isFirstVisit
 * @property {Error} [error]
 */

export class CloudComplianceStore extends LocalComplianceStore {
  get backend() {
    return "cloud";
  }

  save() {
    // Read-only alpha: no Postgres or localStorage persistence.
  }

  buildBackup() {
    throw new Error(READ_ONLY_MESSAGE);
  }

  validateBackupDryRun() {
    throw new Error(READ_ONLY_MESSAGE);
  }

  applyBackup() {
    throw new Error(READ_ONLY_MESSAGE);
  }

  /**
   * @param {{ onLoadError?: (error: Error) => void }} [options]
   * @returns {Promise<LoadResult>}
   */
  async load({ onLoadError } = {}) {
    if (!isSupabaseConfigured()) {
      const error = new Error(
        "Supabase is not configured. Run npm run sync-env after setting .env."
      );
      return this.failLoad(error, onLoadError);
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      const error = new Error("Not signed in. Sign in before loading cloud data.");
      return this.failLoad(error, onLoadError);
    }

    const organisationId = getOrganisationId();

    if (!organisationId) {
      const error = new Error("No organisation on the current session profile.");
      return this.failLoad(error, onLoadError);
    }

    try {
      const fetchResult = await fetchComplianceData(organisationId);

      if (!fetchResult.ok) {
        return this.failLoad(new Error(fetchResult.error), onLoadError);
      }

      const peopleTree = buildPeopleTree(
        fetchResult.people,
        fetchResult.records,
        fetchResult.history,
        fetchResult.evidence,
        fetchResult.actions
      );

      this.people = peopleTree.map((person) => this.normalizePerson(person));
      this.deletedRecordHistory = mapDeletedSnapshots(fetchResult.deletedSnapshots).map(
        (item) => this.normalizeDeletedSnapshot(item)
      );

      return { ok: true, usedSample: false, isFirstVisit: false };
    } catch (error) {
      const loadError = error instanceof Error ? error : new Error(String(error));
      return this.failLoad(loadError, onLoadError);
    }
  }

  /**
   * @param {object} item
   */
  normalizeDeletedSnapshot(item) {
    const record =
      item.record && typeof item.record === "object"
        ? {
            ...item.record,
            history: Array.isArray(item.record.history) ? item.record.history : [],
            evidence: Array.isArray(item.record.evidence) ? item.record.evidence : [],
            actions: Array.isArray(item.record.actions) ? item.record.actions : [],
          }
        : {};

    return {
      deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : new Date().toISOString(),
      personName: typeof item.personName === "string" ? item.personName : "",
      personRole: typeof item.personRole === "string" ? item.personRole : "",
      record: {
        id: record.id,
        complianceType: this.normalizeComplianceType(record.complianceType),
        expiryDate: record.expiryDate || record.dbsExpiry || "",
        renewalCycle: this.normalizeRenewalCycle(record.renewalCycle),
        notes: typeof record.notes === "string" ? record.notes : "",
        history: (record.history || []).map((entry) => this.normalizeHistoryEntry(entry)),
        evidence: this.normalizeEvidenceList(record.evidence),
        actions: this.normalizeActionsList(record.actions),
      },
    };
  }

  /**
   * @param {Error} error
   * @param {(error: Error) => void} [onLoadError]
   * @returns {LoadResult}
   */
  failLoad(error, onLoadError) {
    if (typeof onLoadError === "function") {
      onLoadError(error);
    }

    return { ok: false, usedSample: false, isFirstVisit: false, error };
  }
}

/**
 * @param {string} organisationId
 */
async function fetchComplianceData(organisationId) {
  const supabase = getSupabaseClient();

  const [peopleResult, recordsResult, historyResult, evidenceResult, actionsResult, deletedResult] =
    await Promise.all([
      supabase
        .from("people")
        .select("id, name, role")
        .eq("organisation_id", organisationId)
        .order("name"),
      supabase
        .from("compliance_records")
        .select("id, person_id, compliance_type, expiry_date, renewal_cycle, notes")
        .eq("organisation_id", organisationId),
      supabase
        .from("history_entries")
        .select("id, record_id, action, description, created_at, actor_id, actor_display_name")
        .eq("organisation_id", organisationId),
      supabase
        .from("evidence_items")
        .select("id, record_id, name, document_type, added_date, notes, file_name")
        .eq("organisation_id", organisationId),
      supabase
        .from("actions")
        .select(
          "id, record_id, title, status, completed, due_date, owner, notes, created_at, completed_at"
        )
        .eq("organisation_id", organisationId),
      supabase
        .from("deleted_record_snapshots")
        .select("id, deleted_at, person_name, person_role, record_snapshot")
        .eq("organisation_id", organisationId)
        .order("deleted_at", { ascending: false }),
    ]);

  const firstError =
    peopleResult.error ||
    recordsResult.error ||
    historyResult.error ||
    evidenceResult.error ||
    actionsResult.error ||
    deletedResult.error;

  if (firstError) {
    return { ok: false, error: firstError.message };
  }

  return {
    ok: true,
    people: peopleResult.data ?? [],
    records: recordsResult.data ?? [],
    history: historyResult.data ?? [],
    evidence: evidenceResult.data ?? [],
    actions: actionsResult.data ?? [],
    deletedSnapshots: deletedResult.data ?? [],
  };
}
