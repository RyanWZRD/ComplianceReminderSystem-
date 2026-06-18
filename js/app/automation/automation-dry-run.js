/**
 * V5-0 Phase 5: Automation dry-run scan engine.
 * Computes automation candidates from compliance rows without executing automation.
 * Read-only — no email delivery, queue, RPC, cron, or row mutation.
 */

import { DEFAULT_REMINDER_SETTINGS } from "../../data/constants.js";
import { REMINDER_UI_LABELS } from "../../data/reminder-sent.js";
import {
  computeComplianceInsights,
  createInsightsContext,
  normalizeComplianceRow,
} from "../insights/insights-engine.js";
import { personRowHasEmail } from "../insights/metrics-contact-readiness.js";
import { EVIDENCE_GAP_TIERS } from "../insights/metrics-evidence-gaps.js";
import {
  getActiveReminderType,
  hasReminderActivityForType,
} from "../insights/metrics-operational.js";

/** @typedef {import("../insights/insights-engine.js").NormalizedComplianceRow} NormalizedComplianceRow */

export const AUTOMATION_REMINDER_TYPE_BUCKETS = {
  "30-day": REMINDER_UI_LABELS[30],
  "14-day": REMINDER_UI_LABELS[14],
  "7-day": REMINDER_UI_LABELS[7],
  expired: REMINDER_UI_LABELS.expired,
};

const REMINDER_TYPE_TO_BUCKET = Object.fromEntries(
  Object.entries(AUTOMATION_REMINDER_TYPE_BUCKETS).map(([bucket, reminderType]) => [
    reminderType,
    bucket,
  ])
);

/**
 * @returns {{ "30-day": number, "14-day": number, "7-day": number, expired: number }}
 */
function createEmptyReminderTypeCounts() {
  return {
    "30-day": 0,
    "14-day": 0,
    "7-day": 0,
    expired: 0,
  };
}

/**
 * @param {NormalizedComplianceRow[]} rows
 * @param {import("../insights/insights-engine.js").InsightsContext} ctx
 */
function computeReminderCandidates(rows, ctx) {
  const byType = createEmptyReminderTypeCounts();
  let withEmail = 0;
  let missingEmail = 0;
  let total = 0;

  rows.forEach((row) => {
    const reminderType = getActiveReminderType(row.expiryDate, ctx.settings, ctx);

    if (!reminderType) {
      return;
    }

    total += 1;

    const bucket = REMINDER_TYPE_TO_BUCKET[reminderType];

    if (bucket) {
      byType[bucket] += 1;
    }

    if (personRowHasEmail(row)) {
      withEmail += 1;
    } else {
      missingEmail += 1;
    }
  });

  return {
    total,
    byType,
    withEmail,
    missingEmail,
  };
}

/**
 * @param {NormalizedComplianceRow[]} rows
 * @param {import("../insights/insights-engine.js").InsightsContext} ctx
 */
function countExpiredRecordsMissingFollowUp(rows, ctx) {
  let expiredNoFollowUp = 0;

  rows.forEach((row) => {
    const reminderType = getActiveReminderType(row.expiryDate, ctx.settings, ctx);

    if (reminderType !== REMINDER_UI_LABELS.expired) {
      return;
    }

    if (!hasReminderActivityForType(row, reminderType)) {
      expiredNoFollowUp += 1;
    }
  });

  return expiredNoFollowUp;
}

/**
 * Deterministic dry-run scan over compliance rows.
 *
 * @param {object[]} rows
 * @param {object} [settings]
 * @param {string|Date} [asOfDate]
 */
export function computeAutomationDryRun(
  rows,
  settings = DEFAULT_REMINDER_SETTINGS,
  asOfDate
) {
  const inputRows = Array.isArray(rows) ? rows : [];
  const normalizedRows = inputRows.map(normalizeComplianceRow);
  const insights = computeComplianceInsights(inputRows, settings, asOfDate);
  const ctx = createInsightsContext(asOfDate, settings);

  return {
    asOfDate: insights.asOfDate,
    totalRecords: normalizedRows.length,
    reminderCandidates: computeReminderCandidates(normalizedRows, ctx),
    actionCandidates: {
      expiredRecords: insights.risk.expiredRecords,
      criticalEvidenceGaps: insights.evidenceGaps.byTier[EVIDENCE_GAP_TIERS.CRITICAL] ?? 0,
      missingFollowUp: insights.operationalHealth.recordsMissingReminderActivity ?? 0,
    },
    escalationCandidates: {
      expiredNoFollowUp: countExpiredRecordsMissingFollowUp(normalizedRows, ctx),
      missingEmailInReminderWindow:
        insights.contactReadiness.peopleInReminderWindowMissingEmail ?? 0,
    },
  };
}
