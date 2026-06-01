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
let nextId = 21;

const DUE_SOON_DAYS = 90;

const form = document.getElementById("add-person-form");
const tableBody = document.getElementById("people-table-body");
const personCount = document.getElementById("person-count");
const emptyMessage = document.getElementById("empty-message");
const noResultsMessage = document.getElementById("no-results-message");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
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

// Tracks which dashboard expiry window is active (30, 60, 90, or null)
let expiryWindowFilter = null;

const dashboard30Count = document.getElementById("dashboard-30-count");
const dashboard60Count = document.getElementById("dashboard-60-count");
const dashboard90Count = document.getElementById("dashboard-90-count");
const dashboardCards = document.querySelectorAll(".dashboard-card");
const peopleSection = document.getElementById("people-section");
const addPersonSection = document.getElementById("add-person-section");

// Copy the 20 sample people into the working people list
function applySampleData() {
  people = samplePeople.map((person) => ({ ...person }));
  nextId = 21;
}

// Save the current people list and nextId to localStorage
function savePeople() {
  const data = {
    people: people,
    nextId: nextId,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

// Validate name, role, and DBS expiry date from a form or CSV row
function validatePersonInput(name, role, dbsExpiry) {
  const errors = [];
  const trimmedName = name.trim();
  const trimmedRole = role.trim();

  if (!trimmedName) {
    errors.push("Name cannot be blank.");
  }

  if (!trimmedRole) {
    errors.push("Role cannot be blank.");
  }

  if (!dbsExpiry) {
    errors.push("DBS expiry date is required.");
  } else if (!isValidExpiryDate(dbsExpiry)) {
    errors.push("DBS expiry date must be a valid date (YYYY-MM-DD).");
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    name: trimmedName,
    role: trimmedRole,
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
  if (!data || !Array.isArray(data.people) || typeof data.nextId !== "number") {
    return false;
  }

  return data.people.every(
    (person) =>
      typeof person.id === "number" &&
      typeof person.name === "string" &&
      person.name.trim() !== "" &&
      typeof person.role === "string" &&
      person.role.trim() !== "" &&
      typeof person.dbsExpiry === "string" &&
      isValidExpiryDate(person.dbsExpiry)
  );
}

// Load people from localStorage, or use sample data on first visit
function loadPeople() {
  const saved = localStorage.getItem(STORAGE_KEY);

  // First visit only — nothing saved yet, so use the sample data
  if (saved === null) {
    applySampleData();
    savePeople();
    return;
  }

  // Returning visit — read the saved data back into our app
  try {
    const data = JSON.parse(saved);

    if (!isValidStoredData(data)) {
      throw new Error("Stored data is invalid");
    }

    people = data.people.map((person) => ({
      ...person,
      dbsExpiry: normalizeExpiryDate(person.dbsExpiry),
    }));
    nextId = data.nextId;
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

// Count people whose DBS expires within a number of days (today through N days)
function countExpiringWithinDays(days) {
  return people.filter((person) => {
    const daysRemaining = getDaysUntilExpiry(person.dbsExpiry);

    if (Number.isNaN(daysRemaining)) {
      return false;
    }

    return daysRemaining >= 0 && daysRemaining <= days;
  }).length;
}

// Return only the people that match the current search and status filter
function getFilteredPeople() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  return people.filter((person) => {
    const matchesSearch =
      searchTerm === "" ||
      person.name.toLowerCase().includes(searchTerm) ||
      person.role.toLowerCase().includes(searchTerm);

    const status = getStatus(person.dbsExpiry);
    const matchesStatus =
      selectedStatus === "all" || status.key === selectedStatus;

    let matchesExpiryWindow = true;
    if (expiryWindowFilter !== null) {
      const daysUntilExpiry = getDaysUntilExpiry(person.dbsExpiry);
      matchesExpiryWindow =
        daysUntilExpiry >= 0 && daysUntilExpiry <= expiryWindowFilter;
    }

    return matchesSearch && matchesStatus && matchesExpiryWindow;
  });
}

// Sort a list of people by the selected column and order
function sortPeople(list) {
  const sortBy = sortBySelect.value;
  const sortOrder = sortOrderSelect.value;
  const direction = sortOrder === "asc" ? 1 : -1;

  // Copy the array so we don't change the original
  const sorted = [...list];

  sorted.sort((a, b) => {
    let comparison = 0;

    if (sortBy === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === "dbsExpiry") {
      comparison = a.dbsExpiry.localeCompare(b.dbsExpiry);
    } else if (sortBy === "status") {
      const statusA = getStatus(a.dbsExpiry).key;
      const statusB = getStatus(b.dbsExpiry).key;
      comparison = STATUS_SORT_ORDER[statusA] - STATUS_SORT_ORDER[statusB];
    }

    return comparison * direction;
  });

  return sorted;
}

// Count how many people are in each status group
function getSummaryCounts() {
  const counts = { total: people.length, valid: 0, dueSoon: 0, expired: 0 };

  people.forEach((person) => {
    const status = getStatus(person.dbsExpiry);
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
  updateFilterActiveState();
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
  updateFilterActiveState();
  renderTable();
  peopleSection.scrollIntoView({ behavior: "smooth" });
}

// Show the edit form with a person's current details
function startEdit(id) {
  const person = people.find((p) => p.id === id);
  if (!person) return;

  editIdInput.value = person.id;
  document.getElementById("edit-name").value = person.name;
  document.getElementById("edit-role").value = person.role;
  document.getElementById("edit-dbs-expiry").value = person.dbsExpiry;

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

// Save updated details for one person
function updatePerson(id, name, role, dbsExpiry) {
  const validation = validatePersonInput(name, role, dbsExpiry);

  if (!validation.valid) {
    showMessage(editFormMessage, validation.errors.join(" "), "error");
    return false;
  }

  const person = people.find((p) => p.id === id);
  if (!person) return false;

  person.name = validation.name;
  person.role = validation.role;
  person.dbsExpiry = normalizeExpiryDate(validation.dbsExpiry);

  savePeople();
  hideEditForm();
  showMessage(appMessage, "Person updated successfully.", "success");
  renderTable();
  return true;
}

// Remove a person by their id
function deletePerson(id) {
  const index = people.findIndex((person) => person.id === id);
  if (index === -1) return;

  if (Number(editIdInput.value) === id) {
    hideEditForm();
  }

  people.splice(index, 1);
  savePeople();
  renderTable();
}

// Draw the table — only shows people matching search and filter
function renderTable() {
  tableBody.innerHTML = "";

  const filteredPeople = getFilteredPeople();
  const displayedPeople = sortPeople(filteredPeople);
  const totalCount = people.length;
  const displayedCount = displayedPeople.length;

  displayedPeople.forEach((person) => {
    const status = getStatus(person.dbsExpiry);
    const daysRemaining = getDaysUntilExpiry(person.dbsExpiry);
    const daysClass =
      !Number.isNaN(daysRemaining) && daysRemaining < 0
        ? "days-remaining expired-text"
        : "days-remaining";
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${person.name}</td>
      <td>${person.role}</td>
      <td>${formatDate(person.dbsExpiry)}</td>
      <td class="${daysClass}">${formatDaysRemaining(person.dbsExpiry)}</td>
      <td><span class="status ${status.className}">${status.label}</span></td>
      <td>
        <div class="action-buttons">
          <button type="button" class="edit-btn" data-id="${person.id}">Edit</button>
          <button type="button" class="delete-btn" data-id="${person.id}">Delete</button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });

  if (displayedCount === totalCount) {
    personCount.textContent =
      displayedCount === 1 ? "1 person" : `${displayedCount} people`;
  } else {
    personCount.textContent = `Showing ${displayedCount} of ${totalCount} people`;
  }

  emptyMessage.classList.toggle("hidden", totalCount > 0);
  noResultsMessage.classList.toggle("hidden", displayedCount > 0 || totalCount === 0);

  renderSummary();
  renderDashboard();
}

// Wrap a value in quotes if it contains a comma or quote (keeps CSV valid)
function escapeCsvValue(value) {
  const text = String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

// Build a CSV file from all people and download it
function exportToCsv() {
  const headers = ["Name", "Role", "DBS Expiry Date", "Status"];

  const rows = people.map((person) => {
    const status = getStatus(person.dbsExpiry);

    return [
      escapeCsvValue(person.name),
      escapeCsvValue(person.role),
      escapeCsvValue(formatDate(person.dbsExpiry)),
      escapeCsvValue(status.label),
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

// Read CSV text and add valid rows to the people list
function importPeopleFromCsv(csvText) {
  const cleanedText = csvText.replace(/^\uFEFF/, "");
  const lines = cleanedText.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return { imported: 0, skipped: 0, error: "The CSV file is empty or has no data rows." };
  }

  const headers = parseCsvLine(lines[0]);
  const nameIndex = findColumnIndex(headers, "name");
  const roleIndex = findColumnIndex(headers, "role");
  const expiryIndex = findColumnIndex(headers, "dbs expiry date");

  if (nameIndex === -1 || roleIndex === -1 || expiryIndex === -1) {
    return {
      imported: 0,
      skipped: 0,
      error: "CSV must include columns: Name, Role, DBS Expiry Date.",
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

    const dbsExpiry = parseExpiryDate(rawDate);

    if (!dbsExpiry) {
      skipped += 1;
      skipReasons.invalidDate += 1;
      continue;
    }

    people.push({
      id: nextId,
      name: name,
      role: role,
      dbsExpiry: normalizeExpiryDate(dbsExpiry),
    });

    nextId += 1;
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
    let message = `No people imported. ${result.skipped} row(s) were skipped.`;
    if (reasonText) {
      message += ` Reasons: ${reasonText}.`;
    }
    showMessage(importMessage, message, "error");
    return;
  }

  if (result.skipped > 0) {
    let message = `Imported ${result.imported} people. ${result.skipped} row(s) were skipped.`;
    if (reasonText) {
      message += ` Reasons: ${reasonText}.`;
    }
    showMessage(importMessage, message, "error");
    return;
  }

  showMessage(importMessage, `Imported ${result.imported} people successfully.`, "success");
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

// Handle Edit and Delete button clicks in the table
tableBody.addEventListener("click", (event) => {
  const button = event.target;
  if (!button.matches("button")) return;

  const id = Number(button.dataset.id);

  if (button.classList.contains("edit-btn")) {
    startEdit(id);
  } else if (button.classList.contains("delete-btn")) {
    deletePerson(id);
  }
});

// Handle the edit-person form
editForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = Number(editIdInput.value);
  const name = document.getElementById("edit-name").value.trim();
  const role = document.getElementById("edit-role").value.trim();
  const dbsExpiry = document.getElementById("edit-dbs-expiry").value;

  updatePerson(id, name, role, dbsExpiry);
});

cancelEditBtn.addEventListener("click", hideEditForm);

// Handle the add-person form
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const nameInput = document.getElementById("name");
  const roleInput = document.getElementById("role");
  const expiryInput = document.getElementById("dbs-expiry");

  const validation = validatePersonInput(
    nameInput.value,
    roleInput.value,
    expiryInput.value
  );

  if (!validation.valid) {
    showMessage(addFormMessage, validation.errors.join(" "), "error");
    return;
  }

  hideMessage(addFormMessage);

  const newPerson = {
    id: nextId,
    name: validation.name,
    role: validation.role,
    dbsExpiry: normalizeExpiryDate(validation.dbsExpiry),
  };

  people.push(newPerson);
  nextId += 1;

  savePeople();
  form.reset();
  showMessage(appMessage, "Person added successfully.", "success");
  renderTable();
});

resetSampleBtn.addEventListener("click", resetSampleData);

dashboardCards.forEach((card) => {
  card.addEventListener("click", () => {
    filterByExpiryWindow(Number(card.dataset.days));
  });
});

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
sortBySelect.addEventListener("change", renderTable);
sortOrderSelect.addEventListener("change", renderTable);
exportCsvBtn.addEventListener("click", exportToCsv);
importCsvBtn.addEventListener("click", () => csvFileInput.click());
csvFileInput.addEventListener("change", handleCsvImport);

// Load saved data, then show the table
loadPeople();
renderTable();
