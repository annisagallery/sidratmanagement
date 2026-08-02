'use client';

/**
 * One product's stock, branch by branch and piece by piece.
 *
 * The list view can only say how many. This says *where* and *which*: which
 * branch holds them, which of them are already promised, and — for anything
 * made in-house — the individual barcoded piece and the order it is bound to.
 * That last table is what someone reads when a piece cannot be found.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import { FiExternalLink, FiHome, FiPackage } from 'react-icons/fi';

import { getProductStockDetail } from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { Code, StateChip, readState } from 'src/components/_admin/ops/primitives';
import {
  CopyButton,
  EmptyRow,
  PageBar,
  Pill,
  Section,
  StatTile,
  money,
  oid,
  qty
} from 'src/components/_admin/ui/primitives';
import { availableOf, variationLabel } from './shared';

const UNIT_TONE = { IN_PRODUCTION: 'making', AVAILABLE: 'ready', RESERVED: 'gone' };

export default function ProductStockDetail({ productId }) {
  const router = useRouter();
  const { data, isLoading } = useQuery(['product-stock', productId], () => getProductStockDetail(productId), {
    enabled: Boolean(productId)
  });

  const product = data?.data?.product;
  const balances = useMemo(() => data?.data?.balances || [], [data]);
  const units = useMemo(() => data?.data?.units || [], [data]);

  const totals = useMemo(
    () =>
      balances.reduce(
        (acc, balance) => ({
          onHand: acc.onHand + Number(balance.onHand || 0),
          reserved: acc.reserved + Number(balance.reserved || 0),
          available: acc.available + availableOf(balance.onHand, balance.reserved)
        }),
        { onHand: 0, reserved: 0, available: 0 }
      ),
    [balances]
  );

  const inProduction = units.filter((unit) => unit.status === 'IN_PRODUCTION').length;

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-slate-100" />;
  }

  if (!product) {
    return (
      <div className="card-ui p-16 text-center">
        <p className="text-sm font-semibold text-rose-600">This product was not found.</p>
        <button type="button" onClick={() => router.push('/inventory')} className="btn-ghost mt-4">
          Back to stock
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Stock"
        title={product.name}
        subtitle={`Product #${product.code}`}
        back={() => router.push('/inventory')}
      >
        {product.slug ? (
          <Link href={`/products/${product.slug}/view`} className="btn-ghost">
            <FiExternalLink size={14} /> Product page
          </Link>
        ) : null}
      </PageBar>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Available" value={qty(totals.available)} note="Free to sell" tone="good" />
        <StatTile label="On hand" value={qty(totals.onHand)} note={`Across ${balances.length} location(s)`} />
        <StatTile label="Reserved" value={qty(totals.reserved)} note="Promised to orders" tone="warn" />
        <StatTile
          label="Being made"
          value={qty(inProduction)}
          note="Pieces still on the floor"
          tone={inProduction ? 'info' : 'muted'}
        />
      </div>

      <Section title="Where it is" icon={FiHome} hint={`${balances.length} balance rows`}>
        <GlobalTable>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Variation</th>
              <th className="text-right">On hand</th>
              <th className="text-right">Reserved</th>
              <th className="text-right">Available</th>
              <th className="text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {balances.length ? (
              balances.map((balance) => (
                <tr key={oid(balance)}>
                  <td>
                    <span className="font-semibold text-slate-800">{balance.branch?.name || 'Unknown'}</span>
                    {balance.branch?.isProductionDestination ? (
                      <Pill tone="brand" className="ml-2">
                        HQ
                      </Pill>
                    ) : null}
                  </td>
                  <td className="text-slate-600">{variationLabel(balance.variation)}</td>
                  <td className="text-right tabular-nums text-slate-700">{qty(balance.onHand)}</td>
                  <td className="text-right tabular-nums text-amber-700">{qty(balance.reserved)}</td>
                  <td className="text-right text-[13px] font-bold tabular-nums text-emerald-700">
                    {qty(availableOf(balance.onHand, balance.reserved))}
                  </td>
                  <td className="text-right tabular-nums text-slate-600">
                    {money(
                      balance.variation?.salePrice ??
                        balance.variation?.regularPrice ??
                        product.priceSale ??
                        product.price
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={6} title="No stock anywhere" hint="Nothing has been received for this product yet." />
            )}
          </tbody>
        </GlobalTable>
      </Section>

      <Section
        title="Individual pieces"
        icon={FiPackage}
        hint={units.length ? `${units.length} barcoded units` : 'Made in-house only'}
      >
        <GlobalTable>
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Serial</th>
              <th>Variation</th>
              <th>State</th>
              <th>Bound to</th>
              <th>Made by</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {units.length ? (
              units.map((unit) => (
                <tr key={oid(unit)}>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <Code className="text-slate-700">{unit.barcode}</Code>
                      <CopyButton value={unit.barcode} label="Copy barcode" />
                    </span>
                  </td>
                  <td className="ops-code text-[11px] text-slate-500">{unit.unitSerial}</td>
                  <td className="text-slate-600">{variationLabel(unit.variation)}</td>
                  <td>
                    <StateChip
                      state={UNIT_TONE[unit.status] || readState({ status: unit.status }).key}
                      label={unit.status?.replaceAll('_', ' ').toLowerCase()}
                    />
                  </td>
                  <td>
                    {unit.orderItem?.orderNo ? (
                      <Link href={`/orders/${unit.orderItem.orderNo}`} className="ops-code text-[12px] text-[var(--brand-strong)] hover:underline">
                        #{unit.orderItem.orderNo}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Free stock</span>
                    )}
                  </td>
                  <td className="text-slate-600">{unit.producedBy?.name || '—'}</td>
                  <td className="text-[11px] text-slate-500">
                    {unit.submittedAt ? format(new Date(unit.submittedAt), 'dd MMM yyyy') : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow
                colSpan={7}
                icon={FiPackage}
                title="No barcoded pieces"
                hint="Only products made in-house carry individual unit codes."
              />
            )}
          </tbody>
        </GlobalTable>
      </Section>
    </div>
  );
}
