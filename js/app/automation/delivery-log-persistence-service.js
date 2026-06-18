/**
 * V6 Phase 26: Delivery log persistence service.
 * Persists delivery-log RPC payloads through an injected db adapter.
 * Persistence only — no provider calls, sending, app wiring, or mark-as-sent.
 */

/**
 * @typedef {import("./delivery-worker-persistence.js").CreateReminderDeliveryLogPayload} CreateReminderDeliveryLogPayload
 */

/**
 * @typedef {Object} DeliveryLogPersistenceSuccessResult
 * @property {true} ok
 * @property {CreateReminderDeliveryLogPayload} payload
 * @property {{
 *   id: string;
 *   deliveryStatus: string;
 *   createdAt: string;
 * }} log
 */

/**
 * @typedef {Object} DeliveryLogPersistenceFailureResult
 * @property {false} ok
 * @property {CreateReminderDeliveryLogPayload} payload
 * @property {string} error
 */

/**
 * @typedef {DeliveryLogPersistenceSuccessResult | DeliveryLogPersistenceFailureResult} DeliveryLogPersistenceResult
 */

/**
 * @typedef {Object} DeliveryLogPersistenceSummary
 * @property {number} total
 * @property {number} persisted
 * @property {number} failed
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
function resolveErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Persist delivery-log payloads via create_reminder_delivery_log RPC adapter.
 *
 * @param {{
 *   db: {
 *     createReminderDeliveryLog: (
 *       payload: CreateReminderDeliveryLogPayload
 *     ) => Promise<
 *       | { ok: true; log: { id: string; deliveryStatus: string; createdAt: string } }
 *       | { ok: false; error: string }
 *     >;
 *   };
 *   payloads: CreateReminderDeliveryLogPayload[];
 * }} input
 * @returns {Promise<{ results: DeliveryLogPersistenceResult[]; summary: DeliveryLogPersistenceSummary }>}
 */
export async function persistDeliveryLogPayloads({ db, payloads }) {
  const inputPayloads = Array.isArray(payloads) ? payloads : [];

  if (!db || typeof db.createReminderDeliveryLog !== "function") {
    throw new Error(
      "persistDeliveryLogPayloads requires db with createReminderDeliveryLog."
    );
  }

  /** @type {DeliveryLogPersistenceResult[]} */
  const results = [];

  let persisted = 0;
  let failed = 0;

  for (const payload of inputPayloads) {
    try {
      const result = await db.createReminderDeliveryLog(payload);

      if (result.ok) {
        results.push({
          ok: true,
          payload,
          log: result.log,
        });
        persisted += 1;
        continue;
      }

      results.push({
        ok: false,
        payload,
        error: result.error,
      });
      failed += 1;
    } catch (error) {
      results.push({
        ok: false,
        payload,
        error: resolveErrorMessage(error),
      });
      failed += 1;
    }
  }

  return {
    results,
    summary: {
      total: inputPayloads.length,
      persisted,
      failed,
    },
  };
}
