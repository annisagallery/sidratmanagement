'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Code128 barcode, rendered to inline SVG.
 *
 * Code128 on purpose: it is the symbology every 1D laser scanner, imager and
 * phone app reads, and unlike EAN/UPC it encodes the full ASCII set — which our
 * codes need, since they contain letters and hyphens.
 *
 * CRITICAL: `value` must be the stored primaryBarcode, byte for byte. The server
 * matches scans with an exact equality check (utils/inventory.js normalizeBarcode
 * only trims whitespace — it does NOT strip hyphens), so a label that "tidies"
 * the code by dropping punctuation still looks correct to a human and is
 * unscannable at the till. Never reconstruct or reformat the encoded value.
 *
 * SVG rather than canvas so it stays sharp at any printer DPI — a canvas barcode
 * rasterised at screen resolution prints with soft bar edges that scanners
 * misread at small label sizes.
 */

/** CSS px per millimetre — print maps 1 CSS px to 1/96 inch. */
const PX_PER_MM = 96 / 25.4;

/**
 * Narrowest bar we are willing to print, in CSS px (~0.25mm).
 *
 * Below roughly this, a 600dpi office laser cannot hold the edge and the symbol
 * stops reading — which is the failure that matters, because it is invisible
 * until someone is standing at the till with the label in their hand.
 */
const MIN_MODULE_PX = 0.95;

export default function Barcode({
  value,
  height = 34,
  width = 1.4,
  fontSize = 13,
  /**
   * Whether JsBarcode draws the human-readable line under the bars.
   *
   * On a label it does not: the code is its own row of the layout (see
   * labelSpec.js), rendered from the same string that is encoded here, so the
   * two still cannot drift. Everywhere else the drawn line is the safest
   * default and stays on.
   */
  displayValue = true,
  /**
   * Width of the space this barcode has to live in, in millimetres.
   *
   * Without it, a long code (a production unit barcode is 14 characters, ~66mm
   * at the default module width) overflows its label and is rescued by CSS
   * `max-width: 100%`. That looks fine on screen and is wrong on paper: uniform
   * scaling shrinks the BAR HEIGHT along with the width, so a 30px-tall barcode
   * prints about 5mm tall with sub-0.25mm bars — right at the edge of what a
   * scanner can resolve. Fitting the symbol here instead narrows only the bars
   * and keeps the full height.
   */
  fitWidthMm = null,
  className = ''
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;

    const draw = (moduleWidth) =>
      JsBarcode(ref.current, String(value), {
        format: 'CODE128',
        height,
        width: moduleWidth,
        displayValue,
        fontSize,
        // Match the POS receipt: JsBarcode's normal-weight monospace caption.
        font: 'monospace',
        fontOptions: '',
        textMargin: 1,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000'
      });

    try {
      draw(width);

      if (!fitWidthMm) return;
      const available = fitWidthMm * PX_PER_MM;
      const rendered = ref.current.viewBox?.baseVal?.width || 0;
      if (!rendered || rendered <= available) return;

      // margin is 0, so the rendered width is exactly modules x module width —
      // which makes the module count, and therefore the fitted width, exact
      // rather than an estimate of how Code128 encoded this particular string.
      const modules = rendered / width;
      const fitted = Math.max(MIN_MODULE_PX, available / modules);
      if (fitted < width) draw(fitted);
    } catch {
      // An unencodable value must not take the whole sheet down — the blank
      // slot is visible on the page and tells the operator which item to fix.
      ref.current.innerHTML = '';
    }
  }, [value, height, width, fontSize, displayValue, fitWidthMm]);

  if (!value) return null;
  return <svg ref={ref} className={className} />;
}
