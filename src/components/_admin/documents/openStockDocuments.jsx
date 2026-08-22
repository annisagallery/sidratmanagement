'use client';

import { format } from 'date-fns';

import { resolveBrand } from '../dispatch/openDocuments';
import { variationLabel } from '../inventory/shared';

/**
 * Printing a transfer docket or a purchase order.
 *
 * The two rules from the dispatch desk apply here for the same reasons, and
 * both are easy to break by accident:
 *
 *  - the tab is opened SYNCHRONOUSLY, in the same tick as the click. A
 *    `window.open` that happens after an await is no longer attributable to a
 *    user gesture and every browser blocks it as a popup.
 *  - @react-pdf/renderer is imported on demand. It is large, and most people in
 *    the admin never print anything.
 */

const fmtDate = (value) => (value ? format(new Date(value), 'dd MMM yyyy') : '');

const titleCase = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (character) => character.toUpperCase());

async function renderInto(tab, build) {
  try {
    const url = URL.createObjectURL(await build());
    // Not revoked: the tab reads the blob for as long as it is open, and the
    // URL dies with the document that created it.
    if (tab) tab.location = url;
    else window.open(url, '_blank');
  } catch (error) {
    tab?.close();
    throw error;
  }
}

const lineName = (line) => line.product?.name || line.productSnapshotName || 'Unknown product';

const lineAttributes = (line) => {
  if (!line.variation) return '';
  const label = variationLabel(line.variation);
  return label === 'Base product' ? '' : label;
};

/* ── transfer ────────────────────────────────────────────────────────────── */

export function transferToDocket(transfer) {
  const lines = (transfer.lines || []).map((line, index) => ({
    key: line.id || `${transfer.transferNo}-${index}`,
    name: lineName(line),
    attributes: lineAttributes(line),
    quantity: line.quantity || 0,
    receivedQuantity: line.receivedQuantity || 0
  }));

  return {
    transferNo: transfer.transferNo || '',
    date: fmtDate(transfer.createdAt),
    status: titleCase(transfer.status),
    from: transfer.sourceBranch?.name || '',
    to: transfer.destinationBranch?.name || '',
    dispatchedBy: transfer.dispatchedBy?.name || '',
    receivedBy: transfer.receivedBy?.name || '',
    lines,
    pieces: lines.reduce((sum, line) => sum + line.quantity, 0),
    note: transfer.note || ''
  };
}

export async function printTransferDocket(transfer, settings) {
  const tab = window.open('', '_blank');
  await renderInto(tab, async () => {
    const [{ pdf }, { TransferDocketPdf }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./stockDocumentPdf')
    ]);
    const brand = await resolveBrand(settings);
    return pdf(
      <TransferDocketPdf
        docket={transferToDocket(transfer)}
        brand={brand}
        title={`Transfer ${transfer.transferNo || ''}`.trim()}
      />
    ).toBlob();
  });
}

/* ── purchase ────────────────────────────────────────────────────────────── */

export function purchaseToOrder(purchase) {
  const lines = (purchase.items || []).map((item, index) => ({
    key: item.id || `${purchase.purchaseNo}-${index}`,
    name: lineName(item),
    attributes: lineAttributes(item),
    quantity: item.quantity || 0,
    receivedQuantity: item.receivedQuantity || 0,
    unitCost: Number(item.unitCost || 0),
    subTotal: Number(item.subTotal || 0)
  }));

  const paid = Number(purchase.paidAmount || 0);
  const grandTotal = Number(purchase.grandTotal || 0);

  const breakdown = [
    { label: 'Items', value: Number(purchase.subTotal || 0), show: true },
    { label: 'Order discount', value: -Number(purchase.orderDiscount || 0), show: Number(purchase.orderDiscount || 0) > 0 },
    { label: 'Order tax', value: Number(purchase.orderTax || 0), show: Number(purchase.orderTax || 0) > 0 },
    { label: 'Shipping', value: Number(purchase.shipping || 0), show: Number(purchase.shipping || 0) > 0 }
  ].filter((row) => row.show);

  return {
    purchaseNo: purchase.purchaseNo || '',
    refNo: purchase.refNo || '',
    date: fmtDate(purchase.date),
    status: titleCase(purchase.status),
    paymentStatus: titleCase(purchase.paymentStatus),
    branch: purchase.branch?.name || '',
    lines,
    breakdown,
    grandTotal,
    paid,
    due: Math.max(0, grandTotal - paid),
    note: purchase.note || ''
  };
}

export async function printPurchaseOrder(purchase, settings) {
  const tab = window.open('', '_blank');
  await renderInto(tab, async () => {
    const [{ pdf }, { PurchaseOrderPdf }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./stockDocumentPdf')
    ]);
    const brand = await resolveBrand(settings);
    return pdf(
      <PurchaseOrderPdf
        order={purchaseToOrder(purchase)}
        brand={brand}
        title={`Purchase ${purchase.purchaseNo || ''}`.trim()}
      />
    ).toBlob();
  });
}
