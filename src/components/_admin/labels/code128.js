import JsBarcode from 'jsbarcode';

/**
 * Code128 as geometry rather than as pixels.
 *
 * The PDF needs the bars as vector rectangles, not as an image: a rasterised
 * barcode is resampled by the printer driver and the bar edges soften, which is
 * exactly what a scanner cannot forgive at 0.25mm module widths.
 *
 * JsBarcode's object renderer hands back the encoded module string, so the
 * symbol here and the symbol drawn on screen come from the same encoder — there
 * is no second implementation of Code128 to disagree with the first.
 */

/**
 * @returns {{ modules: number, bars: Array<{ start: number, width: number }> }}
 *   `modules` is the total width in modules; each bar is a run of dark modules.
 *   Throws if the value cannot be encoded.
 */
export function encodeCode128(value) {
  const out = {};
  JsBarcode(out, String(value), {
    format: 'CODE128',
    // Geometry only. The human-readable line is a row of the label, drawn from
    // the same string, so JsBarcode must not also draw one here.
    displayValue: false,
    margin: 0,
    width: 1,
    height: 1
  });

  const data = out.encodings?.[0]?.data || '';
  if (!data) throw new Error(`Code128 could not encode "${value}".`);

  // Collapsing runs matters: 178 modules become ~50 rectangles, and a PDF with
  // one rectangle per module on a 44-label sheet is thousands of objects.
  const bars = [];
  let index = 0;
  while (index < data.length) {
    let end = index;
    while (end < data.length && data[end] === data[index]) end += 1;
    if (data[index] === '1') bars.push({ start: index, width: end - index });
    index = end;
  }

  return { modules: data.length, bars };
}
