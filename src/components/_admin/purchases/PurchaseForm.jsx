'use client';

/**
 * Raise or edit a purchase — the old POS's purchase docket.
 *
 * Top to bottom, one column: where and when, then the search box, then the
 * lines, then the money. A buyer works this screen with the seller's challan in
 * their hand, copying one document into another; anything that makes them move
 * sideways to find the next field makes the copy wrong.
 *
 * Receiving is not here. This screen records what was ordered and what it cost;
 * putting the stock on a shelf is a separate act, done from the purchase's own
 * page when the goods actually turn up — often on a different day, sometimes by
 * a different person, and usually not all at once.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FiAlertTriangle, FiSave } from 'react-icons/fi';

import { adminGetBranches, createPurchase, searchProducts, updatePurchase } from 'src/services';
import {
  CellInput,
  DocketCount,
  DocketEmpty,
  DocketField,
  DocketFoot,
  DocketHeader,
  DocketRow,
  DocketSearch,
  DocketTable,
  DocketTotalRow,
  useDocketTotals
} from 'src/components/_admin/ui/docket';
import {
  Notice,
  PageBar,
  Section,
  errorAlert,
  fieldClass,
  money,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { variationLabel } from 'src/components/_admin/inventory/shared';

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const lineSubTotal = (line) => num(line.quantity) * num(line.unitCost) - num(line.discount) + num(line.tax);

const todayValue = (date) => {
  const d = date ? new Date(date) : new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

const HEAD = [
  { label: 'Product' },
  { label: 'Unit cost', className: 'text-right' },
  { label: 'Quantity', className: 'text-right' },
  { label: 'Discount', className: 'text-right' },
  { label: 'Tax', className: 'text-right' },
  { label: 'Sale price', className: 'text-right' },
  { label: 'Subtotal', className: 'text-right' }
];

export default function PurchaseForm({ purchase = null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = Boolean(purchase);

  const [head, setHead] = useState({
    date: todayValue(purchase?.date),
    refNo: purchase?.refNo || '',
    branch: oid(purchase?.branch) || '',
    status: purchase?.status === 'ORDERED' ? 'ORDERED' : 'PENDING'
  });
  const [adjust, setAdjust] = useState({
    orderDiscount: num(purchase?.orderDiscount),
    orderTax: num(purchase?.orderTax),
    shipping: num(purchase?.shipping)
  });
  const [note, setNote] = useState(purchase?.note || '');
  const [lines, setLines] = useState(() =>
    (purchase?.items || []).map((item, index) => ({
      key: `${item.id}-${index}`,
      product: oid(item.product),
      variation: oid(item.variation) || '',
      productName: item.product?.name || 'Unknown product',
      productCode: item.product?.code,
      variationName: item.variation ? variationLabel(item.variation) : 'Base product',
      quantity: item.quantity,
      unitCost: num(item.unitCost),
      discount: num(item.discount),
      tax: num(item.tax),
      salePrice: item.salePrice === null || item.salePrice === undefined ? '' : num(item.salePrice)
    }))
  );

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer.current);
  }, [search]);

  const branchesQuery = useQuery('inventory-branches', adminGetBranches);
  const productsQuery = useQuery(
    ['purchase-products', debounced],
    () => searchProducts({ search: debounced, limit: 25 }),
    { keepPreviousData: true }
  );

  // The storefront branch holds no stock of its own, so it is never where a
  // delivery lands.
  const branches = (branchesQuery.data?.data || []).filter((branch) => branch.type !== 'ECOM');
  const products = useMemo(() => productsQuery.data?.data || [], [productsQuery.data]);

  // A purchase can order anything in the catalogue, so the picker is the
  // catalogue — unlike a transfer, which can only move what is standing
  // somewhere. Variations are offered as separate rows because that is what
  // arrives in a carton and what stock is counted in.
  const options = useMemo(() => {
    const taken = new Set(lines.map((line) => `${line.product}:${line.variation}`));
    const rows = [];
    products.forEach((product) => {
      const variations = product.variations || [];
      if (variations.length) {
        variations.forEach((variation) => {
          const key = `${oid(product)}:${oid(variation)}`;
          rows.push({
            key,
            disabled: taken.has(key),
            title: product.name,
            subtitle: variationLabel(variation),
            meta: product.code ? `#${product.code}` : '',
            product: oid(product),
            variation: oid(variation),
            productName: product.name,
            productCode: product.code,
            variationName: variationLabel(variation)
          });
        });
        return;
      }
      const key = `${oid(product)}:`;
      rows.push({
        key,
        disabled: taken.has(key),
        title: product.name,
        subtitle: 'Base product',
        meta: product.code ? `#${product.code}` : '',
        product: oid(product),
        variation: '',
        productName: product.name,
        productCode: product.code,
        variationName: 'Base product'
      });
    });
    return rows;
  }, [products, lines]);

  const addLine = (option) =>
    setLines((current) => [
      ...current,
      {
        key: `${option.key}-${Date.now()}`,
        product: option.product,
        variation: option.variation,
        productName: option.productName,
        productCode: option.productCode,
        variationName: option.variationName,
        quantity: 1,
        unitCost: 0,
        discount: 0,
        tax: 0,
        salePrice: ''
      }
    ]);

  const setLine = (key, patch) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const priced = lines.map((line) => ({ ...line, subTotal: lineSubTotal(line) }));
  const totals = useDocketTotals(priced, adjust);

  const problems = useMemo(() => {
    const list = [];
    if (!head.branch) list.push('Choose the warehouse the goods land at.');
    if (!lines.length) list.push('Add at least one product.');
    lines.forEach((line) => {
      if (num(line.quantity) < 1) list.push(`${line.productName}: quantity must be at least 1.`);
      if (num(line.unitCost) < 0) list.push(`${line.productName}: unit cost cannot be negative.`);
    });
    if (totals.grandTotal < 0) list.push('The grand total cannot be negative.');
    return list;
  }, [head, lines, totals.grandTotal]);

  const save = useMutation(
    () => {
      const payload = {
        ...head,
        note,
        ...adjust,
        items: lines.map((line) => ({
          product: line.product,
          variation: line.variation || null,
          quantity: num(line.quantity),
          unitCost: num(line.unitCost),
          discount: num(line.discount),
          tax: num(line.tax),
          salePrice: line.salePrice === '' ? null : num(line.salePrice)
        }))
      };
      return isEdit ? updatePurchase({ id: oid(purchase), ...payload }) : createPurchase(payload);
    },
    {
      onSuccess: (response) => {
        toast(`${response?.data?.purchaseNo || 'Purchase'} saved`);
        queryClient.invalidateQueries('purchases');
        router.push(`/purchases/${oid(response?.data)}`);
      },
      onError: (error) => errorAlert('The purchase could not be saved', error)
    }
  );

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Purchases"
        title={isEdit ? `Edit ${purchase.purchaseNo}` : 'Add purchase'}
        subtitle="Stock bought in finished. Receiving it happens later, from the purchase's own page."
        back={() => router.push('/purchases')}
      />

      <Section title={isEdit ? purchase.purchaseNo : 'New purchase'}>
        <DocketHeader columns={4}>
          <DocketField label="Date" required>
            <input
              type="date"
              value={head.date}
              onChange={(event) => setHead((current) => ({ ...current, date: event.target.value }))}
              className={fieldClass}
            />
          </DocketField>

          <DocketField label="Reference no" hint="The seller's own invoice or challan number — how you look this up later.">
            <input
              value={head.refNo}
              onChange={(event) => setHead((current) => ({ ...current, refNo: event.target.value }))}
              placeholder="e.g. INV-4471"
              className={fieldClass}
            />
          </DocketField>

          <DocketField label="Warehouse" required>
            <select
              value={head.branch}
              onChange={(event) => setHead((current) => ({ ...current, branch: event.target.value }))}
              className={fieldClass}
            >
              <option value="">Choose where it lands…</option>
              {branches.map((branch) => (
                <option key={oid(branch)} value={oid(branch)}>
                  {branch.name}
                </option>
              ))}
            </select>
          </DocketField>

          <DocketField label="Status" hint="Received is set by receiving, not chosen here.">
            <select
              value={head.status}
              onChange={(event) => setHead((current) => ({ ...current, status: event.target.value }))}
              className={fieldClass}
            >
              <option value="PENDING">Pending</option>
              <option value="ORDERED">Ordered</option>
            </select>
          </DocketField>
        </DocketHeader>

        <DocketSearch
          value={search}
          onChange={setSearch}
          options={options}
          onPick={addLine}
          loading={productsQuery.isFetching && debounced !== ''}
          emptyHint={debounced ? 'No product matches that.' : 'Start typing a product name or code.'}
        />

        <DocketTable head={HEAD}>
          {priced.length ? (
            priced.map((line, index) => (
              <DocketRow
                key={line.key}
                index={index}
                onRemove={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
              >
                <td className="px-3 py-2.5">
                  <p className="font-medium text-slate-800">
                    {line.productName}
                    {line.productCode ? <span className="ops-code ml-2 text-[11px] text-slate-400">#{line.productCode}</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-400">{line.variationName}</p>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <CellInput
                    value={line.unitCost}
                    step="0.01"
                    onChange={(value) => setLine(line.key, { unitCost: value })}
                    invalid={num(line.unitCost) < 0}
                  />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <CellInput
                    value={line.quantity}
                    min={1}
                    width="w-20"
                    onChange={(value) => setLine(line.key, { quantity: value })}
                    invalid={num(line.quantity) < 1}
                  />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <CellInput value={line.discount} step="0.01" width="w-20" onChange={(value) => setLine(line.key, { discount: value })} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <CellInput value={line.tax} step="0.01" width="w-20" onChange={(value) => setLine(line.key, { tax: value })} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  {/* What it goes on the shelf at. Left blank the lot is
                      received unpriced, exactly as a production receipt is,
                      and priced later rather than guessed at now. */}
                  <CellInput
                    value={line.salePrice}
                    step="0.01"
                    onChange={(value) => setLine(line.key, { salePrice: value })}
                  />
                </td>
                <td className="px-3 py-2.5 text-right text-[13px] font-bold tabular-nums text-slate-800">
                  {money(line.subTotal)}
                </td>
              </DocketRow>
            ))
          ) : (
            <DocketEmpty colSpan={HEAD.length + 2}>
              Nothing on this purchase yet — search above to add the first product.
            </DocketEmpty>
          )}
        </DocketTable>

        <DocketCount lines={priced.length} units={totals.units}>
          <span>Subtotal {money(totals.subTotal)}</span>
        </DocketCount>

        <DocketFoot
          adjustments={
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <DocketField label="Order discount">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjust.orderDiscount}
                    onChange={(event) => setAdjust((current) => ({ ...current, orderDiscount: event.target.value }))}
                    className={`${fieldClass} text-right tabular-nums`}
                  />
                </DocketField>
                <DocketField label="Order tax">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjust.orderTax}
                    onChange={(event) => setAdjust((current) => ({ ...current, orderTax: event.target.value }))}
                    className={`${fieldClass} text-right tabular-nums`}
                  />
                </DocketField>
                <DocketField label="Shipping">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjust.shipping}
                    onChange={(event) => setAdjust((current) => ({ ...current, shipping: event.target.value }))}
                    className={`${fieldClass} text-right tabular-nums`}
                  />
                </DocketField>
              </div>
              <DocketField label="Note">
                <textarea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Anything about this order worth remembering."
                  className={fieldClass}
                />
              </DocketField>

              {problems.length ? (
                <Notice tone="warn" icon={FiAlertTriangle} title="Before this can be saved">
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {problems.slice(0, 5).map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </Notice>
              ) : null}
            </>
          }
          totals={
            <>
              <DocketTotalRow label={`Items (${qty(totals.units)})`} value={totals.subTotal} />
              <DocketTotalRow label="Order discount" value={-num(adjust.orderDiscount)} />
              <DocketTotalRow label="Order tax" value={num(adjust.orderTax)} />
              <DocketTotalRow label="Shipping" value={num(adjust.shipping)} />
              <DocketTotalRow label="Grand total" value={totals.grandTotal} strong />
            </>
          }
        >
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isLoading || problems.length > 0}
            className="btn-brand mt-3 h-11 w-full"
          >
            <FiSave size={15} /> {save.isLoading ? 'Saving…' : isEdit ? 'Save purchase' : 'Create purchase'}
          </button>
        </DocketFoot>
      </Section>
    </div>
  );
}
