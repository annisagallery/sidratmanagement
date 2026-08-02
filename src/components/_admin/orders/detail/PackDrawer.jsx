'use client';

/**
 * Packing scan, as a side panel on the order screen.
 *
 * A packer verifying a parcel needs the scan box and the piece list, but the
 * person doing it here is usually already on this order and does not want to
 * lose it. So the scan surface slides in beside the order instead of replacing
 * it: the order stays on screen and behind the panel, and closing returns to
 * exactly where they were.
 *
 * The full-screen station at /orders/[orderNo]/pack still exists for a bench
 * with a dedicated monitor; both drive the same endpoints.
 */

import { useEffect, useState } from 'react';
import { useMutation } from 'react-query';
import Swal from 'sweetalert2';
import { FiCheck, FiPackage, FiX } from 'react-icons/fi';

import * as api from 'src/services';
import ScanStation from 'src/components/_admin/scan/ScanStation';
import { Code, StateChip, readState } from 'src/components/_admin/ops/primitives';
import { errorAlert, oid, toast } from './parts';

const SKIP_STATUSES = ['cancelled', 'canceled', 'returned'];

function pieceLabel(item) {
  const name = item.pid?.name || item.productSnapshot?.name || 'Product';
  const attributes = (item.attributes || [])
    .map((attribute) => attribute.valueName || attribute.value)
    .filter(Boolean)
    .join(' / ');
  return attributes ? `${name} — ${attributes}` : name;
}

export default function PackDrawer({ order, orderNo, onClose, onChanged }) {
  const [manualItem, setManualItem] = useState('');

  const items = (order.items || []).filter((item) => !SKIP_STATUSES.includes(item.status));
  const scanned = items.filter((item) => item.packVerifiedAt);
  const remaining = items.filter((item) => !item.packVerifiedAt);
  const packed = order.status === 'packed';
  const packAction = (order.availableActions || []).find((action) => action.action === 'PACK');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { mutate: pack, isLoading: packing } = useMutation(() => api.packOrderByAdmin(orderNo), {
    onSuccess: () => {
      toast('Order packed');
      onChanged();
    },
    onError: (error) => errorAlert('Cannot pack this order', error, 'Not every piece is ready.')
  });

  /**
   * ScanStation owns sound, colour and focus; this only says what the scan
   * meant. The order is refetched either way, so a rejected scan still shows
   * the current truth about the parcel.
   */
  const handleScan = async (barcode) => {
    try {
      const response = await api.scanOrderItemForPacking({
        orderNo,
        barcode,
        itemId: manualItem || undefined,
        manual: Boolean(manualItem)
      });
      setManualItem('');
      await onChanged();
      return { ok: true, message: response.message || 'Piece verified.' };
    } catch (error) {
      const body = error?.response?.data;
      await onChanged();
      return {
        ok: false,
        message: body?.message || 'That code was not accepted.',
        detail: body?.manualAllowed
          ? 'No product matches this code. Pick the item below to assign it manually.'
          : null
      };
    }
  };

  const progress = items.length ? Math.round((scanned.length / items.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`Packing scan for order ${orderNo}`}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <header className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Packing scan</p>
              <h2 className="text-lg font-bold text-slate-900">
                Order <span className="ops-code">#{orderNo}</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close packing panel"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <FiX size={18} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </span>
            <span className="ops-code shrink-0 text-sm font-black text-slate-700">
              {scanned.length}/{items.length}
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {packed ? (
            <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <FiCheck className="shrink-0 text-xl text-emerald-600" />
              <div>
                <p className="text-[13px] font-bold text-emerald-900">This order is packed.</p>
                <p className="text-xs text-emerald-800">Hand it to dispatch to create the consignment.</p>
              </div>
            </div>
          ) : (
            <ScanStation
              onScan={handleScan}
              label="Scan each piece into the parcel"
              hint={
                manualItem
                  ? 'Manual assignment armed — the next scan is attached to the selected item.'
                  : 'Production pieces carry their own unit code; stock items take the catalogue barcode.'
              }
            />
          )}

          <section className="card-ui overflow-hidden">
            <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Pieces in this parcel
            </h3>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const state = readState(item);
                const done = Boolean(item.packVerifiedAt);
                return (
                  <li key={oid(item)} className="flex items-start gap-2.5 px-3 py-2">
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <FiCheck className="text-emerald-600" />
                      ) : (
                        <span className="block h-4 w-4 rounded-full border border-slate-300" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug text-slate-700">{pieceLabel(item)}</p>
                      <Code className="text-slate-500">{item.packingBarcode || item.assignedUnit?.barcode || ''}</Code>
                    </div>
                    <span className="shrink-0">
                      <StateChip state={done ? 'ready' : state.key} label={done ? 'Scanned' : state.label} />
                    </span>
                  </li>
                );
              })}
              {!items.length ? <li className="px-3 py-6 text-center text-sm text-slate-400">No pieces on this order.</li> : null}
            </ul>
          </section>

          {!packed && remaining.length ? (
            <details className="card-ui p-3">
              <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Assign an unmatched barcode manually
              </summary>
              <p className="mt-2 text-xs text-slate-500">
                Use this only when a piece carries no code this system knows. The override is recorded against the item.
              </p>
              <select
                value={manualItem}
                onChange={(event) => setManualItem(event.target.value)}
                className="select-ui mt-2 w-full"
              >
                <option value="">Choose the item this piece is…</option>
                {remaining.map((item) => (
                  <option key={oid(item)} value={oid(item)}>
                    {pieceLabel(item)}
                  </option>
                ))}
              </select>
            </details>
          ) : null}
        </div>

        {!packed ? (
          <footer className="border-t border-slate-200 bg-slate-50/70 p-4">
            <button
              type="button"
              onClick={() =>
                remaining.length
                  ? Swal.fire('Not every piece is scanned', `${remaining.length} still to go.`, 'warning')
                  : pack()
              }
              disabled={packing || (packAction ? !packAction.enabled : remaining.length > 0)}
              className="btn-brand h-10 w-full"
            >
              <FiPackage /> {packing ? 'Packing…' : 'Pack order'}
            </button>
            {packAction && !packAction.enabled && packAction.blockedBy ? (
              <p className="mt-1.5 text-center text-xs font-semibold text-slate-500">{packAction.blockedBy}</p>
            ) : null}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
