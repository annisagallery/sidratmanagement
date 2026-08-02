'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import Swal from 'sweetalert2';
import Image from 'next/image';
import * as api from 'src/services';
import { addressDistrict, addressUpazila, districts, upazilasForDistrict } from 'src/utils/bangladeshAddress';

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
const fmtPlain = (n) => Number(n || 0).toLocaleString('en-BD');
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

const selectedAttributesForOrder = (item = {}) =>
  (item.attrDimensions || [])
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
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)] disabled:bg-gray-50 disabled:text-gray-400';
const sm =
  'border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)] disabled:bg-gray-50 disabled:text-gray-400';

function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-md shadow-sm ${className}`}>
      {title && (
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 rounded-t-md">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function Label({ children, required }) {
  return (
    <label className="block text-xs font-medium text-gray-500 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

// ─── Product Search ──────────────────────────────────────────────────────────
function POSProductSearch({ onAdd }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      <input value={q} onChange={handleChange} placeholder="Search" className={inp} autoComplete="off" />

      {busy && <span className="absolute right-3 top-2.5 text-xs text-gray-400 animate-pulse">Searching…</span>}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[99] mt-1 max-h-80 overflow-auto rounded-md border border-gray-200 bg-white shadow-xl">
          {results.map((product) => {
            const key = product.id || product.id || product.slug;
            const stock =
              product.stock ??
              product.quantity ??
              product.variations?.reduce((s, v) => s + availableForVariation(v), 0);

            return (
              <button
                key={key}
                type="button"
                onClick={() => pick(product)}
                className="flex w-full items-center justify-between gap-4 border-b border-gray-50 px-4 py-2.5 text-left text-sm hover:bg-[var(--brand-soft)] last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800">{product.name || product.title}</p>
                  <p className="text-[11px] text-gray-400">Stock: {stock ?? '—'}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-gray-500">
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
function ItemsTable({ items, onUpdate, onRemove, onDuplicate }) {
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
      stock: isCustom ? 0 : Math.max(0, availableForVariation(matched) - Number(matched?.presaleAvailable || 0)),
      overSale: isCustom ? true : Boolean(matched?.overSale ?? item.overSale),
      isCustom,
      availableQuantity: isCustom ? null : availableForVariation(matched),
      preorderCapacity: matched?.preorderCapacity ?? null
    });
  };

  if (!items.length) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/60 px-4 py-8 text-center">
        <p className="text-sm font-medium text-gray-500">No product added yet</p>
        <p className="mt-1 text-xs text-gray-400">Start typing above, then click a product from the dropdown.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200">
      <table className="w-full min-w-[1040px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-gray-50 text-[9px] uppercase tracking-wide text-gray-400">
            <th className="w-32 px-1.5 py-1.5 text-left">Name</th>
            <th className="w-[460px] px-1 py-1.5 text-left">Options</th>
            <th className="w-12 px-1 py-1.5 text-center">Stock</th>
            <th className="w-16 px-1 py-1.5 text-right">Regular</th>
            <th className="w-16 px-1 py-1.5 text-right">D.Price</th>
            <th className="w-16 px-1 py-1.5 text-right">Custom</th>
            <th className="w-16 px-1 py-1.5 text-right">Subtotal</th>
            <th className="w-10 px-1 py-1.5 text-center">Qty</th>
            <th className="w-16 px-1 py-1.5 text-right">Total</th>
            <th className="w-16 px-1 py-1.5 text-center">Action</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => {
            const isTypeCustom = item.selectedAttrs['Type'] === 'Custom';
            const baseUnit =
              item.discountPrice != null && item.discountPrice !== ''
                ? Number(item.discountPrice)
                : Number(item.regularPrice || 0);
            const subtotal = baseUnit * Number(item.qty || 1);
            const lineTotal = getLineUnit(item) * Number(item.qty || 1);
            const totalAvailable =
              item.availableQuantity == null ? (item.overSale ? null : item.stock) : Number(item.availableQuantity);
            const stockLabel =
              item.stock > 0
                ? `${item.stock}${totalAvailable != null && totalAvailable > item.stock ? ` +${totalAvailable - item.stock}` : ''}`
                : totalAvailable == null
                  ? 'Pre'
                  : totalAvailable > 0
                    ? `Pre ${totalAvailable}`
                    : 'Out';
            const stockTone =
              item.stock > 0
                ? 'bg-green-50 text-green-700'
                : item.overSale
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-600';

            return (
              <React.Fragment key={item._key}>
                <tr className="border-t border-gray-100 align-top hover:bg-gray-50/40">
                  <td rowSpan={2} className="px-1.5 py-2 align-top">
                    <p className="font-semibold text-[15px] leading-tight text-gray-800">{item.productName}</p>
                    <button
                      type="button"
                      onClick={() => updateAttrs(item, 'Type', isTypeCustom ? 'Standard' : 'Custom')}
                      className={`mt-1 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${isTypeCustom ? 'bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'bg-gray-100 text-gray-400'}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-md transition-colors ${isTypeCustom ? 'bg-[var(--brand-soft)]0' : 'bg-gray-300'}`}
                      />
                      {isTypeCustom ? 'Custom' : 'Standard'}
                    </button>
                  </td>

                  <td className="px-1.5 py-2 align-top">
                    {(() => {
                      const nonTypeDims = item.attrDimensions.filter((d) => d.name !== 'Type');
                      if (!nonTypeDims.length)
                        return <span className="text-[10px] italic text-gray-300">No variant attributes</span>;
                      return (
                        <div className="flex flex-nowrap items-center gap-1 overflow-x-auto">
                          {nonTypeDims.map((dim) => {
                            const values =
                              isTypeCustom && !dim.values.includes('Custom') ? [...dim.values, 'Custom'] : dim.values;
                            return (
                              <div key={dim.name} className="shrink-0">
                                <select
                                  value={item.selectedAttrs[dim.name] || ''}
                                  onChange={(e) => updateAttrs(item, dim.name, e.target.value)}
                                  title={dim.name}
                                  className={`${sm} h-7 min-w-[86px] px-1 py-0 text-[10px] font-semibold text-gray-700`}
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

                  <td className="px-1.5 py-2 text-center align-top">
                    <input
                      readOnly
                      disabled
                      value={stockLabel}
                      className={`${sm} h-7 w-full px-1 text-center text-[10px] font-semibold ${stockTone}`}
                    />
                  </td>

                  <td className="px-1.5 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      value={item.regularPrice ?? ''}
                      onChange={(e) => onUpdate(item._key, { regularPrice: Number(e.target.value) || 0 })}
                      className={`${sm} h-7 w-full px-1 text-right text-[10px]`}
                    />
                  </td>

                  <td className="px-1.5 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      value={item.discountPrice ?? ''}
                      onChange={(e) =>
                        onUpdate(item._key, {
                          discountPrice: e.target.value === '' ? null : Number(e.target.value) || 0
                        })
                      }
                      placeholder="—"
                      className={`${sm} h-7 w-full px-1 text-right text-[10px]`}
                    />
                  </td>

                  <td className="px-1.5 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      value={item.customizePrice || ''}
                      onChange={(e) => onUpdate(item._key, { customizePrice: Number(e.target.value) || 0 })}
                      placeholder="Extra"
                      disabled={!isTypeCustom}
                      className={`${sm} h-7 w-full px-1 text-right text-[10px]`}
                    />
                  </td>

                  <td className="px-1.5 py-2 text-right align-top">
                    <input
                      readOnly
                      disabled
                      value={fmtPlain(subtotal)}
                      className={`${sm} h-7 w-full px-1 text-right text-[10px] font-bold text-gray-700`}
                    />
                  </td>

                  <td className="px-1.5 py-2 text-center align-top">
                    <input
                      type="number"
                      min="1"
                      max={totalAvailable == null ? undefined : Math.max(1, totalAvailable)}
                      value={item.qty}
                      onChange={(e) => onUpdate(item._key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      className={`${sm} h-7 w-full px-1 text-center text-[10px]`}
                    />
                  </td>

                  <td className="px-1.5 py-2 text-right align-top">
                    <input
                      readOnly
                      disabled
                      value={fmtPlain(lineTotal)}
                      className={`${sm} h-7 w-full px-1 text-right text-[10px] font-bold text-gray-800`}
                    />
                  </td>

                  <td className="px-1.5 py-2 text-center align-top">
                    <div className="flex  gap-1">
                      <button
                        type="button"
                        onClick={() => onDuplicate(item._key)}
                        className={`${sm} h-6 w-full px-0 py-0 text-[13px] leading-none text-gray-400 hover:bg-blue-50 hover:text-blue-500`}
                        title="Duplicate item"
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(item._key)}
                        className={`${sm} h-6 w-full px-0 py-0 text-base leading-none text-gray-300 hover:bg-red-50 hover:text-red-500`}
                        title="Remove item"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>

                <tr className="border-b border-gray-100 bg-gray-50/30 align-top">
                  <td colSpan={9} className="px-1.5 pb-2 pt-0">
                    <input
                      value={item.customizeDetails}
                      onChange={(e) => onUpdate(item._key, { customizeDetails: e.target.value })}
                      disabled={!isTypeCustom}
                      placeholder={
                        isTypeCustom
                          ? 'Customization note / measurement / instruction'
                          : 'Set Type to Custom to add details'
                      }
                      className={`${sm} h-7 w-full px-1 text-[10px] placeholder:text-gray-300`}
                    />
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
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

  return (
    <div className="space-y-3">
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Admin note — internal only"
        className={`${inp} resize-none`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative h-16 w-16 overflow-hidden rounded-md border border-gray-200 bg-gray-50"
          >
            <Image src={img.preview} alt={img.name || 'Admin note'} fill className="object-cover" />
            <button
              type="button"
              onClick={() => removeImage(img.id)}
              className="absolute inset-0 hidden items-center justify-center bg-black/50 text-xl text-white group-hover:flex"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-200 text-gray-400 hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="mt-0.5 text-[10px]">Image</span>
        </button>

        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />
      </div>
    </div>
  );
}

// ─── Customer Section ─────────────────────────────────────────────────────────
function CustomerSection({ address, onCustomerChange, onAddressChange, onFraudData, onShippingChange }) {
  const [phone, setPhone] = useState(address.phone || '');
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrIdx, setSelectedAddrIdx] = useState(0);
  const [showAddrList, setShowAddrList] = useState(false);
  const requestRef = useRef(0);
  const addrWrapRef = useRef(null);
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
    onAddressChange({ ...address, district, upazila: '' });
  };

  const handleUpazilaChange = (upazila) => {
    onAddressChange({ ...address, upazila });
  };

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

      try {
        const res = await api.lookupCustomerByAdmin(q);
        if (id !== requestRef.current) return;

        const c = res?.data;
        onCustomerChange(c);
        onFraudData(c?.fraud ?? null);
        const addrs = c?.addresses || [];
        setSavedAddresses(addrs);
        setSelectedAddrIdx(-1); // nothing selected yet
        if (addrs.length > 0) setShowAddrList(true);
        // Seed the delivery phone with the number just searched. The not-found
        // branch below already does this; leaving the found branch blank is how
        // an order reached the courier with no phone on it.
        onAddressChange({ name: c?.name || '', phone: q, district: '', upazila: '', address: '' });
      } catch (err) {
        if (id !== requestRef.current) return;
        // Backend returns fraud data even on 404 (new customer) — read it from the error body
        const fraudFromError = err?.response?.data?.fraud ?? null;
        onCustomerChange({ phone: q, isNew: true });
        onAddressChange({ name: '', phone: q, district: '', upazila: '', address: '' });
        onFraudData(fraudFromError);
      } finally {
        if (id === requestRef.current) setLoading(false);
      }
    },
    [phone, onCustomerChange, onAddressChange, onFraudData]
  );

  const handleSelectSavedAddress = (addr, idx) => {
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

  const updateAddress = (key, val) => onAddressChange({ ...address, [key]: val });

  return (
    <div className="space-y-3">
      {/* Phone + Find button */}
      <div>
        <Label required>Phone</Label>
        <div ref={addrWrapRef} className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={(e) => e.key === 'Enter' && doLookup()}
              placeholder="Customer phone number"
              className={`${inp} w-full ${savedAddresses.length > 0 ? 'pr-7' : ''}`}
            />
            {savedAddresses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddrList((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
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
            className="shrink-0 rounded-md border border-[var(--brand-ring)] bg-[var(--brand-soft)] px-4 py-2 text-xs font-semibold text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Finding…' : 'Find'}
          </button>

          {/* Address dropdown — same pattern as product search */}
          {showAddrList && savedAddresses.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-xl">
              {savedAddresses.map((addr, i) => {
                const text = [addr.name, addressDistrict(addr), addressUpazila(addr), addr.address].filter(Boolean).join(' - ');
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSavedAddress(addr, i)}
                    className={`flex w-full items-center border-b border-gray-50 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-[var(--brand-soft)] ${selectedAddrIdx === i ? 'bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'text-gray-700'}`}
                  >
                    <p className="truncate">{text}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Name (4) · District (3) · Upazila (3) · Address (10) */}
      <div className="grid grid-cols-10 gap-3">
        <div className="col-span-4">
          <Label required>Name</Label>
          <input value={address.name || ''} onChange={(e) => updateAddress('name', e.target.value)} className={inp} />
        </div>
        <div className="col-span-3">
          <Label>District</Label>
          <select value={address.district || ''} onChange={(e) => handleDistrictChange(e.target.value)} className={inp}>
            <option value="">Select district...</option>
            {districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-3">
          <Label>Upazila</Label>
          <select
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
        <div className="col-span-10">
          <Label required>Address</Label>
          <textarea
            rows={2}
            value={address.address || ''}
            onChange={(e) => updateAddress('address', e.target.value)}
            className={`${inp} resize-none`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Customer Stats Card ──────────────────────────────────────────────────────
function CustomerStatsCard({ customer, fraudData, className = '' }) {
  const isNew = customer?.isNew === true;
  const hasAnyData = customer || fraudData; // show table once lookup ran

  const our = {
    total: customer?.totalOrders ?? 0,
    delivered: customer?.delivered ?? 0,
    pending: customer?.pending ?? 0,
    returned: customer?.returned ?? 0
  };
  const pathao = fraudData?.pathao ?? null;
  const sf = fraudData?.steadFast ?? null;
  const carryBee = fraudData?.carryBee ?? null;

  // Colored number cell
  const N = ({ v, color = 'text-gray-700' }) => (
    <td className={`py-2 pr-3 text-right text-xs font-bold tabular-nums ${v ? color : 'text-gray-300'}`}>{v ?? '—'}</td>
  );

  // Label + error spanning all data columns
  const ErrRow = ({ label, msg }) => (
    <tr>
      <td className="px-3 py-2 text-[11px] font-semibold text-gray-600">{label}</td>
      <td colSpan={4} className="py-2 pr-3 text-[10px] italic text-red-400">
        {msg}
      </td>
    </tr>
  );

  return (
    <div className={`bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Customer Stats</p>
      </div>

      {!hasAnyData ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-xs text-gray-300">Enter phone to load stats.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-400 w-[35%]"></th>
                <th className="pr-3 py-1.5 text-right text-[10px] font-semibold text-gray-500">Total</th>
                <th className="pr-3 py-1.5 text-right text-[10px] font-semibold text-green-500">Deliv.</th>
                <th className="pr-3 py-1.5 text-right text-[10px] font-semibold text-amber-500">Pend.</th>
                <th className="pr-3 py-1.5 text-right text-[10px] font-semibold text-red-400">Ret.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Our orders — always show; 0s for new customer make it clear they have none */}
              <tr>
                <td className="px-3 py-2 text-[11px] font-semibold text-gray-600">Our Orders</td>
                {isNew ? (
                  <td colSpan={4} className="py-2 pr-3 text-[10px] italic text-gray-300 text-right">
                    New customer
                  </td>
                ) : (
                  <>
                    <N v={our.total} color="text-gray-700" />
                    <N v={our.delivered} color="text-green-600" />
                    <N v={our.pending} color="text-amber-500" />
                    <N v={our.returned} color="text-red-500" />
                  </>
                )}
              </tr>
              {/* Pathao */}
              {pathao ? (
                <tr>
                  <td className="px-3 py-2 text-[11px] font-semibold text-gray-600">Pathao</td>
                  <N v={pathao.total} color="text-gray-700" />
                  <N v={pathao.success} color="text-green-600" />
                  <td className="py-2 pr-3 text-right text-xs text-gray-300">—</td>
                  <N v={pathao.returned} color="text-red-500" />
                </tr>
              ) : (
                <ErrRow label="Pathao" msg={fraudData?.errors?.pathao || '—'} />
              )}
              {/* Steadfast */}
              {sf ? (
                <tr>
                  <td className="px-3 py-2 text-[11px] font-semibold text-gray-600">Steadfast</td>
                  <N v={sf.total} color="text-gray-700" />
                  <N v={sf.success} color="text-green-600" />
                  <td className="py-2 pr-3 text-right text-xs text-gray-300">—</td>
                  <N v={sf.returned} color="text-red-500" />
                </tr>
              ) : (
                <ErrRow label="Steadfast" msg={fraudData?.errors?.steadFast || '—'} />
              )}
              {carryBee ? (
                <tr>
                  <td className="px-3 py-2 text-[11px] font-semibold text-gray-600">CarryBee</td>
                  <N v={carryBee.total} color="text-gray-700" />
                  <N v={carryBee.success} color="text-green-600" />
                  <td className="py-2 pr-3 text-right text-xs text-gray-300">—</td>
                  <N v={carryBee.returned} color="text-red-500" />
                </tr>
              ) : (
                <ErrRow label="CarryBee" msg={fraudData?.errors?.carryBee || '—'} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
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

  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (!tags.length) {
    return <p className="text-xs text-gray-400">No active tags found.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const id = tag.id || tag.id;
        const active = selected.includes(id);

        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
              active
                ? 'border-transparent text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
            }`}
            style={active ? { backgroundColor: tag.color || '#4f46e5', borderColor: tag.color || '#4f46e5' } : {}}
          >
            {tag.name || tag.title}
          </button>
        );
      })}
    </div>
  );
}

// ─── Delivery ─────────────────────────────────────────────────────────────────
function DeliverySection({ value, onChange, deliveryTypes = DEFAULT_DELIVERY_TYPES }) {
  const today = new Date().toISOString().split('T')[0];

  const selectType = (type) => {
    const found = deliveryTypes.find((item) => item.key === type);
    onChange({ deliveryType: type, estimatedDelivery: addDays(found?.days ?? 7) });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {deliveryTypes.map((type) => {
          const active = value.deliveryType === type.key;
          return (
            <button
              key={type.key}
              type="button"
              onClick={() => selectType(type.key)}
              className={`rounded-md border px-2 py-2 text-center transition ${
                active
                  ? 'border-[var(--brand-ring)] bg-[var(--brand-soft)] text-[var(--brand-strong)]'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
              }`}
            >
              <span className="block text-xs font-bold">{type.label}</span>
              <span className="mt-0.5 block text-[10px] opacity-70">{type.hint}</span>
            </button>
          );
        })}
      </div>

      <div>
        <Label>Estimated Delivery Time</Label>
        <input
          type="date"
          min={today}
          value={value.estimatedDelivery || ''}
          onChange={(e) => onChange({ ...value, estimatedDelivery: e.target.value })}
          className={`${sm} w-full`}
        />
      </div>
    </div>
  );
}

// ─── Payment TrxID Lookup ──────────────────────────────────────────────────────
function TrxLookupSection({ linked, onChange }) {
  const [trxInput, setTrxInput] = useState('');
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const val = trxInput.trim();
    if (!val) return;
    if (linked.find((p) => p.trxId === val))
      return Swal.fire('Already added', `TrxID ${val} is already in this order`, 'info');
    setSearching(true);
    try {
      const res = await api.getPaymentByTrxId(val);
      const payment = res?.data;
      if (!payment) return Swal.fire('Not found', 'No payment with that TrxID', 'warning');
      if (payment.orderId) {
        const go = await Swal.fire({
          title: 'Already assigned',
          html: `This payment is already assigned to order <b>#${payment.orderNo}</b>.<br/>Do you still want to link it?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Link anyway',
          confirmButtonColor: '#f59e0b'
        });
        if (!go.isConfirmed) return;
      }
      onChange([...linked, payment]);
      setTrxInput('');
    } catch (e) {
      Swal.fire('Not found', e?.response?.data?.message || 'No payment with that TrxID', 'warning');
    } finally {
      setSearching(false);
    }
  };

  const remove = (id) => onChange(linked.filter((p) => p.id !== id));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={trxInput}
          onChange={(e) => setTrxInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Enter TrxID to find payment"
          className={`${sm} flex-1`}
        />
        <button
          type="button"
          onClick={search}
          disabled={searching || !trxInput.trim()}
          className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-bold text-white hover:brightness-95 disabled:opacity-50 whitespace-nowrap"
        >
          {searching ? '…' : 'Find'}
        </button>
      </div>

      {linked.length > 0 && (
        <div className="overflow-hidden rounded-md border border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">TrxID</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="w-9 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {linked.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-semibold uppercase text-gray-700">{p.type}</td>
                  <td className="px-3 py-2 font-mono text-gray-400">{p.trxId || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-gray-700">{fmt(p.amount)}</td>
                  <td className="px-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      className="text-lg leading-none text-gray-300 hover:text-red-500"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-100 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-3 py-2 font-bold text-gray-500">
                  Total Linked
                </td>
                <td className="px-3 py-2 text-right font-bold text-gray-800">
                  {fmt(linked.reduce((s, p) => s + p.amount, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {linked.length === 0 && (
        <p className="text-xs text-center text-gray-400 py-2">
          Search a TrxID to link an existing payment to this order
        </p>
      )}
    </div>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
function OrderSummary({ items, linkedPayments, shipping, discount, onShippingChange, onDiscountChange }) {
  const subTotal = items.reduce((sum, item) => sum + getLineUnit(item) * Number(item.qty || 1), 0);
  const totalPaid = linkedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const total = Math.max(0, subTotal + Number(shipping || 0) - Number(discount || 0));
  const due = Math.max(0, total - totalPaid);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Shipping</Label>
          <input
            type="number"
            min="0"
            value={shipping}
            onChange={(e) => onShippingChange(e.target.value)}
            className={`${sm} w-full text-right`}
          />
        </div>
        <div>
          <Label>Order Discount</Label>
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
            className={`${sm} w-full text-right`}
          />
        </div>
      </div>

      <div className="space-y-1.5 border-t border-gray-100 pt-2 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Product subtotal</span>
          <span>{fmt(subTotal)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Shipping</span>
          <span>{fmt(shipping)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Discount</span>
          <span>-{fmt(discount)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-2  font-bold text-gray-800">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
        <div className="flex justify-between text-xs font-semibold text-[var(--brand-strong)]">
          <span>Paid</span>
          <span>{fmt(totalPaid)}</span>
        </div>
        <div className="flex justify-between text-xs font-bold text-orange-500">
          <span>Due</span>
          <span>{fmt(due)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CreateOrder({ orderNo = null }) {
  const isEdit = Boolean(orderNo);
  const router = useRouter();

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
  const { data: existingOrderData } = useQuery(['admin-order-edit', orderNo], () => api.getOrderByAdmin(orderNo), {
    enabled: isEdit,
    refetchOnWindowFocus: false
  });

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

    // Customer
    if (o.userId) {
      setCustomer({
        id: o.userId.id || o.userId,
        name: o.userId.name || '',
        phone: addr.phone || o.userId.phone || ''
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
          base._serverProductionBatch = si.productionBatch || null;

          // Restore saved attribute selection
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
    if (!address.phone?.trim()) return Swal.fire('Enter the delivery phone number', '', 'warning');
    if (!address.name) return Swal.fire('Enter customer name', '', 'warning');
    if (!address.address) return Swal.fire('Enter customer address', '', 'warning');
    if (!items.length) return Swal.fire('Add at least one product', '', 'warning');

    setSubmitting(true);

    // ── Edit mode ──────────────────────────────────────────────────────────────
    if (isEdit) {
      try {
        // 1. Remove items that were deleted from the list
        const currentServerIds = new Set(items.filter((i) => i._serverId).map((i) => i._serverId));
        for (const id of originalServerItemIds) {
          if (!currentServerIds.has(id)) await api.removeItemFromOrder({ orderNo, itemId: id });
        }

        // 2. Update existing items whose product, variation, quantity, or customization changed.
        for (const item of items.filter((i) => i._serverId)) {
          if (!item.selectedVariationId) {
            await Swal.fire('Missing variation', `Select a variation for "${item.productName}"`, 'warning');
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
            const result = await Swal.fire({
              title: 'Update item already in production?',
              text: 'This custom item may already be in the production workflow. Updating it will release the old reservation and reserve/queue the new selection.',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Yes, update item',
              cancelButtonText: 'Keep current item'
            });
            if (!result.isConfirmed) {
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
              const result = await Swal.fire({
                title: 'Production confirmation required',
                text: error.response.data.message || 'This custom item is already in production. Confirm before updating it.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Update anyway',
                cancelButtonText: 'Cancel update'
              });
              if (!result.isConfirmed) {
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
            await Swal.fire('Missing variation', `Select a variation for "${item.productName}"`, 'warning');
            setSubmitting(false);
            return;
          }
          await api.addItemToOrder({
            orderNo,
            ...orderItemPayload(item)
          });
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
        await api.updateOrderStatus({
          id: orderNo,
          shippingAddress: address,
          shipping: Number(shipping || 0),
          discount: Number(discount || 0),
          deliveryType: delivery.deliveryType,
          estimatedDelivery: delivery.estimatedDelivery || null,
          tags
        });

        await Swal.fire('Order Updated', `Order #${orderNo} has been updated.`, 'success');
        router.push(`/orders/${orderNo}`);
      } catch (e) {
        Swal.fire(e?.response?.data?.message || e?.message || 'Failed to update order', '', 'error');
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
        paymentMethod: linkedPayments[0]?.type || 'cod'
      };

      const res = await api.createAdminOrder(payload);
      await Swal.fire(
        'Order Created',
        `Order No: ${res?.data?.orderNo || res?.data?.orderNumber || 'Created'}`,
        'success'
      );
      router.push('/orders');
    } catch (e) {
      Swal.fire(e?.response?.data?.message || e?.message || 'Failed to create order', '', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading skeleton for edit mode while fetching order + products
  if (isEdit && !initialized) {
    return (
      <div className="space-y-4">
        {[180, 320, 120].map((h, i) => (
          <div key={i} className="bg-gray-100 rounded-md animate-pulse" style={{ height: h }} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Edit-mode breadcrumb */}
      {isEdit && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/orders/${orderNo}`)}
              className="text-sm text-gray-500 hover:text-gray-800 transition"
            >
              ← Back to order
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-700">
              Edit Order <span className="text-[var(--brand-strong)]">#{orderNo}</span>
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Top row: Customer | Stats | Delivery+Tags — all equal height via grid stretch */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <Card title="Customer" className="xl:col-span-2">
              {/* key forces re-mount after edit-mode data loads so phone initialises correctly */}
              <CustomerSection
                key={initialized ? 'ready' : 'init'}
                address={address}
                onCustomerChange={setCustomer}
                onAddressChange={setAddress}
                onFraudData={setFraudData}
                onShippingChange={setShipping}
              />
            </Card>
            <CustomerStatsCard customer={customer} fraudData={fraudData} />
            {/* Delivery type + Tags in one card */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Delivery &amp; Tags</p>
              </div>
              <div className="p-4 flex flex-col gap-4 flex-1">
                <DeliverySection value={delivery} onChange={setDelivery} deliveryTypes={deliveryTypes} />
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Tags</p>
                  <TagPicker selected={tags} onChange={setTags} />
                </div>
              </div>
            </div>
          </div>

          <Card title="Products">
            <div className="space-y-3">
              <POSProductSearch onAdd={addItem} />
              <ItemsTable items={items} onUpdate={updateItem} onRemove={removeItem} onDuplicate={duplicateItem} />
            </div>
          </Card>
          {!isEdit && (
            <Card title="Initial Admin Comment">
              <AdminNote
                value={adminNote}
                onChange={setAdminNote}
                images={adminNoteImages}
                onImagesChange={setAdminNoteImages}
              />
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card title="Payment Summary">
            <OrderSummary
              items={items}
              linkedPayments={linkedPayments}
              shipping={shipping}
              discount={discount}
              onShippingChange={setShipping}
              onDiscountChange={setDiscount}
            />
          </Card>

          <Card title="Payments">
            <TrxLookupSection linked={linkedPayments} onChange={setLinkedPayments} />
          </Card>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !items.length}
            className="mt-4 w-full rounded-md bg-[var(--brand)] py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (isEdit ? 'Saving…' : 'Placing Order…') : isEdit ? 'Save Changes' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
