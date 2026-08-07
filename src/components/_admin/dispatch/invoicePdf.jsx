import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { PDF_FONT, registerPdfFonts } from '../labels/pdfFonts';

/**
 * The invoice, one order per A4 page.
 *
 * This replaces an HTML sheet handed to `window.print()`. The content is the
 * same document it always was — bill-to, order meta, the payment position, the
 * line items, the breakdown, the note — but as a PDF it states its own page
 * size and margins, so it prints the same from every browser and every machine
 * rather than inheriting whatever the operator's page-setup dialog last had.
 *
 * Money is set in "Tk", not the ৳ sign. That is a constraint, not a preference:
 * see pdfFonts.js.
 */

registerPdfFonts();

const INK = '#0f172a';
const GRAY = '#475569';
const MUTED = '#94a3b8';
const HAIRLINE = '#e2e8f0';

const tk = (value) =>
  `Tk ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const capitalize = (value) => (value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : '');

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 9,
    color: INK,
    backgroundColor: '#ffffff',
    paddingTop: 34,
    paddingBottom: 46,
    paddingHorizontal: 34
  },

  /* ── letterhead ─────────────────────────────────────────────────────── */
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 12 },
  mark: { width: 42, height: 42, borderRadius: 21, objectFit: 'contain' },
  markFallback: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  markLetter: { fontSize: 19, fontWeight: 700, color: '#ffffff' },
  brandName: { fontSize: 15, fontWeight: 700, letterSpacing: 1 },
  brandLine: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  docTitle: { fontSize: 20, fontWeight: 700, letterSpacing: 2.4, textAlign: 'right' },
  docNo: { fontSize: 9, color: GRAY, textAlign: 'right', marginTop: 2 },
  rule: { borderTopWidth: 1.6, borderTopColor: INK, marginBottom: 14 },

  /* ── bill to + meta ─────────────────────────────────────────────────── */
  columns: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 14 },
  eyebrow: { fontSize: 6.5, fontWeight: 700, letterSpacing: 1.3, color: MUTED, marginBottom: 4 },
  billName: { fontSize: 11.5, fontWeight: 700 },
  billLine: { fontSize: 9, color: GRAY, marginTop: 2, lineHeight: 1.35 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, paddingVertical: 1.5 },
  metaLabel: { fontSize: 8.5, color: MUTED },
  metaValue: { fontSize: 8.5, fontWeight: 600, width: 100, textAlign: 'right' },

  /* ── payment position ───────────────────────────────────────────────── */
  rail: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  railCell: { flex: 1, borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4, padding: 8 },
  railValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },

  /* ── items ──────────────────────────────────────────────────────────── */
  thead: { flexDirection: 'row', borderBottomWidth: 1.4, borderBottomColor: INK, paddingBottom: 5 },
  th: { fontSize: 6.8, fontWeight: 700, letterSpacing: 0.9, color: MUTED },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: HAIRLINE, paddingVertical: 6 },
  cIndex: { width: 20, color: MUTED, fontSize: 8.5 },
  cName: { flex: 1, paddingRight: 8 },
  cQty: { width: 40, textAlign: 'center', fontSize: 9, color: GRAY },
  cPrice: { width: 78, textAlign: 'right', fontSize: 9, color: GRAY },
  cTotal: { width: 82, textAlign: 'right', fontSize: 9, fontWeight: 700 },
  itemName: { fontSize: 9.5, fontWeight: 600 },
  itemMeta: { fontSize: 7.8, color: MUTED, marginTop: 1.5, lineHeight: 1.3 },

  /* ── totals ─────────────────────────────────────────────────────────── */
  totals: { alignSelf: 'flex-end', width: 210, marginTop: 12 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: HAIRLINE
  },
  totalLabel: { fontSize: 9, color: GRAY },
  totalValue: { fontSize: 9 },
  grand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 7,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  grandLabel: { fontSize: 10.5, fontWeight: 700 },
  grandValue: { fontSize: 13, fontWeight: 700 },

  note: { marginTop: 18, borderTopWidth: 0.6, borderTopColor: HAIRLINE, paddingTop: 9 },
  noteText: { fontSize: 8, color: GRAY, lineHeight: 1.4 },

  /* ── footer ─────────────────────────────────────────────────────────── */
  foot: {
    position: 'absolute',
    bottom: 20,
    left: 34,
    right: 34,
    borderTopWidth: 0.6,
    borderTopColor: HAIRLINE,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  footText: { fontSize: 7, color: MUTED }
});

function Mark({ brand }) {
  if (brand.logo) return <Image src={brand.logo} style={styles.mark} />;
  return (
    <View style={[styles.markFallback, { backgroundColor: brand.color }]}>
      <Text style={styles.markLetter}>{(brand.name || 'A').trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function Meta({ label, value }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Invoice({ invoice, brand }) {
  const accent = brand.color;

  return (
    <Page size="A4" orientation="portrait" style={styles.page}>
      <View style={styles.head}>
        <Mark brand={brand} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.brandName} maxLines={1}>
            {String(brand.name || '').toUpperCase()}
          </Text>
          {brand.tagline ? (
            <Text style={styles.brandLine} maxLines={1}>
              {brand.tagline}
            </Text>
          ) : null}
          {brand.address ? (
            <Text style={styles.brandLine} maxLines={2}>
              {brand.address}
            </Text>
          ) : null}
        </View>
        <View>
          <Text style={[styles.docTitle, { color: accent }]}>INVOICE</Text>
          <Text style={styles.docNo}>#{invoice.orderNo}</Text>
        </View>
      </View>
      <View style={[styles.rule, { borderTopColor: accent }]} />

      <View style={styles.columns}>
        <View style={{ maxWidth: 230 }}>
          <Text style={styles.eyebrow}>BILL TO</Text>
          <Text style={styles.billName} maxLines={2}>
            {invoice.recipient}
          </Text>
          {invoice.phone ? <Text style={styles.billLine}>{invoice.phone}</Text> : null}
          {invoice.address ? (
            <Text style={styles.billLine} maxLines={4}>
              {invoice.address}
            </Text>
          ) : null}
        </View>
        <View>
          <Meta label="Invoice no" value={invoice.orderNo} />
          <Meta label="Date" value={invoice.date} />
          <Meta label="Status" value={capitalize(invoice.status)} />
          <Meta label="Payment" value={capitalize(invoice.paymentMethod)} />
        </View>
      </View>

      {/* Where the money stands, before the detail — it is the first thing both
          the customer and the rider want, and the last thing they should have
          to add up themselves. */}
      <View style={styles.rail}>
        <View style={styles.railCell}>
          <Text style={styles.eyebrow}>ORDER TOTAL</Text>
          <Text style={styles.railValue}>{tk(invoice.total)}</Text>
        </View>
        <View style={styles.railCell}>
          <Text style={styles.eyebrow}>PAID</Text>
          <Text style={styles.railValue}>{tk(invoice.paid)}</Text>
        </View>
        <View style={[styles.railCell, invoice.due > 0 ? { borderColor: accent, backgroundColor: `${accent}14` } : null]}>
          <Text style={styles.eyebrow}>{invoice.due > 0 ? 'COLLECT ON DELIVERY' : 'BALANCE'}</Text>
          <Text style={styles.railValue}>{invoice.due > 0 ? tk(invoice.due) : 'PAID IN FULL'}</Text>
        </View>
      </View>

      <View style={styles.thead}>
        <Text style={[styles.th, styles.cIndex]}>#</Text>
        <Text style={[styles.th, styles.cName]}>PRODUCT</Text>
        <Text style={[styles.th, styles.cQty]}>QTY</Text>
        <Text style={[styles.th, styles.cPrice]}>UNIT PRICE</Text>
        <Text style={[styles.th, styles.cTotal]}>TOTAL</Text>
      </View>
      {invoice.items.map((item, index) => (
        // A long order runs onto a second page rather than being clipped, and a
        // single line is never split across the break.
        <View key={item.key} style={styles.tr} wrap={false}>
          <Text style={styles.cIndex}>{index + 1}</Text>
          <View style={styles.cName}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.attributes ? <Text style={styles.itemMeta}>{item.attributes}</Text> : null}
            {item.note ? <Text style={styles.itemMeta}>{item.note}</Text> : null}
          </View>
          <Text style={styles.cQty}>{item.quantity}</Text>
          <Text style={styles.cPrice}>{tk(item.price)}</Text>
          <Text style={styles.cTotal}>{tk(item.lineTotal)}</Text>
        </View>
      ))}

      <View style={styles.totals} wrap={false}>
        {invoice.breakdown.map((row) => (
          <View key={row.label} style={styles.totalRow}>
            <Text style={styles.totalLabel}>{row.label}</Text>
            <Text style={styles.totalValue}>{row.value < 0 ? `-${tk(-row.value)}` : tk(row.value)}</Text>
          </View>
        ))}
        <View style={[styles.grand, { backgroundColor: `${accent}1f` }]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>{tk(invoice.total)}</Text>
        </View>
      </View>

      {invoice.note ? (
        <View style={styles.note} wrap={false}>
          <Text style={styles.noteText}>Note: {invoice.note}</Text>
        </View>
      ) : null}

      <View style={styles.foot} fixed>
        <Text style={styles.footText}>
          {brand.helplines.length ? `Helpline ${brand.helplines.join('  ·  ')}` : ''}
        </Text>
        <Text style={styles.footText}>
          {[brand.facebook, brand.instagram, brand.website].filter(Boolean).join('   ·   ')}
        </Text>
      </View>
    </Page>
  );
}

export default function InvoicePdf({ invoices = [], brand, title = 'Invoices' }) {
  return (
    <Document title={title}>
      {invoices.map((invoice) => (
        <Invoice key={invoice.orderNo} invoice={invoice} brand={brand} />
      ))}
    </Document>
  );
}
