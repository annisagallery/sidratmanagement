'use client';

/**
 * Bulk invoice sheet — one invoice per A4 page, in the order they were selected.
 *
 * Orders arrive as `?orders=1001,1002,1003`, which keeps the tab reloadable and
 * shareable; nothing is stashed in session state that a refresh would lose.
 *
 * Each order is fetched individually rather than through the list endpoint,
 * because an invoice needs the full item and payment detail the list view does
 * not carry — and because it guarantees this page and the single-order route
 * are rendering from identical data.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueries } from 'react-query';
import { FiAlertTriangle, FiArrowLeft, FiPrinter } from 'react-icons/fi';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import * as api from 'src/services';
import InvoiceDocument, { INVOICE_PRINT_CSS } from 'src/components/print/InvoiceDocument';

// Enough for any realistic day's dispatch. Beyond this the browser's print
// pipeline is the bottleneck, not the fetching, so we stop rather than hang.
const MAX_ORDERS = 100;

export function parseOrderNumbers(raw) {
  const all = String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(all));
}

export default function BulkInvoicePage() {
  const search = useSearchParams();
  const settings = useSiteSettings();
  const printed = useRef(false);

  const color = settings.primaryColor || '#c8a96e';
  const mode = settings.invoicePrintMode || 'full';
  const logo = settings.logo;

  const requested = useMemo(() => parseOrderNumbers(search.get('orders')), [search]);
  const orderNumbers = requested.slice(0, MAX_ORDERS);
  const overflow = requested.length - orderNumbers.length;

  const results = useQueries(
    orderNumbers.map((orderNo) => ({
      queryKey: ['invoice-order', orderNo],
      queryFn: () => api.getOrderByAdmin(orderNo),
      retry: 1,
      staleTime: 60_000
    }))
  );

  const settled = results.filter((result) => !result.isLoading).length;
  const isLoading = settled < orderNumbers.length;
  const orders = results.map((result) => result.data?.data).filter(Boolean);
  const failed = orderNumbers.filter((_, index) => results[index]?.isError);

  // Auto-print only once everything has resolved — firing the dialog over a
  // half-loaded stack is how you get a batch of blank invoices.
  useEffect(() => {
    if (printed.current || isLoading || !orders.length || search.get('auto') !== '1') return;
    printed.current = true;
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, [isLoading, orders.length, search]);

  if (!requested.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">No orders selected</p>
          <p className="mt-1 text-sm text-gray-400">
            Open this page from the orders list — pick some orders, then choose Print invoices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INVOICE_PRINT_CSS }} />

      {/* ── Screen controls ───────────────────────────────────────────────────── */}
      <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.close()}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
            >
              <FiArrowLeft size={15} /> Close
            </button>
            <span className="text-gray-200">|</span>
            <span className="text-sm font-semibold text-gray-700">
              {isLoading
                ? `Loading invoices… ${settled}/${orderNumbers.length}`
                : `${orders.length} invoice${orders.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2.5 py-1 rounded-md font-medium ${mode === 'full' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}
            >
              {mode === 'full' ? 'Full page' : 'Letterhead'}
            </span>
            <button
              onClick={() => window.print()}
              disabled={isLoading || !orders.length}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: color }}
            >
              <FiPrinter size={15} /> Print {orders.length || ''}
            </button>
          </div>
        </div>

        {(failed.length > 0 || overflow > 0) && (
          <div className="border-t border-amber-200 bg-amber-50">
            <div className="max-w-4xl mx-auto px-6 py-2 flex items-start gap-2 text-xs text-amber-800">
              <FiAlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                {failed.length > 0 && (
                  <p>
                    Skipped {failed.length} order{failed.length === 1 ? '' : 's'} that could not be loaded:{' '}
                    <span className="font-semibold">{failed.map((n) => `#${n}`).join(', ')}</span>. The rest print
                    normally.
                  </p>
                )}
                {overflow > 0 && (
                  <p>
                    Only the first {MAX_ORDERS} orders are included — {overflow} more were left out. Print them as a
                    second batch.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Screen preview: one sheet per invoice ─────────────────────────────── */}
      <div className={`no-print-chrome bg-gray-100 min-h-screen py-8 mode-${mode}`}>
        {isLoading && (
          <p className="mb-6 text-center text-sm text-gray-400">
            Fetching order details… {settled} of {orderNumbers.length}
          </p>
        )}
        <div className="space-y-8">
          {orders.map((order) => (
            <div key={order.orderNo} className="max-w-[794px] mx-auto bg-white shadow-2xl rounded-md overflow-hidden">
              <InvoiceDocument order={order} settings={settings} logo={logo} />
            </div>
          ))}
        </div>
        {!isLoading && orders.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-6">
            A4 print preview — {orders.length} page{orders.length === 1 ? '' : 's'}, one invoice each
          </p>
        )}
      </div>

      {/* ── Print-only version (no screen chrome, no card shadows) ───────────── */}
      <div className={`print-only mode-${mode}`} style={{ display: 'none' }}>
        {orders.map((order) => (
          <InvoiceDocument key={order.orderNo} order={order} settings={settings} logo={logo} />
        ))}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          .no-print-chrome { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `
        }}
      />
    </>
  );
}
