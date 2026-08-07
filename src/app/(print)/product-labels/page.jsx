'use client';

/**
 * Retail price label sheet — 44 per A4 (4 across x 11 down).
 *
 * Open as /product-labels?slug=<product-slug>. Every variation that has a stored
 * barcode gets a label; a per-variation quantity lets you print a run for one
 * size without reprinting the rest.
 *
 * The encoded value is the variation's primaryBarcode exactly as stored — see
 * the note in Barcode.jsx for why it is never rebuilt here.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from 'react-query';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import * as api from 'src/services';
import PriceLabel, { LABEL_SHEET_CSS } from 'src/components/_admin/labels/PriceLabel';
import { PER_SHEET } from 'src/components/_admin/labels/labelSpec';
import { labelVariant, openLabelSheet, retailLabels } from 'src/components/_admin/labels/openLabelSheet';

export default function ProductLabelsPage() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');
  const showGuides = searchParams.get('guides') !== '0';
  const showPrice = searchParams.get('price') !== '0';

  const { data, isLoading, isError } = useQuery(
    ['admin-product-labels', slug],
    () => api.getOneProductByAdmin(slug),
    { enabled: Boolean(slug) },
  );

  const product = data?.data || null;

  // Only variations that actually carry a barcode can be labelled.
  const printable = useMemo(
    () => (product?.variations || []).filter((v) => v?.primaryBarcode && !v?.deletedAt),
    [product],
  );

  const [quantities, setQuantities] = useState({});
  const qtyFor = (id) => {
    const raw = quantities[id];
    return raw === undefined ? 1 : Math.max(0, Number(raw) || 0);
  };

  // Expand each variation into one entry per copy requested.
  const labels = useMemo(
    () => retailLabels(product, printable, (variation) => qtyFor(variation.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [printable, quantities, product],
  );

  const sheets = Math.ceil(labels.length / PER_SHEET) || 0;

  const [building, setBuilding] = useState(false);
  const [failed, setFailed] = useState(null);
  const print = async () => {
    setBuilding(true);
    setFailed(null);
    try {
      await openLabelSheet(labels, {
        title: `${product?.name || 'Product'} labels`,
        showPrice,
        guides: showGuides,
      });
    } catch (error) {
      setFailed(error?.message || 'The label PDF could not be built.');
    } finally {
      setBuilding(false);
    }
  };

  // ?auto=1 is how another screen hands this sheet straight to the printer.
  const autoPrinted = useRef(false);
  useEffect(() => {
    if (autoPrinted.current || !labels.length || searchParams.get('auto') !== '1') return;
    autoPrinted.current = true;
    print();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.length, searchParams]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LABEL_SHEET_CSS }} />

      <div className="no-print" style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => window.history.back()} className="btn-ui">
            <FiArrowLeft /> Back
          </button>
          <button
            type="button"
            onClick={print}
            className="btn-ui"
            disabled={!labels.length || building}
            title="Opens a print-ready PDF in a new tab"
          >
            <FiPrinter /> {building ? 'Building PDF…' : 'Print PDF'}
          </button>
          <span style={{ fontSize: 13, color: '#475569' }}>
            {labels.length} label{labels.length === 1 ? '' : 's'}
            {sheets ? ` · ${sheets} A4 sheet${sheets === 1 ? '' : 's'} (44 per sheet)` : ''}
          </span>
        </div>

        {!slug && <p style={{ marginTop: 10, fontSize: 13, color: '#b91c1c' }}>Add ?slug=&lt;product-slug&gt; to the URL.</p>}
        {isLoading && <p style={{ marginTop: 10, fontSize: 13 }}>Loading…</p>}
        {isError && <p style={{ marginTop: 10, fontSize: 13, color: '#b91c1c' }}>Could not load this product.</p>}
        {failed && <p style={{ marginTop: 10, fontSize: 13, color: '#b91c1c' }}>{failed}</p>}
        {slug && !isLoading && !printable.length && (
          <p style={{ marginTop: 10, fontSize: 13, color: '#b45309' }}>
            No variation on this product has a barcode yet, so there is nothing to print.
          </p>
        )}

        {printable.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {printable.map((variation) => (
              <label key={variation.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ color: '#475569' }}>{labelVariant(variation) || variation.primaryBarcode}</span>
                <input
                  type="number"
                  min="0"
                  value={qtyFor(variation.id)}
                  onChange={(e) => setQuantities((q) => ({ ...q, [variation.id]: e.target.value }))}
                  style={{ width: 58, padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 4 }}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={`sheet${showGuides ? '' : ' no-guides'}`}>
        {labels.map((item, i) => (
          <PriceLabel key={`${item.barcode}-${i}`} item={item} showPrice={showPrice} />
        ))}
      </div>
    </>
  );
}
