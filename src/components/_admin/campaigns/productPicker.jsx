'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { FiX, FiSearch, FiLayers, FiTrash2 } from 'react-icons/fi';
import * as api from 'src/services';

// Picking the products a campaign covers.
//
// Modelled on the order panel's search (POSProductSearch in
// _admin/orders/createOrder): type, wait a beat, pick from a dropdown. The old
// version here needed the search box revealed first and had no way to see what
// was already added while searching.
//
// Two things a campaign needs that an order does not:
//
//   • Adding a whole category at once. A seasonal campaign is usually "every
//     abaya", and adding those one at a time is the actual work.
//   • Filtering what has already been added. Once a category lands you have
//     eighty rows, and the only way to find the three to drop is to filter.

const money = (value) => (value == null || value === '' ? '—' : `৳${Number(value).toLocaleString('en-BD')}`);

const asList = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);

// Query strings here are passed WITHOUT a leading "?": getProductsByAdmin and
// getCategoriesByAdmin both append one. Sending another makes the first key
// "?category" rather than "category", and the admin products endpoint answers
// an unrecognised filter with the whole catalogue.

function Thumb({ product, size = 36 }) {
  const path = product?.featuredImage?.path || product?.images?.[0]?.path;
  if (!path) return <div className="shrink-0 rounded-md bg-gray-100" style={{ width: size, height: size }} />;
  return (
    <Image
      src={path}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-md border object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export default function CampaignProductPicker({ products, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const timer = useRef(null);
  const wrapRef = useRef(null);

  const [categories, setCategories] = useState([]);
  useEffect(() => {
    let alive = true;
    api
      .getCategoriesByAdmin('limit=200')
      .then((res) => {
        if (alive) setCategories(asList(res));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const chosenIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  const addMany = useCallback(
    (incoming) => {
      const fresh = incoming.filter((p) => p?.id && !chosenIds.has(p.id));
      if (fresh.length) onChange([...products, ...fresh]);
      return fresh.length;
    },
    [products, chosenIds, onChange]
  );

  // ── Search ─────────────────────────────────────────────────────────────────

  const runSearch = useCallback(async (value) => {
    const search = value.trim();
    if (search.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const res = await api.getProductsByAdmin(`search=${encodeURIComponent(search)}&limit=10`);
      setResults(asList(res));
    } catch (e) {
      setResults([]);
      setError(e?.response?.data?.message || 'Could not search products');
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQuery = (e) => {
    const value = e.target.value;
    setQuery(value);
    setNote('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(value), 260);
  };

  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setResults([]);
    };
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      clearTimeout(timer.current);
    };
  }, []);

  // ── Add a whole category ───────────────────────────────────────────────────

  const addCategory = async () => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    setAddingCategory(true);
    setError('');
    setNote('');
    try {
      // limit is deliberately high: the point is to take the category in one
      // go, and a campaign that covers a category covers all of it.
      const res = await api.getProductsByAdmin(`category=${encodeURIComponent(category.slug)}&limit=500`);
      const found = asList(res);
      const added = addMany(found);
      setNote(
        added === 0
          ? `Every product in ${category.name} was already added.`
          : `Added ${added} product${added === 1 ? '' : 's'} from ${category.name}${
              added < found.length ? ` (${found.length - added} already there)` : ''
            }.`
      );
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load that category');
    } finally {
      setAddingCategory(false);
    }
  };

  // ── Added list ─────────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name || ''} ${p.slug || ''}`.toLowerCase().includes(q));
  }, [products, filter]);

  const remove = (id) => onChange(products.filter((p) => p.id !== id));

  // With a filter on, "remove all" clearing the whole list rather than the rows
  // on screen would be a nasty surprise, so it removes exactly what is shown
  // and says which it is doing. Two-step because one click can now undo adding
  // a 59-product category.
  const clearShown = () => {
    const doomed = new Set(visible.map((p) => p.id));
    onChange(products.filter((p) => !doomed.has(p.id)));
    setConfirmClear(false);
    setNote('');
    if (visible.length === products.length) setFilter('');
  };

  return (
    <div className="space-y-3 rounded-md border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Products ({products.length})</h2>

        {products.length > 0 &&
          (confirmClear ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">
                Remove {visible.length === products.length ? 'all' : 'these'} {visible.length}?
              </span>
              <button
                type="button"
                onClick={clearShown}
                className="rounded-md bg-red-500 px-2 py-1 font-semibold text-white transition hover:bg-red-600"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-md bg-gray-100 px-2 py-1 font-semibold text-gray-600 transition hover:bg-gray-200"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-red-500"
            >
              <FiTrash2 size={12} />
              {visible.length === products.length ? 'Remove all' : `Remove these ${visible.length}`}
            </button>
          ))}
      </div>

      {/* Search — always visible, the way the order panel does it */}
      <div ref={wrapRef} className="relative">
        <FiSearch className="pointer-events-none absolute left-3 top-3 text-gray-300" size={14} />
        <input
          value={query}
          onChange={handleQuery}
          placeholder="Search products by name…"
          className="w-full rounded-md border border-gray-200 py-2.5 pl-9 pr-24 text-sm placeholder-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
          autoComplete="off"
        />
        {searching && <span className="absolute right-3 top-3 animate-pulse text-xs text-gray-400">Searching…</span>}

        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-xl">
            {results.map((p) => {
              const already = chosenIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={already}
                  onClick={() => {
                    addMany([p]);
                    setQuery('');
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left last:border-0 hover:bg-[var(--brand-soft)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white"
                >
                  <Thumb product={p} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800">{p.name}</span>
                    <span className="text-[11px] text-gray-400">{money(p.price)}</span>
                  </span>
                  {already && <span className="shrink-0 text-[11px] font-medium text-gray-400">Added</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add a whole category */}
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-2.5">
        <FiLayers className="shrink-0 text-gray-400" size={14} />
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setNote('');
          }}
          className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
        >
          <option value="">Add a whole category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addCategory}
          disabled={!categoryId || addingCategory}
          className="btn-brand px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {addingCategory ? 'Adding…' : 'Add all'}
        </button>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {note && <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{note}</p>}

      {/* Filter only earns its place once the list is long enough to need it */}
      {products.length > 5 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter these ${products.length} products…`}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
        />
      )}

      {products.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
          No products added yet
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
          Nothing matches “{filter}”
        </p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {visible.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-md border border-gray-100 p-2">
              <Thumb product={p} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400">{money(p.price ?? p.priceSale)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="shrink-0 text-gray-300 transition hover:text-red-500"
                aria-label={`Remove ${p.name}`}
              >
                <FiX size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {filter && visible.length > 0 && (
        <p className="text-[11px] text-gray-400">
          Showing {visible.length} of {products.length}.
        </p>
      )}
    </div>
  );
}
