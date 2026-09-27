'use client';

/**
 * Production scan desk — finished work credited to employees, with auditable
 * corrections for items that were already posted by mistake.
 *
 * Scans accumulate locally and post as one submission. That is deliberate: a
 * factory network drops, and a desk that needs the server for every scan stops
 * the line. Nothing leaves this screen until "Post" is pressed, and until then
 * every line can be removed.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FiAlertTriangle, FiCheck, FiCheckCircle, FiDollarSign, FiInbox, FiPlus, FiRotateCcw, FiSearch, FiTrash2, FiUser, FiX } from 'react-icons/fi';
import { MdQrCodeScanner } from 'react-icons/md';

import { searchProductionProducers, submitProductionSubmission } from 'src/services';
import ScanStation from 'src/components/_admin/scan/ScanStation';
import { Code } from 'src/components/_admin/ops/primitives';
import { Notice, Pill, errorAlert, money, qty, toast } from 'src/components/_admin/ui/primitives';

const MODES = [
  {
    key: 'UNIT_RECEIPT',
    label: 'Receive',
    help: 'Finished pieces into stock',
    icon: FiInbox,
    scanLabel: 'Scan a finished piece'
  },
  {
    key: 'UNIT_REVERSAL',
    label: 'Remove',
    help: 'Send a posted piece back',
    icon: FiRotateCcw,
    scanLabel: 'Scan a posted piece to remove'
  },
  {
    key: 'EXTRA_PAY',
    label: 'Extra work',
    help: 'Pay without a barcode',
    icon: FiDollarSign,
    scanLabel: null
  }
];

const MODE_LABEL = { UNIT_RECEIPT: 'Received', UNIT_REVERSAL: 'Removed', EXTRA_PAY: 'Extra work' };
const MODE_TONE = { UNIT_RECEIPT: 'good', UNIT_REVERSAL: 'bad', EXTRA_PAY: 'warn' };
const MODE_ICON_TONE = { UNIT_RECEIPT: 'text-emerald-600', UNIT_REVERSAL: 'text-rose-600', EXTRA_PAY: 'text-amber-600' };

/** Who made these pieces: one search, one list, one choice. */
function OperatorPicker({ producer, onPick }) {
  const [search, setSearch] = useState('');
  const { data, isLoading, isFetching, isError, refetch } = useQuery(
    ['production-producers', search],
    () => searchProductionProducers(search),
    { keepPreviousData: true, enabled: !producer }
  );
  const producers = data?.data || [];

  if (producer) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          <FiCheck size={19} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">Every scan is credited to</p>
          <p className="truncate text-base font-semibold text-slate-900">
            {producer.name} <span className="ops-code text-sm font-normal text-slate-500">{producer.employeeCode}</span>
          </p>
        </div>
        <button type="button" onClick={() => onPick(null)} className="btn-ghost">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <FiUser size={18} aria-hidden />
        </span>
        <div>
          <p className="text-base font-semibold text-slate-900">Who made these pieces?</p>
          <p className="text-[13px] text-slate-500">Choose the employee before scanning — every scan must belong to someone.</p>
        </div>
      </div>
      <div className="relative">
        <FiSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or employee code"
          aria-label="Search employees"
          className="input-ui h-11 pl-10 !text-base sm:!text-sm"
          autoFocus
        />
      </div>
      {isError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800" role="alert">
          Employees could not be loaded.
          <button type="button" onClick={() => refetch()} className="btn-ghost btn-sm">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      ) : producers.length ? (
        <ul className={`grid gap-2 sm:grid-cols-2 xl:grid-cols-3 ${isFetching ? 'opacity-60' : ''}`} aria-label="Employees">
          {producers.slice(0, 9).map((entry) => (
            <li key={entry.userId}>
              <button
                type="button"
                onClick={() => onPick(entry)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-slate-900 hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700" aria-hidden>
                  {String(entry.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{entry.name}</span>
                  <span className="ops-code block text-xs text-slate-500">{entry.employeeCode}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-4 text-center text-[13px] text-slate-500">
          {search ? `No employee matches “${search}”.` : 'No employees found.'}
        </p>
      )}
    </div>
  );
}

export default function ProductionScanPage() {
  const queryClient = useQueryClient();

  const [producer, setProducer] = useState(null);
  const [mode, setMode] = useState('UNIT_RECEIPT');
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('');
  const [extra, setExtra] = useState({ amount: '', note: '' });
  const [extraErrors, setExtraErrors] = useState({});
  const [qcConfirmed, setQcConfirmed] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const producerId = producer ? String(producer.userId) : '';
  const activeMode = MODES.find((entry) => entry.key === mode) || MODES[0];

  const summary = useMemo(
    () =>
      lines.reduce(
        (acc, line) => ({
          receipts: acc.receipts + (line.kind === 'UNIT_RECEIPT' ? 1 : 0),
          removed: acc.removed + (line.kind === 'UNIT_REVERSAL' ? 1 : 0),
          extra: acc.extra + (line.kind === 'EXTRA_PAY' ? Number(line.amount || 0) : 0)
        }),
        { receipts: 0, removed: 0, extra: 0 }
      ),
    [lines]
  );

  const post = useMutation(submitProductionSubmission, {
    onSuccess: (response) => {
      setOutcome({
        submissionNo: response?.data?.submission?.submissionNo,
        bindings: response?.data?.bindings || [],
        requeued: response?.data?.requeued || []
      });
      setLines([]);
      setNote('');
      setQcConfirmed(false);
      toast(`Posted as ${response?.data?.submission?.submissionNo || 'submission'}`);
      queryClient.invalidateQueries('production-batches');
      queryClient.invalidateQueries('production-needs');
      queryClient.invalidateQueries('inventory-product-stock');
    },
    onError: (error) => errorAlert('The submission was not posted', error, 'Nothing was recorded — the lines are still here.')
  });

  const handleScan = async (barcode) => {
    if (barcode === '0000') {
      setMode('EXTRA_PAY');
      return { ok: true, message: 'Switched to extra work — enter the amount and what it was for.' };
    }
    if (lines.some((line) => line.barcode === barcode)) {
      return { ok: false, message: `${barcode} is already in this submission.` };
    }
    const kind = mode === 'UNIT_REVERSAL' ? 'UNIT_REVERSAL' : 'UNIT_RECEIPT';
    setLines((current) => [{ kind, barcode }, ...current]);
    if (kind === 'UNIT_RECEIPT') setQcConfirmed(false);
    return { ok: true, message: kind === 'UNIT_RECEIPT' ? `${barcode} received.` : `${barcode} queued for removal.` };
  };

  const addExtra = (event) => {
    event?.preventDefault();
    const amount = Number(extra.amount);
    const reason = extra.note.trim();
    const errors = {};
    if (!(amount > 0)) errors.amount = 'Enter an amount above zero.';
    if (!reason) errors.note = 'Say what the work was.';
    setExtraErrors(errors);
    if (Object.keys(errors).length) return;
    setLines((current) => [{ kind: 'EXTRA_PAY', barcode: '0000', amount, note: reason }, ...current]);
    setExtra({ amount: '', note: '' });
    setMode('UNIT_RECEIPT');
  };

  const blocked = !producerId
    ? 'Choose who made these pieces.'
    : !lines.length
      ? 'Scan at least one piece.'
      : summary.receipts > 0 && !qcConfirmed
        ? 'Confirm quality control before posting.'
        : null;

  const reset = () => {
    setLines([]);
    setNote('');
    setExtra({ amount: '', note: '' });
    setExtraErrors({});
    setQcConfirmed(false);
    setMode('UNIT_RECEIPT');
    setOutcome(null);
  };

  return (
    <div className="flex min-h-full w-full flex-col gap-3 lg:h-full lg:min-h-0">
      {outcome ? (
        <Notice tone="good" icon={FiCheck} title={`Posted as ${outcome.submissionNo || 'submission'}`}>
          <div className="mt-1 space-y-1">
            {outcome.bindings.length ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">Sent to customers:</span>
                {outcome.bindings.map((bound) => (
                  <Link key={bound.orderItemId} href={`/orders/${bound.orderNo}`} className="hover:underline">
                    <Code className="text-emerald-800">#{bound.orderNo}</Code>
                  </Link>
                ))}
              </p>
            ) : null}
            {outcome.requeued.length ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">Back in the queue:</span>
                {outcome.requeued.map((row) => (
                  <Link key={row.orderItemId} href={`/orders/${row.orderNo}`} className="hover:underline">
                    <Code className="text-emerald-800">#{row.orderNo}</Code>
                  </Link>
                ))}
              </p>
            ) : null}
            {!outcome.bindings.length && !outcome.requeued.length ? <p>Everything went to free stock.</p> : null}
          </div>
        </Notice>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]">
        {/* ── Who and what ──────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
          <section className="card-ui p-4 sm:p-5" aria-label="Employee">
            <OperatorPicker
              producer={producer}
              onPick={(next) => {
                setProducer(next);
                setOutcome(null);
              }}
            />
          </section>

          <section className="card-ui flex-1 space-y-5 p-4 sm:p-5" aria-label="Scanning">
            <div role="radiogroup" aria-label="What are you scanning?" className="grid grid-cols-3 gap-2">
              {MODES.map((entry) => {
                const active = mode === entry.key;
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(entry.key)}
                    className={`min-h-[72px] rounded-lg border px-3 py-3 text-left transition ${
                      active ? 'border-slate-900 bg-white ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={18} className={`shrink-0 ${active ? MODE_ICON_TONE[entry.key] : 'text-slate-400'}`} aria-hidden />
                      <span className="text-sm font-semibold text-slate-900">{entry.label}</span>
                    </span>
                    <span className="mt-1 hidden text-xs text-slate-500 sm:block">{entry.help}</span>
                  </button>
                );
              })}
            </div>

            {mode === 'UNIT_REVERSAL' ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-900" role="note">
                <FiAlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                For pieces already posted: removes the employee&apos;s credit, releases the stock, and returns the piece to production as not ready.
              </div>
            ) : null}

            {mode === 'EXTRA_PAY' ? (
              <form onSubmit={addExtra} noValidate className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-800">Amount (৳)</span>
                    <input
                      value={extra.amount}
                      onChange={(event) => {
                        setExtra({ ...extra, amount: event.target.value });
                        setExtraErrors((e) => ({ ...e, amount: undefined }));
                      }}
                      inputMode="decimal"
                      placeholder="0"
                      aria-invalid={Boolean(extraErrors.amount)}
                      className="input-ui ops-code h-12 text-base"
                      autoFocus
                    />
                    {extraErrors.amount && <span className="mt-1.5 block text-[13px] font-medium text-rose-700">{extraErrors.amount}</span>}
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-800">What was the work?</span>
                    <input
                      value={extra.note}
                      onChange={(event) => {
                        setExtra({ ...extra, note: event.target.value });
                        setExtraErrors((e) => ({ ...e, note: undefined }));
                      }}
                      placeholder="Repair, alteration, overtime…"
                      aria-invalid={Boolean(extraErrors.note)}
                      className="input-ui h-12"
                    />
                    {extraErrors.note && <span className="mt-1.5 block text-[13px] font-medium text-rose-700">{extraErrors.note}</span>}
                  </label>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMode('UNIT_RECEIPT')} className="btn-ghost h-12">
                    Cancel
                  </button>
                  <button type="submit" disabled={!producerId} className="btn-brand h-12 flex-1">
                    <FiPlus size={16} aria-hidden /> Add extra work
                  </button>
                </div>
                {!producerId && <p className="text-[13px] font-medium text-amber-800">Choose the employee first.</p>}
              </form>
            ) : (
              <ScanStation
                onScan={handleScan}
                label={activeMode.scanLabel}
                placeholder="Scan a piece's barcode, then press Enter"
                hint="Scan 0000 to switch to extra work."
                disabled={!producerId}
                disabledReason="Choose the employee first — every scan must belong to someone."
                historyLimit={5}
                appearance="desk"
              />
            )}
          </section>
        </div>

        {/* ── The submission ────────────────────────────────────────────── */}
        <aside className="card-ui flex min-h-[520px] flex-col overflow-hidden lg:min-h-0" aria-labelledby="submission-title">
          <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="submission-title" className="text-[15px] font-semibold text-slate-900">
                Submission
                <span className="ml-2 font-normal tabular-nums text-slate-500">
                  {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                </span>
              </h2>
              {lines.length || outcome ? (
                <button type="button" onClick={reset} className="btn-ghost btn-sm">
                  Start over
                </button>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
              <div className="bg-white px-3 py-2.5">
                <dt className="text-xs text-slate-500">Received</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900">{qty(summary.receipts)}</dd>
              </div>
              <div className="bg-white px-3 py-2.5">
                <dt className="text-xs text-slate-500">Removed</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900">{qty(summary.removed)}</dd>
              </div>
              <div className="bg-white px-3 py-2.5">
                <dt className="text-xs text-slate-500">Extra pay</dt>
                <dd className="truncate text-lg font-semibold tabular-nums text-slate-900">{money(summary.extra)}</dd>
              </div>
            </dl>
          </header>

          <div className="min-h-[200px] flex-1 overflow-y-auto">
            {lines.length ? (
              <ul className="divide-y divide-slate-100">
                {lines.map((line, index) => {
                  const what = line.kind === 'EXTRA_PAY' ? line.note : line.barcode;
                  return (
                    <li key={`${line.barcode}-${index}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 sm:px-5">
                      <Pill tone={MODE_TONE[line.kind]} className="shrink-0">
                        {MODE_LABEL[line.kind]}
                      </Pill>
                      <span className="min-w-0 flex-1">
                        {line.kind === 'EXTRA_PAY' ? (
                          <span className="block truncate text-[13px] font-medium text-slate-900">{line.note}</span>
                        ) : (
                          <Code className="block text-slate-900">{line.barcode}</Code>
                        )}
                      </span>
                      {line.kind === 'EXTRA_PAY' ? <span className="text-[13px] font-semibold tabular-nums text-slate-900">{money(line.amount)}</span> : null}
                      <button
                        type="button"
                        aria-label={`Remove ${what} from this submission`}
                        title="Remove line"
                        onClick={() => setLines((current) => current.filter((_, position) => position !== index))}
                        className="btn-icon btn-icon-sm btn-icon-danger shrink-0"
                      >
                        <FiTrash2 size={15} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-8 py-10 text-center">
                <MdQrCodeScanner size={30} className="mb-2 text-slate-300" aria-hidden />
                <p className="text-sm font-medium text-slate-900">Nothing scanned yet</p>
                <p className="mt-1 text-[13px] text-slate-500">Scans collect here and are only saved when you post them.</p>
              </div>
            )}
          </div>

          <footer className="space-y-3 border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
            {summary.receipts > 0 ? (
              <label
                className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                  qcConfirmed ? 'border-emerald-300 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={qcConfirmed}
                  onChange={(event) => setQcConfirmed(event.target.checked)}
                  className="h-5 w-5 shrink-0 rounded border-slate-300 accent-emerald-600"
                />
                <span className={`text-[13px] font-semibold ${qcConfirmed ? 'text-emerald-900' : 'text-amber-900'}`}>
                  Quality checked — {summary.receipts} piece{summary.receipts === 1 ? '' : 's'} passed
                </span>
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-800">
                Note <span className="font-normal text-slate-500">Optional</span>
              </span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Anything for the production record"
                className="input-ui h-11 !text-base sm:!text-sm"
              />
            </label>

            <p aria-live="polite" className={`flex items-center gap-2 text-[13px] font-medium ${blocked ? 'text-slate-600' : 'text-emerald-700'}`}>
              {blocked ? <FiX size={14} className="shrink-0" aria-hidden /> : <FiCheckCircle size={15} className="shrink-0" aria-hidden />}
              {blocked || 'Ready to post.'}
            </p>

            <button
              type="button"
              onClick={() =>
                post.mutate({
                  producedBy: producerId,
                  note,
                  qcConfirmed: summary.receipts > 0 ? qcConfirmed : false,
                  lines
                })
              }
              disabled={Boolean(blocked) || post.isLoading}
              className="btn-brand h-12 w-full"
            >
              <FiCheck size={17} aria-hidden />{' '}
              {post.isLoading ? 'Posting…' : `Post ${lines.length || ''} ${lines.length === 1 ? 'line' : 'lines'}`.replace(/\s+/g, ' ').trim()}
            </button>
          </footer>
        </aside>
      </div>
    </div>
  );
}
