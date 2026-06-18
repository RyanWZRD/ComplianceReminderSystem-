/**
 * V6 Phase 24: Worker delivery execution engine.
 * Processes prepared delivery records through an injected provider adapter.
 * In-memory only — no app wiring, scheduling, database writes, RPC calls, or mark-as-sent.
 */

import { transitionReminderDeliveryRecord } from "./reminder-delivery-state-machine.js";

const MISSING_RECIPIENT_EMAIL_REASON = "missing_recipient_email";

/**
 * @typedef {import("./reminder-delivery-state-machine.js").ReminderDeliveryRecord} ReminderDeliveryRecord
 */

/**
 * @typedef {Object} DeliveryExecutionSummary
 * @property {number} total
 * @property {number} attempted
 * @property {number} delivered
 * @property {number} failed
 * @property {number} skipped
 */

/**
 * @param {ReminderDeliveryRecord} record
 * @returns {boolean}
 */
function isMissingRecipientEmailFailure(record) {
  return (
    record.deliveryStatus === "failed" &&
    record.failureReason === MISSING_RECIPIENT_EMAIL_REASON
  );
}

/**
 * @param {ReminderDeliveryRecord} record
 * @returns {boolean}
 */
function isSkippedRecord(record) {
  return (
    record.deliveryStatus === "delivered" ||
    record.deliveryStatus === "cancelled" ||
    isMissingRecipientEmailFailure(record)
  );
}

/**
 * Execute reminder deliveries for prepared records using an injected provider.
 *
 * @param {{
 *   records: ReminderDeliveryRecord[];
 *   provider: {
 *     sendReminder: (input: {
 *       to: string;
 *       subject: string;
 *       bodyText: string;
 *       metadata?: Record<string, unknown>;
 *     }) => Promise<
 *       | { status: "delivered"; providerMessageId?: string; deliveredAt?: string }
 *       | { status: "failed"; failureType?: string; failureReason: string }
 *     >;
 *   };
 *   transitionRecord?: typeof transitionReminderDeliveryRecord;
 *   now?: string | null;
 * }} input
 * @returns {Promise<{ records: ReminderDeliveryRecord[]; summary: DeliveryExecutionSummary }>}
 */
export async function executeReminderDeliveries({
  records,
  provider,
  transitionRecord = transitionReminderDeliveryRecord,
  now,
}) {
  const inputRecords = Array.isArray(records) ? records : [];

  if (!provider || typeof provider.sendReminder !== "function") {
    throw new Error("executeReminderDeliveries requires a provider with sendReminder.");
  }

  if (typeof transitionRecord !== "function") {
    throw new Error("executeReminderDeliveries requires transitionRecord.");
  }

  /** @type {ReminderDeliveryRecord[]} */
  const updatedRecords = [];

  let attempted = 0;
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const record of inputRecords) {
    if (isSkippedRecord(record) || record.deliveryStatus !== "prepared") {
      updatedRecords.push(record);
      skipped += 1;
      continue;
    }

    attempted += 1;

    let current = transitionRecord({
      record,
      nextStatus: "sending",
      at: now,
    });

    const result = await provider.sendReminder({
      to: String(current.recipientEmail ?? ""),
      subject: current.subject,
      bodyText: current.bodyText,
      metadata: current.metadata,
    });

    if (result.status === "delivered") {
      current = transitionRecord({
        record: current,
        nextStatus: "delivered",
        at: result.deliveredAt ?? now,
      });
      delivered += 1;
    } else {
      current = transitionRecord({
        record: current,
        nextStatus: "failed",
        reason: result.failureReason,
        at: now,
      });
      failed += 1;
    }

    updatedRecords.push(current);
  }

  return {
    records: updatedRecords,
    summary: {
      total: inputRecords.length,
      attempted,
      delivered,
      failed,
      skipped,
    },
  };
}
