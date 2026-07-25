'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { FiCheckCircle, FiMinusCircle, FiPlus, FiRefreshCw, FiTrash2, FiUser, FiX } from 'react-icons/fi';
import { MdQrCodeScanner } from 'react-icons/md';

import { searchProductionProducers, submitProductionSubmission } from 'src/services';

const message = (error) => error?.response?.data?.message || 'The production submission could not be posted.';
const timeLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const modeLabel = {
  UNIT_RECEIPT: 'Production',
  UNIT_REVERSAL: 'Remove',
  EXTRA_PAY: 'Extra'
};

export default function ProductionScanPage() {
  const [barcode, setBarcode] = useState('');
  const [mode, setMode] = useState('UNIT_RECEIPT');
  const [query, setQuery] = useState('');
  const [producer, setProducer] = useState(null);
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [qcConfirmed, setQcConfirmed] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data } = useQuery(['production-producers', query], () => searchProductionProducers(query), {
    keepPreviousData: true
  });

  const summary = useMemo(
    () =>
      lines.reduce(
        (acc, line) => {
          if (line.kind === 'UNIT_RECEIPT') acc.receipts += 1;
          if (line.kind === 'UNIT_REVERSAL') acc.reversals += 1;
          if (line.kind === 'EXTRA_PAY') acc.extra += Number(line.amount || 0);
          return acc;
        },
        { receipts: 0, reversals: 0, extra: 0 }
      ),
    [lines]
  );

  const post = useMutation(submitProductionSubmission, {
    onSuccess: (response) => {
      const posted = response?.data?.submission;
      setScanHistory((items) =>
        [
          {
            no: posted?.submissionNo || 'Posted',
            employee: producer?.name,
            code: producer?.employeeCode,
            count: lines.length,
            time: timeLabel()
          },
          ...items
        ].slice(0, 12)
      );
      setLines([]);
      setBarcode('');
      setNote('');
      setExtraAmount('');
      setExtraNote('');
      setQcConfirmed(false);
      queryClient.invalidateQueries('production-batches');
      queryClient.invalidateQueries('inventory-balances');
      toast.success('Production submission posted.');
    },
    onError: (error) => toast.error(message(error)),
    onSettled: () => requestAnimationFrame(() => inputRef.current?.focus())
  });

  useEffect(() => inputRef.current?.focus(), []);
  const producers = data?.data || [];

  const addBarcode = (event) => {
    event.preventDefault();
    const value = barcode.trim().toUpperCase();
    if (!value) return;
    if (value === '0000') {
      setMode('EXTRA_PAY');
      setBarcode('');
      return;
    }
    if (lines.some((line) => line.barcode === value)) {
      toast.warn('This barcode is already in the submission.');
      setBarcode('');
      return;
    }
    const kind = mode === 'UNIT_REVERSAL' ? 'UNIT_REVERSAL' : 'UNIT_RECEIPT';
    setLines((items) => [{ kind, barcode: value }, ...items]);
    if (kind === 'UNIT_RECEIPT') setQcConfirmed(false);
    setBarcode('');
  };

  const addExtra = () => {
    const amount = Number(extraAmount);
    const cleanNote = extraNote.trim();
    if (!amount || amount <= 0 || !cleanNote) {
      toast.warn('Extra work needs an amount and a note.');
      return;
    }
    setLines((items) => [
      { kind: 'EXTRA_PAY', barcode: '0000', amount, note: cleanNote },
      ...items
    ]);
    setExtraAmount('');
    setExtraNote('');
    setMode('UNIT_RECEIPT');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = () => {
    if (!producer || !lines.length || post.isLoading) return;
    if (summary.receipts > 0 && !qcConfirmed) {
      toast.warn('Complete QC and confirm it before final submission.');
      return;
    }
    post.mutate({
      producedBy: producer.userId,
      note,
      qcConfirmed: summary.receipts > 0 ? qcConfirmed : false,
      lines
    });
  };

  const reset = () => {
    setBarcode('');
    setLines([]);
    setNote('');
    setExtraAmount('');
    setExtraNote('');
    setQcConfirmed(false);
    setMode('UNIT_RECEIPT');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-blue-600">Production terminal</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Production scan desk</h1>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <FiRefreshCw /> Reset
        </button>
      </header>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Employee</p>
          </div>
          <div className="p-5">
            {producer ? (
              <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <div>
                  <p className="font-black text-slate-900">{producer.name}</p>
                  <p className="font-mono text-xs text-slate-500">{producer.employeeCode}</p>
                </div>
                <button
                  type="button"
                  aria-label="Change employee"
                  onClick={() => setProducer(null)}
                  className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-slate-900"
                >
                  <FiX />
                </button>
              </div>
            ) : (
              <div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search production employee"
                  className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200">
                  {producers.map((item) => (
                    <button
                      key={item.userId}
                      type="button"
                      onClick={() => setProducer(item)}
                      className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-slate-50"
                    >
                      <span className="text-sm font-bold text-slate-800">{item.name}</span>
                      <span className="font-mono text-xs text-slate-400">{item.employeeCode}</span>
                    </button>
                  ))}
                  {!producers.length && (
                    <div className="flex h-28 items-center justify-center text-sm text-slate-400">
                      <FiUser className="mr-2" /> No employees found
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Add</p>
                <p className="mt-1 font-mono text-xl font-black text-slate-950">{summary.receipts}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Remove</p>
                <p className="mt-1 font-mono text-xl font-black text-rose-600">{summary.reversals}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Extra</p>
                <p className="mt-1 font-mono text-xl font-black text-emerald-700">{summary.extra}</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-white shadow-sm">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <form onSubmit={addBarcode}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-400 text-slate-950">
                  <MdQrCodeScanner className="text-3xl" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Unit barcode</p>
                  <p className="font-mono text-xs text-slate-500">{producer?.name || 'Select employee'}</p>
                </div>
                <div className="ml-auto inline-flex overflow-hidden rounded-md border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setMode('UNIT_RECEIPT')}
                    className={`h-10 px-3 text-xs font-black ${mode === 'UNIT_RECEIPT' ? 'bg-emerald-400 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('UNIT_REVERSAL')}
                    className={`h-10 px-3 text-xs font-black ${mode === 'UNIT_REVERSAL' ? 'bg-rose-400 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('EXTRA_PAY')}
                    className={`h-10 px-3 text-xs font-black ${mode === 'EXTRA_PAY' ? 'bg-amber-300 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
                  >
                    0000
                  </button>
                </div>
              </div>

              {mode === 'EXTRA_PAY' ? (
                <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)_120px]">
                  <input
                    value={extraAmount}
                    onChange={(event) => setExtraAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="Amount"
                    className="h-14 rounded-md border border-slate-700 bg-slate-900 px-4 font-mono text-lg font-black outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                  />
                  <input
                    value={extraNote}
                    onChange={(event) => setExtraNote(event.target.value)}
                    placeholder="Note for extra work"
                    className="h-14 rounded-md border border-slate-700 bg-slate-900 px-4 text-sm font-bold outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                  />
                  <button
                    type="button"
                    onClick={addExtra}
                    className="h-14 rounded-md bg-amber-300 text-sm font-black text-slate-950 hover:bg-amber-200"
                  >
                    Add 0000
                  </button>
                </div>
              ) : (
                <input
                  ref={inputRef}
                  id="production-scan"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  disabled={post.isLoading}
                  placeholder={mode === 'UNIT_REVERSAL' ? 'Scan unit to remove' : 'Scan unit to add'}
                  className="h-20 w-full rounded-md border border-slate-700 bg-slate-900 px-5 font-mono text-2xl font-black uppercase tracking-wide outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                />
              )}
            </form>

            <div className="grid content-end gap-3">
              {summary.receipts > 0 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-300/50 bg-amber-300/10 p-3 text-amber-100">
                  <input
                    type="checkbox"
                    checked={qcConfirmed}
                    onChange={(event) => setQcConfirmed(event.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-amber-300"
                  />
                  <span>
                    <span className="block text-xs font-black uppercase tracking-wide">QC passed</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-300">
                      Final submit receives these units into inventory. There is no QC step afterward.
                    </span>
                  </span>
                </label>
              )}
              <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Cart</p>
                <p className={`mt-2 text-sm font-bold ${producer ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {producer ? `${lines.length} lines ready` : 'Employee needed'}
                </p>
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={!producer || !lines.length || post.isLoading || (summary.receipts > 0 && !qcConfirmed)}
                className="h-14 w-full rounded-md bg-emerald-400 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {post.isLoading ? 'Posting...' : 'Post submission'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 px-5 py-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <h2 className="font-black text-slate-900">Current submission</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">{modeLabel[mode]} mode</p>
          </div>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Submission note"
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((item, index) => (
                <tr key={`${item.kind}-${item.barcode}-${index}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black ${item.kind === 'UNIT_REVERSAL' ? 'bg-rose-50 text-rose-700' : item.kind === 'EXTRA_PAY' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {item.kind === 'UNIT_REVERSAL' ? <FiMinusCircle /> : <FiPlus />}
                      {modeLabel[item.kind]}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono font-black text-slate-950">{item.barcode}</td>
                  <td className="px-5 py-3 font-semibold text-slate-600">{item.note || '-'}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-slate-700">
                    {item.kind === 'EXTRA_PAY' ? item.amount : '-'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      aria-label="Remove line"
                      onClick={() => setLines((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lines.length && <div className="p-10 text-center text-sm text-slate-400">No items in this submission.</div>}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-black text-slate-900">Recent submissions</h2>
          <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-600">
            {scanHistory.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">Submission</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3 text-right">Lines</th>
                <th className="px-5 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scanHistory.map((item, index) => (
                <tr key={`${item.no}-${index}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono font-black text-slate-950">
                    <FiCheckCircle className="mr-2 inline text-emerald-500" />
                    {item.no}
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{item.employee}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.code}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">{item.count}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">{item.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!scanHistory.length && <div className="p-10 text-center text-sm text-slate-400">No submissions yet.</div>}
        </div>
      </section>
    </div>
  );
}
