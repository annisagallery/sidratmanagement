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
import { alertError } from 'src/utils/swal';
import { MdPrint, MdClose, MdQrCode2 } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import SearchInput from 'src/components/_admin/ui/SearchInput';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';
import { Toggle } from 'src/components/_admin/ui/fields';
import * as api from 'src/services';
import useStickyState from 'src/hooks/useStickyState';
import PriceLabel, { LABEL_SHEET_CSS } from 'src/components/_admin/labels/PriceLabel';
import { PER_SHEET } from 'src/components/_admin/labels/labelSpec';
import { labelPrice, labelVariant, openLabelSheet } from 'src/components/_admin/labels/openLabelSheet';

const BASKET_KEY = 'admin:barcode-label-basket';

export default function ProductLabelBuilderPage() {
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

  const { data: results, isFetching, isError: searchFailed, error: searchError, refetch: retrySearch } = useQuery(
    ['label-product-search', query],
    () => api.getProductsByAdmin(`search=${encodeURIComponent(query)}&limit=20`),
    { enabled: query.trim().length > 1 },
  );

  const { data: openProduct, isError: productFailed, error: productError, refetch: retryProduct, isLoading: productLoading } = useQuery(
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
      alertError(error, { title: 'The label PDF was not built' });
    } finally {
      setBuilding(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LABEL_SHEET_CSS }} />

      <div className="no-print space-y-6">
        <PageHeader title="Barcode labels" subtitle={`Pick variations and quantities, then print. ${PER_SHEET} labels per A4 sheet.`}>
          <button
            type="button"
            onClick={print}
            disabled={!labels.length || building}
            title="Opens a print-ready PDF in a new tab"
            className="btn-brand"
          >
            <MdPrint size={18} aria-hidden /> {building ? 'Building PDF…' : `Print ${labels.length || ''} label${labels.length === 1 ? '' : 's'}`.replace('  ', ' ')}
          </button>
        </PageHeader>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            {/* Find a product */}
            <section className="card-ui p-5" aria-labelledby="labels-find">
              <h2 id="labels-find" className="text-[15px] font-semibold text-slate-900">
                Find a product
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">Search by name, code or barcode, then choose a product.</p>
              <SearchInput
                className="mt-4"
                placeholder="Search products"
                label="Search products for labels"
                onSearch={setQuery}
              />
              {isFetching ? (
                <p className="mt-3 text-[13px] text-slate-500" role="status">
                  Searching…
                </p>
              ) : null}
              {searchFailed && !isFetching ? (
                <div className="mt-4">
                  <ErrorState error={searchError} title="The search did not work" onRetry={retrySearch} />
                </div>
              ) : null}
              {(results?.data || []).length ? (
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Matching products">
                  {(results?.data || []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setOpenSlug(p.slug)}
                      aria-pressed={openSlug === p.slug}
                      className={`h-8 rounded-md border px-3 text-[13px] font-medium transition ${
                        openSlug === p.slug
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : query.trim().length > 1 && !isFetching ? (
                <p className="mt-3 text-[13px] text-slate-500">No products match “{query}”.</p>
              ) : null}
            </section>

            {/* Variations of the opened product */}
            {openSlug && productFailed ? (
              <ErrorState error={productError} title="This product could not be loaded" onRetry={retryProduct} />
            ) : openSlug && productLoading ? (
              <div className="card-ui h-48 animate-pulse" aria-busy="true" />
            ) : product ? (
              <section className="card-ui p-5" aria-labelledby="labels-variations">
                <h2 id="labels-variations" className="text-[15px] font-semibold text-slate-900">
                  {product.name}
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">Tick the variations to print and set how many of each.</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(product.variations || [])
                    .filter((v) => !v.deletedAt)
                    .map((variation) => {
                      const hasBarcode = Boolean(variation.primaryBarcode);
                      const isOn = Boolean(selected[variation.id]);
                      const name = labelVariant(variation) || 'Default';
                      return (
                        <div
                          key={variation.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                            !hasBarcode
                              ? 'border-dashed border-slate-300 bg-slate-50'
                              : isOn
                                ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                                : 'border-slate-200 bg-white'
                          }`}
                        >
                          <input
                            id={`label-var-${variation.id}`}
                            type="checkbox"
                            checked={isOn}
                            disabled={!hasBarcode}
                            onChange={() => toggle(variation)}
                            className="h-4 w-4 accent-slate-900"
                          />
                          <label htmlFor={`label-var-${variation.id}`} className="min-w-0 flex-1 cursor-pointer">
                            <span className="block truncate text-[13px] font-medium text-slate-900">{name}</span>
                            <span className={`block truncate font-mono text-xs ${hasBarcode ? 'text-slate-500' : 'text-amber-700'}`}>
                              {variation.primaryBarcode || 'No barcode yet — can’t be printed'}
                            </span>
                          </label>
                          {isOn ? (
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selected[variation.id].qty}
                              onChange={(e) => setQty(variation.id, e.target.value)}
                              aria-label={`Number of labels for ${name}`}
                              className="input-ui w-16 px-2 text-center tabular-nums"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </section>
            ) : (
              <div className="card-ui">
                <EmptyState
                  compact
                  icon={MdQrCode2}
                  title="Choose a product to see its variations"
                  hint="Labels are printed per variation, from its barcode."
                />
              </div>
            )}
          </div>

          {/* Print run */}
          <aside className="card-ui xl:sticky xl:top-0" aria-labelledby="labels-run">
            <div className="flex items-center justify-between gap-3 px-5 pt-5">
              <h2 id="labels-run" className="text-[15px] font-semibold text-slate-900">
                Print run
              </h2>
              {labels.length > 0 ? (
                <button type="button" onClick={() => setSelected({})} className="btn-quiet btn-sm -mr-2">
                  <MdClose size={16} aria-hidden /> Clear
                </button>
              ) : null}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-px border-y border-slate-200 bg-slate-200">
              <div className="bg-white px-5 py-3">
                <dt className="text-xs text-slate-500">Labels</dt>
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{labels.length}</dd>
              </div>
              <div className="bg-white px-5 py-3">
                <dt className="text-xs text-slate-500">A4 sheets</dt>
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{sheets}</dd>
              </div>
            </dl>
            {Object.keys(selected).length > 0 && (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto border-b border-slate-200" aria-label="Labels in this print run">
                {Object.entries(selected).map(([id, entry]) => (
                  <li key={id} className="flex items-center gap-2 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-900">{entry.name}</p>
                      <p className="truncate text-xs text-slate-500">{entry.variant || 'Default'}</p>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={entry.qty}
                      onChange={(e) => setQty(id, e.target.value)}
                      aria-label={`Number of labels for ${entry.name} ${entry.variant || ''}`.trim()}
                      className="input-ui w-16 px-2 text-center tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((prev) => {
                          const next = { ...prev };
                          delete next[id];
                          return next;
                        })
                      }
                      className="btn-icon btn-icon-sm"
                      aria-label={`Remove ${entry.name} ${entry.variant || ''} from the print run`.trim()}
                      title="Remove"
                    >
                      <MdClose size={16} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="divide-y divide-slate-100 px-5 py-2">
              <Toggle label="Show the price" help="On every label." checked={showPrice} onChange={setShowPrice} />
              <Toggle label="Print cut guides" help="Faint lines between labels." checked={showGuides} onChange={setShowGuides} />
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={print}
                disabled={!labels.length || building}
                className="btn-brand w-full"
                title="Opens a print-ready PDF in a new tab"
              >
                <MdPrint size={18} aria-hidden /> {building ? 'Building PDF…' : 'Print PDF'}
              </button>
              {!labels.length ? <p className="mt-2 text-center text-xs text-slate-500">Nothing selected yet.</p> : null}
            </div>
          </aside>
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
