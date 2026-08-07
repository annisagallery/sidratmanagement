'use client';

/**
 * Barcode label builder.
 *
 * Search a product, tick the variations you want, set a quantity for each, then
 * print. Splitting this from the per-product "Labels" button matters because a
 * print run is usually driven by a delivery or a stock count, not by one product
 * — you want size M of three different abayas on one sheet, not three sheets.
 *
 * Only variations with a stored barcode can be selected; the rest are shown but
 * disabled, so it is obvious WHICH item needs a barcode rather than the label
 * silently going missing from the sheet.
 */

import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { toast } from 'react-toastify';
import { MdSearch, MdPrint, MdClose } from 'react-icons/md';
import * as api from 'src/services';
import useStickyState from 'src/hooks/useStickyState';
import PriceLabel, { LABEL_SHEET_CSS } from 'src/components/_admin/labels/PriceLabel';
import { PER_SHEET } from 'src/components/_admin/labels/labelSpec';
import { labelPrice, labelVariant, openLabelSheet } from 'src/components/_admin/labels/openLabelSheet';

const BASKET_KEY = 'admin:barcode-label-basket';

export default function ProductLabelBuilderPage() {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [openSlug, setOpenSlug] = useState(null);
  // key: variationId -> { qty, name, variant, price, barcode }
  //
  // Persisted: a print run is usually assembled across several searches, and
  // stepping away to check a product used to discard the whole basket. Each
  // entry is already the finished label, so a restored basket prints exactly
  // what it shows.
  const [selected, setSelected] = useStickyState(BASKET_KEY, {});
  const [showPrice, setShowPrice] = useState(true);
  const [showGuides, setShowGuides] = useState(true);

  const { data: results, isFetching } = useQuery(
    ['label-product-search', query],
    () => api.getProductsByAdmin(`search=${encodeURIComponent(query)}&limit=20`),
    { enabled: query.trim().length > 1 },
  );

  const { data: openProduct } = useQuery(
    ['label-product', openSlug],
    () => api.getOneProductByAdmin(openSlug),
    { enabled: Boolean(openSlug) },
  );

  const product = openProduct?.data || null;

  const toggle = (variation) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[variation.id]) {
        delete next[variation.id];
        return next;
      }
      next[variation.id] = {
        qty: 1,
        name: product?.name,
        variant: labelVariant(variation),
        price: labelPrice(product, variation),
        barcode: variation.primaryBarcode,
      };
      return next;
    });
  };

  const setQty = (id, value) =>
    setSelected((prev) => ({ ...prev, [id]: { ...prev[id], qty: Math.max(0, Number(value) || 0) } }));

  const labels = useMemo(
    () => Object.values(selected).flatMap((entry) => Array.from({ length: entry.qty }).map(() => entry)),
    [selected],
  );
  const sheets = Math.ceil(labels.length / PER_SHEET) || 0;

  const [building, setBuilding] = useState(false);
  const print = async () => {
    setBuilding(true);
    try {
      await openLabelSheet(labels, { title: 'Barcode labels', showPrice, guides: showGuides });
    } catch (error) {
      toast.error(error?.message || 'The label PDF could not be built.');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LABEL_SHEET_CSS }} />

      <div className="no-print space-y-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Barcode labels</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Pick products and variations, set quantities, then print. 44 labels per A4 sheet.
          </p>
        </div>

        {/* Search */}
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(term);
            }}
            className="flex items-center gap-2"
          >
            <MdSearch size={18} className="text-gray-400 shrink-0" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search products by name, code or barcode…"
              className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
            <button type="submit" className="px-3 py-2 rounded-md border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Search
            </button>
          </form>

          {isFetching && <p className="mt-2 text-xs text-gray-400">Searching…</p>}

          <div className="mt-2 flex flex-wrap gap-2">
            {(results?.data || []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenSlug(p.slug)}
                className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition ${
                  openSlug === p.slug
                    ? 'border-[var(--brand-ring)] bg-[var(--brand-soft)] text-[var(--brand-strong)]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Variations of the opened product */}
        {product && (
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-800">{product.name}</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(product.variations || [])
                .filter((v) => !v.deletedAt)
                .map((variation) => {
                  const hasBarcode = Boolean(variation.primaryBarcode);
                  const isOn = Boolean(selected[variation.id]);
                  return (
                    <div
                      key={variation.id}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${
                        hasBarcode ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isOn}
                        disabled={!hasBarcode}
                        onChange={() => toggle(variation)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {labelVariant(variation) || 'Default'}
                        </p>
                        <p className="text-[11px] font-mono text-gray-400 truncate">
                          {variation.primaryBarcode || 'no barcode yet'}
                        </p>
                      </div>
                      {isOn && (
                        <input
                          type="number"
                          min="0"
                          value={selected[variation.id].qty}
                          onChange={(e) => setQty(variation.id, e.target.value)}
                          className="w-14 border border-gray-200 rounded-md px-1.5 py-1 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Basket + print */}
        <div className="rounded-md border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">
            {labels.length} label{labels.length === 1 ? '' : 's'}
            {sheets ? ` · ${sheets} sheet${sheets === 1 ? '' : 's'}` : ''}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Show price
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Cut guides
          </label>
          <div className="flex-1" />
          {labels.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected({})}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50"
            >
              <MdClose size={14} /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={print}
            disabled={!labels.length || building}
            title="Opens a print-ready PDF in a new tab"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--brand-ring)] bg-[var(--brand-soft)] text-[var(--brand-strong)] text-sm font-semibold disabled:opacity-40"
          >
            <MdPrint size={16} /> {building ? 'Building PDF…' : 'Print PDF'}
          </button>
        </div>
      </div>

      <div className={`sheet${showGuides ? '' : ' no-guides'}`}>
        {labels.map((item, i) => (
          <PriceLabel key={`${item.barcode}-${i}`} item={item} showPrice={showPrice} />
        ))}
      </div>
    </>
  );
}
