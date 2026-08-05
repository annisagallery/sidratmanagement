'use client';

import { useRouter } from 'next-nprogress-bar';
import { MdArrowBack, MdInventory2 } from 'react-icons/md';
import ProductForm from 'src/components/forms/product';
import PageHeader from 'src/components/_admin/ui/PageHeader';

export default function AddProduct() {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Create product"
        subtitle="Build the product listing, media, options, and variations."
        icon={MdInventory2}
      >
        <button type="button" onClick={() => router.push('/products')} className="btn-ghost min-h-11">
          <MdArrowBack size={18} /> Back to products
        </button>
      </PageHeader>

      <ProductForm />
    </div>
  );
}
