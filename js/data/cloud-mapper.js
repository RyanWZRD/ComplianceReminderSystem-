/**
 * Maps flat Supabase rows into the nested shape expected by LocalComplianceStore normalizers.
 * Internal to the data layer — import from cloud-store.js only.
 */

/**
 * @typedef {Object} PeopleRow
 * @property {string} id
 * @property {string} name
 * @property {string} role
 */

/**
 * @typedef {Object} ComplianceRecordRow
 * @property {string} id
 * @property {string} person_id
 * @property {string} compliance_type
 * @property {string} expiry_date
 * @property {string} renewal_cycle
 * @property {string} notes
 */

/**
 * @typedef {Object} HistoryRow
 * @property {string} id
 * @property {string} record_id
 * @property {string} action
 * @property {string} description
 * @property {string} created_at
 * @property {string | null} [actor_id]
 * @property {string | null} [actor_display_name]
 */

/**
 * @typedef {Object} EvidenceRow
 * @property {string} id
 * @property {string} record_id
 * @property {string} name
 * @property {string} document_type
 * @property {string} added_date
 * @property {string} notes
 * @property {string | null} [file_name]
 */

/**
 * @typedef {Object} ActionRow
 * @property {string} id
 * @property {string} record_id
 * @property {string} title
 * @property {string} status
 * @property {boolean} completed
 * @property {string | null} [due_date]
 * @property {string} owner
 * @property {string} notes
 * @property {string} created_at
 * @property {string | null} [completed_at]
 */

/**
 * @typedef {Object} DeletedSnapshotRow
 * @property {string} id
 * @property {string} deleted_at
 * @property {string} person_name
 * @property {string} person_role
 * @property {object} record_snapshot
 */

/**
 * @param {string | null | undefined} dateValue
 * @returns {string}
 */
function toDateString(dateValue) {
  if (typeof dateValue !== "string" || !dateValue.trim()) {
    return "";
  }

  return dateValue.trim().slice(0, 10);
}

/**
 * @param {string | null | undefined} timestamp
 * @returns {string}
 */
function toIsoTimestamp(timestamp) {
  if (typeof timestamp !== "string" || !timestamp.trim()) {
    return new Date().toISOString();
  }

  return timestamp;
}

/**
 * @param {PeopleRow[]} peopleRows
 * @param {ComplianceRecordRow[]} recordRows
 * @param {HistoryRow[]} historyRows
 * @param {EvidenceRow[]} evidenceRows
 * @param {ActionRow[]} actionRows
 * @returns {Array<{ id: string; name: string; role: string; complianceRecords: object[] }>}
 */
export function buildPeopleTree(
  peopleRows,
  recordRows,
  historyRows,
  evidenceRows,
  actionRows
) {
  const historyByRecord = groupByRecordId(historyRows);
  const evidenceByRecord = groupByRecordId(evidenceRows);
  const actionsByRecord = groupByRecordId(actionRows);

  const recordsByPerson = new Map();

  for (const record of recordRows) {
    const list = recordsByPerson.get(record.person_id) || [];
    list.push(mapComplianceRecord(record, historyByRecord, evidenceByRecord, actionsByRecord));
    recordsByPerson.set(record.person_id, list);
  }

  return peopleRows.map((person) => ({
    id: person.id,
    name: person.name,
    role: person.role,
    complianceRecords: recordsByPerson.get(person.id) || [],
  }));
}

/**
 * @template {{ record_id: string }} T
 * @param {T[]} rows
 * @returns {Map<string, T[]>}
 */
function groupByRecordId(rows) {
  const map = new Map();

  for (const row of rows) {
    const list = map.get(row.record_id) || [];
    list.push(row);
    map.set(row.record_id, list);
  }

  return map;
}

/**
 * @param {ComplianceRecordRow} record
 * @param {Map<string, HistoryRow[]>} historyByRecord
 * @param {Map<string, EvidenceRow[]>} evidenceByRecord
 * @param {Map<string, ActionRow[]>} actionsByRecord
 */
function mapComplianceRecord(record, historyByRecord, evidenceByRecord, actionsByRecord) {
  const history = (historyByRecord.get(record.id) || [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(mapHistoryEntry);

  const evidence = (evidenceByRecord.get(record.id) || []).map(mapEvidenceItem);
  const actions = (actionsByRecord.get(record.id) || []).map(mapActionItem);

  return {
    id: record.id,
    complianceType: record.compliance_type,
    expiryDate: toDateString(record.expiry_date),
    renewalCycle: record.renewal_cycle,
    notes: record.notes ?? "",
    history,
    evidence,
    actions,
  };
}

/**
 * @param {HistoryRow} row
 */
function mapHistoryEntry(row) {
  /** @type {Record<string, string>} */
  const entry = {
    id: row.id,
    action: row.action,
    timestamp: toIsoTimestamp(row.created_at),
    description: row.description ?? "",
  };

  if (typeof row.actor_id === "string" && row.actor_id.trim()) {
    entry.userId = row.actor_id;
  }

  if (typeof row.actor_display_name === "string" && row.actor_display_name.trim()) {
    entry.userDisplayName = row.actor_display_name;
  }

  return entry;
}

/**
 * @param {EvidenceRow} row
 */
function mapEvidenceItem(row) {
  return {
    id: row.id,
    name: row.name,
    documentType: row.document_type,
    addedDate: toDateString(row.added_date),
    notes: row.notes ?? "",
    fileName: row.file_name ?? null,
    fileData: null,
  };
}

/**
 * @param {ActionRow} row
 */
function mapActionItem(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    completed: row.completed === true,
    dueDate: row.due_date ? toDateString(row.due_date) : null,
    owner: row.owner ?? "",
    notes: row.notes ?? "",
    createdAt: toIsoTimestamp(row.created_at),
    completedAt: row.completed_at ? toIsoTimestamp(row.completed_at) : null,
  };
}

/**
 * @param {DeletedSnapshotRow[]} rows
 * @returns {Array<{ deletedAt: string; personName: string; personRole: string; record: object }>}
 */
export function mapDeletedSnapshots(rows) {
  return rows.map((row) => ({
    deletedAt: toIsoTimestamp(row.deleted_at),
    personName: row.person_name,
    personRole: row.person_role,
    record:
      row.record_snapshot && typeof row.record_snapshot === "object"
        ? row.record_snapshot
        : {},
  }));
}
