/**
 * Shared action status transition rules (local + cloud RPC).
 */

import { ACTION_STATUSES } from "./constants.js";

/** @typedef {'open' | 'completed'} ActionStatusRpcTarget */

/**
 * @param {string} targetStatus
 * @returns {ActionStatusRpcTarget | null}
 */
export function mapActionStatusToRpcTarget(targetStatus) {
  if (
    targetStatus === ACTION_STATUSES.OPEN ||
    targetStatus === ACTION_STATUSES.COMPLETED
  ) {
    return targetStatus;
  }

  return null;
}

/**
 * @param {string | undefined | null} currentStatus
 * @param {ActionStatusRpcTarget} targetStatus
 * @returns {boolean}
 */
export function isAllowedActionStatusTransition(currentStatus, targetStatus) {
  if (targetStatus === ACTION_STATUSES.COMPLETED) {
    return currentStatus === ACTION_STATUSES.OPEN;
  }

  if (targetStatus === ACTION_STATUSES.OPEN) {
    return currentStatus === ACTION_STATUSES.COMPLETED;
  }

  return false;
}
