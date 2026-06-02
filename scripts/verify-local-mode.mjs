/**
 * Regression: DATA_BACKEND=local works without Supabase env or auth.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const supabaseEnvPath = join(root, "js", "data", "supabase-env.js");
const exampleEnvPath = join(root, "js", "data", "supabase-env.example.js");

const EMPTY_ENV_SOURCE = readFileSync(exampleEnvPath, "utf8");

/** @type {string | null} */
let supabaseEnvBackup = null;

function backupSupabaseEnv() {
  if (existsSync(supabaseEnvPath)) {
    supabaseEnvBackup = readFileSync(supabaseEnvPath, "utf8");
  }

  writeFileSync(supabaseEnvPath, EMPTY_ENV_SOURCE, "utf8");
}

function restoreSupabaseEnv() {
  if (supabaseEnvBackup === null) {
    return;
  }

  writeFileSync(supabaseEnvPath, supabaseEnvBackup, "utf8");
}

function createMockLocalStorage() {
  /** @type {Record<string, string>} */
  const storage = {};

  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
    },
    setItem(key, value) {
      storage[key] = String(value);
    },
    removeItem(key) {
      delete storage[key];
    },
    clear() {
      for (const key of Object.keys(storage)) {
        delete storage[key];
      }
    },
  };
}

process.env.DATA_BACKEND = "local";
delete process.env.AUTH_MODE;

backupSupabaseEnv();

try {
  const { isSupabaseConfigured } = await import("../js/data/supabase-client.js");

  if (isSupabaseConfigured()) {
    console.error("Expected Supabase to be unconfigured with empty supabase-env.js.");
    process.exit(1);
  }

  const { repository, DATA_BACKEND, isCloudDataBackend } = await import("../js/data/repository.js");

  if (DATA_BACKEND !== "local") {
    console.error(`Expected DATA_BACKEND local, got ${DATA_BACKEND}.`);
    process.exit(1);
  }

  if (isCloudDataBackend()) {
    console.error("Expected isCloudDataBackend() to be false.");
    process.exit(1);
  }

  if (repository.backend !== "local") {
    console.error(`Expected local repository backend, got ${repository.backend}.`);
    process.exit(1);
  }

  globalThis.localStorage = createMockLocalStorage();

  const { LocalComplianceStore } = await import("../js/data/local-store.js");

  const store = new LocalComplianceStore();
  const loadResult = store.load();

  if (!loadResult.ok || !loadResult.isFirstVisit) {
    console.error("Expected successful first-visit local load.");
    process.exit(1);
  }

  const bootLoadResult = await Promise.resolve(repository.load());

  if (!bootLoadResult.ok) {
    console.error("Expected repository.load() to succeed in local mode without Supabase.");
    process.exit(1);
  }

  console.log("Local mode regression: OK");
  console.log("  DATA_BACKEND=local with empty Supabase env");
  console.log("  repository.backend=local");
  console.log("  repository.load() succeeds (first visit)");
} finally {
  restoreSupabaseEnv();
}
