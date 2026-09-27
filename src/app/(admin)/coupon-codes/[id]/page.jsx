'use client';
import { use } from 'react';
import { useQuery } from 'react-query';
import * as api from 'src/services';
import CouponCodeForm from 'src/components/forms/couponCode';
import { EmptyState, ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';

export default function EditCouponPage({ params }) {
  const { id } = use(params);
  const { data, isLoading, isError, error, refetch } = useQuery(['coupon-edit', id], () => api.getCouponCodeByAdmin(id));

  if (isLoading) return <LoadingBlock />;
  // Without a record the form is a create form — never show it for a failed load.
  if (isError) return <ErrorState error={error} title="This coupon could not be loaded" onRetry={refetch} />;
  if (!data?.data) {
    return (
      <div className="card-ui">
        <EmptyState title="Coupon not found" hint="It may have been deleted." />
      </div>
    );
  }
  return <CouponCodeForm data={data.data} />;
}
