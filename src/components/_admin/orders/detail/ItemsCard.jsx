'use client';

/**
 * What the customer bought, and where each physical piece currently is.
 *
 * One order line is one physical piece, so the row reads as an object in the
 * world: what it is, which piece it is (barcode), what state that piece is in,
 * and what it cost. Supply state is joined from the bound production unit by
 * `<SupplyBadge>` rather than trusted from the order row.
 */

import Image from 'next/image';
import { FiAlertTriangle, FiArrowRight, FiPackage } from 'react-icons/fi';

import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import SupplyBadge from 'src/components/_admin/orders/SupplyBadge';
import { Code } from 'src/components/_admin/ops/primitives';
import { Pill, Section, money, oid } from './parts';

const itemName = (item) => item.pid?.name || item.productSnapshot?.name || 'Unknown product';

export default function ItemsCard({
  order,
  itemStatuses = [],
  onAdvanceItem,
  advancing = false,
  onComplain,
  canComplain = false,
  packedOrder = false
}) {
  const items = order.items || [];
  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

  /**
   * The next step an operator may push a line to by hand. Terminal and
   * supply-owned states are not hand-editable — those move when a piece is
   * received, scanned or shipped.
   */
  function nextStatus(current) {
    if (['pending', 'production-needed', 'reserved', 'ready', 'packed', 'delivered', 'returned', 'cancelled'].includes(current)) {
      return null;
    }
    const workflow = itemStatuses.filter(
      (entry) =>
        entry.isActive !== false &&
        !['reserved', 'packed', 'delivered', 'returned', 'return', 'cancelled'].includes(entry.value)
    );
    return workflow[workflow.findIndex((entry) => entry.value === current) + 1] || null;
  }

  return (
    <Section
      title="Items"
      icon={FiPackage}
      hint={`${items.length} piece${items.length === 1 ? '' : 's'}`}
      actions={<span className="text-[13px] font-bold tabular-nums text-slate-700">{money(itemsTotal)}</span>}
    >
      <GlobalTable>
        <thead>
          <tr>
            <th className="w-10 text-center">#</th>
            <th>Product</th>
            <th>Piece &amp; state</th>
            <th className="text-right">Price</th>
            {canComplain ? <th className="w-24 text-right">Issue</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const next = nextStatus(item.status);
            const barcode = item.packingBarcode || item.assignedUnit?.barcode;
            const quantity = Number(item.quantity) || 1;

            return (
              <tr key={oid(item) || index} className="align-top">
                <td className="text-center text-xs font-semibold text-slate-400">{index + 1}</td>

                <td>
                  <div className="flex items-start gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      {item.pid?.featuredImage?.path ? (
                        <Image src={item.pid.featuredImage.path} alt="" fill className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-slate-300">
                          <FiPackage size={16} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-tight text-slate-800">
                        {itemName(item)}
                        {quantity > 1 ? <span className="ml-1 text-slate-500">× {quantity}</span> : null}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {(item.attributes || []).map((attribute, position) => (
                          <span
                            key={`${attribute.attributeName}-${position}`}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
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
                      {item.customizeDetails ? (
                        <p className="mt-1 text-[11px] leading-snug text-amber-700">{item.customizeDetails}</p>
                      ) : null}
                    </div>
                  </div>
                </td>

                <td>
                  <div className="flex flex-col items-start gap-1">
                    <SupplyBadge item={item} />
                    {barcode ? <Code className="text-slate-500">{barcode}</Code> : null}
                    {next && !packedOrder ? (
                      <button
                        type="button"
                        disabled={advancing}
                        onClick={() => onAdvanceItem(oid(item), next.value)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-strong)] transition hover:underline disabled:opacity-40"
                      >
                        Move to {next.label} <FiArrowRight size={11} />
                      </button>
                    ) : null}
                  </div>
                </td>

                <td className="text-right">
                  {item.salePrice ? (
                    <>
                      <span className="block text-[11px] text-slate-400 line-through">{money(item.regularPrice)}</span>
                      <span className="text-[13px] font-bold tabular-nums text-slate-800">{money(item.price)}</span>
                    </>
                  ) : (
                    <span className="text-[13px] font-bold tabular-nums text-slate-800">{money(item.price)}</span>
                  )}
                  {item.customizePrice > 0 ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-amber-600">
                      incl. {money(item.customizePrice)} customisation
                    </span>
                  ) : null}
                </td>

                {canComplain ? (
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => onComplain(item)}
                      title="Open a complaint for this item"
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-100"
                    >
                      <FiAlertTriangle size={12} /> Complain
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}

          {!items.length ? (
            <tr>
              <td colSpan={canComplain ? 5 : 4} className="py-8 text-center text-sm text-slate-400">
                This order has no items.
              </td>
            </tr>
          ) : null}
        </tbody>
      </GlobalTable>
    </Section>
  );
}
