# Compliance Insights (V4 — in development)

The **Compliance Insights** dashboard section provides a read-only, rule-based view of register health. It runs entirely in the browser from loaded compliance rows — no AI/LLM, no Supabase RPC calls, and no cloud-write behaviour.

Application version is **v4.0.0-alpha** for the Compliance Insights MVP alpha milestone.

## Overview

| Area | Module | Purpose |
|------|--------|---------|
| Insights engine | `js/app/insights/insights-engine.js` | Normalizes rows and computes all metrics |
| Health metrics | `js/app/insights/metrics-health.js` | Expiry, evidence, action, and composite scores |
| Operational health | `js/app/insights/metrics-operational.js` | Reminder follow-up score for active reminder windows |
| Risk summary | `js/app/insights/metrics-risk.js` | At-risk counts for drilldown tiles |
| Evidence gaps | `js/app/insights/metrics-evidence-gaps.js` | Tiered evidence gap analysis |
| Renewal forecast | `js/app/insights/metrics-forecast.js` | Expiry windows and reminder counts |
| Recommendations | `js/app/insights/recommendations-engine.js` | Prioritized suggested actions |
| Drilldowns | `js/app/insights/compliance-insights-drilldowns.js` | Filters and preview tables |
| Export pack | `js/app/insights/insights-export.js` | Summary and drilldown preview CSV builders |
| Dashboard wiring | `js/app/insights/compliance-insights.js`, `app.js` | Cache, legacy metric mappings, UI |

Verification (no live browser login or Supabase required):

```powershell
npm run verify-insights-engine
npm run verify-insights-browser
```

| Script | What it checks |
|--------|----------------|
| `verify-insights-engine` | Insight calculations, dashboard mappings, drilldown counts, recommendations, and CSV export helpers using fixture rows |
| `verify-insights-browser` | Static DOM wiring in `index.html`, `app.js` element bindings and click handlers, and built `app.bundle.js` export/render symbols |

The browser smoke pack catches regressions such as missing section cards, export buttons, empty-state elements, or broken drilldown preview wiring without mutating `localStorage` or requiring cloud data.

## Compliance Insights section

The **Compliance Insights** card on the dashboard is organised into six sections, each with a heading and short helper text:

| Section | Purpose |
|---------|---------|
| **Health Overview** | Composite Compliance Health Score plus expiry, evidence, and action sub-scores (operational health has its own section below) |
| **Key Risks** | Clickable tiles for expired records, evidence problems, overdue actions, and expired records with active actions |
| **Evidence Gaps** | Tiered evidence gap tiles (critical, high, stale) |
| **Renewal Forecast** | Clickable tiles for upcoming expiry windows |
| **Recommendations** | Prioritised suggested actions linked to drilldown previews |
| **Operational Health** | Reminder follow-up score, summary counts, and a drilldown tile for missing follow-up |

Below the sections, a **preview panel** opens when you select a tile or recommendation. It shows a clear title (`Preview: …`), record/action count, explanation text, the filtered table, and CSV export.

In cloud mode, evidence health uses metadata only (document name, type, dates) — file attachments are not uploaded to Storage in v4.0.0-alpha.

### Section empty states

When a section has nothing to report, a green empty-state message replaces the tile row (operational health always shows the score summary):

| Section | Empty state (shown when…) |
|---------|---------------------------|
| **Key Risks** | All risk counts are zero |
| **Evidence Gaps** | Critical, high, and stale tier counts are all zero |
| **Renewal Forecast** | All forecast window counts are zero |
| **Recommendations** | `generateComplianceRecommendations()` returns no items |
| **Operational Health** | No records are missing reminder follow-up (score summary remains visible) |

The register-level empty state (*No compliance records yet…*) still appears when `recordCount === 0`.

### Drilldown preview UX

Each drilldown preview includes:

- **Title** — `Preview: {drilldown title}` for clarity
- **Count** — prominent record or action count
- **Meta line** — generation timestamp and count summary
- **Explanation** — short `previewDescription` text describing what the filter means
- **Table** — existing preview columns unchanged
- **CSV export** — unchanged

Recommendation items show **priority badges** (Critical, High priority, Medium, Low) using existing CSS colour classes — no icons or new assets.

## Export pack (V4-3C)

Compliance Insights supports read-only CSV exports from the section header and drilldown preview panel. Exports use **computed insight data only** — they do not create, update, or delete records, actions, evidence, settings, or history.

| Export | Button | When available | Filename pattern |
|--------|--------|----------------|------------------|
| **Insights summary** | Export Insights Summary | Register has at least one compliance record | `compliance-insights-summary-YYYY-MM-DD.csv` |
| **Drilldown preview** | Export Drilldown Preview | A drilldown preview is open (header button and preview panel button) | `compliance-insights-drilldown-{type}-YYYY-MM-DD.csv` |

### Insights summary export

Downloads a single CSV with metadata and counts from the current dashboard refresh:

- Generated date/time and insights as-of date
- Composite health score and band (High / Medium / Low)
- Expiry, evidence, action, and operational health sub-scores
- Key risk counts (expired, missing evidence, stale evidence, overdue actions, expired with active actions)
- Evidence gap tier counts (critical, high, stale)
- Renewal forecast counts (this month, next month, within 30 days, within 90 days)
- Operational health summary (records in windows, with follow-up, missing follow-up, note)
- Recommendations table with priority, title, and action text (description)

The summary export does **not** include raw record notes, evidence file content, or other sensitive fields beyond what is already shown in the Compliance Insights UI.

### Drilldown preview export

Exports the **currently open** drilldown preview using the same preview columns shown in the table (name, role, compliance type, expiry, status, evidence counts, action fields, etc.). The CSV includes a short header block (insight title, generated time, row count) followed by the preview data rows.

Both drilldown export buttons (section header and preview panel) call the same export helper and produce identical output for the active preview.

Implementation: `js/app/insights/insights-export.js` (`buildComplianceInsightsSummaryCsv`, `buildComplianceInsightDrilldownCsv`).

## Health score

The composite **Compliance Health Score** is the rounded average of four dimension scores:

```
compositeHealthScore = recordCount === 0 ? 0 : round((expiry + evidence + action + operational) / 4)
```

When the register is **empty** (`recordCount === 0`), the composite score is **0%** so the UI empty-state message is shown instead of a misleading partial average.

| Dimension | Score formula |
|-----------|---------------|
| **Expiry health** | Valid records ÷ scorable records × 100 (invalid expiry dates excluded from the denominator) |
| **Evidence health** | Records with at least one evidence item ÷ total records × 100 |
| **Action health** | Records without action risk ÷ total records × 100 |
| **Operational health** | Records with reminder follow-up ÷ records in active reminder windows × 100 |

A record has **action risk** when it has overdue actions or active (open/in-progress) actions on an expired record.

**Operational health** measures whether records in active reminder windows have recorded reminder follow-up. It uses the same window logic as the Action Required table (`getReminderForRecord` in `app.js`).

When **no records** are in active reminder windows, operational health is **100%** with the note: *No records are currently in 30-, 14-, or 7-day reminder windows (or expired).*

### Active reminder windows

For each record with a valid expiry date, the engine picks the **most urgent** enabled window (same priority as the reminders table):

1. **Expired** — expiry date is in the past
2. **7-day** — `days7` enabled and ≤ 7 days remaining
3. **14-day** — `days14` enabled and ≤ 14 days remaining
4. **30-day** — `days30` enabled and ≤ 30 days remaining

If none apply, the record is not in an active reminder window.

### Reminder follow-up detection

A record counts as having **reminder activity** for its current window when either:

- **Notes** contain the sent label for that window (via `isReminderTypeMarkedSent` in `js/data/reminder-sent.js`), e.g. `17/06/2026 - 14 Day Reminder Sent`, or
- **History** includes a `reminder_sent` entry whose description contains the sent label, e.g. `14 Day Reminder Sent recorded.`

Only the **current** window’s reminder type is checked — a 30-day sent marker does not satisfy a record now in the 7-day window.

Operational health is displayed in the **Operational Health** section (score, summary line, and missing follow-up drilldown tile) and included in the composite score. The summary shows the percentage plus counts: records in active reminder windows, with recorded follow-up, and missing follow-up. Hover or screen-reader users see the full note via the summary element’s `title` and `aria-label`.

### Missing reminder follow-up drilldown

The **Record reminder follow-up** recommendation opens the `missing-reminder-activity` drilldown. The preview table includes:

| Column | Meaning |
|--------|---------|
| Name / Role / Compliance Type / Expiry Date / Status | Standard record context |
| Reminder Window | Current active window (Expired, 7-, 14-, or 30-day) |
| Reminder Activity Status | **Recorded** when notes or history contain the sent marker for that window; **Missing** otherwise |

The preview includes a short explanation of what “missing reminder activity” means. When no records match, the empty state reads: *No records are missing reminder follow-up.*

### Score bands (UI)

| Composite score | Band label |
|-----------------|------------|
| ≥ 80% | High |
| ≥ 50% | Medium |
| < 50% | Low |

### Shared constants (`insights-engine.js`)

| Constant | Default | Used for |
|----------|---------|----------|
| `DUE_SOON_DAYS` | 90 | Expiry “due soon” status and legacy register mapping |
| `STALE_EVIDENCE_DAYS` | 365 | Evidence considered stale after this many days |
| `EVIDENCE_GAP_CRITICAL_DAYS` | 30 | Expired or expiring within this window triggers critical tier |
| `EVIDENCE_GAP_HIGH_MIN_DAYS` | 31 | Lower bound for high-tier missing-evidence window |
| `EVIDENCE_GAP_HIGH_MAX_DAYS` | 90 | Upper bound for high-tier missing-evidence window |

## Evidence gap tiers

Evidence gaps classify records by urgency using expiry proximity and evidence freshness. Each record is assigned exactly one tier (priority order: critical → high → stale → ok). Records with an invalid expiry date and no evidence are excluded from tier counts when they do not match any rule.

| Tier | Criteria |
|------|----------|
| **Critical** | Record is expired or expires within 30 days, and has no evidence or all evidence is stale |
| **High** | Record expires within 31–90 days and has no evidence |
| **Stale** | Record has evidence but the newest item is older than `STALE_EVIDENCE_DAYS` (and is not already critical or high) |
| **Ok** | Record has at least one non-stale evidence item |

`computeComplianceInsights()` returns an `evidenceGaps` object:

```javascript
{
  byTier: { critical, high, stale, ok },
  records: [
    {
      name, role, complianceType, expiryDate, status,
      evidenceCount, newestEvidenceDate, gapTier, recommendedAction
    }
  ]
}
```

### Evidence gap cards

Three clickable tiles appear in the **Evidence Gaps** section:

| Tile | Drilldown key | Count source |
|------|---------------|--------------|
| Critical evidence gaps | `critical-evidence-gaps` | `evidenceGaps.byTier.critical` |
| High evidence gaps | `high-evidence-gaps` | `evidenceGaps.byTier.high` |
| Stale evidence records | `stale-evidence-records` | `evidenceGaps.byTier.stale` |

Preview tables include evidence count, newest evidence date, gap tier, and recommended action.

### Legacy risk tiles (unchanged)

The **Missing evidence** and **Stale evidence** risk tiles in Risk Summary are unchanged. They use broader counts from `metrics-risk.js`:

| Tile | Counts | Relation to tiers |
|------|--------|-------------------|
| Missing evidence | Records with zero evidence items | Includes records outside critical/high expiry windows (e.g. invalid expiry) |
| Stale evidence | Records where any evidence is older than `STALE_EVIDENCE_DAYS` | Includes records also classified as critical (e.g. expired with all stale evidence) |

Tier-based recommendations replace the former generic missing/stale evidence recommendations.

## Risk summary

**Key Risks** tiles count records or actions that need attention **today**:

| Tile | Counts |
|------|--------|
| Expired records | Records past expiry date |
| Missing evidence | Records with zero evidence items |
| Stale evidence | Records where any evidence is older than `STALE_EVIDENCE_DAYS` |
| Overdue actions | Individual actions past due date (action-level drilldown) |
| Expired records with active actions | Expired records that still have open or in-progress actions |

Clicking a tile opens the preview table filtered to matching rows (or actions for overdue actions).

## Renewal forecast

Forecast tiles project upcoming renewals from expiry dates:

| Tile | Counts |
|------|--------|
| Expiring this month | Non-expired records expiring in the current calendar month |
| Expiring next month | Records expiring in the next calendar month |
| Expiring within 30 days | Records expiring in the next 30 days (inclusive) |
| Expiring within 90 days | Records expiring in the next 90 days (inclusive) |

Reminder window counts (30 / 14 / 7 day settings) are computed in the engine but surfaced through the forecast object for future UI use.

## Recommendations

**Recommendations** are generated by `generateComplianceRecommendations()` from computed insights. Each item includes:

- **Priority** — Critical, High priority, Medium, or Low
- **Title and description** — plain-language summary with affected counts
- **Drilldown link** — same filter as the matching risk or forecast tile

Recommendations are **rule-based only**. There is no AI, LLM, or external API dependency.

### Priority rules

| Priority | Rules (when count > 0, unless threshold applies) |
|----------|--------------------------------------------------|
| **Critical** | Expired records; critical evidence gaps; expired records with active actions |
| **High priority** | Expiring within 30 days (if above threshold); high evidence gaps; missing reminder follow-up; overdue actions |
| **Medium** | Stale evidence records (tier); expiring next month (if above threshold) |

### Threshold constants (`recommendations-engine.js`)

Forecast-related recommendations use **exclusive** count thresholds — a rule fires when the metric is **strictly greater than** the threshold.

| Constant | Default | Effect |
|----------|---------|--------|
| `DEFAULT_RECOMMENDATION_THRESHOLDS.expiringWithin30Days` | `0` | Show “Schedule renewals within 30 days” when count ≥ 1 |
| `DEFAULT_RECOMMENDATION_THRESHOLDS.expiringNextMonth` | `0` | Show “Plan renewals for next month” when count ≥ 1 |

Override thresholds by passing a third argument to `generateComplianceRecommendations(insights, rows, overrides)` — useful for tests or future settings UI.

### Click behaviour

Clicking a recommendation calls the same drilldown preview as clicking the corresponding risk or forecast tile. The active recommendation is highlighted when its drilldown is open.

## No cloud-write changes

Compliance Insights is **read-only**:

- Metrics are derived from rows already loaded by the repository (`localStorage` or Supabase read).
- Drilldown preview supports CSV export of the filtered view only.
- Recommendations do not create, update, or delete records, actions, evidence, or settings.
- No new RPCs, migrations, or permission changes.

Existing cloud-write gates (`canMutateData()`, RPC-first writes) are unchanged.

## Legacy dashboard compatibility (V4-0B)

Some older dashboard cards intentionally use different formulas. See comments in `js/app/insights/compliance-insights.js`:

- Management health score on legacy cards may differ from the V4 composite score.
- Register summary counts treat invalid expiry dates as “valid” for backward compatibility.

## V4 development status

See [ROADMAP.md](../ROADMAP.md#v4--compliance-insights-in-development) for slice progress (V4-0A through V4-3C and beyond).
