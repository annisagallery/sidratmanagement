'use client';

/**
 * Returning part of an order, with the goods in hand.
 *
 * Delivered order: the customer sent some pieces back. Shipped order: a
 * partial delivery — the courier handed over some pieces and brought the rest
 * back; the order becomes delivered for what was kept. Choosing every piece is
 * a whole-order return. Each returned piece is restocked or written off here.
 */

import { useState } from 'react';
import { useMutation } from 'react-query';

import * as api from 'src/services';
import { Field, ModalShell, errorAlert, fieldClass, money, oid, toast } from './parts';

const INACTIVE = ['cancelled', 'canceled', 'returned', 'return'];

function itemName(item) {
  const attrs = (item.attributes || [])
    .map((attr) => attr.valueName)
    .filter(Boolean)
    .join(' / ');
  const name = item.productSnapshot?.name || item.pid?.name || 'Product';
  return attrs ? `${name} — ${attrs}` : name;
}

export default function ReturnItemsModal({ order, orderNo, onClose, onDone }) {
  const items = (order.items || []).filter((item) => !INACTIVE.includes(item.status));
  const partialDelivery = order.status === 'shipped';
  // itemId -> restock (true) / write off (false); absent = not returned
  const [chosen, setChosen] = useState({});
  const [reason, setReason] = useState('');

  const count = Object.keys(chosen).length;
  const everything = count > 0 && count === items.length;

  const { mutate, isLoading } = useMutation(
    () =>
      api.returnOrderItems({
        orderNo,
        reason: reason.trim(),
        items: Object.entries(chosen).map(([itemId, restock]) => ({ itemId, restock }))
      }),
    {
      onSuccess: (response) => {
        toast(response?.message || 'Items returned');
        onDone?.();
      },
      onError: (error) => errorAlert('Could not return these items', error)
    }
  );

  function toggle(item) {
    const id = oid(item);
    setChosen((current) => {
      const next = { ...current };
      if (id in next) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  return (
    <ModalShell
      size="lg"
      subtitle={`Order #${orderNo}`}
      title={partialDelivery ? 'Partial delivery' : 'Return items'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost h-9">
            Cancel
          </button>
          <button type="button" onClick={() => mutate()} disabled={!count || isLoading} className="btn-brand h-9">
            {isLoading
              ? 'Saving…'
              : everything
                ? 'Return the whole order'
                : partialDelivery
                  ? `Mark ${count} returned, rest delivered`
                  : `Return ${count} item${count === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <ul className="space-y-2">
        {items.map((item) => {
          const id = oid(item);
          const on = id in chosen;
          return (
            <li key={id} className={`rounded-md border p-3 ${on ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900/40' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                  <input type="checkbox" checked={on} onChange={() => toggle(item)} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-800">{itemName(item)}</span>
                    <span className="text-xs text-slate-500">{money(item.price)}</span>
                  </span>
                </label>
                {on ? (
                  <div className="flex shrink-0 overflow-hidden rounded-md border border-slate-200 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setChosen((current) => ({ ...current, [id]: true }))}
                      aria-pressed={chosen[id]}
                      className={`px-3 py-1.5 ${chosen[id] ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'}`}
                    >
                      Restock
                    </button>
                    <button
                      type="button"
                      onClick={() => setChosen((current) => ({ ...current, [id]: false }))}
                      aria-pressed={!chosen[id]}
                      className={`px-3 py-1.5 ${!chosen[id] ? 'bg-rose-600 text-white' : 'bg-white text-slate-600'}`}
                    >
                      Write off
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Field label="Reason" className="mt-4">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={partialDelivery ? 'e.g. customer refused one piece' : 'e.g. wrong size'}
          className={fieldClass}
        />
      </Field>
    </ModalShell>
  );
}
