export const STORAGE_KEY = "complianceReminderPeople";
export const REMINDER_SETTINGS_KEY = "complianceReminderSettings";
export const BACKUP_VERSION = 1;

export const COMPLIANCE_TYPES = [
  "DBS",
  "Basic Awareness",
  "Foundations",
  "Leadership",
  "Senior Leadership",
  "Domestic Abuse",
  "Safer Recruitment",
  "Modern Slavery",
];

export const DEFAULT_COMPLIANCE_TYPE = "DBS";
export const RENEWAL_CYCLE_MANUAL = "manual";

export const RENEWAL_CYCLE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "6-months", label: "6 Months" },
  { value: "1-year", label: "1 Year" },
  { value: "2-years", label: "2 Years" },
  { value: "3-years", label: "3 Years" },
  { value: "5-years", label: "5 Years" },
];

export const DEFAULT_RENEWAL_CYCLE = "3-years";
export const MAX_EVIDENCE_FILE_BYTES = 512 * 1024;

export const EVIDENCE_TYPES = [
  "DBS Certificate",
  "Training Certificate",
  "Policy Acknowledgement",
  "ID Check",
  "Right to Work",
  "Other",
];

export const ACTION_STATUSES = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

export const ACTION_STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
};

export const HISTORY_ACTIONS = {
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
  ACTION_DELETED: "action_deleted",
};

export const DEFAULT_REMINDER_SETTINGS = {
  days30: true,
  days14: true,
  days7: true,
  hideSentReminders: false,
};
