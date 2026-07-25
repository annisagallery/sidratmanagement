'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';
import { useRouter } from 'next-nprogress-bar';
import { useMutation } from 'react-query';
import { MdOutlineDeleteOutline, MdOutlineFileDownload } from 'react-icons/md';
import OrderStatus from 'src/components/_admin/orders/orderStatus';
import * as api from 'src/services';

// @react-pdf/renderer is heavy — load it only when this toolbar renders,
// keeping it out of the shared orders bundle.
const OrderPdfDownload = dynamic(() => import('src/components/_admin/orders/orderPdfDownload'), {
  ssr: false,
  loading: () => (
    <button
      disabled
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-sky-500 rounded-md opacity-60 cursor-not-allowed"
    >
      <MdOutlineFileDownload size={16} />
      Download
    </button>
  ),
});

OrderToolbarActions.propTypes = { data: PropTypes.object.isRequired };

function Spinner() {
  return <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-md animate-spin" />;
}

export default function OrderToolbarActions({ data }) {
  const router = useRouter();
  const { mutate, isLoading: deleteLoading } = useMutation(api.deleteOrderByAdmin, {
    onSuccess: (res) => { toast.success(res.message); router.push('/orders'); },
    onError: () => { toast.error('Something went wrong!'); router.push('/404'); },
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <OrderPdfDownload data={data} />

      <button
        onClick={() => mutate(data?._id)}
        disabled={deleteLoading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 rounded-md disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {deleteLoading ? <Spinner /> : <MdOutlineDeleteOutline size={16} />}
        Delete
      </button>

      <OrderStatus data={data} />
    </div>
  );
}
