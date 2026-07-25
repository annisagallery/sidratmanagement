'use client';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { useState, useMemo } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { MdArrowBack, MdEdit, MdDelete, MdOpenInNew } from 'react-icons/md';
import { FiImage, FiTag, FiList, FiBox, FiPackage, FiX } from 'react-icons/fi';

const card = 'bg-white rounded-md border border-gray-200 p-5';

function InfoRow({ label, value, children }) {
  if (!children && !value && value !== 0) return null;
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0 w-28">{label}</span>
      <div className="flex-1 text-sm text-gray-800 font-medium">{children ?? value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-red-100 text-red-700',
    draft: 'bg-yellow-100 text-yellow-700'
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}

export default function ViewProduct({ slug }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(null);
  const [invBranch, setInvBranch] = useState('all');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
  const [unitsTarget, setUnitsTarget] = useState(null);

  const { data, isLoading, isError } = useQuery(['product-admin', slug], () => api.getOneProductByAdmin(slug), {
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const product = data?.data;

  const invQuery = useQuery(['product-stock-detail', product?._id], () => api.getProductStockDetail(product._id), {
    enabled: !!product?._id
  });
  const branchsQuery = useQuery('inventory-branchs', api.adminGetBranches, {
    staleTime: 60_000,
    retry: false
  });
  const { balances: invBalances = [], units: invUnits = [] } = invQuery.data?.data || {};

  const invBranches = useMemo(() => {
    const seen = new Map();
    (branchsQuery.data?.data || []).forEach((branch) => {
      if (branch?.isActive !== false) seen.set(String(branch._id), branch);
    });
    invBalances.forEach((b) => {
      if (b.branch && !seen.has(String(b.branch._id))) seen.set(String(b.branch._id), b.branch);
    });
    return [...seen.values()];
  }, [invBalances, branchsQuery.data]);

  const invByVariation = useMemo(() => {
    const map = new Map();
    (product?.variations || []).forEach((variation) => {
      map.set(String(variation._id), { variation, byBranch: {} });
    });
    invBalances.forEach((b) => {
      const key = String(b.variation?._id || '__base__');
      if (!map.has(key)) map.set(key, { variation: b.variation, byBranch: {} });
      map.get(key).byBranch[String(b.branch._id)] = { onHand: b.onHand, reserved: b.reserved };
    });
    return [...map.values()];
  }, [invBalances, product?.variations]);

  const invUnitsByVariation = useMemo(() => {
    const map = new Map();
    invUnits.forEach((u) => {
      const key = String(u.variation?._id || '__base__');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    });
    return map;
  }, [invUnits]);

  const showBranchStockBreakdown = invBranch !== 'all';
  const visibleBranches = showBranchStockBreakdown ? invBranches.filter((w) => String(w._id) === invBranch) : [];
  const availableForSelectedBranch = (row) =>
    Object.entries(row.byBranch)
      .filter(([branchId]) => invBranch === 'all' || branchId === invBranch)
      .reduce(
        (sum, [, balance]) =>
          sum + Math.max(0, Number(balance.onHand || 0) - Number(balance.reserved || 0)),
        0
      );
  const visibleVariationRows = useMemo(() => {
    const availableForRow = (row) =>
      Object.entries(row.byBranch)
        .filter(([branchId]) => invBranch === 'all' || branchId === invBranch)
        .reduce(
          (sum, [, balance]) => sum + Math.max(0, Number(balance.onHand || 0) - Number(balance.reserved || 0)),
          0
        );
    const rows = showOnlyAvailable ? invByVariation.filter((row) => availableForRow(row) > 0) : [...invByVariation];

    return rows.sort((a, b) => {
      const aValues = (a.variation?.attributes || []).map((attr) => attr.valueName || '').join(' | ');
      const bValues = (b.variation?.attributes || []).map((attr) => attr.valueName || '').join(' | ');
      return aValues.localeCompare(bValues, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [invByVariation, invBranch, showOnlyAvailable]);

  const { mutate: deleteProduct } = useMutation(() => api.deleteProductByAdmin(slug), {
    onSuccess: () => {
      Swal.fire({ title: 'Deleted!', icon: 'success', timer: 1200, showConfirmButton: false });
      qc.invalidateQueries(['admin-products']);
      router.push('/products');
    },
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Delete failed', 'error')
  });

  const presaleMutation = useMutation(api.updateVariationPresale, {
    onSuccess: () => {
      qc.invalidateQueries(['product-admin', slug]);
      qc.invalidateQueries(['admin-products']);
    },
    onError: (e) => Swal.fire('Could not update presale', e?.response?.data?.message || 'Try again.', 'error')
  });

  function handleDelete() {
    Swal.fire({
      title: `Delete "${product?.name}"?`,
      text: 'This will soft-delete the product and all its variations.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete'
    }).then((r) => {
      if (r.isConfirmed) deleteProduct();
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-gray-100 rounded-md animate-pulse" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,2fr)_3fr]">
          <div className="mx-auto aspect-[2/3] w-full max-w-md bg-gray-100 rounded-md animate-pulse" />
          <div className="space-y-4">
            <div className="h-32 bg-gray-100 rounded-md animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-md animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="text-center py-24 text-red-500">
        <p className="font-semibold">Product not found.</p>
        <button onClick={() => router.push('/products')} className="mt-4 text-sm text-blue-500 underline">
          Back to products
        </button>
      </div>
    );
  }

  const featuredImage = product.featuredImage;
  const images = product.images || [];
  const displayImage = selectedImage ?? featuredImage?.path ?? null;

  const hasVarAttrs = (product.variations || []).some((v) => (v.attributes || []).length > 0);
  const productType = hasVarAttrs ? 'Variable' : 'Standard';

  const attributeMap = new Map();
  (product.attributes || []).forEach((entry) => {
    const name = entry.attributeName || entry.attribute?.name;
    if (!name) return;
    if (!attributeMap.has(name)) attributeMap.set(name, new Map());
    (entry.values || []).forEach((value) => {
      const label = value?.value || value?.valueName;
      if (label) attributeMap.get(name).set(label, { name: label, colorHex: value?.colorHex || null });
    });
  });
  (product.variations || []).forEach((variation) => {
    (variation.attributes || []).forEach((attribute) => {
      const name = attribute.attributeName || 'Attribute';
      const label = attribute.valueName || String(attribute.value || '');
      if (!label) return;
      if (!attributeMap.has(name)) attributeMap.set(name, new Map());
      attributeMap.get(name).set(label, { name: label, colorHex: attribute.colorHex || null });
    });
  });
  const attributeGroups = [...attributeMap.entries()].map(([name, values]) => ({
    name,
    values: [...values.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }));

  const totalStock = invBalances.reduce(
    (sum, balance) => sum + Math.max(0, Number(balance.onHand || 0) - Number(balance.reserved || 0)),
    0
  );

  const selectedBalances =
    invBranch === 'all' ? invBalances : invBalances.filter((balance) => String(balance.branch?._id) === invBranch);
  const selectedAvailable = selectedBalances.reduce(
    (sum, balance) => sum + Math.max(0, Number(balance.onHand || 0) - Number(balance.reserved || 0)),
    0
  );
  const stockedVariationCount = invByVariation.filter((row) =>
    Object.entries(row.byBranch)
      .filter(([branchId]) => invBranch === 'all' || branchId === invBranch)
      .some(([, balance]) => Number(balance.onHand || 0) - Number(balance.reserved || 0) > 0)
  ).length;
  const getVariationBarcode = (variation) => {
    if (variation?.primaryBarcode) return variation.primaryBarcode;
    if ((product.variations || []).length === 1 && product.primaryBarcode) return product.primaryBarcode;
    const index = (product.variations || []).findIndex((item) => String(item._id) === String(variation?._id));
    const variationCode = variation?.productionCode || index + 1;
    return product.code && variationCode > 0
      ? `${String(product.code).padStart(4, '0')}${String(variationCode).padStart(4, '0')}`
      : '—';
  };

  return (
    <div className="space-y-4 pb-16">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className={`${card} flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/products')}
            className="p-2 rounded-md border text-gray-500 hover:bg-gray-50 transition flex-shrink-0"
          >
            <MdArrowBack size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{product.name}</h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">/{product.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() =>
              window.open(
                `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/product/${product.slug}`,
                '_blank',
                'noopener'
              )
            }
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 transition"
          >
            <MdOpenInNew size={14} /> View on site
          </button>
          <button
            onClick={() => router.push(`/products/${slug}`)}
            className="flex items-center gap-1.5 px-3 py-2 border border-[var(--brand-ring)] bg-[var(--brand-soft)] text-[var(--brand-strong)] rounded-md text-sm font-medium hover:bg-[var(--brand-soft)] transition"
          >
            <MdEdit size={14} /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition"
          >
            <MdDelete size={14} /> Delete
          </button>
        </div>
      </div>

      {/* ── MAIN GRID ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,2fr)_3fr] lg:items-start">
        {/* Left: Image Gallery */}
        <div className={card}>
          <div className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-md border border-gray-100 bg-gray-50">
            {displayImage ? (
              <img src={displayImage} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-200 gap-3">
                <FiImage size={64} />
                <p className="text-sm text-gray-300">No image</p>
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {featuredImage?.path && (
                <button
                  onClick={() => setSelectedImage(featuredImage.path)}
                  className={`relative aspect-[2/3] w-12 rounded-md border-2 overflow-hidden flex-shrink-0 transition ${
                    displayImage === featuredImage.path
                      ? 'border-[var(--brand)]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={featuredImage.path}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              )}
              {images.map((img) => {
                const path = img?.path || img;
                if (!path || path === featuredImage?.path) return null;
                return (
                  <button
                    key={img._id || path}
                    onClick={() => setSelectedImage(path)}
                    className={`relative aspect-[2/3] w-12 rounded-md border-2 overflow-hidden flex-shrink-0 transition ${
                      displayImage === path ? 'border-[var(--brand)]' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img src={path} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Info cards */}
        <div className="space-y-4">
          {/* Product Info */}
          <div className={card}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FiTag size={12} /> Product Info
            </p>

            <InfoRow label="Type" value={productType} />
            <InfoRow label="Name" value={product.name} />
            <InfoRow label="Code" value={product.code} />
            <InfoRow label="Category" value={product.category?.name} />
            <InfoRow label="Cost (Rate)" value={`৳${Number(product.rate || 0).toFixed(2)}`} />
            <InfoRow label="Price" value={`৳${Number(product.price || 0).toFixed(2)}`} />
            {product.priceSale > 0 && <InfoRow label="Sale Price" value={`৳${Number(product.priceSale).toFixed(2)}`} />}

            <div className="flex items-start gap-4 py-2.5 border-b border-gray-50">
              <span className="text-xs text-gray-400 flex-shrink-0 w-28">Status</span>
              <StatusBadge status={product.status} />
            </div>

            {product.trackInventory && (
              <InfoRow label="Total Stock">
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                    totalStock > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {totalStock} units
                </span>
              </InfoRow>
            )}

            {product.isFeatured && <InfoRow label="Featured" value="⭐ Yes" />}

            {attributeGroups.length > 0 && (
              <div className="pt-3 mt-1 border-t border-gray-100">
                <p className="mb-2 text-xs font-semibold text-gray-500">Attributes</p>
                <div className="space-y-2">
                  {attributeGroups.map((group) => (
                    <div key={group.name} className="flex items-start gap-3">
                      <span className="w-24 shrink-0 pt-1 text-[11px] font-semibold text-gray-400">{group.name}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.values.map((value) => (
                          <span
                            key={value.name}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--brand-ring)] bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-strong)]"
                          >
                            {value.colorHex && (
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-md border border-white shadow-sm"
                                style={{ backgroundColor: value.colorHex }}
                              />
                            )}
                            {value.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── VARIATIONS TABLE ────────────────────────────────────────────── */}
      {false && (product.variations || []).length > 0 && (
        <div className={card}>
          <div className="flex items-center gap-2 mb-4">
            <FiList size={15} className="text-[var(--brand-strong)]" />
            <h2 className="font-semibold text-gray-800">Variations ({product.variations.length})</h2>
          </div>
          <div className="overflow-x-auto -mx-1">
            <GlobalTable className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Variant
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Regular Price
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Sale Price
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Stock
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Code
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {product.variations.map((v, i) => (
                  <tr
                    key={v._id || i}
                    className={`hover:bg-gray-50/50 transition ${v.enabled === false ? 'opacity-50' : ''}`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(v.attributes || []).length > 0 ? (
                          v.attributes.map((a, j) => (
                            <span
                              key={j}
                              className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md"
                            >
                              {a.colorHex && (
                                <span
                                  className="w-2.5 h-2.5 rounded-md flex-shrink-0"
                                  style={{ backgroundColor: a.colorHex }}
                                />
                              )}
                              {a.valueName}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">Default</span>
                        )}
                        {v.enabled === false && <span className="text-xs text-red-400 ml-1">(disabled)</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-800">
                      {v.regularPrice != null ? (
                        `৳${Number(v.regularPrice).toFixed(2)}`
                      ) : (
                        <span className="text-gray-400 text-xs italic">Base price</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-green-600">
                      {v.salePrice != null ? (
                        `৳${Number(v.salePrice).toFixed(2)}`
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                          (v.available || 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {v.available ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-gray-500">{v.primaryBarcode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </GlobalTable>
          </div>
        </div>
      )}

      {/* ── INVENTORY ───────────────────────────────────────────────────── */}
      {product.trackInventory && (
        <div className={card}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FiPackage size={15} className="text-[var(--brand-strong)]" />
              <div>
                <h2 className="font-semibold text-gray-800">Variations &amp; inventory</h2>
                <p className="text-[11px] text-gray-400">Prices, status and branch stock.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start">
              <select
                value={invBranch}
                onChange={(event) => setInvBranch(event.target.value)}
                aria-label="Branch"
                className="h-8 min-w-40 rounded-md border border-gray-200 bg-white px-2.5 text-[11px] font-semibold text-gray-700 focus:border-[var(--brand)] focus:outline-none"
              >
                <option value="all">All branches</option>
                {invBranches.map((branch) => (
                  <option key={branch._id} value={String(branch._id)}>
                    {branch.name}
                    {branch.code ? ` (${branch.code})` : ''}
                  </option>
                ))}
              </select>
              <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setShowOnlyAvailable(true)}
                  className={`rounded-md px-2.5 py-1 ${showOnlyAvailable ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  In stock only
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnlyAvailable(false)}
                  className={`rounded-md px-2.5 py-1 ${!showOnlyAvailable ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  Show all
                </button>
              </div>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
            <div className="px-2.5 py-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total stock</p>
              <p className="text-sm font-bold text-green-700">{selectedAvailable}</p>
            </div>
            <div className="border-l border-gray-200 px-2.5 py-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">In-stock variations</p>
              <p className="text-sm font-bold text-gray-800">{stockedVariationCount}</p>
            </div>
            <div className="border-l border-gray-200 px-2.5 py-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total variations</p>
              <p className="text-sm font-bold text-gray-800">{invByVariation.length}</p>
            </div>
          </div>

          {invQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-gray-400">Loading inventory…</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <GlobalTable className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Variation
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Code
                    </th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Price
                    </th>
                    {showBranchStockBreakdown ? (
                      visibleBranches.map((w) => (
                        <th
                          key={w._id}
                          className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {w.name}
                          {w.code && <span className="ml-1 font-mono text-gray-400">({w.code})</span>}
                        </th>
                      ))
                    ) : (
                      <th className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Total stock
                      </th>
                    )}
                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Units
                    </th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Presale
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleVariationRows.map((row) => {
                    const varId = String(row.variation?._id || '__base__');
                    const varUnits = invUnitsByVariation.get(varId) || [];
                    const attrLabel =
                      (row.variation?.attributes || [])
                        .map((a) => a.valueName)
                        .filter(Boolean)
                        .join(' / ') || 'Default';
                    return (
                      <tr key={varId} className="hover:bg-gray-50/50">
                        <td className="px-2 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {(row.variation?.attributes || []).length > 0 ? (
                              row.variation.attributes.map((a, j) => (
                                <span
                                  key={j}
                                  className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                                >
                                  {a.colorHex && (
                                    <span
                                      className="h-2.5 w-2.5 rounded-md"
                                      style={{ backgroundColor: a.colorHex }}
                                    />
                                  )}
                                  {a.valueName}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">Default</span>
                            )}
                          </div>
                          {row.variation?.sku && (
                            <p className="mt-0.5 font-mono text-xs text-gray-400">{row.variation.sku}</p>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[10px] font-semibold text-gray-600">
                          {getVariationBarcode(row.variation)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[11px]">
                          <span className="font-semibold text-gray-800">
                            ৳{Number(row.variation?.regularPrice ?? product.price ?? 0).toLocaleString()}
                          </span>
                          {row.variation?.salePrice != null && (
                            <span className="ml-1 text-green-600">
                              ৳{Number(row.variation.salePrice).toLocaleString()}
                            </span>
                          )}
                        </td>
                        {showBranchStockBreakdown ? (
                          visibleBranches.map((w) => {
                            const wb = row.byBranch[String(w._id)];
                            if (!wb)
                              return (
                                <td key={w._id} className="px-2 py-1.5 text-center font-mono font-bold text-gray-300">
                                  0
                                </td>
                              );
                            const avail = Math.max(0, Number(wb.onHand || 0) - Number(wb.reserved || 0));
                            return (
                              <td key={w._id} className="px-2 py-1.5 text-center">
                                <span className={`font-mono font-bold ${avail > 0 ? 'text-green-700' : 'text-red-500'}`}>
                                  {avail}
                                </span>
                              </td>
                            );
                          })
                        ) : (
                          <td className="px-2 py-1.5 text-center">
                            {(() => {
                              const avail = availableForSelectedBranch(row);
                              return (
                                <span className={`font-mono font-bold ${avail > 0 ? 'text-green-700' : 'text-red-500'}`}>
                                  {avail}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-center">
                          {varUnits.length > 0 ? (
                            <button
                              onClick={() => setUnitsTarget({ label: attrLabel, units: varUnits })}
                              className="rounded-md bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-gray-700"
                            >
                              {varUnits.length} unit{varUnits.length !== 1 ? 's' : ''}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            disabled={presaleMutation.isLoading}
                            onClick={() =>
                              presaleMutation.mutate({
                                slug,
                                variationId: row.variation?._id,
                                enabled: !row.variation?.overSale
                              })
                            }
                            className={`relative inline-flex h-5 w-9 items-center rounded-md transition disabled:opacity-50 ${
                              row.variation?.overSale ? 'bg-amber-500' : 'bg-gray-200'
                            }`}
                            aria-label={`${row.variation?.overSale ? 'Disable' : 'Enable'} presale`}
                            aria-pressed={Boolean(row.variation?.overSale)}
                          >
                            <span
                              className={`h-3.5 w-3.5 rounded-md bg-white shadow transition-transform ${
                                row.variation?.overSale ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </GlobalTable>
              {!visibleVariationRows.length && (
                <p className="py-8 text-center text-sm text-gray-400">
                  No variations have physical stock in this branch. Choose “Show all” to see every variation.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── UNIT SERIALS MODAL ─────────────────────────────────────────── */}
      {unitsTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setUnitsTarget(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-md bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="font-bold text-gray-900">Unit serials</h3>
                <p className="mt-0.5 text-sm text-gray-500">{unitsTarget.label}</p>
              </div>
              <button onClick={() => setUnitsTarget(null)} className="rounded-md p-2 text-gray-400 hover:bg-gray-100">
                <FiX />
              </button>
            </div>
            <div className="overflow-x-auto">
              <GlobalTable className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Barcode</th>
                    <th className="px-5 py-3">Serial</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Produced by</th>
                    <th className="px-5 py-3">Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unitsTarget.units.map((unit) => {
                    const statusColors = {
                      IN_PRODUCTION: 'bg-sky-50 text-sky-700',
                      AVAILABLE: 'bg-green-50 text-green-700',
                      RESERVED: 'bg-amber-50 text-amber-700',
                      SOLD: 'bg-gray-100 text-gray-500',
                      DEFECTIVE: 'bg-red-50 text-red-600'
                    };
                    return (
                      <tr key={unit._id}>
                        <td className="px-5 py-3 font-mono text-xs text-gray-700">{unit.barcode}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{unit.unitSerial}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${statusColors[unit.status] || 'bg-gray-100 text-gray-500'}`}
                          >
                            {(unit.status || '').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{unit.producedBy?.name || '—'}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{unit.orderItem?.orderNo || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </GlobalTable>
            </div>
          </div>
        </div>
      )}

      {/* ── SHORT DESCRIPTION ───────────────────────────────────────────── */}
      {product.shortDescription && (
        <div className={card}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <FiBox size={12} /> Description
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{product.shortDescription}</p>
        </div>
      )}

      {/* ── BOTTOM ACTIONS ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={() => router.push(`/products/${slug}`)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] text-white rounded-md text-sm font-semibold hover:brightness-95 transition"
        >
          <MdEdit size={16} /> Edit
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 transition"
        >
          <MdDelete size={16} /> Delete
        </button>
      </div>
    </div>
  );
}
