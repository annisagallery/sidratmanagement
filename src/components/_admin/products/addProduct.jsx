'use client';
import { useRouter } from 'next-nprogress-bar';
import { MdArrowBack } from 'react-icons/md';
import ProductForm from 'src/components/forms/product';

export default function AddProduct() {
  const router = useRouter();
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
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Add New Product</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Fill in the steps below, then save. Live preview is always on the right.
          </p>
        </div>
      </div>

      {/* Form — full width, no card wrapper so the two-panel layout fills the page */}
      <div className="bg-white border rounded-md p-6">
        <ProductForm />
      </div>
    </div>
  );
}
