'use client';
import React, { use } from 'react';
import { useQuery } from 'react-query';
import * as api from 'src/services';
import EditShippingCharge from 'src/components/_admin/shippingcharge/editShippingCharge';
import { ErrorState } from 'src/components/_admin/ui/TableStates';

export default function Page({ params }) {
  const { id } = use(params);
  const { data, isLoading, isError, error, refetch } = useQuery(['admin-shipping-charge', id], () =>
    api.getShippingChargeByAdmin(id)
  );

  // Without a record the form is a create form — never show it for a failed load.
  if (isError) return <ErrorState error={error} title="This shipping charge could not be loaded" onRetry={refetch} />;
  return <EditShippingCharge isLoading={isLoading} data={data?.data} />;
}
