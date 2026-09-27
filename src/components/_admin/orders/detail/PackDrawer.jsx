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

import { useState } from 'react';
import { useMutation } from 'react-query';
import { FiCheck, FiCheckCircle, FiPackage } from 'react-icons/fi';

import * as api from 'src/services';
import ScanStation from 'src/components/_admin/scan/ScanStation';
import Drawer from 'src/components/_admin/ui/Drawer';
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
  const allScanned = items.length > 0 && remaining.length === 0;
  const canPack = packAction ? packAction.enabled : allScanned;

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
        detail: body?.manualAllowed ? 'No product matches this code. Choose the item below to assign it by hand.' : null
      };
    }
  };

  const progress = items.length ? Math.round((scanned.length / items.length) * 100) : 0;
  const blockedReason = packAction && !packAction.enabled ? packAction.blockedBy : !allScanned ? `${remaining.length} piece${remaining.length === 1 ? '' : 's'} still to scan.` : null;

  return (
    <Drawer
      title={`Pack order #${orderNo}`}
      eyebrow="Packing scan"
      size="md"
      onClose={onClose}
      footer={
        packed ? (
          <button type="button" onClick={onClose} className="btn-brand">
            Done
          </button>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {blockedReason && <p className="text-[13px] text-slate-600">{blockedReason}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                Close
              </button>
              <button type="button" onClick={() => pack()} disabled={packing || !canPack} className="btn-brand">
                <FiPackage size={16} aria-hidden /> {packing ? 'Packing…' : 'Mark as packed'}
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-6">
        {/* Where the parcel stands, before anything else. */}
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              {packed ? 'Packed' : allScanned ? 'Every piece is scanned' : 'Scan each piece into the parcel'}
            </p>
            <p className="text-sm tabular-nums text-slate-600">
              <span className="font-semibold text-slate-900">{scanned.length}</span> of {items.length}
            </p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={scanned.length}
            aria-label="Pieces scanned"
          >
            <span className={`block h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-slate-900'}`} style={{ width: `${progress}%` }} />
          </div>
        </div>

        {packed ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3" role="status">
            <FiCheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <p className="text-[13px] font-semibold text-emerald-900">This order is packed.</p>
              <p className="text-[13px] text-emerald-800">Send the parcel to a courier from the order page.</p>
            </div>
          </div>
        ) : (
          <ScanStation
            onScan={handleScan}
            label="Scan a piece"
            hint={
              manualItem
                ? 'Manual assignment is on — the next scan is attached to the item you chose below.'
                : 'Production pieces carry their own code; stock items take the catalogue barcode.'
            }
          />
        )}

        <section aria-labelledby="pack-pieces-title">
          <h3 id="pack-pieces-title" className="mb-2 text-sm font-semibold text-slate-900">
            Pieces in this parcel
          </h3>
          {items.length ? (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {items.map((item) => {
                const state = readState(item);
                const done = Boolean(item.packVerifiedAt);
                const code = item.packingBarcode || item.assignedUnit?.barcode;
                return (
                  <li key={oid(item)} className={`flex items-start gap-3 px-3 py-2.5 ${done ? 'bg-slate-50' : ''}`}>
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                          <FiCheck size={12} aria-hidden />
                          <span className="sr-only">Scanned</span>
                        </span>
                      ) : (
                        <span className="block h-5 w-5 rounded-full border-2 border-slate-300" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium leading-snug ${done ? 'text-slate-500' : 'text-slate-900'}`}>{pieceLabel(item)}</p>
                      {code ? <Code className="text-slate-500">{code}</Code> : null}
                    </div>
                    <span className="shrink-0">
                      <StateChip state={done ? 'ready' : state.key} label={done ? 'Scanned' : state.label} />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-[13px] text-slate-500">No pieces on this order.</p>
          )}
        </section>

        {!packed && remaining.length ? (
          <details className="rounded-lg border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-slate-900">Assign an unknown barcode by hand</summary>
            <div className="space-y-2 border-t border-slate-200 px-4 py-3">
              <p className="text-[13px] text-slate-500">
                Only when a piece carries a code this system does not know. The override is recorded against the item.
              </p>
              <select
                value={manualItem}
                onChange={(event) => setManualItem(event.target.value)}
                className="select-ui w-full"
                aria-label="Item the next scan belongs to"
              >
                <option value="">Choose the item this piece is…</option>
                {remaining.map((item) => (
                  <option key={oid(item)} value={oid(item)}>
                    {pieceLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          </details>
        ) : null}
      </div>
    </Drawer>
  );
}
