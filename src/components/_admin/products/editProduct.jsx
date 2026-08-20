'use client';

import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import { MdArrowBack, MdAutorenew, MdInventory2 } from 'react-icons/md';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import ProductForm from 'src/components/forms/product';
import PageHeader from 'src/components/_admin/ui/PageHeader';

export default function EditProduct({ slug }) {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery(['product-admin', slug], () => api.getOneProductByAdmin(slug), {
    onError: (error) => {
      Swal.fire('Error', error?.response?.data?.message || 'Product not found', 'error');
    }
  });
  const product = data?.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isLoading ? 'Edit product' : product ? `Edit ${product.name}` : 'Product not found'}
        subtitle={product ? `/${product.slug}` : isLoading ? 'Loading product details...' : 'The requested product could not be loaded.'}
        icon={MdInventory2}
      >
        {/* "Materials & costing" and "View on site" used to sit here. Materials
            is reachable from the form's own Materials step, and the storefront
            link now lives in the Storefront preview panel beside the form,
            which is where you are already looking when you want it. */}
        <button type="button" onClick={() => router.push('/products')} className="btn-ghost min-h-11">
          <MdArrowBack size={18} /> Back to products
        </button>
      </PageHeader>

      {isLoading && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="card-ui h-[620px] animate-pulse bg-slate-100" />
          <div className="card-ui h-[440px] animate-pulse bg-slate-100" />
          <span className="sr-only">
            <MdAutorenew className="animate-spin" /> Loading product...
          </span>
        </div>
      )}
      {isError && !isLoading && (
        <div className="card-ui border-red-200 px-6 py-16 text-center">
          <p className="font-semibold text-red-700">Failed to load product.</p>
          <button type="button" onClick={() => router.push('/products')} className="btn-ghost mt-4 min-h-11">
            <MdArrowBack size={18} /> Back to products
          </button>
        </div>
      )}
      {!isLoading && !isError && product && <ProductForm currentProduct={product} />}
    </div>
  );
}
