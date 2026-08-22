import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { PDF_FONT, registerPdfFonts } from '../labels/pdfFonts';

/**
 * The two stock documents, on one sheet each: a transfer docket and a purchase
 * order.
 *
 * They are one file because they are the same document with different columns —
 * a heading, two parties, a list of lines, a total, and a place to sign. That is
 * how the old POS printed them and how the people receiving them read them, and
 * two separate implementations would have drifted the moment one gained a
 * column.
 *
 * A PDF rather than an HTML page handed to `window.print()`, for the reason the
 * invoice gives: a docket travels with the goods and gets checked against them
 * at the far end, so the copy that leaves and the copy that arrives have to be
 * the same size on the same paper regardless of whose browser produced it.
 *
 * Money is set in "Tk", not the ৳ sign — see pdfFonts.js.
 */

registerPdfFonts();

const INK = '#0f172a';
const GRAY = '#475569';
const MUTED = '#94a3b8';
const HAIRLINE = '#e2e8f0';

const tk = (value) =>
  `Tk ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const count = (value) => Number(value || 0).toLocaleString('en-US');

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

  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  brandBox: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 300 },
  logo: { width: 92, height: 30, objectFit: 'contain' },
  lettermark: { fontSize: 15, fontWeight: 700, letterSpacing: 0.4 },
  tagline: { fontSize: 7.5, color: MUTED, marginTop: 2 },

  docBox: { alignItems: 'flex-end' },
  docKind: { fontSize: 8, letterSpacing: 1.4, color: MUTED, textTransform: 'uppercase' },
  docNo: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  docMeta: { fontSize: 8, color: GRAY, marginTop: 3 },

  rule: { height: 2, marginBottom: 12 },

  // The two ends of the movement, side by side, because the first thing anyone
  // checks on a docket is that it is addressed to them.
  parties: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  party: { flex: 1, borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4, padding: 9 },
  partyLabel: { fontSize: 7, letterSpacing: 1, color: MUTED, textTransform: 'uppercase' },
  partyName: { fontSize: 11, fontWeight: 700, marginTop: 3 },
  partyLine: { fontSize: 8, color: GRAY, marginTop: 2 },

  tHead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 7
  },
  tRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 7,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE
  },
  th: { fontSize: 7.5, letterSpacing: 0.6, color: GRAY, textTransform: 'uppercase' },

  cIndex: { width: 20 },
  cName: { flex: 1, paddingRight: 6 },
  cNum: { width: 52, textAlign: 'right' },
  cMoney: { width: 66, textAlign: 'right' },

  itemName: { fontSize: 9 },
  itemSub: { fontSize: 7.5, color: MUTED, marginTop: 1.5 },

  totals: { marginTop: 12, marginLeft: 'auto', width: 210 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: GRAY },
  totalValue: { fontSize: 9, fontWeight: 700 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', padding: 7, borderRadius: 3, marginTop: 4 },
  grandLabel: { fontSize: 10, fontWeight: 700 },
  grandValue: { fontSize: 12, fontWeight: 700 },

  note: { marginTop: 12, borderLeftWidth: 2, borderLeftColor: HAIRLINE, paddingLeft: 8 },
  noteText: { fontSize: 8, color: GRAY, lineHeight: 1.5 },

  // A docket is signed at both ends — that is the point of carrying it.
  signs: { flexDirection: 'row', gap: 26, marginTop: 26 },
  sign: { flex: 1 },
  signLine: { borderTopWidth: 1, borderTopColor: '#94a3b8', marginBottom: 4 },
  signLabel: { fontSize: 7.5, color: GRAY },

  foot: { position: 'absolute', left: 34, right: 34, bottom: 22, alignItems: 'center' },
  footText: { fontSize: 7, color: MUTED }
});

function Header({ brand, kind, number, meta, accent }) {
  return (
    <>
      <View style={styles.head}>
        <View style={styles.brandBox}>
          {brand?.logo ? (
            <Image src={brand.logo} style={styles.logo} />
          ) : (
            <View>
              <Text style={styles.lettermark}>{brand?.name || 'Sidrat'}</Text>
              {brand?.tagline ? <Text style={styles.tagline}>{brand.tagline}</Text> : null}
            </View>
          )}
        </View>
        <View style={styles.docBox}>
          <Text style={styles.docKind}>{kind}</Text>
          <Text style={styles.docNo}>{number}</Text>
          {meta.map((line) => (
            <Text key={line} style={styles.docMeta}>
              {line}
            </Text>
          ))}
        </View>
      </View>
      <View style={[styles.rule, { backgroundColor: accent }]} />
    </>
  );
}

function Party({ label, name, lines = [] }) {
  return (
    <View style={styles.party}>
      <Text style={styles.partyLabel}>{label}</Text>
      <Text style={styles.partyName}>{name || '—'}</Text>
      {lines.filter(Boolean).map((line) => (
        <Text key={line} style={styles.partyLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function Signatures({ left, right }) {
  return (
    <View style={styles.signs}>
      <View style={styles.sign}>
        <View style={styles.signLine} />
        <Text style={styles.signLabel}>{left}</Text>
      </View>
      <View style={styles.sign}>
        <View style={styles.signLine} />
        <Text style={styles.signLabel}>{right}</Text>
      </View>
    </View>
  );
}

function Foot({ brand }) {
  return (
    <View style={styles.foot} fixed>
      <Text style={styles.footText}>
        {[brand?.name, brand?.address].filter(Boolean).join('  ·  ')}
        {brand?.helplines?.length ? `  ·  ${brand.helplines.join('  ·  ')}` : ''}
      </Text>
    </View>
  );
}

/* ── transfer docket ─────────────────────────────────────────────────────── */

export function TransferDocketPdf({ docket, brand, title = 'Transfer docket' }) {
  const accent = brand?.color || '#0f172a';
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Header
          brand={brand}
          kind="Stock transfer"
          number={docket.transferNo}
          meta={[docket.date, `Status: ${docket.status}`].filter(Boolean)}
          accent={accent}
        />

        <View style={styles.parties}>
          <Party label="From" name={docket.from} lines={[docket.dispatchedBy && `Dispatched by ${docket.dispatchedBy}`]} />
          <Party label="To" name={docket.to} lines={[docket.receivedBy && `Received by ${docket.receivedBy}`]} />
        </View>

        <View style={styles.tHead}>
          <Text style={[styles.th, styles.cIndex]}>#</Text>
          <Text style={[styles.th, styles.cName]}>Product</Text>
          <Text style={[styles.th, styles.cNum]}>Sent</Text>
          <Text style={[styles.th, styles.cNum]}>Received</Text>
        </View>

        {docket.lines.map((line, index) => (
          <View key={line.key} style={styles.tRow} wrap={false}>
            <Text style={styles.cIndex}>{index + 1}</Text>
            <View style={styles.cName}>
              <Text style={styles.itemName}>{line.name}</Text>
              {line.attributes ? <Text style={styles.itemSub}>{line.attributes}</Text> : null}
            </View>
            <Text style={styles.cNum}>{count(line.quantity)}</Text>
            <Text style={styles.cNum}>{count(line.receivedQuantity)}</Text>
          </View>
        ))}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Lines</Text>
            <Text style={styles.totalValue}>{count(docket.lines.length)}</Text>
          </View>
          <View style={[styles.grand, { backgroundColor: `${accent}1f` }]}>
            <Text style={styles.grandLabel}>Total pieces</Text>
            <Text style={styles.grandValue}>{count(docket.pieces)}</Text>
          </View>
        </View>

        {docket.note ? (
          <View style={styles.note} wrap={false}>
            <Text style={styles.noteText}>Note: {docket.note}</Text>
          </View>
        ) : null}

        <Signatures left="Dispatched by / date" right="Received by / date" />
        <Foot brand={brand} />
      </Page>
    </Document>
  );
}

/* ── purchase order ──────────────────────────────────────────────────────── */

export function PurchaseOrderPdf({ order, brand, title = 'Purchase order' }) {
  const accent = brand?.color || '#0f172a';
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Header
          brand={brand}
          kind="Purchase order"
          number={order.purchaseNo}
          meta={[order.date, order.refNo && `Ref ${order.refNo}`, `Status: ${order.status}`].filter(Boolean)}
          accent={accent}
        />

        <View style={styles.parties}>
          <Party label="Deliver to" name={order.branch} lines={[brand?.address]} />
          <Party
            label="Payment"
            name={order.paymentStatus}
            lines={[`Paid ${tk(order.paid)}`, `Balance ${tk(order.due)}`]}
          />
        </View>

        <View style={styles.tHead}>
          <Text style={[styles.th, styles.cIndex]}>#</Text>
          <Text style={[styles.th, styles.cName]}>Product</Text>
          <Text style={[styles.th, styles.cNum]}>Qty</Text>
          <Text style={[styles.th, styles.cNum]}>Recd</Text>
          <Text style={[styles.th, styles.cMoney]}>Unit cost</Text>
          <Text style={[styles.th, styles.cMoney]}>Subtotal</Text>
        </View>

        {order.lines.map((line, index) => (
          <View key={line.key} style={styles.tRow} wrap={false}>
            <Text style={styles.cIndex}>{index + 1}</Text>
            <View style={styles.cName}>
              <Text style={styles.itemName}>{line.name}</Text>
              {line.attributes ? <Text style={styles.itemSub}>{line.attributes}</Text> : null}
            </View>
            <Text style={styles.cNum}>{count(line.quantity)}</Text>
            <Text style={styles.cNum}>{count(line.receivedQuantity)}</Text>
            <Text style={styles.cMoney}>{tk(line.unitCost)}</Text>
            <Text style={styles.cMoney}>{tk(line.subTotal)}</Text>
          </View>
        ))}

        <View style={styles.totals} wrap={false}>
          {order.breakdown.map((row) => (
            <View key={row.label} style={styles.totalRow}>
              <Text style={styles.totalLabel}>{row.label}</Text>
              <Text style={styles.totalValue}>{row.value < 0 ? `-${tk(-row.value)}` : tk(row.value)}</Text>
            </View>
          ))}
          <View style={[styles.grand, { backgroundColor: `${accent}1f` }]}>
            <Text style={styles.grandLabel}>Grand total</Text>
            <Text style={styles.grandValue}>{tk(order.grandTotal)}</Text>
          </View>
        </View>

        {order.note ? (
          <View style={styles.note} wrap={false}>
            <Text style={styles.noteText}>Note: {order.note}</Text>
          </View>
        ) : null}

        <Signatures left="Received by / date" right="Authorised by / date" />
        <Foot brand={brand} />
      </Page>
    </Document>
  );
}
