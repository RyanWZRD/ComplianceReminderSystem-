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
import { mapEditComplianceRecordToRpc } from "./edit-compliance-record.js";
import { mapUpdateComplianceRecordNotesToRpc } from "./update-compliance-record-notes.js";
import { mapCreateActionToRpc } from "./create-action.js";
import { mapCreateEvidenceToRpc } from "./create-evidence.js";
import { mapDeleteEvidenceToRpc } from "./delete-evidence.js";
import { mapUpdateEvidenceToRpc } from "./update-evidence.js";
import { mapArchiveComplianceRecordToRpc } from "./archive-compliance-record.js";
import {
  mapAddDefaultActionsToRpc,
  parseAddDefaultActionsResponse,
} from "./add-default-actions.js";
import { mapUpdateActionToRpc } from "./update-action.js";
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
   * @param {string} actionId
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "updated" | "not_found" | "invalid_transition" | "no_changes";
   *       reason?: string;
   *       targetStatus?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async setActionInProgress(actionId) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("set_action_in_progress", {
      p_action_id: actionId,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from set_action_in_progress." };
    }

    const status = data.status;

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "no_changes") {
      return { ok: true, status: "no_changes" };
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
          typeof data.target_status === "string" ? data.target_status : "in_progress",
      };
    }

    return {
      ok: false,
      error: `Unexpected set_action_in_progress status: ${String(status)}`,
    };
  }

  /**
   * @param {{
   *   actionId: string;
   *   title: string;
   *   notes?: string;
   *   dueDate?: string | null;
   *   owner?: string;
   * }} input
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "updated";
   *       actionId: string;
   *       title: string;
   *     }
   *   | {
   *       ok: true;
   *       status: "no_changes" | "not_found" | "validation_error";
   *       field?: string;
   *       reason?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async updateAction(input) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapUpdateActionToRpc(input);
    const { data, error } = await supabase.rpc("update_action", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from update_action." };
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

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "no_changes") {
      return { ok: true, status: "no_changes" };
    }

    if (status === "updated") {
      return {
        ok: true,
        status: "updated",
        actionId: String(data.action_id ?? input.actionId),
        title: typeof data.title === "string" ? data.title : input.title,
      };
    }

    return {
      ok: false,
      error: `Unexpected update_action status: ${String(status)}`,
    };
  }

  /**
   * @param {{
   *   recordId: string;
   *   title: string;
   *   notes?: string;
   *   dueDate?: string | null;
   *   owner?: string;
   * }} input
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "created";
   *       actionId: string;
   *       recordId: string;
   *       title: string;
   *     }
   *   | {
   *       ok: true;
   *       status: "not_found" | "validation_error";
   *       field?: string;
   *       reason?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async createAction(input) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapCreateActionToRpc(input);
    const { data, error } = await supabase.rpc("create_action", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from create_action." };
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

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "created") {
      return {
        ok: true,
        status: "created",
        actionId: String(data.action_id ?? ""),
        recordId: String(data.record_id ?? input.recordId),
        title: typeof data.title === "string" ? data.title : input.title,
      };
    }

    return {
      ok: false,
      error: `Unexpected create_action status: ${String(status)}`,
    };
  }

  /**
   * @param {{
   *   recordId: string;
   *   name: string;
   *   documentType: string;
   *   notes?: string;
   *   addedDate?: string;
   *   fileName?: string | null;
   * }} input
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "created";
   *       evidenceId: string;
   *       recordId: string;
   *       name: string;
   *       documentType: string;
   *     }
   *   | {
   *       ok: true;
   *       status: "not_found" | "validation_error";
   *       field?: string;
   *       reason?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async createEvidence(input) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapCreateEvidenceToRpc(input);
    const { data, error } = await supabase.rpc("create_evidence", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from create_evidence." };
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

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "created") {
      const evidence =
        data.evidence && typeof data.evidence === "object" ? data.evidence : {};

      return {
        ok: true,
        status: "created",
        evidenceId: String(data.evidence_id ?? ""),
        recordId: String(data.record_id ?? input.recordId),
        name: typeof evidence.name === "string" ? evidence.name : input.name,
        documentType:
          typeof evidence.document_type === "string"
            ? evidence.document_type
            : input.documentType,
      };
    }

    return {
      ok: false,
      error: `Unexpected create_evidence status: ${String(status)}`,
    };
  }

  /**
   * @param {string} evidenceId
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "deleted";
   *       evidenceId: string;
   *       recordId: string;
   *       documentType: string;
   *     }
   *   | { ok: true; status: "not_found" }
   *   | { ok: false; error: string }
   * >}
   */
  /**
   * @param {{
   *   evidenceId: string;
   *   name: string;
   *   documentType: string;
   *   notes?: string;
   *   addedDate?: string;
   *   fileName?: string | null;
   * }} input
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "updated";
   *       evidenceId: string;
   *       recordId: string;
   *       name: string;
   *       documentType: string;
   *     }
   *   | {
   *       ok: true;
   *       status: "no_changes" | "not_found" | "validation_error";
   *       field?: string;
   *       reason?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async updateEvidence(input) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapUpdateEvidenceToRpc(input);
    const { data, error } = await supabase.rpc("update_evidence", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from update_evidence." };
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

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "no_changes") {
      return { ok: true, status: "no_changes" };
    }

    if (status === "updated") {
      const evidence =
        data.evidence && typeof data.evidence === "object" ? data.evidence : {};

      return {
        ok: true,
        status: "updated",
        evidenceId: String(data.evidence_id ?? input.evidenceId),
        recordId: String(data.record_id ?? ""),
        name: typeof evidence.name === "string" ? evidence.name : input.name,
        documentType:
          typeof evidence.document_type === "string"
            ? evidence.document_type
            : input.documentType,
      };
    }

    return {
      ok: false,
      error: `Unexpected update_evidence status: ${String(status)}`,
    };
  }

  /**
   * @param {string} evidenceId
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "deleted";
   *       evidenceId: string;
   *       recordId: string;
   *       documentType: string;
   *     }
   *   | { ok: true; status: "not_found" }
   *   | { ok: false; error: string }
   * >}
   */
  async deleteEvidence(evidenceId) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(
      "delete_evidence",
      mapDeleteEvidenceToRpc(evidenceId)
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from delete_evidence." };
    }

    const status = data.status;

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "deleted") {
      return {
        ok: true,
        status: "deleted",
        evidenceId: String(data.evidence_id ?? evidenceId),
        recordId: String(data.record_id ?? ""),
        documentType:
          typeof data.document_type === "string" ? data.document_type : "",
      };
    }

    return {
      ok: false,
      error: `Unexpected delete_evidence status: ${String(status)}`,
    };
  }

  /**
   * @param {string} recordId
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "archived";
   *       recordId: string;
   *       deletedSnapshotId: string;
   *     }
   *   | { ok: true; status: "not_found" }
   *   | { ok: false; error: string }
   * >}
   */
  async archiveComplianceRecord(recordId) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(
      "archive_compliance_record",
      mapArchiveComplianceRecordToRpc(recordId)
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from archive_compliance_record." };
    }

    const status = data.status;

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "archived") {
      return {
        ok: true,
        status: "archived",
        recordId: String(data.record_id ?? recordId),
        deletedSnapshotId: String(data.deleted_snapshot_id ?? ""),
      };
    }

    return {
      ok: false,
      error: `Unexpected archive_compliance_record status: ${String(status)}`,
    };
  }

  /**
   * @param {string} recordId
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "completed";
   *       recordId: string;
   *       addedCount: number;
   *       skippedCount: number;
   *       added: { actionId: string; title: string }[];
   *       skippedTitles: string[];
   *     }
   *   | { ok: true; status: "not_found" }
   *   | { ok: false; error: string }
   * >}
   */
  async addDefaultActions(recordId) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(
      "add_default_actions",
      mapAddDefaultActionsToRpc(recordId)
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return parseAddDefaultActionsResponse(data);
  }

  /**
   * @param {string} actionId
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "deleted";
   *       actionId: string;
   *       recordId: string;
   *       title: string;
   *     }
   *   | { ok: true; status: "not_found" }
   *   | { ok: false; error: string }
   * >}
   */
  async deleteAction(actionId) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("delete_action", {
      p_action_id: actionId,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from delete_action." };
    }

    const status = data.status;

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "deleted") {
      return {
        ok: true,
        status: "deleted",
        actionId: String(data.action_id ?? actionId),
        recordId: String(data.record_id ?? ""),
        title: typeof data.title === "string" ? data.title : "",
      };
    }

    return {
      ok: false,
      error: `Unexpected delete_action status: ${String(status)}`,
    };
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
   * @param {{
   *   personId: string;
   *   recordId: string;
   *   name: string;
   *   role: string;
   *   complianceType: string;
   *   expiryDate: string;
   *   renewalCycle: string;
   * }} input
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "updated";
   *       personId: string;
   *       recordId: string;
   *     }
   *   | {
   *       ok: true;
   *       status: "no_changes" | "not_found" | "name_conflict";
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
  async updateComplianceRecord(input) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapEditComplianceRecordToRpc(input);
    const { data, error } = await supabase.rpc("update_compliance_record", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from update_compliance_record." };
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

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "no_changes") {
      return { ok: true, status: "no_changes" };
    }

    if (status === "name_conflict") {
      return { ok: true, status: "name_conflict" };
    }

    if (status === "updated") {
      return {
        ok: true,
        status: "updated",
        personId: String(data.person_id ?? input.personId),
        recordId: String(data.record_id ?? input.recordId),
      };
    }

    return {
      ok: false,
      error: `Unexpected update_compliance_record status: ${String(status)}`,
    };
  }

  /**
   * @param {string} recordId
   * @param {string} notes
   * @returns {Promise<
   *   | {
   *       ok: true;
   *       status: "updated" | "no_changes" | "not_found" | "rejected";
   *       reason?: string;
   *       notes?: string;
   *     }
   *   | { ok: false; error: string }
   * >}
   */
  async updateComplianceRecordNotes(recordId, notes) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapUpdateComplianceRecordNotesToRpc({ recordId, notes });
    const { data, error } = await supabase.rpc("update_compliance_record_notes", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Unexpected response from update_compliance_record_notes." };
    }

    const status = data.status;

    if (status === "not_found") {
      return { ok: true, status: "not_found" };
    }

    if (status === "no_changes") {
      return { ok: true, status: "no_changes" };
    }

    if (status === "rejected") {
      return {
        ok: true,
        status: "rejected",
        reason: typeof data.reason === "string" ? data.reason : "protected_audit_lines_removed",
      };
    }

    if (status === "updated") {
      return {
        ok: true,
        status: "updated",
        notes: typeof data.notes === "string" ? data.notes : notes,
      };
    }

    return {
      ok: false,
      error: `Unexpected update_compliance_record_notes status: ${String(status)}`,
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
