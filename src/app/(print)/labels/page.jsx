'use client';

/**
 * Shipping labels — several to an A4 sheet, cut apart along the dashed guides.
 *
 * Orders arrive as `?orders=1001,1002`, the same contract the bulk invoice sheet
 * uses, so both are reachable from one selection in the orders list.
 *
 * The one field that must never be wrong is the collect-on-delivery amount: it
 * is what the rider asks for at the door. It is computed from payments already
 * recorded rather than from the order total, so a part-paid order shows the
 * balance and a settled one prints PAID instead of an amount.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueries } from 'react-query';
import QRCode from 'qrcode';
import { FiAlertTriangle, FiArrowLeft, FiPrinter } from 'react-icons/fi';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import * as api from 'src/services';
import { fDate } from 'src/utils/formatTime';
import { addressLocation, amountDue } from 'src/components/print/InvoiceDocument';

const MAX_ORDERS = 200;

// Millimetres. A4 is 210 × 297, so at this margin the printable area is
// 194 × 281. Every preset is sized to leave ~5mm of vertical slack inside that:
// printer drivers round their own way, and a preset that fits exactly on paper
// is a preset that spills one row onto a second sheet on somebody's printer.
const PAGE_MARGIN = 8;
const GAP = 4;

export const LAYOUTS = {
  2: { cols: 1, width: 190, height: 136, label: '2 per sheet', hint: 'A5 — roomy, easiest to read' },
  4: { cols: 2, width: 94, height: 136, label: '4 per sheet', hint: 'A6 — the standard courier label' },
  8: { cols: 2, width: 94, height: 66, label: '8 per sheet', hint: 'Compact — small parcels only' }
};

const DEFAULT_PER_PAGE = 4;

const tk = (n) => `৳${Number(n || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;

/**
 * Labels are chunked into explicit sheets rather than left to flow.
 *
 * A single long grid and `break-inside: avoid` reads as the obvious solution,
 * but browsers fragment grid containers across printed pages inconsistently —
 * you get a row clipped at the page boundary or an unexpected blank sheet.
 * Slicing the list into pages of exactly `perPage` puts that decision in our
 * hands, and is also what makes "4 per sheet" literally true.
 */
const PRINT_CSS = (layout) => `
  @media print {
    @page { size: A4 portrait; margin: ${PAGE_MARGIN}mm; }
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
    .no-print { display: none !important; }
    .label-page {
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      break-after: page;
      page-break-after: always;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .label-page:last-of-type { break-after: auto; page-break-after: auto; }
  }
  .label-page {
    display: grid;
    grid-template-columns: repeat(${layout.cols}, ${layout.width}mm);
    gap: ${GAP}mm;
    justify-content: center;
    align-content: start;
  }
  .ship-label {
    width: ${layout.width}mm;
    height: ${layout.height}mm;
    box-sizing: border-box;
    border: 0.3mm dashed #94a3b8;
    padding: ${layout.height > 100 ? 3.5 : 2.5}mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    color: #0f172a;
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    break-inside: avoid;
    page-break-inside: avoid;
  }
`;

/** Splits a list into fixed-size pages. */
function chunk(items, size) {
  const pages = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** QR carries the order number so any warehouse scanner resolves the order. */
function OrderQr({ value, size }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(String(value), { margin: 0, width: 256, errorCorrectionLevel: 'M' })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value]);

  if (!src) return <div style={{ width: size, height: size, background: '#f1f5f9' }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Order ${value}`} style={{ width: size, height: size, display: 'block' }} />;
}

function ShippingLabel({ order, settings, layout }) {
  const compact = layout.height < 100;
  const accent = settings.primaryColor || '#0f172a';

  const address = order.shippingAddress || {};
  const recipient = address.name || order.guestName || 'Customer';
  const location = addressLocation(address);
  const due = amountDue(order);
  const pieces = (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Type scale in mm so the label reads the same whatever the preset.
  const t = compact
    ? { eyebrow: 1.8, name: 3, body: 2.2, order: 4.2, cod: 3.4, qr: '14mm' }
    : { eyebrow: 2.2, name: 4.4, body: 3, order: 6, cod: 5, qr: '21mm' };

  const eyebrow = {
    margin: 0,
    fontSize: `${t.eyebrow}mm`,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#94a3b8'
  };

  return (
    <div className="ship-label">
      {/* Sender strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '2mm',
          borderBottom: `0.4mm solid ${accent}`,
          paddingBottom: '1.2mm'
        }}
      >
        <span
          style={{
            fontSize: `${t.body}mm`,
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {settings.siteName || 'Shipping label'}
        </span>
        {settings.phone && (
          <span style={{ fontSize: `${t.eyebrow}mm`, color: '#64748b', whiteSpace: 'nowrap' }}>{settings.phone}</span>
        )}
      </div>

      {/* Recipient — the largest thing on the label */}
      <div style={{ flex: 1, minHeight: 0, paddingTop: '1.8mm' }}>
        <p style={eyebrow}>Deliver to</p>
        <p
          style={{
            margin: '0.6mm 0 0',
            fontSize: `${t.name}mm`,
            fontWeight: 800,
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {recipient}
        </p>
        {address.phone && (
          <p style={{ margin: '0.6mm 0 0', fontSize: `${t.body}mm`, fontWeight: 700, letterSpacing: '0.02em' }}>
            {address.phone}
          </p>
        )}
        {address.address && (
          <p
            style={{
              margin: '1mm 0 0',
              fontSize: `${t.body}mm`,
              lineHeight: 1.4,
              color: '#334155',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {address.address}
          </p>
        )}
        {location && (
          <p
            style={{
              margin: '0.8mm 0 0',
              fontSize: `${t.body}mm`,
              fontWeight: 700,
              color: '#0f172a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {location}
          </p>
        )}
      </div>

      {/* Order identity + what to collect */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2.5mm', paddingTop: '1.5mm' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={eyebrow}>Order</p>
          <p style={{ margin: '0.3mm 0 0', fontSize: `${t.order}mm`, fontWeight: 800, lineHeight: 1 }}>
            #{order.orderNo}
          </p>
          <p style={{ margin: '1mm 0 0', fontSize: `${t.eyebrow}mm`, color: '#64748b' }}>
            {pieces} item{pieces === 1 ? '' : 's'}
            {order.createdAt ? ` · ${fDate(order.createdAt)}` : ''}
          </p>
        </div>

        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <p style={eyebrow}>{due > 0 ? 'Collect (COD)' : 'Payment'}</p>
          {due > 0 ? (
            <p style={{ margin: '0.3mm 0 0', fontSize: `${t.cod}mm`, fontWeight: 800, lineHeight: 1, color: '#b91c1c' }}>
              {tk(due)}
            </p>
          ) : (
            <p
              style={{
                margin: '0.3mm 0 0',
                fontSize: `${t.cod}mm`,
                fontWeight: 800,
                lineHeight: 1,
                color: '#047857',
                letterSpacing: '0.04em'
              }}
            >
              PAID
            </p>
          )}
        </div>

        <div style={{ flexShrink: 0 }}>
          <OrderQr value={order.orderNo} size={t.qr} />
        </div>
      </div>
    </div>
  );
}

export default function ShippingLabelsPage() {
  const search = useSearchParams();
  const settings = useSiteSettings();
  const printed = useRef(false);

  const color = settings.primaryColor || '#c8a96e';

  const requested = useMemo(() => {
    const all = String(search.get('orders') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return Array.from(new Set(all));
  }, [search]);

  const [perPage, setPerPage] = useState(() => {
    const fromUrl = Number(search.get('per'));
    return LAYOUTS[fromUrl] ? fromUrl : DEFAULT_PER_PAGE;
  });
  const layout = LAYOUTS[perPage] || LAYOUTS[DEFAULT_PER_PAGE];

  const orderNumbers = requested.slice(0, MAX_ORDERS);
  const overflow = requested.length - orderNumbers.length;

  const results = useQueries(
    orderNumbers.map((orderNo) => ({
      queryKey: ['label-order', orderNo],
      queryFn: () => api.getOrderByAdmin(orderNo),
      retry: 1,
      staleTime: 60_000
    }))
  );

  const settled = results.filter((result) => !result.isLoading).length;
  const isLoading = settled < orderNumbers.length;
  const orders = results.map((result) => result.data?.data).filter(Boolean);
  const failed = orderNumbers.filter((_, index) => results[index]?.isError);
  const pages = chunk(orders, perPage);
  const sheets = pages.length;

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
            Open this page from the orders list — pick some orders, then choose Print labels.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS(layout) }} />

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
                ? `Loading labels… ${settled}/${orderNumbers.length}`
                : `${orders.length} label${orders.length === 1 ? '' : 's'} · ${sheets} sheet${sheets === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Labels per sheet">
              {Object.entries(LAYOUTS).map(([value, preset]) => (
                <button
                  key={value}
                  type="button"
                  title={preset.hint}
                  onClick={() => setPerPage(Number(value))}
                  aria-pressed={perPage === Number(value)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                    perPage === Number(value) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => window.print()}
              disabled={isLoading || !orders.length}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: color }}
            >
              <FiPrinter size={15} /> Print
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
                    <span className="font-semibold">{failed.map((n) => `#${n}`).join(', ')}</span>.
                  </p>
                )}
                {overflow > 0 && (
                  <p>
                    Only the first {MAX_ORDERS} orders are included — {overflow} more were left out.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Label sheet ───────────────────────────────────────────────────────── */}
      {isLoading && (
        <p className="no-print py-6 text-center text-sm text-gray-400">
          Fetching order details… {settled} of {orderNumbers.length}
        </p>
      )}

      {pages.map((page, index) => (
        <div
          key={page[0]?.orderNo || index}
          className="label-page"
          style={{ padding: `${PAGE_MARGIN}mm 0`, marginBottom: index < pages.length - 1 ? '6mm' : 0 }}
        >
          {page.map((order) => (
            <ShippingLabel key={order.orderNo} order={order} settings={settings} layout={layout} />
          ))}
        </div>
      ))}

      {!isLoading && orders.length > 0 && (
        <p className="no-print pb-8 pt-4 text-center text-xs text-gray-400">
          A4 preview — {sheets} sheet{sheets === 1 ? '' : 's'}, cut along the dashed guides
        </p>
      )}
    </div>
  );
}
