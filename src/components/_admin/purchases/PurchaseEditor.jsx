'use client';

/**
 * Loads a purchase, then hands it to the same docket that created it.
 *
 * The form is mounted only once the purchase has arrived, because its fields
 * are seeded from the record at mount — a form that mounts empty and then has
 * values pushed into it is a form that fights whoever started typing first.
 */

import { useQuery } from 'react-query';

import { getPurchase } from 'src/services';
import { Notice } from 'src/components/_admin/ui/primitives';
import PurchaseForm from './PurchaseForm';

export default function PurchaseEditor({ id }) {
  const { data, isLoading } = useQuery(['purchase', id], () => getPurchase(id));
  const purchase = data?.data;

  if (isLoading) return <p className="p-8 text-sm text-slate-400">Loading purchase…</p>;
  if (!purchase) {
    return (
      <Notice tone="bad" title="Purchase not found">
        It may have been removed.
      </Notice>
    );
  }

  return <PurchaseForm purchase={purchase} />;
}
