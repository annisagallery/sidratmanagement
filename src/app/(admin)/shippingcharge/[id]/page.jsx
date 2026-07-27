'use client';
import React, { use } from 'react';

// components

// api
import * as api from 'src/services';
import { useQuery } from 'react-query';
import Swal from 'sweetalert2';
import EditShippingCharge from '@/src/components/_admin/shippingcharge/editShippingCharge';

export default function Page({ params }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery(['admin-size'], () => api.getShippingChargeByAdmin(id), {
    onError: (err) => {
      Swal.fire(err.response.data.message || 'Something went wrong!', '', 'error');
    }
  });
  return (
    <div>
      <EditShippingCharge isLoading={isLoading} data={data?.data} />
    </div>
  );
}
