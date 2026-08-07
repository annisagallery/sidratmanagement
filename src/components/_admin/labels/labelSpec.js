import { MONO_FONT } from './pdfFonts';

/**
 * One label, defined once.
 *
 * A label is printed from four places (the builder, a product's own sheet, the
 * production sticker sheet, and now a PDF) and every one of them used to own a
 * copy of the geometry. They drifted, which on 44-up die-cut stock means the
 * labels stop landing on the labels.
 *
 * So the numbers live here, in points, and both the on-screen preview and the
 * PDF are generated from them. If a label looks wrong, it is wrong in one file.
 *
 * ── Row order ───────────────────────────────────────────────────────────────
 * Every label, retail or production, stacks the same five rows:
 *
 *     NAME          what it is
 *     ATTRIBUTES    which one
 *     PRICE         what it costs
 *     BARCODE       the machine reads this
 *     SERIAL        the same code, for a human to read aloud
 *
 * There is one label, not a family of them. A production sticker is not a
 * different artefact that happens to look similar — it is this label, printed
 * earlier in the garment's life, and it goes to the shop floor still attached.
 * That is why it prices the piece rather than naming the order it was made for.
 */

/** Points per millimetre. PDF and print both work in points. */
export const PT_PER_MM = 72 / 25.4;

export const mm = (value) => value * PT_PER_MM;

/**
 * 44 labels per A4 portrait: 4 across x 11 down.
 *   4 x 48.5mm = 194mm inside 8mm margins = 210mm exactly
 *   11 x 25.4mm = 279.4mm, leaving 8.8mm top and bottom
 *
 * 48.5mm rather than a literal 2in (50.8mm): four 2in labels need 203.2mm,
 * leaving 3.4mm per side, which is inside the non-printable margin of nearly
 * every office printer. 48.5 x 25.4mm is what real 44-up A4 label stock uses.
 */
export const SHEET = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginMm: 8,
  columns: 4,
  rows: 11
};

export const PER_SHEET = SHEET.columns * SHEET.rows;

export const LABEL = {
  widthMm: 48.5,
  heightMm: 25.4,
  paddingXMm: 1.5,
  paddingYMm: 1
};

/** Printable width inside one label, in mm and in points. */
export const CONTENT_WIDTH_MM = LABEL.widthMm - LABEL.paddingXMm * 2;
export const CONTENT_WIDTH_PT = mm(CONTENT_WIDTH_MM);

/**
 * Type sizes, in points.
 *
 * These were 4.4–4.6pt, which is smaller than the fine print on a medicine box
 * and unreadable at arm's length on a shop floor. Sized up to the largest that
 * still leaves the barcode a scannable height on a 25.4mm label — the barcode's
 * space is the one thing that is not negotiable.
 */
export const TYPE = {
  name: { size: 6.2, lineHeight: 1.12, maxLines: 2 },
  attributes: { size: 5.6, lineHeight: 1.15 },
  price: { size: 5.6, lineHeight: 1.15 },
  // Near the receipt's caption size while preserving the barcode's full height.
  serial: { size: 8, lineHeight: 1.1 }
};

/**
 * The code under a barcode is set in monospace, matching the POS receipt.
 *
 * This is the one string on the label that gets read character by character —
 * typed into a search box, or spelled down a phone. A proportional face makes
 * that harder than it needs to be: `1` and `l`, `0` and `O`, `rn` and `m` all
 * blur together, and there is no column rhythm to keep your place in a long
 * code. Monospace fixes all of that, which is why JsBarcode draws its own
 * caption in it and why the receipt reads well.
 *
 * Regular weight, like the receipt — a barcode is already a dense block of ink,
 * and a bold caption under it competes with the thing it is captioning.
 *
 * The face is JetBrains Mono, not Courier. See pdfFonts.js for why: "regular
 * weight Courier" and "regular weight Consolas" are not the same colour on
 * paper, and only the second one looks like the receipt.
 */
export const MONO_PDF_FONT = MONO_FONT;
export const MONO_CSS_WEIGHT = 400;
export const MONO_CSS_STACK = `'JetBrains Mono', ui-monospace, 'Cascadia Mono', Menlo, monospace`;

/**
 * Bar height, in points. ~9mm — comfortably over the 6.35mm below which a
 * hand-held scanner starts needing a second pass.
 */
export const BARCODE_HEIGHT_PT = 25.5;

/**
 * Narrowest bar worth printing, in points (~0.25mm). Below this a 600dpi office
 * laser cannot hold the edge and the symbol stops reading — a failure that is
 * invisible until someone is standing at the till with the label in their hand.
 */
export const MIN_MODULE_PT = 0.709;

/**
 * The dashed cut guide, shared by the preview and the PDF.
 *
 * These were 0.2pt of #cbd5e1 and did not show up at all. Two reasons, and both
 * had to be fixed: the colour is 85% grey, which a laser renders as almost
 * nothing; and the renderer derives the dash pattern from the line width, so a
 * hairline border came out as a 0.14mm dash with a 0.08mm gap — far below the
 * size at which a dashed line is even distinguishable from a smudge.
 *
 * 0.5pt is the width at which the derived dash becomes 0.35mm on / 0.21mm off,
 * which reads as a dashed line. It costs 0.18mm of content on each edge.
 */
export const CUT_GUIDE = {
  widthPt: 0.5,
  color: '#94a3b8'
};

/**
 * The price row's wording, shared by the preview and the PDF.
 *
 * "Tk" rather than the ৳ sign. The embedded font does carry U+09F3, so this is
 * a choice rather than a limitation: these labels are written in English, and
 * the sign is not on the keyboard anyone here types on. The report exports say
 * "Tk" for the same reason — see reportPdf.jsx.
 *
 * The screen preview uses the identical string, because a preview that differs
 * from the paper is worse than no preview.
 */
export const PRICE_PREFIX = 'PRICE : ';
export const PRICE_SUFFIX = ' Tk (excluding VAT)';
