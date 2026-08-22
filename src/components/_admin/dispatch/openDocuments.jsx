'use client';

import * as api from 'src/services';
import { fDate } from 'src/utils/formatTime';
import { addressLocation, amountDue, amountPaid } from 'src/components/print/InvoiceDocument';

/**
 * The two documents a dispatch run produces, both as PDFs.
 *
 * Neither is rendered as a page and handed to `window.print()` any more. For
 * labels that mattered because they land on pre-cut stock, where a browser free
 * to scale "to fit" ruins a whole sheet. For invoices it matters because the
 * same order printed from two machines should not come out differently — a PDF
 * carries its own page size, margins and fonts.
 *
 * Every entry point here opens its tab SYNCHRONOUSLY, before any await. A
 * `window.open` that happens after a promise resolves is no longer attributable
 * to the click that started it, and every browser blocks it as a popup.
 * @react-pdf/renderer is imported on demand — it is large, and most people in
 * the admin never print.
 */

/** Beyond this the browser is the bottleneck, so stop rather than hang. */
const MAX_ORDERS = 200;

/* ── branding ────────────────────────────────────────────────────────────── */

/**
 * Which site settings these documents need, and what each one costs.
 *
 * A document missing its logo still does its job; one missing the helpline
 * leaves a customer with nobody to call. Neither should fail silently, so this
 * is exported for the print desk to show before anyone commits stock to a
 * printer.
 */
export function brandGaps(settings) {
  const gaps = [];
  if (!settings?.logo) gaps.push('Logo — documents fall back to a lettermark');
  if (!settings?.siteName) gaps.push('Site name — the wordmark will be blank');
  if (!settings?.phone && !settings?.whatsappNumber) gaps.push('Helpline number — the footer will be empty');
  if (!settings?.facebookUrl && !settings?.instagramUrl) gaps.push('Facebook or Instagram link');
  return gaps;
}

/**
 * Exported so the stock documents brand themselves the same way. One resolver
 * means a transfer docket and an invoice cannot disagree about the shop's own
 * name, logo or helpline.
 */
export async function resolveBrand(settings) {
  const helplines = [settings?.phone, settings?.whatsappNumber]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return {
    name: settings?.siteName || '',
    tagline: settings?.footerTagline || '',
    address: settings?.address || '',
    color: settings?.primaryColor || '#f97316',
    helplines: [...new Set(helplines)],
    facebook: bareAddress(settings?.facebookUrl),
    instagram: bareAddress(settings?.instagramUrl),
    // There is no website field in site settings, and the storefront URL the
    // admin already links to is the same address a customer would type.
    website: bareAddress(settings?.websiteUrl || process.env.NEXT_PUBLIC_FRONTEND_URL),
    logo: (await loadLogo(settings?.logo)).dataUri
  };
}

/**
 * A label has one line for a social address, so print what someone would type.
 * "https://www.facebook.com/annisagallerybd/" is a URL; "facebook.com/annisagallerybd"
 * is an address, and it fits.
 */
function bareAddress(url) {
  return String(url || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

/**
 * Fetch the logo and inline it as a data URI.
 *
 * Three reasons this is not just handed to <Image src={url}>:
 *
 *  - a failed image request REJECTS the whole render, so a slow image server
 *    would turn "print 40 labels" into "no labels and an error";
 *  - the renderer has no page context, so a stored path like `/uploads/logo.png`
 *    has to be made absolute before anything can fetch it;
 *  - inlining resolves it once per document rather than once per page.
 *
 * Returns `{ dataUri, reason }` rather than just the data, because this failing
 * silently is exactly how the logo went missing from every printed document
 * while still looking correct on screen — an <img> paints a cross-origin image
 * without asking, but reading its BYTES needs CORS, and the image server was
 * only sending those headers on /api. The print desk shows `reason` so the next
 * failure names itself instead of quietly becoming a lettermark.
 */
export async function loadLogo(url) {
  const raw = String(url || '').trim();
  if (!raw) return { dataUri: null, reason: null };
  if (raw.startsWith('data:')) return { dataUri: raw, reason: null };

  // Straight from the image host first: one hop, and it is already cached by
  // the browser from displaying the logo everywhere else in the admin.
  const direct = await readAsDataUri(() => fetch(new URL(raw, window.location.origin).toString(), { mode: 'cors' }));
  if (direct.dataUri) return direct;

  // Then through our own API, which fetches the image host server-to-server
  // where CORS does not apply. This is the path that works even when the image
  // host is not configured to allow cross-origin reads.
  const proxied = await readAsDataUri(() => api.getBrandLogoBlob());
  if (proxied.dataUri) return proxied;

  // A document with a lettermark is a document. One that never printed is not.
  return { dataUri: null, reason: proxied.reason || direct.reason };
}

async function readAsDataUri(request) {
  try {
    const response = await request();
    if (!response.ok) return { dataUri: null, reason: `the image server answered ${response.status}` };
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      return { dataUri: null, reason: `that URL returned ${blob.type || 'no content type'}, not an image` };
    }
    const dataUri = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    return { dataUri, reason: dataUri ? null : 'the image could not be decoded' };
  } catch (error) {
    return { dataUri: null, reason: `it could not be fetched (${error?.message || 'network or CORS'})` };
  }
}

/* ── order → document ────────────────────────────────────────────────────── */

const recipientOf = (order) =>
  order?.shippingAddress?.name || order?.guestName || order?.user?.name || 'Customer';

const phoneOf = (order) =>
  order?.shippingAddress?.phone || order?.guestPhone || order?.user?.phone || '';

const fullAddress = (order) => {
  const address = order?.shippingAddress || {};
  return [address.address, addressLocation(address)].filter(Boolean).join(', ');
};

/**
 * An order as the rider reads it.
 *
 * The amount is what is still owed, not the order total: a part-paid order must
 * show the balance and a settled one must not ask for money at the door.
 */
export function orderToShippingLabel(order) {
  const due = amountDue(order);
  return {
    orderNo: order?.orderNo || '',
    recipient: recipientOf(order),
    address: fullAddress(order),
    phone: phoneOf(order),
    due: due > 0,
    amount: `Tk ${Math.round(due).toLocaleString('en-US')}`
  };
}

/** An order as the customer reads it. */
export function orderToInvoice(order) {
  const items = (order?.items || []).map((item, index) => ({
    key: item.id || `${order?.orderNo}-${index}`,
    name: item.productSnapshot?.name || item.product?.name || item.pid?.name || '—',
    attributes: (item.attributes || item.attributesSnapshot || [])
      .map((attribute) => attribute.valueName)
      .filter(Boolean)
      .join(' · '),
    note: item.customizeDetails || '',
    quantity: item.quantity || 1,
    price: item.price || 0,
    lineTotal: (item.quantity || 0) * (item.price || 0)
  }));

  const breakdown = [
    { label: 'Subtotal', value: order?.subTotal, show: true },
    { label: 'Shipping', value: order?.shipping, show: (order?.shipping || 0) > 0 },
    { label: 'Coupon', value: -(order?.discount || 0), show: (order?.discount || 0) > 0 },
    { label: 'Cash off', value: -(order?.cashDiscount || 0), show: (order?.cashDiscount || 0) > 0 }
  ].filter((row) => row.show);

  return {
    orderNo: order?.orderNo || '',
    date: order?.createdAt ? fDate(order.createdAt) : '—',
    status: order?.status || '',
    paymentMethod: order?.paymentMethod || 'COD',
    recipient: recipientOf(order),
    phone: phoneOf(order),
    address: fullAddress(order),
    items,
    breakdown,
    total: order?.total || 0,
    paid: amountPaid(order),
    due: amountDue(order),
    note: order?.note || ''
  };
}

/* ── fetching ────────────────────────────────────────────────────────────── */

/**
 * Rows from a list do not carry enough for either document: the amount is the
 * balance still owed, which needs the payments taken so far, and neither the
 * address nor the line items are in the list projection. Fetching both
 * documents from the same endpoint is what stops an invoice and a label
 * disagreeing about what the rider should collect at the door.
 */
async function loadOrders(rows) {
  const numbers = [...new Set((rows || []).map((row) => row?.orderNo).filter(Boolean))];
  if (!numbers.length) throw new Error('None of the selected rows carry an order number.');

  const wanted = numbers.slice(0, MAX_ORDERS);
  const results = await Promise.all(
    wanted.map((orderNo) =>
      api
        .getOrderByAdmin(orderNo)
        .then((response) => response?.data || null)
        .catch(() => null)
    )
  );
  const orders = results.filter(Boolean);
  if (!orders.length) throw new Error('None of the selected orders could be loaded.');
  return { orders, skipped: numbers.length - orders.length };
}

async function renderInto(tab, build) {
  try {
    const url = URL.createObjectURL(await build());
    // Not revoked: the tab reads the blob for as long as it is open, and the
    // URL dies with the document that created it.
    if (tab) tab.location = url;
    else window.open(url, '_blank');
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/* ── entry points ────────────────────────────────────────────────────────── */

export async function printShippingLabels(rows, settings, { title = 'Shipping labels', guides = true } = {}) {
  const tab = window.open('', '_blank');
  const { orders, skipped } = await loadOrders(rows).catch((error) => {
    tab?.close();
    throw error;
  });

  await renderInto(tab, async () => {
    const [{ pdf }, { default: ShippingLabelPdf }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./shippingLabelPdf')
    ]);
    const brand = await resolveBrand(settings);
    return pdf(
      <ShippingLabelPdf labels={orders.map(orderToShippingLabel)} brand={brand} title={title} guides={guides} />
    ).toBlob();
  });

  return { printed: orders.length, skipped };
}

export async function printInvoices(rows, settings, { title = 'Invoices' } = {}) {
  const tab = window.open('', '_blank');
  const { orders, skipped } = await loadOrders(rows).catch((error) => {
    tab?.close();
    throw error;
  });

  await renderInto(tab, async () => {
    const [{ pdf }, { default: InvoicePdf }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./invoicePdf')
    ]);
    const brand = await resolveBrand(settings);
    return pdf(<InvoicePdf invoices={orders.map(orderToInvoice)} brand={brand} title={title} />).toBlob();
  });

  return { printed: orders.length, skipped };
}

/**
 * Both documents, as two PDFs in two tabs.
 *
 * Deliberately not one file: labels go on die-cut sticker stock and invoices on
 * plain A4, so they are two print jobs on two trays no matter how they arrive.
 * Both tabs are opened up front, in the same tick as the click, because a
 * browser only forgives popups it can still trace back to one.
 */
export async function printBoth(rows, settings) {
  const invoiceTab = window.open('', '_blank');
  const labelTab = window.open('', '_blank');

  const { orders, skipped } = await loadOrders(rows).catch((error) => {
    invoiceTab?.close();
    labelTab?.close();
    throw error;
  });

  const [{ pdf }, { default: InvoicePdf }, { default: ShippingLabelPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./invoicePdf'),
    import('./shippingLabelPdf')
  ]);
  const brand = await resolveBrand(settings);

  await renderInto(invoiceTab, () =>
    pdf(<InvoicePdf invoices={orders.map(orderToInvoice)} brand={brand} title="Invoices" />).toBlob()
  );
  await renderInto(labelTab, () =>
    pdf(<ShippingLabelPdf labels={orders.map(orderToShippingLabel)} brand={brand} title="Shipping labels" />).toBlob()
  );

  return { printed: orders.length, skipped };
}
