import { APP_VERSION } from "./config.js";
import {
  BACKUP_VERSION,
  COMPLIANCE_TYPES,
  DEFAULT_COMPLIANCE_TYPE,
  DEFAULT_RENEWAL_CYCLE,
  EVIDENCE_TYPES,
  HISTORY_ACTIONS,
  RENEWAL_CYCLE_MANUAL,
  RENEWAL_CYCLE_OPTIONS,
  STORAGE_KEY,
} from "./constants.js";
import {
  dateToISOString,
  getTodayAtMidnight,
  isValidExpiryDate,
  normalizeExpiryDate,
} from "./dates.js";

export class LocalComplianceStore {
  constructor() {
    this.people = [];
    this.nextPersonId = 21;
    this.nextRecordId = 1000;
    this.nextHistoryEntryId = 1;
    this.nextEvidenceId = 1;
    this.nextActionId = 1;
    this.deletedRecordHistory = [];
  }

  get backend() {
    return "local";
  }

  save() {
    const data = {
      people: this.people,
      nextPersonId: this.nextPersonId,
      nextRecordId: this.nextRecordId,
      deletedRecordHistory: this.deletedRecordHistory,
      nextHistoryEntryId: this.nextHistoryEntryId,
      nextEvidenceId: this.nextEvidenceId,
      nextActionId: this.nextActionId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  load({ onLoadError } = {}) {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === null) {
      return { ok: true, usedSample: false, isFirstVisit: true };
    }

    try {
      const data = JSON.parse(saved);

      if (!this.isValidStoredData(data)) {
        throw new Error("Stored data is invalid");
      }

      this.nextPersonId = data.nextPersonId || data.nextId;
      this.nextRecordId = data.nextRecordId || 1000;
      this.people = data.people.map((person) => this.normalizePerson(person));
      this.deletedRecordHistory = Array.isArray(data.deletedRecordHistory)
        ? data.deletedRecordHistory
        : [];
      this.nextHistoryEntryId =
        typeof data.nextHistoryEntryId === "number" ? data.nextHistoryEntryId : 1;
      this.nextEvidenceId =
        typeof data.nextEvidenceId === "number" ? data.nextEvidenceId : 1;
      this.nextActionId = typeof data.nextActionId === "number" ? data.nextActionId : 1;
      this.syncAllIds();
      this.save();
      return { ok: true, usedSample: false, isFirstVisit: false };
    } catch (error) {
      if (typeof onLoadError === "function") {
        onLoadError(error);
      }

      return { ok: false, usedSample: true, isFirstVisit: false, error };
    }
  }

  buildBackup() {
    return {
      backupVersion: BACKUP_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      people: this.people,
      nextPersonId: this.nextPersonId,
      nextRecordId: this.nextRecordId,
      nextHistoryEntryId: this.nextHistoryEntryId,
      nextEvidenceId: this.nextEvidenceId,
      nextActionId: this.nextActionId,
      deletedRecordHistory: this.deletedRecordHistory,
    };
  }

  countBackupRecords(backupPeople) {
    if (!Array.isArray(backupPeople)) {
      return 0;
    }

    return backupPeople.reduce((total, person) => {
      if (Array.isArray(person.complianceRecords)) {
        return total + person.complianceRecords.length;
      }

      if (this.isLegacyPerson(person)) {
        return total + 1;
      }

      return total;
    }, 0);
  }

  isValidBackupData(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    if (typeof data.backupVersion !== "number" && typeof data.appVersion !== "string") {
      return false;
    }

    if (!Array.isArray(data.people) || data.people.length === 0) {
      return false;
    }

    return this.isValidStoredData({
      people: data.people,
      nextPersonId: data.nextPersonId || data.nextId,
      nextRecordId: data.nextRecordId || 1000,
    });
  }

  validateBackupDryRun(data) {
    const result = {
      valid: false,
      recordCount: 0,
      personCount: 0,
      appVersion: null,
      exportedAt: null,
      errors: [],
      warnings: [],
    };

    if (!data || typeof data !== "object") {
      result.errors.push("Backup file is not a valid JSON object.");
      return result;
    }

    result.appVersion = typeof data.appVersion === "string" ? data.appVersion : null;
    result.exportedAt = typeof data.exportedAt === "string" ? data.exportedAt : null;

    if (!Array.isArray(data.people)) {
      result.errors.push("Backup is missing a people array.");
      return result;
    }

    if (data.people.length === 0) {
      result.errors.push("Backup contains no people.");
      return result;
    }

    result.personCount = data.people.length;
    result.recordCount = this.countBackupRecords(data.people);

    if (!this.isValidBackupData(data)) {
      result.errors.push(
        "Backup structure failed validation (check names, roles, compliance types, and expiry dates)."
      );
      return result;
    }

    if (result.appVersion && result.appVersion !== APP_VERSION) {
      result.warnings.push(
        `Backup was exported from app version ${result.appVersion}; current version is ${APP_VERSION}.`
      );
    }

    result.valid = true;
    return result;
  }

  applyBackup(data) {
    this.nextPersonId = data.nextPersonId || data.nextId || 1;
    this.nextRecordId = data.nextRecordId || 1000;
    this.nextHistoryEntryId =
      typeof data.nextHistoryEntryId === "number" ? data.nextHistoryEntryId : 1;
    this.nextEvidenceId = typeof data.nextEvidenceId === "number" ? data.nextEvidenceId : 1;
    this.nextActionId = typeof data.nextActionId === "number" ? data.nextActionId : 1;
    this.deletedRecordHistory = Array.isArray(data.deletedRecordHistory)
      ? data.deletedRecordHistory
      : [];
    this.people = data.people.map((person) => this.normalizePerson(person));
    this.syncAllIds();
    this.save();
  }

  syncAllIds() {
    this.syncNextHistoryEntryId();
    this.syncNextEvidenceId();
    this.syncNextActionId();
  }

  isLegacyPerson(person) {
    return (
      !Array.isArray(person.complianceRecords) &&
      (typeof person.dbsExpiry === "string" || typeof person.expiryDate === "string")
    );
  }

  normalizeComplianceType(value) {
    if (COMPLIANCE_TYPES.includes(value)) {
      return value;
    }

    return DEFAULT_COMPLIANCE_TYPE;
  }

  normalizeRenewalCycle(value) {
    const normalized = String(value || RENEWAL_CYCLE_MANUAL).trim().toLowerCase();
    const match = RENEWAL_CYCLE_OPTIONS.find(
      (option) =>
        option.value === normalized ||
        option.label.toLowerCase() === normalized ||
        option.label.toLowerCase().replace(/\s+/g, "-") === normalized
    );

    return match ? match.value : RENEWAL_CYCLE_MANUAL;
  }

  createComplianceRecord(data, recordId) {
    const complianceType = this.normalizeComplianceType(data.complianceType);

    return {
      id: recordId,
      complianceType,
      expiryDate: normalizeExpiryDate(data.expiryDate || data.dbsExpiry),
      notes: typeof data.notes === "string" ? data.notes : "",
      renewalCycle: this.normalizeRenewalCycle(
        data.renewalCycle !== undefined ? data.renewalCycle : RENEWAL_CYCLE_MANUAL
      ),
      history: Array.isArray(data.history) ? data.history : [],
      evidence: Array.isArray(data.evidence) ? data.evidence : [],
      actions: Array.isArray(data.actions) ? data.actions : [],
    };
  }

  migrateLegacyPerson(person, recordId) {
    return {
      id: person.id,
      name: person.name,
      role: person.role,
      complianceRecords: [this.createComplianceRecord(person, recordId)],
    };
  }

  normalizeHistoryEntry(entry) {
    return {
      id: typeof entry.id === "number" ? entry.id : this.nextHistoryEntryId++,
      action:
        typeof entry.action === "string" ? entry.action : HISTORY_ACTIONS.EDITED,
      timestamp:
        typeof entry.timestamp === "string"
          ? entry.timestamp
          : new Date().toISOString(),
      description: typeof entry.description === "string" ? entry.description : "",
    };
  }

  normalizeDocumentType(value) {
    const text = String(value || "").trim();
    const match = EVIDENCE_TYPES.find(
      (type) => type.toLowerCase() === text.toLowerCase()
    );

    return match || EVIDENCE_TYPES[0];
  }

  normalizeEvidenceItem(item) {
    return {
      id: typeof item.id === "number" ? item.id : this.nextEvidenceId++,
      name: typeof item.name === "string" ? item.name.trim() : "",
      documentType: this.normalizeDocumentType(item.documentType),
      addedDate:
        normalizeExpiryDate(item.addedDate) || dateToISOString(getTodayAtMidnight()),
      notes: typeof item.notes === "string" ? item.notes : "",
      fileName:
        typeof item.fileName === "string" && item.fileName.trim()
          ? item.fileName.trim()
          : null,
      fileData:
        typeof item.fileData === "string" && item.fileData.trim()
          ? item.fileData.trim()
          : null,
    };
  }

  normalizeEvidenceList(evidence) {
    if (!Array.isArray(evidence)) {
      return [];
    }

    return evidence.map((item) => this.normalizeEvidenceItem(item));
  }

  normalizeActionItem(item) {
    return {
      id: typeof item.id === "number" ? item.id : this.nextActionId++,
      title: typeof item.title === "string" ? item.title.trim() : "",
      completed: item.completed === true,
      createdAt:
        typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      completedAt:
        typeof item.completedAt === "string" && item.completedAt
          ? item.completedAt
          : null,
      notes: typeof item.notes === "string" ? item.notes : "",
    };
  }

  normalizeActionsList(actions) {
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions.map((item) => this.normalizeActionItem(item));
  }

  normalizePerson(person) {
    if (this.isLegacyPerson(person)) {
      const recordId = this.nextRecordId;
      this.nextRecordId += 1;
      return this.migrateLegacyPerson(person, recordId);
    }

    return {
      id: person.id,
      name: person.name,
      role: person.role,
      complianceRecords: (person.complianceRecords || []).map((record) => ({
        id: record.id,
        complianceType: this.normalizeComplianceType(record.complianceType),
        expiryDate: normalizeExpiryDate(record.expiryDate || record.dbsExpiry),
        notes: typeof record.notes === "string" ? record.notes : "",
        renewalCycle: this.normalizeRenewalCycle(record.renewalCycle),
        history: (record.history || []).map((entry) => this.normalizeHistoryEntry(entry)),
        evidence: this.normalizeEvidenceList(record.evidence),
        actions: this.normalizeActionsList(record.actions),
      })),
    };
  }

  isValidStoredData(data) {
    if (!data || !Array.isArray(data.people)) {
      return false;
    }

    const hasPersonIds =
      typeof data.nextPersonId === "number" || typeof data.nextId === "number";

    if (!hasPersonIds) {
      return false;
    }

    return data.people.every((person) => {
      if (
        typeof person.id !== "number" ||
        typeof person.name !== "string" ||
        person.name.trim() === "" ||
        typeof person.role !== "string" ||
        person.role.trim() === ""
      ) {
        return false;
      }

      if (this.isLegacyPerson(person)) {
        const expiry = person.expiryDate || person.dbsExpiry;
        return (
          typeof expiry === "string" &&
          isValidExpiryDate(normalizeExpiryDate(expiry))
        );
      }

      if (!Array.isArray(person.complianceRecords) || person.complianceRecords.length === 0) {
        return false;
      }

      return person.complianceRecords.every(
        (record) =>
          typeof record.id === "number" &&
          COMPLIANCE_TYPES.includes(this.normalizeComplianceType(record.complianceType)) &&
          typeof (record.expiryDate || record.dbsExpiry) === "string" &&
          isValidExpiryDate(normalizeExpiryDate(record.expiryDate || record.dbsExpiry)) &&
          (record.notes === undefined || typeof record.notes === "string")
      );
    });
  }

  syncNextHistoryEntryId() {
    let maxId = 0;

    this.people.forEach((person) => {
      person.complianceRecords.forEach((record) => {
        (record.history || []).forEach((entry) => {
          if (typeof entry.id === "number" && entry.id > maxId) {
            maxId = entry.id;
          }
        });
      });
    });

    this.deletedRecordHistory.forEach((item) => {
      (item.record?.history || []).forEach((entry) => {
        if (typeof entry.id === "number" && entry.id > maxId) {
          maxId = entry.id;
        }
      });
    });

    if (maxId >= this.nextHistoryEntryId) {
      this.nextHistoryEntryId = maxId + 1;
    }
  }

  syncNextEvidenceId() {
    let maxId = 0;

    this.people.forEach((person) => {
      person.complianceRecords.forEach((record) => {
        (record.evidence || []).forEach((item) => {
          if (typeof item.id === "number" && item.id > maxId) {
            maxId = item.id;
          }
        });
      });
    });

    this.deletedRecordHistory.forEach((item) => {
      (item.record?.evidence || []).forEach((evidenceItem) => {
        if (typeof evidenceItem.id === "number" && evidenceItem.id > maxId) {
          maxId = evidenceItem.id;
        }
      });
    });

    if (maxId >= this.nextEvidenceId) {
      this.nextEvidenceId = maxId + 1;
    }
  }

  syncNextActionId() {
    let maxId = 0;

    this.people.forEach((person) => {
      person.complianceRecords.forEach((record) => {
        (record.actions || []).forEach((item) => {
          if (typeof item.id === "number" && item.id > maxId) {
            maxId = item.id;
          }
        });
      });
    });

    this.deletedRecordHistory.forEach((item) => {
      (item.record?.actions || []).forEach((actionItem) => {
        if (typeof actionItem.id === "number" && actionItem.id > maxId) {
          maxId = actionItem.id;
        }
      });
    });

    if (maxId >= this.nextActionId) {
      this.nextActionId = maxId + 1;
    }
  }
}
