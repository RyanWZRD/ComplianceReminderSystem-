/**
 * V6 Phase 14: Real provider skeleton verification.
 * In-memory checks for skeleton provider modules and adapter routing — no Supabase,
 * browser, real email provider, outbound delivery, or app wiring.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmailProviderAdapter,
  UNIMPLEMENTED_EMAIL_PROVIDERS,
} from "../js/app/automation/email-provider-adapter.js";
import { createResendEmailProvider } from "../js/app/automation/providers/resend-provider.js";
import { createSendgridEmailProvider } from "../js/app/automation/providers/sendgrid-provider.js";
import { createSmtpEmailProvider } from "../js/app/automation/providers/smtp-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {readonly { provider: string; path: string; factoryName: string; create: (options?: { config?: Record<string, unknown> }) => { healthCheck: () => Promise<unknown>; sendReminder: (input: unknown) => Promise<unknown> } } }[]} */
const SKELETON_PROVIDERS = [
  {
    provider: "resend",
    path: "js/app/automation/providers/resend-provider.js",
    factoryName: "createResendEmailProvider",
    create: createResendEmailProvider,
  },
  {
    provider: "sendgrid",
    path: "js/app/automation/providers/sendgrid-provider.js",
    factoryName: "createSendgridEmailProvider",
    create: createSendgridEmailProvider,
  },
  {
    provider: "smtp",
    path: "js/app/automation/providers/smtp-provider.js",
    factoryName: "createSmtpEmailProvider",
    create: createSmtpEmailProvider,
  },
];

const adapterJsPath = join(root, "js/app/automation/email-provider-adapter.js");
const appJsPath = join(root, "app.js");
const packageJsonPath = join(root, "package.json");

/** @type {string[]} */
const failures = [];

function fail(label) {
  failures.push(label);
}

function assert(condition, label) {
  if (!condition) {
    fail(label);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    fail(`${label}: must not contain ${JSON.stringify(needle)}`);
  }
}

async function assertRejects(fn, expectedMessagePart, label) {
  try {
    await fn();
    fail(`${label}: expected rejection`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes(expectedMessagePart)) {
      fail(
        `${label}: expected message containing ${JSON.stringify(expectedMessagePart)}, got ${JSON.stringify(message)}`
      );
    }
  }
}

const sendInput = {
  to: "jordan.coordinator@example.com",
  subject: "DBS reminder",
  bodyText: "Please renew your DBS.",
};

const forbiddenNeedles = [
  "fetch(",
  "XMLHttpRequest",
  "nodemailer",
  "createTransport",
  "markReminderSent",
  "mark_reminder_sent",
  "@sendgrid",
  "@resend",
  "RESEND_API_KEY",
  "SENDGRID_API_KEY",
  "SMTP_HOST",
  "SMTP_PASSWORD",
];

console.log(
  "V6 Phase 14 real provider skeleton verification (verify-email-provider-skeletons)\n"
);

const adapterJs = readFileSync(adapterJsPath, "utf8");
const appJs = readFileSync(appJsPath, "utf8");
const packageJson = readFileSync(packageJsonPath, "utf8");

assertContains(packageJson, '"verify-email-provider-skeletons"', "package.json verify script");

for (const skeleton of SKELETON_PROVIDERS) {
  const modulePath = join(root, skeleton.path);

  assert(existsSync(modulePath), `${skeleton.path} exists`);

  const moduleSource = readFileSync(modulePath, "utf8");

  assertContains(
    moduleSource,
    `export function ${skeleton.factoryName}`,
    `${skeleton.path} exports ${skeleton.factoryName}`
  );

  for (const needle of forbiddenNeedles) {
    assertNotContains(moduleSource, needle, `${skeleton.path} has no ${needle}`);
  }

  const provider = skeleton.create({ config: { provider: skeleton.provider, enabled: true } });
  const health = await provider.healthCheck();

  assertEqual(health.status, "not_implemented", `${skeleton.provider} skeleton healthCheck status`);
  assertEqual(health.provider, skeleton.provider, `${skeleton.provider} skeleton healthCheck provider`);

  await assertRejects(
    () => provider.sendReminder(sendInput),
    `Provider ${skeleton.provider} is not implemented yet`,
    `${skeleton.provider} skeleton sendReminder throws`
  );
}

for (const providerName of UNIMPLEMENTED_EMAIL_PROVIDERS) {
  const skeleton = SKELETON_PROVIDERS.find((entry) => entry.provider === providerName);

  assert(skeleton, `skeleton module registered for ${providerName}`);
  assertContains(adapterJs, skeleton.path.replace("js/app/automation/", "./"), `adapter imports ${providerName} skeleton`);
  assertContains(adapterJs, skeleton.factoryName, `adapter references ${skeleton.factoryName}`);

  const adapterConfig = {
    provider: providerName,
    mode: "production",
    fromEmail: "reminders@example.org",
    replyToEmail: null,
    rateLimitPerRun: 50,
    enabled: true,
  };

  const adapterProvider = createEmailProviderAdapter({ config: adapterConfig });
  const adapterHealth = await adapterProvider.healthCheck();

  assertEqual(adapterHealth.status, "not_implemented", `${providerName} adapter healthCheck status`);
  assertEqual(adapterHealth.provider, providerName, `${providerName} adapter healthCheck provider`);

  await assertRejects(
    () => adapterProvider.sendReminder(sendInput),
    `Provider ${providerName} is not implemented yet`,
    `${providerName} adapter sendReminder throws`
  );
}

for (const needle of forbiddenNeedles) {
  assertNotContains(adapterJs, needle, `email-provider-adapter.js has no ${needle}`);
}

assertNotContains(appJs, "resend-provider", "app.js is not wired to resend-provider");
assertNotContains(appJs, "sendgrid-provider", "app.js is not wired to sendgrid-provider");
assertNotContains(appJs, "smtp-provider", "app.js is not wired to smtp-provider");
assertNotContains(appJs, "email-provider-adapter", "app.js is not wired to email-provider-adapter");
assertNotContains(appJs, "createEmailProviderAdapter", "app.js does not import createEmailProviderAdapter");

if (failures.length > 0) {
  console.error("FAILURES:");
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("verify-email-provider-skeletons: all checks OK");
