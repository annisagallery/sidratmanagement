'use client';
import DataTable from 'src/components/_admin/ui/DataTable';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Pagination from 'src/components/_admin/ui/Pagination';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { format, isBefore, startOfDay } from 'date-fns';
import { toast } from 'react-toastify';
import { FiArrowRight, FiCheck, FiClock, FiEdit2, FiPlus, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';
import {
  assignProductionNeedToStock,
  createProductionBatch,
  getProductionBatchUnits,
  getProductionBatches,
  getProductionNeeds,
  searchProductionProducers,
  searchProducts,
  startProductionBatch,
  submitProductionUnit,
  updateProductionBatch
} from 'src/services';

const field =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-blue-100';
const action =
  'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40';

const errorText = (error) => error.response?.data?.message || error.message || 'The action could not be completed.';
const variationLabel = (variation) =>
  variation?.sku ||
  variation?.attributes
    ?.map((attribute) => attribute.valueName)
    .filter(Boolean)
    .join(' / ') ||
  'Base product';

function DueDate({ value }) {
  if (!value) return <span className="text-xs text-slate-400">No delivery date</span>;
  const overdue = isBefore(new Date(value), startOfDay(new Date()));
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${overdue ? 'text-red-600' : 'text-amber-700'}`}>
      <FiClock /> {format(new Date(value), 'dd MMM yyyy')}
    </span>
  );
}

function NeedCard({ need, selected, onSelect, onAssign, assigning }) {
  return (
    <article
      className={`group grid gap-3 border-b border-slate-100 p-4 transition md:grid-cols-[150px_minmax(0,1fr)_90px_150px_96px] md:items-center ${
        selected ? 'bg-blue-50/70' : 'bg-white hover:bg-slate-50'
      }`}
    >
      <div>
        <span className="font-mono text-[11px] font-bold text-blue-600">Order #{need.orderNo}</span>
        {need.isCustom && (
          <span className="ml-2 rounded-md bg-fuchsia-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-fuchsia-700">
            Custom
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-bold text-slate-900">{need.pid?.name}</h3>
        <p className="mt-0.5 truncate text-xs text-slate-500">{variationLabel(need.variationId)}</p>
        {need.customizeDetails && (
          <p className="mt-2 line-clamp-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900">
            {need.customizeDetails}
          </p>
        )}
      </div>
      <div className="font-mono text-lg font-black text-slate-950">{need.quantity}</div>
      <DueDate value={need.deliveryDate} />
      <button
        type="button"
        onClick={() => onSelect(need)}
        disabled={selected}
        className={`${action} bg-slate-950 text-white`}
      >
        {selected ? (
          <FiCheck />
        ) : (
          <>
            <FiPlus /> Add
          </>
        )}
      </button>
      {need.isCustom && (
        <p
          className={`rounded-md px-3 py-2 text-xs font-semibold md:col-span-4 ${
            need.availableCustomStock > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {need.availableCustomStock > 0
            ? `${need.availableCustomStock} matching custom piece${need.availableCustomStock === 1 ? '' : 's'} available from cancelled or returned orders.`
            : 'No matching custom stock from cancelled or returned orders.'}
        </p>
      )}
      <button
        type="button"
        onClick={() => onAssign(need._id)}
        disabled={assigning || selected || (need.isCustom && !need.availableCustomStock)}
        className="text-left text-xs font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-40 md:col-span-5"
      >
        Assign matching HQ stock instead
      </button>
    </article>
  );
}
function BatchEditModal({ batch, products, onClose, onSave, saving }) {
  const stockLocked = ['COMPLETED', 'CANCELLED'].includes(batch.status);
  const [note, setNote] = useState(batch.note || '');
  const [items, setItems] = useState(
    (batch.items || []).map((item) => ({
      _key: item._id,
      orderItem: item.orderItem?._id || item.orderItem || null,
      product: item.product?._id || item.product,
      variation: item.variation?._id || item.variation || '',
      quantity: item.quantity,
      note: item.note || '',
      productName: item.product?.name,
      variationName: variationLabel(item.variation),
      orderNo: item.orderItem?.orderNo || null
    }))
  );
  const [manual, setManual] = useState({ product: '', variation: '', quantity: 1, note: '' });
  const selectedProduct = products.find((product) => product._id === manual.product);

  const addManual = () => {
    if (!manual.product || Number(manual.quantity) < 1) return;
    const product = products.find((entry) => entry._id === manual.product);
    const variation = product?.variations?.find((entry) => entry._id === manual.variation);
    setItems((current) => [
      ...current,
      {
        ...manual,
        _key: `new-${Date.now()}`,
        orderItem: null,
        productName: product?.name,
        variationName: variationLabel(variation),
        orderNo: null
      }
    ]);
    setManual({ product: '', variation: '', quantity: 1, note: '' });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="font-mono text-xs font-black text-blue-600">{batch.batchNo}</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Edit draft batch</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <FiX />
          </button>
        </div>
        <div className="max-h-[calc(92vh-145px)] overflow-y-auto p-6">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Batch note</label>
            <input
              className={field}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional internal note"
            />
          </div>
          <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
            <DataTable className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3">Production note</th>
                  <th className="w-14 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item._key}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{item.productName}</p>
                      <p className="text-xs text-slate-400">{item.variationName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ${item.orderItem ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {item.orderNo ? `Order #${item.orderNo}` : 'Manual stock'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        disabled={!!item.orderItem || stockLocked}
                        className={`${field} mx-auto w-20 text-center disabled:bg-slate-100`}
                        value={item.quantity}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((entry) =>
                              entry._key === item._key ? { ...entry, quantity: Number(event.target.value) } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        disabled={!!item.orderItem || stockLocked}
                        className={`${field} disabled:bg-slate-100`}
                        value={item.note}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((entry) =>
                              entry._key === item._key ? { ...entry, note: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={stockLocked}
                        onClick={() => setItems((current) => current.filter((entry) => entry._key !== item._key))}
                        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove product"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          {!stockLocked && (
            <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Add manual product</p>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_100px_auto]">
                <select
                  className={field}
                  value={manual.product}
                  onChange={(event) => setManual({ ...manual, product: event.target.value, variation: '' })}
                >
                  <option value="">Choose product</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} · #{product.code}
                    </option>
                  ))}
                </select>
                <select
                  className={field}
                  value={manual.variation}
                  onChange={(event) => setManual({ ...manual, variation: event.target.value })}
                  disabled={!selectedProduct?.variations?.length}
                >
                  <option value="">{selectedProduct?.variations?.length ? 'Choose variation' : 'Base product'}</option>
                  {(selectedProduct?.variations || []).map((variation) => (
                    <option key={variation._id} value={variation._id}>
                      {variationLabel(variation)}
                    </option>
                  ))}
                </select>
                <input
                  className={field}
                  type="number"
                  min="1"
                  value={manual.quantity}
                  onChange={(event) => setManual({ ...manual, quantity: Number(event.target.value) })}
                />
                <button onClick={addManual} className={`${action} h-10 bg-slate-950 text-white`}>
                  <FiPlus /> Add
                </button>
              </div>
            </div>
          )}
          {stockLocked && (
            <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This batch has affected inventory. Its name and note remain editable, while product quantities are
              preserved.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className={`${action} border border-slate-300 bg-white text-slate-600`}>
            Cancel
          </button>
          <button
            disabled={saving || !items.length}
            onClick={() =>
              onSave({
                id: batch._id,
                note,
                items: items.map((item) => ({
                  orderItem: item.orderItem,
                  product: item.product,
                  variation: item.variation || null,
                  quantity: Number(item.quantity),
                  note: item.note
                }))
              })
            }
            className={`${action} bg-[var(--brand)] text-white`}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductionScanModal({ batch, onClose, onSubmit, saving }) {
  const [barcode, setBarcode] = useState('');
  const [qcConfirmed, setQcConfirmed] = useState(false);
  // producedBy must be the employee's User id (ProductionUnit.producedBy is a
  // User ref) — a search picker, not free text.
  const [producerQuery, setProducerQuery] = useState('');
  const [producer, setProducer] = useState(null);

  const { data: producersData } = useQuery(
    ['production-producers', producerQuery],
    () => searchProductionProducers(producerQuery),
    { keepPreviousData: true }
  );
  const producers = producersData?.data || [];

  const handleSubmit = () => {
    if (!barcode.trim()) return;
    if (!qcConfirmed) {
      toast.warn('Complete QC and confirm it before final submission.');
      return;
    }
    onSubmit({
      barcode: barcode.trim().toUpperCase(),
      producedBy: producer?.userId || undefined,
      qcConfirmed: true
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="font-mono text-xs font-black text-blue-600">{batch.batchNo}</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Scan unit barcode</h2>
          <p className="mt-1 text-sm text-slate-500">
            Scan or type the barcode sticker attached to the completed piece.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1">Barcode</label>
            <input
              autoFocus
              className={`${field} font-mono text-lg font-black uppercase`}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="AAA-00010001"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1">Produced by</label>
            {producer ? (
              <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div>
                  <p className="text-sm font-bold text-slate-800">{producer.name}</p>
                  <p className="font-mono text-[11px] text-slate-500">{producer.employeeCode}</p>
                </div>
                <button
                  type="button"
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                  onClick={() => setProducer(null)}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input
                  className={field}
                  value={producerQuery}
                  onChange={(e) => setProducerQuery(e.target.value)}
                  placeholder="Search employee — optional, defaults to you"
                />
                {producers.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                    {producers.map((p) => (
                      <button
                        key={p.userId}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => setProducer(p)}
                      >
                        <span className="font-semibold text-slate-800">{p.name}</span>
                        <span className="font-mono text-[11px] text-slate-400">{p.employeeCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
            <input
              type="checkbox"
              checked={qcConfirmed}
              onChange={(event) => setQcConfirmed(event.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-amber-400"
            />
            <span>
              <span className="block text-sm font-black">QC passed before submit</span>
              <span className="mt-0.5 block text-xs leading-5">
                Submit is final approval and immediately receives this unit into inventory.
              </span>
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className={`${action} border border-slate-300 bg-white text-slate-700`}>
            Cancel
          </button>
          <button
            disabled={saving || !barcode.trim() || !qcConfirmed}
            onClick={handleSubmit}
            className={`${action} bg-emerald-600 text-white`}
          >
            <FiCheck /> {saving ? 'Submitting…' : 'Submit unit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchViewModal({ batch, onClose, onEdit, onScan }) {
  const unitsQuery = useQuery(['production-batch-units', batch._id], () => getProductionBatchUnits(batch._id), {
    enabled: Boolean(batch?._id) && batch.status !== 'DRAFT'
  });
  const unitsByBatchItem = useMemo(() => {
    const map = new Map();
    (unitsQuery.data?.data || []).forEach((unit) => {
      const key = String(unit.productionBatchItem);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(unit);
    });
    return map;
  }, [unitsQuery.data]);
  const timeline = [
    { label: 'Batch created', at: batch.createdAt, by: batch.createdBy?.name },
    ...(batch.revisions || []).map((revision) => ({
      label: `Updated to version ${revision.version + 1}`,
      at: revision.editedAt,
      by: revision.editedBy?.name
    })),
    { label: 'Production started', at: batch.startedAt, by: batch.startedBy?.name },
    ...batch.items.flatMap((item) =>
      (item.submissions || []).map((submission) => ({
        label: `${submission.quantity} × ${item.product?.name} submitted`,
        at: submission.submittedAt,
        by: submission.submittedBy?.name
      }))
    ),
    { label: 'Production completed automatically', at: batch.completedAt, by: batch.completedBy?.name }
  ]
    .filter((entry) => entry.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at));
  const total = batch.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-blue-600">{batch.batchNo}</span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                VERSION {batch.version || 1}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-950">Production batch</h2>
            <p className="mt-1 text-sm text-slate-500">{total} total pieces · Received into HQ</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(batch)}
              className={`${action} border border-blue-200 bg-blue-50 text-blue-700`}
            >
              <FiEdit2 /> Edit
            </button>
            <button onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
              <FiX />
            </button>
          </div>
        </div>
        <div className="grid max-h-[calc(92vh-105px)] overflow-y-auto lg:grid-cols-[1fr_320px]">
          <section className="p-6">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Products in batch</h3>
            <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
              <DataTable className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Unit code</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3 text-center">Planned</th>
                    <th className="px-4 py-3 text-center">Submitted</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batch.items.map((item) => {
                    const units = unitsByBatchItem.get(String(item._id)) || [];
                    const submittedCodes = (item.submissions || []).flatMap((submission) => submission.unitBarcodes || []);
                    const unitCodes = units.length ? units.map((unit) => unit.barcode) : submittedCodes;
                    return (
                      <tr key={item._id}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">
                            {item.product?.name}{' '}
                            <span className="font-mono text-xs font-normal text-slate-400">#{item.product?.code}</span>
                          </p>
                          <p className="text-xs text-slate-500">{variationLabel(item.variation)}</p>
                          {item.note && <p className="mt-1 text-xs text-amber-700">{item.note}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {unitsQuery.isLoading ? (
                            <span className="text-xs text-slate-400">Loading...</span>
                          ) : unitCodes.length ? (
                            <div className="flex max-w-xs flex-wrap gap-1.5">
                              {unitCodes.slice(0, 6).map((code) => (
                                <span
                                  key={code}
                                  className="rounded-md bg-blue-50 px-2 py-1 font-mono text-[10px] font-black text-blue-700"
                                >
                                  {code}
                                </span>
                              ))}
                              {unitCodes.length > 6 && (
                                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                                  +{unitCodes.length - 6}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">
                              {batch.status === 'DRAFT' ? 'Generated when started' : 'No unit code'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                          {item.orderItem?.orderNo ? `Order #${item.orderItem.orderNo}` : 'Manual stock'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold">{item.quantity}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-emerald-700">
                          {item.completedQuantity || 0}
                        </td>
                        <td className="px-4 py-3 text-right" />
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </div>
            {batch.note && (
              <div className="mt-4 rounded-md bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">Batch note</p>
                <p className="mt-1 text-sm text-slate-700">{batch.note}</p>
              </div>
            )}
          </section>
          <aside className="border-t border-slate-200 bg-slate-50 p-6 lg:border-l lg:border-t-0">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Timeline</h3>
            <div className="mt-5">
              {timeline.map((entry, index) => (
                <div key={`${entry.label}-${entry.at}-${index}`} className="relative flex gap-3 pb-7 last:pb-0">
                  {index < timeline.length - 1 && (
                    <span className="absolute left-[7px] top-4 h-full w-px bg-slate-300" />
                  )}
                  <span className="relative mt-1 h-4 w-4 shrink-0 rounded-md border-4 border-white bg-[var(--brand)] shadow" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{entry.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {format(new Date(entry.at), 'dd MMM yyyy, hh:mm a')}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{entry.by || 'System'}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function BatchListTable({ batches, onView, onEdit, onStart }) {
  return (
    <section className="flex min-h-[calc(100vh-190px)] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-black text-slate-900">Production batches</h2>
          <p className="mt-0.5 text-xs text-slate-400">Open a batch to see products and its complete timeline.</p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-600">
          {batches.length} batches
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <DataTable className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3 text-center">Lines</th>
              <th className="px-4 py-3 text-center">Quantity</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map((batch) => {
              const total = batch.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
              return (
                <tr key={batch._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <button onClick={() => onView(batch)} className="text-left">
                      <p className="font-mono text-xs font-black text-blue-600">{batch.batchNo}</p>
                    </button>
                  </td>
                  <td className="px-4 py-4 text-center font-mono font-bold">{batch.items.length}</td>
                  <td className="px-4 py-4 text-center font-mono text-lg font-black">{total}</td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {format(new Date(batch.createdAt), 'dd MMM yyyy, hh:mm a')}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-md px-2.5 py-1 text-[10px] font-black ${batch.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : batch.status === 'IN_PRODUCTION' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {batch.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-bold">
                      v{batch.version || 1}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onView(batch)}
                        className={`${action} border border-slate-200 bg-white text-slate-700`}
                      >
                        View
                      </button>
                      <button
                        onClick={() => onEdit(batch)}
                        className={`${action} border border-blue-200 bg-blue-50 text-blue-700`}
                      >
                        <FiEdit2 /> Edit
                      </button>
                      {batch.status === 'DRAFT' && (
                        <button onClick={() => onStart(batch._id)} className={`${action} bg-amber-400 text-slate-950`}>
                          Start
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>
      {!batches.length && <div className="p-12 text-center text-sm text-slate-400">No production batches yet.</div>}
    </section>
  );
}

export default function ProductionWorkspace({ initialView = 'batches' }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState(initialView);
  const [selectedNeeds, setSelectedNeeds] = useState([]);
  const [manualItems, setManualItems] = useState([]);
  const [manual, setManual] = useState({ product: '', variation: '', quantity: 1, note: '' });
  const [batchNote, setBatchNote] = useState('');
  const [editingBatch, setEditingBatch] = useState(null);
  const [viewingBatch, setViewingBatch] = useState(null);
  const [batchPage, setBatchPage] = useState(1);
  const batchLimit = 20;

  const needsQuery = useQuery('production-needs', () => getProductionNeeds({ status: 'production-needed' }));
  const batchesQuery = useQuery(
    ['production-batches', batchPage],
    () => getProductionBatches({ page: batchPage, limit: batchLimit }),
    { keepPreviousData: true }
  );
  const productsQuery = useQuery('production-product-options', () => searchProducts({ search: '', limit: 100 }));
  const needs = needsQuery.data?.data || [];
  const batches = batchesQuery.data?.data || [];
  const products = productsQuery.data?.data || productsQuery.data || [];
  const selectedIds = useMemo(() => new Set(selectedNeeds.map((need) => need._id)), [selectedNeeds]);
  const selectedProduct = products.find((product) => product._id === manual.product);

  const refresh = () => {
    queryClient.invalidateQueries('production-needs');
    queryClient.invalidateQueries('production-batches');
    queryClient.invalidateQueries('inventory-balances');
  };
  const useAction = (fn, success) =>
    useMutation(fn, {
      onSuccess: () => {
        toast.success(success);
        refresh();
      },
      onError: (error) => toast.error(errorText(error))
    });
  const createMut = useAction(createProductionBatch, 'Production batch created');
  const assignMut = useAction(assignProductionNeedToStock, 'Ready stock assigned to order');
  const startMut = useAction(startProductionBatch, 'Production batch started');
  const updateMut = useAction(updateProductionBatch, 'Production batch updated');

  const addManual = () => {
    if (!manual.product || Number(manual.quantity) < 1) return;
    const product = products.find((entry) => entry._id === manual.product);
    const variation = product?.variations?.find((entry) => entry._id === manual.variation);
    setManualItems((items) => [
      ...items,
      {
        ...manual,
        _key: `${Date.now()}-${items.length}`,
        productName: product?.name,
        variationName: variationLabel(variation)
      }
    ]);
    setManual({ product: '', variation: '', quantity: 1, note: '' });
  };

  const saveBatch = () => {
    const items = [
      ...selectedNeeds.map((need) => ({
        orderItem: need._id,
        note: need.productionNote ?? need.customizeDetails ?? ''
      })),
      ...manualItems.map((item) => ({
        product: item.product,
        variation: item.variation || null,
        quantity: Number(item.quantity),
        note: item.note
      }))
    ];
    createMut.mutate(
      { items, note: batchNote },
      {
        onSuccess: () => {
          setSelectedNeeds([]);
          setManualItems([]);
          setBatchNote('');
          setView('batches');
        }
      }
    );
  };

  return (
    <div className={view === 'batches' ? 'min-h-full' : 'min-h-full bg-[#f4f6f8] p-4 md:p-7'}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Production control</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Build the next production run</h1>
          <p className="mt-1 text-sm text-slate-500">
            Needs are ordered by promised delivery. Add them to a batch or satisfy them from HQ stock.
          </p>
        </div>
        <div className="flex gap-2">
          {view === 'batches' && (
            <Link href="/production/create" className={`${action} bg-slate-950 text-white hover:bg-slate-800`}>
              <FiPlus /> Create production
            </Link>
          )}
          <button className={`${action} border border-slate-200 bg-white text-slate-600`} onClick={refresh}>
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </header>

      {view === 'create' ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="order-2 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm xl:sticky xl:top-4">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
              <div>
                <h2 className="font-bold">Production needed</h2>
                <p className="text-xs text-slate-400">Earliest delivery first</p>
              </div>
              <span className="rounded-md bg-white/10 px-3 py-1 font-mono text-sm font-bold">{needs.length}</span>
            </div>
            <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
              <div className="hidden border-b border-slate-800/20 bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400 md:grid md:grid-cols-[150px_minmax(0,1fr)_90px_150px_96px] md:items-center">
                <span>Order</span>
                <span>Product</span>
                <span>Qty</span>
                <span>Due</span>
                <span></span>
              </div>
              {needs
                .filter((need) => !selectedIds.has(need._id))
                .map((need) => (
                  <NeedCard
                    key={need._id}
                    need={need}
                    selected={selectedIds.has(need._id)}
                    onSelect={(entry) => setSelectedNeeds((items) => [...items, entry])}
                    onAssign={(id) => assignMut.mutate(id)}
                    assigning={assignMut.isLoading}
                  />
                ))}
              {!needs.length && (
                <div className="p-12 text-center">
                  <FiCheck className="mx-auto text-3xl text-emerald-500" />
                  <p className="mt-3 font-bold text-slate-700">No production waiting</p>
                  <p className="mt-1 text-sm text-slate-400">New presale and custom-size items will appear here.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="order-1 rounded-md border border-slate-300 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]">
            <div className="border-b border-dashed border-slate-300 p-5">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
                Production workbench
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Build this batch</h2>
              <p className="mt-1 text-sm text-slate-500">
                The batch number is generated automatically. Notes stay internal to production.
              </p>
              <textarea
                value={batchNote}
                onChange={(event) => setBatchNote(event.target.value)}
                rows={3}
                placeholder="Batch instructions, deadline, fabric allocation…"
                className="mt-4 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              <div className="grid grid-cols-[minmax(0,1fr)_64px_36px] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <span>Selected work</span>
                <span className="text-right">Qty</span>
                <span></span>
              </div>
              {selectedNeeds.map((need) => (
                <div key={need._id} className="border-b border-slate-100 bg-blue-50/70 p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_64px_36px] items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{need.pid?.name}</p>
                      <p className="truncate text-xs text-slate-500">Order #{need.orderNo}</p>
                    </div>
                    <p className="text-right font-mono text-sm font-black text-slate-950">{need.quantity}</p>
                    <button
                      aria-label="Remove selected work"
                      onClick={() => setSelectedNeeds((items) => items.filter((item) => item._id !== need._id))}
                      className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={need.productionNote ?? need.customizeDetails ?? ''}
                    onChange={(event) =>
                      setSelectedNeeds((items) =>
                        items.map((entry) =>
                          entry._id === need._id ? { ...entry, productionNote: event.target.value } : entry
                        )
                      )
                    }
                    placeholder="Production note"
                    className="mt-2 w-full resize-none rounded-md border border-blue-200 bg-white px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              {manualItems.map((item) => (
                <div key={item._key} className="border-b border-slate-100 bg-white p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_64px_36px] items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{item.productName}</p>
                      <p className="truncate text-xs text-slate-500">Manual stock / {item.variationName}</p>
                    </div>
                    <p className="text-right font-mono text-sm font-black text-slate-950">{item.quantity}</p>
                    <button
                      aria-label="Remove manual work"
                      onClick={() => setManualItems((items) => items.filter((entry) => entry._key !== item._key))}
                      className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={item.note || ''}
                    onChange={(event) =>
                      setManualItems((items) =>
                        items.map((entry) => (entry._key === item._key ? { ...entry, note: event.target.value } : entry))
                      )
                    }
                    placeholder="Production note"
                    className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-[var(--brand)]"
                  />
                </div>
              ))}
              {!selectedNeeds.length && !manualItems.length && (
                <div className="p-8 text-center text-sm text-slate-400">No batch lines selected.</div>
              )}
            </div>
            <div className="border-t border-dashed border-slate-300 p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Add manual stock</p>
              <div className="grid gap-2">
                <select
                  className={field}
                  value={manual.product}
                  onChange={(event) => setManual({ ...manual, product: event.target.value, variation: '' })}
                >
                  <option value="">Choose product</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} · #{product.code}
                    </option>
                  ))}
                </select>
                {selectedProduct?.variations?.length > 0 && (
                  <select
                    className={field}
                    value={manual.variation}
                    onChange={(event) => setManual({ ...manual, variation: event.target.value })}
                  >
                    <option value="">Choose variation</option>
                    {selectedProduct.variations.map((variation) => (
                      <option key={variation._id} value={variation._id}>
                        {variationLabel(variation)}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <input
                    className={field}
                    type="number"
                    min="1"
                    value={manual.quantity}
                    onChange={(event) => setManual({ ...manual, quantity: Number(event.target.value) })}
                  />
                  <button
                    type="button"
                    onClick={addManual}
                    className={`${action} h-10 shrink-0 border border-slate-300 bg-white text-slate-700`}
                  >
                    <FiPlus /> Add
                  </button>
                </div>
                <textarea
                  value={manual.note}
                  onChange={(event) => setManual({ ...manual, note: event.target.value })}
                  rows={2}
                  placeholder="Production note for this line"
                  className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                />
              </div>
            </div>
            <div className="border-t border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">Production lines</span>
                <b className="font-mono">{selectedNeeds.length + manualItems.length}</b>
              </div>
              <button
                onClick={saveBatch}
                disabled={createMut.isLoading || (!selectedNeeds.length && !manualItems.length)}
                className={`${action} h-11 w-full bg-[var(--brand)] text-white hover:brightness-95`}
              >
                Save production batch <FiArrowRight />
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <div>
          <BatchListTable
            batches={batches}
            onView={setViewingBatch}
            onEdit={setEditingBatch}
            onStart={(id) => startMut.mutate(id)}
          />
          <Pagination
            page={batchPage}
            totalPages={batchesQuery.data?.count || 1}
            onPage={setBatchPage}
            total={batchesQuery.data?.total || 0}
            unit="batches"
            pageSize={batchLimit}
          />
        </div>
      )}
      {editingBatch && (
        <BatchEditModal
          batch={editingBatch}
          products={products}
          saving={updateMut.isLoading}
          onClose={() => setEditingBatch(null)}
          onSave={(payload) => updateMut.mutate(payload, { onSuccess: () => setEditingBatch(null) })}
        />
      )}
      {viewingBatch && (
        <BatchViewModal
          batch={viewingBatch}
          onClose={() => setViewingBatch(null)}
          onEdit={(batch) => {
            setViewingBatch(null);
            setEditingBatch(batch);
          }}
        />
      )}
    </div>
  );
}
