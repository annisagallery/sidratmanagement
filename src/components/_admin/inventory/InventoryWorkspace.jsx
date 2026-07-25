'use client';
import DataTable from 'src/components/_admin/ui/DataTable';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import {
  FiArrowRight,
  FiCheck,
  FiExternalLink,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiTruck
} from 'react-icons/fi';
import { useRouter } from 'next-nprogress-bar';
import Pagination from 'src/components/_admin/ui/Pagination';
import {
  adminGetBranches,
  approveStockTransfer,
  createStockTransfer,
  dispatchStockTransfer,
  getInventoryBalances,
  getProductStockList,
  getStockLots,
  getStockTransfers,
  receiveStockTransfer,
  resolveInventoryBarcode,
  searchProducts
} from 'src/services';

const inputClass =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100';
const buttonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
const emptyLine = () => ({ product: '', variation: '', sourceLot: '', quantity: 1 });

function message(error) {
  return error.response?.data?.message || error.message || 'The action could not be completed.';
}

function ProductSelect({ value, onChange, products }) {
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Select product</option>
      {products.map((product) => (
        <option key={product._id} value={product._id}>
          {product.name} · #{product.code}
        </option>
      ))}
    </select>
  );
}

function VariationSelect({ productId, value, onChange, products }) {
  const variations = products.find((product) => product._id === productId)?.variations || [];
  if (!variations.length)
    return (
      <div className="flex h-10 items-center rounded-md border border-dashed border-slate-200 px-3 text-xs text-slate-400">
        Base product
      </div>
    );
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Select variation</option>
      {variations.map((variation) => (
        <option key={variation._id} value={variation._id}>
          {variation.sku ||
            variation.attributes
              ?.map((attribute) => attribute.valueName)
              .filter(Boolean)
              .join(' / ') ||
            'Variation'}
        </option>
      ))}
    </select>
  );
}

function Status({ value }) {
  const colors = {
    DRAFT: 'bg-slate-100 text-slate-600',
    APPROVED: 'bg-sky-50 text-sky-700',
    IN_TRANSIT: 'bg-amber-50 text-amber-700',
    RECEIVED: 'bg-emerald-50 text-emerald-700',
    COMPLETED: 'bg-emerald-50 text-emerald-700',
    IN_PROGRESS: 'bg-violet-50 text-violet-700',
    PENDING: 'bg-slate-100 text-slate-600'
  };
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide ${colors[value] || 'bg-slate-100 text-slate-600'}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export default function InventoryWorkspace({ initialView = 'Stock' }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab] = useState(initialView);
  const [transfer, setTransfer] = useState({
    sourceBranch: '',
    destinationBranch: '',
    note: '',
    lines: [emptyLine()]
  });
  const [barcode, setBarcode] = useState('');
  const [barcodeBranch, setBarcodeBranch] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [transferPage, setTransferPage] = useState(1);
  const transferLimit = 20;

  const branchesQuery = useQuery('inventory-branches', adminGetBranches);
  const balancesQuery = useQuery('inventory-balances', () => getInventoryBalances());
  const transfersQuery = useQuery(
    ['inventory-transfers', transferPage],
    () => getStockTransfers({ page: transferPage, limit: transferLimit }),
    { keepPreviousData: true }
  );
  const productStockQuery = useQuery('inventory-product-stock', () => getProductStockList({ showAll: 'true' }));
  const lotsQuery = useQuery(
    ['inventory-source-lots', transfer.sourceBranch],
    () => getStockLots({ branch: transfer.sourceBranch, status: 'ACTIVE' }),
    { enabled: !!transfer.sourceBranch }
  );
  const productsQuery = useQuery('inventory-product-options', () => searchProducts({ search: '', limit: 100 }));

  const branches = branchesQuery.data?.data || [];
  const balances = balancesQuery.data?.data || [];
  const transfers = transfersQuery.data?.data || [];
  const sourceLots = lotsQuery.data?.data || [];
  const products = productsQuery.data?.data || productsQuery.data || [];

  const totals = useMemo(
    () =>
      balances.reduce(
        (result, balance) => ({
          onHand: result.onHand + balance.onHand,
          reserved: result.reserved + balance.reserved,
          available: result.available + Math.max(0, balance.onHand - balance.reserved)
        }),
        { onHand: 0, reserved: 0, available: 0 }
      ),
    [balances]
  );

  const allProductStock = productStockQuery.data?.data || [];
  const filteredProductStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return allProductStock;
    return allProductStock.filter(
      (item) => item.product?.name?.toLowerCase().includes(q) || String(item.product?.code || '').includes(q)
    );
  }, [allProductStock, stockSearch]);
  const stockTotals = useMemo(
    () =>
      filteredProductStock.reduce(
        (acc, item) => ({
          onHand: acc.onHand + item.totalOnHand,
          reserved: acc.reserved + item.totalReserved,
          available: acc.available + Math.max(0, item.totalOnHand - item.totalReserved)
        }),
        { onHand: 0, reserved: 0, available: 0 }
      ),
    [filteredProductStock]
  );

  const refresh = () => {
    queryClient.invalidateQueries('inventory-branches');
    queryClient.invalidateQueries('inventory-balances');
    queryClient.invalidateQueries('inventory-transfers');
  };
  const useInventoryMutation = (fn, success) =>
    useMutation(fn, {
      onSuccess: () => {
        toast.success(success);
        refresh();
      },
      onError: (error) => toast.error(message(error))
    });
  const createTransferMut = useInventoryMutation(createStockTransfer, 'Transfer created');
  const approveMut = useInventoryMutation(approveStockTransfer, 'Transfer approved');
  const dispatchMut = useInventoryMutation(dispatchStockTransfer, 'Transfer dispatched');
  const receiveMut = useInventoryMutation(receiveStockTransfer, 'Transfer received');
  const barcodeMut = useMutation(resolveInventoryBarcode, { onError: (error) => toast.error(message(error)) });

  const setTransferLine = (index, key, value) =>
    setTransfer((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line))
    }));

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-7">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Stock control</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Inventory movement desk</h1>
          <p className="mt-1 text-sm text-slate-500">
            Production lands at HQ. Transfers move quantity between branches while pricing stays global.
          </p>
        </div>
        <button
          className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`}
          onClick={refresh}
        >
          <FiRefreshCw /> Refresh
        </button>
      </header>

      {tab === 'Stock' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['On hand', stockTotals.onHand, 'text-slate-900'],
              ['Reserved', stockTotals.reserved, 'text-amber-700'],
              ['Available', stockTotals.available, 'text-emerald-700']
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-md border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <p className={`mt-2 font-mono text-3xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="Search products by name or code…"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                />
              </div>
            </div>

            {productStockQuery.isLoading ? (
              <p className="py-10 text-center text-sm text-slate-400">Loading inventory…</p>
            ) : (
              <div className="overflow-x-auto">
                <DataTable className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3 text-right">On hand</th>
                      <th className="px-5 py-3 text-right">Reserved</th>
                      <th className="px-5 py-3 text-right">Available</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProductStock.map((item) => {
                      const available = Math.max(0, item.totalOnHand - item.totalReserved);
                      return (
                        <tr key={item._id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <p className="font-semibold text-slate-900">{item.product?.name}</p>
                            <p className="font-mono text-xs text-slate-400">#{item.product?.code}</p>
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-slate-700">{item.totalOnHand}</td>
                          <td className="px-5 py-3 text-right font-mono text-amber-700">{item.totalReserved}</td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`font-mono font-bold ${
                                available === 0 ? 'text-red-500' : available < 5 ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {available}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => router.push(`/products/${item.product?.slug}/view`)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              View <FiExternalLink size={11} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
                {!filteredProductStock.length && (
                  <p className="py-10 text-center text-sm text-slate-400">No products found.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Transfers' && (
        <div className="space-y-5">
          <form
            className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              createTransferMut.mutate(
                {
                  ...transfer,
                  lines: transfer.lines.map((line) => ({
                    ...line,
                    variation: line.variation || null,
                    sourceLot: line.sourceLot || null
                  }))
                },
                {
                  onSuccess: () =>
                    setTransfer({ sourceBranch: '', destinationBranch: '', note: '', lines: [emptyLine()] })
                }
              );
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <FiTruck className="text-amber-600" />
                <h2 className="font-black text-slate-900">Stock transfer draft</h2>
              </div>
              <span className="rounded-md bg-white px-3 py-1 font-mono text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                {transfer.lines.length} lines
              </span>
            </div>
            <div className="grid items-center gap-3 border-b border-slate-200 p-5 md:grid-cols-[1fr_auto_1fr]">
              <select
                className={inputClass}
                value={transfer.sourceBranch}
                onChange={(e) => setTransfer({ ...transfer, sourceBranch: e.target.value })}
                required
              >
                <option value="">From branch</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <span className="hidden h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 md:flex">
                <FiArrowRight />
              </span>
              <select
                className={inputClass}
                value={transfer.destinationBranch}
                onChange={(e) => setTransfer({ ...transfer, destinationBranch: e.target.value })}
                required
              >
                <option value="">To branch</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 md:col-span-3"
                value={transfer.note}
                onChange={(e) => setTransfer({ ...transfer, note: e.target.value })}
                placeholder="Transfer note"
              />
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[980px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400 md:grid md:grid-cols-[1fr_1fr_170px_90px_40px] md:gap-2">
                <span>Product</span>
                <span>Variation</span>
                <span>Source lot</span>
                <span className="text-right">Qty</span>
                <span></span>
              </div>
              <div className="min-w-[980px] divide-y divide-slate-100">
              {transfer.lines.map((line, index) => {
                const sourceIsBranch =
                  branches.find((branch) => branch._id === transfer.sourceBranch)?.type === 'BRANCH';
                const matchingLots = sourceLots.filter(
                  (lot) =>
                    lot.product?._id === line.product &&
                    String(lot.variation?._id || '') === String(line.variation || '') &&
                    lot.onHandQuantity > lot.reservedQuantity
                );
                return (
                  <div
                    key={index}
                    className="grid gap-2 bg-white p-3 transition hover:bg-slate-50 md:grid-cols-[1fr_1fr_170px_90px_40px]"
                  >
                    <ProductSelect
                      value={line.product}
                      products={products}
                      onChange={(value) =>
                        setTransfer((current) => ({
                          ...current,
                          lines: current.lines.map((item, lineIndex) =>
                            lineIndex === index ? { ...item, product: value, variation: '', sourceLot: '' } : item
                          )
                        }))
                      }
                    />
                    <VariationSelect
                      productId={line.product}
                      value={line.variation}
                      products={products}
                      onChange={(value) =>
                        setTransfer((current) => ({
                          ...current,
                          lines: current.lines.map((item, lineIndex) =>
                            lineIndex === index ? { ...item, variation: value, sourceLot: '' } : item
                          )
                        }))
                      }
                    />
                    {sourceIsBranch ? (
                      <select
                        className={inputClass}
                        value={line.sourceLot}
                        onChange={(e) => setTransferLine(index, 'sourceLot', e.target.value)}
                        required
                      >
                        <option value="">Source stock lot</option>
                        {matchingLots.map((lot) => (
                          <option key={lot._id} value={lot._id}>
                            {lot.onHandQuantity - lot.reservedQuantity} available
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex h-10 items-center rounded-md border border-dashed border-slate-200 px-3 text-xs text-slate-400">
                        HQ · FIFO
                      </div>
                    )}
                    <input
                      className={`${inputClass} text-right font-mono font-bold`}
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => setTransferLine(index, 'quantity', Number(e.target.value))}
                      required
                    />
                    <button
                      type="button"
                      aria-label="Remove line"
                      className="rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() =>
                        transfer.lines.length > 1 &&
                        setTransfer({ ...transfer, lines: transfer.lines.filter((_, i) => i !== index) })
                      }
                    >
                      <FiTrash2 className="mx-auto" />
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4">
              <button
                type="button"
                className={`${buttonClass} border border-slate-200 text-slate-600`}
                onClick={() => setTransfer({ ...transfer, lines: [...transfer.lines, emptyLine()] })}
              >
                <FiPlus /> Add product
              </button>
              <button className={`${buttonClass} bg-slate-950 text-white`} disabled={createTransferMut.isLoading}>
                Save draft transfer
              </button>
            </div>
          </form>
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-black text-slate-900">Transfer register</h2>
              <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-600">
                {transfers.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <DataTable className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Transfer</th>
                    <th className="px-5 py-3">Route</th>
                    <th className="px-5 py-3">Lines</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfers.map((item) => {
                    const totalQty = item.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
                    return (
                      <tr key={item._id} className="align-top hover:bg-slate-50">
                        <td className="px-5 py-4 font-mono text-sm font-black text-slate-950">{item.transferNo}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 font-semibold text-slate-700">
                            <span>{item.sourceBranch?.name}</span>
                            <FiArrowRight className="text-slate-300" />
                            <span>{item.destinationBranch?.name}</span>
                          </div>
                          {item.note && <p className="mt-1 text-xs text-slate-400">{item.note}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex max-w-md flex-wrap gap-1.5">
                            {item.lines.slice(0, 3).map((line) => (
                              <span
                                key={line._id}
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
                              >
                                {line.product?.name} x {line.quantity}
                              </span>
                            ))}
                            {item.lines.length > 3 && (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                                +{item.lines.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-lg font-black text-slate-950">
                          {totalQty}
                        </td>
                        <td className="px-5 py-4">
                          <Status value={item.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {item.status === 'DRAFT' && (
                              <button
                                className={`${buttonClass} bg-sky-600 text-white`}
                                onClick={() => approveMut.mutate(item._id)}
                              >
                                <FiCheck /> Approve
                              </button>
                            )}
                            {item.status === 'APPROVED' && (
                              <button
                                className={`${buttonClass} bg-amber-500 text-slate-950`}
                                onClick={() => dispatchMut.mutate(item._id)}
                              >
                                Dispatch
                              </button>
                            )}
                            {item.status === 'IN_TRANSIT' && (
                              <button
                                className={`${buttonClass} bg-emerald-600 text-white`}
                                onClick={() => receiveMut.mutate(item._id)}
                              >
                                Receive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
              {!transfers.length && <p className="py-10 text-center text-sm text-slate-400">No transfers found.</p>}
            </div>
          </div>          <Pagination
            page={transferPage}
            totalPages={transfersQuery.data?.count || 1}
            onPage={setTransferPage}
            total={transfersQuery.data?.total || 0}
            unit="transfers"
            pageSize={transferLimit}
          />
        </div>
      )}

      {tab === 'Barcode lookup' && (
        <div className="mx-auto max-w-2xl rounded-md border border-slate-200 bg-white p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">Scan product barcode</h2>
            <p className="mt-1 text-sm text-slate-500">Every branch uses the current global product price.</p>
          </div>
          <form
            className="grid gap-2 sm:grid-cols-[1fr_190px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              barcodeMut.mutate({ code: barcode, branch: barcodeBranch });
            }}
          >
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                autoFocus
                className={`${inputClass} pl-9 font-mono`}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode"
                required
              />
            </div>
            <select
              className={inputClass}
              value={barcodeBranch}
              onChange={(e) => setBarcodeBranch(e.target.value)}
              required
            >
              <option value="">Choose branch</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button className={`${buttonClass} bg-slate-950 text-white`}>Look up</button>
          </form>
          {barcodeMut.data?.data && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="font-bold text-slate-900">{barcodeMut.data.data.product?.name}</h3>
              <p className="mt-1 font-mono text-xs text-slate-400">#{barcodeMut.data.data.product?.code}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {barcodeMut.data.data.prices.map((price) => (
                  <div key={price.salePrice} className="rounded-md border-2 border-slate-900 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current price</p>
                    <p className="mt-1 text-2xl font-black text-slate-950">à§³{price.salePrice}</p>
                    <p className="mt-2 text-sm text-slate-500">{price.availableQuantity} available</p>
                  </div>
                ))}
              </div>
              {!barcodeMut.data.data.prices.length && (
                <p className="mt-4 rounded-md bg-amber-50 p-4 text-sm text-amber-800">
                  The product exists, but this branch has no available stock.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
