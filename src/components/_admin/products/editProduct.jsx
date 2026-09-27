'use client';

import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import { MdArrowBack } from 'react-icons/md';
import * as api from 'src/services';
import ProductForm from 'src/components/forms/product';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { ErrorState } from 'src/components/_admin/ui/TableStates';

export default function EditProduct({ slug }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useQuery(['product-admin', slug], () => api.getOneProductByAdmin(slug));
  const product = data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLoading ? 'Edit product' : product ? `Edit ${product.name}` : 'Product not found'}
        subtitle={product ? `/${product.slug}` : undefined}
      >
        {/* "Materials & costing" and "View on site" used to sit here. Materials
            is reachable from the form's own Materials step, and the storefront
            link now lives in the Storefront preview panel beside the form,
            which is where you are already looking when you want it. */}
        <button type="button" onClick={() => router.push('/products')} className="btn-ghost">
          <MdArrowBack size={18} aria-hidden /> Back to products
        </button>
      </PageHeader>

      {isLoading && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
          <div className="card-ui h-[620px] animate-pulse" />
          <div className="card-ui h-[440px] animate-pulse" />
          <span className="sr-only">Loading the product</span>
        </div>
      )}
      {isError && !isLoading && <ErrorState error={error} title="This product could not be loaded" onRetry={refetch} />}
      {!isLoading && !isError && product && <ProductForm currentProduct={product} />}
    </div>
  );
}
