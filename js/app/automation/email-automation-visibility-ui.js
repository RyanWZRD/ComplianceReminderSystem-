/**
 * V6 Phase 65: Email automation visibility UI helpers.
 * Read-only display mapping — no execution hooks.
 */

import { summariseAutomationRun } from "../cloud/automation-runs.js";

/** @typedef {import("../cloud/automation-runs.js").AutomationRunVisibilityView} AutomationRunVisibilityView */
/** @typedef {import("../cloud/delivery-logs.js").DeliveryLogVisibilityView} DeliveryLogVisibilityView */

export const EMAIL_AUTOMATION_VISIBILITY_EMPTY_MESSAGE = "No automation runs logged yet.";

export const EMAIL_AUTOMATION_DELIVERY_LOG_EMPTY_MESSAGE =
  "No delivery logs for this automation run.";

export const EMAIL_AUTOMATION_RUN_COLUMNS = [
  { key: "createdAt", label: "Created" },
  { key: "modeRunType", label: "Mode / run type" },
  { key: "status", label: "Status" },
  { key: "totalCandidates", label: "Total candidates" },
  { key: "wouldSend", label: "Would send" },
  { key: "skipped", label: "Skipped" },
  { key: "failed", label: "Failed" },
  { key: "sent", label: "Sent" },
  { key: "automationRunId", label: "Run ID" },
  { key: "actions", label: "" },
];

export const EMAIL_AUTOMATION_DELIVERY_LOG_COLUMNS = [
  { key: "recipient", label: "Recipient" },
  { key: "complianceType", label: "Compliance type" },
  { key: "reminderType", label: "Reminder type" },
  { key: "dueDate", label: "Due date" },
  { key: "deliveryStatus", label: "Status" },
  { key: "provider", label: "Provider" },
  { key: "providerMessageId", label: "Message ID" },
  { key: "error", label: "Error" },
  { key: "createdSentAt", label: "Created / sent" },
  { key: "skipReason", label: "Skip reason" },
  { key: "duplicateInfo", label: "Duplicate info" },
];

/**
 * @param {string | null | undefined} value
 * @param {number} [visibleStart]
 * @param {number} [visibleEnd]
 * @returns {string}
 */
export function shortenDisplayId(value, visibleStart = 8, visibleEnd = 4) {
  if (typeof value !== "string" || !value.trim()) {
    return "—";
  }

  const trimmed = value.trim();

  if (trimmed.length <= visibleStart + visibleEnd + 1) {
    return trimmed;
  }

  return `${trimmed.slice(0, visibleStart)}…${trimmed.slice(-visibleEnd)}`;
}

/**
 * @param {string | null | undefined} isoString
 * @returns {string}
 */
export function formatEmailAutomationTimestamp(isoString) {
  if (typeof isoString !== "string" || !isoString.trim()) {
    return "—";
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @param {string | null | undefined} dateValue
 * @returns {string}
 */
export function formatEmailAutomationDate(dateValue) {
  if (typeof dateValue !== "string" || !dateValue.trim()) {
    return "—";
  }

  const date = new Date(`${dateValue.trim()}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * @param {AutomationRunVisibilityView} run
 * @param {DeliveryLogVisibilityView[]} [logs]
 * @returns {{
 *   automationRunId: string;
 *   createdAt: string;
 *   modeRunType: string;
 *   status: string;
 *   totalCandidates: string;
 *   wouldSend: string;
 *   skipped: string;
 *   failed: string;
 *   sent: string;
 *   runIdShort: string;
 * }}
 */
export function mapAutomationRunToVisibilityRow(run, logs = []) {
  const summary = summariseAutomationRun(run, logs);
  const mode = run.mode?.trim() || "—";
  const runType = run.runType?.trim() || "—";

  return {
    automationRunId: run.automationRunId,
    createdAt: formatEmailAutomationTimestamp(run.createdAt || run.startedAt),
    modeRunType: `${mode} / ${runType}`,
    status: run.status?.trim() || "—",
    totalCandidates: String(summary.totalCandidates),
    wouldSend: String(summary.wouldSend),
    skipped: String(summary.skipped),
    failed: String(summary.failed),
    sent: String(summary.sent),
    runIdShort: shortenDisplayId(run.automationRunId),
  };
}

/**
 * @param {DeliveryLogVisibilityView} log
 * @returns {{
 *   id: string;
 *   recipient: string;
 *   complianceType: string;
 *   reminderType: string;
 *   dueDate: string;
 *   deliveryStatus: string;
 *   provider: string;
 *   providerMessageId: string;
 *   error: string;
 *   createdSentAt: string;
 *   skipReason: string;
 *   duplicateInfo: string;
 *   safePayloadJson: string;
 * }}
 */
export function mapDeliveryLogToVisibilityRow(log) {
  const safePayload = log.safePayload ?? {};
  const reason =
    typeof safePayload.reason === "string" && safePayload.reason.trim()
      ? safePayload.reason.trim()
      : "—";

  const duplicateOf =
    typeof safePayload.duplicateOfDeliveryLogId === "string" &&
    safePayload.duplicateOfDeliveryLogId.trim()
      ? shortenDisplayId(safePayload.duplicateOfDeliveryLogId)
      : "";

  const duplicateInfo =
    reason === "duplicate_prevented" || duplicateOf
      ? duplicateOf
        ? `Prevented duplicate of ${duplicateOf}`
        : "Duplicate prevented"
      : "—";

  const errorParts = [log.errorCode, log.errorMessage].filter(
    (part) => typeof part === "string" && part.trim()
  );

  const createdLabel = formatEmailAutomationTimestamp(log.createdAt);
  const sentLabel = log.sentAt ? formatEmailAutomationTimestamp(log.sentAt) : "";
  const createdSentAt = sentLabel ? `${createdLabel} / ${sentLabel}` : createdLabel;

  const recipient =
    log.recipientEmail ||
    (log.recipientName ? `${log.recipientName} (no email)` : null) ||
    "—";

  return {
    id: log.id,
    recipient,
    complianceType: log.complianceType || "—",
    reminderType: log.reminderType || "—",
    dueDate: formatEmailAutomationDate(log.dueDate),
    deliveryStatus: log.deliveryStatus?.trim() || "—",
    provider: log.provider || "—",
    providerMessageId: shortenDisplayId(log.providerMessageId),
    error: errorParts.length > 0 ? errorParts.join(": ") : "—",
    createdSentAt,
    skipReason: log.deliveryStatus === "skipped" ? reason : "—",
    duplicateInfo,
    safePayloadJson: JSON.stringify(safePayload, null, 2),
  };
}

/**
 * @param {DeliveryLogVisibilityView[]} logs
 * @returns {ReturnType<typeof mapDeliveryLogToVisibilityRow>[]}
 */
export function mapDeliveryLogsToVisibilityRows(logs) {
  if (!Array.isArray(logs)) {
    return [];
  }

  return logs.map((log) => mapDeliveryLogToVisibilityRow(log));
}
