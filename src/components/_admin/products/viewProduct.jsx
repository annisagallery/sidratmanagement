'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next-nprogress-bar';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { MdArrowBack, MdEdit, MdDelete, MdOpenInNew, MdPrint } from 'react-icons/md';
import { FiImage, FiPackage } from 'react-icons/fi';
import { alertError, confirmDelete, toastSuccess } from 'src/utils/swal';
import * as api from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import Panel from 'src/components/_admin/ui/Panel';
import Segmented from 'src/components/_admin/ui/Segmented';
import Badge from 'src/components/_admin/ui/Badge';
import { KpiGrid, StatTile } from 'src/components/_admin/ui/kpi';
import { EmptyState, ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';
import { ModalShell, money } from 'src/components/_admin/ui/primitives';
import { UnitStatusPill, displaySku } from 'src/components/_admin/inventory/shared';

function InfoRow({ label, value, children }) {
  if (!children && !value && value !== 0) return null;
  return (
    <div className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{children ?? value}</dd>
    </div>
  );
}

/** One option value, with its swatch when it is a colour. */
function OptionChip({ name, hex }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      {hex && <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-slate-900/10" style={{ backgroundColor: hex }} aria-hidden />}
      {name}
    </span>
  );
}

const PRODUCT_STATUS = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  draft: { label: 'Draft', tone: 'warning' }
};

function ProductStatus({ status }) {
  const meta = PRODUCT_STATUS[status] || { label: status || 'Unknown', tone: 'neutral' };
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export default function ViewProduct({ slug }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(null);
  const [invBranch, setInvBranch] = useState('all');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
  const [attrFilters, setAttrFilters] = useState({});
  const [unitsTarget, setUnitsTarget] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery(['product-admin', slug], () => api.getOneProductByAdmin(slug), {
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const product = data?.data;

  const invQuery = useQuery(['product-stock-detail', product?.id], () => api.getProductStockDetail(product.id), {
    enabled: !!product?.id
  });
  const branchsQuery = useQuery('inventory-branchs', api.adminGetBranches, {
    staleTime: 60_000,
    retry: false
  });
  const { balances: invBalances = [], units: invUnits = [] } = invQuery.data?.data || {};
  const productVariations = product?.variations;

  const invBranches = useMemo(() => {
    const seen = new Map();
    (branchsQuery.data?.data || []).forEach((branch) => {
      if (branch?.isActive !== false) seen.set(String(branch.id), branch);
    });
    invBalances.forEach((b) => {
      if (b.branch && !seen.has(String(b.branch.id))) seen.set(String(b.branch.id), b.branch);
    });
    return [...seen.values()];
  }, [invBalances, branchsQuery.data]);

  const invByVariation = useMemo(() => {
    const map = new Map();
    (productVariations || []).forEach((variation) => {
      map.set(String(variation.id), { variation, byBranch: {} });
    });
    invBalances.forEach((b) => {
      const key = String(b.variation?.id || '__base__');
      if (!map.has(key)) map.set(key, { variation: b.variation, byBranch: {} });
      map.get(key).byBranch[String(b.branch.id)] = { onHand: b.onHand, reserved: b.reserved };
    });
    return [...map.values()];
  }, [invBalances, productVariations]);

  const invUnitsByVariation = useMemo(() => {
    const map = new Map();
    invUnits.forEach((u) => {
      const key = String(u.variation?.id || '__base__');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    });
    return map;
  }, [invUnits]);

  const warehouseSummaries = useMemo(() => {
    return invBranches
      .map((branch) => {
        const branchId = String(branch.id);
        let quantity = 0;
        let variationCount = 0;
        invByVariation.forEach((row) => {
          const wb = row.byBranch[branchId];
          if (!wb) return;
          const avail = Math.max(0, Number(wb.onHand || 0) - Number(wb.reserved || 0));
          if (avail > 0) variationCount += 1;
          quantity += avail;
        });
        return { branch, quantity, variationCount };
      })
      .sort((a, b) => b.quantity - a.quantity);
  }, [invBranches, invByVariation]);

  const showBranchStockBreakdown = invBranch !== 'all';
  const visibleBranches = showBranchStockBreakdown ? invBranches.filter((w) => String(w.id) === invBranch) : [];
  const availableForSelectedBranch = (row) =>
    Object.entries(row.byBranch)
      .filter(([branchId]) => invBranch === 'all' || branchId === invBranch)
      .reduce(
        (sum, [, balance]) =>
          sum + Math.max(0, Number(balance.onHand || 0) - Number(balance.reserved || 0)),
        0
      );
  const activeAttrFilters = useMemo(
    () => Object.entries(attrFilters).filter(([, value]) => value && value !== 'all'),
    [attrFilters]
  );

  const visibleVariationRows = useMemo(() => {
    const availableForRow = (row) =>
      Object.entries(row.byBranch)
        .filter(([branchId]) => invBranch === 'all' || branchId === invBranch)
        .reduce(
          (sum, [, balance]) => sum + Math.max(0, Number(balance.onHand || 0) - Number(balance.reserved || 0)),
          0
        );
    const matchesAttrFilters = (row) => {
      const attrs = row.variation?.attributes || [];
      return activeAttrFilters.every(([name, value]) =>
        attrs.some((attr) => (attr.attributeName || 'Attribute') === name && attr.valueName === value)
      );
    };

    let rows = showOnlyAvailable ? invByVariation.filter((row) => availableForRow(row) > 0) : [...invByVariation];
    if (activeAttrFilters.length > 0) rows = rows.filter(matchesAttrFilters);

    return rows.sort((a, b) => {
      const aValues = (a.variation?.attributes || []).map((attr) => attr.valueName || '').join(' | ');
      const bValues = (b.variation?.attributes || []).map((attr) => attr.valueName || '').join(' | ');
      return aValues.localeCompare(bValues, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [invByVariation, invBranch, showOnlyAvailable, activeAttrFilters]);

  const { mutate: deleteProduct } = useMutation(() => api.deleteProductByAdmin(slug), {
    onSuccess: () => {
      toastSuccess('Product deleted', 'It is in the recycle bin if you need it back.');
      qc.invalidateQueries(['admin-products']);
      router.push('/products');
    },
    onError: (error) => alertError(error, { title: "Couldn't delete that product" })
  });

  function handleDelete() {
    confirmDelete({
      title: 'Delete this product?',
      subject: product?.name,
      text: 'The product and all of its variations stop appearing on the storefront. It can be restored from the recycle bin.'
    }).then((confirmed) => {
      if (confirmed) deleteProduct();
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-8 w-72" />
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,2fr)_3fr]">
          <div className="card-ui aspect-[2/3] w-full animate-pulse" />
          <div className="card-ui h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError && !product) {
    return <ErrorState error={error} title="This product could not be loaded" onRetry={refetch} />;
  }

  if (!product) {
    return (
      <div className="card-ui">
        <EmptyState
          icon={FiPackage}
          title="Product not found"
          hint="It may have been deleted, or the link is wrong."
          action={
            <button type="button" onClick={() => router.push('/products')} className="btn-ghost">
              Back to products
            </button>
          }
        />
      </div>
    );
  }

  const featuredImage = product.featuredImage;
  const images = product.images || [];
  const displayImage = selectedImage ?? featuredImage?.path ?? null;
  const gallery = [featuredImage?.path, ...images.map((img) => img?.path || img)].filter(
    (path, i, all) => path && all.indexOf(path) === i
  );

  const hasVarAttrs = (product.variations || []).some((v) => (v.attributes || []).length > 0);
  const productType = hasVarAttrs ? 'With options' : 'Single item';

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
    invBranch === 'all' ? invBalances : invBalances.filter((balance) => String(balance.branch?.id) === invBranch);
  const selectedAvailable = selectedBalances.reduce(
    (sum, balance) => sum + Math.max(0, Number(balance.onHand || 0) - Number(balance.reserved || 0)),
    0
  );
  const stockedVariationCount = invByVariation.filter((row) =>
    Object.entries(row.byBranch)
      .filter(([branchId]) => invBranch === 'all' || branchId === invBranch)
      .some(([, balance]) => Number(balance.onHand || 0) - Number(balance.reserved || 0) > 0)
  ).length;
  const getOptionCatalogCode = (variation) => {
    const index = (product.variations || []).findIndex((item) => String(item.id) === String(variation?.id));
    const variationCode = variation?.productionCode || index + 1;
    return product.code && variationCode > 0
      ? `${String(product.code).padStart(4, '0')}-${String(variationCode).padStart(4, '0')}`
      : '—';
  };
  const filtersOn = invBranch !== 'all' || activeAttrFilters.length > 0;
  const legacyCodes = [product.primaryBarcode, ...(product.legacyBarcodes || [])].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            aria-label="Back to products"
            title="Back to products"
            onClick={() => router.push('/products')}
            className="btn-icon mt-0.5 shrink-0"
          >
            <MdArrowBack size={20} aria-hidden />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{product.name}</h1>
              <ProductStatus status={product.status} />
              {product.isFeatured && <Badge tone="violet">Featured</Badge>}
            </div>
            <p className="ops-code mt-1 text-[13px] text-slate-500">/{product.slug}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.open(`/product-labels?slug=${encodeURIComponent(slug)}`, '_blank', 'noopener')}
            className="btn-ghost"
            title="Retail price labels — 44 per A4 sheet"
          >
            <MdPrint size={16} aria-hidden /> Labels
          </button>
          <button type="button" onClick={() => router.push(`/products/${slug}`)} className="btn-brand">
            <MdEdit size={16} aria-hidden /> Edit product
          </button>
          <ActionMenu
            label="More product actions"
            items={[
              {
                label: 'View on storefront',
                icon: MdOpenInNew,
                onClick: () =>
                  window.open(
                    `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/product/${product.slug}`,
                    '_blank',
                    'noopener'
                  )
              },
              { label: 'Delete product', icon: MdDelete, tone: 'danger', onClick: handleDelete }
            ]}
          />
        </div>
      </div>

      {/* ── Gallery + details ────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,2fr)_3fr] lg:items-start">
        <section className="card-ui p-4" aria-label="Images">
          <div className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-md bg-slate-50">
            {displayImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayImage} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                <FiImage size={40} aria-hidden />
                <p className="text-[13px] text-slate-500">No image yet</p>
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose image">
              {gallery.map((path, i) => (
                <button
                  key={path}
                  type="button"
                  aria-label={`Show image ${i + 1}`}
                  aria-pressed={displayImage === path}
                  onClick={() => setSelectedImage(path)}
                  className={`relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md border-2 transition ${
                    displayImage === path ? 'border-slate-900' : 'border-transparent hover:border-slate-300'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={path} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <Panel title="Details">
            <dl className="divide-y divide-slate-100 text-[13px]">
              <InfoRow label="Type" value={productType} />
              <InfoRow label="Category" value={product.category?.name} />
              <InfoRow label="Product code">
                <span className="ops-code">{product.code ? String(product.code).padStart(4, '0') : '—'}</span>
              </InfoRow>
              {legacyCodes && (
                <InfoRow label="Old barcodes">
                  <span className="ops-code break-all">{legacyCodes}</span>
                </InfoRow>
              )}
              <InfoRow label="Cost">
                <span className="tabular-nums">{money(product.rate)}</span>
              </InfoRow>
              <InfoRow label="Price">
                <span className="tabular-nums">{money(product.price)}</span>
                {product.priceSale > 0 && (
                  <span className="ml-2 tabular-nums text-emerald-700">Sale {money(product.priceSale)}</span>
                )}
              </InfoRow>
              {product.trackInventory && (
                <InfoRow label="In stock">
                  <Badge tone={totalStock > 0 ? 'success' : 'neutral'}>
                    {totalStock.toLocaleString()} unit{totalStock === 1 ? '' : 's'}
                  </Badge>
                </InfoRow>
              )}
            </dl>
          </Panel>

          {attributeGroups.length > 0 && (
            <Panel title="Options">
              <dl className="space-y-3">
                {attributeGroups.map((group) => (
                  <div key={group.name} className="grid gap-1.5 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <dt className="pt-0.5 text-[13px] text-slate-500">{group.name}</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {group.values.map((value) => (
                        <OptionChip key={value.name} name={value.name} hex={value.colorHex} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}

          {product.shortDescription && (
            <Panel title="Short description">
              <p className="text-[13px] leading-relaxed text-slate-700">{product.shortDescription}</p>
            </Panel>
          )}
        </div>
      </div>

      {/* ── Options & stock ──────────────────────────────────────────────── */}
      {product.trackInventory && (
        <section className="card-ui overflow-hidden" aria-labelledby="stock-title">
          <header className="space-y-4 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="stock-title" className="text-[15px] font-semibold text-slate-900">
                  Options and stock
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">Price, code and stock for every option, by warehouse.</p>
              </div>
              <Segmented
                label="Show"
                size="sm"
                options={[
                  { id: 'stocked', label: 'In stock' },
                  { id: 'all', label: 'All options' }
                ]}
                value={showOnlyAvailable ? 'stocked' : 'all'}
                onChange={(v) => setShowOnlyAvailable(v === 'stocked')}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={invBranch} onChange={(e) => setInvBranch(e.target.value)} className="select-ui" aria-label="Warehouse">
                <option value="all">All warehouses</option>
                {invBranches.map((branch) => (
                  <option key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {attributeGroups.map((group) => (
                <select
                  key={group.name}
                  value={attrFilters[group.name] || 'all'}
                  onChange={(e) => setAttrFilters((f) => ({ ...f, [group.name]: e.target.value }))}
                  className="select-ui"
                  aria-label={group.name}
                >
                  <option value="all">Any {group.name.toLowerCase()}</option>
                  {group.values.map((value) => (
                    <option key={value.name} value={value.name}>
                      {value.name}
                    </option>
                  ))}
                </select>
              ))}
              {filtersOn && (
                <button
                  type="button"
                  onClick={() => {
                    setInvBranch('all');
                    setAttrFilters({});
                  }}
                  className="btn-quiet btn-sm"
                >
                  Clear filters
                </button>
              )}
            </div>
          </header>

          <KpiGrid columns={3} className="!rounded-none !border-x-0 !border-t-0 !shadow-none">
            <StatTile size="sm" label="Available" value={selectedAvailable.toLocaleString()} loading={invQuery.isLoading} />
            <StatTile size="sm" label="Options in stock" value={stockedVariationCount.toLocaleString()} loading={invQuery.isLoading} />
            <StatTile size="sm" label="Options" value={invByVariation.length.toLocaleString()} loading={invQuery.isLoading} />
          </KpiGrid>

          {invQuery.isError ? (
            <div className="p-5">
              <ErrorState error={invQuery.error} title="Stock could not be loaded" onRetry={invQuery.refetch} />
            </div>
          ) : invQuery.isLoading ? (
            <LoadingBlock rows={5} bare />
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
              {warehouseSummaries.length > 0 && (
                <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
                  <GlobalTable>
                    <caption className="sr-only">Stock by warehouse</caption>
                    <thead>
                      <tr>
                        <th scope="col">Warehouse</th>
                        <th scope="col" className="text-right">
                          Available
                        </th>
                        <th scope="col" className="text-right">
                          Options
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {warehouseSummaries.map(({ branch, quantity, variationCount }) => {
                        const branchId = String(branch.id);
                        const isSelected = invBranch === branchId;
                        return (
                          <tr key={branchId} className={isSelected ? 'bg-slate-50' : ''} aria-current={isSelected || undefined}>
                            <td className={`font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{branch.name}</td>
                            <td className={`text-right tabular-nums ${quantity > 0 ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                              {quantity.toLocaleString()}
                            </td>
                            <td className="text-right tabular-nums text-slate-600">{variationCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </GlobalTable>
                </div>
              )}

              <div className="min-w-0">
                {visibleVariationRows.length ? (
                  <GlobalTable>
                    <caption className="sr-only">Options and their stock</caption>
                    <thead>
                      <tr>
                        <th scope="col">Option</th>
                        <th scope="col" className="hidden md:table-cell">
                          Code
                        </th>
                        <th scope="col" className="text-right">
                          Price
                        </th>
                        {showBranchStockBreakdown ? (
                          visibleBranches.map((w) => (
                            <th key={w.id} scope="col" className="text-right">
                              <span className="sr-only">{w.name} </span>Stock
                            </th>
                          ))
                        ) : (
                          <th scope="col" className="text-right">
                            Stock
                          </th>
                        )}
                        <th scope="col" className="text-right">
                          Pieces
                        </th>
                        <th scope="col" className="hidden sm:table-cell">
                          Presale
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleVariationRows.map((row) => {
                        const varId = String(row.variation?.id || '__base__');
                        const varUnits = invUnitsByVariation.get(varId) || [];
                        const attrs = row.variation?.attributes || [];
                        const attrLabel =
                          attrs
                            .map((a) => a.valueName)
                            .filter(Boolean)
                            .join(' / ') || 'Default';
                        const stockCell = (avail, key) => (
                          <td key={key} className={`text-right tabular-nums ${avail > 0 ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                            {avail}
                          </td>
                        );
                        return (
                          <tr key={varId}>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {attrs.length > 0 ? (
                                  attrs.map((a, j) => <OptionChip key={j} name={a.valueName} hex={a.colorHex} />)
                                ) : (
                                  <span className="text-[13px] text-slate-500">Default</span>
                                )}
                              </div>
                              {displaySku(row.variation?.sku) && (
                                <p className="ops-code mt-0.5 text-xs text-slate-500">{displaySku(row.variation.sku)}</p>
                              )}
                            </td>
                            <td className="ops-code hidden text-[13px] text-slate-700 md:table-cell">{getOptionCatalogCode(row.variation)}</td>
                            <td className="whitespace-nowrap text-right tabular-nums">
                              <span className="font-medium text-slate-900">
                                ৳{Number(row.variation?.regularPrice ?? product.price ?? 0).toLocaleString()}
                              </span>
                              {row.variation?.salePrice != null && (
                                <span className="block text-xs text-emerald-700">
                                  Sale ৳{Number(row.variation.salePrice).toLocaleString()}
                                </span>
                              )}
                            </td>
                            {showBranchStockBreakdown
                              ? visibleBranches.map((w) => {
                                  const wb = row.byBranch[String(w.id)];
                                  const avail = wb ? Math.max(0, Number(wb.onHand || 0) - Number(wb.reserved || 0)) : 0;
                                  return stockCell(avail, w.id);
                                })
                              : stockCell(availableForSelectedBranch(row), 'total')}
                            <td className="text-right">
                              {varUnits.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setUnitsTarget({ label: attrLabel, units: varUnits })}
                                  className="btn-ghost btn-sm"
                                  aria-label={`${varUnits.length} pieces of ${attrLabel} — show barcodes`}
                                >
                                  {varUnits.length}
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            {/* Read-only here. Presale eligibility is set on the
                                product's Presale step, next to the options it
                                applies to and before the materials that decide how
                                many units it allows — editing it from a stock view
                                divorced it from both. */}
                            <td className="hidden sm:table-cell">
                              {row.variation?.overSale ? <Badge tone="warning">Presale</Badge> : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </GlobalTable>
                ) : (
                  <EmptyState
                    compact
                    title={showOnlyAvailable ? 'No option is in stock here' : 'No options match'}
                    hint={showOnlyAvailable ? 'Choose “All options” to see every option.' : 'Clear the filters to see every option.'}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Piece barcodes ───────────────────────────────────────────────── */}
      {unitsTarget && (
        <ModalShell title="Pieces" subtitle={unitsTarget.label} size="lg" onClose={() => setUnitsTarget(null)}>
          <div className="-mx-5 -my-5 sm:-mx-6">
            <GlobalTable>
              <caption className="sr-only">Pieces of {unitsTarget.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Barcode</th>
                  <th scope="col" className="hidden sm:table-cell">
                    Serial
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="hidden md:table-cell">
                    Made by
                  </th>
                  <th scope="col">Order</th>
                </tr>
              </thead>
              <tbody>
                {unitsTarget.units.map((unit) => (
                  <tr key={unit.id}>
                    <td className="ops-code text-[13px] text-slate-900">{unit.barcode}</td>
                    <td className="ops-code hidden text-[13px] text-slate-500 sm:table-cell">{unit.unitSerial || '—'}</td>
                    <td>
                      <UnitStatusPill status={unit.status} />
                    </td>
                    <td className="hidden text-[13px] text-slate-600 md:table-cell">{unit.producedBy?.name || '—'}</td>
                    <td>
                      {unit.orderItem?.orderNo ? (
                        <Link href={`/orders/${unit.orderItem.orderNo}`} className="ops-code text-[13px] text-slate-900 hover:underline">
                          #{unit.orderItem.orderNo}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </GlobalTable>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
