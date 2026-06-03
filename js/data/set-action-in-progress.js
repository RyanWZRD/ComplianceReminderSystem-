/**
 * Set action in progress mapping and validation (local + cloud RPC).
 */

import { ACTION_STATUSES } from "./constants.js";

/**
 * @param {string} title
 * @returns {string}
 */
export function buildActionInProgressHistoryDescription(title) {
  return `Action marked in progress: ${title}.`;
}

/**
 * @param {string | undefined | null} currentStatus
 * @returns {boolean}
 */
export function isAllowedInProgressTransition(currentStatus) {
  return currentStatus === ACTION_STATUSES.OPEN;
}
