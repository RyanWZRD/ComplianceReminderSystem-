import {
  getOrganisationId,
  isAuthenticated,
  waitForAuthReady,
} from "../auth/session.js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import {
  mapAutomationPolicyFromRpc,
  mapAutomationPolicyToRpc,
} from "./automation-policies.js";
import { mapAutomationRunFromRpc } from "./automation-runs.js";
import { mapReminderDeliveryLogFromRpc } from "./reminder-delivery-logs.js";

/**
 * @typedef {import('./automation-policies.js').AutomationPolicyView} AutomationPolicyView
 * @typedef {import('./automation-policies.js').AutomationPolicyInput} AutomationPolicyInput
 * @typedef {import('./automation-runs.js').AutomationRunView} AutomationRunView
 * @typedef {import('./reminder-delivery-logs.js').ReminderDeliveryLogView} ReminderDeliveryLogView
 */

/**
 * @typedef {Object} AutomationPoliciesLoadResult
 * @property {boolean} ok
 * @property {Error} [error]
 */

/**
 * @typedef {Object} AutomationRunsLoadResult
 * @property {boolean} ok
 * @property {Error} [error]
 */

/**
 * @typedef {Object} AutomationRunLoadResult
 * @property {boolean} ok
 * @property {AutomationRunView} [run]
 * @property {Error | string} [error]
 */

/**
 * @typedef {Object} ReminderDeliveryLogsLoadResult
 * @property {boolean} ok
 * @property {Error} [error]
 */

/**
 * @typedef {Object} AutomationRunCreateInput
 * @property {import('./cloud-mapper.js').AutomationRunStatus} [status]
 * @property {import('./cloud-mapper.js').AutomationRunSummary | object} [summary]
 * @property {string | null} [error]
 */

/**
 * @typedef {Object} AutomationRunCreateResult
 * @property {boolean} ok
 * @property {"created"} [status]
 * @property {AutomationRunView} [run]
 * @property {string} [error]
 */

export class CloudAutomationStore {
  constructor() {
    /** @type {AutomationPolicyView[]} */
    this.policies = [];
    /** @type {AutomationRunView[]} */
    this.runs = [];
    /** @type {ReminderDeliveryLogView[]} */
    this.deliveryLogs = [];
  }

  get backend() {
    return "cloud";
  }

  /**
   * @returns {AutomationPolicyView[]}
   */
  getPolicies() {
    return this.policies;
  }

  /**
   * @returns {AutomationRunView[]}
   */
  getAutomationRuns() {
    return this.runs;
  }

  /**
   * @returns {ReminderDeliveryLogView[]}
   */
  getReminderDeliveryLogs() {
    return this.deliveryLogs;
  }

  /**
   * @returns {Promise<AutomationPoliciesLoadResult>}
   */
  async loadPolicies() {
    if (!isSupabaseConfigured()) {
      const error = new Error(
        "Supabase is not configured. Run npm run sync-env after setting .env."
      );
      return { ok: false, error };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      const error = new Error("Not signed in. Sign in before loading automation policies.");
      return { ok: false, error };
    }

    const organisationId = getOrganisationId();

    if (!organisationId) {
      const error = new Error("No organisation on the current session profile.");
      return { ok: false, error };
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("get_automation_policies");

      if (error) {
        return { ok: false, error: new Error(error.message) };
      }

      if (!data || typeof data !== "object" || data.status !== "ok") {
        return {
          ok: false,
          error: new Error(
            `Unexpected response from get_automation_policies: ${JSON.stringify(data)}`
          ),
        };
      }

      const rows = Array.isArray(data.policies) ? data.policies : [];

      this.policies = rows.map((row) => mapAutomationPolicyFromRpc(row));

      return { ok: true };
    } catch (error) {
      const loadError = error instanceof Error ? error : new Error(String(error));
      return { ok: false, error: loadError };
    }
  }

  /**
   * @param {AutomationPolicyInput} input
   * @returns {Promise<
   *   | { ok: true; status: "upserted"; policy: AutomationPolicyView }
   *   | { ok: false; error: string }
   * >}
   */
  async upsertAutomationPolicy(input) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const supabase = getSupabaseClient();
    const rpcArgs = mapAutomationPolicyToRpc(input);
    const { data, error } = await supabase.rpc("upsert_automation_policy", rpcArgs);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object" || data.status !== "upserted" || !data.policy) {
      return {
        ok: false,
        error: `Unexpected response from upsert_automation_policy: ${JSON.stringify(data)}`,
      };
    }

    const policy = mapAutomationPolicyFromRpc(data.policy);
    const existingIndex = this.policies.findIndex(
      (entry) => entry.policyType === policy.policyType
    );

    if (existingIndex >= 0) {
      this.policies[existingIndex] = policy;
    } else {
      this.policies.push(policy);
    }

    return { ok: true, status: "upserted", policy };
  }

  /**
   * @returns {Promise<AutomationRunsLoadResult>}
   */
  async loadAutomationRuns() {
    if (!isSupabaseConfigured()) {
      const error = new Error(
        "Supabase is not configured. Run npm run sync-env after setting .env."
      );
      return { ok: false, error };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      const error = new Error("Not signed in. Sign in before loading automation runs.");
      return { ok: false, error };
    }

    const organisationId = getOrganisationId();

    if (!organisationId) {
      const error = new Error("No organisation on the current session profile.");
      return { ok: false, error };
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("get_automation_runs");

      if (error) {
        return { ok: false, error: new Error(error.message) };
      }

      if (!data || typeof data !== "object" || data.status !== "ok") {
        return {
          ok: false,
          error: new Error(
            `Unexpected response from get_automation_runs: ${JSON.stringify(data)}`
          ),
        };
      }

      const rows = Array.isArray(data.runs) ? data.runs : [];

      this.runs = rows.map((row) => mapAutomationRunFromRpc(row));

      return { ok: true };
    } catch (error) {
      const loadError = error instanceof Error ? error : new Error(String(error));
      return { ok: false, error: loadError };
    }
  }

  /**
   * @returns {Promise<ReminderDeliveryLogsLoadResult>}
   */
  async loadReminderDeliveryLogs() {
    if (!isSupabaseConfigured()) {
      const error = new Error(
        "Supabase is not configured. Run npm run sync-env after setting .env."
      );
      return { ok: false, error };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      const error = new Error("Not signed in. Sign in before loading delivery logs.");
      return { ok: false, error };
    }

    const organisationId = getOrganisationId();

    if (!organisationId) {
      const error = new Error("No organisation on the current session profile.");
      return { ok: false, error };
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("get_reminder_delivery_logs", {
        p_organisation_id: organisationId,
      });

      if (error) {
        return { ok: false, error: new Error(error.message) };
      }

      if (!data || typeof data !== "object" || data.status !== "ok") {
        return {
          ok: false,
          error: new Error(
            `Unexpected response from get_reminder_delivery_logs: ${JSON.stringify(data)}`
          ),
        };
      }

      const rows = Array.isArray(data.logs) ? data.logs : [];

      this.deliveryLogs = rows.map((row) => mapReminderDeliveryLogFromRpc(row));

      return { ok: true };
    } catch (error) {
      const loadError = error instanceof Error ? error : new Error(String(error));
      return { ok: false, error: loadError };
    }
  }

  /**
   * @param {string} runId
   * @returns {Promise<AutomationRunLoadResult>}
   */
  async loadAutomationRun(runId) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    if (typeof runId !== "string" || !runId.trim()) {
      return { ok: false, error: "Run id is required." };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_automation_run", {
      p_run_id: runId,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return {
        ok: false,
        error: `Unexpected response from get_automation_run: ${JSON.stringify(data)}`,
      };
    }

    if (data.status === "not_found") {
      return { ok: false, error: "Automation run not found." };
    }

    if (data.status !== "ok" || !data.run) {
      return {
        ok: false,
        error: `Unexpected response from get_automation_run: ${JSON.stringify(data)}`,
      };
    }

    return { ok: true, run: mapAutomationRunFromRpc(data.run) };
  }

  /**
   * @param {AutomationRunCreateInput} [input]
   * @returns {Promise<AutomationRunCreateResult>}
   */
  async createAutomationRun(input = {}) {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: "Supabase is not configured." };
    }

    await waitForAuthReady();

    if (!isAuthenticated()) {
      return { ok: false, error: "Not signed in." };
    }

    const status = input.status ?? "completed";
    const summary = input.summary ?? {};
    const errorMessage = input.error ?? null;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("create_automation_run", {
      p_status: status,
      p_summary: summary,
      p_error: errorMessage,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data || typeof data !== "object" || data.status !== "created" || !data.run) {
      return {
        ok: false,
        error: `Unexpected response from create_automation_run: ${JSON.stringify(data)}`,
      };
    }

    const run = mapAutomationRunFromRpc(data.run);
    this.runs = [run, ...this.runs.filter((entry) => entry.id !== run.id)];

    return { ok: true, status: "created", run };
  }
}
