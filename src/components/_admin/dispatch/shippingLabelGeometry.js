/**
 * Shipping-label geometry, kept free of @react-pdf/renderer.
 *
 * The builder page needs to say "3 sheets" before anyone presses print, but the
 * renderer is a large dependency that is loaded on demand. Importing the PDF
 * document just to read `PER_SHEET` would pull the whole of it into the page's
 * bundle and undo that.
 */

/** Points per millimetre. */
export const PT_PER_MM = 72 / 25.4;
export const mm = (value) => value * PT_PER_MM;

/**
 * Six labels to an A4 portrait sheet: 2 across x 3 down, inside 8mm margins.
 *   2 x 97mm  = 194mm = 210mm less two 8mm margins
 *   3 x 93.7mm = 281mm = 297mm less two 8mm margins
 *
 * Each label is therefore a shade under A6 and near-square — enough room for an
 * address of several lines without the type dropping below what a rider can
 * read at arm's length in a van.
 */
export const SHEET = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginMm: 8,
  columns: 2,
  rows: 3
};

export const PER_SHEET = SHEET.columns * SHEET.rows;

export const CONTENT_WIDTH_PT = mm(SHEET.pageWidthMm - SHEET.marginMm * 2);
export const CONTENT_HEIGHT_PT = mm(SHEET.pageHeightMm - SHEET.marginMm * 2);
export const LABEL_WIDTH_PT = CONTENT_WIDTH_PT / SHEET.columns;
export const LABEL_HEIGHT_PT = CONTENT_HEIGHT_PT / SHEET.rows;

/**
 * The grid divides its page exactly, and exact is a trap for a flex-wrap
 * layout: one bit of rounding the wrong way drops a label onto its own row and
 * every label after it lands somewhere the die-cut is not. A point of tolerance
 * is spent at the far edges, leaving the first label exactly where it belongs.
 */
export const SLACK_PT = 1;

/** Dashed cut guide — same weight and colour as the barcode label sheet. */
export const CUT_GUIDE = { widthPt: 0.5, color: '#94a3b8' };
