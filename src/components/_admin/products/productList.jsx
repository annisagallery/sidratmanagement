'use client';
import { useState } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import Image from 'next/image';
import { MdAdd, MdEdit, MdDelete, MdOpenInNew, MdVisibility, MdImage, MdInbox } from 'react-icons/md';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDate } from 'src/utils/formatTime';

const STATUS_OPTS = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Draft', value: 'draft' }
];

function StatusBadge({ status }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-red-100 text-red-700',
    draft: 'bg-amber-100 text-amber-700'
  };
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] || 'bg-slate-100 text-slate-600'}`}
    >
      {status}
    </span>
  );
}

export default function ProductList() {
  const router = useRouter();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const limit = 20;

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const params = new URLSearchParams({
    page,
    limit,
    ...(search && { search }),
    ...(status && { status }),
    ...(category && { category }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();

  const { data, isLoading, isFetching } = useQuery(['admin-products', params], () => api.getProductsByAdmin(params), {
    keepPreviousData: true
  });

  const { data: catData } = useQuery('admin-all-categories', api.getAllCategoriesByAdmin);
  const categories = catData?.data || [];

  const { mutate: deleteProduct } = useMutation(api.deleteProductByAdmin, {
    onSuccess: () => {
      Swal.fire({ title: 'Deleted!', icon: 'success', timer: 1200, showConfirmButton: false });
      qc.invalidateQueries(['admin-products']);
    },
    onError: (err) => Swal.fire('Error', err?.response?.data?.message || 'Delete failed', 'error')
  });

  const handleDelete = (product) => {
    Swal.fire({
      title: `Delete "${product.name}"?`,
      text: 'This will soft-delete the product and all its variations.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete'
    }).then((r) => {
      if (r.isConfirmed) deleteProduct(product.slug);
    });
  };

  const products = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const columns = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {p.featuredImage?.path ? (
              <Image src={p.featuredImage.path} alt={p.name} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <MdImage size={18} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-semibold text-slate-800">
              {p.name}
              {p.isFeatured && <span className="ml-1.5 text-xs text-amber-500">⭐</span>}
            </p>
            <p className="mt-0.5 font-mono text-xs text-slate-400">{p.slug}</p>
          </div>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      render: (p) => <span className="text-slate-600">{p.category?.name || '—'}</span>
    },
    {
      key: 'price',
      label: 'Lowest Price',
      sortable: true,
      align: 'right',
      render: (p) => {
        const init = p.priceInitiator;
        return (
          <>
            <p className="font-semibold text-slate-800">৳{p.lowestPrice ?? p.price}</p>
            {(() => {
              if (!init || init === 'regular') return <p className="mt-0.5 text-xs text-slate-400">Regular</p>;
              if (init === 'sale') return <p className="mt-0.5 text-xs text-emerald-600">↘ Variation sale</p>;
              const campName = init.startsWith('campaign:') ? init.slice(9) : '';
              return (
                <p className="mt-0.5 text-xs text-orange-500" title={campName || 'Campaign discount'}>
                  ↘ Campaign{campName ? `: ${campName}` : ''}
                </p>
              );
            })()}
          </>
        );
      }
    },
    {
      key: 'createdAt',
      label: 'Added',
      sortable: true,
      render: (p) => (
        <span className="text-xs text-slate-500">
          {p.createdAt ? fDate(p.createdAt) : '—'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (p) => <StatusBadge status={p.status} />
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => router.push(`/products/${p.slug}/view`)}
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
            title="View details"
          >
            <MdVisibility size={17} />
          </button>
          <button
            onClick={() => router.push(`/products/${p.slug}`)}
            className="rounded-md p-2 transition hover:bg-slate-100"
            style={{ color: 'var(--brand-strong)' }}
            title="Edit"
          >
            <MdEdit size={17} />
          </button>
          <button
            onClick={() =>
              window.open(
                `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/product/${p.slug}`,
                '_blank',
                'noopener'
              )
            }
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
            title="View on site"
          >
            <MdOpenInNew size={17} />
          </button>
          <button
            onClick={() => handleDelete(p)}
            className="rounded-md p-2 text-red-400 transition hover:bg-red-50"
            title="Delete"
          >
            <MdDelete size={17} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Products" subtitle={`${total} product${total !== 1 ? 's' : ''} total`}>
        <button onClick={() => router.push('/products/add')} className="btn-brand">
          <MdAdd size={18} /> Add Product
        </button>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search by name…"
        onReset={() => {
          setSearch('');
          setStatus('');
          setCategory('');
          setSortBy('');
          setPage(1);
        }}
      >
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[140px]"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[160px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        columns={columns}
        data={products}
        sort={sort}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No products found" hint="Try changing your search or filters" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="products" />}
      />
    </div>
  );
}
