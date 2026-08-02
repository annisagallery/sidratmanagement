'use client';

/**
 * Edit a batch.
 *
 * Once a batch has affected inventory its structure is frozen by the server —
 * quantities and lines are history at that point. Rather than let someone type
 * into fields that will be rejected, the form locks them and says why.
 *
 * Order-backed lines are never editable: their quantity is a customer's order,
 * not a production decision.
 */

import { useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

import { searchProducts, updateProductionBatch } from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import {
  EmptyRow,
  Field,
  ModalShell,
  Notice,
  Pill,
  errorAlert,
  fieldClass,
  oid,
  toast
} from 'src/components/_admin/ui/primitives';
import { variationLabel } from 'src/components/_admin/inventory/shared';

export default function BatchEditModal({ batch, onClose, onSaved }) {
  const frozen = ['COMPLETED', 'CANCELLED', 'IN_PRODUCTION'].includes(batch.status);
  const [note, setNote] = useState(batch.note || '');
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState({ product: '', variation: '', quantity: 1, note: '' });
  const [items, setItems] = useState(() =>
    (batch.items || []).map((item) => ({
      key: oid(item) || `line-${Math.random()}`,
      orderItem: item.orderItem ? oid(item.orderItem) : null,
      product: oid(item.product),
      variation: item.variation ? oid(item.variation) : '',
      quantity: item.quantity,
      note: item.note || '',
      productName: item.product?.name,
      variationName: variationLabel(item.variation),
      orderNo: item.orderItem?.orderNo || null
    }))
  );

  const productsQuery = useQuery(['batch-edit-products', search], () => searchProducts({ search, limit: 25 }), {
    keepPreviousData: true,
    enabled: !frozen
  });
  const products = productsQuery.data?.data || [];
  const chosen = products.find((product) => oid(product) === manual.product);

  const save = useMutation(
    () =>
      updateProductionBatch({
        id: oid(batch),
        note,
        items: items.map((item) => ({
          orderItem: item.orderItem,
          product: item.product,
          variation: item.variation || null,
          quantity: Number(item.quantity),
          note: item.note
        }))
      }),
    {
      onSuccess: () => {
        toast('Batch updated');
        onSaved();
      },
      onError: (error) => errorAlert('The batch could not be updated', error)
    }
  );

  const addManual = () => {
    if (!manual.product || Number(manual.quantity) < 1) return;
    const product = products.find((entry) => oid(entry) === manual.product);
    const variation = (product?.variations || []).find((entry) => oid(entry) === manual.variation);
    setItems((current) => [
      ...current,
      {
        ...manual,
        key: `new-${Date.now()}`,
        orderItem: null,
        productName: product?.name,
        variationName: variation ? variationLabel(variation) : 'Base product'
      }
    ]);
    setManual({ product: '', variation: '', quantity: 1, note: '' });
  };

  const setItem = (key, patch) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  return (
    <ModalShell
      title={`Edit ${batch.batchNo}`}
      subtitle="Production batch"
      size="xl"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={save.isLoading}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isLoading || !items.length}
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
          >
            {save.isLoading ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Batch note" hint="Internal to production — instructions, deadline, fabric allocation.">
          <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        {frozen ? (
          <Notice tone="warn" title="Lines are frozen">
            This batch has already affected inventory, so its products and quantities are history. The note stays
            editable.
          </Notice>
        ) : null}

        <section className="card-ui overflow-hidden">
          <GlobalTable>
            <thead>
              <tr>
                <th>Product</th>
                <th>For</th>
                <th className="w-24 text-center">Qty</th>
                <th>Production note</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item) => {
                  const locked = frozen || Boolean(item.orderItem);
                  return (
                    <tr key={item.key}>
                      <td>
                        <p className="text-[13px] font-semibold text-slate-800">{item.productName}</p>
                        <p className="text-[11px] text-slate-400">{item.variationName}</p>
                      </td>
                      <td>
                        {item.orderNo ? (
                          <Pill tone="info">Order #{item.orderNo}</Pill>
                        ) : (
                          <Pill tone="neutral">Stock</Pill>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          disabled={locked}
                          value={item.quantity}
                          onChange={(event) => setItem(item.key, { quantity: Number(event.target.value) })}
                          className="input-ui text-center tabular-nums disabled:bg-slate-100"
                        />
                      </td>
                      <td>
                        <input
                          disabled={locked}
                          value={item.note}
                          onChange={(event) => setItem(item.key, { note: event.target.value })}
                          className="input-ui disabled:bg-slate-100"
                        />
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          disabled={frozen}
                          onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                          aria-label={`Remove ${item.productName}`}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <EmptyRow colSpan={5} title="No lines left" hint="A batch needs at least one product." />
              )}
            </tbody>
          </GlobalTable>
        </section>

        {!frozen ? (
          <section className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Add a stock line</p>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_90px_auto]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products…"
                className={fieldClass}
                aria-label="Search products"
              />
              <select
                className={fieldClass}
                value={manual.product}
                onChange={(event) => setManual({ ...manual, product: event.target.value, variation: '' })}
              >
                <option value="">Choose product…</option>
                {products.map((product) => (
                  <option key={oid(product)} value={oid(product)}>
                    {product.name} · #{product.code}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                className={fieldClass}
                value={manual.quantity}
                onChange={(event) => setManual({ ...manual, quantity: Number(event.target.value) })}
              />
              <button type="button" onClick={addManual} disabled={!manual.product} className="btn-ghost h-[38px]">
                <FiPlus size={14} /> Add
              </button>
            </div>
            {chosen?.variations?.length ? (
              <select
                className={`${fieldClass} mt-2`}
                value={manual.variation}
                onChange={(event) => setManual({ ...manual, variation: event.target.value })}
              >
                <option value="">Base product</option>
                {chosen.variations.map((variation) => (
                  <option key={oid(variation)} value={oid(variation)}>
                    {variationLabel(variation)}
                  </option>
                ))}
              </select>
            ) : null}
          </section>
        ) : null}
      </div>
    </ModalShell>
  );
}
