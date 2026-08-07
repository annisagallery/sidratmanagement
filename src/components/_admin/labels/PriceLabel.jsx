'use client';

import Barcode from './Barcode';
import {
  BARCODE_HEIGHT_PT,
  CONTENT_WIDTH_MM,
  CUT_GUIDE,
  LABEL,
  PRICE_PREFIX,
  PRICE_SUFFIX,
  SHEET,
  TYPE
} from './labelSpec';

/**
 * The on-screen preview of one label.
 *
 * Five rows, always, in this order — see labelSpec.js for why:
 *
 *   NAME          what it is
 *   ATTRIBUTES    which one
 *   PRICE         what it costs
 *   BARCODE       the machine reads this
 *   SERIAL        the same code, for a human to read aloud
 *
 * The sizes come from the same spec the PDF is built from, so the preview is
 * an honest picture of what will print rather than a lookalike that drifts.
 */

/** Bar height for the preview, in CSS px, matching the PDF's points. */
const PREVIEW_BARCODE_HEIGHT_PX = Math.round((BARCODE_HEIGHT_PT * 96) / 72);

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PriceLabel({ item, showPrice = true }) {
  const price = showPrice ? formatMoney(item?.price) : null;
  const code = item?.barcode ? String(item.barcode) : null;

  return (
    <div className="label">
      {/* Keep catalogue casing intact: the POS receipt prints these same saved
          values as-is, so the garment label and receipt identify the item with
          identical text. */}
      <div className="label-name">{String(item?.name || '')}</div>

      {item?.variant ? <div className="label-variant">{String(item.variant)}</div> : null}

      {price ? <div className="label-price">{`${PRICE_PREFIX}${price}${PRICE_SUFFIX}`}</div> : null}

      {code ? (
        <>
          <div className="label-code">
            {/* code is the stored barcode, passed through untouched — see Barcode.jsx. */}
            <Barcode
              value={code}
              displayValue={false}
              height={PREVIEW_BARCODE_HEIGHT_PX}
              width={1.3}
              fitWidthMm={CONTENT_WIDTH_MM}
            />
          </div>
          {/* The same `code` constant the bars encode, so the printed digits
              cannot drift from what a scanner reads. */}
          <div className="label-serial">{code}</div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Sheet + label CSS, generated from the spec so the preview and the PDF cannot
 * disagree about geometry. Shared by every label preview route.
 */
export const LABEL_SHEET_CSS = `
  .sheet {
    display: grid;
    grid-template-columns: repeat(${SHEET.columns}, ${LABEL.widthMm}mm);
    justify-content: center;
  }
  .label {
    width: ${LABEL.widthMm}mm;
    height: ${LABEL.heightMm}mm;
    box-sizing: border-box;
    padding: ${LABEL.paddingYMm}mm ${LABEL.paddingXMm}mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    text-align: center;
    overflow: hidden;
    border: ${CUT_GUIDE.widthPt}pt dashed ${CUT_GUIDE.color};
    font-family: inherit;
    color: #000;
  }
  .label-name {
    font-size: ${TYPE.name.size}pt;
    font-weight: 400;
    line-height: ${TYPE.name.lineHeight};
    /* Two lines maximum — the barcode's space is not negotiable. */
    display: -webkit-box;
    -webkit-line-clamp: ${TYPE.name.maxLines};
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .label-variant {
    font-size: ${TYPE.attributes.size}pt;
    font-weight: 400;
    line-height: ${TYPE.attributes.lineHeight};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .label-price {
    font-size: ${TYPE.price.size}pt;
    font-weight: 400;
    line-height: ${TYPE.price.lineHeight};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .label-code {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    flex: 1;
    min-height: 0;
    margin-top: 1pt;
  }
  .label-code svg { max-width: 100%; height: auto; }
  .label-serial {
    /* Match the POS receipt's inherited, normal-weight text face. */
    font-family: inherit;
    font-size: ${TYPE.serial.size}pt;
    font-weight: 400;
    line-height: ${TYPE.serial.lineHeight};
    white-space: nowrap;
    overflow: hidden;
    max-width: 100%;
  }

  @media print {
    @page { size: A4 portrait; margin: ${SHEET.marginMm}mm; }
    html, body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
    /* Dashed guides are for cutting plain paper; on die-cut stock they are noise.
       ?guides=0 removes them. */
    .sheet.no-guides .label { border: none; }
  }
`;
