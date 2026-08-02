'use client';

/**
 * The production queue — everything a customer is waiting for.
 *
 * Ordered by promised delivery, because that is the order the work must happen
 * in and the order the binding rule will use when finished pieces arrive. The
 * queue and the binding must agree, or the queue is lying about what happens
 * next.
 *
 * The one action here is the cheap one: if a matching piece is already sitting
 * in stock — a return, a cancelled order — use it instead of making another.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { differenceInCalendarDays, format, isBefore, startOfDay } from 'date-fns';
import { FiAlertTriangle, FiCheck, FiClock, FiPlus, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { LuFactory } from 'react-icons/lu';

import { assignProductionNeedToStock, getProductionNeeds } from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import {
  EmptyRow,
  PageBar,
  Pill,
  Section,
  StatTile,
  Toolbar,
  errorAlert,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { variationLabel } from 'src/components/_admin/inventory/shared';

/** How late, in the words someone would use out loud. */
function dueMeta(value) {
  if (!value) return { label: 'No date', tone: 'neutral', overdue: false };
  const due = new Date(value);
  const days = differenceInCalendarDays(due, startOfDay(new Date()));
  if (isBefore(due, startOfDay(new Date()))) {
    return { label: `${Math.abs(days)}d late`, tone: 'bad', overdue: true };
  }
  if (days === 0) return { label: 'Due today', tone: 'warn', overdue: false };
  if (days <= 3) return { label: `In ${days}d`, tone: 'warn', overdue: false };
  return { label: `In ${days}d`, tone: 'neutral', overdue: false };
}

export default function ProductionQueue() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [only, setOnly] = useState('all');

  const needsQuery = useQuery('production-needs', () => getProductionNeeds({ status: 'production-needed' }));
  const needs = useMemo(() => needsQuery.data?.data || [], [needsQuery.data]);

  const assign = useMutation(assignProductionNeedToStock, {
    onSuccess: () => {
      toast('Satisfied from ready stock — nothing to make');
      queryClient.invalidateQueries('production-needs');
      queryClient.invalidateQueries('inventory-product-stock');
    },
    onError: (error) => errorAlert('That piece could not be taken from stock', error)
  });

  const totals = useMemo(
    () =>
      needs.reduce(
        (acc, need) => ({
          overdue: acc.overdue + (dueMeta(need.deliveryDate).overdue ? 1 : 0),
          custom: acc.custom + (need.isCustom ? 1 : 0),
          rescuable: acc.rescuable + (need.isCustom && need.availableCustomStock > 0 ? 1 : 0),
          undated: acc.undated + (need.deliveryDate ? 0 : 1)
        }),
        { overdue: 0, custom: 0, rescuable: 0, undated: 0 }
      ),
    [needs]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return needs.filter((need) => {
      if (only === 'overdue' && !dueMeta(need.deliveryDate).overdue) return false;
      if (only === 'custom' && !need.isCustom) return false;
      if (only === 'rescuable' && !(need.isCustom && need.availableCustomStock > 0)) return false;
      if (!term) return true;
      return (
        need.pid?.name?.toLowerCase().includes(term) || String(need.orderNo || '').toLowerCase().includes(term)
      );
    });
  }, [needs, search, only]);

  const toggle = (key) => setOnly((current) => (current === key ? 'all' : key));

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Production"
        title="Queue"
        subtitle="Everything awaiting production, earliest promised delivery first."
      >
        <button type="button" onClick={() => needsQuery.refetch()} className="btn-ghost">
          <FiRefreshCw size={14} className={needsQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
        <Link href="/production/create" className="btn-brand">
          <FiPlus size={15} /> Plan a batch
        </Link>
      </PageBar>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Waiting" value={qty(needs.length)} note="Pieces to make" />
        <StatTile
          label="Overdue"
          value={qty(totals.overdue)}
          note="Past their promised date"
          tone={totals.overdue ? 'bad' : 'muted'}
          onClick={() => toggle('overdue')}
          active={only === 'overdue'}
        />
        <StatTile
          label="Custom pieces"
          value={qty(totals.custom)}
          note="Made to a customer's spec"
          tone={totals.custom ? 'info' : 'muted'}
          onClick={() => toggle('custom')}
          active={only === 'custom'}
        />
        <StatTile
          label="Already in stock"
          value={qty(totals.rescuable)}
          note="Can be filled without making anything"
          tone={totals.rescuable ? 'good' : 'muted'}
          onClick={() => toggle('rescuable')}
          active={only === 'rescuable'}
        />
      </div>

      <Section
        title="Awaiting production"
        icon={LuFactory}
        hint={`${visible.length} shown`}
        actions={
          <Toolbar>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or order…"
                className="input-ui w-52 pl-8"
                aria-label="Search the queue"
              />
            </div>
            <select value={only} onChange={(event) => setOnly(event.target.value)} className="select-ui" aria-label="Filter the queue">
              <option value="all">Everything</option>
              <option value="overdue">Overdue only</option>
              <option value="custom">Custom only</option>
              <option value="rescuable">Fillable from stock</option>
            </select>
          </Toolbar>
        }
      >
        <GlobalTable>
          <thead>
            <tr>
              <th>Order</th>
              <th>Product</th>
              <th>Promised</th>
              <th>Note</th>
              <th className="text-right">Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {needsQuery.isLoading ? (
              <EmptyRow colSpan={5} title="Loading the queue…" />
            ) : visible.length ? (
              visible.map((need) => {
                const due = dueMeta(need.deliveryDate);
                const rescue = need.isCustom && need.availableCustomStock > 0;
                const id = oid(need);
                return (
                  <tr key={id} className="align-top">
                    <td>
                      <Link
                        href={`/orders/${need.orderNo}`}
                        className="ops-code text-[12px] font-bold text-[var(--brand-strong)] hover:underline"
                      >
                        #{need.orderNo}
                      </Link>
                    </td>
                    <td>
                      <p className="text-[13px] font-semibold text-slate-800">{need.pid?.name}</p>
                      <p className="text-[11px] text-slate-500">{variationLabel(need.variationId)}</p>
                      {need.isCustom ? (
                        <Pill tone="info" className="mt-1">
                          Custom
                        </Pill>
                      ) : null}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        {due.overdue ? (
                          <FiAlertTriangle size={12} className="text-rose-600" />
                        ) : (
                          <FiClock size={12} className="text-slate-300" />
                        )}
                        <Pill tone={due.tone}>{due.label}</Pill>
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {need.deliveryDate ? format(new Date(need.deliveryDate), 'dd MMM yyyy') : '—'}
                      </p>
                    </td>
                    <td className="max-w-[260px]">
                      {need.customizeDetails ? (
                        <p className="rounded border-l-2 border-amber-300 bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-900">
                          {need.customizeDetails}
                        </p>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => assign.mutate(id)}
                        disabled={assign.isLoading || (need.isCustom && !need.availableCustomStock)}
                        title={
                          rescue
                            ? 'A matching piece is already in stock — use it instead of making another'
                            : 'Satisfy this line from ready stock'
                        }
                        className={`btn-ghost h-8 !text-xs ${
                          rescue ? '!border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100' : ''
                        }`}
                      >
                        <FiCheck size={12} />
                        {rescue ? `Use 1 of ${need.availableCustomStock} in stock` : 'Use ready stock'}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow
                colSpan={5}
                icon={FiCheck}
                title="Nothing to make"
                hint="Customer orders needing production land here automatically."
              />
            )}
          </tbody>
        </GlobalTable>
      </Section>
    </div>
  );
}
