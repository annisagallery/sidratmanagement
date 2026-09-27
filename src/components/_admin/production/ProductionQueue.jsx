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
import { MdAdd, MdCheck, MdCheckCircleOutline } from 'react-icons/md';

import { assignProductionNeedToStock, getProductionNeeds } from 'src/services';
import { alertError, confirmAction, toastSuccess } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Segmented from 'src/components/_admin/ui/Segmented';
import Callout from 'src/components/_admin/ui/Callout';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { Pill, oid, qty } from 'src/components/_admin/ui/primitives';
import { catalogCode, needName, variationLabel } from 'src/components/_admin/inventory/shared';

/** How late, in the words someone would use out loud. */
function dueMeta(value) {
  if (!value) return { label: 'No date', tone: 'neutral', overdue: false };
  const due = new Date(value);
  const days = differenceInCalendarDays(due, startOfDay(new Date()));
  if (isBefore(due, startOfDay(new Date()))) {
    return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} late`, tone: 'bad', overdue: true };
  }
  if (days === 0) return { label: 'Due today', tone: 'warn', overdue: false };
  if (days <= 3) return { label: `In ${days} day${days === 1 ? '' : 's'}`, tone: 'warn', overdue: false };
  return { label: `In ${days} days`, tone: 'neutral', overdue: false };
}

/** Free ready stock that could fill this row now. */
const stockFor = (need) => Number(need.availableStock ?? need.availableCustomStock ?? 0);

export default function ProductionQueue() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [only, setOnly] = useState('all');

  const needsQuery = useQuery('production-needs', () => getProductionNeeds({ status: 'production-needed', limit: 500 }));
  const needs = useMemo(() => needsQuery.data?.data || [], [needsQuery.data]);
  const totalWaiting = needsQuery.data?.total ?? needs.length;

  const assign = useMutation(assignProductionNeedToStock, {
    onSuccess: () => {
      toastSuccess('Filled from stock', 'Nothing needs making for that item.');
      queryClient.invalidateQueries('production-needs');
      queryClient.invalidateQueries('inventory-product-stock');
    },
    onError: (error) => alertError(error, { title: 'That piece could not be taken from stock' })
  });

  const totals = useMemo(
    () =>
      needs.reduce(
        (acc, need) => ({
          overdue: acc.overdue + (dueMeta(need.deliveryDate).overdue ? 1 : 0),
          custom: acc.custom + (need.isCustom ? 1 : 0),
          rescuable: acc.rescuable + (stockFor(need) > 0 ? 1 : 0),
          planned: acc.planned + (need.productionBatch ? 1 : 0)
        }),
        { overdue: 0, custom: 0, rescuable: 0, planned: 0 }
      ),
    [needs]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return needs.filter((need) => {
      if (only === 'overdue' && !dueMeta(need.deliveryDate).overdue) return false;
      if (only === 'custom' && !need.isCustom) return false;
      if (only === 'rescuable' && !(stockFor(need) > 0)) return false;
      if (only === 'unplanned' && need.productionBatch) return false;
      if (!term) return true;
      return (
        needName(need).toLowerCase().includes(term) ||
        String(catalogCode(need.product, need.variation) || '').toLowerCase().includes(term) ||
        String(need.orderNo || '').toLowerCase().includes(term)
      );
    });
  }, [needs, search, only]);

  const filters = [
    { id: 'all', label: `All ${qty(totalWaiting)}` },
    { id: 'unplanned', label: `Not in a batch ${qty(needs.length - totals.planned)}` },
    { id: 'overdue', label: `Overdue ${qty(totals.overdue)}` },
    { id: 'custom', label: `Custom ${qty(totals.custom)}` },
    { id: 'rescuable', label: `In stock ${qty(totals.rescuable)}` }
  ];

  // A custom piece in stock was cut to someone else's measurements. It can
  // still be the right piece (a cancelled order of the same size), but only a
  // person comparing the two can say so.
  const fillFromStock = async (need) => {
    if (need.isCustom) {
      const confirmed = await confirmAction({
        tone: 'warning',
        title: 'Use a custom piece from stock?',
        text: "That piece was made to another customer's measurements. Only use it if they match these:",
        subject: need.customizeDetails || 'No measurements were recorded',
        confirmText: 'They match — use it',
        cancelText: 'Don’t use it'
      });
      if (!confirmed) return;
    }
    assign.mutate(oid(need));
  };

  const columns = [
    {
      key: 'orderNo',
      label: 'Order',
      render: (need) => (
        <Link href={`/orders/${need.orderNo}`} onClick={stopRow} className="ops-code text-[13px] font-semibold text-slate-900 hover:underline">
          #{need.orderNo}
        </Link>
      )
    },
    {
      key: 'product',
      label: 'Product',
      render: (need) => {
        const code = catalogCode(need.product, need.variation);
        return (
          <div className="min-w-[180px]">
            <p className="text-[13px] font-semibold text-slate-900">{needName(need)}</p>
            <p className="text-xs text-slate-500">
              {code ? <span className="ops-code mr-1.5">{code}</span> : null}
              {variationLabel(need.variation)}
            </p>
            {(need.isCustom || need.productionBatch) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {need.isCustom ? <Pill tone="info">Custom</Pill> : null}
                {need.productionBatch ? (
                  <Link href={`/production/batches/${need.productionBatch.batchNo}`} onClick={stopRow} className="hover:underline">
                    <Pill tone="neutral">In {need.productionBatch.batchNo}</Pill>
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'deliveryDate',
      label: 'Promised',
      render: (need) => {
        const due = dueMeta(need.deliveryDate);
        return (
          <div className="whitespace-nowrap">
            <Pill tone={due.tone}>{due.label}</Pill>
            <p className="mt-1 text-xs text-slate-500">{need.deliveryDate ? format(new Date(need.deliveryDate), 'dd MMM yyyy') : '—'}</p>
          </div>
        );
      }
    },
    {
      key: 'note',
      label: 'Measurements',
      hideBelow: 'lg',
      render: (need) =>
        need.customizeDetails ? (
          <p className="max-w-[280px] whitespace-pre-line rounded-md bg-amber-50 px-2 py-1 text-xs leading-snug text-amber-900">
            {need.customizeDetails}
          </p>
        ) : (
          <span className="text-slate-400">—</span>
        )
    },
    {
      key: 'shortcut',
      label: 'From stock',
      align: 'right',
      render: (need) => {
        const available = stockFor(need);
        return available > 0 ? (
          <button
            type="button"
            onClick={() => fillFromStock(need)}
            disabled={assign.isLoading}
            title="A matching piece is already in stock — use it instead of making another"
            className="btn-ghost btn-sm whitespace-nowrap"
          >
            <MdCheck size={16} className="text-emerald-600" aria-hidden /> Use 1 of {available}
          </button>
        ) : (
          <span className="whitespace-nowrap text-xs text-slate-500">None — make it</span>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Queue" subtitle="Everything awaiting production, earliest promised delivery first.">
        <Link href="/production/create" className="btn-brand">
          <MdAdd size={18} aria-hidden /> Plan a batch
        </Link>
      </PageHeader>

      {totals.overdue > 0 && only !== 'overdue' && (
        <Callout tone="warning" title={`${qty(totals.overdue)} piece${totals.overdue === 1 ? ' is' : 's are'} past the promised date`}>
          <button type="button" onClick={() => setOnly('overdue')} className="mt-1 font-medium underline underline-offset-2">
            Show only overdue pieces
          </button>
        </Callout>
      )}

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search product, code or order…"
        onRefresh={() => needsQuery.refetch()}
        refreshing={needsQuery.isFetching}
        onReset={
          search || only !== 'all'
            ? () => {
                setSearch('');
                setOnly('all');
              }
            : undefined
        }
      >
        <Segmented label="Show" options={filters} value={only} onChange={setOnly} className="max-w-full overflow-x-auto" />
      </ListToolbar>

      <DataTable
        caption="Pieces awaiting production"
        columns={columns}
        data={visible}
        rowKey={(need) => oid(need)}
        selectable={false}
        isLoading={needsQuery.isLoading}
        isFetching={needsQuery.isFetching}
        error={needsQuery.isError ? needsQuery.error : null}
        onRetry={needsQuery.refetch}
        empty={
          needs.length ? (
            <EmptyState title="Nothing matches" hint="Try another filter or clear the search." />
          ) : (
            <EmptyState icon={MdCheckCircleOutline} title="Nothing to make" hint="Customer orders that need production land here automatically." />
          )
        }
        footer={
          visible.length ? (
            <p className="border-t border-slate-100 px-4 py-3 text-[13px] text-slate-500">
              {qty(visible.length)} of {qty(totalWaiting)} shown
              {totals.planned ? ` · ${qty(totals.planned)} already in a draft batch` : ''}
            </p>
          ) : null
        }
      />
    </div>
  );
}
