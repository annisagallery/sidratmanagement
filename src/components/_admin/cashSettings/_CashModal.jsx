'use client';
import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { adminAdjustCash, getUserCashList } from 'src/services';
import { MdClose, MdSearch, MdPerson } from 'react-icons/md';

const BDT = '৳';

export default function CashModal({ prefilledUser = null, onClose, onDone }) {
  const [user, setUser] = useState(prefilledUser);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ type: 'manual_credit', amount: '', message: '' });
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  const isCredit = form.type === 'manual_credit';
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (prefilledUser) return;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await getUserCashList(1, search.trim());
        setResults(r.data?.slice(0, 6) || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, prefilledUser]);

  const selectUser = (u) => {
    setUser(u);
    setSearch('');
    setResults([]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!user) {
      Swal.fire('Select a user', 'Please choose a user first.', 'warning');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      Swal.fire('Validation', 'Enter a valid amount.', 'warning');
      return;
    }
    if (!form.message.trim()) {
      Swal.fire('Validation', 'Enter a message for this adjustment.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await adminAdjustCash({
        userId: user._id,
        amount: Number(form.amount),
        type: form.type,
        message: form.message.trim()
      });
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Cashback ${isCredit ? 'credited' : 'debited'}!`,
        showConfirmButton: false,
        timer: 2000
      });
      onDone?.();
      onClose();
    } catch (err) {
      Swal.fire('Error', err?.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-md shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-800">Give Cashback</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition"
          >
            <MdClose size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* User picker */}
          {user ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-md px-4 py-3">
              <div className="w-9 h-9 rounded-md bg-green-200 text-green-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {user.name?.slice(0, 2)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
                <p className="text-xs text-gray-500">
                  {user.phone} · Balance:{' '}
                  <span className="text-green-700 font-semibold">
                    {BDT}
                    {(user.cash || 0).toLocaleString()}
                  </span>
                </p>
              </div>
              {!prefilledUser && (
                <button
                  type="button"
                  onClick={() => setUser(null)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <MdClose size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Search User</label>
              <div className="relative">
                <MdSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or phone number…"
                  className="w-full border rounded-md pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  autoFocus
                />
              </div>
              {(results.length > 0 || searching) && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg overflow-hidden">
                  {searching ? (
                    <div className="px-4 py-3 text-xs text-gray-400">Searching…</div>
                  ) : (
                    results.map((u) => (
                      <button
                        key={u._id}
                        type="button"
                        onClick={() => selectUser(u)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 transition text-left"
                      >
                        <div className="w-7 h-7 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {u.name?.slice(0, 2)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400">
                            {u.phone} · {BDT}
                            {(u.cash || 0).toLocaleString()}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Operation toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Operation</label>
            <div className="flex gap-2">
              {[
                { value: 'manual_credit', label: '+ Credit' },
                { value: 'manual_debit', label: '- Debit' }
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: o.value }))}
                  className={`flex-1 py-2 rounded-md border text-sm font-semibold transition ${
                    form.type === o.value
                      ? o.value === 'manual_credit'
                        ? 'bg-green-50 border-green-400 text-green-700'
                        : 'bg-red-50 border-red-400 text-red-600'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount ({BDT})</label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.amount}
              onChange={set('amount')}
              placeholder="e.g. 50"
              className="w-full border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message</label>
            <input
              value={form.message}
              onChange={set('message')}
              placeholder="Explain this adjustment"
              required
              className="w-full border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !user}
              className={`flex-1 py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition ${isCredit ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {saving ? 'Saving…' : isCredit ? `Credit ${BDT}` : `Debit ${BDT}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
