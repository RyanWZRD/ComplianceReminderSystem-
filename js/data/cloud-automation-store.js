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

/**
 * @typedef {import('./automation-policies.js').AutomationPolicyView} AutomationPolicyView
 * @typedef {import('./automation-policies.js').AutomationPolicyInput} AutomationPolicyInput
 */

/**
 * @typedef {Object} AutomationPoliciesLoadResult
 * @property {boolean} ok
 * @property {Error} [error]
 */

export class CloudAutomationStore {
  constructor() {
    /** @type {AutomationPolicyView[]} */
    this.policies = [];
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
}
