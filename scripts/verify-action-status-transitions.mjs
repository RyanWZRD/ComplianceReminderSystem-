/**
 * RC-001: shared action status transition rules (local + cloud RPC parity).
 */

import { ACTION_STATUSES } from "../js/data/constants.js";
import { isAllowedActionStatusTransition } from "../js/data/action-status.js";

/** @type {[string, string, boolean][]} */
const CASES = [
  [ACTION_STATUSES.OPEN, ACTION_STATUSES.COMPLETED, true],
  [ACTION_STATUSES.IN_PROGRESS, ACTION_STATUSES.COMPLETED, true],
  [ACTION_STATUSES.COMPLETED, ACTION_STATUSES.OPEN, true],
  [ACTION_STATUSES.COMPLETED, ACTION_STATUSES.COMPLETED, false],
  [ACTION_STATUSES.OPEN, ACTION_STATUSES.OPEN, false],
  [ACTION_STATUSES.IN_PROGRESS, ACTION_STATUSES.OPEN, false],
  [ACTION_STATUSES.OPEN, ACTION_STATUSES.IN_PROGRESS, false],
  [ACTION_STATUSES.IN_PROGRESS, ACTION_STATUSES.IN_PROGRESS, false],
];

for (const [current, target, expected] of CASES) {
  const actual = isAllowedActionStatusTransition(current, target);

  if (actual !== expected) {
    console.error(
      `isAllowedActionStatusTransition(${current}, ${target}): expected ${expected}, got ${actual}`
    );
    process.exit(1);
  }
}

console.log("Action status transition rules: OK");
console.log("  open -> completed: allowed");
console.log("  in_progress -> completed: allowed");
console.log("  completed -> open: allowed");
console.log("  other transitions: rejected");
