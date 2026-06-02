/**
 * Cloud login UI — uses session.js only (public auth facade).
 */

import { CLOUD_WRITES_ENABLED } from "../data/config.js";
import {
  canMarkReminderSent,
  canRenewCompliance,
  canAddComplianceRecord,
  canSetActionStatus,
} from "../app/permissions.js";
import { getCurrentUserRole, signInWithPassword, signOut } from "./session.js";

/** @type {(() => void | Promise<void>) | null} */
let onAuthenticatedCallback = null;

/**
 * @param {{ onAuthenticated: () => void | Promise<void> }} options
 */
export function initLoginPanel({ onAuthenticated }) {
  onAuthenticatedCallback = onAuthenticated;

  const form = document.getElementById("auth-login-form");

  if (form) {
    form.addEventListener("submit", handleLoginSubmit);
  }

  const signOutBtn = document.getElementById("sign-out-btn");

  if (signOutBtn) {
    signOutBtn.addEventListener("click", handleSignOutClick);
  }
}

export function showLoginScreen() {
  const screen = document.getElementById("auth-login-screen");
  const mainApp = document.getElementById("main-app");
  const bootError = document.getElementById("app-boot-error");

  if (!screen) {
    if (mainApp) {
      mainApp.classList.remove("hidden");
    }

    if (bootError) {
      bootError.textContent =
        "Cloud sign-in UI is missing from the page. Ensure index.html includes #auth-login-screen, then hard-refresh (Ctrl+Shift+R).";
      bootError.classList.remove("hidden");
    }

    return;
  }

  screen.classList.remove("hidden");
  document.documentElement.dataset.appState = "login";
  delete document.documentElement.dataset.appReady;

  if (mainApp) {
    mainApp.classList.add("hidden");
  }

  if (bootError) {
    bootError.classList.add("hidden");
    bootError.textContent = "";
  }
}

export function hideLoginScreen() {
  const screen = document.getElementById("auth-login-screen");
  const mainApp = document.getElementById("main-app");

  if (screen) {
    screen.classList.add("hidden");
  }

  delete document.documentElement.dataset.appState;

  if (mainApp) {
    mainApp.classList.remove("hidden");
  }
}

export function updateAuthChromeForCloud() {
  const signOutBtn = document.getElementById("sign-out-btn");
  const readOnlyBanner = document.getElementById("cloud-read-only-banner");

  if (signOutBtn) {
    signOutBtn.classList.remove("hidden");
  }

  if (readOnlyBanner) {
    readOnlyBanner.classList.remove("hidden");
    readOnlyBanner.textContent = getCloudModeBannerText();
  }
}

/** @returns {string} */
export function getCloudModeBannerText() {
  if (!CLOUD_WRITES_ENABLED) {
    return "Cloud mode is read-only. You can view and export data; changes are not saved to the cloud yet.";
  }

  if (
    canMarkReminderSent() ||
    canSetActionStatus() ||
    canRenewCompliance() ||
    canAddComplianceRecord()
  ) {
    return "Cloud mode (limited writes). Mark Reminder Sent, renew compliance, action complete/reopen, and add compliance records are saved to the cloud.";
  }

  const role = getCurrentUserRole();

  if (role === "viewer") {
    return "Cloud mode (view only). Your role cannot save changes to the cloud.";
  }

  return "Cloud mode is read-only. Enable cloud writes on localhost or staging to mark reminders sent.";
}

/**
 * @param {string} message
 */
export function showLoginError(message) {
  const errorEl = document.getElementById("auth-login-error");

  if (!errorEl) {
    return;
  }

  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

export function clearLoginError() {
  const errorEl = document.getElementById("auth-login-error");

  if (!errorEl) {
    return;
  }

  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

/**
 * @param {SubmitEvent} event
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  clearLoginError();

  const emailInput = document.getElementById("auth-login-email");
  const passwordInput = document.getElementById("auth-login-password");
  const submitBtn = document.getElementById("auth-login-submit");

  const email = emailInput instanceof HTMLInputElement ? emailInput.value : "";
  const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : "";

  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.disabled = true;
  }

  const result = await signInWithPassword(email, password);

  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.disabled = false;
  }

  if (!result.ok) {
    showLoginError(result.error || "Sign-in failed.");
    return;
  }

  hideLoginScreen();
  updateAuthChromeForCloud();

  if (typeof onAuthenticatedCallback === "function") {
    await onAuthenticatedCallback();
  }
}

async function handleSignOutClick() {
  await signOut();
  document.documentElement.dataset.appReady = "false";
  showLoginScreen();
  clearLoginError();
}
