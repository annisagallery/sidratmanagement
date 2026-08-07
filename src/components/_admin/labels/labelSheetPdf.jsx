import { Document, Page, View, Text, Svg, Rect, StyleSheet } from '@react-pdf/renderer';

import { encodeCode128 } from './code128';
import { PDF_FONT, registerPdfFonts } from './pdfFonts';
import {
  BARCODE_HEIGHT_PT,
  CONTENT_WIDTH_PT,
  CUT_GUIDE,
  LABEL,
  MIN_MODULE_PT,
  PER_SHEET,
  PRICE_PREFIX,
  PRICE_SUFFIX,
  SHEET,
  TYPE,
  mm
} from './labelSpec';

/**
 * The label sheet as a PDF.
 *
 * Printing used to mean rendering an HTML page and handing it to `window.print()`,
 * which puts the printer driver, the browser's own margins and the operator's
 * page-setup dialog between us and the paper. On 44-up die-cut stock that is the
 * difference between labels landing on labels and a wasted sheet — the browser
 * scales "to fit", adds headers, and there is no way to tell from the preview.
 *
 * A PDF states its page size and its coordinates absolutely. What is in this
 * file is what comes out of the printer.
 *
 * The product name and variant come out of the catalogue, so they are set in
 * the same font as the shipping label and for the same reason: a name carried
 * over from the old POS may be in Bangla, and a standard PDF font would print
 * it as blank boxes without the browser preview ever showing it. Only the code
 * is a standard font — see labelSpec.js for why that one is monospaced.
 */

/**
 * The grid fits its page EXACTLY: 4 x 48.5mm is 210mm less two 8mm margins to
 * the micron, and 11 x 25.4mm is 279.4mm inside 8.8mm margins. Exact is a trap
 * for a flex-wrap layout — one bit of rounding the wrong way wraps the fourth
 * label onto its own row and every label after it lands on bare paper.
 *
 * So a point of slack is taken off the far edges only. The first label stays
 * exactly where the die-cut expects it; the tolerance is spent at the bottom
 * right, where 0.35mm of it is invisible.
 */
const SLACK_PT = 1;
const PAGE_MARGIN_X_PT = mm(SHEET.marginMm);
const PAGE_MARGIN_Y_PT = mm((SHEET.pageHeightMm - SHEET.rows * LABEL.heightMm) / 2);

registerPdfFonts();

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_MARGIN_Y_PT,
    paddingBottom: Math.max(0, PAGE_MARGIN_Y_PT - SLACK_PT),
    paddingLeft: PAGE_MARGIN_X_PT,
    paddingRight: Math.max(0, PAGE_MARGIN_X_PT - SLACK_PT),
    backgroundColor: '#ffffff'
  },
  sheet: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  label: {
    width: mm(LABEL.widthMm),
    height: mm(LABEL.heightMm),
    paddingVertical: mm(LABEL.paddingYMm),
    paddingHorizontal: mm(LABEL.paddingXMm),
    alignItems: 'center',
    justifyContent: 'flex-start',
    color: '#000000'
  },
  guides: {
    borderWidth: CUT_GUIDE.widthPt,
    borderStyle: 'dashed',
    borderColor: CUT_GUIDE.color
  },
  name: {
    fontFamily: PDF_FONT,
    fontWeight: 400,
    fontSize: TYPE.name.size,
    lineHeight: TYPE.name.lineHeight,
    textAlign: 'center'
  },
  attributes: {
    fontFamily: PDF_FONT,
    fontWeight: 400,
    fontSize: TYPE.attributes.size,
    lineHeight: TYPE.attributes.lineHeight,
    textAlign: 'center'
  },
  price: {
    fontFamily: PDF_FONT,
    fontWeight: 400,
    fontSize: TYPE.price.size,
    lineHeight: TYPE.price.lineHeight,
    textAlign: 'center'
  },
  // The barcode takes what the text leaves, so a one-line name buys bar height
  // rather than white space.
  code: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    marginTop: 1
  },
  // Match the receipt's normal-weight text treatment rather than using the
  // darker operational monospace face.
  serial: {
    fontFamily: PDF_FONT,
    fontWeight: 400,
    fontSize: TYPE.serial.size,
    lineHeight: TYPE.serial.lineHeight,
    textAlign: 'center'
  }
});

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * The bars, as vector rectangles at 1:1 with the label.
 *
 * The viewBox matches the drawn size exactly, so nothing is scaled and a module
 * is the width this file says it is — no dependence on how a renderer handles
 * preserveAspectRatio.
 */
function Bars({ value, height }) {
  let symbol;
  try {
    symbol = encodeCode128(value);
  } catch {
    // One unencodable code must not take the sheet down. The gap is visible on
    // the page and names the item that needs fixing.
    return null;
  }

  const moduleWidth = CONTENT_WIDTH_PT / symbol.modules;
  // Below the floor the symbol will not read, so print it at the floor and let
  // it run to the label's edge — a barcode that is slightly too wide can still
  // be scanned; one whose bars have merged cannot.
  const drawWidth = Math.max(moduleWidth, MIN_MODULE_PT) * symbol.modules;

  return (
    <Svg viewBox={`0 0 ${drawWidth} ${height}`} style={{ width: drawWidth, height }}>
      {symbol.bars.map((bar) => (
        <Rect
          key={bar.start}
          x={(bar.start * drawWidth) / symbol.modules}
          y={0}
          width={(bar.width * drawWidth) / symbol.modules}
          height={height}
          fill="#000000"
        />
      ))}
    </Svg>
  );
}

/** NAME > ATTRIBUTES > PRICE > BARCODE > SERIAL. See labelSpec.js. */
function Label({ item, showPrice, guides }) {
  const price = showPrice ? formatMoney(item?.price) : null;
  const code = item?.barcode ? String(item.barcode) : null;

  return (
    <View style={guides ? [styles.label, styles.guides] : styles.label}>
      {/* Match the POS receipt by preserving the catalogue's original casing. */}
      <Text style={styles.name} maxLines={TYPE.name.maxLines}>
        {String(item?.name || '')}
      </Text>

      {item?.variant ? (
        <Text style={styles.attributes} maxLines={1}>
          {String(item.variant)}
        </Text>
      ) : null}

      {price ? (
        <Text style={styles.price} maxLines={1}>
          {`${PRICE_PREFIX}${price}${PRICE_SUFFIX}`}
        </Text>
      ) : null}

      {code ? (
        <>
          <View style={styles.code}>
            <Bars value={code} height={BARCODE_HEIGHT_PT} />
          </View>
          {/* Same `code` constant the bars encode — one variable, so the printed
              digits cannot drift from what a scanner reads. */}
          <Text style={styles.serial} maxLines={1}>
            {code}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function chunk(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

export default function LabelSheetPdf({ labels = [], title = 'Labels', showPrice = true, guides = true }) {
  const pages = chunk(labels, PER_SHEET);

  return (
    <Document title={title}>
      {(pages.length ? pages : [[]]).map((page, pageIndex) => (
        // eslint-disable-next-line react/no-array-index-key
        <Page key={pageIndex} size="A4" orientation="portrait" style={styles.page}>
          <View style={styles.sheet}>
            {page.map((item, index) => (
              <Label
                // Two labels for the same barcode are a legitimate print run.
                // eslint-disable-next-line react/no-array-index-key
                key={`${item.barcode || 'blank'}-${index}`}
                item={item}
                showPrice={showPrice}
                guides={guides}
              />
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}
