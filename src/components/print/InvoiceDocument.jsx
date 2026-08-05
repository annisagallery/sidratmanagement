'use client';

/**
 * The invoice. One definition, used by every route that prints one.
 *
 * This used to live inside the single-order print page, which meant "the
 * invoice" was whatever that one file happened to render. Bulk printing needs
 * the identical document, so the document moved here and the pages became thin
 * wrappers around it — a change to the layout now reaches every route at once.
 *
 * Print mechanics: header and footer are `position: fixed`, so the browser
 * paints them on every sheet, and the body carries matching padding so text
 * never slides underneath. Both are order-independent company letterhead, which
 * is why one pair can sit above a stack of many invoices.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';
import { fDate } from 'src/utils/formatTime';
import {
  LETTERHEAD_FOOTER_HEIGHT,
  LETTERHEAD_HEADER_HEIGHT,
  LetterheadFooter,
  LetterheadHeader
} from './LetterheadBranding';

const H_HDR = LETTERHEAD_HEADER_HEIGHT;
const H_FTR = LETTERHEAD_FOOTER_HEIGHT;

const STOREFRONT_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

// ── Design tokens (shared with the letterhead brand system) ───────────────────
const BRAND_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif";
const BODY_FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const INK = '#111827';
const GRAY = '#4b5563';
const MUTED = '#9ca3af';
const HAIRLINE = '#ececec';
const PAPER = '#fcfcfb';

/** Print rules for any page that renders an InvoiceDocument. */
export const INVOICE_PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700;800&display=swap');

  @media print {
    @page { size: A4 portrait; margin: 0; }

    body {
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #fff;
    }

    .no-print { display: none !important; }

    /* Fixed header — repeats on every page */
    .inv-header {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: ${H_HDR}px;
      background: #fff;
      z-index: 100;
    }

    /* Fixed footer — always visible on every printed page */
    .inv-footer {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: ${H_FTR}px;
      background: #fff;
      z-index: 100;
    }

    /* Content gets padding so it never slides under header/footer */
    .inv-body {
      padding-top: ${H_HDR + 16}px;
      padding-bottom: ${H_FTR + 16}px;
    }

    /* Letterhead mode — only hide header (pre-printed paper already has it).
       Footer (contact info) still prints for customer reference. */
    .mode-letterhead .inv-header {
      display: none !important;
    }
    .mode-letterhead .inv-body {
      padding-top: 20px;
    }

    /* Every invoice in a stack starts its own sheet; the last one must not
       leave a trailing blank page behind it. */
    .inv-doc { page-break-after: always; break-after: page; }
    .inv-doc:last-child { page-break-after: auto; break-after: auto; }

    /* Avoid orphaned rows mid-table */
    tr { page-break-inside: avoid; }
    table { page-break-inside: auto; }

    /* Blocks that must never split across pages (rail, totals, QR band) */
    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
  }
`;

// ── Currency formatter ─────────────────────────────────────────────────────────
const tk = (n) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d) {
  return d ? fDate(d) : '—';
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** Amount actually settled. Ecom orders marked paid may carry no payment rows. */
export function amountPaid(order) {
  const raw = (order?.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  return raw === 0 && order?.paymentStatus === 'paid' ? order?.total || 0 : raw;
}

/** What the courier collects at the door — zero once the order is settled. */
export function amountDue(order) {
  return Math.max(0, (order?.total || 0) - amountPaid(order));
}

/** "Upazila, District" from whichever address shape the order carries. */
export function addressLocation(address = {}) {
  return [
    address.upazila || address.zone?.zone_name || address.zone,
    address.district || address.city?.city_name || address.city
  ]
    .filter(Boolean)
    .join(', ');
}

// Small serif eyebrow — mirrors the letterhead footer's label treatment
function Eyebrow({ color, style, children }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: '9px',
        fontWeight: 700,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.16em',
        fontFamily: BRAND_FONT,
        ...style
      }}
    >
      {children}
    </p>
  );
}

function Pill({ bg, fg, children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '9px',
        fontWeight: 700,
        background: bg,
        color: fg,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </span>
  );
}

function Th({ align = 'left', width, color, children }) {
  return (
    <th
      style={{
        padding: '9px 10px',
        textAlign: align,
        width,
        fontWeight: 700,
        color: '#6b7280',
        borderBottom: `2px solid ${color}`,
        fontSize: '9.5px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em'
      }}
    >
      {children}
    </th>
  );
}

// ── Invoice header ─────────────────────────────────────────────────────────────
export function InvoiceHeader({ settings, logo }) {
  return (
    <div className="inv-header">
      <LetterheadHeader settings={settings} logo={logo} documentLabel="INVOICE" />
    </div>
  );
}

// ── Invoice footer ─────────────────────────────────────────────────────────────
// The showroom QR gets its own band in the body, so the footer skips its copy.
export function InvoiceFooter({ settings }) {
  return (
    <div className="inv-footer">
      <LetterheadFooter settings={settings} showQr={false} />
    </div>
  );
}

// ── Payment summary rail — Total | Paid | Balance due | status ────────────────
function PaymentRail({ order, paid }) {
  const due = Math.max(0, (order.total || 0) - paid);
  const isPaid = due <= 0.01;

  const cells = [
    { label: 'Invoice total', value: tk(order.total), fg: INK },
    { label: 'Amount paid', value: tk(paid), fg: '#059669' },
    { label: 'Balance due', value: tk(due), fg: isPaid ? '#059669' : '#dc2626' }
  ];

  return (
    <div
      className="avoid-break"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        border: `1px solid ${HAIRLINE}`,
        borderRadius: '6px',
        background: PAPER,
        overflow: 'hidden',
        marginBottom: '26px'
      }}
    >
      {cells.map((c, i) => (
        <div key={c.label} style={{ padding: '11px 22px', borderLeft: i ? `1px solid ${HAIRLINE}` : 'none' }}>
          <p
            style={{
              margin: '0 0 3px',
              fontSize: '8.5px',
              fontWeight: 700,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.12em'
            }}
          >
            {c.label}
          </p>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: c.fg }}>{c.value}</p>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 18px' }}>
        {isPaid ? (
          <Pill bg="#d1fae5" fg="#065f46">Paid</Pill>
        ) : paid > 0 ? (
          <Pill bg="#fef3c7" fg="#92400e">Partially paid</Pill>
        ) : (
          <Pill bg="#fef3c7" fg="#92400e">{order.paymentStatus || 'Unpaid'}</Pill>
        )}
        {order.source === 'admin' && <Pill bg="#ede9fe" fg="#7c3aed">Manual order</Pill>}
      </div>
    </div>
  );
}

// ── Showroom QR band — the branch list, compressed into one scan ──────────────
function ShowroomBand({ color }) {
  const [qr, setQr] = useState('');
  const branchesUrl = `${STOREFRONT_URL.replace(/\/$/, '')}/branches`;
  const displayUrl = branchesUrl.replace(/^https?:\/\//, '');

  useEffect(() => {
    QRCode.toDataURL(branchesUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#171717', light: '#ffffff' }
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [branchesUrl]);

  return (
    <div
      className="avoid-break"
      style={{
        marginTop: '32px',
        display: 'flex',
        alignItems: 'center',
        gap: '22px',
        border: `1px solid ${HAIRLINE}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: '0 6px 6px 0',
        background: PAPER,
        padding: '16px 22px'
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow color={color} style={{ marginBottom: '6px' }}>
          Visit our showrooms
        </Eyebrow>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: GRAY, lineHeight: 1.6, maxWidth: '420px' }}>
          We have more showrooms than this page can hold. Scan the code to see every location, with addresses and
          directions.
        </p>
        <p style={{ margin: 0, fontSize: '10.5px', fontWeight: 600, color: INK, letterSpacing: '0.02em' }}>
          {displayUrl}
        </p>
      </div>
      <div
        style={{
          width: '92px',
          height: '92px',
          flexShrink: 0,
          border: `1.5px solid ${color}`,
          borderRadius: '6px',
          padding: '5px',
          boxSizing: 'border-box',
          background: '#fff'
        }}
      >
        {qr ? (
          <Image
            src={qr}
            alt="Scan for all showroom locations"
            width={80}
            height={80}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#f4f4f4' }} />
        )}
      </div>
    </div>
  );
}

// ── Invoice body ───────────────────────────────────────────────────────────────
export function InvoiceBody({ order, settings }) {
  const color = settings.primaryColor || '#c8a96e';
  const items = order.items || [];
  const paid = amountPaid(order);

  const addr = order.shippingAddress || {};
  const location = addressLocation(addr);

  const meta = [
    { label: 'Invoice no.', value: `#${order.orderNo}` },
    { label: 'Date', value: fmtDate(order.createdAt) },
    ...(order.estimatedDelivery ? [{ label: 'Est. delivery', value: fmtDate(order.estimatedDelivery) }] : []),
    { label: 'Status', value: capitalize(order.status) },
    { label: 'Payment', value: capitalize(order.paymentMethod || 'COD') }
  ];

  return (
    <div className="inv-body" style={{ padding: `${H_HDR + 20}px 40px ${H_FTR + 20}px`, fontFamily: BODY_FONT }}>
      {/* Bill to + invoice meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ minWidth: '200px', maxWidth: '280px' }}>
          <Eyebrow color={color} style={{ marginBottom: '8px' }}>
            Bill to
          </Eyebrow>
          <p style={{ fontSize: '14px', fontWeight: 700, color: INK, margin: '0 0 4px' }}>
            {addr.name || order.guestName || '—'}
          </p>
          {addr.phone && <p style={{ fontSize: '11.5px', color: GRAY, margin: '0 0 2px' }}>{addr.phone}</p>}
          {location && <p style={{ fontSize: '11.5px', color: GRAY, margin: '0 0 2px' }}>{location}</p>}
          {addr.address && <p style={{ fontSize: '11.5px', color: GRAY, margin: 0 }}>{addr.address}</p>}
        </div>

        <div style={{ fontSize: '11.5px' }}>
          {meta.map((m) => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'flex-end', gap: '18px', padding: '2px 0' }}>
              <span style={{ color: MUTED }}>{m.label}</span>
              <span style={{ color: INK, fontWeight: 600, minWidth: '90px', textAlign: 'right' }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment summary rail */}
      <PaymentRail order={order} paid={paid} />

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '22px' }}>
        <thead>
          <tr>
            <Th color={color} width="32px">#</Th>
            <Th color={color}>Product</Th>
            <Th color={color} align="center" width="60px">Qty</Th>
            <Th color={color} align="right" width="110px">Unit price</Th>
            <Th color={color} align="right" width="110px">Total</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const name = item.productSnapshot?.name || item.pid?.name || '—';
            const attribs = (item.attributes || [])
              .map((a) => a.valueName)
              .filter(Boolean)
              .join(' · ');
            const lineTotal = (item.quantity || 0) * (item.price || 0);
            return (
              <tr key={item.id || idx} style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <td style={{ padding: '10px', color: MUTED, verticalAlign: 'top' }}>{idx + 1}</td>
                <td style={{ padding: '10px', verticalAlign: 'top' }}>
                  <p style={{ margin: 0, fontWeight: 600, color: INK }}>{name}</p>
                  {attribs && <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '11px' }}>{attribs}</p>}
                  {item.customizeDetails && (
                    <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>
                      {item.customizeDetails}
                    </p>
                  )}
                </td>
                <td style={{ padding: '10px', textAlign: 'center', color: GRAY, verticalAlign: 'top' }}>
                  {item.quantity || 1}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', color: GRAY, verticalAlign: 'top' }}>
                  {tk(item.price)}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: INK, verticalAlign: 'top' }}>
                  {tk(lineTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Price breakdown */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="avoid-break" style={{ width: '270px', fontSize: '12px' }}>
          {[
            { label: 'Subtotal', value: order.subTotal, show: true },
            { label: 'Shipping', value: order.shipping, show: (order.shipping || 0) > 0 },
            { label: 'Coupon', value: -order.discount, show: (order.discount || 0) > 0 },
            { label: 'Cash off', value: -order.cashDiscount, show: (order.cashDiscount || 0) > 0 }
          ]
            .filter((r) => r.show)
            .map((r) => (
              <div
                key={r.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '5px 14px',
                  borderBottom: `1px solid ${HAIRLINE}`,
                  color: GRAY
                }}
              >
                <span>{r.label}</span>
                <span style={{ fontWeight: 500 }}>{r.value < 0 ? `-${tk(-r.value)}` : tk(r.value)}</span>
              </div>
            ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: '8px',
              padding: '10px 14px',
              background: `${color}16`,
              borderRadius: '6px'
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '13px', color: INK }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: '16px', color: INK }}>{tk(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.note && (
        <div
          style={{
            marginTop: '26px',
            fontSize: '11px',
            color: '#6b7280',
            borderTop: `1px solid ${HAIRLINE}`,
            paddingTop: '14px'
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Note: </strong>
            {order.note}
          </p>
        </div>
      )}

      {/* Showroom locations — one QR instead of a branch list */}
      <ShowroomBand color={color} />
    </div>
  );
}

/**
 * A complete invoice: letterhead, body, contact footer.
 *
 * `.inv-doc` carries the page break, so stacking several of these produces one
 * invoice per sheet with no extra wiring at the call site.
 */
export default function InvoiceDocument({ order, settings, logo }) {
  return (
    <div className="inv-doc">
      <InvoiceHeader settings={settings} logo={logo} />
      <InvoiceBody order={order} settings={settings} />
      <InvoiceFooter settings={settings} />
    </div>
  );
}
