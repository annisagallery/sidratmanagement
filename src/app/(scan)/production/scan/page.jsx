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
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiDollarSign,
  FiInbox,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiTrash2,
  FiUser
} from 'react-icons/fi';
import { MdQrCodeScanner } from 'react-icons/md';

import { searchProductionProducers, submitProductionSubmission } from 'src/services';
import ScanStation from 'src/components/_admin/scan/ScanStation';
import { Code } from 'src/components/_admin/ops/primitives';
import { Notice, Pill, errorAlert, money, qty, toast } from 'src/components/_admin/ui/primitives';

const MODES = [
  {
    key: 'UNIT_RECEIPT',
    label: 'Receive',
    shortLabel: 'Into stock',
    icon: FiInbox,
    scanLabel: 'Scan a finished piece'
  },
  {
    key: 'UNIT_REVERSAL',
    label: 'Remove',
    shortLabel: 'Back to production',
    icon: FiRotateCcw,
    scanLabel: 'Scan a posted item to remove'
  },
  {
    key: 'EXTRA_PAY',
    label: 'Extra work',
    shortLabel: 'No barcode',
    icon: FiDollarSign,
    scanLabel: null
  }
];

const MODE_LABEL = { UNIT_RECEIPT: 'Received', UNIT_REVERSAL: 'Removed', EXTRA_PAY: 'Extra work' };
const MODE_TONE = { UNIT_RECEIPT: 'good', UNIT_REVERSAL: 'bad', EXTRA_PAY: 'warn' };

const SIGNAL_CLASS = {
  UNIT_RECEIPT: 'from-emerald-400 via-emerald-500 to-cyan-400',
  UNIT_REVERSAL: 'from-rose-400 via-rose-500 to-orange-400',
  EXTRA_PAY: 'from-amber-300 via-amber-400 to-yellow-300'
};

const ACTIVE_MODE_CLASS = {
  UNIT_RECEIPT: 'border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-950/30',
  UNIT_REVERSAL: 'border-rose-400 bg-rose-500 text-white shadow-lg shadow-rose-950/30',
  EXTRA_PAY: 'border-amber-300 bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/30'
};

export default function ProductionScanPage() {
  const queryClient = useQueryClient();

  const [producerId, setProducerId] = useState('');
  const [producerSearch, setProducerSearch] = useState('');
  const [mode, setMode] = useState('UNIT_RECEIPT');
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('');
  const [extra, setExtra] = useState({ amount: '', note: '' });
  const [qcConfirmed, setQcConfirmed] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const { data: producerData } = useQuery(
    ['production-producers', producerSearch],
    () => searchProductionProducers(producerSearch),
    { keepPreviousData: true }
  );
  const producers = producerData?.data || [];
  const producer = producers.find((entry) => String(entry.userId) === producerId);
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

  const addExtra = () => {
    const amount = Number(extra.amount);
    const reason = extra.note.trim();
    if (!(amount > 0) || !reason) return toast('Extra work needs an amount and a reason');
    setLines((current) => [{ kind: 'EXTRA_PAY', barcode: '0000', amount, note: reason }, ...current]);
    setExtra({ amount: '', note: '' });
    return setMode('UNIT_RECEIPT');
  };

  const blocked = !producerId
    ? 'Choose who made these pieces.'
    : !lines.length
      ? 'Scan at least one piece.'
      : summary.receipts > 0 && !qcConfirmed
        ? 'Confirm QC before posting.'
        : null;

  const reset = () => {
    setLines([]);
    setNote('');
    setExtra({ amount: '', note: '' });
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

      <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid items-center gap-3 border-b border-slate-200 bg-white p-3 md:grid-cols-[180px_minmax(220px,0.8fr)_minmax(260px,1fr)_auto]">
          <div className="flex items-center gap-3 self-center">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                producer ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {producer ? <FiCheck size={19} /> : <FiUser size={18} />}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Operator</p>
              <p className="truncate text-sm font-bold text-slate-900">{producer?.name || 'Not selected'}</p>
            </div>
          </div>

          <label className="block">
            <span className="sr-only">Find employee</span>
            <input
              value={producerSearch}
              onChange={(event) => setProducerSearch(event.target.value)}
              placeholder="Search name or employee code"
              className="input-ui h-11 !text-base sm:!text-sm"
            />
          </label>

          <label className="block">
            <span className="sr-only">Selected employee</span>
            <select
              value={producerId}
              onChange={(event) => setProducerId(event.target.value)}
              className="select-ui h-11 w-full !text-base font-semibold sm:!text-sm"
            >
              <option value="">Choose employee…</option>
              {producers.map((entry) => (
                <option key={entry.userId} value={entry.userId}>
                  {entry.name} — {entry.employeeCode}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={reset} className="btn-ghost h-11 whitespace-nowrap">
            <FiRefreshCw size={15} /> Clear desk
          </button>
        </div>

        <div className="grid min-h-0 flex-1 items-stretch lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="relative overflow-hidden bg-slate-950 p-4 sm:p-5 lg:min-h-0 lg:overflow-y-auto">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${SIGNAL_CLASS[mode]}`} />
            <div className="relative z-10">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Scan mode</p>
              </div>

              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Submission type">
                {MODES.map((entry) => {
                  const active = mode === entry.key;
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setMode(entry.key)}
                      aria-pressed={active}
                      className={`min-h-[72px] rounded-xl border px-2 py-3 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-white/70 sm:px-4 ${
                        active
                          ? ACTIVE_MODE_CLASS[entry.key]
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={18} className="shrink-0" />
                        <span className="text-sm font-extrabold">{entry.label}</span>
                      </span>
                      <span className={`mt-1 block pl-6 text-[11px] font-medium ${active ? 'opacity-80' : 'text-slate-500'}`}>
                        {entry.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {mode === 'EXTRA_PAY' ? (
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-slate-300">Amount</span>
                      <input
                        value={extra.amount}
                        onChange={(event) => setExtra({ ...extra, amount: event.target.value })}
                        inputMode="decimal"
                        placeholder="৳0"
                        className="input-ui ops-code h-12 text-base"
                      />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-slate-300">Reason</span>
                      <input
                        value={extra.note}
                        onChange={(event) => setExtra({ ...extra, note: event.target.value })}
                        placeholder="Repair, alteration, overtime…"
                        className="input-ui h-12"
                      />
                    </label>
                  </div>
                  <button type="button" onClick={addExtra} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    <FiPlus size={16} /> Add extra work
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4 shadow-inner sm:p-5">
                  <ScanStation
                    onScan={handleScan}
                    label={activeMode.scanLabel}
                    placeholder="Scan a unit barcode, then press Enter"
                    disabled={!producerId}
                    disabledReason="Choose the employee first — every scan must belong to someone."
                    historyLimit={4}
                    appearance="desk"
                  />
                </div>
              )}

              {mode === 'UNIT_REVERSAL' ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-100">
                  <FiAlertTriangle size={15} className="mt-px shrink-0" />
                  For already-posted items: removes employee credit, releases stock, and returns the piece to production as not ready.
                </div>
              ) : null}

            </div>
          </div>

          <aside className="flex min-h-[520px] flex-col border-t border-slate-200 bg-white lg:min-h-0 lg:overflow-hidden lg:border-l lg:border-t-0">
            <header className="border-b border-slate-200 px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-900">Submission</h2>
                </div>
                <div className="flex items-center gap-2">
                  {lines.length ? (
                    <button
                      type="button"
                      onClick={() => setLines([])}
                      className="inline-flex h-11 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    >
                      Clear lines
                    </button>
                  ) : null}
                  <Pill tone={lines.length ? 'brand' : 'neutral'} className="!px-2.5 !py-1">
                    {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                  </Pill>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Received</p>
                  <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-700">{qty(summary.receipts)}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Removed</p>
                  <p className="mt-0.5 text-lg font-black tabular-nums text-rose-600">{qty(summary.removed)}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Extra</p>
                  <p className="mt-0.5 truncate text-base font-black tabular-nums text-amber-700">{money(summary.extra)}</p>
                </div>
              </div>
            </header>

            <div className="min-h-[220px] flex-1 overflow-y-auto">
              {lines.length ? (
                <ul className="divide-y divide-slate-100">
                  {lines.map((line, index) => (
                    <li key={`${line.barcode}-${index}`} className="group flex min-h-[58px] items-center gap-3 px-4 py-2.5 sm:px-5">
                      <span className={`h-8 w-1 shrink-0 rounded-full ${line.kind === 'UNIT_RECEIPT' ? 'bg-emerald-400' : line.kind === 'UNIT_REVERSAL' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                      <span className="min-w-0 flex-1">
                        <Pill tone={MODE_TONE[line.kind]} className="mb-1">{MODE_LABEL[line.kind]}</Pill>
                        {line.kind === 'EXTRA_PAY' ? (
                          <span className="block truncate text-[13px] font-medium text-slate-700">{line.note}</span>
                        ) : (
                          <Code className="block text-slate-700">{line.barcode}</Code>
                        )}
                      </span>
                      {line.kind === 'EXTRA_PAY' ? (
                        <span className="ops-code text-[13px] font-bold text-slate-800">{money(line.amount)}</span>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Delete pending line ${line.kind === 'EXTRA_PAY' ? line.note : line.barcode}`}
                        onClick={() => setLines((current) => current.filter((_, position) => position !== index))}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        <FiTrash2 size={14} /> Delete
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex h-full min-h-[250px] flex-col items-center justify-center px-8 py-10 text-center">
                  <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-300">
                    <MdQrCodeScanner size={27} />
                  </span>
                  <p className="text-sm font-bold text-slate-600">No scans yet</p>
                </div>
              )}
            </div>

            <footer className="mt-auto space-y-3 border-t border-slate-200 bg-slate-50/80 p-4 sm:p-5">
              {summary.receipts > 0 ? (
                <label className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${qcConfirmed ? 'border-emerald-300 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <input
                    type="checkbox"
                    checked={qcConfirmed}
                    onChange={(event) => setQcConfirmed(event.target.checked)}
                    className="h-5 w-5 shrink-0 rounded border-slate-300 accent-emerald-600"
                  />
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-bold ${qcConfirmed ? 'text-emerald-800' : 'text-amber-900'}`}>
                      QC passed on {summary.receipts} piece{summary.receipts === 1 ? '' : 's'}
                    </span>
                  </span>
                </label>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Submission note <span className="font-normal text-slate-400">(optional)</span></span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a note for the production record"
                  className="input-ui h-11 !text-base sm:!text-sm"
                />
              </label>

              <div
                aria-live="polite"
                className={`flex items-center gap-2 text-xs font-semibold ${blocked ? 'text-slate-500' : 'text-emerald-700'}`}
              >
                {blocked ? <FiArrowRight size={14} /> : <FiCheckCircle size={15} />}
                <span>{blocked ? blocked : 'Everything is ready to post.'}</span>
              </div>

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
                className="btn-brand h-12 w-full rounded-xl text-sm shadow-sm"
              >
                <FiCheck size={17} /> {post.isLoading ? 'Posting…' : `Post ${lines.length || ''} ${lines.length === 1 ? 'line' : 'lines'}`.trim()}
              </button>
            </footer>
          </aside>
        </div>
      </section>
    </div>
  );
}
