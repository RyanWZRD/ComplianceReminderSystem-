/**
 * @param {import("./insights-engine.js").NormalizedComplianceRow[]} rows
 * @param {import("./insights-engine.js").InsightsContext} ctx
 */
export function computeRenewalForecast(rows, ctx) {
  let expiringThisMonth = 0;
  let expiringNextMonth = 0;
  let expiringWithin30Days = 0;
  let expiringWithin60Days = 0;
  let expiringWithin90Days = 0;
  let renewalDueSoon = 0;
  let renewalOverdue = 0;
  let reminderWindow30 = 0;
  let reminderWindow14 = 0;
  let reminderWindow7 = 0;

  rows.forEach((row) => {
    const status = ctx.getExpiryStatus(row.expiryDate);
    const daysRemaining = ctx.getDaysUntilExpiry(row.expiryDate);

    if (status.key === "expired") {
      renewalOverdue += 1;
    } else if (status.key === "dueSoon") {
      renewalDueSoon += 1;
    }

    if (status.key !== "expired" && ctx.isExpiryInMonthRange(row.expiryDate, 0)) {
      expiringThisMonth += 1;
    }

    if (ctx.isExpiryInMonthRange(row.expiryDate, 1)) {
      expiringNextMonth += 1;
    }

    if (Number.isNaN(daysRemaining) || daysRemaining < 0) {
      return;
    }

    if (daysRemaining <= 30) {
      expiringWithin30Days += 1;
    }
    if (daysRemaining <= 60) {
      expiringWithin60Days += 1;
    }
    if (daysRemaining <= 90) {
      expiringWithin90Days += 1;
    }

    if (ctx.settings.days30 && daysRemaining <= 30) {
      reminderWindow30 += 1;
    }
    if (ctx.settings.days14 && daysRemaining <= 14) {
      reminderWindow14 += 1;
    }
    if (ctx.settings.days7 && daysRemaining <= 7) {
      reminderWindow7 += 1;
    }
  });

  return {
    expiringThisMonth,
    expiringNextMonth,
    expiringWithin30Days,
    expiringWithin60Days,
    expiringWithin90Days,
    renewalDueSoon,
    renewalOverdue,
    reminderWindows: {
      days30: reminderWindow30,
      days14: reminderWindow14,
      days7: reminderWindow7,
    },
  };
}
