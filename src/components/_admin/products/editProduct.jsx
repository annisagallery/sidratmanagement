'use client';
import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import { MdArrowBack, MdAutorenew, MdOpenInNew } from 'react-icons/md';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import ProductForm from 'src/components/forms/product';

export default function EditProduct({ slug }) {
  const router = useRouter();

  const { data, isLoading, isError } = useQuery(['product-admin', slug], () => api.getOneProductByAdmin(slug), {
    onError: (err) => {
      Swal.fire('Error', err?.response?.data?.message || 'Product not found', 'error');
    }
  });

  const product = data?.data;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => router.push('/products')}
          className="p-2 rounded-md border text-gray-500 hover:bg-gray-50 transition"
        >
          <MdArrowBack size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-800 truncate">
            {isLoading ? 'Loading…' : product ? `Edit: ${product.name}` : 'Product Not Found'}
          </h1>
          {product && (
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-sm text-gray-400 font-mono">/{product.slug}</p>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/product/${product.slug}`,
                    '_blank',
                    'noopener'
                  )
                }
                className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                <MdOpenInNew size={13} /> View on site
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border rounded-md p-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <MdAutorenew className="animate-spin" size={36} />
            <p className="mt-3 text-sm">Loading product…</p>
          </div>
        )}
        {isError && !isLoading && (
          <div className="text-center py-24 text-red-500">
            <p className="font-semibold">Failed to load product.</p>
            <button
              type="button"
              onClick={() => router.push('/products')}
              className="mt-4 text-sm text-blue-500 underline"
            >
              Back to products
            </button>
          </div>
        )}
        {!isLoading && !isError && product && <ProductForm currentProduct={product} />}
      </div>
    </div>
  );
}
