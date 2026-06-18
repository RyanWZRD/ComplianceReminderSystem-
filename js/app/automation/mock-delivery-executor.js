/**
 * V6 Phase 7: Mock delivery executor.
 * In-memory delivery execution using the mock email provider only.
 * No real email provider, production delivery, mark-as-sent, or database writes.
 */

import { transitionReminderDeliveryRecord } from "./reminder-delivery-state-machine.js";

const MISSING_RECIPIENT_EMAIL_REASON = "missing_recipient_email";

/**
 * @typedef {import("./reminder-delivery-state-machine.js").ReminderDeliveryRecord} ReminderDeliveryRecord
 */

/**
 * @typedef {Object} MockDeliveryExecutionSummary
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
function isTerminalSkippedRecord(record) {
  return (
    record.deliveryStatus === "delivered" || record.deliveryStatus === "cancelled"
  );
}

/**
 * Execute mock reminder delivery for prepared records using a provider adapter.
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
 *   at?: string | null;
 * }} input
 * @returns {Promise<{ records: ReminderDeliveryRecord[]; summary: MockDeliveryExecutionSummary }>}
 */
export async function executeMockReminderDelivery({ records, provider, at }) {
  const inputRecords = Array.isArray(records) ? records : [];

  if (!provider || typeof provider.sendReminder !== "function") {
    throw new Error(
      "executeMockReminderDelivery requires a provider with sendReminder."
    );
  }

  /** @type {ReminderDeliveryRecord[]} */
  const updatedRecords = [];

  let attempted = 0;
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const record of inputRecords) {
    if (isTerminalSkippedRecord(record) || isMissingRecipientEmailFailure(record)) {
      updatedRecords.push(record);
      skipped += 1;
      continue;
    }

    if (record.deliveryStatus !== "prepared") {
      updatedRecords.push(record);
      skipped += 1;
      continue;
    }

    attempted += 1;

    let current = transitionReminderDeliveryRecord({
      record,
      nextStatus: "sending",
      at,
    });

    const result = await provider.sendReminder({
      to: String(current.recipientEmail ?? ""),
      subject: current.subject,
      bodyText: current.bodyText,
      metadata: current.metadata,
    });

    if (result.status === "delivered") {
      current = transitionReminderDeliveryRecord({
        record: current,
        nextStatus: "delivered",
        at: result.deliveredAt ?? at,
      });
      delivered += 1;
    } else {
      current = transitionReminderDeliveryRecord({
        record: current,
        nextStatus: "failed",
        reason: result.failureReason,
        at,
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
