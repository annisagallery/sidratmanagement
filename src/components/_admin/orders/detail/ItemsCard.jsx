'use client';

/**
 * What the customer bought, and where each physical piece currently is.
 *
 * One order line is one physical piece, so each row reads as an object in the
 * world: what it is, which piece it is (barcode), what state that piece is in,
 * and what it cost. Supply state is joined from the bound production unit by
 * `<SupplyBadge>` rather than trusted from the order row.
 *
 * Item state is reported here, never edited. A piece moves when something
 * physical happens to it — received into stock, scanned on the production line,
 * scanned into a pack, shipped — and each of those paths does its own inventory
 * bookkeeping.
 */

import Image from 'next/image';
import { FiAlertTriangle, FiEdit2, FiPackage } from 'react-icons/fi';

import SupplyBadge from 'src/components/_admin/orders/SupplyBadge';
import { Code } from 'src/components/_admin/ops/primitives';
import { Card, Pill, money, oid } from './parts';

const itemName = (item) => item.pid?.name || item.productSnapshot?.name || 'Unknown product';

function PackingCount({ packing }) {
  const total = packing?.total || 0;
  if (!total) return null;
  const verified = packing.verified || 0;
  return (
    <span className={`text-[13px] tabular-nums ${verified >= total ? 'text-emerald-700' : 'text-slate-500'}`}>
      {verified} of {total} scanned
    </span>
  );
}

export default function ItemsCard({ order, packing, onEdit, onComplain, canComplain = false }) {
  const items = order.items || [];

  return (
    <Card
      title="Items"
      icon={FiPackage}
      badge={<span className="text-[13px] tabular-nums text-slate-500">{items.length}</span>}
      actions={
        <>
          <PackingCount packing={packing} />
          {onEdit ? (
            <button type="button" onClick={onEdit} className="btn-ghost btn-sm">
              <FiEdit2 size={14} aria-hidden /> Edit
            </button>
          ) : null}
        </>
      }
    >
      {items.length ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {items.map((item, index) => {
            const barcode = item.packingBarcode || item.assignedUnit?.barcode;
            const quantity = Number(item.quantity) || 1;
            const lineTotal = (Number(item.price) || 0) * quantity;

            return (
              <li key={oid(item) || index} className="flex gap-4 px-5 py-4">
                <div className="relative h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="absolute inset-0 overflow-hidden rounded-lg">
                  {item.pid?.featuredImage?.path ? (
                    <Image src={item.pid.featuredImage.path} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-slate-400">
                      <FiPackage size={18} aria-hidden />
                    </span>
                  )}
                  </span>
                  {quantity > 1 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-semibold text-white ring-2 ring-white">
                      <span className="sr-only">Quantity </span>
                      {quantity}
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0 text-sm font-semibold leading-snug text-slate-900">{itemName(item)}</p>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-900">{money(lineTotal)}</p>
                      {quantity > 1 || (item.salePrice && item.regularPrice) ? (
                        <p className="text-xs tabular-nums text-slate-500">
                          {item.salePrice && item.regularPrice ? (
                            <span className="mr-1 line-through">{money(item.regularPrice)}</span>
                          ) : null}
                          {quantity > 1 ? `${money(item.price)} × ${quantity}` : null}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {(item.attributes || []).length || item.isCustom || item.returnedQty > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {(item.attributes || []).map((attribute, position) => (
                        <span
                          key={`${attribute.attributeName}-${position}`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {attribute.colorHex ? (
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-slate-300"
                              style={{ backgroundColor: attribute.colorHex }}
                            />
                          ) : null}
                          {attribute.valueName}
                        </span>
                      ))}
                      {item.isCustom ? <Pill tone="brand">Custom</Pill> : null}
                      {item.returnedQty > 0 ? <Pill tone="bad">{item.returnedQty} returned</Pill> : null}
                    </div>
                  ) : null}

                  {item.customizeDetails || item.customizePrice > 0 ? (
                    <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-900">
                      {item.customizeDetails}
                      {item.customizePrice > 0 ? (
                        <span className={`font-semibold ${item.customizeDetails ? 'ml-1' : ''}`}>
                          (incl. {money(item.customizePrice)} customisation)
                        </span>
                      ) : null}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SupplyBadge item={item} />
                    {barcode ? <Code className="text-slate-500">{barcode}</Code> : null}
                    {canComplain ? (
                      <button
                        type="button"
                        onClick={() => onComplain(item)}
                        title="Open a complaint for this item"
                        className="btn-ghost btn-sm ml-auto !text-rose-700 hover:!bg-rose-50"
                      >
                        <FiAlertTriangle size={14} aria-hidden /> Report issue
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">This order has no items.</p>
      )}
    </Card>
  );
}
