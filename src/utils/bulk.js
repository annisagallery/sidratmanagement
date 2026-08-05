// No 'use client' here on purpose: this is a plain module, not a component.
// Marking it client-only turns every export into a client reference, which
// breaks the server-rendered pages that import the axios instance downstream.
/**
 * Runs a per-row operation across a selection.
 *
 * Sequential on purpose. These loops call single-record endpoints, and a burst
 * of parallel writes against the same order/product is exactly how you get
 * lost-update races; going one at a time also makes the progress counter honest
 * and keeps the failure list in the order the operator sees on screen.
 */

import { isConfirmationCancelled } from './swal';

export async function runBulk(rows, perform, { rowLabel, onProgress } = {}) {
  const failures = [];
  let succeeded = 0;

  for (const [index, row] of rows.entries()) {
    onProgress?.(index, rows.length);
    try {
      await perform(row);
      succeeded += 1;
    } catch (error) {
      failures.push({ label: String(rowLabel?.(row) ?? `Row ${index + 1}`), error });
      // A dismissed password prompt means the operator is backing out of the
      // whole run, not just this row — stop instead of asking 19 more times.
      if (isConfirmationCancelled(error)) break;
    }
  }

  onProgress?.(rows.length, rows.length);
  return { succeeded, failures };
}

/** Best-effort human label for a row, used in confirmations and failure lists. */
export const describeRow = (row, fallback = 'Untitled') =>
  row?.name ||
  row?.title ||
  row?.label ||
  (row?.orderNo ? `#${row.orderNo}` : '') ||
  row?.code ||
  row?.slug ||
  row?.email ||
  row?.phone ||
  row?.id ||
  fallback;
