// Compliance Reminder System v1.2
console.log("Compliance Reminder System v1.2 — app.js loaded");

// Fake sample data — used only on the very first visit
const samplePeople = [
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
  { id: 20, name: "Lucas Gray", role: "Care Assistant", dbsExpiry: "2026-07-15" },
];

// The key we use to store data in the browser's localStorage
const STORAGE_KEY = "complianceReminderPeople";

// Our working copy of the data (loaded from localStorage or sample data)
let people = [];
let nextPersonId = 21;
let nextRecordId = 1000;

const DUE_SOON_DAYS = 90;
const COMPLIANCE_TYPES = [
  "DBS",
  "Basic Awareness",
  "Foundations",
  "Leadership",
  "Senior Leadership",
  "Domestic Abuse",
  "Safer Recruitment",
  "Modern Slavery",
];
const DEFAULT_COMPLIANCE_TYPE = "DBS";
const REMINDER_LABELS = {
  30: "30 Day Reminder",
  14: "14 Day Reminder",
  7: "7 Day Reminder",
  expired: "Expired",
};
const REMINDER_URGENCY = { expired: 0, 7: 1, 14: 2, 30: 3 };
const REMINDER_SETTINGS_KEY = "complianceReminderSettings";

const DEFAULT_REMINDER_SETTINGS = {
  days30: true,
  days14: true,
  days7: true,
  hideSentReminders: false,
};

let reminderSettings = { ...DEFAULT_REMINDER_SETTINGS };

const form = document.getElementById("add-person-form");
const tableBody = document.getElementById("people-table-body");
const personCount = document.getElementById("person-count");
const emptyMessage = document.getElementById("empty-message");
const noResultsMessage = document.getElementById("no-results-message");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const complianceTypeFilter = document.getElementById("compliance-type-filter");
const sortBySelect = document.getElementById("sort-by");
const sortOrderSelect = document.getElementById("sort-order");
const exportCsvBtn = document.getElementById("export-csv-btn");
const importCsvBtn = document.getElementById("import-csv-btn");
const csvFileInput = document.getElementById("csv-file-input");
const importMessage = document.getElementById("import-message");
const appMessage = document.getElementById("app-message");
const addFormMessage = document.getElementById("add-form-message");
const editFormMessage = document.getElementById("edit-form-message");

// Used to sort status in a sensible order (Valid → Due Soon → Expired)
const STATUS_SORT_ORDER = { valid: 1, dueSoon: 2, expired: 3 };

const summaryTotal = document.getElementById("summary-total");
const summaryValid = document.getElementById("summary-valid");
const summaryDueSoon = document.getElementById("summary-due-soon");
const summaryExpired = document.getElementById("summary-expired");
const summaryCards = document.querySelectorAll(".summary-card");
const resetSampleBtn = document.getElementById("reset-sample-btn");
const editSection = document.getElementById("edit-person-section");
const editForm = document.getElementById("edit-person-form");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const editIdInput = document.getElementById("edit-id");
const editRecordIdInput = document.getElementById("edit-record-id");

// Tracks which dashboard expiry window is active (30, 60, 90, or null)
let expiryWindowFilter = null;

const dashboard30Count = document.getElementById("dashboard-30-count");
const dashboard60Count = document.getElementById("dashboard-60-count");
const dashboard90Count = document.getElementById("dashboard-90-count");
const dashboardActionCount = document.getElementById("dashboard-action-count");
const dashboardCards = document.querySelectorAll(".dashboard-card[data-days]");
const actionRequiredCard = document.getElementById("action-required-card");
const remindersTableBody = document.getElementById("reminders-table-body");
const remindersEmpty = document.getElementById("reminders-empty");
const remindersSection = document.getElementById("reminders-section");
const reminderDays30 = document.getElementById("reminder-days-30");
const reminderDays14 = document.getElementById("reminder-days-14");
const reminderDays7 = document.getElementById("reminder-days-7");
const hideSentRemindersCheckbox = document.getElementById("hide-sent-reminders");
const peopleSection = document.getElementById("people-section");
const addPersonSection = document.getElementById("add-person-section");

// Copy the 20 sample people into the working people list
function getDateDaysFromToday(daysFromToday) {
  const date = getTodayAtMidnight();
  date.setDate(date.getDate() + daysFromToday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function applySampleData() {
  people = samplePeople.map((person, index) => ({
    id: person.id,
    name: person.name,
    role: person.role,
    complianceRecords: [
      {
        id: index + 1,
        complianceType: DEFAULT_COMPLIANCE_TYPE,
        expiryDate:
          index === 0
            ? getDateDaysFromToday(30)
            : normalizeExpiryDate(person.dbsExpiry),
        notes: "",
      },
    ],
  }));

  nextPersonId = 21;
  nextRecordId = 1000;
}

// Save the current people list and IDs to localStorage
function savePeople() {
  const data = {
    people: people,
    nextPersonId: nextPersonId,
    nextRecordId: nextRecordId,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Check if a stored person uses the old flat record format
function isLegacyPerson(person) {
  return (
    !Array.isArray(person.complianceRecords) &&
    (typeof person.dbsExpiry === "string" || typeof person.expiryDate === "string")
  );
}

// Build one compliance record object
function createComplianceRecord(data, recordId) {
  return {
    id: recordId,
    complianceType: normalizeComplianceType(data.complianceType),
    expiryDate: normalizeExpiryDate(data.expiryDate || data.dbsExpiry),
    notes: typeof data.notes === "string" ? data.notes : "",
  };
}

// Convert an old flat person row into the new nested format
function migrateLegacyPerson(person, recordId) {
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    complianceRecords: [createComplianceRecord(person, recordId)],
  };
}

// Make sure a person has the expected nested structure
function normalizePerson(person) {
  if (isLegacyPerson(person)) {
    const recordId = nextRecordId;
    nextRecordId += 1;
    return migrateLegacyPerson(person, recordId);
  }

  return {
    id: person.id,
    name: person.name,
    role: person.role,
    complianceRecords: (person.complianceRecords || []).map((record) => ({
      id: record.id,
      complianceType: normalizeComplianceType(record.complianceType),
      expiryDate: normalizeExpiryDate(record.expiryDate || record.dbsExpiry),
      notes: typeof record.notes === "string" ? record.notes : "",
    })),
  };
}

// Flatten people into one table row per compliance record
function getAllComplianceRows() {
  const rows = [];

  people.forEach((person) => {
    person.complianceRecords.forEach((record) => {
      rows.push({
        personId: person.id,
        recordId: record.id,
        name: person.name,
        role: person.role,
        complianceType: record.complianceType,
        expiryDate: record.expiryDate,
        notes: record.notes || "",
      });
    });
  });

  return rows;
}

function findPersonById(personId) {
  return people.find((person) => person.id === personId);
}

function findPersonByName(name) {
  const trimmed = name.trim().toLowerCase();
  return people.find((person) => person.name.trim().toLowerCase() === trimmed);
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

// Load reminder period settings from localStorage
function loadReminderSettings() {
  const saved = localStorage.getItem(REMINDER_SETTINGS_KEY);

  if (saved === null) {
    reminderSettings = { ...DEFAULT_REMINDER_SETTINGS };
    saveReminderSettings();
    syncReminderSettingsUI();
    return;
  }

  try {
    const data = JSON.parse(saved);
    reminderSettings = {
      days30: data.days30 !== false,
      days14: data.days14 !== false,
      days7: data.days7 !== false,
      hideSentReminders: data.hideSentReminders === true,
    };
  } catch (error) {
    reminderSettings = { ...DEFAULT_REMINDER_SETTINGS };
    saveReminderSettings();
  }

  syncReminderSettingsUI();
}

// Save reminder period settings to localStorage
function saveReminderSettings() {
  localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(reminderSettings));
}

// Update checkboxes to match saved settings
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

// Read the hide-sent toggle from the checkbox (live UI) or saved settings
function isHideSentRemindersEnabled() {
  if (hideSentRemindersCheckbox) {
    return hideSentRemindersCheckbox.checked;
  }

  return reminderSettings.hideSentReminders === true;
}

// Read checkboxes and refresh reminders
function handleReminderSettingsChange() {
  reminderSettings = {
    days30: reminderDays30.checked,
    days14: reminderDays14.checked,
    days7: reminderDays7.checked,
    hideSentReminders: hideSentRemindersCheckbox
      ? hideSentRemindersCheckbox.checked
      : false,
  };

  saveReminderSettings();
  renderReminders();
}

// Return only the reminder periods that are turned on
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

// Check that a date string is a real calendar date in YYYY-MM-DD format
function isValidExpiryDate(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// Validate name, role, compliance type, and expiry date from a form or CSV row
function normalizeComplianceType(value) {
  if (COMPLIANCE_TYPES.includes(value)) {
    return value;
  }

  return DEFAULT_COMPLIANCE_TYPE;
}

function validatePersonInput(name, role, complianceType, dbsExpiry) {
  const errors = [];
  const trimmedName = name.trim();
  const trimmedRole = role.trim();
  const normalizedType = normalizeComplianceType(complianceType);

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
    errors: errors,
    name: trimmedName,
    role: trimmedRole,
    complianceType: normalizedType,
    dbsExpiry: dbsExpiry,
  };
}

// Show a success or error message in a message box
function showMessage(element, text, type) {
  element.textContent = text;
  element.classList.remove("hidden", "message-success", "message-error");
  element.classList.add(type === "success" ? "message-success" : "message-error");
}

// Hide a message box
function hideMessage(element) {
  element.classList.add("hidden");
  element.textContent = "";
}

// Check that data loaded from localStorage has the shape we expect
function isValidStoredData(data) {
  if (!data || !Array.isArray(data.people)) {
    return false;
  }

  const hasPersonIds =
    typeof data.nextPersonId === "number" || typeof data.nextId === "number";
  const hasRecordIds = typeof data.nextRecordId === "number";

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

    if (isLegacyPerson(person)) {
      const expiry = person.expiryDate || person.dbsExpiry;
      return typeof expiry === "string" && isValidExpiryDate(normalizeExpiryDate(expiry));
    }

    if (!Array.isArray(person.complianceRecords) || person.complianceRecords.length === 0) {
      return false;
    }

    return person.complianceRecords.every(
      (record) =>
        typeof record.id === "number" &&
        COMPLIANCE_TYPES.includes(normalizeComplianceType(record.complianceType)) &&
        typeof (record.expiryDate || record.dbsExpiry) === "string" &&
        isValidExpiryDate(normalizeExpiryDate(record.expiryDate || record.dbsExpiry)) &&
        (record.notes === undefined || typeof record.notes === "string")
    );
  });
}

// Load people from localStorage, or use sample data on first visit
function loadPeople() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === null) {
    applySampleData();
    savePeople();
    return;
  }

  try {
    const data = JSON.parse(saved);

    if (!isValidStoredData(data)) {
      throw new Error("Stored data is invalid");
    }

    nextPersonId = data.nextPersonId || data.nextId;
    nextRecordId = data.nextRecordId || 1000;

    people = data.people.map((person) => normalizePerson(person));
    savePeople();
  } catch (error) {
    applySampleData();
    savePeople();
    showMessage(
      appMessage,
      "Your saved data could not be loaded, so the sample data has been restored.",
      "error"
    );
  }
}

// Restore the original 20 sample people (replaces current data)
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
  showMessage(appMessage, "Sample data has been restored.", "success");
  renderTable();
}

// Format a date string (YYYY-MM-DD) for display
function formatDate(dateString) {
  const date = parseDateAtMidnight(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Get today's date at midnight (local time)
function getTodayAtMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Turn a stored date into YYYY-MM-DD (handles extra time text from imports)
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

// Parse a YYYY-MM-DD string as a local date at midnight
function parseDateAtMidnight(dateString) {
  const normalized = normalizeExpiryDate(dateString);
  const parts = normalized.split("-").map(Number);

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return new Date(NaN);
  }

  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

// Calculate whole days from today (midnight) until expiry (midnight)
function getDaysUntilExpiry(expiryDate) {
  const today = getTodayAtMidnight();
  const expiry = parseDateAtMidnight(expiryDate);

  if (Number.isNaN(expiry.getTime())) {
    return NaN;
  }

  const diffMs = expiry.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Show days remaining in the table (or Expired)
function formatDaysRemaining(expiryDate) {
  const daysRemaining = getDaysUntilExpiry(expiryDate);

  if (Number.isNaN(daysRemaining)) {
    return "—";
  }

  if (daysRemaining < 0) {
    return "Expired";
  }

  if (daysRemaining === 0) {
    return "0 (today)";
  }

  return String(daysRemaining);
}

// Work out if a DBS is valid, due soon, or expired
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

// Count compliance records expiring within a number of days (today through N days)
function countExpiringWithinDays(days) {
  return getAllComplianceRows().filter((row) => {
    const daysRemaining = getDaysUntilExpiry(row.expiryDate);

    if (Number.isNaN(daysRemaining)) {
      return false;
    }

    return daysRemaining >= 0 && daysRemaining <= days;
  }).length;
}

// Work out the most urgent active reminder for one compliance record
function getReminderForRecord(record) {
  const daysRemaining = getDaysUntilExpiry(record.expiryDate);

  if (Number.isNaN(daysRemaining)) {
    return null;
  }

  if (daysRemaining < 0) {
    return {
      reminderType: REMINDER_LABELS.expired,
      urgencyKey: "expired",
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

// Build the audit-trail text for a reminder type (e.g. "7 Day Reminder Sent")
function getReminderSentText(reminderType) {
  if (reminderType === REMINDER_LABELS.expired) {
    return "Expired Reminder Sent";
  }

  return `${reminderType} Sent`;
}

// Format today's date for audit notes (DD/MM/YYYY)
function formatAuditDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Check whether this reminder type is already logged in the record notes
function hasReminderBeenSent(notes, sentLabel) {
  if (!notes) {
    return false;
  }

  return notes.split(/\r?\n/).some((line) => line.includes(sentLabel));
}

// Use the same sent text for Mark Sent, duplicate checks, and filtering
function isReminderTypeMarkedSent(notes, reminderType) {
  return hasReminderBeenSent(notes, getReminderSentText(reminderType));
}

function getRecordNotes(personId, recordId) {
  const result = findPersonAndRecord(personId, recordId);
  return result ? result.record.notes || "" : "";
}

// Refresh the Action Required table and count
function refreshActionRequiredUI() {
  renderReminders();
  requestAnimationFrame(() => {
    renderReminders();
  });
}

// Record that a reminder was sent by appending a timestamped note
function markReminderSent(personId, recordId, reminderType) {
  const result = findPersonAndRecord(personId, recordId);
  if (!result) {
    return;
  }

  const sentText = getReminderSentText(reminderType);
  const existingNotes = result.record.notes || "";

  if (isReminderTypeMarkedSent(existingNotes, reminderType)) {
    showMessage(
      appMessage,
      `This ${sentText.toLowerCase()} entry is already recorded.`,
      "error"
    );
    return;
  }

  const auditLine = `${formatAuditDate()} - ${sentText}`;
  result.record.notes = existingNotes ? `${existingNotes}\n${auditLine}` : auditLine;

  savePeople();
  syncNotesInTable(personId, recordId, result.record.notes);
  refreshActionRequiredUI();
  showMessage(appMessage, `Recorded: ${auditLine}`, "success");
}

// Update the notes field in the main table if that record is visible
function syncNotesInTable(personId, recordId, notes) {
  const textarea = tableBody.querySelector(
    `.notes-input[data-person-id="${personId}"][data-record-id="${recordId}"]`
  );

  if (textarea) {
    textarea.value = notes;
  }
}

// Build all active reminders (before hide-sent filtering)
function buildActiveReminders() {
  const reminders = [];

  getAllComplianceRows().forEach((row) => {
    const reminder = getReminderForRecord({
      expiryDate: row.expiryDate,
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
      daysRemaining: getDaysUntilExpiry(row.expiryDate),
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

// Apply the hide-sent toggle to the active reminder list
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

// Return only the compliance rows that match the current filters
function getFilteredComplianceRows() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  const selectedComplianceType = complianceTypeFilter.value;

  return getAllComplianceRows().filter((row) => {
    const matchesSearch =
      searchTerm === "" ||
      row.name.toLowerCase().includes(searchTerm) ||
      row.role.toLowerCase().includes(searchTerm);

    const status = getStatus(row.expiryDate);
    const matchesStatus =
      selectedStatus === "all" || status.key === selectedStatus;

    const matchesComplianceType =
      selectedComplianceType === "all" ||
      row.complianceType === selectedComplianceType;

    let matchesExpiryWindow = true;
    if (expiryWindowFilter !== null) {
      const daysUntilExpiry = getDaysUntilExpiry(row.expiryDate);
      matchesExpiryWindow =
        daysUntilExpiry >= 0 && daysUntilExpiry <= expiryWindowFilter;
    }

    return (
      matchesSearch &&
      matchesStatus &&
      matchesComplianceType &&
      matchesExpiryWindow
    );
  });
}

// Sort compliance rows by the selected column and order
function sortComplianceRows(list) {
  const sortBy = sortBySelect.value;
  const sortOrder = sortOrderSelect.value;
  const direction = sortOrder === "asc" ? 1 : -1;
  const sorted = [...list];

  sorted.sort((a, b) => {
    let comparison = 0;

    if (sortBy === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === "dbsExpiry") {
      comparison = a.expiryDate.localeCompare(b.expiryDate);
    } else if (sortBy === "status") {
      const statusA = getStatus(a.expiryDate).key;
      const statusB = getStatus(b.expiryDate).key;
      comparison = STATUS_SORT_ORDER[statusA] - STATUS_SORT_ORDER[statusB];
    }

    return comparison * direction;
  });

  return sorted;
}

// Count compliance records in each status group
function getSummaryCounts() {
  const counts = { total: 0, valid: 0, dueSoon: 0, expired: 0 };

  getAllComplianceRows().forEach((row) => {
    counts.total += 1;
    const status = getStatus(row.expiryDate);
    counts[status.key] += 1;
  });

  return counts;
}

// Update the summary cards at the top of the page
function renderSummary() {
  const counts = getSummaryCounts();

  summaryTotal.textContent = counts.total;
  summaryValid.textContent = counts.valid;
  summaryDueSoon.textContent = counts.dueSoon;
  summaryExpired.textContent = counts.expired;

  updateSummaryActiveState();
}

// Update the compliance dashboard counts
function renderDashboard() {
  dashboard30Count.textContent = countExpiringWithinDays(30);
  dashboard60Count.textContent = countExpiringWithinDays(60);
  dashboard90Count.textContent = countExpiringWithinDays(90);
  renderReminders();
  updateFilterActiveState();
}

function getTotalActiveReminders() {
  return buildActiveReminders().length;
}

// Update the Action Required count and table
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
      remindersEmpty.textContent =
        "All reminder periods are turned off. Turn on a setting above to see reminders.";
    } else if (activeReminders.length > 0 && hideSent) {
      remindersEmpty.textContent =
        "All active reminders have been marked as sent.";
    } else {
      remindersEmpty.textContent = "No action required at this time.";
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

// Highlight the active summary card
function updateSummaryActiveState() {
  summaryCards.forEach((card) => {
    const cardStatus = card.dataset.status;
    const isActive =
      expiryWindowFilter === null && statusFilter.value === cardStatus;
    card.classList.toggle("active", isActive);
  });
}

// Highlight the active dashboard card
function updateDashboardActiveState() {
  dashboardCards.forEach((card) => {
    const days = Number(card.dataset.days);
    const isActive = expiryWindowFilter === days;
    card.classList.toggle("active", isActive);
  });
}

// Update highlights on summary and dashboard cards
function updateFilterActiveState() {
  updateSummaryActiveState();
  updateDashboardActiveState();
}

// Clear search, status, and expiry window filters
function clearAllFilters() {
  searchInput.value = "";
  statusFilter.value = "all";
  complianceTypeFilter.value = "all";
  expiryWindowFilter = null;
  updateFilterActiveState();
}

// Show everyone in the table (clears all filters)
function showAllPeople() {
  clearAllFilters();
  renderTable();
  peopleSection.scrollIntoView({ behavior: "smooth" });
}

// Filter the table to people expiring within a set number of days
function filterByExpiryWindow(days) {
  expiryWindowFilter = days;
  searchInput.value = "";
  statusFilter.value = "all";
  complianceTypeFilter.value = "all";
  sortBySelect.value = "dbsExpiry";
  sortOrderSelect.value = "asc";
  updateFilterActiveState();
  renderTable();
  peopleSection.scrollIntoView({ behavior: "smooth" });
}

// Filter the table by status (used by summary cards and quick actions)
function filterByStatus(statusKey) {
  expiryWindowFilter = null;
  searchInput.value = "";
  statusFilter.value = statusKey;
  complianceTypeFilter.value = "all";
  updateFilterActiveState();
  renderTable();
  peopleSection.scrollIntoView({ behavior: "smooth" });
}

// Show the edit form for one compliance record
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

  hideMessage(editFormMessage);
  editSection.classList.remove("hidden");
  editSection.scrollIntoView({ behavior: "smooth" });
}

// Hide the edit form and clear its fields
function hideEditForm() {
  editSection.classList.add("hidden");
  editForm.reset();
  hideMessage(editFormMessage);
}

// Save updated details for one person and compliance record
function updatePerson(personId, recordId, name, role, complianceType, expiryDate) {
  const validation = validatePersonInput(name, role, complianceType, expiryDate);

  if (!validation.valid) {
    showMessage(editFormMessage, validation.errors.join(" "), "error");
    return false;
  }

  const result = findPersonAndRecord(personId, recordId);
  if (!result) return false;

  result.person.name = validation.name;
  result.person.role = validation.role;
  result.record.complianceType = validation.complianceType;
  result.record.expiryDate = normalizeExpiryDate(validation.dbsExpiry);

  savePeople();
  hideEditForm();
  showMessage(appMessage, "Record updated successfully.", "success");
  renderTable();
  return true;
}

// Save notes for one compliance record
function updateRecordNotes(personId, recordId, notes) {
  const result = findPersonAndRecord(personId, recordId);
  if (!result) return;

  const currentNotes = result.record.notes || "";
  if (currentNotes === notes) return;

  // Do not let a stale textarea blur wipe audit-trail entries
  if (
    currentNotes.includes("Reminder Sent") &&
    !notes.includes("Reminder Sent")
  ) {
    return;
  }

  result.record.notes = notes;
  savePeople();
}

// Remove one compliance record (and the person if it was their last record)
function deleteComplianceRecord(personId, recordId) {
  const person = findPersonById(personId);
  if (!person) return;

  if (
    Number(editIdInput.value) === personId &&
    Number(editRecordIdInput.value) === recordId
  ) {
    hideEditForm();
  }

  person.complianceRecords = person.complianceRecords.filter(
    (record) => record.id !== recordId
  );

  if (person.complianceRecords.length === 0) {
    people = people.filter((item) => item.id !== personId);
  }

  savePeople();
  renderTable();
}

// Format a stored expiry date for audit notes (DD/MM/YYYY)
function formatExpiryDateForAuditNote(dateString) {
  const date = parseDateAtMidnight(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return formatAuditDate(date);
}

// Renew one compliance record with a new expiry date and audit note
function renewComplianceRecord(personId, recordId) {
  const result = findPersonAndRecord(personId, recordId);
  if (!result) {
    return;
  }

  const input = prompt("Enter new expiry date (YYYY-MM-DD):");
  if (input === null) {
    return;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    showMessage(appMessage, "Renewal cancelled. Expiry date cannot be blank.", "error");
    return;
  }

  if (!isValidExpiryDate(trimmed)) {
    showMessage(
      appMessage,
      "Invalid date. Please enter a valid date in YYYY-MM-DD format.",
      "error"
    );
    return;
  }

  const newExpiryDate = normalizeExpiryDate(trimmed);
  const existingNotes = result.record.notes || "";
  const auditLine = `${formatAuditDate()} - Compliance renewed. New expiry date: ${formatExpiryDateForAuditNote(newExpiryDate)}`;

  result.record.expiryDate = newExpiryDate;
  result.record.notes = existingNotes ? `${existingNotes}\n${auditLine}` : auditLine;

  savePeople();

  if (
    Number(editIdInput.value) === personId &&
    Number(editRecordIdInput.value) === recordId
  ) {
    document.getElementById("edit-dbs-expiry").value = newExpiryDate;
  }

  showMessage(
    appMessage,
    `Compliance renewed. New expiry date: ${formatDate(newExpiryDate)}.`,
    "success"
  );
  renderTable();
}

// Draw the table — one row per compliance record
function renderTable() {
  tableBody.innerHTML = "";

  const filteredRows = getFilteredComplianceRows();
  const displayedRows = sortComplianceRows(filteredRows);
  const totalCount = getTotalRecordCount();
  const displayedCount = displayedRows.length;

  displayedRows.forEach((row) => {
    const status = getStatus(row.expiryDate);
    const daysRemaining = getDaysUntilExpiry(row.expiryDate);
    const daysClass =
      !Number.isNaN(daysRemaining) && daysRemaining < 0
        ? "days-remaining expired-text"
        : "days-remaining";
    const tableRow = document.createElement("tr");

    tableRow.innerHTML = `
      <td>${row.name}</td>
      <td>${row.role}</td>
      <td class="compliance-type-cell">${row.complianceType}</td>
      <td>${formatDate(row.expiryDate)}</td>
      <td class="${daysClass}">${formatDaysRemaining(row.expiryDate)}</td>
      <td><span class="status ${status.className}">${status.label}</span></td>
      <td class="notes-cell">
        <textarea class="notes-input" data-person-id="${row.personId}" data-record-id="${row.recordId}" rows="2" placeholder="Add follow-up notes...">${escapeHtml(row.notes || "")}</textarea>
      </td>
      <td>
        <div class="action-buttons">
          <button type="button" class="edit-btn" data-person-id="${row.personId}" data-record-id="${row.recordId}">Edit</button>
          <button type="button" class="renew-btn" data-person-id="${row.personId}" data-record-id="${row.recordId}">Renew</button>
          <button type="button" class="delete-btn" data-person-id="${row.personId}" data-record-id="${row.recordId}">Delete</button>
        </div>
      </td>
    `;

    tableBody.appendChild(tableRow);
  });

  if (displayedCount === totalCount) {
    personCount.textContent =
      displayedCount === 1 ? "1 record" : `${displayedCount} records`;
  } else {
    personCount.textContent = `Showing ${displayedCount} of ${totalCount} records`;
  }

  emptyMessage.classList.toggle("hidden", totalCount > 0);
  noResultsMessage.classList.toggle("hidden", displayedCount > 0 || totalCount === 0);

  renderSummary();
  renderDashboard();
}

// Wrap a value in quotes if it contains a comma or quote (keeps CSV valid)
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsvValue(value) {
  const text = String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

// Build a CSV file from all compliance records and download it
function exportToCsv() {
  const headers = ["Name", "Role", "Compliance Type", "Expiry Date", "Status", "Notes"];

  const rows = getAllComplianceRows().map((row) => {
    const status = getStatus(row.expiryDate);

    return [
      escapeCsvValue(row.name),
      escapeCsvValue(row.role),
      escapeCsvValue(row.complianceType),
      escapeCsvValue(formatDate(row.expiryDate)),
      escapeCsvValue(status.label),
      escapeCsvValue(row.notes || ""),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "compliance-reminder-data.csv";
  link.click();

  URL.revokeObjectURL(link.href);
}

// Split one CSV line into values (handles commas inside quotes)
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

// Find which column number matches a header name
function findColumnIndex(headers, targetName) {
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  return normalizedHeaders.indexOf(targetName.toLowerCase());
}

// Turn a date string from CSV into YYYY-MM-DD format
function parseExpiryDate(value) {
  const text = value.trim();
  if (!text) return null;

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return isValidExpiryDate(text) ? text : null;
  }

  // Try other formats (including dates exported from this app)
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

// Build a readable summary of why CSV rows were skipped
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

// Add a compliance record — reuse an existing person when the name matches
function addComplianceRecord(name, role, complianceType, expiryDate) {
  const record = createComplianceRecord(
    { complianceType, expiryDate, notes: "" },
    nextRecordId
  );
  nextRecordId += 1;

  const existingPerson = findPersonByName(name);

  if (existingPerson) {
    existingPerson.name = name;
    existingPerson.role = role;
    existingPerson.complianceRecords.push(record);
    return { isNewPerson: false };
  }

  people.push({
    id: nextPersonId,
    name,
    role,
    complianceRecords: [record],
  });
  nextPersonId += 1;

  return { isNewPerson: true };
}

// Read CSV text and add valid rows as compliance records
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

  if (nameIndex === -1 || roleIndex === -1 || expiryIndex === -1) {
    return {
      imported: 0,
      skipped: 0,
      error: "CSV must include columns: Name, Role, and Expiry Date (or DBS Expiry Date).",
    };
  }

  let imported = 0;
  let skipped = 0;
  const skipReasons = {
    missingName: 0,
    missingRole: 0,
    missingDate: 0,
    invalidDate: 0,
  };

  for (let i = 1; i < lines.length; i++) {
    const columns = parseCsvLine(lines[i]);
    const name = columns[nameIndex]?.trim() ?? "";
    const role = columns[roleIndex]?.trim() ?? "";
    const rawDate = columns[expiryIndex]?.trim() ?? "";
    const complianceType =
      complianceTypeIndex === -1
        ? DEFAULT_COMPLIANCE_TYPE
        : columns[complianceTypeIndex]?.trim() ?? DEFAULT_COMPLIANCE_TYPE;

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
      normalizeComplianceType(complianceType),
      normalizeExpiryDate(expiryDate)
    );

    imported += 1;
  }

  if (imported > 0) {
    savePeople();
  }

  return { imported, skipped, skipReasons, error: null };
}

// Show a message after importing a CSV file
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

// Handle the user choosing a CSV file to import
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

// Handle Edit and Delete in the table
tableBody.addEventListener("click", (event) => {
  const button = event.target;
  if (!button.matches("button")) return;

  const personId = Number(button.dataset.personId);
  const recordId = Number(button.dataset.recordId);

  if (button.classList.contains("edit-btn")) {
    startEdit(personId, recordId);
  } else if (button.classList.contains("renew-btn")) {
    renewComplianceRecord(personId, recordId);
  } else if (button.classList.contains("delete-btn")) {
    deleteComplianceRecord(personId, recordId);
  }
});

tableBody.addEventListener("blur", (event) => {
  if (!event.target.classList.contains("notes-input")) return;

  const personId = Number(event.target.dataset.personId);
  const recordId = Number(event.target.dataset.recordId);
  const textarea = event.target;

  setTimeout(() => {
    updateRecordNotes(personId, recordId, textarea.value);
  }, 0);
}, true);

// Handle the edit-person form
editForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const personId = Number(editIdInput.value);
  const recordId = Number(editRecordIdInput.value);
  const name = document.getElementById("edit-name").value.trim();
  const role = document.getElementById("edit-role").value.trim();
  const complianceType = document.getElementById("edit-compliance-type").value;
  const expiryDate = document.getElementById("edit-dbs-expiry").value;

  updatePerson(personId, recordId, name, role, complianceType, expiryDate);
});

cancelEditBtn.addEventListener("click", hideEditForm);

// Handle the add-person form
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const nameInput = document.getElementById("name");
  const roleInput = document.getElementById("role");
  const complianceTypeInput = document.getElementById("compliance-type");
  const expiryInput = document.getElementById("dbs-expiry");

  const validation = validatePersonInput(
    nameInput.value,
    roleInput.value,
    complianceTypeInput.value,
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
    normalizeExpiryDate(validation.dbsExpiry)
  );

  savePeople();
  form.reset();
  showMessage(
    appMessage,
    result.isNewPerson
      ? "Person and compliance record added successfully."
      : "Compliance record added for existing person.",
    "success"
  );
  renderTable();
});

resetSampleBtn.addEventListener("click", resetSampleData);

dashboardCards.forEach((card) => {
  card.addEventListener("click", () => {
    filterByExpiryWindow(Number(card.dataset.days));
  });
});

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

document.getElementById("action-show-all").addEventListener("click", showAllPeople);

document.getElementById("action-show-expired").addEventListener("click", () => {
  filterByStatus("expired");
});

document.getElementById("action-show-due-soon").addEventListener("click", () => {
  filterByStatus("dueSoon");
});

document.getElementById("action-add-person").addEventListener("click", () => {
  addPersonSection.scrollIntoView({ behavior: "smooth" });
  document.getElementById("name").focus();
});

document.getElementById("action-export-csv").addEventListener("click", exportToCsv);

searchInput.addEventListener("input", () => {
  expiryWindowFilter = null;
  updateFilterActiveState();
  renderTable();
});

statusFilter.addEventListener("change", () => {
  expiryWindowFilter = null;
  updateFilterActiveState();
  renderTable();
});

complianceTypeFilter.addEventListener("change", () => {
  expiryWindowFilter = null;
  updateFilterActiveState();
  renderTable();
});

sortBySelect.addEventListener("change", renderTable);
sortOrderSelect.addEventListener("change", renderTable);
exportCsvBtn.addEventListener("click", exportToCsv);
importCsvBtn.addEventListener("click", () => csvFileInput.click());
csvFileInput.addEventListener("change", handleCsvImport);

// Load saved data, then show the table
loadReminderSettings();
loadPeople();
renderTable();
