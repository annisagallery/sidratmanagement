'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import Image from 'next/image';
import { FiAlertCircle, FiArrowLeft, FiCheck, FiChevronDown, FiCopy, FiEdit2, FiLock, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { toast as toastify } from 'react-toastify';
import { alertError, confirmAction, alertWarning } from 'src/utils/swal';
import { ErrorState } from 'src/components/_admin/ui/TableStates';
import * as api from 'src/services';
import { usePermissions } from 'src/context/PermissionsContext';
import { addressDistrict, addressUpazila, districts, upazilasForDistrict } from 'src/utils/bangladeshAddress';
import AdvancePaymentsPanel from './AdvancePaymentsPanel';

// Items, prices, discount and shipping can change only until packing starts —
// the server refuses them afterwards (services/orderWorkflow EDITABLE_ORDER_STATUSES).
const EDITABLE_ORDER_STATUSES = ['awaiting_payment', 'pending', 'confirmed', 'processing'];
// The delivery address is fixed once the parcel has left.
const ADDRESS_LOCKED_STATUSES = ['shipped', 'delivered', 'returned', 'cancelled'];
const BD_PHONE = /^01[3-9]\d{8}$/;

// ─── Delivery types — fixed labels, admin-configurable days ───────────────────
function daysHint(d) {
  return d === 0 ? 'Today' : `~${d} day${d === 1 ? '' : 's'}`;
}

function buildDeliveryTypes(s) {
  return [
    { key: 'regular', label: 'Regular', days: s?.regularDays ?? 7, hint: daysHint(s?.regularDays ?? 7) },
    { key: 'urgent', label: 'Urgent', days: s?.urgentDays ?? 2, hint: daysHint(s?.urgentDays ?? 2) },
    { key: 'sameDay', label: 'Same Day', days: s?.sameDayDays ?? 0, hint: daysHint(s?.sameDayDays ?? 0) }
  ];
}

const DEFAULT_DELIVERY_TYPES = buildDeliveryTypes(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `৳${Number(n || 0).toLocaleString('en-BD')}`;
const uid = () => Math.random().toString(36).slice(2, 10);

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().split('T')[0];
};

const normalizeList = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.products)) return res.data.products;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return [];
};

const attrValueName = (value) => value?.value || value?.valueName || value?.name || value;

const buildAttrOption = (attr = {}, attrName = '') => ({
  attribute: attr.attribute?.id || attr.attribute || null,
  attributeName: attr.attributeName || attr.name || attrName,
  value: attr.value?.id || attr.value || attr.id || null,
  valueName: attr.valueName || attr.value || attr.name || '',
  colorHex: attr.colorHex || null
});

const sortAttrOptions = (options = []) =>
  [...options].sort((a, b) =>
    String(a.valueName || '').localeCompare(String(b.valueName || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  );

const getAttrDimensions = (product = {}) => {
  const variations = product.variations || [];
  const map = {};

  variations.forEach((variation) => {
    (variation.attributes || []).forEach((attr) => {
      const name = attr.attributeName || attr.name;
      const value = attr.valueName || attr.value;
      if (!name || !value) return;
      if (!map[name]) {
        map[name] = { name, isVariation: true, options: new Map() };
      }
      map[name].options.set(value, buildAttrOption(attr, name));
    });
  });

  (product.attributes || []).forEach((entry) => {
    const name = entry.attributeName || entry.attribute?.name;
    if (!name || map[name]?.isVariation) return;
    if (!map[name]) {
      map[name] = { name, isVariation: false, options: new Map() };
    }
    (entry.values || []).forEach((value) => {
      const valueName = attrValueName(value);
      if (!valueName) return;
      map[name].options.set(valueName, {
        attribute: entry.attribute?.id || entry.attribute || null,
        attributeName: name,
        value: value?.id || value || null,
        valueName,
        colorHex: value?.colorHex || null
      });
    });
  });

  const dimensions = Object.values(map)
    .filter((dim) => (dim.name || '').toLowerCase() !== 'type')
    .map((dim) => {
      const options = sortAttrOptions([...dim.options.values()]);
      return { ...dim, options, values: options.map((option) => option.valueName) };
    });
  return [
    ...dimensions,
    {
      name: 'Type',
      isVariation: true,
      options: [
        { attribute: null, attributeName: 'Type', value: null, valueName: 'Standard', colorHex: null },
        { attribute: null, attributeName: 'Type', value: null, valueName: 'Custom', colorHex: null }
      ],
      values: ['Standard', 'Custom']
    }
  ];
};

const findVariation = (variations = [], attrs = {}) => {
  return (
    variations.find((variation) => {
      const vAttrs = variation.attributes || [];

      return vAttrs.every((attr) => {
        const name = attr.attributeName || attr.name;
        const value = attr.valueName || attr.value;
        return attrs[name] === value;
      });
    }) || null
  );
};

// "Type" (Standard / Custom) is this screen's switch for a custom piece; the
// order carries it as isCustom. It is only sent as an attribute for items that
// were saved with it before, so their stored selection still compares equal.
const selectedAttributesForOrder = (item = {}) =>
  (item.attrDimensions || [])
    .filter((dim) => dim.name !== 'Type' || item._serverHadType)
    .map((dim) => {
      const selected = item.selectedAttrs?.[dim.name];
      const option = (dim.options || []).find((opt) => opt.valueName === selected);
      return option || (selected ? { attributeName: dim.name, valueName: selected } : null);
    })
    .filter(Boolean);

const hasCustomSelection = (item = {}) => (item.selectedAttrs || {})['Type'] === 'Custom';

const normalizeOrderItemId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value.id || value.id || '');
  return String(value);
};

const normalizeOrderAttrs = (attrs = []) =>
  (attrs || [])
    .map((attr) => ({
      attributeName: attr.attributeName || attr.name || '',
      valueName: attr.valueName || attr.value || '',
      attribute: normalizeOrderItemId(attr.attribute),
      value: normalizeOrderItemId(attr.value),
    }))
    .sort((a, b) => `${a.attributeName}:${a.valueName}`.localeCompare(`${b.attributeName}:${b.valueName}`));

const orderItemSignature = (item = {}) =>
  JSON.stringify({
    productId: normalizeOrderItemId(item.productId),
    variationId: normalizeOrderItemId(item.selectedVariationId),
    qty: Number(item.qty || 1),
    regularPrice: Number(item.regularPrice || 0),
    salePrice: item.discountPrice == null || item.discountPrice === '' ? null : Number(item.discountPrice || 0),
    customizePrice: Number(item.customizePrice || 0),
    customizeDetails: String(item.customizeDetails || ''),
    isCustom: Boolean(hasCustomSelection(item) || item.isCustom),
    attributes: normalizeOrderAttrs(selectedAttributesForOrder(item)),
  });

const orderItemPayload = (item = {}) => ({
  variationId: item.selectedVariationId,
  pid: item.productId,
  attributes: selectedAttributesForOrder(item),
  quantity: Number(item.qty || 1),
  regularPrice: Number(item.regularPrice || 0),
  salePrice: item.discountPrice == null ? null : Number(item.discountPrice || 0),
  price: Number(getLineUnit(item) || 0),
  customizePrice: Number(item.customizePrice || 0),
  customizeDetails: item.customizeDetails || null,
  isCustom: hasCustomSelection(item) || Boolean(item.isCustom),
});

const pickPrice = (product, variation) => {
  const baseRegular = product.price ?? product.regularPrice ?? 0;
  const baseDiscount = product.priceSale ?? product.salePrice ?? null;

  const regularPrice = variation?.regularPrice ?? variation?.price ?? baseRegular;
  const discountPrice =
    variation?.salePrice ??
    variation?.discountPrice ??
    (baseDiscount != null && Number(baseDiscount) < Number(regularPrice) ? baseDiscount : null);

  return { regularPrice, discountPrice, baseRegular, baseDiscount };
};

const availableForVariation = (variation = {}) =>
  variation.available != null
    ? Number(variation.available)
    : Number(variation.presaleAvailable || (variation.overSale ? 999999 : 0));

const buildItem = (product) => {
  const variations = product.variations || [];
  const firstVariation = variations.find((variation) => availableForVariation(variation) > 0) || variations[0] || null;
  const attrDimensions = getAttrDimensions(product);
  const selectedAttrs = {};

  attrDimensions.forEach((dim) => {
    const variationAttr = firstVariation?.attributes?.find((attr) => (attr.attributeName || attr.name) === dim.name);
    const value = variationAttr ? variationAttr.valueName || variationAttr.value : dim.options?.[0]?.valueName;
    if (value) selectedAttrs[dim.name] = value;
  });

  const prices = pickPrice(product, firstVariation);

  return {
    _key: uid(), // Always unique: same product can be added multiple times.
    productId: product.id || product.id,
    productName: product.name || product.title || 'Untitled product',
    productSlug: product.slug,
    variations,
    attrDimensions,
    selectedAttrs,
    selectedVariationId: firstVariation?.id || firstVariation?.id || null,
    baseRegular: prices.baseRegular,
    baseDiscount: prices.baseDiscount,
    regularPrice: Number(prices.regularPrice || 0),
    discountPrice: prices.discountPrice != null ? Number(prices.discountPrice) : null,
    catalogRegular: Number(prices.regularPrice || 0),
    catalogDiscount: prices.discountPrice != null ? Number(prices.discountPrice) : null,
    stock: Math.max(0, availableForVariation(firstVariation) - Number(firstVariation?.presaleAvailable || 0)),
    overSale: Boolean(firstVariation?.overSale ?? product.overSale),
    availableQuantity: availableForVariation(firstVariation),
    preorderCapacity: firstVariation?.preorderCapacity ?? null,
    qty: 1,
    customizeDetails: '',
    customizePrice: 0,
    isCustom: false
  };
};

const getCustomerAddress = (customer = {}, fallbackPhone = '') => {
  const saved = customer.shippingAddress || customer.defaultAddress || customer.addresses?.[0] || {};

  return {
    name: saved.name || customer.name || '',
    phone: saved.phone || customer.phone || fallbackPhone || '',
    district: addressDistrict(saved),
    upazila: addressUpazila(saved),
    address: saved.address || customer.address || ''
  };
};

// A price other than the catalogue's for the chosen variation needs the
// "override item prices" permission on the server.
const isPriceOverridden = (item) =>
  Number(item.regularPrice || 0) !== Number(item.catalogRegular ?? item.regularPrice ?? 0) ||
  (item.discountPrice ?? null) !== (item.catalogDiscount ?? null);

const getLineUnit = (item) => {
  const base =
    item.discountPrice != null && item.discountPrice !== ''
      ? Number(item.discountPrice)
      : Number(item.regularPrice || 0);
  return base + Number(item.customizePrice || 0);
};

const uploadAdminNoteImages = async (images = []) => {
  const files = images.map((img) => img.file).filter(Boolean);
  if (!files.length) return [];

  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('model', 'admin-order-notes');
  return api.uploadImages(formData);
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
const inp =
  'input-ui w-full';
// Compact inputs for the item grid, where a row holds seven controls.
const sm = 'input-ui h-8 px-2 text-[13px] sm:text-[13px]';
// Desk cart fields carry their name inside the box ("Color  Bluish Ash"), so
// the label sits next to its value instead of in a row of small print above.
// They are see-through, taking the white or grey of the card they sit on.
const lineField =
  'flex h-7 items-center gap-1.5 rounded-md border border-slate-300/80 bg-transparent px-2 transition hover:border-slate-400 focus-within:!border-[var(--brand-strong)] focus-within:shadow-[0_0_0_3px_var(--brand-ring)]';
const lineLabel = 'shrink-0 text-xs text-slate-500';
const lineControl =
  'h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed';
// The desk's order panel uses the same named-box fields, a step taller.
const deskField =
  'flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 transition hover:border-slate-300 focus-within:!border-[var(--brand-strong)] focus-within:shadow-[0_0_0_3px_var(--brand-ring)]';

function DeskField({ label, required = false, invalid = false, className = '', children }) {
  return (
    <label className={`${deskField} ${invalid ? '!border-rose-400' : ''} ${className}`}>
      <span className="shrink-0 text-xs text-slate-500">
        {label}
        {required ? (
          <span className="ml-0.5 text-rose-700" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

// The order desk packs every section onto one screen; sections read this to
// tighten their own spacing. The edit screen keeps the roomy layout.
const Compact = createContext(false);

function Card({ title, description, action, children, className = '' }) {
  const compact = useContext(Compact);
  if (compact) {
    return (
      <section className={`card-ui ${className}`}>
        {title && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {action}
          </div>
        )}
        <div className="p-4">{children}</div>
      </section>
    );
  }
  return (
    <section className={`card-ui ${className}`}>
      {title && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] text-slate-500">{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

function Label({ children, required, htmlFor }) {
  const compact = useContext(Compact);
  return (
    <label htmlFor={htmlFor} className={compact ? 'mb-1 block text-xs font-medium text-slate-700' : 'mb-1.5 block text-[13px] font-medium text-slate-800'}>
      {children}
      {required && (
        <span className="ml-0.5 text-rose-700" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

function FieldError({ children, id }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-[13px] font-medium text-rose-700" role="alert">
      {children}
    </p>
  );
}

// ─── Product Search ──────────────────────────────────────────────────────────
function POSProductSearch({ onAdd, autoFocus = false, large = false }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const timer = useRef(null);
  const wrapRef = useRef(null);

  const searchProducts = useCallback(async (value) => {
    const search = value.trim();
    if (!search) {
      setResults([]);
      setBusy(false);
      setError('');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const params = new URLSearchParams({ search, limit: '10' }).toString();
      const res = await api.getProductsByAdmin(params);
      setResults(normalizeList(res));
      setActive(0);
    } catch (e) {
      setResults([]);
      setError(e?.response?.data?.message || 'Could not search products');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => searchProducts(value), 260);
  };

  const pick = async (product) => {
    setQ('');
    setResults([]);
    setBusy(true);
    setError('');

    try {
      const full =
        product.slug && typeof api.getOneProductByAdmin === 'function'
          ? await api.getOneProductByAdmin(product.slug)
          : null;
      onAdd(buildItem(full?.data || product));
    } catch (_) {
      onAdd(buildItem(product));
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setResults([]);
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active] || results[0]);
    }
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

  return (
    <div ref={wrapRef} className="relative">
      <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} aria-hidden />
      <input
        value={q}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search products by name or code — ↑↓ to choose, Enter to add"
        autoFocus={autoFocus}
        className={`${inp} h-10 pl-9`}
        autoComplete="off"
        role="combobox"
        aria-label="Search products to add"
        aria-expanded={results.length > 0}
        aria-controls="order-product-results"
        aria-activedescendant={results.length ? `order-product-${active}` : undefined}
      />

      {busy && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500" role="status">
          Searching…
        </span>
      )}

      {error && <p className="mt-1.5 text-[13px] font-medium text-rose-700">{error}</p>}

      {results.length > 0 && (
        <div
          id="order-product-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-[99] mt-1 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {results.map((product, index) => {
            const key = product.id || product.id || product.slug;
            const stock =
              product.stock ??
              product.quantity ??
              product.variations?.reduce((s, v) => s + availableForVariation(v), 0);

            return (
              <button
                key={key}
                id={`order-product-${index}`}
                role="option"
                aria-selected={index === active}
                type="button"
                onClick={() => pick(product)}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm ${
                  index === active ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{product.name || product.title}</p>
                  <p className="text-xs text-slate-500">{stock ?? '—'} in stock</p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-700">
                  {fmt(product.price || product.regularPrice)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Products Table ──────────────────────────────────────────────────────────
function ItemsTable({ items, onUpdate, onRemove, onDuplicate, locked = false, canOverridePrice = true, missing = false }) {
  const compact = useContext(Compact);
  const updateAttrs = (item, attrName, value) => {
    let selectedAttrs = { ...item.selectedAttrs, [attrName]: value };
    const isCustom = selectedAttrs['Type'] === 'Custom';

    // When switching Type back to Standard, reset any attr values that were set to 'Custom'
    if (!isCustom) {
      item.attrDimensions.forEach((dim) => {
        if (dim.name !== 'Type' && selectedAttrs[dim.name] === 'Custom') {
          selectedAttrs[dim.name] = dim.values[0] || '';
        }
      });
    }

    const matched = findVariation(item.variations, selectedAttrs);
    const prices = pickPrice({ price: item.baseRegular, priceSale: item.baseDiscount }, matched || undefined);

    onUpdate(item._key, {
      selectedAttrs,
      selectedVariationId: matched?.id || matched?.id || item.selectedVariationId || null,
      regularPrice: Number(prices.regularPrice || item.baseRegular || 0),
      discountPrice: prices.discountPrice != null ? Number(prices.discountPrice) : null,
      catalogRegular: Number(prices.regularPrice || item.baseRegular || 0),
      catalogDiscount: prices.discountPrice != null ? Number(prices.discountPrice) : null,
      stock: isCustom ? 0 : Math.max(0, availableForVariation(matched) - Number(matched?.presaleAvailable || 0)),
      overSale: isCustom ? true : Boolean(matched?.overSale ?? item.overSale),
      isCustom,
      availableQuantity: isCustom ? null : availableForVariation(matched),
      preorderCapacity: matched?.preorderCapacity ?? null
    });
  };

  if (!items.length) {
    return (
      <div
        className={`rounded-lg border border-dashed px-4 text-center ${compact ? 'm-3 py-6' : 'py-10'} ${
          missing ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300 bg-slate-50'
        }`}
      >
        <p className={`text-sm font-semibold ${missing ? 'text-rose-700' : 'text-slate-900'}`}>No products added yet</p>
        <p className="mt-1 text-[13px] text-slate-500">Search above and press Enter, or click a product.</p>
      </div>
    );
  }

  return (
    compact ? (
      // The desk's cart: one card per line, every other card shaded. Each
      // field carries its name inside it, so there is no row of tiny labels;
      // the money reads as a sum — price × quantity = total — with every
      // total in the same right-hand column. Custom pieces have a violet edge.
      // Newest first, on screen only: the order keeps its lines in the order
      // they were added, and each card keeps that line number.
      <ol className="space-y-1.5 p-2" aria-label="Products in this order, newest first">
        {[...items].reverse().map((item, index) => {
          const lineNo = items.length - index;
          const isTypeCustom = item.selectedAttrs['Type'] === 'Custom';
          const lineTotal = getLineUnit(item) * Number(item.qty || 1);
          const totalAvailable =
            item.availableQuantity == null ? (item.overSale ? null : item.stock) : Number(item.availableQuantity);
          const stockLabel = isTypeCustom
            ? 'Made to order'
            : item.stock > 0
              ? `${item.stock} in stock${totalAvailable != null && totalAvailable > item.stock ? ` · +${totalAvailable - item.stock} to make` : ''}`
              : totalAvailable == null
                ? 'To make'
                : totalAvailable > 0
                  ? `${totalAvailable} to make`
                  : 'Out of stock';
          const stockTone = isTypeCustom
            ? 'text-violet-700'
            : item.stock > 0
              ? 'text-emerald-700'
              : item.overSale
                ? 'text-amber-700'
                : 'text-rose-700';
          const priceLocked = locked || !canOverridePrice;
          const priceChanged = isPriceOverridden(item);
          const nonTypeDims = item.attrDimensions.filter((d) => d.name !== 'Type');

          return (
            <li
              key={item._key}
              className={`rounded-lg border border-l-[3px] border-slate-300 py-1.5 pl-1.5 pr-2 ${index % 2 ? 'bg-slate-100' : 'bg-white'} ${
                isTypeCustom ? 'border-l-violet-500' : 'border-l-slate-300'
              }`}
            >
              {/* Which product, and what kind */}
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-slate-400">{lineNo}.</span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="max-w-full truncate text-sm font-semibold text-slate-900" title={item.productName}>
                    {item.productName}
                  </p>
                  <div className="flex items-center gap-x-2 text-xs">
                    <button
                      type="button"
                      disabled={locked}
                      aria-pressed={isTypeCustom}
                      title={isTypeCustom ? 'Made to order — switch back to standard' : 'Switch to a custom, made-to-order piece'}
                      onClick={() => updateAttrs(item, 'Type', isTypeCustom ? 'Standard' : 'Custom')}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-px font-medium ring-1 ring-inset ${
                        isTypeCustom ? 'bg-violet-50 text-violet-800 ring-violet-600/20' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isTypeCustom ? 'bg-violet-500' : 'bg-slate-400'}`} aria-hidden />
                      {isTypeCustom ? 'Custom' : 'Standard'}
                    </button>
                    <span className={stockTone}>{stockLabel}</span>
                  </div>
                </div>
                {locked ? null : (
                  <div className="flex shrink-0 gap-0.5">
                    <button type="button" onClick={() => onDuplicate(item._key)} className="btn-icon btn-icon-sm !h-7 !w-7" title="Duplicate" aria-label={`Duplicate ${item.productName}`}>
                      <FiCopy size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item._key)}
                      className="btn-icon btn-icon-sm btn-icon-danger !h-7 !w-7"
                      title="Remove"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <FiTrash2 size={14} aria-hidden />
                    </button>
                  </div>
                )}
              </div>

              {/* Options, then the sum */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-8">
                {nonTypeDims.length ? (
                  <div className="flex max-w-full shrink-0 flex-wrap gap-1.5">
                    {nonTypeDims.map((dim) => {
                      const values = isTypeCustom && !dim.values.includes('Custom') ? [...dim.values, 'Custom'] : dim.values;
                      return (
                        <label key={dim.name} className={`${lineField} shrink-0 ${locked ? 'bg-slate-50' : ''}`}>
                          <span className={lineLabel}>{dim.name}</span>
                          <select
                            value={item.selectedAttrs[dim.name] || ''}
                            onChange={(e) => updateAttrs(item, dim.name, e.target.value)}
                            disabled={locked}
                            className={`${lineControl} !w-auto !flex-none cursor-pointer pr-1 font-medium`}
                          >
                            {values.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="flex-1 text-xs text-slate-400">No options</p>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <label
                    className={`${lineField} w-[108px] ${priceLocked ? 'bg-slate-50' : ''}`}
                    title={!canOverridePrice ? 'You do not have permission to change prices' : undefined}
                  >
                    <span className={lineLabel}>Regular</span>
                    <input
                      type="number"
                      min="0"
                      value={item.regularPrice ?? ''}
                      onChange={(e) => onUpdate(item._key, { regularPrice: Number(e.target.value) || 0 })}
                      readOnly={priceLocked}
                      className={`${lineControl} text-right tabular-nums ${priceLocked ? 'text-slate-500' : ''}`}
                    />
                  </label>
                  <label
                    className={`${lineField} w-[96px] ${priceLocked ? 'bg-slate-50' : ''} ${priceChanged ? '!border-amber-400' : ''}`}
                    title={priceChanged ? 'Changed from the catalogue price' : undefined}
                  >
                    <span className={priceChanged ? 'shrink-0 text-xs font-medium text-amber-700' : lineLabel}>Sale</span>
                    <input
                      type="number"
                      min="0"
                      value={item.discountPrice ?? ''}
                      onChange={(e) => onUpdate(item._key, { discountPrice: e.target.value === '' ? null : Number(e.target.value) || 0 })}
                      readOnly={priceLocked}
                      placeholder="—"
                      className={`${lineControl} text-right tabular-nums ${priceLocked ? 'text-slate-500' : ''}`}
                    />
                    {priceChanged ? <span className="sr-only">Changed from the catalogue price</span> : null}
                  </label>
                  <span className="text-sm text-slate-400" aria-hidden>
                    ×
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={totalAvailable == null ? undefined : Math.max(1, totalAvailable)}
                    value={item.qty}
                    onChange={(e) => onUpdate(item._key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    disabled={locked}
                    aria-label={`Quantity of ${item.productName}`}
                    className={`${sm} !h-7 !w-14 !border-slate-300/80 !bg-transparent !px-1.5 text-center tabular-nums !shadow-none hover:!border-slate-400`}
                  />
                  <span className="text-sm text-slate-400" aria-hidden>
                    =
                  </span>
                  <span className="w-20 text-right text-[15px] font-semibold tabular-nums text-slate-900">{fmt(lineTotal)}</span>
                </div>
              </div>

              {isTypeCustom ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-8">
                  <label className={`${lineField} min-w-[220px] flex-1 ${locked ? 'bg-slate-50' : ''}`}>
                    <span className={lineLabel}>Measurements</span>
                    <input
                      value={item.customizeDetails}
                      onChange={(e) => onUpdate(item._key, { customizeDetails: e.target.value })}
                      disabled={locked}
                      placeholder="Chest, length, sleeves and any instructions for production"
                      className={lineControl}
                    />
                  </label>
                  <label className={`${lineField} ml-auto w-[150px] ${locked ? 'bg-slate-50' : ''}`}>
                    <span className={lineLabel}>Custom +</span>
                    <input
                      type="number"
                      min="0"
                      value={item.customizePrice || ''}
                      onChange={(e) => onUpdate(item._key, { customizePrice: Number(e.target.value) || 0 })}
                      placeholder="0"
                      disabled={locked}
                      className={`${lineControl} text-right tabular-nums`}
                    />
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    ) : (
    <div className="admin-sidebar-scroll overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[960px] border-collapse text-[13px]">
        <caption className="sr-only">Products in this order</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
            <th scope="col" className="w-10 py-2.5 pl-3 pr-1 text-right">#</th>
            <th scope="col" className="w-44 px-3 py-2.5 text-left">Product</th>
            <th scope="col" className="px-3 py-2.5 text-left">Options</th>
            <th scope="col" className="w-28 px-3 py-2.5 text-center">Stock</th>
            <th scope="col" className="w-24 px-3 py-2.5 text-right">Regular</th>
            <th scope="col" className="w-24 px-3 py-2.5 text-right">Sale</th>
            <th scope="col" className="w-24 px-3 py-2.5 text-right">Custom +</th>
            <th scope="col" className="w-20 px-3 py-2.5 text-center">Qty</th>
            <th scope="col" className="w-28 px-3 py-2.5 text-right">Total</th>
            <th scope="col" className="w-20 px-3 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => {
            const isTypeCustom = item.selectedAttrs['Type'] === 'Custom';
            const lineTotal = getLineUnit(item) * Number(item.qty || 1);
            // Shade every other product, both of its rows together.
            const stripe = index % 2 ? 'bg-slate-100/70' : 'bg-white';
            const totalAvailable =
              item.availableQuantity == null ? (item.overSale ? null : item.stock) : Number(item.availableQuantity);
            // In stock now, and how many more production can make.
            const stockLabel = isTypeCustom
              ? 'Made to order'
              : item.stock > 0
                ? `${item.stock} in stock${totalAvailable != null && totalAvailable > item.stock ? ` · +${totalAvailable - item.stock} to make` : ''}`
                : totalAvailable == null
                  ? 'To make'
                  : totalAvailable > 0
                    ? `${totalAvailable} to make`
                    : 'Out of stock';
            const priceChanged = isPriceOverridden(item);
            const priceLocked = locked || !canOverridePrice;
            const stockTone = isTypeCustom
              ? 'bg-violet-50 text-violet-800 ring-violet-600/20'
              : item.stock > 0
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                : item.overSale
                  ? 'bg-amber-50 text-amber-800 ring-amber-600/20'
                  : 'bg-rose-50 text-rose-700 ring-rose-600/20';

            return (
              <React.Fragment key={item._key}>
                <tr className={`border-t border-slate-100 align-top ${stripe}`}>
                  <td rowSpan={2} className="py-2 pl-3 pr-1 pt-3 text-right align-top text-xs font-medium tabular-nums text-slate-500">
                    {index + 1}
                  </td>
                  <td rowSpan={2} className="px-2 py-2 align-top">
                    <p className="text-sm font-semibold leading-tight text-slate-900">{item.productName}</p>
                    <button
                      type="button"
                      disabled={locked}
                      aria-pressed={isTypeCustom}
                      title={isTypeCustom ? 'Made to order — switch back to standard' : 'Switch to a custom, made-to-order piece'}
                      onClick={() => updateAttrs(item, 'Type', isTypeCustom ? 'Standard' : 'Custom')}
                      className={`mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${isTypeCustom ? 'bg-violet-50 text-violet-800 ring-violet-600/20' : 'bg-slate-100 text-slate-700 ring-slate-500/10 hover:bg-slate-200'}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full transition-colors ${isTypeCustom ? 'bg-[var(--brand)]' : 'bg-slate-300'}`}
                      />
                      {isTypeCustom ? 'Custom' : 'Standard'}
                    </button>
                  </td>

                  <td className="px-2 py-2 align-top">
                    {(() => {
                      const nonTypeDims = item.attrDimensions.filter((d) => d.name !== 'Type');
                      if (!nonTypeDims.length)
                        return <span className="text-xs italic text-slate-400">No options</span>;
                      return (
                        <div className="flex flex-nowrap items-center gap-1.5">
                          {nonTypeDims.map((dim) => {
                            const values =
                              isTypeCustom && !dim.values.includes('Custom') ? [...dim.values, 'Custom'] : dim.values;
                            return (
                              <div key={dim.name} className="min-w-[96px] flex-1">
                                <select
                                  value={item.selectedAttrs[dim.name] || ''}
                                  onChange={(e) => updateAttrs(item, dim.name, e.target.value)}
                                  title={dim.name}
                                  disabled={locked}
                                  className={`${sm} h-8 py-0 text-xs font-medium text-slate-700`}
                                >
                                  {values.map((value) => (
                                    <option key={value} value={value}>
                                      {dim.name}: {value}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </td>

                  <td className="px-2 py-2 text-center align-top">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium leading-snug ring-1 ring-inset ${stockTone}`}>
                      {stockLabel}
                    </span>
                  </td>

                  <td className="px-2 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      value={item.regularPrice ?? ''}
                      onChange={(e) => onUpdate(item._key, { regularPrice: Number(e.target.value) || 0 })}
                      readOnly={priceLocked}
                      title={!canOverridePrice ? 'You do not have permission to change prices' : undefined}
                      className={`${sm} h-8 w-full text-right text-xs ${priceLocked ? 'bg-slate-50 text-slate-500' : ''}`}
                    />
                  </td>

                  <td className="px-2 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      value={item.discountPrice ?? ''}
                      onChange={(e) =>
                        onUpdate(item._key, {
                          discountPrice: e.target.value === '' ? null : Number(e.target.value) || 0
                        })
                      }
                      readOnly={priceLocked}
                      placeholder="—"
                      className={`${sm} h-8 w-full text-right text-xs ${priceLocked ? 'bg-slate-50 text-slate-500' : ''}`}
                    />
                    {priceChanged ? (
                      <span className="mt-1 block text-xs font-medium text-amber-700">Price changed</span>
                    ) : null}
                  </td>

                  <td className="px-2 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      value={item.customizePrice || ''}
                      onChange={(e) => onUpdate(item._key, { customizePrice: Number(e.target.value) || 0 })}
                      placeholder={isTypeCustom ? 'Extra' : '—'}
                      disabled={!isTypeCustom || locked}
                      className={`${sm} h-8 w-full text-right text-xs`}
                    />
                  </td>

                  <td className="px-2 py-2 text-center align-top">
                    <input
                      type="number"
                      min="1"
                      max={totalAvailable == null ? undefined : Math.max(1, totalAvailable)}
                      value={item.qty}
                      onChange={(e) => onUpdate(item._key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      disabled={locked}
                      className={`${sm} h-8 w-full text-center text-xs`}
                    />
                  </td>

                  <td className="px-2 py-2 text-right align-top">
                    <p className="pt-1.5 text-sm font-semibold tabular-nums text-slate-900">{fmt(lineTotal)}</p>
                    {Number(item.qty || 1) > 1 ? (
                      <p className="text-xs text-slate-500">{fmt(getLineUnit(item))} each</p>
                    ) : null}
                  </td>

                  <td className="px-2 py-2 text-center align-top">
                    {locked ? null : (
                      <div className="flex justify-center gap-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onDuplicate(item._key)}
                          className="btn-icon btn-icon-sm"
                          title="Duplicate item"
                          aria-label="Duplicate item"
                        >
                          <FiCopy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(item._key)}
                          className="btn-icon btn-icon-sm btn-icon-danger"
                          title="Remove item"
                          aria-label="Remove item"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                <tr className={`border-b border-slate-100 align-top ${stripe}`}>
                  <td colSpan={8} className="px-2 pb-2 pt-0">
                    {isTypeCustom ? (
                      <input
                        value={item.customizeDetails}
                        onChange={(e) => onUpdate(item._key, { customizeDetails: e.target.value })}
                        disabled={locked}
                        placeholder="Measurements and instructions for production"
                        aria-label={`Custom details for ${item.productName}`}
                        className={`${sm} w-full`}
                      />
                    ) : null}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    )
  );
}

// ─── Admin Note ───────────────────────────────────────────────────────────────
function AdminNote({ value, onChange, images, onImagesChange }) {
  const inputRef = useRef(null);

  const addFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    onImagesChange([
      ...images,
      ...files.map((file) => ({ id: uid(), file, preview: URL.createObjectURL(file), name: file.name }))
    ]);

    e.target.value = '';
  };

  const removeImage = (id) => {
    const img = images.find((x) => x.id === id);
    if (img?.preview) URL.revokeObjectURL(img.preview);
    onImagesChange(images.filter((imgItem) => imgItem.id !== id));
  };

  useEffect(() => {
    return () => images.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compact = useContext(Compact);
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <textarea
        rows={compact ? 2 : 4}
        autoFocus={compact}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Anything the team should know about this order"
        aria-label="First internal note"
        className={`${inp} resize-none`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {images.map((img) => (
          <div
            key={img.id}
            className={`group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50 ${compact ? 'h-10 w-10' : 'h-16 w-16'}`}
          >
            <Image src={img.preview} alt={img.name || 'Admin note'} fill className="object-cover" />
            <button
              type="button"
              onClick={() => removeImage(img.id)}
              aria-label={`Remove ${img.name || 'image'}`}
              title="Remove image"
              className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-xl text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Attach an image"
          className={
            compact
              ? 'btn-ghost btn-sm'
              : 'flex h-16 w-16 flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-slate-400 hover:text-slate-800'
          }
        >
          {compact ? (
            '+ Attach image'
          ) : (
            <>
              <span className="text-2xl leading-none" aria-hidden>+</span>
              <span className="mt-0.5 text-xs">Image</span>
            </>
          )}
        </button>

        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />
      </div>
    </div>
  );
}

// ─── Customer Section ─────────────────────────────────────────────────────────
function CustomerSection({ address, onCustomerChange, onAddressChange, onFraudData, onShippingChange, addressLocked = false, errors = {} }) {
  const compact = useContext(Compact);
  const [phone, setPhone] = useState(address.phone || '');
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrIdx, setSelectedAddrIdx] = useState(0);
  const [showAddrList, setShowAddrList] = useState(false);
  const requestRef = useRef(0);
  const addrWrapRef = useRef(null);
  // The zone's shipping charge is filled in when someone picks a district or
  // upazila — not when an existing order loads, which silently replaced the
  // charge that order was saved with.
  const areaChangedByUser = useRef(false);
  const upazilas = upazilasForDistrict(address.district);

  // Close address dropdown when clicking outside
  useEffect(() => {
    const close = (e) => {
      if (addrWrapRef.current && !addrWrapRef.current.contains(e.target)) setShowAddrList(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Auto-populate shipping charge when district + upazila are both set
  useEffect(() => {
    const { district, upazila } = address;
    if (!areaChangedByUser.current) return;
    if (!district || !upazila || typeof onShippingChange !== 'function') return;
    let cancelled = false;
    api
      .getShippingCharge(district, upazila)
      .then((res) => {
        if (!cancelled && res?.charge != null) onShippingChange(res.charge);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address.district, address.upazila]); // eslint-disable-line

  const handleDistrictChange = (district) => {
    areaChangedByUser.current = true;
    onAddressChange({ ...address, district, upazila: '' });
  };

  const handleUpazilaChange = (upazila) => {
    areaChangedByUser.current = true;
    onAddressChange({ ...address, upazila });
  };

  // Courier delivery history for this number (Pathao / Steadfast / CarryBee).
  // Slow third-party calls, so it loads beside the lookup rather than in it.
  const loadCourierHistory = useCallback((q, id) => {
    onFraudData({ loading: true });
    api
      .fraudCheck(encodeURIComponent(q))
      .then((res) => {
        if (id === requestRef.current) onFraudData(res || null);
      })
      .catch((err) => {
        if (id === requestRef.current) onFraudData({ errors: err?.response?.data?.errors || { all: 'Courier check failed' } });
      });
  }, [onFraudData]);

  const doLookup = useCallback(
    async (phoneOverride) => {
      const q = (phoneOverride !== undefined ? phoneOverride : phone).trim();
      if (q.length < 7) return;

      const id = ++requestRef.current;
      setLoading(true);

      onCustomerChange(null);
      onFraudData(null);
      onAddressChange({ name: '', phone: '', district: '', upazila: '', address: '' });
      setSavedAddresses([]);
      setSelectedAddrIdx(-1);
      setShowAddrList(false);

      loadCourierHistory(q, id);
      try {
        const res = await api.lookupCustomerByAdmin(q);
        if (id !== requestRef.current) return;

        const c = res?.data;
        onCustomerChange(c);
        const addrs = c?.addresses || [];
        setSavedAddresses(addrs);
        setSelectedAddrIdx(-1); // nothing selected yet
        if (addrs.length > 0) setShowAddrList(true);
        // Seed the delivery phone with the number just searched. The not-found
        // branch below already does this; leaving the found branch blank is how
        // an order reached the courier with no phone on it.
        onAddressChange({ name: c?.name || '', phone: q, district: '', upazila: '', address: '' });
      } catch {
        if (id !== requestRef.current) return;
        onCustomerChange({ phone: q, isNew: true });
        onAddressChange({ name: '', phone: q, district: '', upazila: '', address: '' });
      } finally {
        if (id === requestRef.current) setLoading(false);
      }
    },
    [phone, onCustomerChange, onAddressChange, onFraudData, loadCourierHistory]
  );

  const handleSelectSavedAddress = (addr, idx) => {
    areaChangedByUser.current = true;
    setSelectedAddrIdx(idx);
    setShowAddrList(false);
    // A saved address recorded before the phone was required can have none;
    // fall back to the searched number rather than clearing the field.
    const built = getCustomerAddress({ shippingAddress: addr }, phone.trim());
    onAddressChange(built);
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setPhone(val);
    if (val.replace(/\D/g, '').length === 11) doLookup(val);
  };
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneLooksWrong = phoneDigits.length >= 11 && !BD_PHONE.test(phoneDigits);

  const updateAddress = (key, val) => onAddressChange({ ...address, [key]: val });

  if (addressLocked) {
    return (
      <div className="space-y-1 text-sm text-slate-700">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
          <FiLock size={14} aria-hidden /> The parcel has left — the delivery address can no longer change.
        </p>
        <p className="font-semibold">{address.name}</p>
        <p>{address.phone}</p>
        <p className="text-slate-500">{[address.address, address.upazila, address.district].filter(Boolean).join(', ')}</p>
      </div>
    );
  }

  // Address dropdown — same pattern as product search
  const savedList =
    showAddrList && savedAddresses.length > 0 ? (
      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
        <p className="section-label px-4 pb-1 pt-2">Saved addresses</p>
        {savedAddresses.map((addr, i) => {
          const text = [addr.name, addressDistrict(addr), addressUpazila(addr), addr.address].filter(Boolean).join(' - ');
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectSavedAddress(addr, i)}
              className={`flex w-full items-center px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${selectedAddrIdx === i ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700'}`}
            >
              <p className="truncate">{text}</p>
            </button>
          );
        })}
      </div>
    ) : null;
  const savedToggle =
    savedAddresses.length > 0 ? (
      <button
        type="button"
        onClick={() => setShowAddrList((v) => !v)}
        aria-label={`${showAddrList ? 'Hide' : 'Show'} ${savedAddresses.length} saved address${savedAddresses.length === 1 ? '' : 'es'}`}
        aria-expanded={showAddrList}
        className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-slate-800"
      >
        <FiChevronDown size={14} className={`transition-transform ${showAddrList ? 'rotate-180' : ''}`} aria-hidden />
      </button>
    ) : null;

  // The desk's narrow panel: every field names itself inside its box.
  if (compact) {
    return (
      <div className="space-y-1.5">
        <div ref={addrWrapRef} className="relative flex gap-1.5">
          <DeskField label="Phone" required invalid={Boolean(errors.phone)} className="flex-1">
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={(e) => e.key === 'Enter' && doLookup()}
              id="order-phone"
              placeholder="01XXXXXXXXX"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'order-phone-error' : undefined}
              className={`${lineControl} tabular-nums`}
            />
            {savedToggle}
          </DeskField>
          <button type="button" onClick={() => doLookup()} disabled={loading || phone.trim().length < 7} className="btn-ghost btn-sm !h-8 shrink-0">
            <FiSearch size={14} aria-hidden /> {loading ? 'Finding…' : 'Find'}
          </button>
          {savedList}
        </div>
        <FieldError id="order-phone-error">{errors.phone}</FieldError>
        {phoneLooksWrong && !errors.phone ? (
          <p className="text-xs font-medium text-amber-700">This doesn’t look like a Bangladeshi mobile number (01XXXXXXXXX).</p>
        ) : null}

        <DeskField label="Name" required invalid={Boolean(errors.name)}>
          <input
            id="order-name"
            value={address.name || ''}
            onChange={(e) => updateAddress('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            className={lineControl}
          />
        </DeskField>
        <FieldError>{errors.name}</FieldError>

        <div className="grid grid-cols-2 gap-1.5">
          <DeskField label="District" required>
            <select id="order-district" value={address.district || ''} onChange={(e) => handleDistrictChange(e.target.value)} className={`${lineControl} cursor-pointer`}>
              <option value="">Select…</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </DeskField>
          <DeskField label="Upazila" required className={address.district ? '' : 'bg-slate-50'}>
            <select
              id="order-upazila"
              value={address.upazila || ''}
              onChange={(e) => handleUpazilaChange(e.target.value)}
              disabled={!address.district}
              className={`${lineControl} cursor-pointer`}
            >
              <option value="">Select…</option>
              {upazilas.map((upazila) => (
                <option key={upazila} value={upazila}>
                  {upazila}
                </option>
              ))}
            </select>
          </DeskField>
        </div>

        <DeskField label="Address" required invalid={Boolean(errors.address)} className="!h-auto !items-start py-1.5">
          <textarea
            id="order-address"
            rows={2}
            value={address.address || ''}
            onChange={(e) => updateAddress('address', e.target.value)}
            aria-invalid={Boolean(errors.address)}
            placeholder="House, road, area"
            className={`${lineControl} resize-none leading-5`}
          />
        </DeskField>
        <FieldError>{errors.address}</FieldError>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Phone + Find button */}
      <div>
        <Label required htmlFor="order-phone">
          Phone
        </Label>
        <div ref={addrWrapRef} className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={(e) => e.key === 'Enter' && doLookup()}
              id="order-phone"
              placeholder="01XXXXXXXXX — press Enter to look up"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'order-phone-error' : undefined}
              className={`${inp} w-full ${savedAddresses.length > 0 ? 'pr-9' : ''}`}
            />
            {savedAddresses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddrList((v) => !v)}
                aria-label={`${showAddrList ? 'Hide' : 'Show'} ${savedAddresses.length} saved address${savedAddresses.length === 1 ? '' : 'es'}`}
                aria-expanded={showAddrList}
                className="absolute inset-y-0 right-1 flex w-7 items-center justify-center rounded text-slate-500 hover:text-slate-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-3.5 w-3.5 transition-transform ${showAddrList ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={doLookup}
            disabled={loading || phone.trim().length < 7}
            className="btn-ghost shrink-0"
          >
            <FiSearch size={15} aria-hidden /> {loading ? 'Finding…' : compact ? 'Find' : 'Find customer'}
          </button>

          {savedList}
        </div>
        <FieldError id="order-phone-error">{errors.phone}</FieldError>
        {phoneLooksWrong && !errors.phone ? (
          <p className="mt-1.5 text-[13px] font-medium text-amber-700">This doesn’t look like a Bangladeshi mobile number (01XXXXXXXXX).</p>
        ) : null}
      </div>

      {/* Name (4) · District (3) · Upazila (3) · Address (10); one column on phones.
          On the desk the column is narrow: name, then district | upazila, then address. */}
      <div className={compact ? 'grid grid-cols-2 gap-x-2 gap-y-2.5' : 'grid grid-cols-1 gap-4 sm:grid-cols-10'}>
        <div className={compact ? 'col-span-2' : 'sm:col-span-4'}>
          <Label required htmlFor="order-name">
            Name
          </Label>
          <input
            id="order-name"
            value={address.name || ''}
            onChange={(e) => updateAddress('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            className={inp}
          />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div className={compact ? '' : 'sm:col-span-3'}>
          <Label required htmlFor="order-district">
            District
          </Label>
          <select id="order-district" value={address.district || ''} onChange={(e) => handleDistrictChange(e.target.value)} className={inp}>
            <option value="">Select district...</option>
            {districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </div>
        <div className={compact ? '' : 'sm:col-span-3'}>
          <Label required htmlFor="order-upazila">
            Upazila
          </Label>
          <select
            id="order-upazila"
            value={address.upazila || ''}
            onChange={(e) => handleUpazilaChange(e.target.value)}
            disabled={!address.district}
            className={inp}
          >
            <option value="">Select upazila...</option>
            {upazilas.map((upazila) => (
              <option key={upazila} value={upazila}>
                {upazila}
              </option>
            ))}
          </select>
        </div>
        <div className={compact ? 'col-span-2' : 'sm:col-span-10'}>
          <Label required htmlFor="order-address">
            Address
          </Label>
          <textarea
            id="order-address"
            rows={2}
            value={address.address || ''}
            onChange={(e) => updateAddress('address', e.target.value)}
            aria-invalid={Boolean(errors.address)}
            className={`${inp} resize-none`}
          />
          <FieldError>{errors.address}</FieldError>
        </div>
      </div>
    </div>
  );
}

// ─── Customer Stats Card ──────────────────────────────────────────────────────
function CustomerStatsCard({ customer, fraudData, className = '' }) {
  const compact = useContext(Compact);
  const cell = compact ? 'py-1' : 'py-2';
  const isNew = customer?.isNew === true;
  const hasAnyData = customer || fraudData; // show table once lookup ran

  const our = {
    total: customer?.totalOrders ?? 0,
    delivered: customer?.delivered ?? 0,
    pending: customer?.pending ?? 0,
    returned: customer?.returned ?? 0
  };
  const courierLoading = fraudData?.loading === true;
  const pathao = fraudData?.pathao ?? null;
  const sf = fraudData?.steadFast ?? null;
  const carryBee = fraudData?.carryBee ?? null;

  // Colored number cell
  const N = ({ v, color = 'text-slate-900' }) => (
    <td className={`${cell} pr-3 text-right text-[13px] font-semibold tabular-nums ${v ? color : 'text-slate-400'}`}>{v ?? '—'}</td>
  );

  // Label + error spanning all data columns
  const ErrRow = ({ label, msg }) => (
    <tr>
      <td className={`px-3 ${cell} text-[13px] font-medium text-slate-700`}>{label}</td>
      <td colSpan={4} className={`${cell} pr-3 text-xs ${courierLoading ? 'text-slate-500' : 'text-rose-700'}`}>
        {courierLoading ? 'Checking…' : msg}
      </td>
    </tr>
  );

  return (
    <section className={`card-ui flex flex-col overflow-hidden ${className}`}>
      {compact ? (
        <div className="px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-900">Delivery history</h2>
        </div>
      ) : (
        <div className="px-5 pb-3 pt-5">
          <h2 className="text-[15px] font-semibold text-slate-900">Delivery history</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Orders with us and with each courier.</p>
        </div>
      )}

      {!hasAnyData ? (
        <div className={`flex flex-1 items-center justify-center border-t border-slate-100 text-center ${compact ? 'p-3' : 'p-6'}`}>
          <p className="text-[13px] text-slate-500">Look up a phone number to see this customer’s history.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th scope="col" className={`w-[35%] px-3 ${cell} text-left`}>
                  <span className="sr-only">Source</span>
                </th>
                <th scope="col" className={`${cell} pr-3 text-right`}>Total</th>
                <th scope="col" className={`${cell} pr-3 text-right`}>
                  <abbr title="Delivered" className="no-underline">Deliv.</abbr>
                </th>
                <th scope="col" className={`${cell} pr-3 text-right`}>
                  <abbr title="Pending" className="no-underline">Pend.</abbr>
                </th>
                <th scope="col" className={`${cell} pr-3 text-right`}>
                  <abbr title="Returned" className="no-underline">Ret.</abbr>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {/* Our orders — always show; 0s for new customer make it clear they have none */}
              <tr>
                <td className={`px-3 ${cell} text-[13px] font-medium text-slate-700`}>Our Orders</td>
                {isNew ? (
                  <td colSpan={4} className={`${cell} pr-3 text-right text-xs font-medium text-slate-600`}>
                    New customer — no orders yet
                  </td>
                ) : (
                  <>
                    <N v={our.total} color="text-slate-900" />
                    <N v={our.delivered} color="text-emerald-700" />
                    <N v={our.pending} color="text-amber-700" />
                    <N v={our.returned} color="text-rose-700" />
                  </>
                )}
              </tr>
              {/* Pathao */}
              {pathao ? (
                <tr>
                  <td className={`px-3 ${cell} text-[13px] font-medium text-slate-700`}>Pathao</td>
                  <N v={pathao.total} color="text-slate-900" />
                  <N v={pathao.success} color="text-emerald-700" />
                  <td className={`${cell} pr-3 text-right text-xs text-slate-400`}>—</td>
                  <N v={pathao.returned} color="text-rose-700" />
                </tr>
              ) : (
                <ErrRow label="Pathao" msg={fraudData?.errors?.pathao || fraudData?.errors?.all || '—'} />
              )}
              {/* Steadfast */}
              {sf ? (
                <tr>
                  <td className={`px-3 ${cell} text-[13px] font-medium text-slate-700`}>Steadfast</td>
                  <N v={sf.total} color="text-slate-900" />
                  <N v={sf.success} color="text-emerald-700" />
                  <td className={`${cell} pr-3 text-right text-xs text-slate-400`}>—</td>
                  <N v={sf.returned} color="text-rose-700" />
                </tr>
              ) : (
                <ErrRow label="Steadfast" msg={fraudData?.errors?.steadFast || fraudData?.errors?.all || '—'} />
              )}
              {carryBee ? (
                <tr>
                  <td className={`px-3 ${cell} text-[13px] font-medium text-slate-700`}>CarryBee</td>
                  <N v={carryBee.total} color="text-slate-900" />
                  <N v={carryBee.success} color="text-emerald-700" />
                  <td className={`${cell} pr-3 text-right text-xs text-slate-400`}>—</td>
                  <N v={carryBee.returned} color="text-rose-700" />
                </tr>
              ) : (
                <ErrRow label="CarryBee" msg={fraudData?.errors?.carryBee || fraudData?.errors?.all || '—'} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Tags ────────────────────────────────────────────────────────────────────
function TagPicker({ selected, onChange }) {
  const { data: tags = [] } = useQuery(
    ['orderTags'],
    async () => {
      if (typeof api.getOrderTagsByAdmin !== 'function') return [];
      const res = await api.getOrderTagsByAdmin();
      return normalizeList(res).filter((tag) => tag.isActive !== false);
    },
    { staleTime: 5 * 60 * 1000 }
  );

  const compact = useContext(Compact);
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (!tags.length) {
    return <p className="text-[13px] text-slate-500">No active tags. Create them in Sales settings → Tags.</p>;
  }

  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {tags.map((tag) => {
        const id = tag.id || tag.id;
        const active = selected.includes(id);

        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition ${compact ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]'} ${
              active
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="h-2 w-2 rounded-full ring-1 ring-white/60" style={{ backgroundColor: tag.color || '#94a3b8' }} aria-hidden />
            {tag.name || tag.title}
          </button>
        );
      })}
    </div>
  );
}

// ─── Delivery ─────────────────────────────────────────────────────────────────
function DeliverySection({ value, onChange, deliveryTypes = DEFAULT_DELIVERY_TYPES }) {
  const compact = useContext(Compact);
  const today = new Date().toISOString().split('T')[0];

  const selectType = (type) => {
    const found = deliveryTypes.find((item) => item.key === type);
    onChange({ deliveryType: type, estimatedDelivery: addDays(found?.days ?? 7) });
  };

  // The desk: a slim three-way switch and a named date field.
  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-0.5 rounded-md bg-slate-100 p-0.5" role="group" aria-label="Delivery type">
          {deliveryTypes.map((type) => {
            const active = value.deliveryType === type.key;
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => selectType(type.key)}
                aria-pressed={active}
                title={type.hint || undefined}
                className={`h-7 rounded text-[13px] font-medium transition ${
                  active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>
        <DeskField label="Delivery by">
          <input
            id="order-eta"
            type="date"
            min={today}
            value={value.estimatedDelivery || ''}
            onChange={(e) => onChange({ ...value, estimatedDelivery: e.target.value })}
            className={`${lineControl} cursor-pointer`}
          />
        </DeskField>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Delivery type">
        {deliveryTypes.map((type) => {
          const active = value.deliveryType === type.key;
          return (
            <button
              key={type.key}
              type="button"
              onClick={() => selectType(type.key)}
              aria-pressed={active}
              title={type.hint || undefined}
              className={`rounded-md border px-2 text-center transition ${compact ? 'py-1.5' : 'py-2'} ${
                active
                  ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="block text-[13px] font-semibold">{type.label}</span>
              {compact ? null : <span className="mt-0.5 block text-xs text-slate-500">{type.hint}</span>}
            </button>
          );
        })}
      </div>

      <div className={compact ? 'flex items-center gap-2' : ''}>
        {compact ? (
          <label htmlFor="order-eta" className="shrink-0 text-xs font-medium text-slate-700">
            Delivery by
          </label>
        ) : (
          <Label htmlFor="order-eta">Estimated delivery</Label>
        )}
        <input
          id="order-eta"
          type="date"
          min={today}
          value={value.estimatedDelivery || ''}
          onChange={(e) => onChange({ ...value, estimatedDelivery: e.target.value })}
          className={inp}
        />
      </div>
    </div>
  );
}

// ─── Payment TrxID Lookup ──────────────────────────────────────────────────────
function TrxLookupSection({ linked, onChange }) {
  const compact = useContext(Compact);
  const [trxInput, setTrxInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');

  const search = async () => {
    const val = trxInput.trim();
    if (!val) return;
    setMessage('');
    if (linked.find((p) => p.trxId === val)) return setMessage(`TrxID ${val} is already on this order.`);
    setSearching(true);
    try {
      const res = await api.getPaymentByTrxId(val);
      const payment = res?.data;
      if (!payment) return setMessage('No payment found with that TrxID.');
      // One payment pays one order. The server refuses a second link, so say
      // so here instead of letting the whole order fail on submit.
      if (payment.orderId) {
        return setMessage(`This payment already pays order #${payment.orderNo}. Unlink it from that order first.`);
      }
      onChange([...linked, payment]);
      setTrxInput('');
    } catch (e) {
      setMessage(e?.response?.data?.message || 'No payment found with that TrxID.');
    } finally {
      setSearching(false);
    }
  };

  const remove = (id) => onChange(linked.filter((p) => p.id !== id));

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      <div className={`flex ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {compact ? (
          <DeskField label="Paid TrxID" className="flex-1">
            <input
              value={trxInput}
              onChange={(e) => {
                setTrxInput(e.target.value);
                setMessage('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="From a received payment"
              spellCheck={false}
              className={`${lineControl} ops-code`}
            />
          </DeskField>
        ) : (
          <input
            value={trxInput}
            onChange={(e) => {
              setTrxInput(e.target.value);
              setMessage('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="TrxID of a received payment"
            aria-label="Transaction ID to link"
            spellCheck={false}
            className={`${inp} ops-code flex-1`}
          />
        )}
        <button
          type="button"
          onClick={search}
          disabled={searching || !trxInput.trim()}
          className={`btn-brand btn-sm ${compact ? '!h-8' : ''}`}
        >
          {searching ? 'Finding…' : 'Link'}
        </button>
      </div>
      {message ? (
        <p className="flex items-start gap-1.5 text-[13px] font-medium text-amber-800" role="status">
          <FiAlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden /> {message}
        </p>
      ) : null}

      {linked.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">Type</th>
                <th scope="col" className="px-3 py-2 text-left">TrxID</th>
                <th scope="col" className="px-3 py-2 text-right">Amount</th>
                <th scope="col" className="w-10 px-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {linked.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-semibold uppercase text-slate-700">{p.type}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{p.trxId || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmt(p.amount)}</td>
                  <td className="px-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      aria-label={`Unlink payment ${p.trxId || ''}`}
                      title="Unlink payment"
                      className="btn-icon btn-icon-sm btn-icon-danger"
                    >
                      <FiX size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-100 bg-slate-50">
              <tr>
                <td colSpan={2} className="px-3 py-2 font-medium text-slate-600">
                  Total linked
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                  {fmt(linked.reduce((s, p) => s + Number(p.amount || 0), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {linked.length === 0 && !message && !compact && (
        <p className="text-[13px] text-slate-500">Link a payment the customer already sent, by its TrxID.</p>
      )}
    </div>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
function OrderSummary({ items, linkedPayments, shipping, discount, onShippingChange, onDiscountChange, locked = false }) {
  const compact = useContext(Compact);
  const subTotal = items.reduce((sum, item) => sum + getLineUnit(item) * Number(item.qty || 1), 0);
  const totalPaid = linkedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const total = Math.max(0, subTotal + Number(shipping || 0) - Number(discount || 0));
  const due = Math.max(0, total - totalPaid);

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="order-shipping">Shipping (৳)</Label>
          <input
            id="order-shipping"
            type="number"
            inputMode="decimal"
            min="0"
            value={shipping}
            onChange={(e) => onShippingChange(e.target.value)}
            disabled={locked}
            className={`${inp} text-right tabular-nums`}
          />
        </div>
        <div>
          <Label htmlFor="order-discount">Discount (৳)</Label>
          <input
            id="order-discount"
            type="number"
            inputMode="decimal"
            min="0"
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
            disabled={locked}
            className={`${inp} text-right tabular-nums`}
          />
        </div>
      </div>

      <dl className={`border-t border-slate-200 text-[13px] ${compact ? 'space-y-1 pt-2.5' : 'space-y-2 pt-4'}`}>
        <div className="flex justify-between text-slate-600">
          <dt>Product subtotal</dt>
          <dd className="tabular-nums text-slate-900">{fmt(subTotal)}</dd>
        </div>
        <div className="flex justify-between text-slate-600">
          <dt>Shipping</dt>
          <dd className="tabular-nums text-slate-900">{fmt(shipping)}</dd>
        </div>
        <div className="flex justify-between text-slate-600">
          <dt>Discount</dt>
          <dd className="tabular-nums text-emerald-700">−{fmt(discount)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2.5 text-base font-semibold text-slate-900">
          <dt>Total</dt>
          <dd className="tabular-nums">{fmt(total)}</dd>
        </div>
        <div className="flex justify-between text-slate-600">
          <dt>Paid</dt>
          <dd className="tabular-nums font-medium text-emerald-700">{fmt(totalPaid)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt className="text-slate-900">Due</dt>
          <dd className={`tabular-nums ${due > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{fmt(due)}</dd>
        </div>
        {Number(discount || 0) > subTotal + Number(shipping || 0) ? (
          <p className="text-[13px] font-medium text-rose-700" role="alert">The discount is larger than the order.</p>
        ) : null}
      </dl>
    </div>
  );
}

// ─── Order desk parts ─────────────────────────────────────────────────────────

/** One numbered step of the order panel; ticks green once it is complete. */
function DeskStep({ n, title, done = false, aside, children }) {
  return (
    <section className="px-3 py-2.5" aria-label={title}>
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
            done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
          }`}
          aria-hidden
        >
          {done ? <FiCheck size={11} /> : n}
        </span>
        <h2 className="text-[13px] font-semibold text-slate-900">
          {title}
          {done ? <span className="sr-only"> (complete)</span> : null}
        </h2>
        {aside ? <div className="ml-auto">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The customer's delivery record in one line — every courier added up — so a
 * risky customer is obvious at a glance. The full breakdown opens on demand.
 */
function CourierRecord({ customer, fraudData }) {
  const [open, setOpen] = useState(false);
  if (!customer && !fraudData) return null;

  const loading = fraudData?.loading === true;
  const couriers = [fraudData?.pathao, fraudData?.steadFast, fraudData?.carryBee].filter(Boolean);
  const parcels = couriers.reduce((sum, c) => sum + Number(c.total || 0), 0);
  const delivered = couriers.reduce((sum, c) => sum + Number(c.success || 0), 0);
  const returned = couriers.reduce((sum, c) => sum + Number(c.returned || 0), 0);
  const rate = parcels ? Math.round((delivered / parcels) * 100) : null;
  const tone = rate == null ? 'slate' : rate >= 85 ? 'emerald' : rate >= 70 ? 'amber' : 'rose';
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900'
  }[tone];
  const ours = customer?.isNew ? 'New customer' : `${customer?.totalOrders ?? 0} order${customer?.totalOrders === 1 ? '' : 's'} with us`;

  return (
    <div className={`rounded-lg border ${toneClass}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]"
      >
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{ours}</span>
          <span className="opacity-80">
            {' · '}
            {loading
              ? 'checking couriers…'
              : parcels
                ? `${parcels} courier parcels · ${rate}% delivered${returned ? ` · ${returned} returned` : ''}`
                : 'no courier history'}
          </span>
        </span>
        <FiChevronDown size={15} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        <span className="sr-only">{open ? 'Hide' : 'Show'} the breakdown</span>
      </button>
      {open ? (
        <div className="border-t border-black/5 bg-white">
          <CustomerStatsCard customer={customer} fraudData={fraudData} className="!rounded-none !border-0 !shadow-none" />
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CreateOrder({ orderNo = null, desk = false }) {
  const isEdit = Boolean(orderNo);
  const [noteOpen, setNoteOpen] = useState(false);
  // Desk summary: which amount is being edited in place, and the advances
  // (with their matched / unverified state) taken for this order.
  const [editingAmount, setEditingAmount] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  useEffect(() => {
    if (!desk) return undefined;
    const onKey = (event) => {
      if (event.key !== '/' || event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const search = document.querySelector('[aria-label="Search products to add"]');
      if (search) {
        event.preventDefault();
        search.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desk]);
  const router = useRouter();
  const { can } = usePermissions();
  const canOverridePrice = can('overridePrice', 'OrderItem');

  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [fraudData, setFraudData] = useState(null);
  const [address, setAddress] = useState({
    name: '',
    phone: '',
    district: '',
    upazila: '',
    address: ''
  });
  const [tags, setTags] = useState([]);
  const [delivery, setDelivery] = useState({ deliveryType: 'regular', estimatedDelivery: addDays(7) });
  const [linkedPayments, setLinkedPayments] = useState([]);
  const [adminNote, setAdminNote] = useState('');
  const [adminNoteImages, setAdminNoteImages] = useState([]);
  const [shipping, setShipping] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // What stops the order being placed, shown where it can be fixed.
  const [errors, setErrors] = useState({});
  useEffect(() => {
    setErrors((current) => ({
      ...current,
      phone: address.phone?.trim() ? undefined : current.phone,
      name: address.name ? undefined : current.name,
      address: address.address ? undefined : current.address
    }));
  }, [address.phone, address.name, address.address]);

  // Edit-mode tracking
  const [originalServerItemIds, setOriginalServerItemIds] = useState([]);
  const [initialized, setInitialized] = useState(!isEdit);

  // Load order settings (delivery types)
  const { data: orderSettingsData } = useQuery('order-settings', api.getOrderSettings, {
    refetchOnWindowFocus: false,
    onSuccess: (res) => {
      if (!isEdit && res?.data) {
        const s = res.data;
        const defKey = s.defaultDeliveryType || 'regular';
        const types = buildDeliveryTypes(s);
        const defType = types.find((t) => t.key === defKey) || types[0];
        setDelivery({ deliveryType: defType.key, estimatedDelivery: addDays(defType.days ?? 7) });
      }
    }
  });
  const deliveryTypes = buildDeliveryTypes(orderSettingsData?.data);

  // Load existing order (edit mode only)
  const { data: existingOrderData, isError: orderLoadFailed, error: orderLoadError, refetch: retryOrderLoad } = useQuery(['admin-order-edit', orderNo], () => api.getOrderByAdmin(orderNo), {
    enabled: isEdit,
    refetchOnWindowFocus: false
  });
  const orderStatus = existingOrderData?.data?.status || null;
  const itemsLocked = isEdit && Boolean(orderStatus) && !EDITABLE_ORDER_STATUSES.includes(orderStatus);
  const addressLocked = isEdit && ADDRESS_LOCKED_STATUSES.includes(orderStatus);

  useEffect(() => {
    if (!isEdit || initialized || !existingOrderData?.data) return;
    const o = existingOrderData.data;

    // Address
    const addr = o.shippingAddress || {};
    setAddress({
      name: addr.name || '',
      phone: addr.phone || '',
      district: addressDistrict(addr),
      upazila: addressUpazila(addr),
      address: addr.address || ''
    });

    setShipping(o.shipping || 0);
    setDiscount(o.discount || 0);
    setDelivery({
      deliveryType: o.deliveryType || 'regular',
      estimatedDelivery: o.estimatedDelivery?.slice(0, 10) || addDays(7)
    });
    setTags((o.tags || []).map((tag) => (typeof tag === 'object' && tag !== null ? tag.id || tag.id : tag)).filter(Boolean));

    // Customer — the API returns the id as userId and the account as user.
    if (o.userId) {
      const account = o.user && typeof o.user === 'object' ? o.user : {};
      setCustomer({
        id: o.userId,
        name: account.name || '',
        phone: account.phone || addr.phone || ''
      });
    }

    // Pre-populate linked payments from embedded order payments
    const linked = (o.payments || [])
      .filter((p) => p.paymentId)
      .map((p) => ({
        id: p.paymentId,
        type: p.method,
        trxId: p.trxId,
        amount: p.amount,
        orderId: o.id,
        orderNo: o.orderNo
      }));
    setLinkedPayments(linked);

    // Load items — fetch full product data so ItemsTable variant picker works
    const serverItems = o.items || [];
    setOriginalServerItemIds(serverItems.map((i) => i.id));

    if (!serverItems.length) {
      setInitialized(true);
      return;
    }

    Promise.all(
      serverItems.map(async (si) => {
        try {
          const slug = si.pid?.slug;
          const res = slug ? await api.getOneProductByAdmin(slug) : null;
          const base = buildItem(res?.data || si.pid || {});

          // Track which server item this was
          base._serverId = si.id;
          base._serverStatus = si.status;
          base._serverIsCustom = Boolean(si.isCustom);
          base._serverProductionBatch = si.productionBatchId || si.productionBatch || null;

          // Restore saved attribute selection
          base._serverHadType = (si.attributes || []).some((a) => a.attributeName === 'Type');
          const savedAttrs = {};
          (si.attributes || []).forEach((a) => {
            savedAttrs[a.attributeName] = a.valueName;
          });
          if (Object.keys(savedAttrs).length) {
            base.selectedAttrs = savedAttrs;
            const matched = findVariation(base.variations, savedAttrs);
            base.selectedVariationId = matched?.id || matched?.id || si.variationId || base.selectedVariationId;
          } else {
            base.selectedVariationId = si.variationId || base.selectedVariationId;
          }

          base.qty = si.quantity || 1;
          base.customizePrice = si.customizePrice || 0;
          base.customizeDetails = si.customizeDetails || '';
          base.isCustom = Boolean(si.isCustom) || hasCustomSelection(base);
          base.selectedAttrs.Type = base.isCustom ? 'Custom' : 'Standard';
          base.regularPrice = si.regularPrice ?? base.regularPrice;
          base.discountPrice = si.salePrice != null ? si.salePrice : base.discountPrice;
          // What was saved is this item's baseline: unchanged, it is not an override.
          base.catalogRegular = base.regularPrice;
          base.catalogDiscount = base.discountPrice;
          base._serverSignature = orderItemSignature(base);
          return base;
        } catch {
          return null;
        }
      })
    ).then((loaded) => {
      setItems(loaded.filter(Boolean));
      setInitialized(true);
    });
  }, [existingOrderData, isEdit, initialized]); // eslint-disable-line

  // Warn before leaving with work on screen: a half-built order is easy to lose.
  const hasWork = !isEdit && (items.length > 0 || Boolean(address.phone));
  useEffect(() => {
    if (!hasWork || submitting) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasWork, submitting]);

  const addItem = (item) => setItems((prev) => [...prev, item]);
  const removeItem = (key) => setItems((prev) => prev.filter((item) => item._key !== key));
  const updateItem = (key, patch) =>
    setItems((prev) => prev.map((item) => (item._key === key ? { ...item, ...patch } : item)));
  const duplicateItem = (key) =>
    setItems((prev) => {
      const idx = prev.findIndex((x) => x._key === key);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], _key: uid(), _serverId: undefined };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const handleSubmit = async () => {
    // The delivery phone specifically. Accepting the customer's account phone
    // as a stand-in let an order through with an empty shipping phone — the
    // courier has no one to call, and the account number may belong to someone
    // other than the recipient.
    const nextErrors = {};
    if (!address.phone?.trim()) nextErrors.phone = 'Enter the delivery phone number.';
    if (!address.name) nextErrors.name = 'Enter the customer’s name.';
    if (!address.address) nextErrors.address = 'Enter the delivery address.';
    if (!items.length) nextErrors.items = 'Add at least one product.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const first = nextErrors.phone ? 'order-phone' : nextErrors.name ? 'order-name' : nextErrors.address ? 'order-address' : null;
      if (first) document.getElementById(first)?.focus();
      return;
    }

    const subTotal = items.reduce((sum, item) => sum + getLineUnit(item) * Number(item.qty || 1), 0);
    if (Number(discount || 0) < 0 || Number(shipping || 0) < 0) {
      return alertError(null, { title: 'Check the charges', text: 'Shipping and discount cannot be negative.' });
    }
    if (Number(discount || 0) > subTotal + Number(shipping || 0)) {
      return alertError(null, { title: 'The discount is larger than the order', text: 'Lower the discount before saving.' });
    }
    if (!canOverridePrice && !itemsLocked && items.some(isPriceOverridden)) {
      return alertError(null, { title: 'Price change not allowed', text: 'You do not have permission to change product prices.' });
    }
    const warnings = [];
    if (!addressLocked && (!address.district || !address.upazila)) {
      warnings.push('No district or upazila — the shipping charge and courier booking need them.');
    }
    const digits = String(address.phone || '').replace(/\D/g, '');
    if (!BD_PHONE.test(digits)) warnings.push(`"${address.phone}" does not look like a Bangladeshi mobile number.`);
    if (warnings.length) {
      const go = await confirmAction({
        tone: 'warning',
        title: 'Check before saving',
        items: warnings,
        confirmText: 'Save anyway',
        cancelText: 'Go back'
      });
      if (!go) return;
    }

    setSubmitting(true);

    // ── Edit mode ──────────────────────────────────────────────────────────────
    if (isEdit) {
      try {
        if (!itemsLocked) {
        // 1. Remove items that were deleted from the list
        const currentServerIds = new Set(items.filter((i) => i._serverId).map((i) => i._serverId));
        for (const id of originalServerItemIds) {
          if (!currentServerIds.has(id)) await api.removeItemFromOrder({ orderNo, itemId: id });
        }

        // 2. Update existing items whose product, variation, quantity, or customization changed.
        for (const item of items.filter((i) => i._serverId)) {
          if (!item.selectedVariationId) {
            await alertWarning('Choose a variation', `“${item.productName}” needs a size or variation before the order can be saved.`);
            setSubmitting(false);
            return;
          }

          const changed = orderItemSignature(item) !== item._serverSignature;
          if (!changed) continue;

          const productionSensitive =
            item._serverIsCustom ||
            Boolean(item._serverProductionBatch) ||
            ['production-needed', 'in-production'].includes(item._serverStatus);

          let confirmProductionUpdate = false;
          if (productionSensitive) {
            const confirmed = await confirmAction({
              tone: 'warning',
              title: 'Update an item already in production?',
              text: 'This custom item may already be in the production workflow. Updating it releases the old reservation and reserves or queues the new selection.',
              subject: item.productName,
              confirmText: 'Update item',
              cancelText: 'Keep current item'
            });
            if (!confirmed) {
              setSubmitting(false);
              return;
            }
            confirmProductionUpdate = true;
          }

          try {
            await api.updateItemInOrder({
              orderNo,
              itemId: item._serverId,
              ...orderItemPayload(item),
              confirmProductionUpdate
            });
          } catch (error) {
            if (error?.response?.status === 409 && error?.response?.data?.code === 'PRODUCTION_UPDATE_CONFIRMATION_REQUIRED') {
              const confirmed = await confirmAction({
                tone: 'warning',
                title: 'This item is already in production',
                text: error.response.data.message || 'This custom item is already in production. Confirm before updating it.',
                subject: item.productName,
                confirmText: 'Update anyway',
                cancelText: 'Cancel update'
              });
              if (!confirmed) {
                setSubmitting(false);
                return;
              }
              await api.updateItemInOrder({
                orderNo,
                itemId: item._serverId,
                ...orderItemPayload(item),
                confirmProductionUpdate: true
              });
            } else {
              throw error;
            }
          }
        }

        // 3. Add newly added items (no _serverId)
        for (const item of items.filter((i) => !i._serverId)) {
          if (!item.selectedVariationId) {
            await alertWarning('Choose a variation', `“${item.productName}” needs a size or variation before the order can be saved.`);
            setSubmitting(false);
            return;
          }
          await api.addItemToOrder({
            orderNo,
            ...orderItemPayload(item)
          });
        }
        }

        // 4. Link newly added payments (those not already on this order)
        const orderId = existingOrderData?.data?.id?.toString();
        for (const p of linkedPayments) {
          if (!p.orderId || p.orderId?.toString() !== orderId) {
            try {
              await api.assignPaymentByAdmin({ id: p.id, orderNo });
            } catch (_) {}
          }
        }

        // 5. Update order fields
        // Only what the order's stage still allows (the server refuses the rest).
        await api.updateOrderStatus({
          id: orderNo,
          ...(addressLocked ? {} : { shippingAddress: address }),
          ...(itemsLocked ? {} : { shipping: Number(shipping || 0), discount: Number(discount || 0) }),
          deliveryType: delivery.deliveryType,
          estimatedDelivery: delivery.estimatedDelivery || null,
          tags
        });

        toastify.success(`Order #${orderNo} updated`);
        router.push(`/orders/${orderNo}`);
      } catch (e) {
        alertError(e, { title: 'The order was not updated' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── Create mode ────────────────────────────────────────────────────────────
    try {
      let userId = customer?.id || customer?.id || null;

      if (!userId) {
        if (typeof api.createGuestCustomer !== 'function') {
          throw new Error('createGuestCustomer service is not available');
        }

        const guest = await api.createGuestCustomer({ name: address.name, phone: address.phone || customer?.phone });
        userId = guest?.data?.id || guest?.data?.id;
      }

      const uploadedAdminNoteImages = await uploadAdminNoteImages(adminNoteImages);

      const payload = {
        userId,
        items: items.map((item) => ({
          productId: item.productId,
          variationId: item.selectedVariationId || null,
          attributes: selectedAttributesForOrder(item),
          qty: Number(item.qty || 1),
          regularPrice: Number(item.regularPrice || 0),
          discountPrice: item.discountPrice != null && item.discountPrice !== '' ? Number(item.discountPrice) : null,
          salePrice: item.discountPrice != null && item.discountPrice !== '' ? Number(item.discountPrice) : null,
          customizeDetails: item.customizeDetails || null,
          customizePrice: Number(item.customizePrice || 0),
          isCustom: hasCustomSelection(item) || Boolean(item.isCustom)
        })),
        shippingAddress: address,
        shipping: Number(shipping || 0),
        discount: Number(discount || 0),
        tags,
        deliveryType: delivery.deliveryType,
        estimatedDelivery: delivery.estimatedDelivery || null,
        adminNote: adminNote || null,
        adminNoteImages: uploadedAdminNoteImages.map((image) => image.id || image.id),
        linkedPaymentIds: linkedPayments.map((p) => p.id),
        // Re-checked by the server; anything not matched there is saved
        // unverified only because staff chose to (force).
        advancePayments: advances.map(({ method, amount, trxId, note, force }) => ({ method, amount, trxId, note, force })),
        paymentMethod: linkedPayments[0]?.type || 'cod'
      };

      const res = await api.createAdminOrder(payload);
      const createdNo = res?.data?.orderNo || res?.data?.orderNumber;
      toastify.success(createdNo ? `Order #${createdNo} created` : 'Order created');
      router.push(createdNo ? `/orders/${createdNo}` : '/orders');
    } catch (e) {
      alertError(e, { title: 'The order was not created' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isEdit && !initialized && orderLoadFailed) {
    return <ErrorState error={orderLoadError} title={`Order ${orderNo} could not be loaded`} onRetry={retryOrderLoad} />;
  }

  // Loading skeleton for edit mode while fetching order + products
  if (isEdit && !initialized) {
    return (
      <div className="space-y-6" aria-busy="true">
        {[180, 320, 120].map((h, i) => (
          <div key={i} className="card-ui animate-pulse" style={{ height: h }} />
        ))}
      </div>
    );
  }

  const orderTotal = Math.max(
    0,
    items.reduce((sum, item) => sum + getLineUnit(item) * Number(item.qty || 1), 0) + Number(shipping || 0) - Number(discount || 0)
  );
  const errorList = Object.values(errors).filter(Boolean);

  const customerCard = (
    <Card title="Customer" description="Look up by phone to fill in a saved address.">
      {/* key forces re-mount after edit-mode data loads so phone initialises correctly */}
      <CustomerSection
        key={initialized ? 'ready' : 'init'}
        address={address}
        onCustomerChange={setCustomer}
        onAddressChange={setAddress}
        onFraudData={setFraudData}
        onShippingChange={setShipping}
        addressLocked={addressLocked}
        errors={errors}
      />
    </Card>
  );
  const statsCard = <CustomerStatsCard customer={customer} fraudData={fraudData} />;
  const deliveryCard = (
    <Card title="Delivery and tags">
      <div className="space-y-5">
        <DeliverySection value={delivery} onChange={setDelivery} deliveryTypes={deliveryTypes} />
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-[13px] font-medium text-slate-800">Tags</p>
          <TagPicker selected={tags} onChange={setTags} />
        </div>
      </div>
    </Card>
  );
  const lockedNotice = (
    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
      <FiLock size={15} className="mt-0.5 shrink-0" aria-hidden /> This order is {orderStatus}. Products, prices, shipping
      and discount are locked once packing starts — use Return items or Finance review on the order page instead.
    </p>
  );
  const productSearch = (
    <POSProductSearch
      autoFocus={desk}
      large={desk}
      onAdd={(item) => {
        addItem(item);
        setErrors((current) => ({ ...current, items: undefined }));
      }}
    />
  );
  const itemsTable = (
    <ItemsTable
      items={items}
      onUpdate={updateItem}
      onRemove={removeItem}
      onDuplicate={duplicateItem}
      locked={itemsLocked}
      canOverridePrice={canOverridePrice}
      missing={Boolean(errors.items)}
    />
  );
  const noteCard = !isEdit ? (
    <Card title="First internal note" description="Visible to staff only.">
      <AdminNote value={adminNote} onChange={setAdminNote} images={adminNoteImages} onImagesChange={setAdminNoteImages} />
    </Card>
  ) : null;
  const summary = (
    <OrderSummary
      items={items}
      linkedPayments={linkedPayments}
      shipping={shipping}
      discount={discount}
      onShippingChange={setShipping}
      onDiscountChange={setDiscount}
      locked={itemsLocked}
    />
  );
  const payments = <TrxLookupSection linked={linkedPayments} onChange={setLinkedPayments} />;
  const errorsBlock = errorList.length ? (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800" role="alert">
      <p className="font-semibold">Before this order can be saved:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {errorList.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  ) : null;
  const submitLabel = submitting ? (isEdit ? 'Saving…' : 'Placing order…') : isEdit ? 'Save changes' : `Place order · ${fmt(orderTotal)}`;

  // ── Order desk: a full-screen, POS-style workstation ─────────────────────
  // Two panels: what is being sold on the left, and the order itself on the
  // right as numbered steps — customer, delivery, payment — with the total and
  // the one button that matters pinned at the bottom. Each step ticks green
  // once it is complete, so what is left to do is always visible.
  if (desk) {
    const pieces = items.reduce((sum, item) => sum + Number(item.qty || 1), 0);
    const subTotal = items.reduce((sum, item) => sum + getLineUnit(item) * Number(item.qty || 1), 0);
    const paidLinked = linkedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const advanceTotal = advances.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const advanceUnverified = advances.filter((entry) => !entry.verified).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const collected = paidLinked + advanceTotal;
    const dueNow = Math.max(0, orderTotal - collected);
    const customerDone = Boolean(address.phone && address.name && address.district && address.upazila && address.address);
    const deliveryDone = Boolean(delivery.deliveryType && delivery.estimatedDelivery);
    const row = (label, value, tone = 'text-slate-900') => (
      <div className="flex justify-between gap-4 text-[13px]">
        <dt className="text-slate-500">{label}</dt>
        <dd className={`tabular-nums ${tone}`}>{value}</dd>
      </div>
    );
    // A summary amount with its edit button; the value turns into a field in place.
    const editButton = (label, onClick, disabled = false) => (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        className="btn-icon btn-icon-sm !h-6 !w-6"
        aria-label={`Edit ${label.toLowerCase()}`}
        title={`Edit ${label.toLowerCase()}`}
      >
        <FiEdit2 size={12} aria-hidden />
      </button>
    );
    const amountRow = ({ id, label, value, onChange, sign = '', tone = 'text-slate-900' }) => (
      <div className="flex h-7 items-center justify-between gap-3 text-[13px]">
        <dt className="text-slate-500">{label}</dt>
        <dd className="flex items-center gap-1">
          {editingAmount === id ? (
            <input
              id={`desk-${id}`}
              type="number"
              inputMode="decimal"
              min="0"
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setEditingAmount(null)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEditingAmount(null)}
              aria-label={`${label} (৳)`}
              className={`${sm} !h-7 !w-28 text-right tabular-nums`}
            />
          ) : (
            <span className={`tabular-nums ${Number(value || 0) > 0 ? tone : 'text-slate-900'}`}>
              {Number(value || 0) > 0 ? `${sign}${fmt(value)}` : fmt(0)}
            </span>
          )}
          {editButton(label, () => setEditingAmount(editingAmount === id ? null : id), itemsLocked)}
        </dd>
      </div>
    );

    return (
      <Compact.Provider value>
        <div
          className="grid gap-3 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_440px] 2xl:grid-cols-[minmax(0,1fr)_500px]"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && items.length && !submitting) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        >
          {/* ── Products ─────────────────────────────────────────────────── */}
          <section className="card-ui flex min-h-[420px] flex-col xl:min-h-0" aria-labelledby="desk-products-title">
            <header className="border-b border-slate-200 px-4 pb-3 pt-3.5">
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <h2 id="desk-products-title" className="text-sm font-semibold text-slate-900">
                  Products
                </h2>
                <p className="text-xs text-slate-500">
                  Press <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-sans text-[11px]">/</kbd> to search
                </p>
              </div>
              {itemsLocked ? lockedNotice : productSearch}
            </header>
            <div className="min-h-0 flex-1 overflow-auto">{itemsTable}</div>
            {/* Order labels and the staff note — not needed to check out, so they
                sit under the products rather than in the order panel. */}
            <div className="border-t border-slate-200 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-xs font-medium text-slate-500">Tags</span>
                <div className="min-w-0 flex-1">
                  <TagPicker selected={tags} onChange={setTags} />
                </div>
                {!isEdit ? (
                  <button
                    type="button"
                    onClick={() => setNoteOpen((v) => !v)}
                    aria-expanded={noteOpen}
                    aria-controls="desk-note"
                    className="btn-ghost btn-sm shrink-0"
                  >
                    Internal note
                    {adminNote?.trim() || adminNoteImages?.length ? (
                      <span className="rounded bg-emerald-50 px-1 text-[11px] font-medium text-emerald-700">Added</span>
                    ) : null}
                    <FiChevronDown size={14} className={`transition-transform ${noteOpen ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                ) : null}
              </div>
              {noteOpen && !isEdit ? (
                <div id="desk-note" className="mt-2">
                  <AdminNote value={adminNote} onChange={setAdminNote} images={adminNoteImages} onImagesChange={setAdminNoteImages} />
                </div>
              ) : null}
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px]">
              <span className="text-slate-600">
                {items.length} line{items.length === 1 ? '' : 's'} · {pieces} piece{pieces === 1 ? '' : 's'}
              </span>
              <span className="text-slate-600">
                Subtotal <span className="ml-1 font-semibold tabular-nums text-slate-900">{fmt(subTotal)}</span>
              </span>
            </footer>
          </section>

          {/* ── Order ────────────────────────────────────────────────────── */}
          <aside className="card-ui flex min-h-0 flex-col" aria-label="Order">
            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              <DeskStep n={1} title="Customer" done={customerDone}>
                <div className="space-y-1.5">
                  <CustomerSection
                    key={initialized ? 'ready' : 'init'}
                    address={address}
                    onCustomerChange={setCustomer}
                    onAddressChange={setAddress}
                    onFraudData={setFraudData}
                    onShippingChange={setShipping}
                    addressLocked={addressLocked}
                    errors={errors}
                  />
                  <CourierRecord customer={customer} fraudData={fraudData} />
                </div>
              </DeskStep>

              <DeskStep n={2} title="Delivery" done={deliveryDone}>
                <DeliverySection value={delivery} onChange={setDelivery} deliveryTypes={deliveryTypes} />
              </DeskStep>
            </div>

            {/* Checkout — always in view */}
            <footer className="space-y-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
              <dl>
                <div className="flex h-7 items-center justify-between gap-3 text-[13px]">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="pr-7 tabular-nums text-slate-900">{fmt(subTotal)}</dd>
                </div>
                {amountRow({ id: 'shipping', label: 'Shipping', value: shipping, onChange: setShipping })}
                {amountRow({ id: 'discount', label: 'Discount', value: discount, onChange: setDiscount, sign: '−', tone: 'text-emerald-700' })}
                {Number(discount || 0) > subTotal + Number(shipping || 0) ? (
                  <p className="pb-1 text-right text-xs font-medium text-rose-700" role="alert">
                    The discount is larger than the order.
                  </p>
                ) : null}
                <div className="flex h-7 items-center justify-between gap-3 text-[13px]">
                  <dt className="text-slate-500">
                    Advance
                    {advanceUnverified > 0 ? <span className="ml-1.5 text-xs text-amber-700">{fmt(advanceUnverified)} unverified</span> : null}
                  </dt>
                  <dd className="flex items-center gap-1">
                    <span className={`tabular-nums ${advanceTotal > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {advanceTotal > 0 ? `−${fmt(advanceTotal)}` : fmt(0)}
                    </span>
                    {editButton('Advance', () => setAdvanceOpen(true))}
                  </dd>
                </div>
                {paidLinked > 0 ? row('Paid', `−${fmt(paidLinked)}`, 'text-emerald-700') : null}
              </dl>
              <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="text-sm font-semibold text-slate-900">
                  {collected > 0 ? 'To collect' : 'Total'}
                  {collected > 0 ? <span className="ml-1.5 text-xs font-normal text-slate-500">of {fmt(orderTotal)}</span> : null}
                </span>
                <span className="text-xl font-semibold tabular-nums tracking-tight text-slate-900">{fmt(collected > 0 ? dueNow : orderTotal)}</span>
              </div>
              {errorsBlock}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !items.length}
                className="btn-brand h-11 w-full text-[15px]"
                title="Ctrl + Enter"
              >
                {submitting ? 'Placing order…' : items.length ? 'Place order' : 'Add a product to continue'}
              </button>
            </footer>
          </aside>
        </div>
        {advanceOpen ? (
          <AdvancePaymentsPanel
            value={advances}
            onChange={setAdvances}
            onClose={() => setAdvanceOpen(false)}
            orderTotal={orderTotal}
            loadOptions={api.getAdvanceOptions}
            checkTrx={api.checkAdvanceTrx}
          />
        ) : null}
      </Compact.Provider>
    );
  }

  return (
    <div className="space-y-6">
      {isEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => router.push(`/orders/${orderNo}`)} className="btn-ghost btn-sm">
            <FiArrowLeft size={15} aria-hidden /> Back to order
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Edit order <span className="ops-code">#{orderNo}</span>
          </h1>
        </div>
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create order</h1>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
            <div className="xl:col-span-2">{customerCard}</div>
            {statsCard}
            {deliveryCard}
          </div>

          <Card title="Products" description={items.length ? `${items.length} line${items.length === 1 ? '' : 's'}` : undefined}>
            <div className="space-y-4">
              {itemsLocked ? lockedNotice : productSearch}
              {itemsTable}
            </div>
          </Card>
          {noteCard}
        </div>

        {/* Right column — stays in view while the product list scrolls */}
        <aside className="space-y-6 xl:sticky xl:top-0" aria-label="Order total and payment">
          <Card title="Summary">{summary}</Card>
          <Card title="Payments received">{payments}</Card>
          {errorsBlock}
          <button type="button" onClick={handleSubmit} disabled={submitting || !items.length} className="btn-brand h-11 w-full text-[15px]">
            {submitLabel}
          </button>
        </aside>
      </div>
    </div>
  );
}
