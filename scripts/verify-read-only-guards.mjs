process.env.DATA_BACKEND = "cloud";
process.env.AUTH_MODE = "supabase";

const {
  canAddComplianceRecord,
  canEditComplianceRecord,
  canMarkReminderSent,
  canMutateData,
  canMutateReminderSettings,
  canRenewCompliance,
  canSetActionStatus,
  canMutateActions,
  canMutateEvidence,
  canUpdateComplianceRecordNotes,
  canArchiveComplianceRecord,
  isCloudMode,
} = await import("../js/app/permissions.js");

if (!isCloudMode()) {
  console.error("Expected cloud mode.");
  process.exit(1);
}

if (canMutateData()) {
  console.error("canMutateData() must be false in cloud mode.");
  process.exit(1);
}

if (canMutateReminderSettings()) {
  console.error("canMutateReminderSettings() must be false in cloud read-only mode.");
  process.exit(1);
}

if (canMarkReminderSent()) {
  console.error("canMarkReminderSent() must be false when CLOUD_WRITES_ENABLED is not set.");
  process.exit(1);
}

if (canSetActionStatus()) {
  console.error("canSetActionStatus() must be false when CLOUD_WRITES_ENABLED is not set.");
  process.exit(1);
}

if (canMutateActions()) {
  console.error("canMutateActions() must be false when CLOUD_WRITES_ENABLED is not set.");
  process.exit(1);
}

if (canMutateEvidence()) {
  console.error("canMutateEvidence() must be false when CLOUD_WRITES_ENABLED is not set.");
  process.exit(1);
}

if (canRenewCompliance()) {
  console.error("canRenewCompliance() must be false when CLOUD_WRITES_ENABLED is not set.");
  process.exit(1);
}

if (canAddComplianceRecord()) {
  console.error("canAddComplianceRecord() must be false when CLOUD_WRITES_ENABLED is not set.");
  process.exit(1);
}

if (canEditComplianceRecord()) {
  console.error("canEditComplianceRecord() must be false when CLOUD_WRITES_ENABLED is not set.");
  process.exit(1);
}

if (canUpdateComplianceRecordNotes()) {
  console.error(
    "canUpdateComplianceRecordNotes() must be false when CLOUD_WRITES_ENABLED is not set."
  );
  process.exit(1);
}

if (canArchiveComplianceRecord()) {
  console.error(
    "canArchiveComplianceRecord() must be false when CLOUD_WRITES_ENABLED is not set."
  );
  process.exit(1);
}

console.log("Read-only guards smoke test: OK");
