process.env.DATA_BACKEND = "cloud";
process.env.AUTH_MODE = "supabase";

const { canMutateData, canMutateReminderSettings, isCloudMode } = await import(
  "../js/app/permissions.js"
);

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

console.log("Read-only guards smoke test: OK");
