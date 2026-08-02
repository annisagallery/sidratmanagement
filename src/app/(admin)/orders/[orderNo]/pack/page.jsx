'use client';

/**
 * Packing station.
 *
 * Previously this lived inside the order detail page, behind navigation and
 * next to Edit Details and Print Invoice. A packer at a table with a barcode
 * gun and a parcel needs one screen that does one thing, not an admin console
 * with a scan box in it.
 */

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { FiArrowLeft, FiCheck, FiPackage } from 'react-icons/fi';
import * as api from 'src/services';
import ScanStation from 'src/components/_admin/scan/ScanStation';
import { Code, StateChip, Empty, readState } from 'src/components/_admin/ops/primitives';

const READY = ['ready', 'reserved', 'awaiting-supply'];

function itemLabel(item) {
  const name = item.productSnapshot?.name || item.product?.name || 'Product';
  const attrs = (item.attributes || [])
    .map((attribute) => attribute.valueName || attribute.value)
    .filter(Boolean)
    .join(' / ');
  return attrs ? `${name} — ${attrs}` : name;
}

export default function PackingStation() {
  const { orderNo } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [manualItem, setManualItem] = useState('');

  const { data, refetch, isLoading } = useQuery(
    ['order', orderNo],
    () => api.getOrderByAdmin(orderNo),
    { enabled: Boolean(orderNo) },
  );
  const order = data?.data;
  const items = useMemo(
    () => (order?.items || []).filter((item) => !['cancelled', 'canceled', 'returned'].includes(item.status)),
    [order],
  );
  const scanned = items.filter((item) => item.packVerifiedAt);
  const remaining = items.filter((item) => !item.packVerifiedAt);

  const packAction = (order?.availableActions || []).find((action) => action.action === 'PACK');
  const alreadyPacked = order?.status === 'packed';

  const { mutateAsync: pack, isLoading: packing } = useMutation(() => api.packOrderByAdmin(orderNo), {
    onSuccess: () => {
      toast.success('Order packed.');
      queryClient.invalidateQueries(['order', orderNo]);
      refetch();
    },
    onError: (error) =>
      Swal.fire('Cannot pack order', error?.response?.data?.message || 'Not every piece is ready.', 'error'),
  });

  // The station returns an outcome; ScanStation owns sound, colour, and focus.
  const handleScan = async (barcode) => {
    try {
      const response = await api.scanOrderItemForPacking({
        orderNo,
        barcode,
        itemId: manualItem || undefined,
        manual: Boolean(manualItem),
      });
      setManualItem('');
      await refetch();
      return { ok: true, message: response.message || 'Piece verified.' };
    } catch (error) {
      const body = error?.response?.data;
      await refetch();
      return {
        ok: false,
        message: body?.message || 'That code was not accepted.',
        // The server distinguishes unknown codes from wrong-order and
        // already-scanned; only the first is worth offering a manual override.
        detail: body?.manualAllowed
          ? 'No product matches this code. Pick the item below to assign it manually.'
          : null,
      };
    }
  };

  if (isLoading) return <p className="p-8 text-sm text-slate-500">Loading order…</p>;
  if (!order) return <p className="p-8 text-sm text-rose-600">Order {orderNo} was not found.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/orders/${orderNo}`)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <FiArrowLeft /> Order {orderNo}
        </button>
        <span className="ml-auto flex items-center gap-3">
          <span className="hidden h-2 w-32 overflow-hidden rounded-full bg-slate-200 sm:block">
            <span
              className="block h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${items.length ? (scanned.length / items.length) * 100 : 0}%` }}
            />
          </span>
          <Code size="md" className="text-slate-700">
            {scanned.length}/{items.length}
          </Code>
        </span>
      </header>

      {alreadyPacked ? (
        <div className="card-ui flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4">
          <FiCheck className="shrink-0 text-xl text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">This order is packed.</p>
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
              : 'Scan the production barcode on the piece, or the catalogue barcode for stock items.'
          }
        />
      )}

      <section className="card-ui overflow-hidden">
        <h2 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Pieces in this parcel
        </h2>
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const state = readState(item);
              const done = Boolean(item.packVerifiedAt);
              return (
                <tr key={item.id || item._id} className="transition-colors hover:bg-slate-50/80">
                  <td className="w-10 px-3 py-2">
                    {done ? (
                      <FiCheck className="text-emerald-600" />
                    ) : (
                      <span className="block h-4 w-4 rounded-full border border-slate-300" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-[13px] font-medium text-slate-700">{itemLabel(item)}</td>
                  <td className="w-44 px-3 py-2">
                    <Code className="text-slate-500">
                      {item.packingBarcode || item.assignedUnit?.barcode || ''}
                    </Code>
                  </td>
                  <td className="w-36 px-3 py-2 text-right">
                    <StateChip state={done ? 'ready' : state.key} label={done ? 'Scanned' : state.label} />
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={4}>
                  <Empty title="No pieces on this order" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {!alreadyPacked && remaining.length ? (
        <details className="card-ui p-4">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Assign an unmatched barcode manually
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            Use this only when a piece carries no code this system knows. The override and its reason are recorded
            against the item.
          </p>
          <select
            value={manualItem}
            onChange={(event) => setManualItem(event.target.value)}
            className="select-ui mt-2 w-full"
          >
            <option value="">Choose the item this piece is…</option>
            {remaining.map((item) => (
              <option key={item.id || item._id} value={item.id || item._id}>
                {itemLabel(item)}
              </option>
            ))}
          </select>
        </details>
      ) : null}

      {!alreadyPacked ? (
        <div>
          <button
            type="button"
            onClick={() => pack()}
            disabled={packing || (packAction ? !packAction.enabled : remaining.length > 0)}
            className="btn-brand h-10 w-full"
          >
            <FiPackage /> {packing ? 'Packing…' : 'Pack order'}
          </button>
          {packAction && !packAction.enabled && packAction.blockedBy ? (
            <p className="mt-1.5 text-center text-xs font-semibold text-slate-500">{packAction.blockedBy}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
