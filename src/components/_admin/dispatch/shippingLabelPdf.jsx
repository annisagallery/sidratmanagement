import {
  Circle,
  Document,
  Ellipse,
  Image,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View
} from '@react-pdf/renderer';

import { encodeCode128 } from '../labels/code128';
import { MONO_PDF_FONT } from '../labels/labelSpec';
import { PDF_FONT, registerPdfFonts } from '../labels/pdfFonts';
import {
  CUT_GUIDE,
  LABEL_HEIGHT_PT,
  LABEL_WIDTH_PT,
  PER_SHEET,
  SHEET,
  SLACK_PT,
  mm
} from './shippingLabelGeometry';

/**
 * The shipping label, six to an A4 sheet.
 *
 * The old label was a six-row table with every field given the same weight, so
 * a rider standing at a gate had to read all of it to find the two things that
 * decide what happens next: where the parcel goes, and how much to collect.
 * This is the same information, ranked:
 *
 *     ┌──────────────────────────────────────────┐
 *     │ ◯ ANNISA GALLERY            ORDER        │
 *     │   tagline                   URG-081907   │
 *     ├──────────────────────────────────────────┤
 *     │ DELIVER TO                               │
 *     │ Rifah                        ← biggest   │
 *     │ 01333076422                  ← next      │
 *     │ 62/7, chan kuthir, poschim tejturi…      │
 *     ├────────────────────┬─────────────────────┤
 *     │ COLLECT ON DELIVERY│  ‖‖‖‖‖‖‖‖‖‖‖‖‖      │
 *     │ Tk 1,655           │  URG-081907         │
 *     ├────────────────────┴─────────────────────┤
 *     │ Helpline 016… · 018…    f ig ⊕ …         │
 *     └──────────────────────────────────────────┘
 *
 * Two things the old one did not have:
 *
 *  - the amount is the largest type on the label. It is the field that costs
 *    money to get wrong, and it now reads across a warehouse.
 *  - the order number is a Code128 barcode as well as text, so the same scanner
 *    that reads a production sticker resolves a parcel at the packing bench.
 *
 * The address block is the one that grows: it is the only field whose length is
 * not ours to control and the only one that must never be clipped.
 */

registerPdfFonts();

const INK = '#000000';
const RULE = '#111827';
const MUTED = '#6b7280';
const BORDER = 0.9;

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    backgroundColor: '#ffffff',
    paddingTop: mm(SHEET.marginMm),
    paddingBottom: Math.max(0, mm(SHEET.marginMm) - SLACK_PT),
    paddingLeft: mm(SHEET.marginMm),
    paddingRight: Math.max(0, mm(SHEET.marginMm) - SLACK_PT)
  },
  sheet: { flexDirection: 'row', flexWrap: 'wrap' },

  // The cut guide sits on the outside; the label's own frame is inside it, so
  // scissors that wander slightly still leave a complete label.
  cell: { width: LABEL_WIDTH_PT, height: LABEL_HEIGHT_PT, padding: 4 },
  guides: { borderWidth: CUT_GUIDE.widthPt, borderStyle: 'dashed', borderColor: CUT_GUIDE.color },
  label: { flex: 1, borderWidth: BORDER, borderColor: RULE, color: INK },

  /* ── brand + order number ───────────────────────────────────────────── */
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  mark: { width: 27, height: 27, borderRadius: 13.5, objectFit: 'contain' },
  markFallback: { width: 27, height: 27, borderRadius: 13.5, alignItems: 'center', justifyContent: 'center' },
  markLetter: { fontSize: 13, fontWeight: 700, color: '#ffffff' },
  wordmark: { fontSize: 12, fontWeight: 700, letterSpacing: 1.1, lineHeight: 1.05 },
  tagline: { fontSize: 4.5, fontWeight: 600, letterSpacing: 0.6, color: MUTED, marginTop: 1.5 },
  orderBox: { alignItems: 'flex-end' },
  // Same string as the barcode caption at the bottom of this label, so it is
  // set the same way — two faces for one number reads as an oversight.
  orderNo: { fontFamily: MONO_PDF_FONT, fontSize: 10 },

  /* ── recipient ──────────────────────────────────────────────────────── */
  band: { borderTopWidth: BORDER, borderTopColor: RULE },
  recipient: { flexGrow: 1, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 5 },
  eyebrow: { fontSize: 5, fontWeight: 700, letterSpacing: 1.1, color: MUTED },
  name: { fontSize: 11.5, fontWeight: 700, lineHeight: 1.15, marginTop: 2 },
  phone: { fontSize: 10, fontWeight: 700, letterSpacing: 0.4, marginTop: 1.5 },
  address: { fontSize: 8, lineHeight: 1.35, marginTop: 3 },

  /* ── money + barcode ────────────────────────────────────────────────── */
  moneyRow: { flexDirection: 'row', borderTopWidth: BORDER, borderTopColor: RULE },
  moneyCell: {
    width: '46%',
    borderRightWidth: BORDER,
    borderRightColor: RULE,
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: 'center'
  },
  amount: { fontSize: 15, fontWeight: 700, lineHeight: 1.05, marginTop: 1 },
  paid: { fontSize: 13, fontWeight: 700, letterSpacing: 1.2, lineHeight: 1.05, marginTop: 1 },
  codeCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  // Monospace, like the POS receipt's barcode caption and the product labels —
  // every code in the system reads the same way. See labels/labelSpec.js.
  codeText: { fontFamily: MONO_PDF_FONT, fontSize: 6.8, marginTop: 2 },

  /* ── helpline + socials ─────────────────────────────────────────────── */
  foot: {
    borderTopWidth: BORDER,
    borderTopColor: RULE,
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 3.5,
    gap: 6
  },
  footLeft: { width: '40%' },
  footRight: { flex: 1, gap: 2 },
  footText: { fontSize: 6.2, lineHeight: 1.3 },
  social: { flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  socialText: { fontSize: 6.2 }
});

/* ── social marks, drawn rather than fetched ─────────────────────────────
   An <Image> here would be a network request per label, and one failed request
   rejects the whole document. These are a few vector ops that cannot fail.    */

const ICON = 8.5;

function IconFacebook({ color }) {
  return (
    <Svg viewBox="0 0 16 16" style={{ width: ICON, height: ICON }}>
      <Circle cx="8" cy="8" r="7.2" fill="none" stroke={color} strokeWidth="1.1" />
      <Path
        d="M9.35 5.6h1.05V4.1c-.2-.03-.75-.1-1.4-.1-1.38 0-2.33.83-2.33 2.36V7.6H5.3v1.7h1.37v4.3h1.68V9.3h1.36l.21-1.7H8.35V6.53c0-.5.14-.93 1-.93z"
        fill={color}
      />
    </Svg>
  );
}

function IconInstagram({ color }) {
  return (
    <Svg viewBox="0 0 16 16" style={{ width: ICON, height: ICON }}>
      <Circle cx="8" cy="8" r="7.2" fill="none" stroke={color} strokeWidth="1.1" />
      <Rect x="4.5" y="4.5" width="7" height="7" rx="2.2" fill="none" stroke={color} strokeWidth="1.05" />
      <Circle cx="8" cy="8" r="1.85" fill="none" stroke={color} strokeWidth="1.05" />
      <Circle cx="10.35" cy="5.65" r="0.62" fill={color} />
    </Svg>
  );
}

function IconGlobe({ color }) {
  return (
    <Svg viewBox="0 0 16 16" style={{ width: ICON, height: ICON }}>
      <Circle cx="8" cy="8" r="7.2" fill="none" stroke={color} strokeWidth="1.1" />
      <Line x1="0.8" y1="8" x2="15.2" y2="8" stroke={color} strokeWidth="1.05" />
      <Ellipse cx="8" cy="8" rx="3.15" ry="7.2" fill="none" stroke={color} strokeWidth="1.05" />
    </Svg>
  );
}

function Social({ icon: Icon, color, children }) {
  if (!children) return null;
  return (
    <View style={styles.social}>
      <Icon color={color} />
      <Text style={styles.socialText} maxLines={1}>
        {children}
      </Text>
    </View>
  );
}

/**
 * The order number as bars, at 1:1 with the label — the viewBox matches the
 * drawn size, so a module is the width this file says it is.
 */
function OrderBarcode({ value, width, height }) {
  let symbol;
  try {
    symbol = encodeCode128(value);
  } catch {
    // An unencodable order number must not take the sheet down; the number is
    // printed as text directly beneath, which is what a human reads anyway.
    return null;
  }
  const moduleWidth = width / symbol.modules;
  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      {symbol.bars.map((bar) => (
        <Rect
          key={bar.start}
          x={bar.start * moduleWidth}
          y={0}
          width={bar.width * moduleWidth}
          height={height}
          fill={INK}
        />
      ))}
    </Svg>
  );
}

function ShippingLabel({ label, brand, guides }) {
  return (
    <View style={guides ? [styles.cell, styles.guides] : styles.cell}>
      <View style={styles.label}>
        <View style={styles.head}>
          {brand.logo ? (
            <Image src={brand.logo} style={styles.mark} />
          ) : (
            <View style={[styles.markFallback, { backgroundColor: brand.color }]}>
              <Text style={styles.markLetter}>{(brand.name || 'A').trim().charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.wordmark} maxLines={1}>
              {String(brand.name || '').toUpperCase()}
            </Text>
            {brand.tagline ? (
              <Text style={styles.tagline} maxLines={1}>
                {String(brand.tagline).toUpperCase()}
              </Text>
            ) : null}
          </View>
          <View style={styles.orderBox}>
            <Text style={styles.eyebrow}>ORDER</Text>
            <Text style={styles.orderNo} maxLines={1}>
              {label.orderNo}
            </Text>
          </View>
        </View>

        <View style={[styles.band, styles.recipient]}>
          <Text style={styles.eyebrow}>DELIVER TO</Text>
          <Text style={styles.name} maxLines={2}>
            {label.recipient}
          </Text>
          {label.phone ? (
            <Text style={styles.phone} maxLines={1}>
              {label.phone}
            </Text>
          ) : null}
          {label.address ? (
            <Text style={styles.address} maxLines={5}>
              {label.address}
            </Text>
          ) : null}
        </View>

        <View style={styles.moneyRow}>
          <View style={styles.moneyCell}>
            <Text style={styles.eyebrow}>{label.due ? 'COLLECT ON DELIVERY' : 'PAYMENT'}</Text>
            {label.due ? (
              <Text style={styles.amount}>{label.amount}</Text>
            ) : (
              <Text style={styles.paid}>PAID</Text>
            )}
          </View>
          <View style={styles.codeCell}>
            <OrderBarcode value={label.orderNo} width={112} height={20} />
            <Text style={styles.codeText}>{label.orderNo}</Text>
          </View>
        </View>

        <View style={styles.foot}>
          <View style={styles.footLeft}>
            {brand.helplines.length ? (
              <>
                <Text style={styles.eyebrow}>HELPLINE</Text>
                <Text style={styles.footText} maxLines={2}>
                  {brand.helplines.join('  ·  ')}
                </Text>
              </>
            ) : null}
          </View>
          <View style={styles.footRight}>
            <Social icon={IconFacebook} color={brand.color}>
              {brand.facebook}
            </Social>
            <Social icon={IconInstagram} color={brand.color}>
              {brand.instagram}
            </Social>
            <Social icon={IconGlobe} color={brand.color}>
              {brand.website}
            </Social>
          </View>
        </View>
      </View>
    </View>
  );
}

function chunk(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

export default function ShippingLabelPdf({ labels = [], brand, title = 'Shipping labels', guides = true }) {
  const pages = chunk(labels, PER_SHEET);

  return (
    <Document title={title}>
      {(pages.length ? pages : [[]]).map((page, pageIndex) => (
        // eslint-disable-next-line react/no-array-index-key
        <Page key={pageIndex} size="A4" orientation="portrait" style={styles.page}>
          <View style={styles.sheet}>
            {page.map((label) => (
              <ShippingLabel key={label.orderNo} label={label} brand={brand} guides={guides} />
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}

export { PER_SHEET };
