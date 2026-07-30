'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import Swal from 'sweetalert2';
import Image from 'next/image';
import * as api from 'src/services';
import {
  MdAdd,
  MdClose,
  MdImage,
  MdChevronRight,
  MdChevronLeft,
  MdAutorenew,
  MdInfo,
  MdTune,
  MdStar,
  MdStarOutline,
  MdShoppingCart,
  MdFlashOn,
  MdVisibility,
  MdVisibilityOff
} from 'react-icons/md';
import { FaRegStar, FaStar } from 'react-icons/fa6';
import { FiStar } from 'react-icons/fi';
import RichTextEditor from 'src/components/richTextEditor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function splitLegacyCodes(value) {
  const codes = [...new Set(
    String(value || '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean)
  )];
  return {
    primaryBarcode: codes[0] || null,
    legacyBarcodes: codes.slice(1)
  };
}

function cartesian(arrays) {
  if (!arrays.length) return [[]];
  const [first, ...rest] = arrays;
  const tail = cartesian(rest);
  return first.flatMap((item) => tail.map((combo) => [item, ...combo]));
}

function buildVariations(attrSelections, existingVars, basePrice) {
  const entries = Object.values(attrSelections).filter((e) => e.forVariation && e.values.length > 0);

  // No variation-driving attributes → show one default row so admin can set stock/oversale
  if (!entries.length) {
    const existing = existingVars.find((ev) => ev.attributes.length === 0);
    return [
      {
        attributes: [],
        customPrice: false,
        regularPrice: null,
        salePrice: null,
        overSale: existing?.overSale ?? false,
        productionCode: existing?.productionCode ?? null,
        legacyCodes:
          existing?.legacyCodes ??
          [existing?.primaryBarcode, ...(existing?.legacyBarcodes || [])].filter(Boolean).join(', '),
        imageId: existing?.imageId ?? null,
        enabled: existing?.enabled ?? true
      }
    ];
  }

  const valueSets = entries.map((e) =>
    e.values.map((v) => ({
      attribute: e.attr.id,
      attributeName: e.attr.name,
      value: v.id,
      valueName: v.value,
      colorHex: v.colorHex || null
    }))
  );

  return cartesian(valueSets).map((combo) => {
    // Match by checking every combo value appears in the existing variation's attributes
    const existing = existingVars.find(
      (ev) =>
        ev.attributes.length === combo.length &&
        combo.every((c) => ev.attributes.some((a) => (a.value?.id || a.value)?.toString() === c.value?.toString()))
    );
    const customPrice = existing ? existing.regularPrice != null : false;
    return {
      attributes: combo,
      customPrice,
      regularPrice: existing?.regularPrice ?? null,
      salePrice: existing?.salePrice ?? null,
      overSale: existing?.overSale ?? false,
      productionCode: existing?.productionCode ?? null,
      legacyCodes:
        existing?.legacyCodes ??
        [existing?.primaryBarcode, ...(existing?.legacyBarcodes || [])].filter(Boolean).join(', '),
      imageId: existing?.imageId ?? null,
      enabled: existing?.enabled ?? true
    };
  });
}

async function doUpload(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('model', 'product');
  return api.uploadImage(fd); // uploadImage already returns the image doc, not the axios wrapper
}

// ── Size chart uploader ───────────────────────────────────────────────────────

function SizeChartUploader({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      onChange(await doUpload(file));
    } catch {
      Swal.fire('Upload failed', '', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };
  return (
    <div>
      {value?.path ? (
        <div className="relative h-40 border rounded-md overflow-hidden group bg-gray-50 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src={value.path} alt="size chart" fill className="object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition shadow"
          >
            <MdClose size={14} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition bg-gray-50">
          {uploading ? (
            <MdAutorenew className="animate-spin text-blue-400" size={28} />
          ) : (
            <>
              <MdImage size={28} className="text-gray-300" />
              <span className="text-xs text-gray-400 mt-2">Upload size chart</span>
            </>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handle} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

// ── Image pool ────────────────────────────────────────────────────────────────

function ImagePool({ pool, setPool, featuredId, setFeaturedId }) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(doUpload));
      setPool((prev) => {
        const next = [...prev, ...uploaded];
        if (!featuredId && next.length > 0) setFeaturedId(next[0].id);
        return next;
      });
    } catch {
      Swal.fire('Upload failed', '', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeFromPool = (id) => {
    setPool((prev) => {
      const next = prev.filter((img) => img.id !== id);
      if (featuredId === id) setFeaturedId(next[0]?.id || null);
      return next;
    });
  };

  return (
    <div>
      {pool.length === 0 ? (
        <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition bg-gray-50">
          {uploading ? (
            <MdAutorenew className="animate-spin text-blue-400" size={32} />
          ) : (
            <>
              <MdImage size={36} className="text-gray-300" />
              <span className="text-sm text-gray-400 mt-2 font-medium">Upload product images</span>
              <span className="text-xs text-gray-400 mt-1">Select multiple files at once</span>
            </>
          )}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-3">
            {pool.map((img) => {
              const isFeatured = img.id === featuredId;
              return (
                <div
                  key={img.id}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 group transition-all ${isFeatured ? 'border-yellow-400 shadow-md' : 'border-gray-200'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Image src={img.path} alt="" fill className="object-cover" />
                  {isFeatured && (
                    <div className="absolute bottom-0 inset-x-0 bg-yellow-400/90 text-yellow-900 text-[10px] font-semibold text-center py-0.5">
                      FEATURED
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-start justify-between p-1.5">
                    <button
                      type="button"
                      onClick={() => setFeaturedId(img.id)}
                      className={`p-1 rounded-md transition ${isFeatured ? 'text-yellow-400' : 'text-white hover:text-yellow-300'}`}
                    >
                      {isFeatured ? <MdStar size={18} /> : <MdStarOutline size={18} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromPool(img.id)}
                      className="p-1 rounded-md text-white hover:text-red-300 transition"
                    >
                      <MdClose size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition">
              {uploading ? (
                <MdAutorenew className="animate-spin text-blue-400" size={22} />
              ) : (
                <>
                  <MdAdd size={22} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400 mt-1">Add more</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFiles}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="text-xs text-gray-400">
            Click ★ on any image to set it as featured. Images can be assigned to individual variations in the next
            step.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Live preview — mimics the product detail page ─────────────────────────────

function LivePreview({
  name,
  slug,
  status,
  isFeatured,
  catName,
  price,
  priceSale,
  shortDescription,
  featuredImg,
  imagePool,
  sizeChart,
  attrSelections,
  variations,
  saving,
  onSave,
  isEdit
}) {
  const [previewAttr, setPreviewAttr] = useState({});
  const [carouselIdx, setCarouselIdx] = useState(0);

  const images = imagePool.length > 0 ? imagePool : featuredImg ? [featuredImg] : [];
  const displayImg = images[carouselIdx] ?? featuredImg;
  useEffect(() => {
    setCarouselIdx(0);
  }, [featuredImg, imagePool.length]);

  const varAttrEntries = Object.values(attrSelections).filter((e) => e.forVariation && e.values.length > 0);
  const infoAttrEntries = Object.values(attrSelections).filter((e) => !e.forVariation && e.values.length > 0);

  const displayPrice = (() => {
    const baseRegular = Number(price) || 0;
    const baseSale = priceSale ? Number(priceSale) : null;
    if (!variations.length) {
      return baseSale && baseSale < baseRegular
        ? { show: baseSale, original: baseRegular }
        : { show: baseRegular, original: null };
    }
    const allPrices = variations.map((v) => {
      const reg = v.customPrice ? (v.regularPrice ?? baseRegular) : baseRegular;
      const sale = v.customPrice ? v.salePrice : baseSale;
      return { eff: sale != null && sale > 0 && sale < reg ? sale : reg, reg };
    });
    const minEff = Math.min(...allPrices.map((p) => p.eff));
    const maxReg = Math.max(...allPrices.map((p) => p.reg));
    return { show: minEff, original: minEff < maxReg ? maxReg : null };
  })();

  return (
    <div className="w-80 shrink-0 hidden xl:block">
      <div className="sticky top-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Live Preview</p>

        <div className="bg-white border rounded-md overflow-hidden shadow-sm">
          {/* Image carousel */}
          <div className="relative bg-gray-50 aspect-square overflow-hidden">
            {displayImg?.path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <Image src={displayImg.path} alt="" fill className="object-contain" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-200">
                <MdImage size={56} />
                <span className="text-xs text-gray-300 mt-2">No image yet</span>
              </div>
            )}
            {/* Nav arrows */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCarouselIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-md p-1 shadow transition"
                >
                  <MdChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setCarouselIdx((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-md p-1 shadow transition"
                >
                  <MdChevronRight size={18} />
                </button>
              </>
            )}
            {/* Thumbnail dots */}
            {images.length > 1 && (
              <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCarouselIdx(i)}
                    className={`rounded-md transition-all ${i === carouselIdx ? 'w-4 h-1.5 bg-[var(--brand)]' : 'w-1.5 h-1.5 bg-gray-400'}`}
                  />
                ))}
              </div>
            )}
            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-1.5 bg-white/60 backdrop-blur overflow-x-auto no-scrollbar">
                {images.slice(0, 6).map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCarouselIdx(i)}
                    className={`shrink-0 w-10 h-10 rounded-md border-2 overflow-hidden transition ${i === carouselIdx ? 'border-blue-500' : 'border-transparent'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <Image src={img.path} alt="" fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
            {/* Badges */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              <StatusBadge status={status} />
              {isFeatured && (
                <span className="text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-md font-semibold">
                  ⭐ Featured
                </span>
              )}
              {priceSale && (
                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md font-semibold">SALE</span>
              )}
            </div>
          </div>

          {/* Product info */}
          <div className="p-4 space-y-3">
            {/* Name */}
            <div>
              <h2 className="font-bold text-gray-900 text-base leading-tight line-clamp-2">
                {name || <span className="text-gray-300 font-normal italic text-sm">Product name…</span>}
              </h2>
              {catName && <p className="text-xs text-gray-400 mt-0.5">{catName}</p>}
              {slug && <p className="text-[10px] text-gray-300 font-mono mt-0.5 truncate">/{slug}</p>}
            </div>

            {/* Stars (placeholder) */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <FaRegStar key={s} className="text-gray-200 w-3 h-3" />
              ))}
              <span className="text-xs text-gray-300 ml-1">No reviews yet</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              {displayPrice.show ? (
                <>
                  <span className="text-xl font-bold text-gray-900">৳{displayPrice.show}</span>
                  {displayPrice.original && (
                    <span className="text-sm text-red-400 line-through">৳{displayPrice.original}</span>
                  )}
                </>
              ) : (
                <span className="text-gray-300 italic text-sm">Set a price…</span>
              )}
            </div>

            {/* Short description */}
            {shortDescription && <p className="text-xs text-gray-500 border-t pt-2 line-clamp-2">{shortDescription}</p>}

            {/* Variation attributes */}
            {varAttrEntries.length > 0 && (
              <div className="border-t pt-2 space-y-2">
                {varAttrEntries.map((e) => {
                  const isColor = e.attr.type === 'color';
                  const sel = previewAttr[e.attr.id];
                  return (
                    <div key={e.attr.id}>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {e.attr.name}
                        {sel && <span className="font-normal text-gray-400 ml-1">: {sel.value}</span>}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {e.values.map((v) => {
                          const isSel = sel?.id === v.id;
                          return isColor && v.colorHex ? (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() =>
                                setPreviewAttr((p) => ({
                                  ...p,
                                  [e.attr.id]: isSel ? null : { id: v.id, value: v.value }
                                }))
                              }
                              title={v.value}
                              className={`w-6 h-6 rounded-md border-2 transition ${isSel ? 'border-blue-600 scale-110' : 'border-white shadow'}`}
                              style={{ backgroundColor: v.colorHex }}
                            />
                          ) : (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() =>
                                setPreviewAttr((p) => ({
                                  ...p,
                                  [e.attr.id]: isSel ? null : { id: v.id, value: v.value }
                                }))
                              }
                              className={`px-2.5 py-1 rounded-md border text-xs transition ${isSel ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-blue-400'}`}
                            >
                              {v.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info-only attributes */}
            {infoAttrEntries.length > 0 && (
              <div className="border-t pt-2">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">Product Info</p>
                <div className="space-y-1">
                  {infoAttrEntries.map((e) => (
                    <div key={e.attr.id} className="flex items-start gap-2 text-xs">
                      <span className="text-gray-500 font-medium min-w-[60px]">{e.attr.name}:</span>
                      <div className="flex flex-wrap gap-1">
                        {e.values.map((v) => (
                          <span key={v.id} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md text-[10px]">
                            {e.attr.type === 'color' && v.colorHex && (
                              <span
                                className="inline-block w-2 h-2 rounded-md mr-1 border border-gray-300"
                                style={{ backgroundColor: v.colorHex }}
                              />
                            )}
                            {v.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Qty + stock summary */}
            <div className="flex items-center gap-2 border-t pt-2">
              <span className="text-xs text-gray-500">Qty:</span>
              <div className="flex items-center border rounded-md overflow-hidden text-xs">
                <button type="button" className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 transition">
                  –
                </button>
                <span className="px-3 py-1 border-x">1</span>
                <button type="button" className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 transition">
                  +
                </button>
              </div>
              {variations.length > 0 && (
                <span className="text-[10px] text-gray-400 ml-auto">
                  {variations.length} variation{variations.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Size chart button */}
            {sizeChart?.path && (
              <button
                type="button"
                onClick={() => Swal.fire({ imageUrl: sizeChart.path, imageAlt: 'Size Chart', padding: '10px' })}
                className="w-full py-1.5 bg-info text-white text-xs font-medium rounded-md"
              >
                Size Chart
              </button>
            )}

            {/* CTA buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-2 bg-black text-white text-xs font-semibold rounded-md hover:bg-gray-800 transition"
              >
                <MdShoppingCart size={14} /> Add to Cart
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-2 bg-green-500 text-white text-xs font-semibold rounded-md hover:bg-green-600 transition"
              >
                <MdFlashOn size={14} /> Buy Now
              </button>
            </div>

            {/* Save button */}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="w-full py-2.5 bg-[var(--brand)] text-white rounded-md text-sm font-semibold hover:brightness-95 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <MdAutorenew className="animate-spin" size={15} />
                  Saving…
                </>
              ) : isEdit ? (
                'Update Product'
              ) : (
                'Create Product'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

const STEPS = ['Basic Info', 'Description', 'Images', 'Attributes & Variations'];

export default function ProductForm({ currentProduct }) {
  const router = useRouter();
  const isEdit = !!currentProduct;
  const [step, setStep] = useState(0);
  const attrMenuRef = useRef(null);
  // Tracks which product ID has been loaded into form state.
  // Prevents background attrData refetches from overwriting the admin's in-progress edits.
  const initedForRef = useRef(null);

  // Basic
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('draft');
  const [isFeatured, setIsFeatured] = useState(false);
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [priceSale, setPriceSale] = useState('');
  const [rate, setRate] = useState('');
  const [legacyBarcodes, setLegacyBarcodes] = useState('');
  const [trackInventory, setTrackInventory] = useState(true);
  const [productionEnabled, setProductionEnabled] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  // Description
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // Images
  const [imagePool, setImagePool] = useState([]);
  const [featuredImageId, setFeaturedImageId] = useState(null);
  const [sizeChart, setSizeChart] = useState(null);

  // Attributes
  const [attrSelections, setAttrSelections] = useState({});
  const [showAttrMenu, setShowAttrMenu] = useState(false);

  // Variations
  const [variations, setVariations] = useState([]);
  const [pickingFor, setPickingFor] = useState(null);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  const { data: catData } = useQuery('admin-all-categories', api.getAllCategoriesByAdmin);
  const { data: attrData } = useQuery('all-attributes-with-values', api.getAllAttributesWithValues, {
    staleTime: 5 * 60 * 1000
  });
  const categories = catData?.data || [];
  const allAttributes = attrData?.data || [];

  // Close attr dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (attrMenuRef.current && !attrMenuRef.current.contains(e.target)) setShowAttrMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (pickingFor === null) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPickingFor(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [pickingFor]);

  // Populate from existing product on edit.
  // Guard: only re-run when the product actually changes, not on every attrData background refetch.
  // Without this, React Query's refetchOnWindowFocus rewrites the admin's in-progress edits.
  useEffect(() => {
    if (!currentProduct || !attrData?.data) return;
    const productId = currentProduct.id?.toString();
    if (initedForRef.current === productId) return;
    initedForRef.current = productId;
    const p = currentProduct;
    setName(p.name || '');
    setSlug(p.slug || '');
    setStatus(p.status || 'draft');
    setIsFeatured(!!p.isFeatured);
    setCategory(p.category?.id || '');
    setPrice(p.price?.toString() || '');
    setPriceSale(p.priceSale?.toString() || '');
    setRate(p.rate?.toString() || '');
    setLegacyBarcodes([p.primaryBarcode, ...(p.legacyBarcodes || [])].filter(Boolean).join(', '));
    setTrackInventory(p.trackInventory !== false);
    setProductionEnabled(p.productionEnabled !== false);
    setIsVisible(p.isVisible !== false);
    setShortDescription(p.shortDescription || '');
    setDescription(p.description || '');
    setMetaTitle(p.metaTitle || '');
    setMetaDescription(p.metaDescription || '');
    setSizeChart(p.sizeChart || null);

    const pool = [...(p.images || [])];
    if (p.featuredImage?.id && !pool.some((img) => img.id === p.featuredImage.id)) pool.unshift(p.featuredImage);
    setImagePool(pool);
    setFeaturedImageId(p.featuredImage?.id || pool[0]?.id || null);

    const varAttrIds = new Set();
    (p.variations || []).forEach((v) =>
      v.attributes?.forEach((a) => varAttrIds.add((a.attribute?.id || a.attribute)?.toString()))
    );

    const sel = {};
    for (const pa of p.attributes || []) {
      const attrId = (pa.attribute?.id || pa.attribute)?.toString();
      const attrDef = attrData.data.find((a) => a.id === attrId);
      if (!attrDef) continue;
      const selectedValues = attrDef.values.filter((v) =>
        (pa.values || []).some((pv) => (pv.id || pv)?.toString() === v.id?.toString())
      );
      sel[attrDef.id] = {
        attr: attrDef,
        values: selectedValues,
        forVariation: varAttrIds.has(attrDef.id?.toString())
      };
    }
    setAttrSelections(sel);

    setVariations(
      (p.variations || []).map((v) => ({
        ...v,
        legacyCodes: [v.primaryBarcode, ...(v.legacyBarcodes || [])].filter(Boolean).join(', '),
        imageId: v.image?.id?.toString() || (typeof v.image === 'string' && v.image ? v.image : null)
      }))
    );
  }, [currentProduct, attrData]);

  // Auto-slug on create
  useEffect(() => {
    if (!isEdit) setSlug(slugify(name));
  }, [name, isEdit]);

  // Regenerate variations when attrs change
  useEffect(() => {
    setVariations((prev) => buildVariations(attrSelections, prev, price));
  }, [attrSelections]); // eslint-disable-line

  // Attribute management
  const unselectedAttrs = allAttributes.filter((a) => !attrSelections[a.id]);

  const addAttr = (attr) => {
    setAttrSelections((prev) => ({ ...prev, [attr.id]: { attr, values: [], forVariation: true } }));
    setShowAttrMenu(false);
  };

  const removeAttr = (attrId) => {
    setAttrSelections((prev) => {
      const c = { ...prev };
      delete c[attrId];
      return c;
    });
  };

  const toggleValue = useCallback((attr, val) => {
    setAttrSelections((prev) => {
      const cur = prev[attr.id] || { attr, values: [], forVariation: false };
      const has = cur.values.some((v) => v.id === val.id);
      const next = has ? cur.values.filter((v) => v.id !== val.id) : [...cur.values, val];
      if (!next.length) {
        const c = { ...prev };
        delete c[attr.id];
        return c;
      }
      return { ...prev, [attr.id]: { ...cur, attr, values: next } };
    });
  }, []);

  const setForVariation = useCallback((attrId, fv) => {
    setAttrSelections((prev) => (prev[attrId] ? { ...prev, [attrId]: { ...prev[attrId], forVariation: fv } } : prev));
  }, []);

  // Variation updates
  const updateVar = (idx, field, val) =>
    setVariations((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: val } : v)));

  const toggleCustomPrice = (idx, enabled) =>
    setVariations((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        if (enabled) return { ...v, customPrice: true, regularPrice: Number(price) || 0, salePrice: null };
        return { ...v, customPrice: false, regularPrice: null, salePrice: null };
      })
    );

  // Bulk ops enable custom price so the value actually takes effect
  const applyBulkPrice = () => {
    if (!bulkPrice) return;
    setVariations((p) => p.map((v) => ({ ...v, customPrice: true, regularPrice: Number(bulkPrice) })));
    setBulkPrice('');
  };
  const applyBulkSalePrice = () => {
    setVariations((p) =>
      p.map((v) => ({ ...v, customPrice: true, salePrice: bulkSalePrice ? Number(bulkSalePrice) : null }))
    );
    setBulkSalePrice('');
  };

  const { mutate: save, isLoading: saving } = useMutation(
    (payload) =>
      isEdit
        ? api.updateProductByAdmin({ currentSlug: currentProduct.slug, ...payload })
        : api.createProductByAdmin(payload),
    {
      onSuccess: (res) => {
        initedForRef.current = null; // allow re-init from fresh server data after save
        Swal.fire({ title: 'Saved!', icon: 'success', timer: 1500, showConfirmButton: false });
        router.push(`/products/${res.data?.slug || ''}`);
      },
      onError: (err) => Swal.fire('Error', err?.response?.data?.message || 'Something went wrong', 'error')
    }
  );

  const handleSubmit = () => {
    if (!name.trim()) {
      Swal.fire('Name is required', '', 'warning');
      setStep(0);
      return;
    }
    if (!category) {
      Swal.fire('Category is required', '', 'warning');
      setStep(0);
      return;
    }
    if (!price) {
      Swal.fire('Base price is required', '', 'warning');
      setStep(0);
      return;
    }

    console.log(
      '[handleSubmit] attrSelections:',
      JSON.stringify(
        Object.values(attrSelections).map((s) => ({
          attr: s.attr.name,
          forVariation: s.forVariation,
          values: s.values.map((v) => v.value)
        }))
      )
    );
    console.log('[handleSubmit] variations state (raw):', JSON.stringify(variations));

    save({
      name,
      slug,
      status,
      isFeatured,
      category,
      price: Number(price),
      priceSale: priceSale ? Number(priceSale) : null,
      rate: rate ? Number(rate) : 0,
      ...splitLegacyCodes(legacyBarcodes),
      trackInventory,
      productionEnabled,
      isVisible,
      shortDescription,
      description,
      metaTitle,
      metaDescription,
      featuredImage: featuredImageId || imagePool[0]?.id || null,
      sizeChart: sizeChart?.id || null,
      images: imagePool.map((img) => img.id),
      attributes: Object.values(attrSelections)
        .filter((e) => e.values.length > 0)
        .map((e) => ({ attribute: e.attr.id, attributeName: e.attr.name, values: e.values.map((v) => v.id) })),
      customizableFields: [],
      variations: (() => {
        const payload = variations
          .filter((v) => v.enabled !== false)
          .map((v) => ({
            attributes: v.attributes,
            regularPrice: v.customPrice ? (v.regularPrice ?? null) : null,
            salePrice: v.customPrice ? v.salePrice : null,
            overSale: v.overSale,
            ...splitLegacyCodes(v.legacyCodes),
            image: v.imageId || null
          }));
        console.log('[handleSubmit] variations payload to backend:', JSON.stringify(payload));
        return payload;
      })()
    });
  };

  const catName = categories.find((c) => c.id === category)?.name;
  const featuredImg = imagePool.find((img) => img.id === featuredImageId);
  const enabledVariations = variations.filter((v) => v.enabled !== false);
  const disabledCount = variations.length - enabledVariations.length;

  return (
    <div className="flex gap-6 items-start">
      {/* ═══════ LEFT: FORM ═══════ */}
      <div className="flex-1 min-w-0">
        {/* Step tabs */}
        <div className="flex border-b mb-6 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 whitespace-nowrap px-5 py-3 text-sm font-medium border-b-2 transition-colors ${step === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${step === i ? 'bg-[var(--brand)] text-white' : 'bg-gray-200 text-gray-500'}`}
              >
                {i + 1}
              </span>
              {s}
            </button>
          ))}
        </div>

        {/* ── STEP 0: BASIC INFO ── */}
        {step === 0 && (
          <div className="space-y-5">
            <SectionTitle>Basic Information</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <FL>Product Name *</FL>
                <input
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Silk Kurti Set"
                />
              </div>
              <div>
                <FL>URL Slug</FL>
                <input
                  className="input-field font-mono text-sm"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generated"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-generated from name.</p>
              </div>
              <div>
                <FL>Category *</FL>
                <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FL>Status</FL>
                <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <FL>Featured</FL>
                <button
                  type="button"
                  onClick={() => setIsFeatured((f) => !f)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md border text-sm font-medium transition-all w-full ${isFeatured ? 'bg-yellow-400 border-yellow-500 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-yellow-300'}`}
                >
                  <FiStar size={16} />
                  {isFeatured ? 'Featured ✓' : 'Mark as Featured'}
                </button>
              </div>
              <div>
                <FL>Base Price (৳) *</FL>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-gray-400 mt-1">Default price for all variations unless overridden.</p>
              </div>
              <div>
                <FL>Sale Price (৳)</FL>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={priceSale}
                  onChange={(e) => setPriceSale(e.target.value)}
                  placeholder="Leave blank if no discount"
                />
                <p className="text-xs text-gray-400 mt-1">Default sale price for all variations unless overridden.</p>
              </div>
              <div>
                <FL>Production Rate (৳)</FL>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <FL>Product Code</FL>
                <input
                  className="input-field cursor-not-allowed bg-gray-50 font-mono text-gray-500"
                  value={currentProduct?.code ? String(currentProduct.code).padStart(4, '0') : 'Assigned when saved'}
                  readOnly
                />
                <p className="text-xs text-gray-400 mt-1">
                  The system assigns this permanent code. Unit labels use Production–Product–Option.
                </p>
              </div>
              <div className="md:col-span-2">
                <FL>Legacy Product Codes</FL>
                <input
                  className="input-field font-mono"
                  value={legacyBarcodes}
                  onChange={(e) => setLegacyBarcodes(e.target.value)}
                  placeholder="Separate multiple barcodes with commas"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Previous POS or supplier codes remain scannable. Separate multiple codes with commas.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} />
                Track branch inventory
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={productionEnabled}
                  onChange={(e) => setProductionEnabled(e.target.checked)}
                />
                Can be produced
              </label>
              <div className="md:col-span-2">
                <FL>Ecommerce Visibility</FL>
                <button
                  type="button"
                  onClick={() => setIsVisible((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md border text-sm font-medium transition-all w-full max-w-xs ${isVisible ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
                >
                  {isVisible ? <MdVisibility size={16} /> : <MdVisibilityOff size={16} />}
                  {isVisible ? 'Visible on store' : 'Hidden from store'}
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Hidden products are still accessible by direct URL but won&apos;t appear in listings.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: DESCRIPTION ── */}
        {step === 1 && (
          <div className="space-y-5">
            <SectionTitle>Description & SEO</SectionTitle>
            <div>
              <FL>Short Description</FL>
              <textarea
                rows={3}
                className="input-field resize-none"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief summary shown below product title"
              />
            </div>
            <div>
              <FL>Full Description</FL>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Full product description…"
                minHeight={280}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FL>Meta Title</FL>
                <input
                  className="input-field"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="SEO page title"
                />
              </div>
              <div>
                <FL>Meta Description</FL>
                <input
                  className="input-field"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="SEO meta description"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: IMAGES ── */}
        {step === 2 && (
          <div className="space-y-6">
            <SectionTitle>Product Images</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2">
                <FL>
                  Image Pool <span className="text-xs text-gray-400 font-normal ml-1">(star one = featured)</span>
                </FL>
                <ImagePool
                  pool={imagePool}
                  setPool={setImagePool}
                  featuredId={featuredImageId}
                  setFeaturedId={setFeaturedImageId}
                />
              </div>
              <div>
                <FL>
                  Size Chart <span className="text-xs text-gray-400 font-normal ml-1">(separate)</span>
                </FL>
                <SizeChartUploader value={sizeChart} onChange={setSizeChart} />
                <p className="text-xs text-gray-400 mt-2">Not part of the gallery. Shown as a popup button.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: ATTRIBUTES & VARIATIONS ── */}
        {step === 3 && (
          <div className="space-y-6">
            <SectionTitle>Attributes & Variations</SectionTitle>

            {/* Attribute selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Product Attributes</p>
                <div className="relative" ref={attrMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowAttrMenu((s) => !s)}
                    disabled={unselectedAttrs.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                  >
                    <MdAdd size={16} /> Add Attribute
                  </button>
                  {showAttrMenu && (
                    <div className="absolute right-0 top-full mt-1 z-30 bg-white border rounded-md shadow-lg py-1 min-w-[200px] max-h-64 overflow-y-auto">
                      {unselectedAttrs.length === 0 ? (
                        <p className="px-4 py-2.5 text-xs text-gray-400 italic">All attributes added</p>
                      ) : (
                        unselectedAttrs.map((attr) => (
                          <button
                            key={attr.id}
                            type="button"
                            onClick={() => addAttr(attr)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between"
                          >
                            {attr.name}
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md ml-2">
                              {attr.type}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {Object.keys(attrSelections).length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-md text-gray-400 text-sm">
                  Click <b>Add Attribute</b> to select attributes for this product
                </div>
              ) : (
                Object.values(attrSelections).map((sel) => {
                  const hasValues = sel.values.length > 0;
                  return (
                    <div
                      key={sel.attr.id}
                      className={`border rounded-md transition-colors ${hasValues ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-inherit">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800 text-sm">{sel.attr.name}</span>
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                            {sel.attr.type}
                          </span>
                          {hasValues && (
                            <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md">
                              {sel.values.length} selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasValues && (
                            <div className="flex items-center gap-0.5 bg-white rounded-md border p-0.5">
                              <button
                                type="button"
                                onClick={() => setForVariation(sel.attr.id, false)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${!sel.forVariation ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                              >
                                <MdInfo size={12} /> Info only
                              </button>
                              <button
                                type="button"
                                onClick={() => setForVariation(sel.attr.id, true)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${sel.forVariation ? 'bg-[var(--brand)] text-white' : 'text-gray-500 hover:text-gray-700'}`}
                              >
                                <MdTune size={12} /> Variations
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttr(sel.attr.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition"
                          >
                            <MdClose size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3 flex flex-wrap gap-2">
                        {(sel.attr.values || []).filter(
                          (val) => val.active !== false || sel.values.some((v) => v.id === val.id)
                        ).length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No values defined for this attribute</span>
                        ) : (
                          (sel.attr.values || [])
                            .filter((val) => val.active !== false || sel.values.some((v) => v.id === val.id))
                            .map((val) => {
                              const selected = sel.values.some((v) => v.id === val.id);
                              return (
                                <button
                                  key={val.id}
                                  type="button"
                                  onClick={() => toggleValue(sel.attr, val)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${selected ? 'bg-[var(--brand)] text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'} ${val.active === false ? 'opacity-60' : ''}`}
                                >
                                  {sel.attr.type === 'color' && val.colorHex && (
                                    <span
                                      className="w-3 h-3 rounded-md border border-white/40 flex-shrink-0"
                                      style={{ backgroundColor: val.colorHex }}
                                    />
                                  )}
                                  {val.value}
                                  {val.active === false ? ' (disabled)' : ''}
                                </button>
                              );
                            })
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Variation table */}
            {variations.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold text-gray-700 mr-auto">
                    {enabledVariations.length} of {variations.length} Variation{variations.length !== 1 ? 's' : ''}
                    {disabledCount > 0 && (
                      <span className="ml-2 text-xs text-gray-400 font-normal">
                        ({disabledCount} disabled — won't save)
                      </span>
                    )}
                  </p>
                  {/* Bulk fields */}
                  {[
                    { val: bulkPrice, set: setBulkPrice, apply: applyBulkPrice, label: 'Reg. price', color: 'blue' },
                    {
                      val: bulkSalePrice,
                      set: setBulkSalePrice,
                      apply: applyBulkSalePrice,
                      label: 'Sale price',
                      color: 'orange'
                    }
                  ].map(({ val, set, apply, label, color }) => (
                    <div key={label} className="flex items-center gap-1">
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder={label}
                        className="border rounded-md px-2.5 py-1.5 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
                      />
                      <button
                        type="button"
                        onClick={apply}
                        className={`px-3 py-1.5 bg-${color}-500 text-white text-xs rounded-md hover:bg-${color}-600 transition whitespace-nowrap`}
                      >
                        Set all
                      </button>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-10" title="Enable/disable this combination">
                          On
                        </th>
                        <th className="px-4 py-2.5 text-left">Variation</th>
                        <th className="px-3 py-2.5 text-center w-16" title="Uncheck to use base price">
                          Custom Price
                        </th>
                        <th className="px-3 py-2.5 text-right w-28">Reg. Price</th>
                        <th className="px-3 py-2.5 text-right w-28">Sale Price</th>
                        <th className="px-3 py-2.5 text-center w-24">Option Code</th>
                        <th className="px-3 py-2.5 text-left w-44">Legacy Option Codes</th>
                        <th className="px-3 py-2.5 text-center w-20">Image</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variations.map((v, idx) => {
                        const varImg = imagePool.find((img) => img.id === v.imageId);
                        return (
                          <tr
                            key={idx}
                            className={`border-b last:border-b-0 ${v.enabled === false ? 'opacity-40 bg-gray-50' : pickingFor === idx ? 'bg-blue-50' : 'hover:bg-gray-50/50'}`}
                          >
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => updateVar(idx, 'enabled', v.enabled === false ? true : false)}
                                title={
                                  v.enabled === false
                                    ? 'Click to enable this combination'
                                    : 'Click to disable this combination'
                                }
                                className={`p-1 rounded-md transition ${v.enabled === false ? 'text-gray-300 hover:text-green-500' : 'text-green-500 hover:text-gray-300'}`}
                              >
                                {v.enabled === false ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                              </button>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1.5">
                                {v.attributes.length === 0 && (
                                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded-md px-2.5 py-1 text-xs font-medium">
                                    Standard
                                  </span>
                                )}
                                {v.attributes.map((a, ai) => (
                                  <span
                                    key={ai}
                                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded-md px-2.5 py-1 text-xs font-medium"
                                  >
                                    {a.colorHex && (
                                      <span
                                        className="w-3 h-3 rounded-md border border-gray-300 flex-shrink-0"
                                        style={{ backgroundColor: a.colorHex }}
                                      />
                                    )}
                                    <span className="text-gray-400 text-[10px]">{a.attributeName}:</span>
                                    {a.valueName}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={!!v.customPrice}
                                onChange={(e) => toggleCustomPrice(idx, e.target.checked)}
                                disabled={v.attributes.length === 0}
                                className="w-4 h-4 cursor-pointer accent-blue-500"
                                title="Uncheck to use base price"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              {v.customPrice ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={v.regularPrice ?? ''}
                                  onChange={(e) =>
                                    updateVar(idx, 'regularPrice', e.target.value ? Number(e.target.value) : null)
                                  }
                                  className="w-full border rounded-md px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
                                />
                              ) : (
                                <span className="block w-full text-right text-sm text-gray-400 italic px-2 py-1.5">
                                  ৳{price || 0}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {v.customPrice ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={v.salePrice ?? ''}
                                  onChange={(e) =>
                                    updateVar(idx, 'salePrice', e.target.value ? Number(e.target.value) : null)
                                  }
                                  placeholder="—"
                                  className="w-full border rounded-md px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
                                />
                              ) : (
                                <span className="block w-full text-right text-sm text-gray-400 italic px-2 py-1.5">
                                  {priceSale ? `৳${priceSale}` : '—'}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center font-mono text-xs font-semibold text-gray-600">
                              {v.productionCode ? String(v.productionCode).padStart(4, '0') : 'Auto'}
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={v.legacyCodes || ''}
                                onChange={(e) => updateVar(idx, 'legacyCodes', e.target.value)}
                                placeholder="Old codes, comma separated"
                                className="w-full border rounded-md px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {varImg ? (
                                <div className="relative w-10 h-10 mx-auto group">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <Image src={varImg.path} alt="" fill className="object-cover rounded-md border" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateVar(idx, 'imageId', null);
                                      if (pickingFor === idx) setPickingFor(null);
                                    }}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-md p-px opacity-0 group-hover:opacity-100 transition shadow"
                                  >
                                    <MdClose size={10} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPickingFor((p) => (p === idx ? null : idx))}
                                  className={`p-1.5 rounded-md transition ${pickingFor === idx ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'}`}
                                >
                                  <MdImage size={18} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Variation image picker */}
                {pickingFor !== null && (
                  <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="variation-image-picker-title"
                    onMouseDown={(e) => e.target === e.currentTarget && setPickingFor(null)}
                  >
                    <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
                      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                        <div>
                          <h3 id="variation-image-picker-title" className="text-base font-semibold text-gray-900">
                            Select variation image
                          </h3>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Choose from the product gallery for variation {pickingFor + 1}.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPickingFor(null)}
                          className="flex h-10 w-10 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                          aria-label="Close image picker"
                        >
                          <MdClose size={20} />
                        </button>
                      </div>

                      <div className="overflow-y-auto p-5">
                        {imagePool.length === 0 ? (
                          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
                            <MdImage size={30} className="mx-auto mb-3 text-gray-300" />
                            <p className="text-sm font-medium text-gray-600">No product images available</p>
                            <p className="mt-1 text-xs text-gray-400">
                              Upload images in the Images step, then return here.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {imagePool.map((img) => {
                              const selected = String(variations[pickingFor]?.imageId || '') === String(img.id);
                              return (
                                <button
                                  key={img.id}
                                  type="button"
                                  onClick={() => {
                                    updateVar(pickingFor, 'imageId', img.id);
                                    setPickingFor(null);
                                  }}
                                  className={`group relative aspect-square overflow-hidden rounded-md border-2 bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                    selected
                                      ? 'border-blue-600 ring-2 ring-blue-100'
                                      : 'border-gray-200 hover:border-blue-500'
                                  }`}
                                  aria-label={`Select ${img.originalName || 'product image'}`}
                                >
                                  <Image
                                    src={img.path}
                                    alt={img.originalName || ''}
                                    fill
                                    sizes="(max-width: 640px) 50vw, 160px"
                                    className="object-cover"
                                  />
                                  {selected && (
                                    <span className="absolute right-2 top-2 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white shadow">
                                      Selected
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {Object.values(attrSelections).some((e) => e.forVariation) && variations.length === 0 && (
              <div className="text-center py-6 text-amber-600 bg-amber-50 border border-amber-200 rounded-md text-sm">
                Select values for your variation attributes to generate variation rows.
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 border rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <MdChevronLeft size={18} /> Previous
          </button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={`rounded-md transition-all ${i === step ? 'w-5 h-2 bg-[var(--brand)]' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'}`}
              />
            ))}
          </div>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[var(--brand)] text-white rounded-md text-sm font-medium hover:brightness-95 transition"
            >
              Next <MdChevronRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-7 py-2.5 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <MdAutorenew className="animate-spin" size={16} />
                  Saving…
                </span>
              ) : isEdit ? (
                'Update Product'
              ) : (
                'Create Product'
              )}
            </button>
          )}
        </div>
      </div>

      {/* ═══════ RIGHT: LIVE PREVIEW ═══════ */}
      <LivePreview
        name={name}
        slug={slug}
        status={status}
        isFeatured={isFeatured}
        catName={catName}
        price={price}
        priceSale={priceSale}
        shortDescription={shortDescription}
        featuredImg={featuredImg}
        imagePool={imagePool}
        sizeChart={sizeChart}
        attrSelections={attrSelections}
        variations={variations}
        saving={saving}
        onSave={handleSubmit}
        isEdit={isEdit}
      />
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-xl font-bold text-gray-800 mb-1">{children}</h2>;
}
function FL({ children }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1.5">{children}</label>;
}
function StatusBadge({ status }) {
  const m = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-red-100 text-red-700',
    draft: 'bg-yellow-100 text-yellow-700'
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium capitalize ${m[status] || 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}
