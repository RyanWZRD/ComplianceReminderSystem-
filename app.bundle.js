(() => {
  // js/auth/config.js
  var AUTH_MODE = "local";

  // js/auth/session.js
  var LOCAL_SESSION_USER = {
    userId: "local-user",
    displayName: "Local User",
    role: "admin"
  };
  var SUPABASE_PREVIEW_SESSION_USER = {
    userId: "supabase-preview-user",
    displayName: "Preview User",
    role: "admin"
  };
  var currentUser = null;
  function resolveSessionUser() {
    if (AUTH_MODE === "supabase-preview") {
      return { ...SUPABASE_PREVIEW_SESSION_USER };
    }
    return { ...LOCAL_SESSION_USER };
  }
  function formatRoleLabel(role) {
    if (!role || typeof role !== "string") {
      return "\u2014";
    }
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
  function initAuth() {
    currentUser = resolveSessionUser();
    renderHeaderUserBadge();
  }
  function getCurrentUser() {
    return currentUser ? { ...currentUser } : null;
  }
  function renderHeaderUserBadge() {
    const nameEl = document.getElementById("header-user-name");
    const roleEl = document.getElementById("header-user-role");
    const authModeEl = document.getElementById("auth-mode-badge");
    if (!currentUser) {
      if (nameEl) {
        nameEl.textContent = "\u2014";
      }
      if (roleEl) {
        roleEl.textContent = "\u2014";
      }
      return;
    }
    if (nameEl) {
      nameEl.textContent = currentUser.displayName;
    }
    if (roleEl) {
      roleEl.textContent = formatRoleLabel(currentUser.role);
    }
    if (authModeEl) {
      if (AUTH_MODE === "supabase-preview") {
        authModeEl.textContent = "Supabase preview";
        authModeEl.classList.remove("hidden");
      } else {
        authModeEl.classList.add("hidden");
      }
    }
  }

  // js/data/config.js
  var DATA_BACKEND = "local";
  var APP_VERSION = "2.8.0";

  // js/data/constants.js
  var STORAGE_KEY = "complianceReminderPeople";
  var REMINDER_SETTINGS_KEY = "complianceReminderSettings";
  var BACKUP_VERSION = 1;
  var COMPLIANCE_TYPES = [
    "DBS",
    "Basic Awareness",
    "Foundations",
    "Leadership",
    "Senior Leadership",
    "Domestic Abuse",
    "Safer Recruitment",
    "Modern Slavery"
  ];
  var DEFAULT_COMPLIANCE_TYPE = "DBS";
  var RENEWAL_CYCLE_MANUAL = "manual";
  var RENEWAL_CYCLE_OPTIONS = [
    { value: "manual", label: "Manual" },
    { value: "6-months", label: "6 Months" },
    { value: "1-year", label: "1 Year" },
    { value: "2-years", label: "2 Years" },
    { value: "3-years", label: "3 Years" },
    { value: "5-years", label: "5 Years" }
  ];
  var DEFAULT_RENEWAL_CYCLE = "3-years";
  var MAX_EVIDENCE_FILE_BYTES = 512 * 1024;
  var EVIDENCE_TYPES = [
    "DBS Certificate",
    "Training Certificate",
    "Policy Acknowledgement",
    "ID Check",
    "Right to Work",
    "Other"
  ];
  var ACTION_STATUSES = {
    OPEN: "open",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed"
  };
  var ACTION_STATUS_LABELS = {
    open: "Open",
    in_progress: "In Progress",
    completed: "Completed"
  };
  var HISTORY_ACTIONS = {
    CREATED: "created",
    EDITED: "edited",
    REMINDER_SENT: "reminder_sent",
    RENEWED: "renewed",
    DELETED: "deleted",
    EVIDENCE_ADDED: "evidence_added",
    EVIDENCE_DELETED: "evidence_deleted",
    ACTION_ADDED: "action_added",
    ACTION_UPDATED: "action_updated",
    ACTION_COMPLETED: "action_completed",
    ACTION_REOPENED: "action_reopened",
    ACTION_DELETED: "action_deleted"
  };
  var DEFAULT_REMINDER_SETTINGS = {
    days30: true,
    days14: true,
    days7: true,
    hideSentReminders: false
  };

  // js/data/dates.js
  function getTodayAtMidnight() {
    const now = /* @__PURE__ */ new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  function dateToISOString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function normalizeExpiryDate(dateString) {
    if (!dateString) {
      return "";
    }
    const text = String(dateString).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }
    if (text.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(text)) {
      return text.slice(0, 10);
    }
    return text;
  }
  function parseDateAtMidnight(dateString) {
    const normalized = normalizeExpiryDate(dateString);
    const parts = normalized.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return /* @__PURE__ */ new Date(NaN);
    }
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  }
  function isValidExpiryDate(dateString) {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return false;
    }
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  // js/data/local-store.js
  var LocalComplianceStore = class {
    constructor() {
      this.people = [];
      this.nextPersonId = 21;
      this.nextRecordId = 1e3;
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
        nextActionId: this.nextActionId
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
        this.nextRecordId = data.nextRecordId || 1e3;
        this.people = data.people.map((person) => this.normalizePerson(person));
        this.deletedRecordHistory = Array.isArray(data.deletedRecordHistory) ? data.deletedRecordHistory : [];
        this.nextHistoryEntryId = typeof data.nextHistoryEntryId === "number" ? data.nextHistoryEntryId : 1;
        this.nextEvidenceId = typeof data.nextEvidenceId === "number" ? data.nextEvidenceId : 1;
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
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        people: this.people,
        nextPersonId: this.nextPersonId,
        nextRecordId: this.nextRecordId,
        nextHistoryEntryId: this.nextHistoryEntryId,
        nextEvidenceId: this.nextEvidenceId,
        nextActionId: this.nextActionId,
        deletedRecordHistory: this.deletedRecordHistory
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
        nextRecordId: data.nextRecordId || 1e3
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
        warnings: []
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
      this.nextRecordId = data.nextRecordId || 1e3;
      this.nextHistoryEntryId = typeof data.nextHistoryEntryId === "number" ? data.nextHistoryEntryId : 1;
      this.nextEvidenceId = typeof data.nextEvidenceId === "number" ? data.nextEvidenceId : 1;
      this.nextActionId = typeof data.nextActionId === "number" ? data.nextActionId : 1;
      this.deletedRecordHistory = Array.isArray(data.deletedRecordHistory) ? data.deletedRecordHistory : [];
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
      return !Array.isArray(person.complianceRecords) && (typeof person.dbsExpiry === "string" || typeof person.expiryDate === "string");
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
        (option) => option.value === normalized || option.label.toLowerCase() === normalized || option.label.toLowerCase().replace(/\s+/g, "-") === normalized
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
          data.renewalCycle !== void 0 ? data.renewalCycle : RENEWAL_CYCLE_MANUAL
        ),
        history: Array.isArray(data.history) ? data.history : [],
        evidence: Array.isArray(data.evidence) ? data.evidence : [],
        actions: Array.isArray(data.actions) ? data.actions : []
      };
    }
    migrateLegacyPerson(person, recordId) {
      return {
        id: person.id,
        name: person.name,
        role: person.role,
        complianceRecords: [this.createComplianceRecord(person, recordId)]
      };
    }
    normalizeHistoryEntry(entry) {
      const normalized = {
        id: typeof entry.id === "number" ? entry.id : this.nextHistoryEntryId++,
        action: typeof entry.action === "string" ? entry.action : HISTORY_ACTIONS.EDITED,
        timestamp: typeof entry.timestamp === "string" ? entry.timestamp : (/* @__PURE__ */ new Date()).toISOString(),
        description: typeof entry.description === "string" ? entry.description : ""
      };
      if (typeof entry.userId === "string" && entry.userId.trim()) {
        normalized.userId = entry.userId.trim();
      }
      if (typeof entry.userDisplayName === "string" && entry.userDisplayName.trim()) {
        normalized.userDisplayName = entry.userDisplayName.trim();
      }
      return normalized;
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
        addedDate: normalizeExpiryDate(item.addedDate) || dateToISOString(getTodayAtMidnight()),
        notes: typeof item.notes === "string" ? item.notes : "",
        fileName: typeof item.fileName === "string" && item.fileName.trim() ? item.fileName.trim() : null,
        fileData: typeof item.fileData === "string" && item.fileData.trim() ? item.fileData.trim() : null
      };
    }
    normalizeEvidenceList(evidence) {
      if (!Array.isArray(evidence)) {
        return [];
      }
      return evidence.map((item) => this.normalizeEvidenceItem(item));
    }
    normalizeActionItem(item) {
      let status = "open";
      if (typeof item.status === "string" && (item.status === "open" || item.status === "in_progress" || item.status === "completed")) {
        status = item.status;
      } else if (item.completed === true) {
        status = "completed";
      }
      const completed = status === "completed";
      return {
        id: typeof item.id === "number" ? item.id : this.nextActionId++,
        title: typeof item.title === "string" ? item.title.trim() : "",
        status,
        completed,
        dueDate: typeof item.dueDate === "string" && item.dueDate.trim() !== "" ? item.dueDate.trim() : null,
        owner: typeof item.owner === "string" ? item.owner.trim() : "",
        createdAt: typeof item.createdAt === "string" ? item.createdAt : (/* @__PURE__ */ new Date()).toISOString(),
        completedAt: completed && typeof item.completedAt === "string" && item.completedAt ? item.completedAt : null,
        notes: typeof item.notes === "string" ? item.notes : ""
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
          actions: this.normalizeActionsList(record.actions)
        }))
      };
    }
    isValidStoredData(data) {
      if (!data || !Array.isArray(data.people)) {
        return false;
      }
      const hasPersonIds = typeof data.nextPersonId === "number" || typeof data.nextId === "number";
      if (!hasPersonIds) {
        return false;
      }
      return data.people.every((person) => {
        if (typeof person.id !== "number" || typeof person.name !== "string" || person.name.trim() === "" || typeof person.role !== "string" || person.role.trim() === "") {
          return false;
        }
        if (this.isLegacyPerson(person)) {
          const expiry = person.expiryDate || person.dbsExpiry;
          return typeof expiry === "string" && isValidExpiryDate(normalizeExpiryDate(expiry));
        }
        if (!Array.isArray(person.complianceRecords) || person.complianceRecords.length === 0) {
          return false;
        }
        return person.complianceRecords.every(
          (record) => typeof record.id === "number" && COMPLIANCE_TYPES.includes(this.normalizeComplianceType(record.complianceType)) && typeof (record.expiryDate || record.dbsExpiry) === "string" && isValidExpiryDate(normalizeExpiryDate(record.expiryDate || record.dbsExpiry)) && (record.notes === void 0 || typeof record.notes === "string")
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
  };

  // js/data/settings-store.js
  var LocalSettingsStore = class {
    constructor() {
      this.settings = { ...DEFAULT_REMINDER_SETTINGS };
    }
    get backend() {
      return "local";
    }
    load() {
      const saved = localStorage.getItem(REMINDER_SETTINGS_KEY);
      if (saved === null) {
        this.settings = { ...DEFAULT_REMINDER_SETTINGS };
        this.save();
        return { ok: true, isDefault: true };
      }
      try {
        const data = JSON.parse(saved);
        this.settings = {
          days30: data.days30 !== false,
          days14: data.days14 !== false,
          days7: data.days7 !== false,
          hideSentReminders: data.hideSentReminders === true
        };
        return { ok: true, isDefault: false };
      } catch (error) {
        this.settings = { ...DEFAULT_REMINDER_SETTINGS };
        this.save();
        return { ok: false, isDefault: true, error };
      }
    }
    save() {
      localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(this.settings));
    }
    getSettings() {
      return this.settings;
    }
    setSettings(nextSettings) {
      this.settings = { ...nextSettings };
      this.save();
    }
  };

  // js/data/repository.js
  var CloudComplianceStore = class {
    get backend() {
      return "cloud";
    }
    throwUnavailable() {
      throw new Error(
        "Cloud data backend is not configured yet. Set DATA_BACKEND to 'local' in js/data/config.js."
      );
    }
    get people() {
      this.throwUnavailable();
    }
    set people(_value) {
      this.throwUnavailable();
    }
    save() {
      this.throwUnavailable();
    }
    load() {
      this.throwUnavailable();
    }
    buildBackup() {
      this.throwUnavailable();
    }
    validateBackupDryRun() {
      this.throwUnavailable();
    }
    applyBackup() {
      this.throwUnavailable();
    }
    normalizePerson() {
      this.throwUnavailable();
    }
    normalizeComplianceType() {
      this.throwUnavailable();
    }
    normalizeDocumentType() {
      this.throwUnavailable();
    }
    syncAllIds() {
      this.throwUnavailable();
    }
  };
  var CloudSettingsStore = class {
    get backend() {
      return "cloud";
    }
    load() {
      throw new Error("Cloud settings backend is not configured yet.");
    }
    save() {
      throw new Error("Cloud settings backend is not configured yet.");
    }
    getSettings() {
      throw new Error("Cloud settings backend is not configured yet.");
    }
    setSettings() {
      throw new Error("Cloud settings backend is not configured yet.");
    }
  };
  function createComplianceStore() {
    if (DATA_BACKEND === "cloud") {
      return new CloudComplianceStore();
    }
    return new LocalComplianceStore();
  }
  function createSettingsStore() {
    if (DATA_BACKEND === "cloud") {
      return new CloudSettingsStore();
    }
    return new LocalSettingsStore();
  }
  var repository = createComplianceStore();
  var settingsRepository = createSettingsStore();

  // app.js
  console.log(
    `Compliance Reminder System v${APP_VERSION} \u2014 app.js loaded (${DATA_BACKEND} data, ${AUTH_MODE} auth)`
  );
  var samplePeople = [
    { id: 1, name: "Jane Smith", role: "Team Leader", dbsExpiry: "2026-09-15" },
    { id: 2, name: "John Davies", role: "Support Worker", dbsExpiry: "2026-07-10" },
    { id: 3, name: "Sarah Patel", role: "Care Assistant", dbsExpiry: "2025-11-01" },
    { id: 4, name: "Michael Brown", role: "Administrator", dbsExpiry: "2027-01-22" },
    { id: 5, name: "Emily Wilson", role: "Support Worker", dbsExpiry: "2026-06-20" },
    { id: 6, name: "David Clarke", role: "Manager", dbsExpiry: "2026-10-05" },
    { id: 7, name: "Lisa Nguyen", role: "Care Assistant", dbsExpiry: "2026-03-14" },
    { id: 8, name: "James O'Brien", role: "Support Worker", dbsExpiry: "2026-08-01" },
    { id: 9, name: "Amelia Hughes", role: "Team Leader", dbsExpiry: "2026-12-18" },
    { id: 10, name: "Oliver Wright", role: "Support Worker", dbsExpiry: "2026-05-10" },
    { id: 11, name: "Sophie Turner", role: "Administrator", dbsExpiry: "2026-07-28" },
    { id: 12, name: "Daniel Lee", role: "Care Assistant", dbsExpiry: "2027-03-09" },
    { id: 13, name: "Grace Morgan", role: "Support Worker", dbsExpiry: "2026-01-30" },
    { id: 14, name: "Ryan Cooper", role: "Manager", dbsExpiry: "2026-11-12" },
    { id: 15, name: "Chloe Bennett", role: "Care Assistant", dbsExpiry: "2026-06-05" },
    { id: 16, name: "Thomas Reed", role: "Support Worker", dbsExpiry: "2026-04-22" },
    { id: 17, name: "Hannah Price", role: "Team Leader", dbsExpiry: "2026-08-25" },
    { id: 18, name: "Ethan Foster", role: "Support Worker", dbsExpiry: "2027-06-14" },
    { id: 19, name: "Mia Campbell", role: "Administrator", dbsExpiry: "2026-02-08" },
    { id: 20, name: "Lucas Gray", role: "Care Assistant", dbsExpiry: "2026-07-15" }
  ];
  var expandedHistoryRows = /* @__PURE__ */ new Set();
  var expandedEvidenceRows = /* @__PURE__ */ new Set();
  var expandedActionRows = /* @__PURE__ */ new Set();
  var selectedRecordKeys = /* @__PURE__ */ new Set();
  var DUE_SOON_DAYS = 90;
  var RECORDS_PER_PAGE = 25;
  var DEFAULT_ACTION_TEMPLATES = [
    "Reminder sent",
    "Renewal chased",
    "Certificate received",
    "Evidence uploaded",
    "Renewal verified"
  ];
  var REMINDER_LABELS = {
    30: "30 Day Reminder",
    14: "14 Day Reminder",
    7: "7 Day Reminder",
    expired: "Expired"
  };
  var REMINDER_URGENCY = { expired: 0, 7: 1, 14: 2, 30: 3 };
  var HISTORY_ACTION_LABELS = {
    created: "Created",
    edited: "Edited",
    reminder_sent: "Reminder sent",
    renewed: "Renewed",
    deleted: "Deleted",
    evidence_added: "Evidence added",
    evidence_deleted: "Evidence deleted",
    action_added: "Action added",
    action_completed: "Action completed",
    action_reopened: "Action reopened",
    action_deleted: "Action deleted",
    action_updated: "Action updated"
  };
  var reminderSettings = settingsRepository.getSettings();
  var form = document.getElementById("add-person-form");
  var tableBody = document.getElementById("people-table-body");
  var personCount = document.getElementById("person-count");
  var emptyMessage = document.getElementById("empty-message");
  var noResultsMessage = document.getElementById("no-results-message");
  var searchInput = document.getElementById("search-input");
  var statusFilter = document.getElementById("status-filter");
  var complianceTypeFilter = document.getElementById("compliance-type-filter");
  var expiryWindowFilterSelect = document.getElementById("expiry-window-filter");
  var sortBySelect = document.getElementById("table-sort");
  var paginationSummary = document.getElementById("pagination-summary");
  var paginationControls = document.getElementById("pagination-controls");
  var paginationPrevBtn = document.getElementById("pagination-prev");
  var paginationNextBtn = document.getElementById("pagination-next");
  var bulkSelectionToolbar = document.getElementById("bulk-selection-toolbar");
  var bulkSelectionCount = document.getElementById("bulk-selection-count");
  var bulkClearSelectionBtn = document.getElementById("bulk-clear-selection-btn");
  var bulkExportCsvBtn = document.getElementById("bulk-export-csv-btn");
  var bulkAddActionBtn = document.getElementById("bulk-add-action-btn");
  var bulkMarkRemindersBtn = document.getElementById("bulk-mark-reminders-btn");
  var selectAllPageCheckbox = document.getElementById("select-all-page");
  var bulkActionModal = document.getElementById("bulk-action-modal");
  var bulkActionModalRecordLabel = document.getElementById("bulk-action-modal-record-label");
  var bulkActionTitleInput = document.getElementById("bulk-action-title");
  var bulkActionNotesInput = document.getElementById("bulk-action-notes");
  var bulkActionModalMessage = document.getElementById("bulk-action-modal-message");
  var stripTotal = document.getElementById("strip-total");
  var stripValid = document.getElementById("strip-valid");
  var stripDueSoon = document.getElementById("strip-due-soon");
  var stripExpired = document.getElementById("strip-expired");
  var exportCsvBtn = document.getElementById("export-csv-btn");
  var importCsvBtn = document.getElementById("import-csv-btn");
  var csvFileInput = document.getElementById("csv-file-input");
  var exportBackupBtn = document.getElementById("export-backup-btn");
  var importBackupBtn = document.getElementById("import-backup-btn");
  var validateBackupBtn = document.getElementById("validate-backup-btn");
  var backupFileInput = document.getElementById("backup-file-input");
  var validateBackupFileInput = document.getElementById("validate-backup-file-input");
  var importMessage = document.getElementById("import-message");
  var appMessage = document.getElementById("app-message");
  var addFormMessage = document.getElementById("add-form-message");
  var editFormMessage = document.getElementById("edit-form-message");
  var summaryTotal = document.getElementById("summary-total");
  var summaryValid = document.getElementById("summary-valid");
  var summaryDueSoon = document.getElementById("summary-due-soon");
  var summaryExpired = document.getElementById("summary-expired");
  var summaryCards = document.querySelectorAll(".summary-card");
  var resetSampleBtn = document.getElementById("reset-sample-btn");
  var editSection = document.getElementById("edit-person-section");
  var editForm = document.getElementById("edit-person-form");
  var cancelEditBtn = document.getElementById("cancel-edit-btn");
  var editIdInput = document.getElementById("edit-id");
  var editRecordIdInput = document.getElementById("edit-record-id");
  var renewModal = document.getElementById("renew-modal");
  var renewModalRecordLabel = document.getElementById("renew-modal-record-label");
  var renewCurrentExpiry = document.getElementById("renew-current-expiry");
  var renewCycleLabel = document.getElementById("renew-cycle-label");
  var renewSuggestedSection = document.getElementById("renew-suggested-section");
  var renewSuggestedExpiry = document.getElementById("renew-suggested-expiry");
  var renewCustomDateInput = document.getElementById("renew-custom-date");
  var renewModalMessage = document.getElementById("renew-modal-message");
  var renewUseSuggestedBtn = document.getElementById("renew-use-suggested-btn");
  var renewSaveCustomBtn = document.getElementById("renew-save-custom-btn");
  var renewCancelBtn = document.getElementById("renew-cancel-btn");
  var evidenceModal = document.getElementById("evidence-modal");
  var evidenceModalRecordLabel = document.getElementById("evidence-modal-record-label");
  var evidenceNameInput = document.getElementById("evidence-name");
  var evidenceTypeInput = document.getElementById("evidence-type");
  var evidenceNotesInput = document.getElementById("evidence-notes");
  var evidenceFileInput = document.getElementById("evidence-file");
  var evidenceModalMessage = document.getElementById("evidence-modal-message");
  var evidenceSaveBtn = document.getElementById("evidence-save-btn");
  var evidenceCancelBtn = document.getElementById("evidence-cancel-btn");
  var evidenceModalCloseBtn = document.getElementById("evidence-modal-close-btn");
  var actionModal = document.getElementById("action-modal");
  var actionModalRecordLabel = document.getElementById("action-modal-record-label");
  var actionTitleInput = document.getElementById("action-title");
  var actionNotesInput = document.getElementById("action-notes");
  var actionModalMessage = document.getElementById("action-modal-message");
  var actionDueDateInput = document.getElementById("action-due-date");
  var actionOwnerInput = document.getElementById("action-owner");
  var actionStatusInput = document.getElementById("action-status");
  var actionStatusRow = document.getElementById("action-status-row");
  var actionModalTitle = document.getElementById("action-modal-title");
  var actionDashboardOpen = document.getElementById("action-dashboard-open");
  var actionDashboardDueWeek = document.getElementById("action-dashboard-due-week");
  var actionDashboardOverdue = document.getElementById("action-dashboard-overdue");
  var actionDashboardInProgress = document.getElementById("action-dashboard-in-progress");
  var actionDashboardEmptyHint = document.getElementById("action-dashboard-empty-hint");
  var actionDashboardPreview = document.getElementById("action-dashboard-preview");
  var actionDashboardPreviewTitle = document.getElementById("action-dashboard-preview-title");
  var actionDashboardPreviewMeta = document.getElementById("action-dashboard-preview-meta");
  var actionDashboardTableHead = document.getElementById("action-dashboard-table-head");
  var actionDashboardTableBody = document.getElementById("action-dashboard-table-body");
  var exportActionDashboardCsvBtn = document.getElementById("export-action-dashboard-csv-btn");
  var clearActionDashboardPreviewBtn = document.getElementById("clear-action-dashboard-preview-btn");
  var actionDashboardCards = document.querySelectorAll("[data-action-dashboard]");
  var insightStaleEvidence = document.getElementById("insight-stale-evidence");
  var renewModalContext = null;
  var evidenceModalContext = null;
  var actionModalContext = null;
  var workspaceActionFilter = "all";
  var expiryWindowFilter = null;
  var currentTablePage = 1;
  var dashboard30Count = document.getElementById("dashboard-30-count");
  var dashboard60Count = document.getElementById("dashboard-60-count");
  var dashboard90Count = document.getElementById("dashboard-90-count");
  var dashboardActionCount = document.getElementById("dashboard-action-count");
  var dashboardCards = document.querySelectorAll(".dashboard-card[data-days]");
  var dashboardAllCard = document.getElementById("dashboard-all-card");
  var dashboardAllCount = document.getElementById("dashboard-all-count");
  var actionRequiredCard = document.getElementById("action-required-card");
  var remindersTableBody = document.getElementById("reminders-table-body");
  var remindersEmpty = document.getElementById("reminders-empty");
  var remindersSection = document.getElementById("reminders-section");
  var reminderDays30 = document.getElementById("reminder-days-30");
  var reminderDays14 = document.getElementById("reminder-days-14");
  var reminderDays7 = document.getElementById("reminder-days-7");
  var hideSentRemindersCheckbox = document.getElementById("hide-sent-reminders");
  var peopleSection = document.getElementById("people-section");
  var addPersonSection = document.getElementById("add-person-section");
  var analyticsHealthScore = document.getElementById("analytics-health-score");
  var analyticsTotal = document.getElementById("analytics-total");
  var analyticsCompliant = document.getElementById("analytics-compliant");
  var analyticsExpiring30 = document.getElementById("analytics-expiring-30");
  var analyticsExpiring60 = document.getElementById("analytics-expiring-60");
  var analyticsExpiring90 = document.getElementById("analytics-expiring-90");
  var analyticsExpired = document.getElementById("analytics-expired");
  var activeFilterChips = document.getElementById("active-filter-chips");
  var clearFiltersBtn = document.getElementById("clear-filters-btn");
  var analyticsCards = document.querySelectorAll("[data-analytics-filter]");
  var insightHealthScore = document.getElementById("insight-health-score");
  var insightOpenActions = document.getElementById("insight-open-actions");
  var insightExpiredLinkedActions = document.getElementById("insight-expired-linked-actions");
  var insightMissingEvidence = document.getElementById("insight-missing-evidence");
  var insightExpiringThisMonth = document.getElementById("insight-expiring-this-month");
  var insightExpiringNextMonth = document.getElementById("insight-expiring-next-month");
  var insightEmptyHint = document.getElementById("insight-empty-hint");
  var insightPreview = document.getElementById("insight-preview");
  var insightPreviewTitle = document.getElementById("insight-preview-title");
  var insightPreviewMeta = document.getElementById("insight-preview-meta");
  var insightTableHead = document.getElementById("insight-table-head");
  var insightTableBody = document.getElementById("insight-table-body");
  var exportInsightCsvBtn = document.getElementById("export-insight-csv-btn");
  var clearInsightPreviewBtn = document.getElementById("clear-insight-preview-btn");
  var insightCards = document.querySelectorAll("[data-insight]");
  var reportPreview = document.getElementById("report-preview");
  var reportTitle = document.getElementById("report-title");
  var reportMeta = document.getElementById("report-meta");
  var reportSummaryStats = document.getElementById("report-summary-stats");
  var reportTableHead = document.getElementById("report-table-head");
  var reportTableBody = document.getElementById("report-table-body");
  var reportEmptyHint = document.getElementById("report-empty-hint");
  var exportReportCsvBtn = document.getElementById("export-report-csv-btn");
  var printReportBtn = document.getElementById("print-report-btn");
  var reportCards = document.querySelectorAll("[data-report]");
  var recordWorkspace = document.getElementById("record-workspace");
  var recordWorkspaceBackdrop = document.getElementById("record-workspace-backdrop");
  var workspaceTitle = document.getElementById("workspace-title");
  var workspaceSubtitle = document.getElementById("workspace-subtitle");
  var workspaceContent = document.getElementById("workspace-content");
  var workspaceCloseBtn = document.getElementById("workspace-close-btn");
  var workspaceCloseFooterBtn = document.getElementById("workspace-close-footer-btn");
  var workspaceDeleteBtn = document.getElementById("workspace-delete-btn");
  var workspaceEditBtn = document.getElementById("workspace-edit-btn");
  var workspaceRenewBtn = document.getElementById("workspace-renew-btn");
  var workspaceContext = null;
  var REPORT_TYPES = {
    FULL: "full-compliance",
    EXPIRED: "expired",
    EXPIRING_30: "expiring-30",
    MISSING_EVIDENCE: "missing-evidence",
    EVIDENCE_COVERAGE: "evidence-coverage",
    OPEN_ACTIONS: "open-actions",
    RECORDS_WITH_OPEN_ACTIONS: "records-with-open-actions",
    EXPIRED_WITH_OPEN_ACTIONS: "expired-with-open-actions"
  };
  var currentReport = null;
  var INSIGHT_TYPES = {
    OPEN_ACTIONS: "open-actions",
    EXPIRED_LINKED_ACTIONS: "expired-linked-actions",
    MISSING_EVIDENCE: "missing-evidence",
    EXPIRING_THIS_MONTH: "expiring-this-month",
    EXPIRING_NEXT_MONTH: "expiring-next-month",
    HEALTH_SCORE: "health-score",
    STALE_EVIDENCE: "stale-evidence"
  };
  var ACTION_DASHBOARD_TYPES = {
    OPEN: "open",
    DUE_THIS_WEEK: "due-this-week",
    OVERDUE: "overdue",
    IN_PROGRESS: "in-progress"
  };
  var ACTION_DASHBOARD_PREVIEW_COLUMNS = [
    { key: "name", label: "Name" },
    { key: "role", label: "Role" },
    { key: "complianceType", label: "Compliance Type" },
    { key: "actionTitle", label: "Action Title" },
    { key: "status", label: "Status" },
    { key: "dueDate", label: "Due Date" },
    { key: "owner", label: "Owner" },
    { key: "expiryDate", label: "Expiry Date" }
  ];
  var currentActionDashboard = null;
  var INSIGHT_PREVIEW_COLUMNS = [
    { key: "name", label: "Name" },
    { key: "role", label: "Role" },
    { key: "complianceType", label: "Compliance Type" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "status", label: "Status" },
    { key: "openActionCount", label: "Open Actions" },
    { key: "evidenceCount", label: "Evidence Count" }
  ];
  var currentInsight = null;
  var STATUS_FILTER_LABELS = {
    valid: "Valid",
    dueSoon: "Due Soon",
    expired: "Expired"
  };
  function getDateDaysFromToday(daysFromToday) {
    const date = getTodayAtMidnight();
    date.setDate(date.getDate() + daysFromToday);
    return dateToISOString(date);
  }
  function applySampleData() {
    repository.people = samplePeople.map((person, index) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      complianceRecords: [
        {
          id: index + 1,
          complianceType: DEFAULT_COMPLIANCE_TYPE,
          expiryDate: index === 0 ? getDateDaysFromToday(30) : normalizeExpiryDate(person.dbsExpiry),
          notes: "",
          renewalCycle: DEFAULT_RENEWAL_CYCLE
        }
      ]
    }));
    repository.nextPersonId = 21;
    repository.nextRecordId = 1e3;
    repository.deletedRecordHistory = [];
    repository.nextEvidenceId = 1;
    repository.nextActionId = 1;
    repository.people.forEach((person) => {
      person.complianceRecords.forEach((record) => {
        appendHistoryEntry(
          record,
          HISTORY_ACTIONS.CREATED,
          `Record created (${record.complianceType}, expires ${formatDate(record.expiryDate)}).`
        );
      });
    });
  }
  function savePeople() {
    repository.save();
  }
  function getDefaultRenewalCycleForType() {
    return DEFAULT_RENEWAL_CYCLE;
  }
  function getRenewalCycleLabel(cycleValue) {
    const match = RENEWAL_CYCLE_OPTIONS.find((option) => option.value === cycleValue);
    return match ? match.label : "Manual";
  }
  function getRenewalCycleRenewalText(cycleValue) {
    if (cycleValue === "6-months") {
      return "6 Month";
    }
    if (cycleValue === "1-year") {
      return "1 Year";
    }
    if (cycleValue === "2-years") {
      return "2 Year";
    }
    if (cycleValue === "3-years") {
      return "3 Year";
    }
    if (cycleValue === "5-years") {
      return "5 Year";
    }
    return getRenewalCycleLabel(cycleValue);
  }
  function isActiveRenewalCycle(cycleValue) {
    return repository.normalizeRenewalCycle(cycleValue) !== RENEWAL_CYCLE_MANUAL;
  }
  function calculateRenewalExpiryDate(expiryDate, renewalCycle) {
    const cycle = repository.normalizeRenewalCycle(renewalCycle);
    const base = parseDateAtMidnight(expiryDate);
    if (!isActiveRenewalCycle(cycle) || Number.isNaN(base.getTime())) {
      return null;
    }
    const date = new Date(base.getTime());
    if (cycle === "6-months") {
      date.setMonth(date.getMonth() + 6);
    } else if (cycle === "1-year") {
      date.setFullYear(date.getFullYear() + 1);
    } else if (cycle === "2-years") {
      date.setFullYear(date.getFullYear() + 2);
    } else if (cycle === "3-years") {
      date.setFullYear(date.getFullYear() + 3);
    } else if (cycle === "5-years") {
      date.setFullYear(date.getFullYear() + 5);
    }
    return dateToISOString(date);
  }
  function syncAddFormRenewalCycleDefault() {
    const complianceTypeInput2 = document.getElementById("compliance-type");
    const renewalCycleInput = document.getElementById("renewal-cycle");
    if (complianceTypeInput2 && renewalCycleInput) {
      renewalCycleInput.value = getDefaultRenewalCycleForType(complianceTypeInput2.value);
    }
  }
  function appendHistoryEntry(record, action, description) {
    if (!Array.isArray(record.history)) {
      record.history = [];
    }
    const entry = {
      id: repository.nextHistoryEntryId++,
      action,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      description
    };
    const user = getCurrentUser();
    if (user) {
      entry.userId = user.userId;
      entry.userDisplayName = user.displayName;
    }
    record.history.unshift(entry);
  }
  function formatHistoryTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return String(timestamp);
    }
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function historyRowKey(personId, recordId) {
    return `${personId}:${recordId}`;
  }
  function buildHistoryPanelHtml(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return '<p class="history-empty">Record not found.</p>';
    }
    const entries = result.record.history || [];
    if (entries.length === 0) {
      return '<p class="history-empty">No history recorded yet.</p>';
    }
    const items = entries.map((entry) => {
      const actionLabel = HISTORY_ACTION_LABELS[entry.action] || entry.action || "Action";
      const userLine = entry.userDisplayName ? `<span class="history-entry-user">${escapeHtml(entry.userDisplayName)}</span>` : "";
      return `
        <li class="history-entry">
          <span class="history-entry-action">${escapeHtml(actionLabel)}</span>
          <span class="history-entry-time">${escapeHtml(formatHistoryTimestamp(entry.timestamp))}${userLine ? ` ${userLine}` : ""}</span>
          <span class="history-entry-desc">${escapeHtml(entry.description)}</span>
        </li>
      `;
    }).join("");
    return `<ul class="history-list">${items}</ul>`;
  }
  function getEvidenceSummary(evidence) {
    const items = Array.isArray(evidence) ? evidence : [];
    if (items.length === 0) {
      return { count: 0, latestAdded: "" };
    }
    const latest = items.reduce((newest, item) => {
      if (!newest || item.addedDate > newest.addedDate) {
        return item;
      }
      return newest;
    }, null);
    return {
      count: items.length,
      latestAdded: latest ? formatDate(latest.addedDate) : ""
    };
  }
  function getEvidenceAgeDays(addedDate) {
    const added = parseDateAtMidnight(addedDate);
    const today = getTodayAtMidnight();
    if (Number.isNaN(added.getTime())) {
      return null;
    }
    return Math.floor((today - added) / (1e3 * 60 * 60 * 24));
  }
  function formatEvidenceAge(addedDate) {
    const ageDays = getEvidenceAgeDays(addedDate);
    if (ageDays === null) {
      return "Added date unknown";
    }
    if (ageDays <= 0) {
      return "Added today";
    }
    if (ageDays === 1) {
      return "Added 1 day ago";
    }
    if (ageDays < 30) {
      return `Added ${ageDays} days ago`;
    }
    const ageMonths = Math.floor(ageDays / 30);
    if (ageMonths < 12) {
      return ageMonths === 1 ? "Added 1 month ago" : `Added ${ageMonths} months ago`;
    }
    return ageMonths === 12 ? "Added 12 months ago" : `Added ${ageMonths} months ago`;
  }
  function isEvidenceStale(addedDate) {
    const ageDays = getEvidenceAgeDays(addedDate);
    return ageDays !== null && ageDays > 365;
  }
  function recordHasStaleEvidence(evidence) {
    return (evidence || []).some((item) => isEvidenceStale(item.addedDate));
  }
  function buildEvidencePanelHtml(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return '<p class="evidence-empty">Record not found.</p>';
    }
    const items = result.record.evidence || [];
    if (items.length === 0) {
      return '<p class="evidence-empty">No evidence added yet.</p>';
    }
    const sortedItems = [...items].sort((a, b) => b.addedDate.localeCompare(a.addedDate));
    const cards = sortedItems.map((item) => {
      const fileLine = item.fileName ? `<p class="evidence-item-file">File: ${escapeHtml(item.fileName)}</p>` : "";
      const notesLine = item.notes ? `<p class="evidence-item-notes">${escapeHtml(item.notes)}</p>` : "";
      const downloadButton = item.fileData ? `<button type="button" class="evidence-download-btn" data-person-id="${personId}" data-record-id="${recordId}" data-evidence-id="${item.id}">Download file</button>` : "";
      const staleClass = isEvidenceStale(item.addedDate) ? " evidence-item-stale" : "";
      return `
        <li class="evidence-item${staleClass}">
          <div class="evidence-item-header">
            <strong class="evidence-item-name">${escapeHtml(item.name)}</strong>
            <span class="evidence-item-type">${escapeHtml(item.documentType)}</span>
          </div>
          <p class="evidence-item-date">${escapeHtml(formatEvidenceAge(item.addedDate))}</p>
          ${fileLine}
          ${notesLine}
          <div class="evidence-item-actions">
            ${downloadButton}
            <button type="button" class="delete-evidence-btn" data-person-id="${personId}" data-record-id="${recordId}" data-evidence-id="${item.id}">Delete</button>
          </div>
        </li>
      `;
    }).join("");
    return `<ul class="evidence-list">${cards}</ul>`;
  }
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }
  function openAddEvidenceModal(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const { person, record } = result;
    evidenceModalContext = {
      personId,
      recordId,
      recordLabel: `${person.name} \u2014 ${record.complianceType}`
    };
    evidenceModalRecordLabel.textContent = evidenceModalContext.recordLabel;
    evidenceNameInput.value = "";
    evidenceTypeInput.value = EVIDENCE_TYPES[0];
    evidenceNotesInput.value = "";
    evidenceFileInput.value = "";
    hideMessage(evidenceModalMessage);
    evidenceModal.classList.remove("hidden");
    evidenceModal.setAttribute("aria-hidden", "false");
    evidenceNameInput.focus();
  }
  function closeEvidenceModal() {
    if (!evidenceModal) {
      evidenceModalContext = null;
      return;
    }
    evidenceModal.classList.add("hidden");
    evidenceModal.setAttribute("aria-hidden", "true");
    evidenceModalContext = null;
    if (evidenceModalMessage) {
      hideMessage(evidenceModalMessage);
    }
  }
  async function handleSaveEvidence() {
    if (!evidenceModalContext) {
      return;
    }
    const name = evidenceNameInput.value.trim();
    const documentType = repository.normalizeDocumentType(evidenceTypeInput.value);
    const notes = evidenceNotesInput.value.trim();
    const file = evidenceFileInput.files[0] || null;
    if (!name) {
      showMessage(evidenceModalMessage, "Document name is required.", "error");
      return;
    }
    let fileName = null;
    let fileData = null;
    if (file) {
      if (file.size > MAX_EVIDENCE_FILE_BYTES) {
        showMessage(
          evidenceModalMessage,
          `File is too large. Maximum size is ${Math.round(MAX_EVIDENCE_FILE_BYTES / 1024)} KB.`,
          "error"
        );
        return;
      }
      try {
        fileData = await readFileAsDataUrl(file);
        fileName = file.name;
      } catch (error) {
        showMessage(evidenceModalMessage, "Could not read the selected file.", "error");
        return;
      }
    }
    const { personId, recordId, recordLabel } = evidenceModalContext;
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      closeEvidenceModal();
      return;
    }
    const evidenceItem = {
      id: repository.nextEvidenceId++,
      name,
      documentType,
      addedDate: dateToISOString(getTodayAtMidnight()),
      notes,
      fileName,
      fileData
    };
    if (!Array.isArray(result.record.evidence)) {
      result.record.evidence = [];
    }
    result.record.evidence.push(evidenceItem);
    appendHistoryEntry(
      result.record,
      HISTORY_ACTIONS.EVIDENCE_ADDED,
      `Evidence added: ${documentType}.`
    );
    savePeople();
    closeEvidenceModal();
    showMessage(appMessage, `Evidence added to ${recordLabel}.`, "success");
    renderTable({ refreshDashboards: false });
  }
  function deleteEvidenceItem(personId, recordId, evidenceId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const { person, record } = result;
    const evidenceItem = (record.evidence || []).find((item) => item.id === evidenceId);
    if (!evidenceItem) {
      return;
    }
    const confirmed = confirm(
      `Delete this evidence item?

${evidenceItem.name}
${evidenceItem.documentType}

This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    record.evidence = (record.evidence || []).filter((item) => item.id !== evidenceId);
    appendHistoryEntry(
      record,
      HISTORY_ACTIONS.EVIDENCE_DELETED,
      `Evidence deleted: ${evidenceItem.documentType}.`
    );
    savePeople();
    showMessage(
      appMessage,
      `Evidence deleted: ${person.name} \u2014 ${evidenceItem.documentType}.`,
      "success"
    );
    renderTable({ refreshDashboards: false });
  }
  function downloadEvidenceFile(personId, recordId, evidenceId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const evidenceItem = (result.record.evidence || []).find((item) => item.id === evidenceId);
    if (!evidenceItem || !evidenceItem.fileData) {
      showMessage(appMessage, "No file is stored for this evidence item.", "error");
      return;
    }
    const link = document.createElement("a");
    link.href = evidenceItem.fileData;
    link.download = evidenceItem.fileName || "evidence-file";
    link.click();
  }
  function getActionStatus(actionItem) {
    if (!actionItem) {
      return ACTION_STATUSES.OPEN;
    }
    if (actionItem.status === ACTION_STATUSES.IN_PROGRESS || actionItem.status === ACTION_STATUSES.COMPLETED || actionItem.status === ACTION_STATUSES.OPEN) {
      return actionItem.status;
    }
    return actionItem.completed ? ACTION_STATUSES.COMPLETED : ACTION_STATUSES.OPEN;
  }
  function isActionCompleted(actionItem) {
    return getActionStatus(actionItem) === ACTION_STATUSES.COMPLETED;
  }
  function getActionStatusLabel(actionItem) {
    return ACTION_STATUS_LABELS[getActionStatus(actionItem)] || "Open";
  }
  function getWeekDateRange(referenceDate = /* @__PURE__ */ new Date()) {
    const date = new Date(referenceDate);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setDate(date.getDate() + diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  function isActionDueThisWeek(actionItem) {
    if (isActionCompleted(actionItem) || !actionItem.dueDate) {
      return false;
    }
    const due = parseDateAtMidnight(actionItem.dueDate);
    if (Number.isNaN(due.getTime())) {
      return false;
    }
    const { start, end } = getWeekDateRange();
    return due >= start && due <= end;
  }
  function isActionOverdue(actionItem) {
    if (isActionCompleted(actionItem) || !actionItem.dueDate) {
      return false;
    }
    const due = parseDateAtMidnight(actionItem.dueDate);
    if (Number.isNaN(due.getTime())) {
      return false;
    }
    return due < getTodayAtMidnight();
  }
  function formatActionDueDate(dueDate) {
    if (!dueDate) {
      return "\u2014";
    }
    return formatDate(dueDate);
  }
  function syncActionCompletionFields(actionItem) {
    const status = getActionStatus(actionItem);
    actionItem.status = status;
    actionItem.completed = status === ACTION_STATUSES.COMPLETED;
    if (actionItem.completed && !actionItem.completedAt) {
      actionItem.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    if (!actionItem.completed) {
      actionItem.completedAt = null;
    }
  }
  function getActionSummary(actions) {
    const items = Array.isArray(actions) ? actions : [];
    let openCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    items.forEach((item) => {
      const status = getActionStatus(item);
      if (status === ACTION_STATUSES.COMPLETED) {
        completedCount += 1;
      } else if (status === ACTION_STATUSES.IN_PROGRESS) {
        inProgressCount += 1;
      } else {
        openCount += 1;
      }
    });
    return {
      openCount,
      inProgressCount,
      completedCount,
      activeCount: openCount + inProgressCount
    };
  }
  function getFlattenedActionEntries() {
    const entries = [];
    getAllComplianceRows().forEach((row) => {
      (row.actions || []).forEach((action) => {
        entries.push({ row, action });
      });
    });
    return entries;
  }
  function getGlobalActionMetrics() {
    let openActions = 0;
    let inProgressActions = 0;
    let dueThisWeek = 0;
    let overdueActions = 0;
    let completedActions = 0;
    let expiredWithOpenActions = 0;
    getAllComplianceRows().forEach((row) => {
      const summary = getActionSummary(row.actions);
      const status = getStatus(row.expiryDate);
      openActions += summary.openCount;
      inProgressActions += summary.inProgressCount;
      completedActions += summary.completedCount;
      if (summary.activeCount > 0 && status.key === "expired") {
        expiredWithOpenActions += 1;
      }
      (row.actions || []).forEach((action) => {
        if (isActionDueThisWeek(action)) {
          dueThisWeek += 1;
        }
        if (isActionOverdue(action)) {
          overdueActions += 1;
        }
      });
    });
    return {
      openActions,
      inProgressActions,
      dueThisWeek,
      overdueActions,
      completedActions,
      expiredWithOpenActions
    };
  }
  function getMonthDateRange(monthOffset = 0) {
    const now = /* @__PURE__ */ new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  function isExpiryInMonthRange(expiryDate, monthOffset) {
    const expiry = parseDateAtMidnight(expiryDate);
    if (Number.isNaN(expiry.getTime())) {
      return false;
    }
    const { start, end } = getMonthDateRange(monthOffset);
    return expiry >= start && expiry <= end;
  }
  function getManagementInsightMetrics() {
    const rows = getAllComplianceRows();
    let totalOpenActions = 0;
    let expiredLinkedOpenActions = 0;
    let missingEvidenceRecords = 0;
    let expiringThisMonth = 0;
    let expiringNextMonth = 0;
    let validWithEvidence = 0;
    let staleEvidenceRecords = 0;
    rows.forEach((row) => {
      const actionSummary = getActionSummary(row.actions);
      const evidenceCount = getEvidenceSummary(row.evidence).count;
      const status = getStatus(row.expiryDate);
      totalOpenActions += actionSummary.activeCount;
      if (status.key === "expired") {
        expiredLinkedOpenActions += actionSummary.activeCount;
      }
      if (evidenceCount === 0) {
        missingEvidenceRecords += 1;
      }
      if (recordHasStaleEvidence(row.evidence)) {
        staleEvidenceRecords += 1;
      }
      if (status.key !== "expired" && isExpiryInMonthRange(row.expiryDate, 0)) {
        expiringThisMonth += 1;
      }
      if (isExpiryInMonthRange(row.expiryDate, 1)) {
        expiringNextMonth += 1;
      }
      if (status.key === "valid" && evidenceCount > 0) {
        validWithEvidence += 1;
      }
    });
    const totalRecords = rows.length;
    const healthScore = totalRecords === 0 ? 0 : Math.round(validWithEvidence / totalRecords * 100);
    return {
      totalOpenActions,
      expiredLinkedOpenActions,
      missingEvidenceRecords,
      expiringThisMonth,
      expiringNextMonth,
      healthScore,
      validWithEvidence,
      totalRecords,
      staleEvidenceRecords
    };
  }
  function getInsightTitle(insightType) {
    const titles = {
      [INSIGHT_TYPES.OPEN_ACTIONS]: "Records with Open Actions",
      [INSIGHT_TYPES.EXPIRED_LINKED_ACTIONS]: "Expired Records with Open Actions",
      [INSIGHT_TYPES.MISSING_EVIDENCE]: "Records With No Evidence",
      [INSIGHT_TYPES.EXPIRING_THIS_MONTH]: "Expiring This Month",
      [INSIGHT_TYPES.EXPIRING_NEXT_MONTH]: "Expiring Next Month",
      [INSIGHT_TYPES.HEALTH_SCORE]: "Valid Records with Evidence",
      [INSIGHT_TYPES.STALE_EVIDENCE]: "Records With Evidence Older Than 12 Months"
    };
    return titles[insightType] || "Management Insight";
  }
  function getInsightFilename(insightType) {
    return `management-insight-${insightType.replace(/-/g, "_")}.csv`;
  }
  function getInsightRowsForType(insightType) {
    const rows = getAllComplianceRows();
    if (insightType === INSIGHT_TYPES.OPEN_ACTIONS) {
      return rows.filter((row) => getActionSummary(row.actions).activeCount > 0);
    }
    if (insightType === INSIGHT_TYPES.EXPIRED_LINKED_ACTIONS) {
      return rows.filter(
        (row) => getStatus(row.expiryDate).key === "expired" && getActionSummary(row.actions).activeCount > 0
      );
    }
    if (insightType === INSIGHT_TYPES.MISSING_EVIDENCE) {
      return rows.filter((row) => getEvidenceSummary(row.evidence).count === 0);
    }
    if (insightType === INSIGHT_TYPES.EXPIRING_THIS_MONTH) {
      return rows.filter(
        (row) => getStatus(row.expiryDate).key !== "expired" && isExpiryInMonthRange(row.expiryDate, 0)
      );
    }
    if (insightType === INSIGHT_TYPES.EXPIRING_NEXT_MONTH) {
      return rows.filter((row) => isExpiryInMonthRange(row.expiryDate, 1));
    }
    if (insightType === INSIGHT_TYPES.HEALTH_SCORE) {
      return rows.filter(
        (row) => getStatus(row.expiryDate).key === "valid" && getEvidenceSummary(row.evidence).count > 0
      );
    }
    if (insightType === INSIGHT_TYPES.STALE_EVIDENCE) {
      return rows.filter((row) => recordHasStaleEvidence(row.evidence));
    }
    return rows;
  }
  function buildInsightPreviewRow(row) {
    const status = getStatus(row.expiryDate);
    const evidenceSummary = getEvidenceSummary(row.evidence);
    const actionSummary = getActionSummary(row.actions);
    return {
      name: row.name,
      role: row.role,
      complianceType: row.complianceType,
      expiryDate: formatDate(row.expiryDate),
      status: getStatusBadgeLabel(status.key),
      openActionCount: String(actionSummary.activeCount),
      evidenceCount: String(evidenceSummary.count)
    };
  }
  function buildInsightReport(insightType) {
    const generatedAt = /* @__PURE__ */ new Date();
    const rows = getInsightRowsForType(insightType).sort(
      (a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.name.localeCompare(b.name)
    );
    return {
      type: insightType,
      title: getInsightTitle(insightType),
      generatedAt: generatedAt.toISOString(),
      generatedDisplay: generatedAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      totalCount: rows.length,
      columns: INSIGHT_PREVIEW_COLUMNS,
      tableRows: rows.map(buildInsightPreviewRow),
      filename: getInsightFilename(insightType)
    };
  }
  function renderManagementInsights() {
    if (!insightHealthScore) {
      return;
    }
    const metrics = getManagementInsightMetrics();
    insightOpenActions.textContent = metrics.totalOpenActions;
    insightExpiredLinkedActions.textContent = metrics.expiredLinkedOpenActions;
    insightMissingEvidence.textContent = metrics.missingEvidenceRecords;
    insightExpiringThisMonth.textContent = metrics.expiringThisMonth;
    insightExpiringNextMonth.textContent = metrics.expiringNextMonth;
    insightHealthScore.textContent = `${metrics.healthScore}%`;
    if (insightStaleEvidence) {
      insightStaleEvidence.textContent = metrics.staleEvidenceRecords;
    }
    insightHealthScore.classList.remove("health-high", "health-medium", "health-low");
    if (metrics.healthScore >= 80) {
      insightHealthScore.classList.add("health-high");
    } else if (metrics.healthScore >= 50) {
      insightHealthScore.classList.add("health-medium");
    } else {
      insightHealthScore.classList.add("health-low");
    }
  }
  function updateInsightCardActiveState() {
    insightCards.forEach((card) => {
      card.classList.toggle(
        "active",
        Boolean(currentInsight && card.dataset.insight === currentInsight.type)
      );
    });
  }
  function renderInsightPreview(insight) {
    if (!insightPreview || !insightPreviewTitle || !insightPreviewMeta || !insightTableHead || !insightTableBody) {
      return;
    }
    currentInsight = insight;
    insightPreviewTitle.textContent = insight.title;
    insightPreviewMeta.textContent = `Generated: ${insight.generatedDisplay} \xB7 Records included: ${insight.totalCount}`;
    insightTableHead.innerHTML = `
    <tr>
      ${insight.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
    </tr>
  `;
    if (insight.tableRows.length === 0) {
      insightTableBody.innerHTML = `
      <tr>
        <td colspan="${insight.columns.length}" class="insight-empty-cell">No records match this insight.</td>
      </tr>
    `;
    } else {
      insightTableBody.innerHTML = insight.tableRows.map(
        (row) => `
          <tr>
            ${insight.columns.map((column) => `<td>${escapeHtml(row[column.key] ?? "")}</td>`).join("")}
          </tr>
        `
      ).join("");
    }
    insightPreview.classList.remove("hidden");
    if (insightEmptyHint) {
      insightEmptyHint.classList.add("hidden");
    }
    updateInsightCardActiveState();
  }
  function showManagementInsight(insightType) {
    renderInsightPreview(buildInsightReport(insightType));
    if (insightPreview) {
      insightPreview.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  function clearInsightPreview() {
    currentInsight = null;
    if (insightPreview) {
      insightPreview.classList.add("hidden");
    }
    if (insightTableHead) {
      insightTableHead.innerHTML = "";
    }
    if (insightTableBody) {
      insightTableBody.innerHTML = "";
    }
    if (insightEmptyHint) {
      insightEmptyHint.classList.remove("hidden");
    }
    updateInsightCardActiveState();
  }
  function exportInsightCsv() {
    if (!currentInsight) {
      showMessage(appMessage, "Select an insight to preview first.", "error");
      return;
    }
    const headerRow = currentInsight.columns.map((column) => escapeCsvValue(column.label)).join(",");
    const dataRows = currentInsight.tableRows.map(
      (row) => currentInsight.columns.map((column) => escapeCsvValue(row[column.key] ?? "")).join(",")
    );
    const summaryLines = [
      `"Insight","${escapeCsvValue(currentInsight.title)}"`,
      `"Generated","${escapeCsvValue(currentInsight.generatedDisplay)}"`,
      `"Records included","${currentInsight.totalCount}"`,
      ""
    ];
    const csvContent = [...summaryLines, headerRow, ...dataRows].join("\n");
    downloadFile(csvContent, currentInsight.filename, "text/csv");
    showMessage(appMessage, "Insight CSV downloaded.", "success");
  }
  function setupManagementInsightListeners() {
    insightCards.forEach((card) => {
      card.addEventListener("click", () => {
        showManagementInsight(card.dataset.insight);
      });
    });
    exportInsightCsvBtn?.addEventListener("click", exportInsightCsv);
    clearInsightPreviewBtn?.addEventListener("click", clearInsightPreview);
  }
  function isRecordActionRequired(row) {
    if (getStatus(row.expiryDate).key === "expired") {
      return true;
    }
    return Boolean(getReminderForRecord(row));
  }
  function actionRowKey(personId, recordId) {
    return `${personId}:${recordId}`;
  }
  function clearRecordSelection() {
    selectedRecordKeys.clear();
    renderBulkSelectionToolbar();
  }
  function getSelectedComplianceRows() {
    return getAllComplianceRows().filter(
      (row) => selectedRecordKeys.has(actionRowKey(row.personId, row.recordId))
    );
  }
  function toggleRecordSelection(personId, recordId, selected) {
    const key = actionRowKey(personId, recordId);
    if (selected) {
      selectedRecordKeys.add(key);
    } else {
      selectedRecordKeys.delete(key);
    }
    renderBulkSelectionToolbar();
  }
  function toggleSelectAllOnPage(pageRows, selected) {
    pageRows.forEach((row) => {
      const key = actionRowKey(row.personId, row.recordId);
      if (selected) {
        selectedRecordKeys.add(key);
      } else {
        selectedRecordKeys.delete(key);
      }
    });
    renderBulkSelectionToolbar();
  }
  function renderBulkSelectionToolbar() {
    if (!bulkSelectionToolbar || !bulkSelectionCount) {
      return;
    }
    const count = selectedRecordKeys.size;
    bulkSelectionToolbar.classList.toggle("hidden", count === 0);
    bulkSelectionCount.textContent = count === 1 ? "1 record selected" : `${count} records selected`;
  }
  function updateSelectAllPageCheckbox(pageRows) {
    if (!selectAllPageCheckbox) {
      return;
    }
    if (pageRows.length === 0) {
      selectAllPageCheckbox.checked = false;
      selectAllPageCheckbox.indeterminate = false;
      selectAllPageCheckbox.disabled = true;
      return;
    }
    selectAllPageCheckbox.disabled = false;
    const selectedOnPage = pageRows.filter(
      (row) => selectedRecordKeys.has(actionRowKey(row.personId, row.recordId))
    ).length;
    selectAllPageCheckbox.checked = selectedOnPage === pageRows.length;
    selectAllPageCheckbox.indeterminate = selectedOnPage > 0 && selectedOnPage < pageRows.length;
  }
  function actionMatchesWorkspaceFilter(actionItem) {
    if (workspaceActionFilter === "all") {
      return true;
    }
    if (workspaceActionFilter === "overdue") {
      return isActionOverdue(actionItem);
    }
    return getActionStatus(actionItem) === workspaceActionFilter;
  }
  function buildActionItemHtml(personId, recordId, item) {
    const status = getActionStatus(item);
    const statusLabel = getActionStatusLabel(item);
    const statusClass = status === ACTION_STATUSES.COMPLETED ? "action-status-completed" : status === ACTION_STATUSES.IN_PROGRESS ? "action-status-in-progress" : "action-status-open";
    const overdue = isActionOverdue(item);
    const itemClass = overdue ? "action-item action-item-overdue" : status === ACTION_STATUSES.COMPLETED ? "action-item action-item-completed" : status === ACTION_STATUSES.IN_PROGRESS ? "action-item action-item-in-progress" : "action-item action-item-open";
    const createdDisplay = formatHistoryTimestamp(item.createdAt);
    const completedDisplay = item.completedAt ? formatHistoryTimestamp(item.completedAt) : "\u2014";
    const dueDisplay = formatActionDueDate(item.dueDate);
    const ownerDisplay = item.owner ? escapeHtml(item.owner) : "\u2014";
    const notesLine = item.notes ? `<p class="action-item-notes">${escapeHtml(item.notes)}</p>` : "";
    const overdueBadge = overdue ? `<span class="action-overdue-badge">OVERDUE</span>` : "";
    const progressButton = status === ACTION_STATUSES.OPEN ? `<button type="button" class="action-progress-btn" data-person-id="${personId}" data-record-id="${recordId}" data-action-id="${item.id}">Mark in progress</button>` : "";
    const completeButton = !isActionCompleted(item) ? `<button type="button" class="action-complete-btn" data-person-id="${personId}" data-record-id="${recordId}" data-action-id="${item.id}">Mark complete</button>` : "";
    const reopenButton = isActionCompleted(item) ? `<button type="button" class="action-reopen-btn" data-person-id="${personId}" data-record-id="${recordId}" data-action-id="${item.id}">Reopen</button>` : "";
    return `
    <li class="${itemClass}">
      <div class="action-item-header">
        <strong class="action-item-title">${escapeHtml(item.title)}</strong>
        <span class="action-item-status ${statusClass}">${statusLabel}</span>
        ${overdueBadge}
      </div>
      <p class="action-item-meta">Created: ${escapeHtml(createdDisplay)} \xB7 Due: ${escapeHtml(dueDisplay)} \xB7 Owner: ${ownerDisplay}</p>
      <p class="action-item-meta">Completed: ${escapeHtml(completedDisplay)}</p>
      ${notesLine}
      <div class="action-item-actions">
        <button type="button" class="action-edit-btn" data-person-id="${personId}" data-record-id="${recordId}" data-action-id="${item.id}">Edit</button>
        ${progressButton}
        ${completeButton}
        ${reopenButton}
        <button type="button" class="delete-action-btn" data-person-id="${personId}" data-record-id="${recordId}" data-action-id="${item.id}">Delete</button>
      </div>
    </li>
  `;
  }
  function buildActionsPanelHtml(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return '<p class="action-empty">Record not found.</p>';
    }
    const row = {
      personId,
      recordId,
      expiryDate: result.record.expiryDate,
      notes: result.record.notes
    };
    const items = (result.record.actions || []).filter(
      (item) => actionMatchesWorkspaceFilter(item)
    );
    const openItems = items.filter(
      (item) => getActionStatus(item) === ACTION_STATUSES.OPEN
    );
    const inProgressItems = items.filter(
      (item) => getActionStatus(item) === ACTION_STATUSES.IN_PROGRESS
    );
    const completedItems = items.filter((item) => isActionCompleted(item));
    const showDefaultButton = isRecordActionRequired(row);
    const defaultButton = showDefaultButton ? `<button type="button" class="action-defaults-btn" data-person-id="${personId}" data-record-id="${recordId}">Add default actions</button>` : "";
    const filterOptions = [
      { value: "all", label: "All" },
      { value: ACTION_STATUSES.OPEN, label: "Open" },
      { value: ACTION_STATUSES.IN_PROGRESS, label: "In Progress" },
      { value: ACTION_STATUSES.COMPLETED, label: "Completed" },
      { value: "overdue", label: "Overdue" }
    ];
    const filterControls = `
    <div class="action-filter-row">
      <label for="workspace-action-filter">Filter actions</label>
      <select id="workspace-action-filter" class="workspace-action-filter">
        ${filterOptions.map(
      (option) => `<option value="${option.value}"${workspaceActionFilter === option.value ? " selected" : ""}>${option.label}</option>`
    ).join("")}
      </select>
    </div>
  `;
    if ((result.record.actions || []).length === 0) {
      return `
      <p class="action-empty">No actions added yet.</p>
      <div class="action-panel-toolbar">${defaultButton}</div>
    `;
    }
    if (items.length === 0) {
      return `
      ${filterControls}
      <p class="action-empty">No actions match the current filter.</p>
      <div class="action-panel-toolbar">${defaultButton}</div>
    `;
    }
    const openSection = openItems.length > 0 ? `
        <h5 class="action-section-title">Open actions</h5>
        <ul class="action-list">${openItems.map((item) => buildActionItemHtml(personId, recordId, item)).join("")}</ul>
      ` : "";
    const inProgressSection = inProgressItems.length > 0 ? `
        <h5 class="action-section-title">In progress</h5>
        <ul class="action-list">${inProgressItems.map((item) => buildActionItemHtml(personId, recordId, item)).join("")}</ul>
      ` : "";
    const completedSection = completedItems.length > 0 ? `
        <h5 class="action-section-title">Completed actions</h5>
        <ul class="action-list">${completedItems.map((item) => buildActionItemHtml(personId, recordId, item)).join("")}</ul>
      ` : "";
    return `
    ${filterControls}
    <div class="action-panel-toolbar">${defaultButton}</div>
    ${openSection}
    ${inProgressSection}
    ${completedSection}
  `;
  }
  function refreshActiveReportPreview() {
    if (!currentReport?.type || !reportPreview || reportPreview.classList.contains("hidden")) {
      return;
    }
    renderReportPreview(buildReport(currentReport.type));
  }
  function refreshActiveInsightPreview() {
    if (!currentInsight?.type || !insightPreview || insightPreview.classList.contains("hidden")) {
      return;
    }
    renderInsightPreview(buildInsightReport(currentInsight.type));
  }
  function openRecordWorkspace(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result || !recordWorkspace) {
      return;
    }
    workspaceContext = { personId, recordId };
    recordWorkspace.classList.remove("hidden");
    recordWorkspace.setAttribute("aria-hidden", "false");
    document.body.classList.add("workspace-open");
    renderTable({ refreshDashboards: false });
  }
  function closeRecordWorkspace() {
    workspaceContext = null;
    workspaceActionFilter = "all";
    if (recordWorkspace) {
      recordWorkspace.classList.add("hidden");
      recordWorkspace.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("workspace-open");
    renderTable({ refreshDashboards: false });
  }
  function renderRecordWorkspace() {
    if (!workspaceContext || !workspaceContent) {
      return;
    }
    const result = findPersonAndRecord(workspaceContext.personId, workspaceContext.recordId);
    if (!result) {
      closeRecordWorkspace();
      return;
    }
    const { person, record } = result;
    const { personId, recordId } = workspaceContext;
    const status = getStatus(record.expiryDate);
    const daysRemaining = getDaysUntilExpiry(record.expiryDate);
    const daysClass = !Number.isNaN(daysRemaining) && daysRemaining < 0 ? " expired-text" : "";
    const evidenceSummary = getEvidenceSummary(record.evidence);
    const actionSummary = getActionSummary(record.actions);
    const evidenceCountLabel = evidenceSummary.count === 1 ? "1 document" : `${evidenceSummary.count} documents`;
    const actionMeta = `Open: ${actionSummary.openCount} \xB7 In Progress: ${actionSummary.inProgressCount} \xB7 Completed: ${actionSummary.completedCount}`;
    const existingNotesInput = workspaceContent.querySelector("#workspace-notes-input");
    const notesValue = existingNotesInput ? existingNotesInput.value : record.notes || "";
    if (workspaceTitle) {
      workspaceTitle.textContent = person.name;
    }
    if (workspaceSubtitle) {
      workspaceSubtitle.textContent = `${record.complianceType} \xB7 ${person.role}`;
    }
    workspaceContent.innerHTML = `
    <section class="workspace-section workspace-general" aria-labelledby="workspace-general-title">
      <h3 id="workspace-general-title" class="workspace-section-title">General Information</h3>
      <dl class="workspace-info-grid">
        <div class="workspace-info-item">
          <dt>Person Name</dt>
          <dd>${escapeHtml(person.name)}</dd>
        </div>
        <div class="workspace-info-item">
          <dt>Role</dt>
          <dd>${escapeHtml(person.role)}</dd>
        </div>
        <div class="workspace-info-item">
          <dt>Compliance Type</dt>
          <dd>${escapeHtml(record.complianceType)}</dd>
        </div>
        <div class="workspace-info-item">
          <dt>Status</dt>
          <dd><span class="status status-badge ${status.className}">${getStatusBadgeLabel(status.key)}</span></dd>
        </div>
        <div class="workspace-info-item">
          <dt>Expiry Date</dt>
          <dd>${escapeHtml(formatDate(record.expiryDate))}</dd>
        </div>
        <div class="workspace-info-item">
          <dt>Days Remaining</dt>
          <dd class="days-remaining${daysClass}">${escapeHtml(formatDaysRemaining(record.expiryDate))}</dd>
        </div>
        <div class="workspace-info-item">
          <dt>Renewal Cycle</dt>
          <dd>${escapeHtml(getRenewalCycleLabel(record.renewalCycle))}</dd>
        </div>
      </dl>
    </section>

    <section class="workspace-section workspace-evidence" aria-labelledby="workspace-evidence-title">
      <div class="workspace-section-header">
        <h3 id="workspace-evidence-title" class="workspace-section-title">Evidence</h3>
        <span class="workspace-section-meta">${escapeHtml(evidenceCountLabel)}</span>
        <div class="workspace-section-actions">
          <button type="button" class="evidence-add-btn" data-person-id="${personId}" data-record-id="${recordId}">Add Evidence</button>
        </div>
      </div>
      <div class="evidence-panel">
        ${buildEvidencePanelHtml(personId, recordId)}
      </div>
    </section>

    <section class="workspace-section workspace-actions" aria-labelledby="workspace-actions-title">
      <div class="workspace-section-header">
        <h3 id="workspace-actions-title" class="workspace-section-title">Actions</h3>
        <span class="workspace-section-meta">${escapeHtml(actionMeta)}</span>
        <div class="workspace-section-actions">
          <button type="button" class="actions-add-btn" data-person-id="${personId}" data-record-id="${recordId}">Add Action</button>
        </div>
      </div>
      <div class="actions-panel">
        ${buildActionsPanelHtml(personId, recordId)}
      </div>
    </section>

    <section class="workspace-section workspace-history" aria-labelledby="workspace-history-title">
      <h3 id="workspace-history-title" class="workspace-section-title">History</h3>
      <div class="history-panel">
        ${buildHistoryPanelHtml(personId, recordId)}
      </div>
    </section>

    <section class="workspace-section workspace-notes" aria-labelledby="workspace-notes-title">
      <h3 id="workspace-notes-title" class="workspace-section-title">Notes</h3>
      <textarea id="workspace-notes-input" class="workspace-notes-input" rows="5" placeholder="Follow-up notes and audit trail...">${escapeHtml(notesValue)}</textarea>
      <div class="workspace-notes-actions">
        <button type="button" id="workspace-save-notes-btn" class="workspace-save-notes-btn">Save Notes</button>
      </div>
    </section>
  `;
  }
  function handleWorkspaceRecordAction(event) {
    const button = event.target.closest("button");
    if (!button || !workspaceContext) {
      return;
    }
    const personId = Number(button.dataset.personId) || workspaceContext.personId;
    const recordId = Number(button.dataset.recordId) || workspaceContext.recordId;
    if (button.classList.contains("evidence-add-btn")) {
      openAddEvidenceModal(personId, recordId);
    } else if (button.classList.contains("delete-evidence-btn")) {
      deleteEvidenceItem(personId, recordId, Number(button.dataset.evidenceId));
    } else if (button.classList.contains("evidence-download-btn")) {
      downloadEvidenceFile(personId, recordId, Number(button.dataset.evidenceId));
    } else if (button.classList.contains("actions-add-btn")) {
      openAddActionModal(personId, recordId);
    } else if (button.classList.contains("action-edit-btn")) {
      openEditActionModal(personId, recordId, Number(button.dataset.actionId));
    } else if (button.classList.contains("action-defaults-btn")) {
      addDefaultActions(personId, recordId);
    } else if (button.classList.contains("action-progress-btn")) {
      setActionInProgress(personId, recordId, Number(button.dataset.actionId));
    } else if (button.classList.contains("action-complete-btn")) {
      completeActionItem(personId, recordId, Number(button.dataset.actionId));
    } else if (button.classList.contains("action-reopen-btn")) {
      reopenActionItem(personId, recordId, Number(button.dataset.actionId));
    } else if (button.classList.contains("delete-action-btn")) {
      deleteActionItem(personId, recordId, Number(button.dataset.actionId));
    }
  }
  function handleWorkspaceNotesSave() {
    if (!workspaceContext || !workspaceContent) {
      return;
    }
    const textarea = workspaceContent.querySelector("#workspace-notes-input");
    if (!textarea) {
      return;
    }
    updateRecordNotes(workspaceContext.personId, workspaceContext.recordId, textarea.value);
    showMessage(appMessage, "Notes saved.", "success");
    renderRecordWorkspace();
  }
  function setupRecordWorkspaceListeners() {
    if (!recordWorkspace) {
      return;
    }
    recordWorkspaceBackdrop?.addEventListener("click", closeRecordWorkspace);
    workspaceCloseBtn?.addEventListener("click", closeRecordWorkspace);
    workspaceCloseFooterBtn?.addEventListener("click", closeRecordWorkspace);
    workspaceEditBtn?.addEventListener("click", () => {
      if (!workspaceContext) {
        return;
      }
      startEdit(workspaceContext.personId, workspaceContext.recordId);
    });
    workspaceRenewBtn?.addEventListener("click", () => {
      if (!workspaceContext) {
        return;
      }
      renewComplianceRecord(workspaceContext.personId, workspaceContext.recordId);
    });
    workspaceDeleteBtn?.addEventListener("click", () => {
      if (!workspaceContext) {
        return;
      }
      deleteComplianceRecord(workspaceContext.personId, workspaceContext.recordId);
    });
    workspaceContent?.addEventListener("click", handleWorkspaceRecordAction);
    workspaceContent?.addEventListener("change", (event) => {
      if (event.target?.id === "workspace-action-filter") {
        workspaceActionFilter = event.target.value;
        renderRecordWorkspace();
      }
    });
    workspaceContent?.addEventListener("click", (event) => {
      if (event.target.closest("#workspace-save-notes-btn")) {
        handleWorkspaceNotesSave();
      }
    });
  }
  function openAddActionModal(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const { person, record } = result;
    actionModalContext = {
      personId,
      recordId,
      recordLabel: `${person.name} \u2014 ${record.complianceType}`,
      actionId: null
    };
    if (actionModalTitle) {
      actionModalTitle.textContent = "Add Action";
    }
    actionModalRecordLabel.textContent = actionModalContext.recordLabel;
    actionTitleInput.value = "";
    actionNotesInput.value = "";
    if (actionDueDateInput) {
      actionDueDateInput.value = "";
    }
    if (actionOwnerInput) {
      actionOwnerInput.value = "";
    }
    if (actionStatusRow) {
      actionStatusRow.classList.add("hidden");
    }
    hideMessage(actionModalMessage);
    actionModal.classList.remove("hidden");
    actionModal.setAttribute("aria-hidden", "false");
    actionTitleInput.focus();
  }
  function openEditActionModal(personId, recordId, actionId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const actionItem = (result.record.actions || []).find((item) => item.id === actionId);
    if (!actionItem) {
      return;
    }
    const { person, record } = result;
    actionModalContext = {
      personId,
      recordId,
      recordLabel: `${person.name} \u2014 ${record.complianceType}`,
      actionId
    };
    if (actionModalTitle) {
      actionModalTitle.textContent = "Edit Action";
    }
    actionModalRecordLabel.textContent = actionModalContext.recordLabel;
    actionTitleInput.value = actionItem.title;
    actionNotesInput.value = actionItem.notes || "";
    if (actionDueDateInput) {
      actionDueDateInput.value = actionItem.dueDate || "";
    }
    if (actionOwnerInput) {
      actionOwnerInput.value = actionItem.owner || "";
    }
    if (actionStatusInput) {
      actionStatusInput.value = getActionStatus(actionItem);
    }
    if (actionStatusRow) {
      actionStatusRow.classList.remove("hidden");
    }
    hideMessage(actionModalMessage);
    actionModal.classList.remove("hidden");
    actionModal.setAttribute("aria-hidden", "false");
    actionTitleInput.focus();
  }
  function closeActionModal() {
    if (!actionModal) {
      actionModalContext = null;
      return;
    }
    actionModal.classList.add("hidden");
    actionModal.setAttribute("aria-hidden", "true");
    actionModalContext = null;
    if (actionModalMessage) {
      hideMessage(actionModalMessage);
    }
  }
  function addActionToRecord(personId, recordId, title, notes = "", dueDate = null, owner = "") {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return false;
    }
    const actionItem = {
      id: repository.nextActionId++,
      title,
      status: ACTION_STATUSES.OPEN,
      completed: false,
      dueDate: dueDate || null,
      owner: owner || "",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      completedAt: null,
      notes
    };
    if (!Array.isArray(result.record.actions)) {
      result.record.actions = [];
    }
    result.record.actions.push(actionItem);
    appendHistoryEntry(
      result.record,
      HISTORY_ACTIONS.ACTION_ADDED,
      `Action added: ${title}.`
    );
    return true;
  }
  function updateActionItem(personId, recordId, actionId, updates) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return false;
    }
    const actionItem = (result.record.actions || []).find((item) => item.id === actionId);
    if (!actionItem) {
      return false;
    }
    actionItem.title = updates.title;
    actionItem.notes = updates.notes;
    actionItem.dueDate = updates.dueDate;
    actionItem.owner = updates.owner;
    actionItem.status = updates.status;
    syncActionCompletionFields(actionItem);
    appendHistoryEntry(
      result.record,
      HISTORY_ACTIONS.ACTION_UPDATED,
      `Action updated: ${actionItem.title}.`
    );
    return true;
  }
  function openBulkAddActionModal() {
    const count = selectedRecordKeys.size;
    if (count === 0 || !bulkActionModal) {
      showMessage(appMessage, "Select one or more records first.", "error");
      return;
    }
    bulkActionModalRecordLabel.textContent = count === 1 ? "This action will be added to 1 selected record." : `This action will be added to ${count} selected records.`;
    bulkActionTitleInput.value = "";
    bulkActionNotesInput.value = "";
    hideMessage(bulkActionModalMessage);
    bulkActionModal.classList.remove("hidden");
    bulkActionModal.setAttribute("aria-hidden", "false");
    bulkActionTitleInput.focus();
  }
  function closeBulkActionModal() {
    if (!bulkActionModal) {
      return;
    }
    bulkActionModal.classList.add("hidden");
    bulkActionModal.setAttribute("aria-hidden", "true");
    if (bulkActionModalMessage) {
      hideMessage(bulkActionModalMessage);
    }
  }
  function handleBulkSaveAction() {
    const title = bulkActionTitleInput.value.trim();
    const notes = bulkActionNotesInput.value.trim();
    if (!title) {
      showMessage(bulkActionModalMessage, "Action title is required.", "error");
      return;
    }
    const rows = getSelectedComplianceRows();
    if (rows.length === 0) {
      closeBulkActionModal();
      clearRecordSelection();
      renderTable({ refreshDashboards: false });
      return;
    }
    let addedCount = 0;
    rows.forEach((row) => {
      if (addActionToRecord(row.personId, row.recordId, title, notes)) {
        addedCount += 1;
      }
    });
    if (addedCount === 0) {
      showMessage(bulkActionModalMessage, "No records could be updated.", "error");
      return;
    }
    savePeople();
    closeBulkActionModal();
    showMessage(
      appMessage,
      `Added action "${title}" to ${addedCount} record${addedCount === 1 ? "" : "s"}.`,
      "success"
    );
    renderTable({ refreshDashboards: false });
  }
  function handleSaveAction() {
    if (!actionModalContext) {
      return;
    }
    const title = actionTitleInput.value.trim();
    const notes = actionNotesInput.value.trim();
    const dueDate = actionDueDateInput?.value.trim() || null;
    const owner = actionOwnerInput?.value.trim() || "";
    if (!title) {
      showMessage(actionModalMessage, "Action title is required.", "error");
      return;
    }
    const { personId, recordId, recordLabel, actionId } = actionModalContext;
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      closeActionModal();
      return;
    }
    if (actionId) {
      const status = actionStatusInput?.value || ACTION_STATUSES.OPEN;
      updateActionItem(personId, recordId, actionId, {
        title,
        notes,
        dueDate,
        owner,
        status
      });
      savePeople();
      closeActionModal();
      showMessage(appMessage, `Action updated for ${recordLabel}.`, "success");
      renderTable({ refreshDashboards: false });
      return;
    }
    addActionToRecord(personId, recordId, title, notes, dueDate, owner);
    savePeople();
    closeActionModal();
    showMessage(appMessage, `Action added to ${recordLabel}.`, "success");
    renderTable({ refreshDashboards: false });
  }
  function addDefaultActions(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const { person, record } = result;
    if (!Array.isArray(record.actions)) {
      record.actions = [];
    }
    const existingTitles = new Set(
      record.actions.map((item) => item.title.trim().toLowerCase())
    );
    let addedCount = 0;
    DEFAULT_ACTION_TEMPLATES.forEach((templateTitle) => {
      if (existingTitles.has(templateTitle.toLowerCase())) {
        return;
      }
      record.actions.push({
        id: repository.nextActionId++,
        title: templateTitle,
        status: ACTION_STATUSES.OPEN,
        completed: false,
        dueDate: null,
        owner: "",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        completedAt: null,
        notes: ""
      });
      appendHistoryEntry(
        record,
        HISTORY_ACTIONS.ACTION_ADDED,
        `Action added: ${templateTitle}.`
      );
      existingTitles.add(templateTitle.toLowerCase());
      addedCount += 1;
    });
    if (addedCount === 0) {
      showMessage(
        appMessage,
        `All default actions already exist for ${person.name} \u2014 ${record.complianceType}.`,
        "error"
      );
      return;
    }
    savePeople();
    showMessage(
      appMessage,
      `Added ${addedCount} default action${addedCount === 1 ? "" : "s"} to ${person.name} \u2014 ${record.complianceType}.`,
      "success"
    );
    renderTable({ refreshDashboards: false });
  }
  function setActionInProgress(personId, recordId, actionId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const actionItem = (result.record.actions || []).find((item) => item.id === actionId);
    if (!actionItem || isActionCompleted(actionItem)) {
      return;
    }
    actionItem.status = ACTION_STATUSES.IN_PROGRESS;
    syncActionCompletionFields(actionItem);
    appendHistoryEntry(
      result.record,
      HISTORY_ACTIONS.ACTION_UPDATED,
      `Action marked in progress: ${actionItem.title}.`
    );
    savePeople();
    showMessage(appMessage, `Action in progress: ${actionItem.title}.`, "success");
    renderTable({ refreshDashboards: false });
  }
  function completeActionItem(personId, recordId, actionId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const actionItem = (result.record.actions || []).find((item) => item.id === actionId);
    if (!actionItem || isActionCompleted(actionItem)) {
      return;
    }
    actionItem.status = ACTION_STATUSES.COMPLETED;
    syncActionCompletionFields(actionItem);
    appendHistoryEntry(
      result.record,
      HISTORY_ACTIONS.ACTION_COMPLETED,
      `Action completed: ${actionItem.title}.`
    );
    savePeople();
    showMessage(appMessage, `Action completed: ${actionItem.title}.`, "success");
    renderTable({ refreshDashboards: false });
  }
  function reopenActionItem(personId, recordId, actionId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const actionItem = (result.record.actions || []).find((item) => item.id === actionId);
    if (!actionItem || !isActionCompleted(actionItem)) {
      return;
    }
    actionItem.status = ACTION_STATUSES.OPEN;
    syncActionCompletionFields(actionItem);
    appendHistoryEntry(
      result.record,
      HISTORY_ACTIONS.ACTION_REOPENED,
      `Action reopened: ${actionItem.title}.`
    );
    savePeople();
    showMessage(appMessage, `Action reopened: ${actionItem.title}.`, "success");
    renderTable({ refreshDashboards: false });
  }
  function deleteActionItem(personId, recordId, actionId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const { person, record } = result;
    const actionItem = (record.actions || []).find((item) => item.id === actionId);
    if (!actionItem) {
      return;
    }
    const confirmed = confirm(
      `Delete this action?

${actionItem.title}

This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    record.actions = (record.actions || []).filter((item) => item.id !== actionId);
    appendHistoryEntry(
      record,
      HISTORY_ACTIONS.ACTION_DELETED,
      `Action deleted: ${actionItem.title}.`
    );
    savePeople();
    showMessage(
      appMessage,
      `Action deleted: ${person.name} \u2014 ${actionItem.title}.`,
      "success"
    );
    renderTable({ refreshDashboards: false });
  }
  function getActionDashboardTitle(dashboardType) {
    const titles = {
      [ACTION_DASHBOARD_TYPES.OPEN]: "Open Actions",
      [ACTION_DASHBOARD_TYPES.DUE_THIS_WEEK]: "Actions Due This Week",
      [ACTION_DASHBOARD_TYPES.OVERDUE]: "Overdue Actions",
      [ACTION_DASHBOARD_TYPES.IN_PROGRESS]: "In Progress Actions"
    };
    return titles[dashboardType] || "Action Dashboard";
  }
  function getActionDashboardFilename(dashboardType) {
    return `action-dashboard-${dashboardType.replace(/-/g, "_")}.csv`;
  }
  function getActionDashboardEntries(dashboardType) {
    return getFlattenedActionEntries().filter(({ action }) => {
      if (dashboardType === ACTION_DASHBOARD_TYPES.OPEN) {
        return getActionStatus(action) === ACTION_STATUSES.OPEN;
      }
      if (dashboardType === ACTION_DASHBOARD_TYPES.IN_PROGRESS) {
        return getActionStatus(action) === ACTION_STATUSES.IN_PROGRESS;
      }
      if (dashboardType === ACTION_DASHBOARD_TYPES.DUE_THIS_WEEK) {
        return isActionDueThisWeek(action);
      }
      if (dashboardType === ACTION_DASHBOARD_TYPES.OVERDUE) {
        return isActionOverdue(action);
      }
      return false;
    });
  }
  function buildActionDashboardPreviewRow(entry) {
    return {
      name: entry.row.name,
      role: entry.row.role,
      complianceType: entry.row.complianceType,
      actionTitle: entry.action.title,
      status: getActionStatusLabel(entry.action),
      dueDate: formatActionDueDate(entry.action.dueDate),
      owner: entry.action.owner || "\u2014",
      expiryDate: formatDate(entry.row.expiryDate)
    };
  }
  function buildActionDashboardReport(dashboardType) {
    const generatedAt = /* @__PURE__ */ new Date();
    const entries = getActionDashboardEntries(dashboardType).sort((a, b) => {
      const dueCompare = (a.action.dueDate || "9999").localeCompare(b.action.dueDate || "9999");
      if (dueCompare !== 0) {
        return dueCompare;
      }
      return a.row.name.localeCompare(b.row.name);
    });
    return {
      type: dashboardType,
      title: getActionDashboardTitle(dashboardType),
      generatedAt: generatedAt.toISOString(),
      generatedDisplay: generatedAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      totalCount: entries.length,
      columns: ACTION_DASHBOARD_PREVIEW_COLUMNS,
      tableRows: entries.map(buildActionDashboardPreviewRow),
      filename: getActionDashboardFilename(dashboardType)
    };
  }
  function renderActionDashboardPreview(report) {
    if (!actionDashboardPreview || !actionDashboardPreviewTitle || !actionDashboardPreviewMeta || !actionDashboardTableHead || !actionDashboardTableBody) {
      return;
    }
    currentActionDashboard = report;
    actionDashboardPreviewTitle.textContent = report.title;
    actionDashboardPreviewMeta.textContent = `Generated: ${report.generatedDisplay} \xB7 Actions included: ${report.totalCount}`;
    actionDashboardTableHead.innerHTML = `
    <tr>
      ${report.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
    </tr>
  `;
    if (report.tableRows.length === 0) {
      actionDashboardTableBody.innerHTML = `
      <tr>
        <td colspan="${report.columns.length}" class="insight-empty-cell">No actions match this metric.</td>
      </tr>
    `;
    } else {
      actionDashboardTableBody.innerHTML = report.tableRows.map(
        (row) => `
          <tr>
            ${report.columns.map((column) => `<td>${escapeHtml(row[column.key] ?? "")}</td>`).join("")}
          </tr>
        `
      ).join("");
    }
    actionDashboardPreview.classList.remove("hidden");
    if (actionDashboardEmptyHint) {
      actionDashboardEmptyHint.classList.add("hidden");
    }
    updateActionDashboardCardActiveState();
  }
  function showActionDashboardPreview(dashboardType) {
    renderActionDashboardPreview(buildActionDashboardReport(dashboardType));
    if (actionDashboardPreview) {
      actionDashboardPreview.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  function clearActionDashboardPreview() {
    currentActionDashboard = null;
    if (actionDashboardPreview) {
      actionDashboardPreview.classList.add("hidden");
    }
    if (actionDashboardTableHead) {
      actionDashboardTableHead.innerHTML = "";
    }
    if (actionDashboardTableBody) {
      actionDashboardTableBody.innerHTML = "";
    }
    if (actionDashboardEmptyHint) {
      actionDashboardEmptyHint.classList.remove("hidden");
    }
    updateActionDashboardCardActiveState();
  }
  function exportActionDashboardCsv() {
    if (!currentActionDashboard) {
      showMessage(appMessage, "Select an action metric to preview first.", "error");
      return;
    }
    const headerRow = currentActionDashboard.columns.map((column) => escapeCsvValue(column.label)).join(",");
    const dataRows = currentActionDashboard.tableRows.map(
      (row) => currentActionDashboard.columns.map((column) => escapeCsvValue(row[column.key] ?? "")).join(",")
    );
    const summaryLines = [
      `"Insight","${escapeCsvValue(currentActionDashboard.title)}"`,
      `"Generated","${escapeCsvValue(currentActionDashboard.generatedDisplay)}"`,
      `"Actions included","${currentActionDashboard.totalCount}"`,
      ""
    ];
    const csvContent = [...summaryLines, headerRow, ...dataRows].join("\n");
    downloadFile(csvContent, currentActionDashboard.filename, "text/csv");
    showMessage(appMessage, "Action dashboard CSV downloaded.", "success");
  }
  function updateActionDashboardCardActiveState() {
    actionDashboardCards.forEach((card) => {
      card.classList.toggle(
        "active",
        Boolean(
          currentActionDashboard && card.dataset.actionDashboard === currentActionDashboard.type
        )
      );
    });
  }
  function refreshActiveActionDashboardPreview() {
    if (!currentActionDashboard?.type || !actionDashboardPreview || actionDashboardPreview.classList.contains("hidden")) {
      return;
    }
    renderActionDashboardPreview(buildActionDashboardReport(currentActionDashboard.type));
  }
  function setupActionDashboardListeners() {
    actionDashboardCards.forEach((card) => {
      card.addEventListener("click", () => {
        showActionDashboardPreview(card.dataset.actionDashboard);
      });
    });
    exportActionDashboardCsvBtn?.addEventListener("click", exportActionDashboardCsv);
    clearActionDashboardPreviewBtn?.addEventListener("click", clearActionDashboardPreview);
  }
  function renderActionSummaryCards() {
    const metrics = getGlobalActionMetrics();
    if (actionDashboardOpen) {
      actionDashboardOpen.textContent = metrics.openActions;
    }
    if (actionDashboardDueWeek) {
      actionDashboardDueWeek.textContent = metrics.dueThisWeek;
    }
    if (actionDashboardOverdue) {
      actionDashboardOverdue.textContent = metrics.overdueActions;
    }
    if (actionDashboardInProgress) {
      actionDashboardInProgress.textContent = metrics.inProgressActions;
    }
  }
  function setupBulkActionModalListeners() {
    if (!bulkActionModal) {
      return;
    }
    bulkActionModal.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) {
        return;
      }
      if (target === bulkActionModal) {
        closeBulkActionModal();
        return;
      }
      const templateButton = target.closest(".bulk-action-template-btn");
      if (templateButton) {
        bulkActionTitleInput.value = templateButton.dataset.title || "";
        bulkActionTitleInput.focus();
        return;
      }
      const actionButton = target.closest(
        "#bulk-action-save-btn, #bulk-action-cancel-btn, #bulk-action-modal-close-btn"
      );
      if (!actionButton) {
        return;
      }
      event.preventDefault();
      if (actionButton.id === "bulk-action-save-btn") {
        handleBulkSaveAction();
      } else {
        closeBulkActionModal();
      }
    });
  }
  function setupBulkSelectionListeners() {
    bulkClearSelectionBtn?.addEventListener("click", () => {
      clearRecordSelection();
      renderTable({ refreshDashboards: false });
    });
    bulkExportCsvBtn?.addEventListener("click", exportSelectedToCsv);
    bulkAddActionBtn?.addEventListener("click", openBulkAddActionModal);
    bulkMarkRemindersBtn?.addEventListener("click", bulkMarkSelectedRemindersSent);
    selectAllPageCheckbox?.addEventListener("change", () => {
      const filteredRows = sortComplianceRows(getFilteredComplianceRows());
      const pageRows = paginateRows(filteredRows);
      toggleSelectAllOnPage(pageRows, selectAllPageCheckbox.checked);
      renderTable({ refreshDashboards: false });
    });
    if (tableBody) {
      tableBody.addEventListener("change", (event) => {
        const checkbox = event.target;
        if (!checkbox.matches(".row-select-checkbox")) {
          return;
        }
        toggleRecordSelection(
          Number(checkbox.dataset.personId),
          Number(checkbox.dataset.recordId),
          checkbox.checked
        );
        const filteredRows = sortComplianceRows(getFilteredComplianceRows());
        updateSelectAllPageCheckbox(paginateRows(filteredRows));
        tableBody.querySelectorAll(".row-select-checkbox").forEach((input) => {
          const row = input.closest("tr");
          const isChecked = selectedRecordKeys.has(
            actionRowKey(Number(input.dataset.personId), Number(input.dataset.recordId))
          );
          input.checked = isChecked;
          row?.classList.toggle("row-selected", isChecked);
        });
      });
    }
  }
  function setupActionModalListeners() {
    if (!actionModal) {
      return;
    }
    actionModal.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) {
        return;
      }
      if (target === actionModal) {
        closeActionModal();
        return;
      }
      const actionButton = target.closest(
        "#action-save-btn, #action-cancel-btn, #action-modal-close-btn"
      );
      if (!actionButton) {
        return;
      }
      event.preventDefault();
      if (actionButton.id === "action-save-btn") {
        handleSaveAction();
      } else {
        closeActionModal();
      }
    });
  }
  function getAllComplianceRows() {
    const rows = [];
    repository.people.forEach((person) => {
      person.complianceRecords.forEach((record) => {
        rows.push({
          personId: person.id,
          recordId: record.id,
          name: person.name,
          role: person.role,
          complianceType: record.complianceType,
          expiryDate: record.expiryDate,
          renewalCycle: record.renewalCycle || RENEWAL_CYCLE_MANUAL,
          notes: record.notes || "",
          history: record.history || [],
          evidence: record.evidence || [],
          actions: record.actions || []
        });
      });
    });
    return rows;
  }
  function findPersonById(personId) {
    return repository.people.find((person) => person.id === personId);
  }
  function findPersonByName(name) {
    const trimmed = name.trim().toLowerCase();
    return repository.people.find((person) => person.name.trim().toLowerCase() === trimmed);
  }
  function findPersonAndRecord(personId, recordId) {
    const person = findPersonById(personId);
    if (!person) return null;
    const record = person.complianceRecords.find((item) => item.id === recordId);
    if (!record) return null;
    return { person, record };
  }
  function getTotalRecordCount() {
    return getAllComplianceRows().length;
  }
  function loadReminderSettings() {
    settingsRepository.load();
    reminderSettings = settingsRepository.getSettings();
    syncReminderSettingsUI();
  }
  function saveReminderSettings() {
    settingsRepository.setSettings(reminderSettings);
  }
  function syncReminderSettingsUI() {
    if (reminderDays30 && reminderDays14 && reminderDays7) {
      reminderDays30.checked = reminderSettings.days30;
      reminderDays14.checked = reminderSettings.days14;
      reminderDays7.checked = reminderSettings.days7;
    }
    if (hideSentRemindersCheckbox) {
      hideSentRemindersCheckbox.checked = reminderSettings.hideSentReminders;
    }
  }
  function isHideSentRemindersEnabled() {
    if (hideSentRemindersCheckbox) {
      return hideSentRemindersCheckbox.checked;
    }
    return reminderSettings.hideSentReminders === true;
  }
  function handleReminderSettingsChange() {
    reminderSettings = {
      days30: reminderDays30.checked,
      days14: reminderDays14.checked,
      days7: reminderDays7.checked,
      hideSentReminders: hideSentRemindersCheckbox ? hideSentRemindersCheckbox.checked : false
    };
    saveReminderSettings();
    renderReminders();
  }
  function getActiveReminderDays() {
    const activeDays = [];
    if (reminderSettings.days30) {
      activeDays.push(30);
    }
    if (reminderSettings.days14) {
      activeDays.push(14);
    }
    if (reminderSettings.days7) {
      activeDays.push(7);
    }
    return activeDays;
  }
  function validatePersonInput(name, role, complianceType, dbsExpiry) {
    const errors = [];
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    const normalizedType = repository.normalizeComplianceType(complianceType);
    if (!trimmedName) {
      errors.push("Name cannot be blank.");
    }
    if (!trimmedRole) {
      errors.push("Role cannot be blank.");
    }
    if (!dbsExpiry) {
      errors.push("Expiry date is required.");
    } else if (!isValidExpiryDate(dbsExpiry)) {
      errors.push("Expiry date must be a valid date (YYYY-MM-DD).");
    }
    return {
      valid: errors.length === 0,
      errors,
      name: trimmedName,
      role: trimmedRole,
      complianceType: normalizedType,
      dbsExpiry
    };
  }
  function showMessage(element, text, type) {
    element.textContent = text;
    element.classList.remove("hidden", "message-success", "message-error");
    element.classList.add(type === "success" ? "message-success" : "message-error");
  }
  function hideMessage(element) {
    element.classList.add("hidden");
    element.textContent = "";
  }
  function loadPeople() {
    const result = repository.load({
      onLoadError: () => {
        showMessage(
          appMessage,
          "Your saved data could not be loaded, so the sample data has been restored.",
          "error"
        );
      }
    });
    if (result.isFirstVisit || result.usedSample) {
      applySampleData();
      savePeople();
    }
  }
  function resetSampleData() {
    const confirmed = confirm(
      "This will replace all current people with the original 20 sample people. Continue?"
    );
    if (!confirmed) return;
    applySampleData();
    savePeople();
    hideEditForm();
    hideMessage(editFormMessage);
    clearAllFilters();
    expandedHistoryRows.clear();
    expandedEvidenceRows.clear();
    expandedActionRows.clear();
    selectedRecordKeys.clear();
    closeRecordWorkspace();
    showMessage(appMessage, "Sample data has been restored.", "success");
    renderTable();
  }
  function formatDate(dateString) {
    const date = parseDateAtMidnight(dateString);
    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }
  function getDaysUntilExpiry(expiryDate) {
    const today = getTodayAtMidnight();
    const expiry = parseDateAtMidnight(expiryDate);
    if (Number.isNaN(expiry.getTime())) {
      return NaN;
    }
    const diffMs = expiry.getTime() - today.getTime();
    return Math.round(diffMs / (1e3 * 60 * 60 * 24));
  }
  function formatDaysRemaining(expiryDate) {
    const daysRemaining = getDaysUntilExpiry(expiryDate);
    if (Number.isNaN(daysRemaining)) {
      return "\u2014";
    }
    if (daysRemaining < 0) {
      return "Expired";
    }
    if (daysRemaining === 0) {
      return "0 (today)";
    }
    return String(daysRemaining);
  }
  function getStatus(expiryDate) {
    const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
    if (daysUntilExpiry < 0) {
      return { label: "Expired", className: "status-expired", key: "expired" };
    }
    if (daysUntilExpiry <= DUE_SOON_DAYS) {
      return { label: "Due Soon", className: "status-due-soon", key: "dueSoon" };
    }
    return { label: "Valid", className: "status-valid", key: "valid" };
  }
  function getStatusBadgeLabel(statusKey) {
    if (statusKey === "dueSoon") {
      return "Expiring Soon";
    }
    if (statusKey === "valid") {
      return "Valid";
    }
    return "Expired";
  }
  function resetTablePage() {
    currentTablePage = 1;
  }
  function clampTablePage(filteredCount) {
    const totalPages = Math.max(1, Math.ceil(filteredCount / RECORDS_PER_PAGE));
    if (currentTablePage > totalPages) {
      currentTablePage = totalPages;
    }
    if (currentTablePage < 1) {
      currentTablePage = 1;
    }
  }
  function paginateRows(rows) {
    const startIndex = (currentTablePage - 1) * RECORDS_PER_PAGE;
    return rows.slice(startIndex, startIndex + RECORDS_PER_PAGE);
  }
  function getFilteredSummaryCounts(rows) {
    const counts = { total: 0, valid: 0, dueSoon: 0, expired: 0 };
    rows.forEach((row) => {
      counts.total += 1;
      const status = getStatus(row.expiryDate);
      counts[status.key] += 1;
    });
    return counts;
  }
  function renderRegisterSummaryStrip(filteredRows) {
    if (!stripTotal) {
      return;
    }
    const counts = getFilteredSummaryCounts(filteredRows);
    stripTotal.textContent = counts.total;
    stripValid.textContent = counts.valid;
    stripDueSoon.textContent = counts.dueSoon;
    stripExpired.textContent = counts.expired;
  }
  function renderPagination(filteredCount, visibleCount) {
    if (!paginationSummary) {
      return;
    }
    if (filteredCount === 0) {
      paginationSummary.textContent = "";
      if (paginationControls) {
        paginationControls.classList.add("hidden");
      }
      return;
    }
    const startIndex = (currentTablePage - 1) * RECORDS_PER_PAGE + 1;
    const endIndex = startIndex + visibleCount - 1;
    paginationSummary.textContent = `Showing ${startIndex}-${endIndex} of ${filteredCount} records`;
    if (!paginationControls || !paginationPrevBtn || !paginationNextBtn) {
      return;
    }
    const showPagination = filteredCount > RECORDS_PER_PAGE;
    paginationControls.classList.toggle("hidden", !showPagination);
    paginationPrevBtn.disabled = currentTablePage <= 1;
    paginationNextBtn.disabled = currentTablePage >= Math.ceil(filteredCount / RECORDS_PER_PAGE);
  }
  function refreshRegisterView({ resetPage = false, clearSelection = false } = {}) {
    if (clearSelection) {
      clearRecordSelection();
    }
    if (resetPage) {
      resetTablePage();
    }
    renderTable();
  }
  function countExpiringWithinDays(days) {
    return getAllComplianceRows().filter((row) => {
      const daysRemaining = getDaysUntilExpiry(row.expiryDate);
      if (Number.isNaN(daysRemaining)) {
        return false;
      }
      return daysRemaining >= 0 && daysRemaining <= days;
    }).length;
  }
  function getReminderForRecord(record) {
    const daysRemaining = getDaysUntilExpiry(record.expiryDate);
    if (Number.isNaN(daysRemaining)) {
      return null;
    }
    if (daysRemaining < 0) {
      return {
        reminderType: REMINDER_LABELS.expired,
        urgencyKey: "expired"
      };
    }
    if (reminderSettings.days7 && daysRemaining <= 7) {
      return { reminderType: REMINDER_LABELS[7], urgencyKey: 7 };
    }
    if (reminderSettings.days14 && daysRemaining <= 14) {
      return { reminderType: REMINDER_LABELS[14], urgencyKey: 14 };
    }
    if (reminderSettings.days30 && daysRemaining <= 30) {
      return { reminderType: REMINDER_LABELS[30], urgencyKey: 30 };
    }
    return null;
  }
  function getReminderSentText(reminderType) {
    if (reminderType === REMINDER_LABELS.expired) {
      return "Expired Reminder Sent";
    }
    return `${reminderType} Sent`;
  }
  function formatAuditDate(date = /* @__PURE__ */ new Date()) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  function hasReminderBeenSent(notes, sentLabel) {
    if (!notes) {
      return false;
    }
    return notes.split(/\r?\n/).some((line) => line.includes(sentLabel));
  }
  function isReminderTypeMarkedSent(notes, reminderType) {
    return hasReminderBeenSent(notes, getReminderSentText(reminderType));
  }
  function getRecordNotes(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    return result ? result.record.notes || "" : "";
  }
  function refreshActionRequiredUI() {
    renderReminders();
    requestAnimationFrame(() => {
      renderReminders();
    });
  }
  function applyReminderSent(personId, recordId, reminderType) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return { status: "not_found" };
    }
    const sentText = getReminderSentText(reminderType);
    const existingNotes = result.record.notes || "";
    if (isReminderTypeMarkedSent(existingNotes, reminderType)) {
      return { status: "skipped", reason: "already_sent" };
    }
    const auditLine = `${formatAuditDate()} - ${sentText}`;
    result.record.notes = existingNotes ? `${existingNotes}
${auditLine}` : auditLine;
    appendHistoryEntry(
      result.record,
      HISTORY_ACTIONS.REMINDER_SENT,
      `${sentText} recorded.`
    );
    return { status: "marked", notes: result.record.notes };
  }
  function markReminderSent(personId, recordId, reminderType, { silent = false } = {}) {
    const outcome = applyReminderSent(personId, recordId, reminderType);
    if (outcome.status === "not_found") {
      return outcome;
    }
    if (outcome.status === "skipped") {
      if (!silent) {
        showMessage(
          appMessage,
          `This ${getReminderSentText(reminderType).toLowerCase()} entry is already recorded.`,
          "error"
        );
      }
      return outcome;
    }
    savePeople();
    syncNotesInTable(personId, recordId, outcome.notes);
    refreshActionRequiredUI();
    if (!silent) {
      const sentText = getReminderSentText(reminderType);
      showMessage(appMessage, `Recorded: ${formatAuditDate()} - ${sentText}`, "success");
    }
    return outcome;
  }
  function bulkMarkSelectedRemindersSent() {
    const rows = getSelectedComplianceRows();
    if (rows.length === 0) {
      showMessage(appMessage, "Select one or more records first.", "error");
      return;
    }
    let markedCount = 0;
    let skippedNoReminder = 0;
    let skippedAlreadySent = 0;
    rows.forEach((row) => {
      const reminder = getReminderForRecord({ expiryDate: row.expiryDate });
      if (!reminder) {
        skippedNoReminder += 1;
        return;
      }
      const outcome = applyReminderSent(
        row.personId,
        row.recordId,
        reminder.reminderType
      );
      if (outcome.status === "marked") {
        markedCount += 1;
        syncNotesInTable(row.personId, row.recordId, outcome.notes);
      } else if (outcome.status === "skipped") {
        skippedAlreadySent += 1;
      }
    });
    if (markedCount > 0) {
      savePeople();
      refreshActionRequiredUI();
      renderTable({ refreshDashboards: false });
    }
    if (markedCount === 0 && skippedNoReminder === rows.length) {
      showMessage(
        appMessage,
        "None of the selected records have an active reminder.",
        "error"
      );
      return;
    }
    const parts = [];
    if (markedCount > 0) {
      parts.push(
        `Marked reminders sent for ${markedCount} record${markedCount === 1 ? "" : "s"}`
      );
    }
    if (skippedAlreadySent > 0) {
      parts.push(
        `skipped ${skippedAlreadySent} already sent`
      );
    }
    if (skippedNoReminder > 0) {
      parts.push(
        `skipped ${skippedNoReminder} with no active reminder`
      );
    }
    showMessage(
      appMessage,
      parts.join("; ") + ".",
      markedCount > 0 ? "success" : "error"
    );
  }
  function syncNotesInTable(personId, recordId, notes) {
    const textarea = tableBody.querySelector(
      `.notes-input[data-person-id="${personId}"][data-record-id="${recordId}"]`
    );
    if (textarea) {
      textarea.value = notes;
    }
  }
  function buildActiveReminders() {
    const reminders = [];
    getAllComplianceRows().forEach((row) => {
      const reminder = getReminderForRecord({
        expiryDate: row.expiryDate
      });
      if (!reminder) {
        return;
      }
      reminders.push({
        personId: row.personId,
        recordId: row.recordId,
        name: row.name,
        complianceType: row.complianceType,
        expiryDate: row.expiryDate,
        reminderType: reminder.reminderType,
        urgencyKey: reminder.urgencyKey,
        daysRemaining: getDaysUntilExpiry(row.expiryDate)
      });
    });
    reminders.sort((a, b) => {
      const urgencyA = REMINDER_URGENCY[a.urgencyKey];
      const urgencyB = REMINDER_URGENCY[b.urgencyKey];
      if (urgencyA !== urgencyB) {
        return urgencyA - urgencyB;
      }
      return a.daysRemaining - b.daysRemaining || a.name.localeCompare(b.name);
    });
    return reminders;
  }
  function filterVisibleActionRequiredReminders(activeReminders) {
    if (!isHideSentRemindersEnabled()) {
      return activeReminders;
    }
    return activeReminders.filter((reminder) => {
      if (reminder.urgencyKey === "expired") {
        return true;
      }
      const notes = getRecordNotes(reminder.personId, reminder.recordId);
      return !isReminderTypeMarkedSent(notes, reminder.reminderType);
    });
  }
  function syncExpiryWindowFilterToUI() {
    if (!expiryWindowFilterSelect) {
      return;
    }
    expiryWindowFilterSelect.value = expiryWindowFilter === null ? "all" : String(expiryWindowFilter);
  }
  function setExpiryWindowFilter(days) {
    expiryWindowFilter = days;
    syncExpiryWindowFilterToUI();
  }
  function areStatusAndExpiryCompatible(statusKey, expiryDays) {
    if (expiryDays === null || statusKey === "all") {
      return true;
    }
    return statusKey === "dueSoon";
  }
  function getActiveTableFilters() {
    return {
      search: searchInput.value.trim(),
      status: statusFilter.value,
      complianceType: complianceTypeFilter.value,
      expiryWindow: expiryWindowFilter
    };
  }
  function hasExtraTableFilters(filters) {
    return filters.search !== "" || filters.complianceType !== "all";
  }
  function reconcileStatusExpiryFilters(changedBy) {
    const status = statusFilter.value;
    const expiry = expiryWindowFilter;
    if (areStatusAndExpiryCompatible(status, expiry)) {
      return;
    }
    if (changedBy === "status") {
      setExpiryWindowFilter(null);
      showMessage(
        appMessage,
        "Expiry window filter cleared \u2014 it can't be combined with the selected status.",
        "error"
      );
      return;
    }
    if (changedBy === "expiry") {
      statusFilter.value = "all";
      showMessage(
        appMessage,
        "Status filter cleared \u2014 it can't be combined with an expiry window.",
        "error"
      );
    }
  }
  function matchesSearchTerm(row, searchTerm) {
    if (!searchTerm) {
      return true;
    }
    const term = searchTerm.toLowerCase();
    return row.name.toLowerCase().includes(term) || row.role.toLowerCase().includes(term) || row.complianceType.toLowerCase().includes(term) || getRenewalCycleLabel(row.renewalCycle).toLowerCase().includes(term) || (row.notes || "").toLowerCase().includes(term) || row.expiryDate.toLowerCase().includes(term) || formatDate(row.expiryDate).toLowerCase().includes(term);
  }
  function matchesExpiryWindow(row, days) {
    if (days === null) {
      return true;
    }
    const daysUntilExpiry = getDaysUntilExpiry(row.expiryDate);
    return daysUntilExpiry >= 0 && daysUntilExpiry <= days;
  }
  function getFilteredComplianceRows() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const selectedComplianceType = complianceTypeFilter.value;
    return getAllComplianceRows().filter((row) => {
      if (!matchesSearchTerm(row, searchTerm)) {
        return false;
      }
      const status = getStatus(row.expiryDate);
      const matchesStatus = selectedStatus === "all" || status.key === selectedStatus;
      const matchesComplianceType = selectedComplianceType === "all" || row.complianceType === selectedComplianceType;
      if (!matchesExpiryWindow(row, expiryWindowFilter)) {
        return false;
      }
      return matchesStatus && matchesComplianceType;
    });
  }
  function getActiveFilterChips() {
    const chips = [];
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
      chips.push({ id: "search", label: `Search: ${searchTerm}` });
    }
    if (statusFilter.value !== "all") {
      chips.push({
        id: "status",
        label: `Status: ${STATUS_FILTER_LABELS[statusFilter.value] || statusFilter.value}`
      });
    }
    if (complianceTypeFilter.value !== "all") {
      chips.push({
        id: "type",
        label: `Type: ${complianceTypeFilter.value}`
      });
    }
    if (expiryWindowFilter !== null) {
      chips.push({
        id: "expiry",
        label: `Expiring within: ${expiryWindowFilter} days`
      });
    }
    return chips;
  }
  function clearActiveFilter(filterId) {
    if (filterId === "search") {
      searchInput.value = "";
    } else if (filterId === "status") {
      statusFilter.value = "all";
    } else if (filterId === "type") {
      complianceTypeFilter.value = "all";
    } else if (filterId === "expiry") {
      setExpiryWindowFilter(null);
    }
    updateFilterActiveState();
    refreshRegisterView({ resetPage: true, clearSelection: true });
  }
  function renderActiveFilters() {
    if (!activeFilterChips || !clearFiltersBtn) {
      return;
    }
    const chips = getActiveFilterChips();
    activeFilterChips.innerHTML = "";
    chips.forEach((chip) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "active-filter-chip";
      button.dataset.filterId = chip.id;
      button.textContent = `${chip.label} \xD7`;
      activeFilterChips.appendChild(button);
    });
    clearFiltersBtn.classList.toggle("hidden", chips.length === 0);
  }
  function sortComplianceRows(list) {
    const sortValue = sortBySelect ? sortBySelect.value : "expiry-asc";
    const sorted = [...list];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortValue === "name-asc" || sortValue === "name-desc") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortValue === "category-asc" || sortValue === "category-desc") {
        comparison = a.complianceType.localeCompare(b.complianceType) || a.name.localeCompare(b.name);
      } else {
        comparison = a.expiryDate.localeCompare(b.expiryDate);
      }
      if (sortValue === "name-desc" || sortValue === "category-desc" || sortValue === "expiry-desc") {
        comparison *= -1;
      }
      return comparison;
    });
    return sorted;
  }
  function getSummaryCounts() {
    const counts = { total: 0, valid: 0, dueSoon: 0, expired: 0 };
    getAllComplianceRows().forEach((row) => {
      counts.total += 1;
      const status = getStatus(row.expiryDate);
      counts[status.key] += 1;
    });
    return counts;
  }
  function getAnalyticsCounts() {
    const counts = {
      total: 0,
      compliant: 0,
      expiring30: 0,
      expiring60: 0,
      expiring90: 0,
      expired: 0,
      healthPercent: 0
    };
    getAllComplianceRows().forEach((row) => {
      counts.total += 1;
      const daysRemaining = getDaysUntilExpiry(row.expiryDate);
      if (Number.isNaN(daysRemaining)) {
        return;
      }
      const status = getStatus(row.expiryDate);
      if (status.key === "expired") {
        counts.expired += 1;
      } else if (status.key === "valid") {
        counts.compliant += 1;
      }
      if (daysRemaining >= 0 && daysRemaining <= 30) {
        counts.expiring30 += 1;
      }
      if (daysRemaining >= 0 && daysRemaining <= 60) {
        counts.expiring60 += 1;
      }
      if (daysRemaining >= 0 && daysRemaining <= 90) {
        counts.expiring90 += 1;
      }
    });
    counts.healthPercent = counts.total === 0 ? 0 : Math.round(counts.compliant / counts.total * 100);
    return counts;
  }
  function renderSummary() {
    const counts = getSummaryCounts();
    summaryTotal.textContent = counts.total;
    summaryValid.textContent = counts.valid;
    summaryDueSoon.textContent = counts.dueSoon;
    summaryExpired.textContent = counts.expired;
    renderActionSummaryCards();
    renderManagementInsights();
    updateSummaryActiveState();
  }
  function renderAnalytics() {
    if (!analyticsHealthScore) {
      return;
    }
    const counts = getAnalyticsCounts();
    analyticsTotal.textContent = counts.total;
    analyticsCompliant.textContent = counts.compliant;
    analyticsExpiring30.textContent = counts.expiring30;
    analyticsExpiring60.textContent = counts.expiring60;
    analyticsExpiring90.textContent = counts.expiring90;
    analyticsExpired.textContent = counts.expired;
    analyticsHealthScore.textContent = `${counts.healthPercent}%`;
    analyticsHealthScore.classList.remove("health-high", "health-medium", "health-low");
    if (counts.healthPercent >= 80) {
      analyticsHealthScore.classList.add("health-high");
    } else if (counts.healthPercent >= 50) {
      analyticsHealthScore.classList.add("health-medium");
    } else {
      analyticsHealthScore.classList.add("health-low");
    }
  }
  function renderDashboard() {
    if (dashboardAllCount) {
      dashboardAllCount.textContent = getTotalRecordCount();
    }
    dashboard30Count.textContent = countExpiringWithinDays(30);
    dashboard60Count.textContent = countExpiringWithinDays(60);
    dashboard90Count.textContent = countExpiringWithinDays(90);
    renderReminders();
    updateFilterActiveState();
  }
  function renderReminders() {
    if (!dashboardActionCount || !remindersTableBody || !remindersEmpty) {
      return;
    }
    const activeReminders = buildActiveReminders();
    const reminders = filterVisibleActionRequiredReminders(activeReminders);
    const activeDays = getActiveReminderDays();
    const hideSent = isHideSentRemindersEnabled();
    dashboardActionCount.textContent = reminders.length;
    remindersTableBody.innerHTML = "";
    if (reminders.length === 0) {
      if (activeDays.length === 0) {
        remindersEmpty.textContent = "All reminder periods are turned off. Turn on a setting above to see reminders.";
      } else if (activeReminders.length > 0 && hideSent) {
        remindersEmpty.textContent = "All active reminders have been marked as sent.";
      } else {
        remindersEmpty.textContent = "No action required right now.";
      }
      remindersEmpty.classList.remove("hidden");
      return;
    }
    remindersEmpty.classList.add("hidden");
    reminders.forEach((reminder) => {
      const row = document.createElement("tr");
      const notes = getRecordNotes(reminder.personId, reminder.recordId);
      const alreadySent = isReminderTypeMarkedSent(notes, reminder.reminderType);
      row.innerHTML = `
      <td>${reminder.name}</td>
      <td>${reminder.complianceType}</td>
      <td>${formatDate(reminder.expiryDate)}</td>
      <td><span class="reminder-badge reminder-${reminder.urgencyKey}">${reminder.reminderType}</span></td>
      <td>
        <button
          type="button"
          class="mark-sent-btn"
          data-person-id="${reminder.personId}"
          data-record-id="${reminder.recordId}"
          data-reminder-type="${reminder.reminderType}"
          ${alreadySent ? "disabled" : ""}
        >${alreadySent ? "Sent" : "Mark Sent"}</button>
      </td>
    `;
      remindersTableBody.appendChild(row);
    });
  }
  function updateSummaryActiveState() {
    const filters = getActiveTableFilters();
    const extraFilters = hasExtraTableFilters(filters);
    summaryCards.forEach((card) => {
      const cardStatus = card.dataset.status;
      let isActive = false;
      if (cardStatus === "all") {
        isActive = !extraFilters && filters.status === "all" && filters.expiryWindow === null;
      } else if (cardStatus === "dueSoon") {
        isActive = !extraFilters && filters.status === "dueSoon" && areStatusAndExpiryCompatible("dueSoon", filters.expiryWindow);
      } else {
        isActive = !extraFilters && filters.status === cardStatus && filters.expiryWindow === null;
      }
      card.classList.toggle("active", isActive);
    });
  }
  function updateDashboardActiveState() {
    const filters = getActiveTableFilters();
    const extraFilters = hasExtraTableFilters(filters);
    dashboardCards.forEach((card) => {
      const days = Number(card.dataset.days);
      const isActive = !extraFilters && filters.expiryWindow === days && areStatusAndExpiryCompatible(filters.status, days);
      card.classList.toggle("active", isActive);
    });
  }
  function updateDashboardAllActiveState() {
    if (!dashboardAllCard) {
      return;
    }
    const filters = getActiveTableFilters();
    const extraFilters = hasExtraTableFilters(filters);
    const isActive = !extraFilters && filters.status === "all" && filters.complianceType === "all" && filters.expiryWindow === null;
    dashboardAllCard.classList.toggle("active", isActive);
  }
  function updateFilterActiveState() {
    updateSummaryActiveState();
    updateDashboardActiveState();
    updateDashboardAllActiveState();
    updateAnalyticsActiveState();
  }
  function updateAnalyticsActiveState() {
    const filters = getActiveTableFilters();
    const extraFilters = hasExtraTableFilters(filters);
    analyticsCards.forEach((card) => {
      const filter = card.dataset.analyticsFilter;
      let isActive = false;
      if (filter === "all") {
        isActive = !extraFilters && filters.status === "all" && filters.expiryWindow === null;
      } else if (filter === "valid") {
        isActive = !extraFilters && filters.status === "valid" && filters.expiryWindow === null;
      } else if (filter === "expired") {
        isActive = !extraFilters && filters.status === "expired" && filters.expiryWindow === null;
      } else if (filter === "expiring-30") {
        isActive = !extraFilters && filters.expiryWindow === 30 && areStatusAndExpiryCompatible(filters.status, 30);
      } else if (filter === "expiring-60") {
        isActive = !extraFilters && filters.expiryWindow === 60 && areStatusAndExpiryCompatible(filters.status, 60);
      } else if (filter === "expiring-90") {
        isActive = !extraFilters && filters.expiryWindow === 90 && areStatusAndExpiryCompatible(filters.status, 90);
      }
      card.classList.toggle("active", isActive);
    });
  }
  function clearAllFilters() {
    searchInput.value = "";
    statusFilter.value = "all";
    complianceTypeFilter.value = "all";
    setExpiryWindowFilter(null);
    resetTablePage();
    updateFilterActiveState();
  }
  function showAllPeople() {
    clearAllFilters();
    clearRecordSelection();
    renderTable();
    peopleSection.scrollIntoView({ behavior: "smooth" });
  }
  function filterByExpiryWindow(days) {
    clearRecordSelection();
    setExpiryWindowFilter(days);
    searchInput.value = "";
    statusFilter.value = "all";
    complianceTypeFilter.value = "all";
    if (sortBySelect) {
      sortBySelect.value = "expiry-asc";
    }
    updateFilterActiveState();
    refreshRegisterView({ resetPage: true });
    peopleSection.scrollIntoView({ behavior: "smooth" });
  }
  function filterByStatus(statusKey) {
    clearRecordSelection();
    setExpiryWindowFilter(null);
    searchInput.value = "";
    statusFilter.value = statusKey;
    complianceTypeFilter.value = "all";
    updateFilterActiveState();
    refreshRegisterView({ resetPage: true });
    peopleSection.scrollIntoView({ behavior: "smooth" });
  }
  function filterByAnalyticsCard(filterKey) {
    if (filterKey === "all") {
      showAllPeople();
      return;
    }
    if (filterKey === "valid") {
      filterByStatus("valid");
      return;
    }
    if (filterKey === "expired") {
      filterByStatus("expired");
      return;
    }
    if (filterKey === "expiring-30") {
      filterByExpiryWindow(30);
      return;
    }
    if (filterKey === "expiring-60") {
      filterByExpiryWindow(60);
      return;
    }
    if (filterKey === "expiring-90") {
      filterByExpiryWindow(90);
    }
  }
  function startEdit(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) return;
    const { person, record } = result;
    editIdInput.value = person.id;
    editRecordIdInput.value = record.id;
    document.getElementById("edit-name").value = person.name;
    document.getElementById("edit-role").value = person.role;
    document.getElementById("edit-compliance-type").value = record.complianceType;
    document.getElementById("edit-dbs-expiry").value = record.expiryDate;
    document.getElementById("edit-renewal-cycle").value = record.renewalCycle || RENEWAL_CYCLE_MANUAL;
    document.getElementById("edit-notes").value = record.notes || "";
    hideMessage(editFormMessage);
    editSection.classList.remove("hidden");
    editSection.scrollIntoView({ behavior: "smooth" });
  }
  function hideEditForm() {
    editSection.classList.add("hidden");
    editForm.reset();
    hideMessage(editFormMessage);
  }
  function updatePerson(personId, recordId, name, role, complianceType, expiryDate, notes, renewalCycle) {
    const validation = validatePersonInput(name, role, complianceType, expiryDate);
    if (!validation.valid) {
      showMessage(editFormMessage, validation.errors.join(" "), "error");
      return false;
    }
    const result = findPersonAndRecord(personId, recordId);
    if (!result) return false;
    const { person, record } = result;
    const normalizedCycle = repository.normalizeRenewalCycle(renewalCycle);
    const previousCycle = repository.normalizeRenewalCycle(record.renewalCycle);
    const changes = [];
    let cycleChanged = false;
    if (person.name !== validation.name) {
      changes.push(`name to "${validation.name}"`);
    }
    if (person.role !== validation.role) {
      changes.push(`role to "${validation.role}"`);
    }
    if (record.complianceType !== validation.complianceType) {
      changes.push(`type to ${validation.complianceType}`);
    }
    const normalizedExpiry = normalizeExpiryDate(validation.dbsExpiry);
    if (record.expiryDate !== normalizedExpiry) {
      changes.push(`expiry to ${formatDate(normalizedExpiry)}`);
    }
    if ((record.notes || "") !== notes) {
      changes.push("notes updated");
    }
    if (previousCycle !== normalizedCycle) {
      cycleChanged = true;
    }
    if (changes.length === 0 && !cycleChanged) {
      hideEditForm();
      showMessage(appMessage, "No changes made.", "error");
      return false;
    }
    person.name = validation.name;
    person.role = validation.role;
    record.complianceType = validation.complianceType;
    record.expiryDate = normalizedExpiry;
    record.notes = notes;
    record.renewalCycle = normalizedCycle;
    if (cycleChanged) {
      appendHistoryEntry(
        record,
        HISTORY_ACTIONS.EDITED,
        `Renewal cycle changed from ${getRenewalCycleLabel(previousCycle)} to ${getRenewalCycleLabel(normalizedCycle)}.`
      );
    }
    if (changes.length > 0) {
      appendHistoryEntry(
        record,
        HISTORY_ACTIONS.EDITED,
        `Record updated (${changes.join("; ")}).`
      );
    }
    savePeople();
    hideEditForm();
    showMessage(
      appMessage,
      `Record updated: ${validation.name} \u2014 ${validation.complianceType}.`,
      "success"
    );
    renderTable();
    return true;
  }
  function updateRecordNotes(personId, recordId, notes) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) return;
    const currentNotes = result.record.notes || "";
    if (currentNotes === notes) return;
    if (currentNotes.includes("Reminder Sent") && !notes.includes("Reminder Sent")) {
      return;
    }
    result.record.notes = notes;
    appendHistoryEntry(result.record, HISTORY_ACTIONS.EDITED, "Notes updated.");
    savePeople();
  }
  function deleteComplianceRecord(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) return;
    const { person, record } = result;
    const confirmed = confirm(
      `Delete this compliance record?

${person.name} \u2014 ${record.complianceType}
Expires: ${formatDate(record.expiryDate)}

This cannot be undone.`
    );
    if (!confirmed) return;
    appendHistoryEntry(
      record,
      HISTORY_ACTIONS.DELETED,
      `Record deleted (${record.complianceType}, expires ${formatDate(record.expiryDate)}).`
    );
    repository.deletedRecordHistory.unshift({
      deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
      personName: person.name,
      personRole: person.role,
      record: {
        id: record.id,
        complianceType: record.complianceType,
        expiryDate: record.expiryDate,
        renewalCycle: record.renewalCycle || RENEWAL_CYCLE_MANUAL,
        notes: record.notes || "",
        history: [...record.history || []],
        evidence: [...record.evidence || []],
        actions: [...record.actions || []]
      }
    });
    expandedHistoryRows.delete(historyRowKey(personId, recordId));
    selectedRecordKeys.delete(actionRowKey(personId, recordId));
    if (Number(editIdInput.value) === personId && Number(editRecordIdInput.value) === recordId) {
      hideEditForm();
    }
    person.complianceRecords = person.complianceRecords.filter(
      (record2) => record2.id !== recordId
    );
    if (person.complianceRecords.length === 0) {
      repository.people = repository.people.filter((item) => item.id !== personId);
    }
    if (workspaceContext && workspaceContext.personId === personId && workspaceContext.recordId === recordId) {
      workspaceContext = null;
      if (recordWorkspace) {
        recordWorkspace.classList.add("hidden");
        recordWorkspace.setAttribute("aria-hidden", "true");
      }
      document.body.classList.remove("workspace-open");
    }
    savePeople();
    showMessage(
      appMessage,
      `Deleted: ${person.name} \u2014 ${record.complianceType}.`,
      "success"
    );
    renderTable();
  }
  function formatExpiryDateForAuditNote(dateString) {
    const date = parseDateAtMidnight(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return formatAuditDate(date);
  }
  function renewComplianceRecord(personId, recordId) {
    openRenewModal(personId, recordId);
  }
  function setRenewSuggestedControlsVisible(visible) {
    [renewSuggestedSection, renewUseSuggestedBtn].forEach((element) => {
      if (!element) {
        return;
      }
      element.classList.remove("hidden", "renew-control-hidden");
      element.hidden = false;
      if (!visible) {
        element.classList.add("renew-control-hidden");
      }
    });
  }
  function openRenewModal(personId, recordId) {
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      return;
    }
    const { person, record } = result;
    const renewalCycle = repository.normalizeRenewalCycle(record.renewalCycle);
    const hasActiveCycle = isActiveRenewalCycle(renewalCycle);
    const suggestedExpiryDate = hasActiveCycle ? calculateRenewalExpiryDate(record.expiryDate, renewalCycle) : null;
    renewModalContext = {
      personId,
      recordId,
      recordLabel: `${person.name} \u2014 ${record.complianceType}`,
      renewalCycle,
      suggestedExpiryDate
    };
    renewModalRecordLabel.textContent = renewModalContext.recordLabel;
    renewCurrentExpiry.textContent = formatExpiryDateForAuditNote(record.expiryDate);
    renewCycleLabel.textContent = getRenewalCycleLabel(renewalCycle);
    hideMessage(renewModalMessage);
    const showSuggestedControls = hasActiveCycle && Boolean(suggestedExpiryDate);
    setRenewSuggestedControlsVisible(showSuggestedControls);
    if (showSuggestedControls) {
      renewSuggestedExpiry.textContent = formatExpiryDateForAuditNote(suggestedExpiryDate);
      renewCustomDateInput.value = suggestedExpiryDate;
    } else {
      renewSuggestedExpiry.textContent = "";
      renewCustomDateInput.value = "";
    }
    renewModal.classList.remove("hidden");
    renewModal.setAttribute("aria-hidden", "false");
    if (showSuggestedControls && renewUseSuggestedBtn) {
      renewUseSuggestedBtn.focus();
    } else if (renewSaveCustomBtn) {
      renewSaveCustomBtn.focus();
    }
  }
  function closeRenewModal() {
    if (!renewModal) {
      renewModalContext = null;
      return;
    }
    renewModal.classList.add("hidden");
    renewModal.setAttribute("aria-hidden", "true");
    renewModalContext = null;
    if (renewModalMessage) {
      hideMessage(renewModalMessage);
    }
  }
  function applyRenewal(newExpiryDate, mode) {
    if (!renewModalContext) {
      return;
    }
    const { personId, recordId, recordLabel, renewalCycle } = renewModalContext;
    const result = findPersonAndRecord(personId, recordId);
    if (!result) {
      closeRenewModal();
      return;
    }
    const { record } = result;
    const newExpiryDisplay = formatExpiryDateForAuditNote(newExpiryDate);
    const existingNotes = record.notes || "";
    const auditLine = `${formatAuditDate()} - Compliance renewed. New expiry date: ${newExpiryDisplay}`;
    record.expiryDate = newExpiryDate;
    record.notes = existingNotes ? `${existingNotes}
${auditLine}` : auditLine;
    if (mode === "suggested") {
      appendHistoryEntry(
        record,
        HISTORY_ACTIONS.RENEWED,
        `Compliance renewed using ${getRenewalCycleRenewalText(renewalCycle)} cycle. New expiry date: ${newExpiryDisplay}.`
      );
    } else {
      appendHistoryEntry(
        record,
        HISTORY_ACTIONS.RENEWED,
        `Compliance renewed using custom expiry date: ${newExpiryDisplay}.`
      );
    }
    savePeople();
    closeRenewModal();
    if (Number(editIdInput.value) === personId && Number(editRecordIdInput.value) === recordId) {
      document.getElementById("edit-dbs-expiry").value = newExpiryDate;
    }
    showMessage(
      appMessage,
      `Renewed: ${recordLabel}. New expiry date: ${newExpiryDisplay}.`,
      "success"
    );
    renderTable();
  }
  function handleRenewUseSuggested() {
    if (!renewModalContext?.suggestedExpiryDate) {
      return;
    }
    applyRenewal(renewModalContext.suggestedExpiryDate, "suggested");
  }
  function handleRenewSaveCustom() {
    const trimmed = renewCustomDateInput.value.trim();
    if (!trimmed) {
      showMessage(renewModalMessage, "Please enter an expiry date.", "error");
      return;
    }
    if (!isValidExpiryDate(trimmed)) {
      showMessage(
        renewModalMessage,
        "Invalid date. Please enter a valid date.",
        "error"
      );
      return;
    }
    applyRenewal(normalizeExpiryDate(trimmed), "custom");
  }
  function renderTable({ refreshDashboards = true } = {}) {
    tableBody.innerHTML = "";
    const filteredRows = getFilteredComplianceRows();
    const sortedRows = sortComplianceRows(filteredRows);
    const totalCount = getTotalRecordCount();
    const filteredCount = sortedRows.length;
    clampTablePage(filteredCount);
    renderRegisterSummaryStrip(sortedRows);
    const pageRows = paginateRows(sortedRows);
    const visibleCount = pageRows.length;
    pageRows.forEach((row) => {
      const status = getStatus(row.expiryDate);
      const actionSummary = getActionSummary(row.actions);
      const openActionsClass = actionSummary.activeCount > 0 ? "open-actions-count has-open" : "open-actions-count";
      const tableRow = document.createElement("tr");
      const rowKey = actionRowKey(row.personId, row.recordId);
      const isSelected = selectedRecordKeys.has(rowKey);
      if (workspaceContext && workspaceContext.personId === row.personId && workspaceContext.recordId === row.recordId) {
        tableRow.classList.add("workspace-active-row");
      }
      if (isSelected) {
        tableRow.classList.add("row-selected");
      }
      tableRow.innerHTML = `
      <td class="select-column">
        <input type="checkbox" class="row-select-checkbox" data-person-id="${row.personId}" data-record-id="${row.recordId}" aria-label="Select ${escapeHtml(row.name)} \u2014 ${escapeHtml(row.complianceType)}"${isSelected ? " checked" : ""}>
      </td>
      <td>${row.name}</td>
      <td>${row.role}</td>
      <td class="compliance-type-cell">${row.complianceType}</td>
      <td>${formatDate(row.expiryDate)}</td>
      <td><span class="status status-badge ${status.className}">${getStatusBadgeLabel(status.key)}</span></td>
      <td class="${openActionsClass}">${actionSummary.activeCount}</td>
      <td class="table-action-cell"><button type="button" class="details-btn" data-person-id="${row.personId}" data-record-id="${row.recordId}">Details</button></td>
      <td class="table-action-cell"><button type="button" class="edit-btn" data-person-id="${row.personId}" data-record-id="${row.recordId}">Edit</button></td>
      <td class="table-action-cell"><button type="button" class="renew-btn" data-person-id="${row.personId}" data-record-id="${row.recordId}">Renew</button></td>
    `;
      tableBody.appendChild(tableRow);
    });
    if (filteredCount === totalCount) {
      personCount.textContent = filteredCount === 1 ? "1 record" : `${filteredCount} records`;
    } else {
      personCount.textContent = `Showing ${filteredCount} of ${totalCount} records`;
    }
    renderPagination(filteredCount, visibleCount);
    emptyMessage.classList.toggle("hidden", totalCount > 0);
    noResultsMessage.classList.toggle("hidden", filteredCount > 0 || totalCount === 0);
    renderActiveFilters();
    if (refreshDashboards) {
      renderSummary();
      renderAnalytics();
      renderDashboard();
    }
    if (workspaceContext) {
      renderRecordWorkspace();
    }
    refreshActiveReportPreview();
    refreshActiveInsightPreview();
    refreshActiveActionDashboardPreview();
    renderBulkSelectionToolbar();
    updateSelectAllPageCheckbox(pageRows);
  }
  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeCsvValue(value) {
    const text = String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
  function getReminderStatusLabel(expiryDate, notes) {
    const reminder = getReminderForRecord({ expiryDate });
    if (!reminder) {
      return "None";
    }
    if (isReminderTypeMarkedSent(notes, reminder.reminderType)) {
      return `Sent: ${reminder.reminderType}`;
    }
    return `Action required: ${reminder.reminderType}`;
  }
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  function getEvidenceCoverageStats() {
    const allRows = getAllComplianceRows();
    const total = allRows.length;
    const withEvidence = allRows.filter(
      (row) => getEvidenceSummary(row.evidence).count > 0
    ).length;
    const withoutEvidence = total - withEvidence;
    const coveragePercent = total === 0 ? 0 : Math.round(withEvidence / total * 100);
    return {
      total,
      withEvidence,
      withoutEvidence,
      coveragePercent
    };
  }
  function getReportTitle(reportType) {
    const titles = {
      [REPORT_TYPES.FULL]: "Full Compliance Report",
      [REPORT_TYPES.EXPIRED]: "Expired Records Report",
      [REPORT_TYPES.EXPIRING_30]: "Expiring in 30 Days Report",
      [REPORT_TYPES.MISSING_EVIDENCE]: "Missing Evidence Report",
      [REPORT_TYPES.EVIDENCE_COVERAGE]: "Evidence Coverage Summary",
      [REPORT_TYPES.OPEN_ACTIONS]: "Open Actions Report",
      [REPORT_TYPES.RECORDS_WITH_OPEN_ACTIONS]: "Records with Open Actions",
      [REPORT_TYPES.EXPIRED_WITH_OPEN_ACTIONS]: "Expired Records with Open Actions"
    };
    return titles[reportType] || "Compliance Report";
  }
  function getReportFilename(reportType) {
    const slug = reportType.replace(/-/g, "_");
    return `compliance-report-${slug}.csv`;
  }
  function getReportRowsForType(reportType) {
    const allRows = getAllComplianceRows();
    if (reportType === REPORT_TYPES.EXPIRED) {
      return allRows.filter((row) => getStatus(row.expiryDate).key === "expired");
    }
    if (reportType === REPORT_TYPES.EXPIRING_30) {
      return allRows.filter((row) => {
        const daysRemaining = getDaysUntilExpiry(row.expiryDate);
        return !Number.isNaN(daysRemaining) && daysRemaining >= 0 && daysRemaining <= 30;
      });
    }
    if (reportType === REPORT_TYPES.MISSING_EVIDENCE) {
      return allRows.filter((row) => getEvidenceSummary(row.evidence).count === 0);
    }
    if (reportType === REPORT_TYPES.RECORDS_WITH_OPEN_ACTIONS) {
      return allRows.filter((row) => getActionSummary(row.actions).activeCount > 0);
    }
    if (reportType === REPORT_TYPES.EXPIRED_WITH_OPEN_ACTIONS) {
      return allRows.filter(
        (row) => getStatus(row.expiryDate).key === "expired" && getActionSummary(row.actions).activeCount > 0
      );
    }
    return allRows;
  }
  function getOpenActionFlattenedRows() {
    const flattened = [];
    getAllComplianceRows().forEach((row) => {
      (row.actions || []).filter((item) => !isActionCompleted(item)).forEach((action) => {
        flattened.push({ row, action });
      });
    });
    flattened.sort((a, b) => {
      const dateCompare = a.action.createdAt.localeCompare(b.action.createdAt);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return a.row.name.localeCompare(b.row.name);
    });
    return flattened;
  }
  function sortReportRows(rows, reportType) {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (reportType === REPORT_TYPES.FULL || reportType === REPORT_TYPES.EVIDENCE_COVERAGE || reportType === REPORT_TYPES.RECORDS_WITH_OPEN_ACTIONS || reportType === REPORT_TYPES.EXPIRED_WITH_OPEN_ACTIONS) {
        return a.name.localeCompare(b.name) || a.complianceType.localeCompare(b.complianceType);
      }
      return a.expiryDate.localeCompare(b.expiryDate) || a.name.localeCompare(b.name);
    });
    return sorted;
  }
  function getReportColumns(reportType) {
    if (reportType === REPORT_TYPES.OPEN_ACTIONS) {
      return [
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "complianceType", label: "Compliance Type" },
        { key: "expiryDate", label: "Expiry Date" },
        { key: "actionTitle", label: "Action Title" },
        { key: "status", label: "Status" },
        { key: "dueDate", label: "Due Date" },
        { key: "owner", label: "Owner" },
        { key: "createdAt", label: "Created" },
        { key: "notes", label: "Notes" }
      ];
    }
    if (reportType === REPORT_TYPES.RECORDS_WITH_OPEN_ACTIONS || reportType === REPORT_TYPES.EXPIRED_WITH_OPEN_ACTIONS) {
      return [
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "complianceType", label: "Compliance Type" },
        { key: "expiryDate", label: "Expiry Date" },
        { key: "status", label: "Status" },
        { key: "openActionCount", label: "Open Actions" }
      ];
    }
    if (reportType === REPORT_TYPES.EVIDENCE_COVERAGE) {
      return [
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "complianceType", label: "Compliance Type" },
        { key: "expiryDate", label: "Expiry Date" },
        { key: "status", label: "Status" },
        { key: "evidenceCount", label: "Evidence Count" }
      ];
    }
    if (reportType === REPORT_TYPES.FULL) {
      return [
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "complianceType", label: "Compliance Type" },
        { key: "renewalCycle", label: "Renewal Cycle" },
        { key: "expiryDate", label: "Expiry Date" },
        { key: "status", label: "Status" },
        { key: "evidenceCount", label: "Evidence Count" }
      ];
    }
    return [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "complianceType", label: "Compliance Type" },
      { key: "renewalCycle", label: "Renewal Cycle" },
      { key: "expiryDate", label: "Expiry Date" },
      { key: "status", label: "Status" },
      { key: "evidenceCount", label: "Evidence Count" }
    ];
  }
  function buildReportRowData(row, reportType) {
    const status = getStatus(row.expiryDate);
    const evidenceSummary = getEvidenceSummary(row.evidence);
    const actionSummary = getActionSummary(row.actions);
    return {
      name: row.name,
      role: row.role,
      complianceType: row.complianceType,
      renewalCycle: getRenewalCycleLabel(row.renewalCycle),
      expiryDate: formatDate(row.expiryDate),
      status: getStatusBadgeLabel(status.key),
      evidenceCount: String(evidenceSummary.count),
      openActionCount: String(actionSummary.activeCount)
    };
  }
  function buildOpenActionReportRow(entry) {
    return {
      name: entry.row.name,
      role: entry.row.role,
      complianceType: entry.row.complianceType,
      expiryDate: formatDate(entry.row.expiryDate),
      actionTitle: entry.action.title,
      status: getActionStatusLabel(entry.action),
      dueDate: formatActionDueDate(entry.action.dueDate),
      owner: entry.action.owner || "",
      createdAt: formatHistoryTimestamp(entry.action.createdAt),
      notes: entry.action.notes || ""
    };
  }
  function buildReport(reportType) {
    const generatedAt = /* @__PURE__ */ new Date();
    const columns = getReportColumns(reportType);
    if (reportType === REPORT_TYPES.OPEN_ACTIONS) {
      const flattened = getOpenActionFlattenedRows();
      const tableRows2 = flattened.map((entry) => buildOpenActionReportRow(entry));
      return {
        type: reportType,
        title: getReportTitle(reportType),
        generatedAt: generatedAt.toISOString(),
        generatedDisplay: generatedAt.toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        totalCount: tableRows2.length,
        columns,
        tableRows: tableRows2,
        summary: null,
        filename: getReportFilename(reportType)
      };
    }
    const rows = sortReportRows(getReportRowsForType(reportType), reportType);
    const tableRows = rows.map((row) => buildReportRowData(row, reportType));
    const report = {
      type: reportType,
      title: getReportTitle(reportType),
      generatedAt: generatedAt.toISOString(),
      generatedDisplay: generatedAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      totalCount: rows.length,
      columns,
      tableRows,
      summary: null,
      filename: getReportFilename(reportType)
    };
    if (reportType === REPORT_TYPES.EVIDENCE_COVERAGE) {
      report.summary = getEvidenceCoverageStats();
      report.totalCount = report.summary.total;
    }
    return report;
  }
  function renderReportSummaryStats(summary) {
    if (!reportSummaryStats || !summary) {
      return;
    }
    reportSummaryStats.innerHTML = `
    <div class="report-stat-card">
      <span class="report-stat-label">Total compliance records</span>
      <strong class="report-stat-value">${summary.total}</strong>
    </div>
    <div class="report-stat-card">
      <span class="report-stat-label">Records with evidence</span>
      <strong class="report-stat-value">${summary.withEvidence}</strong>
    </div>
    <div class="report-stat-card">
      <span class="report-stat-label">Records without evidence</span>
      <strong class="report-stat-value">${summary.withoutEvidence}</strong>
    </div>
    <div class="report-stat-card report-stat-highlight">
      <span class="report-stat-label">Evidence coverage</span>
      <strong class="report-stat-value">${summary.coveragePercent}%</strong>
    </div>
  `;
    reportSummaryStats.classList.remove("hidden");
  }
  function getReportColumnClass(columnKey) {
    if (columnKey === "evidenceCount" || columnKey === "openActionCount" || columnKey === "completedActionCount" || columnKey === "renewalCycle") {
      return "col-compact";
    }
    if (columnKey === "notes") {
      return "col-notes";
    }
    if (columnKey === "name" || columnKey === "complianceType" || columnKey === "status") {
      return "col-primary";
    }
    return "";
  }
  function renderReportPreview(report) {
    if (!reportPreview || !reportTitle || !reportMeta || !reportTableHead || !reportTableBody) {
      return;
    }
    currentReport = report;
    reportTitle.textContent = report.title;
    reportMeta.textContent = `Generated: ${report.generatedDisplay} \xB7 Total records included: ${report.totalCount}`;
    if (report.type === REPORT_TYPES.EVIDENCE_COVERAGE && report.summary) {
      renderReportSummaryStats(report.summary);
    } else if (reportSummaryStats) {
      reportSummaryStats.innerHTML = "";
      reportSummaryStats.classList.add("hidden");
    }
    reportTableHead.innerHTML = `
    <tr>
      ${report.columns.map(
      (column) => `<th class="${getReportColumnClass(column.key)}">${escapeHtml(column.label)}</th>`
    ).join("")}
    </tr>
  `;
    if (report.tableRows.length === 0) {
      reportTableBody.innerHTML = `
      <tr>
        <td colspan="${report.columns.length}" class="report-empty-cell">No records match this report.</td>
      </tr>
    `;
    } else {
      reportTableBody.innerHTML = report.tableRows.map((row) => {
        const cells = report.columns.map(
          (column) => `<td class="${getReportColumnClass(column.key)}">${escapeHtml(row[column.key] ?? "")}</td>`
        ).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
    }
    reportPreview.classList.remove("hidden");
    if (reportEmptyHint) {
      reportEmptyHint.classList.add("hidden");
    }
    reportCards.forEach((card) => {
      card.classList.toggle("report-card-active", card.dataset.report === report.type);
    });
    reportPreview.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function generateReport(reportType) {
    const report = buildReport(reportType);
    renderReportPreview(report);
  }
  function exportReportCsv() {
    if (!currentReport) {
      showMessage(appMessage, "Generate a report first.", "error");
      return;
    }
    const headerRow = currentReport.columns.map((column) => escapeCsvValue(column.label)).join(",");
    const dataRows = currentReport.tableRows.map(
      (row) => currentReport.columns.map((column) => escapeCsvValue(row[column.key] ?? "")).join(",")
    );
    const summaryLines = [];
    if (currentReport.type === REPORT_TYPES.EVIDENCE_COVERAGE && currentReport.summary) {
      const summary = currentReport.summary;
      summaryLines.push(
        `"Report","${escapeCsvValue(currentReport.title)}"`,
        `"Generated","${escapeCsvValue(currentReport.generatedDisplay)}"`,
        `"Total compliance records","${summary.total}"`,
        `"Records with evidence","${summary.withEvidence}"`,
        `"Records without evidence","${summary.withoutEvidence}"`,
        `"Evidence coverage","${summary.coveragePercent}%"`,
        ""
      );
    } else {
      summaryLines.push(
        `"Report","${escapeCsvValue(currentReport.title)}"`,
        `"Generated","${escapeCsvValue(currentReport.generatedDisplay)}"`,
        `"Total records included","${currentReport.totalCount}"`,
        ""
      );
    }
    const csvContent = [...summaryLines, headerRow, ...dataRows].join("\n");
    downloadFile(csvContent, currentReport.filename, "text/csv");
    showMessage(appMessage, "Report CSV downloaded.", "success");
  }
  function printReport() {
    if (!currentReport) {
      showMessage(appMessage, "Generate a report first.", "error");
      return;
    }
    window.print();
  }
  function setupReportListeners() {
    reportCards.forEach((card) => {
      card.addEventListener("click", () => {
        generateReport(card.dataset.report);
      });
    });
    if (exportReportCsvBtn) {
      exportReportCsvBtn.addEventListener("click", exportReportCsv);
    }
    if (printReportBtn) {
      printReportBtn.addEventListener("click", printReport);
    }
  }
  var COMPLIANCE_CSV_HEADERS = [
    "Name",
    "Role",
    "Compliance Type",
    "Renewal Cycle",
    "Expiry Date",
    "Status",
    "Reminder Status",
    "Evidence Count",
    "Latest Evidence Added",
    "Open Action Count",
    "Completed Action Count",
    "Notes"
  ];
  function buildComplianceCsvRow(row) {
    const status = getStatus(row.expiryDate);
    const evidenceSummary = getEvidenceSummary(row.evidence);
    const actionSummary = getActionSummary(row.actions);
    return [
      escapeCsvValue(row.name),
      escapeCsvValue(row.role),
      escapeCsvValue(row.complianceType),
      escapeCsvValue(getRenewalCycleLabel(row.renewalCycle)),
      escapeCsvValue(formatDate(row.expiryDate)),
      escapeCsvValue(status.label),
      escapeCsvValue(getReminderStatusLabel(row.expiryDate, row.notes)),
      escapeCsvValue(String(evidenceSummary.count)),
      escapeCsvValue(evidenceSummary.latestAdded),
      escapeCsvValue(String(actionSummary.activeCount)),
      escapeCsvValue(String(actionSummary.completedCount)),
      escapeCsvValue(row.notes || "")
    ].join(",");
  }
  function buildComplianceCsvContent(rows) {
    return [COMPLIANCE_CSV_HEADERS.join(","), ...rows.map(buildComplianceCsvRow)].join("\n");
  }
  function exportToCsv() {
    const csvContent = buildComplianceCsvContent(getAllComplianceRows());
    downloadFile(csvContent, "compliance-reminder-data.csv", "text/csv");
  }
  function exportSelectedToCsv() {
    const rows = getSelectedComplianceRows();
    if (rows.length === 0) {
      showMessage(appMessage, "Select one or more records to export.", "error");
      return;
    }
    const csvContent = buildComplianceCsvContent(rows);
    downloadFile(csvContent, "compliance-reminder-selected.csv", "text/csv");
    showMessage(
      appMessage,
      `Exported ${rows.length} selected record${rows.length === 1 ? "" : "s"} to CSV.`,
      "success"
    );
  }
  function exportBackup() {
    const backup = repository.buildBackup();
    downloadFile(
      JSON.stringify(backup, null, 2),
      "compliance-reminder-backup.json",
      "application/json"
    );
    showMessage(appMessage, "Backup downloaded successfully.", "success");
  }
  function applyBackupData(data) {
    repository.applyBackup(data);
    expandedHistoryRows.clear();
    expandedEvidenceRows.clear();
    expandedActionRows.clear();
    selectedRecordKeys.clear();
    closeRecordWorkspace();
    hideEditForm();
    savePeople();
  }
  function showBackupValidationMessage(result) {
    importMessage.classList.remove("hidden", "message-success", "message-error");
    if (!result.valid) {
      const detail = result.errors.length ? ` ${result.errors.join(" ")}` : "";
      showMessage(importMessage, `Backup validation failed.${detail}`, "error");
      return;
    }
    let message = `Backup is valid: ${result.recordCount} compliance record(s) across ${result.personCount} people.`;
    if (result.warnings.length) {
      message += ` Note: ${result.warnings.join(" ")}`;
    }
    showMessage(importMessage, message, "success");
  }
  function handleBackupValidate(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        showBackupValidationMessage(repository.validateBackupDryRun(data));
      } catch (error) {
        showMessage(
          importMessage,
          "Could not read the backup file. Please check the file and try again.",
          "error"
        );
        importMessage.classList.remove("hidden");
      }
      validateBackupFileInput.value = "";
    };
    reader.onerror = () => {
      showMessage(importMessage, "Could not read the file. Please try again.", "error");
      importMessage.classList.remove("hidden");
      validateBackupFileInput.value = "";
    };
    reader.readAsText(file);
  }
  function handleBackupImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        if (!Array.isArray(data.people) || data.people.length === 0) {
          showMessage(
            importMessage,
            "Backup has no compliance records to import.",
            "error"
          );
          backupFileInput.value = "";
          return;
        }
        if (!repository.isValidBackupData(data)) {
          showMessage(
            importMessage,
            "Invalid backup file. Please choose a compliance reminder JSON backup.",
            "error"
          );
          backupFileInput.value = "";
          return;
        }
        const recordCount = repository.countBackupRecords(data.people);
        const confirmed = confirm(
          `Import backup?

This will replace all ${getTotalRecordCount()} current record(s) with ${recordCount} record(s) from the backup.

Your current data will be overwritten. Continue?`
        );
        if (!confirmed) {
          backupFileInput.value = "";
          return;
        }
        applyBackupData(data);
        clearAllFilters();
        renderTable();
        showMessage(
          importMessage,
          `Backup imported successfully (${recordCount} record${recordCount === 1 ? "" : "s"}).`,
          "success"
        );
      } catch (error) {
        showMessage(
          importMessage,
          "Could not read the backup file. Please check the file and try again.",
          "error"
        );
      }
      backupFileInput.value = "";
    };
    reader.onerror = () => {
      showMessage(importMessage, "Could not read the backup file. Please try again.", "error");
      backupFileInput.value = "";
    };
    reader.readAsText(file);
  }
  function parseCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }
  function findColumnIndex(headers, targetName) {
    const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
    return normalizedHeaders.indexOf(targetName.toLowerCase());
  }
  function parseExpiryDate(value) {
    const text = value.trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return isValidExpiryDate(text) ? text : null;
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const formatted = `${year}-${month}-${day}`;
    return isValidExpiryDate(formatted) ? formatted : null;
  }
  function formatSkipReasons(skipReasons) {
    const parts = [];
    if (skipReasons.missingName > 0) {
      parts.push(`${skipReasons.missingName} missing name`);
    }
    if (skipReasons.missingRole > 0) {
      parts.push(`${skipReasons.missingRole} missing role`);
    }
    if (skipReasons.missingDate > 0) {
      parts.push(`${skipReasons.missingDate} missing date`);
    }
    if (skipReasons.invalidDate > 0) {
      parts.push(`${skipReasons.invalidDate} invalid date`);
    }
    return parts.join(", ");
  }
  function addComplianceRecord(name, role, complianceType, expiryDate, renewalCycle) {
    const record = repository.createComplianceRecord(
      {
        complianceType,
        expiryDate,
        notes: "",
        renewalCycle: renewalCycle !== void 0 ? renewalCycle : getDefaultRenewalCycleForType(complianceType)
      },
      repository.nextRecordId
    );
    repository.nextRecordId += 1;
    const existingPerson = findPersonByName(name);
    if (existingPerson) {
      existingPerson.name = name;
      existingPerson.role = role;
      existingPerson.complianceRecords.push(record);
      appendHistoryEntry(
        record,
        HISTORY_ACTIONS.CREATED,
        `Record created (${record.complianceType}, expires ${formatDate(record.expiryDate)}).`
      );
      return { isNewPerson: false, record };
    }
    repository.people.push({
      id: repository.nextPersonId,
      name,
      role,
      complianceRecords: [record]
    });
    repository.nextPersonId += 1;
    appendHistoryEntry(
      record,
      HISTORY_ACTIONS.CREATED,
      `Record created (${record.complianceType}, expires ${formatDate(record.expiryDate)}).`
    );
    return { isNewPerson: true, record };
  }
  function importPeopleFromCsv(csvText) {
    const cleanedText = csvText.replace(/^\uFEFF/, "");
    const lines = cleanedText.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length < 2) {
      return { imported: 0, skipped: 0, error: "The CSV file is empty or has no data rows." };
    }
    const headers = parseCsvLine(lines[0]);
    const nameIndex = findColumnIndex(headers, "name");
    const roleIndex = findColumnIndex(headers, "role");
    let expiryIndex = findColumnIndex(headers, "expiry date");
    if (expiryIndex === -1) {
      expiryIndex = findColumnIndex(headers, "dbs expiry date");
    }
    const complianceTypeIndex = findColumnIndex(headers, "compliance type");
    const renewalCycleIndex = findColumnIndex(headers, "renewal cycle");
    if (nameIndex === -1 || roleIndex === -1 || expiryIndex === -1) {
      return {
        imported: 0,
        skipped: 0,
        error: "CSV must include columns: Name, Role, and Expiry Date (or DBS Expiry Date)."
      };
    }
    let imported = 0;
    let skipped = 0;
    const skipReasons = {
      missingName: 0,
      missingRole: 0,
      missingDate: 0,
      invalidDate: 0
    };
    for (let i = 1; i < lines.length; i++) {
      const columns = parseCsvLine(lines[i]);
      const name = columns[nameIndex]?.trim() ?? "";
      const role = columns[roleIndex]?.trim() ?? "";
      const rawDate = columns[expiryIndex]?.trim() ?? "";
      const complianceType = complianceTypeIndex === -1 ? DEFAULT_COMPLIANCE_TYPE : columns[complianceTypeIndex]?.trim() ?? DEFAULT_COMPLIANCE_TYPE;
      const renewalCycle = renewalCycleIndex === -1 ? getDefaultRenewalCycleForType(complianceType) : columns[renewalCycleIndex]?.trim() ?? getDefaultRenewalCycleForType(complianceType);
      if (!name) {
        skipped += 1;
        skipReasons.missingName += 1;
        continue;
      }
      if (!role) {
        skipped += 1;
        skipReasons.missingRole += 1;
        continue;
      }
      if (!rawDate) {
        skipped += 1;
        skipReasons.missingDate += 1;
        continue;
      }
      const expiryDate = parseExpiryDate(rawDate);
      if (!expiryDate) {
        skipped += 1;
        skipReasons.invalidDate += 1;
        continue;
      }
      addComplianceRecord(
        name,
        role,
        repository.normalizeComplianceType(complianceType),
        normalizeExpiryDate(expiryDate),
        renewalCycle
      );
      imported += 1;
    }
    if (imported > 0) {
      savePeople();
    }
    return { imported, skipped, skipReasons, error: null };
  }
  function showImportMessage(result) {
    importMessage.classList.remove("hidden", "message-success", "message-error");
    if (result.error) {
      showMessage(importMessage, result.error, "error");
      return;
    }
    const reasonText = result.skipReasons ? formatSkipReasons(result.skipReasons) : "";
    if (result.imported === 0) {
      let message = `No records imported. ${result.skipped} row(s) were skipped.`;
      if (reasonText) {
        message += ` Reasons: ${reasonText}.`;
      }
      showMessage(importMessage, message, "error");
      return;
    }
    if (result.skipped > 0) {
      let message = `Imported ${result.imported} records. ${result.skipped} row(s) were skipped.`;
      if (reasonText) {
        message += ` Reasons: ${reasonText}.`;
      }
      showMessage(importMessage, message, "error");
      return;
    }
    showMessage(importMessage, `Imported ${result.imported} records successfully.`, "success");
  }
  function handleCsvImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = importPeopleFromCsv(loadEvent.target.result);
      showImportMessage(result);
      csvFileInput.value = "";
      if (result.imported > 0) {
        renderTable();
      }
    };
    reader.onerror = () => {
      showMessage(importMessage, "Could not read the file. Please try again.", "error");
      csvFileInput.value = "";
    };
    reader.readAsText(file);
  }
  function wireImportExportControls() {
    exportCsvBtn?.addEventListener("click", exportToCsv);
    importCsvBtn?.addEventListener("click", () => csvFileInput?.click());
    csvFileInput?.addEventListener("change", handleCsvImport);
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener("click", exportBackup);
    }
    if (importBackupBtn && backupFileInput) {
      importBackupBtn.addEventListener("click", () => backupFileInput.click());
      backupFileInput.addEventListener("change", handleBackupImport);
    }
    if (validateBackupBtn && validateBackupFileInput) {
      validateBackupBtn.addEventListener("click", () => validateBackupFileInput.click());
      validateBackupFileInput.addEventListener("change", handleBackupValidate);
    }
    const quickExportCsv = document.getElementById("action-export-csv");
    quickExportCsv?.addEventListener("click", exportToCsv);
  }
  wireImportExportControls();
  if (tableBody) {
    tableBody.addEventListener("click", (event) => {
      const button = event.target;
      if (!button.matches("button")) return;
      const personId = Number(button.dataset.personId);
      const recordId = Number(button.dataset.recordId);
      if (button.classList.contains("details-btn")) {
        openRecordWorkspace(personId, recordId);
      } else if (button.classList.contains("edit-btn")) {
        startEdit(personId, recordId);
      } else if (button.classList.contains("renew-btn")) {
        renewComplianceRecord(personId, recordId);
      }
    });
  }
  if (editForm) {
    editForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const personId = Number(editIdInput.value);
      const recordId = Number(editRecordIdInput.value);
      const name = document.getElementById("edit-name").value.trim();
      const role = document.getElementById("edit-role").value.trim();
      const complianceType = document.getElementById("edit-compliance-type").value;
      const expiryDate = document.getElementById("edit-dbs-expiry").value;
      const notes = document.getElementById("edit-notes").value;
      const renewalCycle = document.getElementById("edit-renewal-cycle").value;
      updatePerson(
        personId,
        recordId,
        name,
        role,
        complianceType,
        expiryDate,
        notes,
        renewalCycle
      );
    });
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", hideEditForm);
  }
  function setupRenewModalListeners() {
    if (!renewModal) {
      return;
    }
    renewModal.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) {
        return;
      }
      if (target === renewModal) {
        closeRenewModal();
        return;
      }
      const actionButton = target.closest(
        "#renew-use-suggested-btn, #renew-save-custom-btn, #renew-cancel-btn, #renew-modal-close-btn"
      );
      if (!actionButton) {
        return;
      }
      event.preventDefault();
      if (actionButton.id === "renew-use-suggested-btn") {
        handleRenewUseSuggested();
      } else if (actionButton.id === "renew-save-custom-btn") {
        handleRenewSaveCustom();
      } else {
        closeRenewModal();
      }
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (renewModalContext) {
        closeRenewModal();
      } else if (evidenceModalContext) {
        closeEvidenceModal();
      } else if (actionModalContext) {
        closeActionModal();
      } else if (bulkActionModal && !bulkActionModal.classList.contains("hidden")) {
        closeBulkActionModal();
      } else if (workspaceContext) {
        closeRecordWorkspace();
      }
    }
  });
  function setupEvidenceModalListeners() {
    if (!evidenceModal) {
      return;
    }
    evidenceModal.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) {
        return;
      }
      if (target === evidenceModal) {
        closeEvidenceModal();
        return;
      }
      const actionButton = target.closest(
        "#evidence-save-btn, #evidence-cancel-btn, #evidence-modal-close-btn"
      );
      if (!actionButton) {
        return;
      }
      event.preventDefault();
      if (actionButton.id === "evidence-save-btn") {
        handleSaveEvidence();
      } else {
        closeEvidenceModal();
      }
    });
  }
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const nameInput = document.getElementById("name");
      const roleInput = document.getElementById("role");
      const complianceTypeInput2 = document.getElementById("compliance-type");
      const expiryInput = document.getElementById("dbs-expiry");
      const renewalCycleInput = document.getElementById("renewal-cycle");
      const validation = validatePersonInput(
        nameInput.value,
        roleInput.value,
        complianceTypeInput2.value,
        expiryInput.value
      );
      if (!validation.valid) {
        showMessage(addFormMessage, validation.errors.join(" "), "error");
        return;
      }
      hideMessage(addFormMessage);
      const result = addComplianceRecord(
        validation.name,
        validation.role,
        validation.complianceType,
        normalizeExpiryDate(validation.dbsExpiry),
        renewalCycleInput.value
      );
      savePeople();
      form.reset();
      syncAddFormRenewalCycleDefault();
      showMessage(
        appMessage,
        result.isNewPerson ? "Person and compliance record added successfully." : "Compliance record added for existing person.",
        "success"
      );
      renderTable();
    });
  }
  resetSampleBtn?.addEventListener("click", resetSampleData);
  dashboardCards.forEach((card) => {
    card.addEventListener("click", () => {
      filterByExpiryWindow(Number(card.dataset.days));
    });
  });
  if (dashboardAllCard) {
    dashboardAllCard.addEventListener("click", () => {
      showAllPeople();
    });
  }
  if (actionRequiredCard && remindersSection) {
    actionRequiredCard.addEventListener("click", () => {
      remindersSection.scrollIntoView({ behavior: "smooth" });
    });
  }
  if (reminderDays30) {
    reminderDays30.addEventListener("change", handleReminderSettingsChange);
  }
  if (reminderDays14) {
    reminderDays14.addEventListener("change", handleReminderSettingsChange);
  }
  if (reminderDays7) {
    reminderDays7.addEventListener("change", handleReminderSettingsChange);
  }
  if (hideSentRemindersCheckbox) {
    hideSentRemindersCheckbox.addEventListener("change", handleReminderSettingsChange);
  }
  if (remindersTableBody) {
    remindersTableBody.addEventListener("click", (event) => {
      const button = event.target.closest(".mark-sent-btn");
      if (!button || button.disabled) {
        return;
      }
      markReminderSent(
        Number(button.dataset.personId),
        Number(button.dataset.recordId),
        button.dataset.reminderType
      );
    });
  }
  summaryCards.forEach((card) => {
    card.addEventListener("click", () => {
      const status = card.dataset.status;
      if (status === "all") {
        showAllPeople();
      } else {
        filterByStatus(status);
      }
    });
  });
  document.getElementById("action-show-all")?.addEventListener("click", showAllPeople);
  document.getElementById("action-show-expired")?.addEventListener("click", () => {
    filterByStatus("expired");
  });
  document.getElementById("action-show-due-soon")?.addEventListener("click", () => {
    filterByStatus("dueSoon");
  });
  document.getElementById("action-add-person")?.addEventListener("click", () => {
    addPersonSection?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("name")?.focus();
  });
  searchInput?.addEventListener("input", () => {
    updateFilterActiveState();
    refreshRegisterView({ resetPage: true, clearSelection: true });
  });
  statusFilter?.addEventListener("change", () => {
    reconcileStatusExpiryFilters("status");
    updateFilterActiveState();
    refreshRegisterView({ resetPage: true, clearSelection: true });
  });
  complianceTypeFilter?.addEventListener("change", () => {
    setExpiryWindowFilter(null);
    updateFilterActiveState();
    refreshRegisterView({ resetPage: true, clearSelection: true });
  });
  if (expiryWindowFilterSelect) {
    expiryWindowFilterSelect.addEventListener("change", () => {
      const value = expiryWindowFilterSelect.value;
      setExpiryWindowFilter(value === "all" ? null : Number(value));
      reconcileStatusExpiryFilters("expiry");
      updateFilterActiveState();
      refreshRegisterView({ resetPage: true, clearSelection: true });
    });
  }
  if (activeFilterChips) {
    activeFilterChips.addEventListener("click", (event) => {
      const chip = event.target.closest(".active-filter-chip");
      if (!chip) {
        return;
      }
      clearActiveFilter(chip.dataset.filterId);
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      showAllPeople();
    });
  }
  analyticsCards.forEach((card) => {
    card.addEventListener("click", () => {
      filterByAnalyticsCard(card.dataset.analyticsFilter);
    });
  });
  if (sortBySelect) {
    sortBySelect.addEventListener("change", () => {
      refreshRegisterView({ resetPage: true });
    });
  }
  if (paginationPrevBtn) {
    paginationPrevBtn.addEventListener("click", () => {
      if (currentTablePage > 1) {
        currentTablePage -= 1;
        renderTable({ refreshDashboards: false });
        peopleSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
  if (paginationNextBtn) {
    paginationNextBtn.addEventListener("click", () => {
      const filteredCount = getFilteredComplianceRows().length;
      const totalPages = Math.ceil(filteredCount / RECORDS_PER_PAGE);
      if (currentTablePage < totalPages) {
        currentTablePage += 1;
        renderTable({ refreshDashboards: false });
        peopleSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
  initAuth();
  setupRenewModalListeners();
  setupEvidenceModalListeners();
  setupActionModalListeners();
  setupBulkActionModalListeners();
  setupBulkSelectionListeners();
  setupManagementInsightListeners();
  setupActionDashboardListeners();
  setupRecordWorkspaceListeners();
  setupReportListeners();
  loadReminderSettings();
  loadPeople();
  syncAddFormRenewalCycleDefault();
  var dataBackendBadge = document.getElementById("data-backend-badge");
  if (dataBackendBadge) {
    dataBackendBadge.textContent = DATA_BACKEND === "local" ? "Local storage mode" : "Cloud mode (preview)";
  }
  var complianceTypeInput = document.getElementById("compliance-type");
  if (complianceTypeInput) {
    complianceTypeInput.addEventListener("change", syncAddFormRenewalCycleDefault);
  }
  renderTable();
  document.documentElement.dataset.appReady = "true";
})();
