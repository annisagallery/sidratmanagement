'use client';

/**
 * The print desk — pick a dispatch run once, print what it needs.
 *
 * Labels and invoices used to be separate bulk actions on the orders list, and
 * briefly two separate pages. Both were wrong for the same reason: a dispatch
 * run needs the invoice AND the label for the same orders, so splitting them
 * made you select the same set twice and gave you two chances to select it
 * differently. One basket, three buttons.
 *
 * Every button produces a PDF. Nothing here renders a page for the browser to
 * print — see openDocuments.jsx for why that distinction matters.
 */

import { useState } from 'react';
import { useQuery } from 'react-query';
import { FiFileText, FiLayers, FiPrinter } from 'react-icons/fi';

import { useSiteSettings } from 'src/context/SiteSettingsContext';
import OrderPrintBuilder from 'src/components/_admin/orders/OrderPrintBuilder';
import { Notice, StatTile, errorAlert, qty, toast } from 'src/components/_admin/ui/primitives';
import {
  brandGaps,
  loadLogo,
  printBoth,
  printInvoices,
  printShippingLabels
} from 'src/components/_admin/dispatch/openDocuments';
import { PER_SHEET } from 'src/components/_admin/dispatch/shippingLabelGeometry';

export default function OrderPrintDeskPage() {
  const settings = useSiteSettings();
  const [busyKey, setBusyKey] = useState(null);
  const gaps = brandGaps(settings);

  /**
   * Load the logo up front, exactly the way a print will.
   *
   * A logo that is configured but unreadable used to become a lettermark with
   * no explanation — the browser paints it fine everywhere else on screen, so
   * there was nothing to notice until a printed sheet came out wrong. Probing
   * it here turns that into a sentence the operator can act on.
   */
  const logoQuery = useQuery(['dispatch-logo', settings?.logo], () => loadLogo(settings?.logo), {
    enabled: Boolean(settings?.logo),
    staleTime: 5 * 60_000
  });
  const logoFailure = logoQuery.data?.reason || null;

  /**
   * Print what loaded and say what did not. A sheet that is quietly one label
   * short is how a parcel ships without one.
   */
  const run = (key, task, failure) => async (rows) => {
    setBusyKey(key);
    try {
      const { skipped } = await task(rows, settings);
      if (skipped) {
        toast(
          `${skipped} order${skipped === 1 ? '' : 's'} could not be loaded and ${skipped === 1 ? 'was' : 'were'} left out`
        );
      }
    } catch (error) {
      errorAlert(failure, error);
    } finally {
      setBusyKey(null);
    }
  };

  const actions = [
    {
      key: 'both',
      label: 'Print both',
      icon: FiLayers,
      hint: 'Invoices and labels for the same orders, as two PDFs — they print on different paper.',
      busyLabel: 'Building both PDFs…',
      onClick: run('both', printBoth, 'The documents could not be built')
    },
    {
      key: 'labels',
      label: 'Print labels',
      icon: FiPrinter,
      hint: `${PER_SHEET} shipping labels to an A4 sheet.`,
      busyLabel: 'Building label PDF…',
      onClick: run('labels', printShippingLabels, 'The label sheet could not be built')
    },
    {
      key: 'invoices',
      label: 'Print invoices',
      icon: FiFileText,
      hint: 'One invoice per A4 page.',
      busyLabel: 'Building invoice PDF…',
      onClick: run('invoices', printInvoices, 'The invoices could not be built')
    }
  ];

  return (
    <OrderPrintBuilder
      eyebrow="Dispatch"
      title="Labels & invoices"
      subtitle="Pick the orders once, then print whichever documents the run needs. Everything opens as a PDF."
      busyKey={busyKey}
      actions={actions}
      stats={(selected) => (
        <>
          <StatTile
            label="Label sheets"
            value={qty(Math.ceil(selected.length / PER_SHEET) || 0)}
            note={`${PER_SHEET} labels per A4 sheet`}
            tone={selected.length ? 'good' : 'muted'}
          />
          <StatTile
            label="Invoice pages"
            value={qty(selected.length)}
            note="One per A4 page"
            tone={selected.length ? 'info' : 'muted'}
          />
        </>
      )}
      notice={
        <>
          {logoFailure ? (
            <Notice tone="bad" title="The logo will not appear on printed documents">
              A logo is set in Site Settings, but {logoFailure}. Documents fall back to a lettermark until this is
              fixed.
            </Notice>
          ) : null}
          {gaps.length ? (
            <Notice tone="warn" title="Some branding is missing from Site Settings">
              Documents still print, but with gaps:
              <ul className="mt-1 list-inside list-disc">
                {gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
        </>
      }
    />
  );
}
