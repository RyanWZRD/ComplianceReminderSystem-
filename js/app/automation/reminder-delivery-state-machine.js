/**
 * V6 Phase 5: Reminder delivery state machine.
 * Pure in-memory state transitions for reminder delivery records.
 * State logic only — no email provider, delivery, mark-as-sent, or database writes.
 */

/**
 * @typedef {"queued" | "prepared" | "sending" | "delivered" | "failed" | "cancelled"} DeliveryStatus
 */

/**
 * @typedef {Object} DeliveryStatusHistoryEntry
 * @property {DeliveryStatus} from
 * @property {DeliveryStatus} to
 * @property {string} at
 * @property {string | null} reason
 */

/**
 * @typedef {import("./reminder-delivery-record-builder.js").ReminderDeliveryRecord & {
 *   cancelledAt?: string | null;
 *   cancellationReason?: string | null;
 *   statusHistory?: DeliveryStatusHistoryEntry[];
 * }} ReminderDeliveryRecord
 */

/** @type {readonly DeliveryStatus[]} */
export const DELIVERY_STATUSES = [
  "queued",
  "prepared",
  "sending",
  "delivered",
  "failed",
  "cancelled",
];

/** @type {Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>>} */
const VALID_TRANSITIONS = {
  queued: ["prepared", "cancelled"],
  prepared: ["sending", "cancelled", "failed"],
  sending: ["delivered", "failed"],
  delivered: [],
  failed: ["queued", "cancelled"],
  cancelled: [],
};

/**
 * @param {DeliveryStatus} currentStatus
 * @param {DeliveryStatus} nextStatus
 * @returns {boolean}
 */
export function isValidReminderDeliveryTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed) {
    return false;
  }

  return allowed.includes(nextStatus);
}

/**
 * @param {string | undefined | null} at
 * @returns {string}
 */
function resolveTransitionTimestamp(at) {
  const resolvedAt = String(at ?? "").trim();

  if (resolvedAt) {
    return resolvedAt;
  }

  return new Date().toISOString();
}

/**
 * @param {ReminderDeliveryRecord} record
 * @param {DeliveryStatus} nextStatus
 * @param {string} at
 * @param {string | null | undefined} reason
 * @returns {ReminderDeliveryRecord}
 */
function applyStatusTimestampFields(record, nextStatus, at, reason) {
  const resolvedReason = reason != null && String(reason).trim()
    ? String(reason).trim()
    : null;

  if (nextStatus === "prepared") {
    return {
      ...record,
      preparedAt: record.preparedAt ?? at,
    };
  }

  if (nextStatus === "sending") {
    return {
      ...record,
      sentAt: record.sentAt ?? at,
    };
  }

  if (nextStatus === "delivered") {
    return {
      ...record,
      deliveredAt: at,
    };
  }

  if (nextStatus === "failed") {
    return {
      ...record,
      failedAt: at,
      failureReason: resolvedReason,
    };
  }

  if (nextStatus === "cancelled") {
    return {
      ...record,
      cancelledAt: at,
      cancellationReason: resolvedReason,
    };
  }

  return record;
}

/**
 * Transition a reminder delivery record to the next lifecycle status (in-memory only).
 *
 * @param {{
 *   record: ReminderDeliveryRecord;
 *   nextStatus: DeliveryStatus;
 *   reason?: string | null;
 *   at?: string | null;
 * }} input
 * @returns {ReminderDeliveryRecord}
 */
export function transitionReminderDeliveryRecord({
  record,
  nextStatus,
  reason,
  at,
}) {
  if (!record || typeof record !== "object") {
    throw new Error("transitionReminderDeliveryRecord requires a record object.");
  }

  const currentStatus = record.deliveryStatus;

  if (!DELIVERY_STATUSES.includes(currentStatus)) {
    throw new Error(
      `Invalid current delivery status "${String(currentStatus)}".`
    );
  }

  if (!DELIVERY_STATUSES.includes(nextStatus)) {
    throw new Error(`Invalid next delivery status "${String(nextStatus)}".`);
  }

  if (!isValidReminderDeliveryTransition(currentStatus, nextStatus)) {
    throw new Error(
      `Invalid delivery status transition from "${currentStatus}" to "${nextStatus}".`
    );
  }

  const transitionAt = resolveTransitionTimestamp(at);
  const priorHistory = Array.isArray(record.statusHistory)
    ? [...record.statusHistory]
    : [];

  const withStatus = {
    ...record,
    deliveryStatus: nextStatus,
    statusHistory: [
      ...priorHistory,
      {
        from: currentStatus,
        to: nextStatus,
        at: transitionAt,
        reason: reason != null && String(reason).trim()
          ? String(reason).trim()
          : null,
      },
    ],
  };

  return applyStatusTimestampFields(withStatus, nextStatus, transitionAt, reason);
}
