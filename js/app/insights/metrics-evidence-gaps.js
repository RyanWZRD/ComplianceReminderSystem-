import { parseDateAtMidnight } from "../../data/dates.js";

/** @typedef {import("./insights-engine.js").NormalizedComplianceRow} NormalizedComplianceRow */
/** @typedef {import("./insights-engine.js").InsightsContext} InsightsContext */

export const EVIDENCE_GAP_TIERS = {
  CRITICAL: "critical",
  HIGH: "high",
  STALE: "stale",
  OK: "ok",
};

export const EVIDENCE_GAP_CRITICAL_DAYS = 30;
export const EVIDENCE_GAP_HIGH_MIN_DAYS = 31;
export const EVIDENCE_GAP_HIGH_MAX_DAYS = 90;

const RECOMMENDED_ACTIONS = {
  [EVIDENCE_GAP_TIERS.CRITICAL]:
    "Upload evidence immediately — renewal is due within 30 days or overdue.",
  [EVIDENCE_GAP_TIERS.HIGH]:
    "Add evidence before renewal — record expires within 90 days with nothing on file.",
  [EVIDENCE_GAP_TIERS.STALE]:
    "Refresh evidence — newest documentation is more than 12 months old.",
  [EVIDENCE_GAP_TIERS.OK]: "No action required — evidence is current.",
};

const TIER_SORT_ORDER = {
  [EVIDENCE_GAP_TIERS.CRITICAL]: 0,
  [EVIDENCE_GAP_TIERS.HIGH]: 1,
  [EVIDENCE_GAP_TIERS.STALE]: 2,
  [EVIDENCE_GAP_TIERS.OK]: 3,
};

/**
 * @param {NormalizedComplianceRow} row
 * @returns {object[]}
 */
function getEvidenceItems(row) {
  return Array.isArray(row.evidence) ? row.evidence : [];
}

/**
 * @param {object[]} evidenceItems
 * @returns {string}
 */
export function getNewestEvidenceDate(evidenceItems) {
  let newestDate = "";

  evidenceItems.forEach((item) => {
    const parsed = parseDateAtMidnight(item.addedDate);

    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    if (!newestDate) {
      newestDate = item.addedDate;
      return;
    }

    const currentNewest = parseDateAtMidnight(newestDate);

    if (!Number.isNaN(currentNewest.getTime()) && parsed.getTime() > currentNewest.getTime()) {
      newestDate = item.addedDate;
    }
  });

  return newestDate;
}

/**
 * @param {object[]} evidenceItems
 * @param {InsightsContext} ctx
 * @returns {boolean}
 */
function hasNonStaleEvidence(evidenceItems, ctx) {
  return evidenceItems.some((item) => !ctx.isEvidenceStale(item.addedDate));
}

/**
 * @param {object[]} evidenceItems
 * @param {InsightsContext} ctx
 * @returns {boolean}
 */
function allEvidenceStale(evidenceItems, ctx) {
  return (
    evidenceItems.length > 0 &&
    evidenceItems.every((item) => ctx.isEvidenceStale(item.addedDate))
  );
}

/**
 * Classify a record into an evidence gap tier. Returns null when the record
 * does not match any tier (e.g. missing evidence with an invalid expiry date).
 *
 * @param {NormalizedComplianceRow} row
 * @param {InsightsContext} ctx
 * @returns {string|null}
 */
export function classifyEvidenceGapTier(row, ctx) {
  const evidenceItems = getEvidenceItems(row);

  if (hasNonStaleEvidence(evidenceItems, ctx)) {
    return EVIDENCE_GAP_TIERS.OK;
  }

  const daysUntilExpiry = ctx.getDaysUntilExpiry(row.expiryDate);
  const noEvidence = evidenceItems.length === 0;
  const isExpiredOrWithin30 =
    !Number.isNaN(daysUntilExpiry) && daysUntilExpiry <= EVIDENCE_GAP_CRITICAL_DAYS;
  const isWithin31to90 =
    !Number.isNaN(daysUntilExpiry) &&
    daysUntilExpiry >= EVIDENCE_GAP_HIGH_MIN_DAYS &&
    daysUntilExpiry <= EVIDENCE_GAP_HIGH_MAX_DAYS;

  if (isExpiredOrWithin30 && (noEvidence || allEvidenceStale(evidenceItems, ctx))) {
    return EVIDENCE_GAP_TIERS.CRITICAL;
  }

  if (isWithin31to90 && noEvidence) {
    return EVIDENCE_GAP_TIERS.HIGH;
  }

  if (evidenceItems.length > 0) {
    const newestDate = getNewestEvidenceDate(evidenceItems);

    if (newestDate && ctx.isEvidenceStale(newestDate)) {
      return EVIDENCE_GAP_TIERS.STALE;
    }
  }

  return null;
}

/**
 * @param {string} tier
 * @returns {string}
 */
export function getEvidenceGapRecommendedAction(tier) {
  return RECOMMENDED_ACTIONS[tier] || "";
}

/**
 * @param {NormalizedComplianceRow} row
 * @param {InsightsContext} ctx
 * @returns {object}
 */
export function mapEvidenceGapRecord(row, ctx) {
  const tier = classifyEvidenceGapTier(row, ctx);
  const evidenceItems = getEvidenceItems(row);
  const status = ctx.getExpiryStatus(row.expiryDate);

  return {
    name: row.name,
    role: row.role,
    complianceType: row.complianceType,
    expiryDate: row.expiryDate,
    status: status.label,
    evidenceCount: evidenceItems.length,
    newestEvidenceDate: getNewestEvidenceDate(evidenceItems),
    gapTier: tier,
    recommendedAction: tier ? getEvidenceGapRecommendedAction(tier) : "",
  };
}

/**
 * @param {NormalizedComplianceRow[]} rows
 * @param {InsightsContext} ctx
 */
export function computeEvidenceGaps(rows, ctx) {
  const byTier = {
    [EVIDENCE_GAP_TIERS.CRITICAL]: 0,
    [EVIDENCE_GAP_TIERS.HIGH]: 0,
    [EVIDENCE_GAP_TIERS.STALE]: 0,
    [EVIDENCE_GAP_TIERS.OK]: 0,
  };

  /** @type {ReturnType<typeof mapEvidenceGapRecord>[]} */
  const records = [];

  rows.forEach((row) => {
    const mapped = mapEvidenceGapRecord(row, ctx);

    if (!mapped.gapTier) {
      return;
    }

    byTier[mapped.gapTier] += 1;
    records.push(mapped);
  });

  records.sort((left, right) => {
    const tierCompare = TIER_SORT_ORDER[left.gapTier] - TIER_SORT_ORDER[right.gapTier];

    if (tierCompare !== 0) {
      return tierCompare;
    }

    return left.name.localeCompare(right.name);
  });

  return { byTier, records };
}

/**
 * @param {NormalizedComplianceRow[]} rows
 * @param {string} tier
 * @param {InsightsContext} ctx
 * @returns {NormalizedComplianceRow[]}
 */
export function filterRecordsByEvidenceGapTier(rows, tier, ctx) {
  return rows.filter((row) => classifyEvidenceGapTier(row, ctx) === tier);
}
