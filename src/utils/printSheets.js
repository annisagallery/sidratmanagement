// No 'use client' here on purpose: this is a plain module, not a component.

/**
 * Opens a print sheet for a set of orders in its own tab.
 *
 * Order numbers travel in the query string rather than session state so the tab
 * survives a refresh and can be pasted to a colleague. That caps how many fit,
 * which is why the sheets themselves also enforce a ceiling.
 *
 * Always resolves false: printing changes nothing about the orders, so the
 * selection in the list behind it should survive — an operator usually prints
 * invoices and labels for the same batch, back to back.
 */

import { alertWarning } from './swal';

export const INVOICE_SHEET = '/invoice/bulk';
export const LABEL_SHEET = '/labels';

export function openPrintSheet(path, rows, { param = 'orders' } = {}) {
  const numbers = rows.map((order) => order.orderNo).filter(Boolean);
  if (!numbers.length) {
    alertWarning('Nothing to print', 'None of the selected rows carry an order number.');
    return false;
  }

  const url = `${path}?${param}=${encodeURIComponent(numbers.join(','))}`;
  const tab = window.open(url, '_blank', 'noopener');
  if (!tab) {
    alertWarning(
      'Your browser blocked the new tab',
      'Allow pop-ups for this site and try again — the sheet opens in its own tab so you keep your place in the list.'
    );
  }
  return false;
}

export const printInvoiceSheet = (rows) => openPrintSheet(INVOICE_SHEET, rows);
export const printLabelSheet = (rows) => openPrintSheet(LABEL_SHEET, rows);
