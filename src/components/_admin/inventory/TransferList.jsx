'use client';

/**
 * Transfers — stock moving between branches.
 *
 * A transfer is a chain of four acts by four different people, and the only
 * question this screen has to answer is *whose turn is it*. So each row offers
 * exactly one button — the act its status allows — and the tiles count how many
 * are waiting at each step.
 *
 * The full line list lives in a drawer rather than a page: it is read to check
 * a van against a docket, and losing the register while doing that is worse
 * than a slightly smaller surface.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import { FiArrowRight, FiCheck, FiPlus, FiRefreshCw, FiSearch, FiTruck } from 'react-icons/fi';

import {
  approveStockTransfer,
  dispatchStockTransfer,
  getStockTransfers,
  receiveStockTransfer
} from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import {
  Drawer,
  EmptyRow,
  PageBar,
  Row,
  Section,
  StatTile,
  Toolbar,
  errorAlert,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { TRANSFER_STATUS, TransferStatusPill, variationLabel } from './shared';

const ACTIONS = {
  approve: { run: approveStockTransfer, done: 'Transfer approved' },
  dispatch: { run: dispatchStockTransfer, done: 'Transfer dispatched — stock has left the source branch' },
  receive: { run: receiveStockTransfer, done: 'Transfer received into the destination branch' }
};

const lineTotal = (transfer) => (transfer.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0);

export default function TransferList() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const limit = 20;

  const transfersQuery = useQuery(
    ['inventory-transfers', page, status, search],
    () => getStockTransfers({ page, limit, ...(status ? { status } : {}), ...(search ? { search } : {}) }),
    { keepPreviousData: true }
  );

  const transfers = useMemo(() => transfersQuery.data?.data || [], [transfersQuery.data]);

  const act = useMutation(({ action, id }) => ACTIONS[action].run(id), {
    onSuccess: (_result, variables) => {
      toast(ACTIONS[variables.action].done);
      queryClient.invalidateQueries('inventory-transfers');
      queryClient.invalidateQueries('inventory-product-stock');
      queryClient.invalidateQueries('inventory-balances');
      setOpen(null);
    },
    onError: (error) => errorAlert('That step could not be completed', error)
  });

  // Counted from the page in hand — an honest "on this page" number rather than
  // a total the endpoint does not provide.
  const counts = useMemo(
    () =>
      transfers.reduce(
        (acc, transfer) => ({ ...acc, [transfer.status]: (acc[transfer.status] || 0) + 1 }),
        {}
      ),
    [transfers]
  );

  const filterByStatus = (value) => {
    setStatus((current) => (current === value ? '' : value));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageBar eyebrow="Inventory" title="Transfers" subtitle="Move quantity between branches. Pricing stays global.">
        <button type="button" onClick={() => transfersQuery.refetch()} className="btn-ghost">
          <FiRefreshCw size={14} className={transfersQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
        <Link href="/inventory/transfers/create" className="btn-brand">
          <FiPlus size={15} /> New transfer
        </Link>
      </PageBar>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Waiting approval"
          value={qty(counts.DRAFT || 0)}
          note="Drafted, not yet approved"
          onClick={() => filterByStatus('DRAFT')}
          active={status === 'DRAFT'}
        />
        <StatTile
          label="Ready to dispatch"
          value={qty(counts.APPROVED || 0)}
          note="Approved, still at source"
          tone="info"
          onClick={() => filterByStatus('APPROVED')}
          active={status === 'APPROVED'}
        />
        <StatTile
          label="On the road"
          value={qty(counts.IN_TRANSIT || 0)}
          note="Dispatched, not yet received"
          tone="warn"
          onClick={() => filterByStatus('IN_TRANSIT')}
          active={status === 'IN_TRANSIT'}
        />
        <StatTile
          label="Received"
          value={qty(counts.RECEIVED || 0)}
          note="Landed at destination"
          tone="good"
          onClick={() => filterByStatus('RECEIVED')}
          active={status === 'RECEIVED'}
        />
      </div>

      <Section
        title="Transfer register"
        icon={FiTruck}
        hint={`${transfersQuery.data?.total || 0} total`}
        actions={
          <Toolbar>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search transfer no…"
                className="input-ui w-48 pl-8"
                aria-label="Search transfers"
              />
            </div>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="select-ui"
              aria-label="Filter by status"
            >
              <option value="">Every status</option>
              {Object.entries(TRANSFER_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </Toolbar>
        }
      >
        <GlobalTable>
          <thead>
            <tr>
              <th>Transfer</th>
              <th>Route</th>
              <th className="text-center">Lines</th>
              <th className="text-right">Pieces</th>
              <th>Status</th>
              <th className="text-right">Next step</th>
            </tr>
          </thead>
          <tbody>
            {transfersQuery.isLoading ? (
              <EmptyRow colSpan={6} title="Loading transfers…" />
            ) : transfers.length ? (
              transfers.map((transfer) => {
                const id = oid(transfer);
                const next = TRANSFER_STATUS[transfer.status]?.next;
                const busy = act.isLoading && act.variables?.id === id;
                return (
                  <tr key={id}>
                    <td>
                      <button type="button" onClick={() => setOpen(transfer)} className="text-left">
                        <span className="ops-code text-[13px] font-bold text-[var(--brand-strong)] hover:underline">
                          {transfer.transferNo}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {transfer.createdAt ? format(new Date(transfer.createdAt), 'dd MMM yyyy') : ''}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                        {transfer.sourceBranch?.name}
                        <FiArrowRight size={13} className="text-slate-300" />
                        {transfer.destinationBranch?.name}
                      </span>
                      {transfer.note ? <p className="mt-0.5 text-[11px] text-slate-400">{transfer.note}</p> : null}
                    </td>
                    <td className="text-center tabular-nums text-slate-600">{(transfer.lines || []).length}</td>
                    <td className="text-right text-[13px] font-bold tabular-nums text-slate-900">
                      {qty(lineTotal(transfer))}
                    </td>
                    <td>
                      <TransferStatusPill status={transfer.status} />
                    </td>
                    <td className="text-right">
                      {next ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act.mutate({ action: next.action, id })}
                          className="btn-brand h-8 !text-xs"
                        >
                          <FiCheck size={13} /> {busy ? 'Working…' : next.label}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setOpen(transfer)} className="btn-ghost h-8 !text-xs">
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow
                colSpan={6}
                icon={FiTruck}
                title="No transfers"
                hint="Create one to move stock from HQ to a branch."
              />
            )}
          </tbody>
        </GlobalTable>
      </Section>

      <Pagination
        page={page}
        totalPages={transfersQuery.data?.count || 1}
        onPage={setPage}
        total={transfersQuery.data?.total || 0}
        unit="transfers"
        pageSize={limit}
      />

      {open ? (
        <TransferDrawer
          transfer={open}
          onClose={() => setOpen(null)}
          onAct={(action) => act.mutate({ action, id: oid(open) })}
          busy={act.isLoading}
        />
      ) : null}
    </div>
  );
}

/* ── detail ──────────────────────────────────────────────────────────────── */

function TransferDrawer({ transfer, onClose, onAct, busy }) {
  const next = TRANSFER_STATUS[transfer.status]?.next;
  const timeline = [
    { label: 'Drafted', at: transfer.createdAt, by: transfer.createdBy?.name },
    { label: 'Dispatched', at: transfer.dispatchedAt, by: transfer.dispatchedBy?.name },
    { label: 'Received', at: transfer.receivedAt, by: transfer.receivedBy?.name }
  ].filter((entry) => entry.at);

  return (
    <Drawer
      title={transfer.transferNo}
      subtitle="Stock transfer"
      onClose={onClose}
      footer={
        next ? (
          <button type="button" onClick={() => onAct(next.action)} disabled={busy} className="btn-brand h-10 w-full">
            <FiCheck size={15} /> {busy ? 'Working…' : next.label}
          </button>
        ) : (
          <p className="text-center text-xs font-semibold text-slate-500">
            This transfer is {TRANSFER_STATUS[transfer.status]?.label.toLowerCase() || transfer.status.toLowerCase()} —
            nothing further to do.
          </p>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From</p>
            <p className="truncate text-sm font-bold text-slate-800">{transfer.sourceBranch?.name}</p>
          </div>
          <FiArrowRight className="shrink-0 text-slate-300" />
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To</p>
            <p className="truncate text-sm font-bold text-slate-800">{transfer.destinationBranch?.name}</p>
          </div>
        </div>

        <dl>
          <Row label="Status" value={<TransferStatusPill status={transfer.status} />} />
          <Row label="Total pieces" value={qty(lineTotal(transfer))} />
          <Row label="Note" value={transfer.note} />
        </dl>

        <section className="card-ui overflow-hidden">
          <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Lines
          </h3>
          <ul className="divide-y divide-slate-100">
            {(transfer.lines || []).map((line, index) => (
              <li key={oid(line) || index} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-800">{line.product?.name || 'Unknown product'}</p>
                  <p className="text-[11px] text-slate-400">{variationLabel(line.variation)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-bold tabular-nums text-slate-900">{qty(line.quantity)}</p>
                  {line.receivedQuantity ? (
                    <p className="text-[11px] font-semibold text-emerald-700">{qty(line.receivedQuantity)} received</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {timeline.length ? (
          <section>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">History</h3>
            <ul className="space-y-2">
              {timeline.map((entry) => (
                <li key={entry.label} className="flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="font-semibold text-slate-700">{entry.label}</span>
                  <span className="text-slate-400">
                    {format(new Date(entry.at), 'dd MMM yyyy, hh:mm a')} · {entry.by || 'System'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
