'use client';

/**
 * Production scan desk — finished pieces in, faulty pieces out.
 *
 * Scans accumulate locally and post as one submission. That is deliberate: a
 * factory network drops, and a desk that needs the server for every scan stops
 * the line. Nothing leaves this screen until "Post" is pressed, and until then
 * every line can be removed.
 *
 * Three acts share one desk because one person does all three in a single pass:
 * receive what was made, reject what failed QC, and record work that has no
 * barcode at all.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FiAlertTriangle, FiCheck, FiPlus, FiRefreshCw, FiTrash2, FiUser } from 'react-icons/fi';
import { MdQrCodeScanner } from 'react-icons/md';

import { searchProductionProducers, submitProductionSubmission } from 'src/services';
import ScanStation from 'src/components/_admin/scan/ScanStation';
import { Code } from 'src/components/_admin/ops/primitives';
import {
  Field,
  Notice,
  PageBar,
  Pill,
  Section,
  SectionBody,
  StatTile,
  errorAlert,
  money,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';

/**
 * The three acts, in the words used at the desk. `tone` drives the whole
 * screen's accent so the current mode is impossible to mistake — rejecting a
 * piece writes it off stock and must never be done by accident.
 */
const MODES = [
  {
    key: 'UNIT_RECEIPT',
    label: 'Receive',
    tone: 'good',
    scanLabel: 'Scan a finished piece',
    hint: 'Each piece is added to stock, and binds to the oldest waiting order for that product.'
  },
  {
    key: 'UNIT_REVERSAL',
    label: 'Reject',
    tone: 'bad',
    scanLabel: 'Scan the faulty piece',
    hint: 'Writes the piece off stock. If it was promised to an order, that order returns to the queue with a fresh barcode.'
  },
  { key: 'EXTRA_PAY', label: 'Extra work', tone: 'warn', scanLabel: null, hint: 'Work with no piece attached — repairs, alterations, overtime.' }
];

const MODE_LABEL = { UNIT_RECEIPT: 'Received', UNIT_REVERSAL: 'Rejected', EXTRA_PAY: 'Extra work' };
const MODE_TONE = { UNIT_RECEIPT: 'good', UNIT_REVERSAL: 'bad', EXTRA_PAY: 'warn' };

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
          rejects: acc.rejects + (line.kind === 'UNIT_REVERSAL' ? 1 : 0),
          extra: acc.extra + (line.kind === 'EXTRA_PAY' ? Number(line.amount || 0) : 0)
        }),
        { receipts: 0, rejects: 0, extra: 0 }
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

  /**
   * A scan is only added to the local list; nothing is sent yet. `0000` is the
   * floor's long-standing shortcut for "this work has no barcode".
   */
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
    // A new piece invalidates a QC tick that was given for a shorter list.
    if (kind === 'UNIT_RECEIPT') setQcConfirmed(false);
    return { ok: true, message: kind === 'UNIT_RECEIPT' ? `${barcode} received.` : `${barcode} marked faulty.` };
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
    <div className="space-y-4">
      <PageBar
        eyebrow="Production"
        title="Scan desk"
        subtitle="Scans are held here until you post them, so a dropped network never loses work."
      >
        <button type="button" onClick={reset} className="btn-ghost">
          <FiRefreshCw size={14} /> Clear desk
        </button>
      </PageBar>

      {/* What the last post actually did — the only proof auto-binding works. */}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Receiving" value={qty(summary.receipts)} note="Pieces into stock" tone={summary.receipts ? 'good' : 'muted'} />
        <StatTile label="Rejecting" value={qty(summary.rejects)} note="Pieces written off" tone={summary.rejects ? 'bad' : 'muted'} />
        <StatTile label="Extra work" value={money(summary.extra)} note="Paid outside piece rates" tone={summary.extra ? 'warn' : 'muted'} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* ── entry ─────────────────────────────────────────────────────── */}
        <Section title="Entry" icon={MdQrCodeScanner} hint={producer ? producer.name : 'No employee chosen'}>
          <SectionBody className="space-y-4 p-4">
            <Field label="Who made these pieces">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                <select
                  value={producerId}
                  onChange={(event) => setProducerId(event.target.value)}
                  className="select-ui h-10 w-full"
                >
                  <option value="">Choose employee…</option>
                  {producers.map((entry) => (
                    <option key={entry.userId} value={entry.userId}>
                      {entry.name} — {entry.employeeCode}
                    </option>
                  ))}
                </select>
                <input
                  value={producerSearch}
                  onChange={(event) => setProducerSearch(event.target.value)}
                  placeholder="Search…"
                  className="input-ui h-10"
                  aria-label="Search employees"
                />
              </div>
            </Field>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">What are you doing</span>
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((entry) => {
                  const active = mode === entry.key;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setMode(entry.key)}
                      aria-pressed={active}
                      className={`h-9 rounded-md border px-3.5 text-[13px] font-semibold transition ${
                        active
                          ? entry.key === 'UNIT_REVERSAL'
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : entry.key === 'EXTRA_PAY'
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{activeMode.hint}</p>
            </div>

            {mode === 'EXTRA_PAY' ? (
              <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
                <input
                  value={extra.amount}
                  onChange={(event) => setExtra({ ...extra, amount: event.target.value })}
                  inputMode="decimal"
                  placeholder="Amount ৳"
                  className="input-ui ops-code h-10"
                  aria-label="Extra work amount"
                />
                <input
                  value={extra.note}
                  onChange={(event) => setExtra({ ...extra, note: event.target.value })}
                  placeholder="What was the work?"
                  className="input-ui h-10"
                  aria-label="Extra work reason"
                />
                <button type="button" onClick={addExtra} className="btn-brand h-10">
                  <FiPlus size={14} /> Add
                </button>
              </div>
            ) : (
              <ScanStation
                onScan={handleScan}
                label={activeMode.scanLabel}
                placeholder="Scan a unit barcode, then press Enter"
                disabled={!producerId}
                disabledReason="Choose the employee first — a scan has to belong to someone."
                historyLimit={5}
              />
            )}

            {mode === 'UNIT_REVERSAL' ? (
              <p className="flex items-start gap-1.5 text-xs font-medium text-rose-600">
                <FiAlertTriangle size={13} className="mt-0.5 shrink-0" />
                Rejecting is not reversible from this desk.
              </p>
            ) : null}
          </SectionBody>
        </Section>

        {/* ── the pending submission ────────────────────────────────────── */}
        <Section
          title="This submission"
          icon={FiUser}
          hint={`${lines.length} line${lines.length === 1 ? '' : 's'}`}
          actions={
            lines.length ? (
              <button type="button" onClick={() => setLines([])} className="btn-ghost h-8 !px-2.5 !text-xs">
                Clear lines
              </button>
            ) : null
          }
        >
          <div className="max-h-[320px] overflow-y-auto">
            {lines.length ? (
              <ul className="divide-y divide-slate-100">
                {lines.map((line, index) => (
                  <li key={`${line.barcode}-${index}`} className="flex items-center gap-3 px-3 py-2">
                    <Pill tone={MODE_TONE[line.kind]}>{MODE_LABEL[line.kind]}</Pill>
                    <span className="min-w-0 flex-1">
                      {line.kind === 'EXTRA_PAY' ? (
                        <span className="text-[13px] text-slate-700">{line.note}</span>
                      ) : (
                        <Code className="text-slate-700">{line.barcode}</Code>
                      )}
                    </span>
                    {line.kind === 'EXTRA_PAY' ? (
                      <span className="ops-code text-[13px] font-bold text-slate-800">{money(line.amount)}</span>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Remove line"
                      onClick={() => setLines((current) => current.filter((_, position) => position !== index))}
                      className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <MdQrCodeScanner className="mx-auto mb-2 text-2xl text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Nothing scanned yet</p>
                <p className="mt-1 text-xs text-slate-400">Lines stay here until you post them.</p>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 p-3">
            {summary.receipts > 0 ? (
              <label className="flex cursor-pointer items-start gap-2 text-[13px] font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={qcConfirmed}
                  onChange={(event) => setQcConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  QC passed on {summary.receipts} piece{summary.receipts === 1 ? '' : 's'}
                  <span className="block text-[11px] font-normal text-slate-400">
                    Ticking this records who cleared them.
                  </span>
                </span>
              </label>
            ) : null}

            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note for this submission (optional)"
              className="input-ui"
              aria-label="Submission note"
            />

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
              className="btn-brand h-10 w-full"
            >
              <FiCheck size={15} /> {post.isLoading ? 'Posting…' : 'Post submission'}
            </button>
            {blocked ? <p className="text-center text-xs font-semibold text-slate-500">{blocked}</p> : null}
          </div>
        </Section>
      </div>
    </div>
  );
}
