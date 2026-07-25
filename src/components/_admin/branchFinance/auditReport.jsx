'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { FiBarChart2 } from 'react-icons/fi';

import * as api from 'src/services';
import { fCurrency, fNumber } from 'src/utils/formatNumber';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import BranchSelect from './BranchSelect';

const ENTRY_LABELS = {
  SALE: 'Cash sales',
  SALE_CHANGE: 'Change returned',
  RETURN_REFUND: 'Return refunds',
  EXCHANGE_SETTLEMENT: 'Exchange settlements',
  EXCHANGE_REFUND: 'Exchange refunds',
  EXPENSE: 'Expenses',
  EXPENSE_REVERSAL: 'Expense reversals',
  DEPOSIT_TO_HQ: 'Deposits to head office',
  ADJUSTMENT_IN: 'Cash in / adjustments',
  ADJUSTMENT_OUT: 'Adjustments out',
  OPENING: 'Opening entries'
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function StatCard({ label, value, hint }) {
  return (
    <div className="card-ui p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-slate-400">{hint}</p>}
    </div>
  );
}

function SectionTable({ title, rows, columns, footer }) {
  return (
    <div className="card-ui overflow-hidden">
      <h3 className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing this month.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((col, j) => (
                    <td key={j} className={`px-4 py-2 text-[13px] ${j === 0 ? 'text-slate-700' : 'text-right tabular-nums text-slate-700'}`}>
                      {col(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot className="border-t border-slate-200 bg-slate-50/60">
                <tr>
                  {footer.map((cell, i) => (
                    <td key={i} className={`px-4 py-2 text-[13px] font-bold ${i === 0 ? 'text-slate-500' : 'text-right tabular-nums text-slate-900'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

export default function AuditReport() {
  const [branchId, setBranchId] = useState('');
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading } = useQuery(
    ['admin-branch-audit', branchId, month],
    () => api.getBranchAuditReportByAdmin({ branch: branchId, month }),
    { enabled: Boolean(branchId), keepPreviousData: true }
  );
  const report = data?.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Branch Audit Report"
        subtitle={report ? `${report.branch?.name} · ${report.month}` : 'Monthly sales, expenses and cash per branch'}
        icon={FiBarChart2}
      >
        <BranchSelect value={branchId} onChange={setBranchId} />
        <input
          type="month"
          className="input-ui"
          value={month}
          max={currentMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
      </PageHeader>

      {!branchId && <div className="card-ui p-10 text-center text-sm text-slate-400">Select a branch to build its monthly audit report.</div>}
      {branchId && isLoading && !report && <p className="p-8 text-center text-sm text-slate-400">Loading…</p>}

      {branchId && report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Sales" value={fCurrency(report.sales.total)} hint={`${fNumber(report.sales.count)} sales · VAT ${fCurrency(report.sales.vat)}`} />
            <StatCard label="Expenses" value={fCurrency(report.expenses.total)} hint={report.expenses.pendingCount ? `${fCurrency(report.expenses.pendingTotal)} awaiting review` : 'All reviewed'} />
            <StatCard label="Refunded" value={fCurrency(report.returns.returnRefundTotal)} hint={`${fNumber(report.returns.returnCount)} returns · ${fNumber(report.returns.exchangeCount)} exchanges`} />
            <StatCard label="Closing cash" value={fCurrency(report.cash.closing)} hint={`Live drawer: ${fCurrency(report.cash.liveBalance)}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionTable
              title="Collections by payment method"
              rows={report.collectionsByMethod}
              columns={[(row) => row.name, (row) => `${fNumber(row.count)}×`, (row) => fCurrency(row.amount)]}
              footer={['Total', '', fCurrency(report.collectionsByMethod.reduce((sum, row) => sum + row.amount, 0))]}
            />
            <SectionTable
              title="Expenses by type"
              rows={report.expenses.byType}
              columns={[(row) => row.typeName, (row) => `${fNumber(row.count)}×`, (row) => fCurrency(row.amount)]}
              footer={['Total', '', fCurrency(report.expenses.total)]}
            />
          </div>

          <SectionTable
            title="Cash drawer summary"
            rows={[
              { label: 'Opening balance', amount: report.cash.opening },
              ...report.cash.byType.map((row) => ({ label: ENTRY_LABELS[row.type] || row.type, amount: row.amount, count: row.count }))
            ]}
            columns={[
              (row) => row.label,
              (row) => (row.count ? `${fNumber(row.count)}×` : ''),
              (row) => (
                <span className={row.amount < 0 ? 'text-red-500' : row.amount > 0 ? 'text-emerald-600' : ''}>
                  {row.amount < 0 ? '−' : ''}{fCurrency(Math.abs(row.amount))}
                </span>
              )
            ]}
            footer={['Closing balance', '', fCurrency(report.cash.closing)]}
          />

          <div className="card-ui p-4 text-sm text-slate-500">
            <p>
              Exchanges settled in cash brought in <b>{fCurrency(report.returns.exchangeCustomerPaid)}</b>; cash handed back on
              returns/exchanges totalled <b>{fCurrency(report.returns.cashRefundOut)}</b>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
