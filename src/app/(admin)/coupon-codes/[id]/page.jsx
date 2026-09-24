'use client';
import { use } from 'react';
import { useQuery } from 'react-query';
import * as api from 'src/services';
import CouponCodeForm from 'src/components/forms/couponCode';

export default function EditCouponPage({ params }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery(['coupon-edit', id], () => api.getCouponCodeByAdmin(id));

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;
  return (
    <div className="space-y-4">
      <CouponCodeForm data={data?.data} />
    </div>
  );
}
