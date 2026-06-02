import {
  getOrganisationId,
  isAuthenticated,
  waitForAuthReady,
} from "../auth/session.js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { buildPeopleTree, mapDeletedSnapshots } from "./cloud-mapper.js";
import { mapActionStatusToRpcTarget } from "./action-status.js";
import { mapReminderTypeToRpcCode } from "./reminder-sent.js";
import { mapRenewalModeToRpc } from "./renew-compliance.js";
import { mapCreateComplianceRecordToRpc } from "./create-compliance-record.js";
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
   * @param {string} recordId
   * @param {string} reminderType UI reminder label (e.g. "14 Day Reminder")
   * @returns {Promise<
   *   | { ok: true; status: 'marked' | 'skipped' | 'not_found'; reason?: string; notes?: string }
   *   | { ok: false; error: string }
   * >}
   */
  async markReminderSent(recordId, reminderType) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const rpcCode = mapReminderTypeToRpcCode(reminderType);

    if (!rpcCode) {
      return { ok: false, error: `Unknown reminder type: ${reminderType}` };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("mark_reminder_sent", {
      p_record_id: recordId,
      p_reminder_type: rpcCode,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from mark_reminder_sent." };
    }

    const status = data.status;

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "skipped") {
      return {
        ok: true,
        status: "skipped",
        reason: typeof data.reason === "string" ? data.reason : "already_sent",
      };
    }

    if (status === "marked") {
      return {
        ok: true,
        status: "marked",
        notes: typeof data.notes === "string" ? data.notes : "",
      };
    }

    return { ok: false, error: `Unexpected mark_reminder_sent status: ${String(status)}` };
  }

  /**
   * @param {string} actionId
   * @param {string} targetStatus `open` or `completed`
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "updated" | "not_found" | "invalid_transition";
   *       reason?: string;
   *       targetStatus?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async setActionStatus(actionId, targetStatus) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const rpcTarget = mapActionStatusToRpcTarget(targetStatus);

    if (!rpcTarget) {
      return { ok: false, error: `Invalid action status target: ${targetStatus}` };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("set_action_status", {
      p_action_id: actionId,
      p_target_status: rpcTarget,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from set_action_status." };
    }

    const status = data.status;

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "invalid_transition") {
      return {
        ok: true,
        status: "invalid_transition",
        reason: typeof data.reason === "string" ? data.reason : "invalid_transition",
      };
    }

    if (status === "updated") {
      return {
        ok: true,
        status: "updated",
        targetStatus:
          typeof data.target_status === "string" ? data.target_status : rpcTarget,
      };
    }

    return { ok: false, error: `Unexpected set_action_status status: ${String(status)}` };
  }

  /**
   * @param {string} recordId
   * @param {string} renewalMode `suggested` or `custom`
   * @param {string} [newExpiryDate] ISO date for custom mode
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status:
   *         | "renewed"
   *         | "not_found"
   *         | "invalid_date"
   *         | "suggested_unavailable";
   *       reason?: string;
   *       expiryDate?: string;
   *       notes?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async renewCompliance(recordId, renewalMode, newExpiryDate) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const rpcMode = mapRenewalModeToRpc(renewalMode);

    if (!rpcMode) {
      return { ok: false, error: `Invalid renewal mode: ${renewalMode}` };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = {
      p_record_id: recordId,
      p_renewal_mode: rpcMode,
    };

    if (rpcMode === "custom" && newExpiryDate) {
      rpcArgs.p_new_expiry_date = newExpiryDate;
    }

    const { data, error } = await supabase.rpc("renew_compliance", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from renew_compliance." };
    }

    const status = data.status;

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "invalid_date") {
      return {
        ok: true,
        status: "invalid_date",
        reason: typeof data.reason === "string" ? data.reason : "invalid_date",
      };
    }

    if (status === "suggested_unavailable") {
      return {
        ok: true,
        status: "suggested_unavailable",
        reason: typeof data.reason === "string" ? data.reason : "suggested_unavailable",
      };
    }

    if (status === "renewed") {
      const expiryRaw = data.expiry_date;
      const expiryDate =
        typeof expiryRaw === "string"
          ? expiryRaw.slice(0, 10)
          : expiryRaw instanceof Date
            ? expiryRaw.toISOString().slice(0, 10)
            : "";

      return {
        ok: true,
        status: "renewed",
        expiryDate,
        notes: typeof data.notes === "string" ? data.notes : "",
      };
    }

    return { ok: false, error: `Unexpected renew_compliance status: ${String(status)}` };
  }

  /**
   * @param {{
   *   name: string;
   *   role: string;
   *   complianceType: string;
   *   expiryDate: string;
   *   renewalCycle?: string;
   * }} input
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "created";
   *       personId: string;
   *       recordId: string;
   *       isNewPerson: boolean;
   *       complianceType?: string;
   *       expiryDate?: string;
   *     }
   *   | {
   *       ok: true;
   *       status: "validation_error";
   *       field?: string;
   *       reason?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async createComplianceRecord(input) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapCreateComplianceRecordToRpc(input);
    const { data, error } = await supabase.rpc("create_compliance_record", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from create_compliance_record." };
    }

    const status = data.status;

    if (status === "validation_error") {
      return {
        ok: true,
        status: "validation_error",
        field: typeof data.field === "string" ? data.field : undefined,
        reason: typeof data.reason === "string" ? data.reason : undefined,
      };
    }

    if (status === "created") {
      const expiryRaw = data.expiry_date;
      const expiryDate =
        typeof expiryRaw === "string"
          ? expiryRaw.slice(0, 10)
          : expiryRaw instanceof Date
            ? expiryRaw.toISOString().slice(0, 10)
            : "";

      return {
        ok: true,
        status: "created",
        personId: String(data.person_id ?? ""),
        recordId: String(data.record_id ?? ""),
        isNewPerson: Boolean(data.is_new_person),
        complianceType:
          typeof data.compliance_type === "string" ? data.compliance_type : undefined,
        expiryDate,
      };
    }

    return {
      ok: false,
      error: `Unexpected create_compliance_record status: ${String(status)}`,
    };
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
