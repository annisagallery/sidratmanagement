'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { MdAdd, MdArrowBack, MdDeleteOutline, MdReceiptLong, MdSave } from 'react-icons/md';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';

const quantity = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1000) / 1000;
const money = (value) => `BDT ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function variationLabel(variation) {
  const values = (variation?.attributes || []).map((item) => item.valueName).filter(Boolean);
  return values.length ? values.join(' / ') : variation?.sku || `Variation ${String(variation?.id || '').slice(0, 6)}`;
}

export default function ProductBom({ slug }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [variationId, setVariationId] = useState('');
  const [lines, setLines] = useState([]);

  const bomQuery = useQuery(
    ['product-bom', slug, variationId],
    () => api.getProductBom({ slug, variationId: variationId || null }),
    {
      keepPreviousData: true,
      onSuccess: (response) => setLines((response?.data?.lines || []).map((line) => ({
        accessoryId: line.accessoryId,
        quantity: Number(line.quantity),
        wastagePercent: Number(line.wastagePercent || 0),
        note: line.note || '',
        availableQuantity: Number(line.availableQuantity || 0),
        estimatedUnitCost: line.estimatedUnitCost,
        isRepurchasable: Boolean(line.isRepurchasable),
        inherited: Boolean(variationId && !line.variationId),
      }))),
    }
  );
  const materialsQuery = useQuery(['bom-materials'], api.getBomMaterials);
  const bom = bomQuery.data?.data;
  const materials = materialsQuery.data?.data || [];

  const saveMutation = useMutation(api.saveProductBom, {
    onSuccess: () => {
      queryClient.invalidateQueries(['product-bom', slug]);
      Swal.fire({ icon: 'success', title: 'BOM saved', text: 'Material demand and costing have been recalculated.', timer: 1800, showConfirmButton: false });
    },
    onError: (error) => Swal.fire('Could not save BOM', error?.response?.data?.message || 'Please check the material rows.', 'error'),
  });

  const selectedIds = new Set(lines.map((line) => line.accessoryId));
  const localMaterialCost = useMemo(() => lines.reduce((sum, line) => {
    const required = quantity(Number(line.quantity) * (1 + Number(line.wastagePercent || 0) / 100));
    return sum + required * Number(line.estimatedUnitCost || 0);
  }, 0), [lines]);
  const labourCost = Number(bom?.labourCost || 0);
  const totalCost = localMaterialCost + labourCost;
  const sellingPrice = Number(bom?.sellingPrice || 0);
  const profit = sellingPrice - totalCost;

  const updateLine = (index, key, value) => setLines((current) => current.map((line, rowIndex) => (
    rowIndex === index ? { ...line, [key]: value, inherited: false } : line
  )));
  const addLine = () => {
    const material = materials.find((item) => !selectedIds.has(item.id));
    if (!material) return;
    setLines((current) => [...current, {
      accessoryId: material.id,
      quantity: 1,
      wastagePercent: 0,
      note: '',
      availableQuantity: Number(material.unitMode === 'roll_meter' ? material.stockMeters : material.stockQty),
      estimatedUnitCost: null,
      isRepurchasable: Boolean(material.isRepurchasable),
      inherited: false,
    }]);
  };

  const save = () => saveMutation.mutate({
    slug,
    variationId: variationId || null,
    lines: lines.map(({ accessoryId, quantity: perUnit, wastagePercent, note }) => ({
      accessoryId,
      quantity: Number(perUnit),
      wastagePercent: Number(wastagePercent || 0),
      note,
    })),
  });

  if (bomQuery.isLoading && !bom) return <div className="card-ui h-[520px] animate-pulse bg-slate-100" />;
  if (bomQuery.isError) return (
    <div className="card-ui p-10 text-center">
      <p className="font-semibold text-red-700">The product material sheet could not be loaded.</p>
      <button className="btn-ghost mt-4" onClick={() => router.push(`/products/${slug}`)}><MdArrowBack /> Back to product</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${bom?.product?.name || 'Product'} materials`}
        subtitle="One-unit bill of materials, availability and approximate production cost"
        icon={MdReceiptLong}
      >
        <button className="btn-ghost min-h-11" onClick={() => router.push(`/products/${slug}`)}><MdArrowBack size={18} /> Product details</button>
        <button className="btn-brand min-h-11" onClick={save} disabled={saveMutation.isLoading || bomQuery.isFetching}>
          <MdSave size={18} /> {saveMutation.isLoading ? 'Saving...' : 'Save BOM'}
        </button>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card-ui overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-label">Costing scope</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Materials for one finished unit</h2>
              <p className="mt-1 text-sm text-slate-500">Movement between HQ, cutting and counters does not consume these quantities.</p>
            </div>
            <label className="min-w-64">
              <span className="section-label mb-1 block">Product option</span>
              <select className="select-ui w-full" value={variationId} onChange={(event) => setVariationId(event.target.value)}>
                <option value="">Base BOM (all options)</option>
                {(bom?.variations || []).map((variation) => <option key={variation.id} value={variation.id}>{variationLabel(variation)}</option>)}
              </select>
            </label>
          </div>

          <div className="divide-y divide-slate-100">
            {!lines.length && (
              <div className="px-6 py-16 text-center">
                <p className="text-base font-semibold text-slate-700">No production materials configured</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Orders that need production will be blocked until at least one BOM line is saved.</p>
              </div>
            )}
            {lines.map((line, index) => {
              const material = materials.find((item) => item.id === line.accessoryId) || bom?.lines?.find((item) => item.accessoryId === line.accessoryId)?.accessory;
              const required = quantity(Number(line.quantity || 0) * (1 + Number(line.wastagePercent || 0) / 100));
              const shortage = Math.max(0, required - Number(line.availableQuantity || 0));
              return (
                <div key={`${line.accessoryId}-${index}`} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(220px,1.4fr)_120px_110px_150px_40px] lg:items-start">
                  <div>
                    <select className="select-ui w-full font-semibold" value={line.accessoryId} onChange={(event) => {
                      const next = materials.find((item) => item.id === event.target.value);
                      updateLine(index, 'accessoryId', event.target.value);
                      setLines((current) => current.map((row, rowIndex) => rowIndex === index ? {
                        ...row,
                        accessoryId: event.target.value,
                        availableQuantity: Number(next?.unitMode === 'roll_meter' ? next?.stockMeters : next?.stockQty),
                        isRepurchasable: Boolean(next?.isRepurchasable),
                        estimatedUnitCost: null,
                      } : row));
                    }}>
                      {materials.map((item) => <option key={item.id} value={item.id} disabled={item.id !== line.accessoryId && selectedIds.has(item.id)}>{item.name} · {item.code}</option>)}
                    </select>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">{material?.unitMode === 'roll_meter' ? 'metres' : material?.unit?.name || 'units'}</span>
                      {line.inherited && <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">Inherited from base</span>}
                      <span className={`rounded-full px-2 py-1 font-semibold ${line.isRepurchasable ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                        {line.isRepurchasable ? 'Can be repurchased' : 'Cannot be repurchased'}
                      </span>
                    </div>
                    <input className="input-ui mt-3" placeholder="Process note, e.g. cut before issue" value={line.note} onChange={(event) => updateLine(index, 'note', event.target.value)} />
                  </div>
                  <label>
                    <span className="section-label mb-1 block">Per unit</span>
                    <input type="number" min="0.001" step="0.001" className="input-ui" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} />
                  </label>
                  <label>
                    <span className="section-label mb-1 block">Waste %</span>
                    <input type="number" min="0" max="100" step="0.1" className="input-ui" value={line.wastagePercent} onChange={(event) => updateLine(index, 'wastagePercent', event.target.value)} />
                  </label>
                  <div>
                    <span className="section-label mb-1 block">Availability</span>
                    <p className="text-sm font-bold text-slate-800">{quantity(line.availableQuantity)} available</p>
                    <p className="mt-1 text-xs text-slate-500">{required} required incl. waste</p>
                    {shortage > 0 && <p className={`mt-2 text-xs font-bold ${line.isRepurchasable ? 'text-amber-700' : 'text-red-700'}`}>{line.isRepurchasable ? `Wait for purchase: ${quantity(shortage)}` : `Blocks order: short ${quantity(shortage)}`}</p>}
                  </div>
                  <button className="btn-icon mt-4 text-red-600" aria-label={`Remove ${material?.name || 'material'}`} onClick={() => setLines((current) => current.filter((_, rowIndex) => rowIndex !== index))}><MdDeleteOutline size={20} /></button>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            <button className="btn-ghost" onClick={addLine} disabled={materials.length === selectedIds.size}><MdAdd size={18} /> Add material</button>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <div className="card-ui overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Approximate unit cost</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{money(totalCost)}</p>
            </div>
            <dl className="divide-y divide-slate-100 px-5">
              <div className="flex justify-between py-3 text-sm"><dt className="text-slate-500">Materials</dt><dd className="font-semibold">{money(localMaterialCost)}</dd></div>
              <div className="flex justify-between py-3 text-sm"><dt className="text-slate-500">Production rate</dt><dd className="font-semibold">{money(labourCost)}</dd></div>
              <div className="flex justify-between py-3 text-sm"><dt className="text-slate-500">Selling price</dt><dd className="font-semibold">{money(sellingPrice)}</dd></div>
              <div className="flex justify-between py-3 text-sm"><dt className="text-slate-500">Estimated profit</dt><dd className={`font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{money(profit)}</dd></div>
            </dl>
            {!bom?.costComplete && <p className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-800">Some materials have no purchase cost yet. This estimate is incomplete.</p>}
          </div>
          <div className="card-ui p-5 text-sm text-slate-600">
            <p className="font-bold text-slate-800">How orders use this</p>
            <p className="mt-2 leading-6">Finished stock is reserved first. Any remaining units reserve this BOM. Repurchasable shortages wait for stock-in; non-repurchasable shortages stop the order.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
