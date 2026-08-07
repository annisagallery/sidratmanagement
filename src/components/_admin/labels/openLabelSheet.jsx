'use client';

/**
 * Turn a list of labels into a PDF and put it in a new tab.
 *
 * Two things about the shape of this function are deliberate:
 *
 *  - the tab is opened SYNCHRONOUSLY, before any await. A `window.open` that
 *    happens after a promise resolves is no longer attributable to the click
 *    that started it, and every browser blocks it as a popup.
 *
 *  - @react-pdf/renderer is imported on demand. It is a large dependency and
 *    most people in the admin never print a label; loading it eagerly would put
 *    it in the shared bundle for all of them.
 */
export async function openLabelSheet(labels, { title = 'Labels', showPrice = true, guides = true } = {}) {
  if (!labels?.length) throw new Error('There is nothing to print.');

  const tab = window.open('', '_blank');
  try {
    const [{ pdf }, { default: LabelSheetPdf }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./labelSheetPdf')
    ]);

    const blob = await pdf(
      <LabelSheetPdf labels={labels} title={title} showPrice={showPrice} guides={guides} />
    ).toBlob();

    // Not revoked: the tab reads the blob for as long as it is open, and the URL
    // dies with the document that created it.
    const url = URL.createObjectURL(blob);
    if (tab) tab.location = url;
    else window.open(url, '_blank');
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** How a variation's attribute values read on a label. */
export function labelVariant(variation) {
  return (variation?.attributes || [])
    .map((attribute) => attribute?.valueName || attribute?.value)
    .filter(Boolean)
    .join(' / ');
}

/**
 * The price a label carries: the regular price, never a discounted one.
 *
 * A label is printed once and lives on the garment until it sells. A sale price
 * or a campaign price is true for a few weeks, so printing one puts a number on
 * stock that the till will later disagree with — and the customer is holding
 * the ticket. Discounts belong at the till, where they are computed fresh.
 *
 * The variation's own regular price wins over the product's base price, because
 * that is the same order of precedence the till prices from (see pos.js).
 */
export function labelPrice(product, variation) {
  return variation?.regularPrice ?? product?.price ?? null;
}

/**
 * Retail labels for a product's variations.
 *
 * `quantityFor` gives the number of copies wanted; a variation with no barcode
 * is skipped, because a label with no code on it is a sticker that has to be
 * thrown away at the till.
 */
export function retailLabels(product, variations, quantityFor) {
  return (variations || [])
    .filter((variation) => variation?.primaryBarcode && !variation?.deletedAt)
    .flatMap((variation) =>
      Array.from({ length: Math.max(0, Number(quantityFor(variation)) || 0) }).map(() => ({
        name: product?.name,
        variant: labelVariant(variation),
        price: labelPrice(product, variation),
        barcode: variation.primaryBarcode
      }))
    );
}

/**
 * Stickers for the pieces in a production batch.
 *
 * Identical in shape to a retail label, because it IS the retail label: the
 * sticker attached on the production floor is the one the garment carries to
 * the shop floor, so it has to price the piece rather than name the order it
 * was made for. The order is still recoverable — the barcode on this sticker is
 * unique to the piece and resolves to its order at the scan desk.
 *
 * Voided pieces have been replaced; printing them would put a dead code on a
 * real garment.
 */
export function productionStickerLabels(units) {
  return (units || [])
    .filter((unit) => unit.status !== 'VOID')
    .map((unit) => ({
      name: unit.product?.name || 'Product',
      variant: labelVariant(unit.variation),
      price: labelPrice(unit.product, unit.variation),
      barcode: unit.barcode
    }));
}
