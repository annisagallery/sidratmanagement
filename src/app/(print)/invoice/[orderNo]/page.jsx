'use client';

/**
 * Single-order invoice.
 *
 * The document itself lives in InvoiceDocument so this page and the bulk sheet
 * print the exact same thing; what remains here is the on-screen chrome.
 */

import { useParams } from 'next/navigation';
import { useQuery } from 'react-query';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import * as api from 'src/services';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import InvoiceDocument, { INVOICE_PRINT_CSS } from 'src/components/print/InvoiceDocument';

export default function InvoicePage() {
  const params = useParams();
  const orderNo = params?.orderNo;
  const settings = useSiteSettings();
  const color = settings.primaryColor || '#c8a96e';
  const mode = settings.invoicePrintMode || 'full';

  const {
    data: orderData,
    isLoading: loadingOrder,
    isError
  } = useQuery(['invoice-order', orderNo], () => api.getOrderByAdmin(orderNo), { enabled: !!orderNo, retry: 1 });

  const order = orderData?.data;
  const logo = settings.logo;

  if (loadingOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-md animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-red-500">Order not found or access denied.</p>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INVOICE_PRINT_CSS }} />

      {/* ── Screen controls ───────────────────────────────────────────────────── */}
      <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.close()}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
            >
              <FiArrowLeft size={15} /> Close
            </button>
            <span className="text-gray-200">|</span>
            <span className="text-sm text-gray-700 font-semibold">Invoice #{order.orderNo}</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2.5 py-1 rounded-md font-medium ${mode === 'full' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}
            >
              {mode === 'full' ? 'Full page' : 'Letterhead'}
            </span>
            <a
              href="/site-settings"
              target="_blank"
              className="text-xs text-gray-400 hover:text-gray-700 transition underline"
            >
              Change mode
            </a>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white transition"
              style={{ background: color }}
            >
              <FiPrinter size={15} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* ── Screen preview ────────────────────────────────────────────────────── */}
      <div className={`no-print-chrome bg-gray-100 min-h-screen py-8 mode-${mode}`}>
        <div className="max-w-[794px] mx-auto bg-white shadow-2xl rounded-md overflow-hidden">
          <InvoiceDocument order={order} settings={settings} logo={logo} />
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">A4 print preview — click Print to send to printer</p>
      </div>

      {/* ── Print-only version (no screen chrome) ────────────────────────────── */}
      <div className={`print-only mode-${mode}`} style={{ display: 'none' }}>
        <InvoiceDocument order={order} settings={settings} logo={logo} />
      </div>

      {/* Make print-only visible and screen version hidden during print */}
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
