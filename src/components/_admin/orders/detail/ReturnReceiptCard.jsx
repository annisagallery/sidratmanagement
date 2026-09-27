'use client';

/**
 * Receiving a returned parcel.
 *
 * Marking an order returned settles the money side; this card is the physical
 * side. Whoever opens the parcel decides, piece by piece, whether it goes back
 * on the shelf or is written off. Nothing is restocked until that decision is
 * made here, so damaged pieces never slip back into sellable stock.
 */

import { useState } from 'react';
import { useMutation } from 'react-query';
import { FiCornerDownLeft } from 'react-icons/fi';

import * as api from 'src/services';
import { Card, Pill, errorAlert, oid, toast } from './parts';

const RETURNED = ['returned', 'return'];

/** Items that came back and have not been received yet. */
export function pendingReturnItems(order) {
  return (order?.items || []).filter(
    (item) => RETURNED.includes(item.status) && Number(item.returnedQty || 0) < Number(item.quantity || 1)
  );
}

function itemName(item) {
  const attrs = (item.attributes || [])
    .map((attr) => attr.valueName)
    .filter(Boolean)
    .join(' / ');
  const name = item.productSnapshot?.name || item.pid?.name || 'Product';
  return attrs ? `${name} — ${attrs}` : name;
}

export default function ReturnReceiptCard({ order, orderNo, onReceived }) {
  const items = pendingReturnItems(order);
  // Restock by default: most returns are refused deliveries in perfect condition.
  const [decisions, setDecisions] = useState(() => Object.fromEntries(items.map((item) => [oid(item), true])));

  const { mutate, isLoading } = useMutation(
    () =>
      api.receiveOrderReturn({
        orderNo,
        items: items.map((item) => ({ itemId: oid(item), restock: decisions[oid(item)] !== false }))
      }),
    {
      onSuccess: (response) => {
        toast(response?.message || 'Return received');
        onReceived?.();
      },
      onError: (error) => errorAlert('Could not receive the return', error)
    }
  );

  if (!items.length) return null;

  const restockCount = items.filter((item) => decisions[oid(item)] !== false).length;

  return (
    <Card
      title="Receive return"
      icon={FiCornerDownLeft}
      badge={<Pill tone="bad">{items.length} to inspect</Pill>}
      className="!border-rose-200"
    >
      <div className="space-y-3 border-t border-slate-100 px-5 py-4">
        <ul className="space-y-2">
          {items.map((item) => {
            const id = oid(item);
            const restock = decisions[id] !== false;
            return (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-800">{itemName(item)}</p>
                  {item.isCustom ? <p className="text-xs text-amber-700">Custom piece</p> : null}
                </div>
                <div className="flex shrink-0 overflow-hidden rounded-md border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setDecisions((current) => ({ ...current, [id]: true }))}
                    aria-pressed={restock}
                    className={`px-3 py-1.5 ${restock ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'}`}
                  >
                    Restock
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisions((current) => ({ ...current, [id]: false }))}
                    aria-pressed={!restock}
                    className={`px-3 py-1.5 ${!restock ? 'bg-rose-600 text-white' : 'bg-white text-slate-600'}`}
                  >
                    Write off
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => mutate()} disabled={isLoading} className="btn-brand btn-sm w-full">
          {isLoading
            ? 'Receiving…'
            : `Receive return — ${restockCount} to stock, ${items.length - restockCount} written off`}
        </button>
      </div>
    </Card>
  );
}
