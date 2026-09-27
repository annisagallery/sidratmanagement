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
import { EmptyState, ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';
import PurchaseForm from './PurchaseForm';

export default function PurchaseEditor({ id }) {
  const { data, isLoading, isError, error, refetch } = useQuery(['purchase', id], () => getPurchase(id));
  const purchase = data?.data;

  if (isLoading) return <LoadingBlock rows={6} />;
  if (isError && !purchase) return <ErrorState error={error} title="This purchase could not be loaded" onRetry={refetch} />;
  if (!purchase) {
    return (
      <div className="card-ui">
        <EmptyState title="Purchase not found" hint="It may have been removed." />
      </div>
    );
  }

  return <PurchaseForm purchase={purchase} />;
}
