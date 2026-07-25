'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiEye,
  FiPlayCircle,
  FiRefreshCw,
  FiSearch,
  FiSlash,
  FiX,
  FiXCircle
} from 'react-icons/fi';
import { MdOutlineAccountBalanceWallet } from 'react-icons/md';

import * as api from 'src/services';
import { usePermissions } from 'src/context/PermissionsContext';
import DataTable from 'src/components/_admin/ui/DataTable';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDateTime } from 'src/utils/formatTime';

const PAGE_SIZE = 25;
const CLOSED_STATUSES = new Set(['COMPLETED', 'DECLINED', 'CANCELLED']);

const STATUS_META = {
  PENDING: {
    label: 'Pending',
    icon: FiClock,
    className: 'border-amber-200 bg-amber-50 text-amber-800'
  },
  IN_REVIEW: {
    label: 'In review',
    icon: FiEye,
    className: 'border-sky-200 bg-sky-50 text-sky-800'
  },
  COMPLETED: {
    label: 'Completed',
    icon: FiCheckCircle,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800'
  },
  DECLINED: {
    label: 'Declined',
    icon: FiXCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-800'
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: FiSlash,
    className: 'border-slate-200 bg-slate-100 text-slate-700'
  }
};

const ACTION_META = {
  REFUND_REVIEW: {
    label: 'Refund review',
    className: 'border-violet-200 bg-violet-50 text-violet-800'
  },
  FINANCIAL_RECONCILIATION: {
    label: 'Reconciliation',
    className: 'border-indigo-200 bg-indigo-50 text-indigo-800'
  },
  OTHER: {
    label: 'Other',
    className: 'border-slate-200 bg-slate-50 text-slate-700'
  }
};

const DIALOG_META = {
  COMPLETED: {
    title: 'Record manual completion',
    description: 'Use the reference from the external settlement after you have verified it.',
    submitLabel: 'Record completion',
    submitClass: 'bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-600'
  },
  DECLINED: {
    title: 'Decline finance action',
    description: 'Close this action when the evidence does not support the requested finance follow-up.',
    submitLabel: 'Decline action',
    submitClass: 'bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-600'
  },
  CANCELLED: {
    title: 'Cancel finance action',
    description: 'Close this action when the finance follow-up is no longer needed.',
    submitLabel: 'Cancel action',
    submitClass: 'bg-slate-700 text-white hover:bg-slate-800 focus-visible:ring-slate-600'
  }
};

function sentenceCase(value) {
  const normalized = String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Not recorded';
}

function formatAmount(value, currency = 'BDT') {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: String(currency || 'BDT').toUpperCase(),
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${String(currency || 'BDT').toUpperCase()} ${amount.toLocaleString('en-BD')}`;
  }
}

function formatDateTime(value) {
  return value ? fDateTime(value) : 'Not recorded';
}

function personName(value) {
  return value?.name || value?.email || 'System';
}

function errorMessage(error, fallback = 'Something went wrong. Please retry.') {
  return error?.response?.data?.message || error?.message || fallback;
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || {
    label: sentenceCase(status),
    icon: FiAlertCircle,
    className: 'border-slate-200 bg-slate-50 text-slate-700'
  };
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${meta.className}`}
    >
      <Icon aria-hidden="true" size={14} />
      {meta.label}
    </span>
  );
}

function ActionBadge({ actionType }) {
  const meta = ACTION_META[actionType] || ACTION_META.OTHER;
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function OutcomeDialog({ target, status, onClose, onSubmit }) {
  const config = DIALOG_META[status];
  const isCompletion = status === 'COMPLETED';
  const context = target.paymentContext || {};
  const [settledAmount, setSettledAmount] = useState(String(Number(target.suggestedAmount) || 0));
  const [manualReference, setManualReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(target.paymentMethod || context.paymentMethod || '');
  const [adminNote, setAdminNote] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef(null);
  const amountRef = useRef(null);
  const referenceRef = useRef(null);
  const noteRef = useRef(null);
  const submittingRef = useRef(false);

  submittingRef.current = isSubmitting;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      (isCompletion ? amountRef.current : noteRef.current)?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        ) || []
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocus?.focus?.();
    };
  }, [isCompletion, onClose]);

  const submit = async (event) => {
    event.preventDefault();
    const amountText = String(settledAmount).trim();
    const amount = Number(amountText);
    if (isCompletion && (!amountText || !Number.isFinite(amount) || amount < 0)) {
      setAmountError('Enter the actual amount settled, or 0 when no money moved.');
      amountRef.current?.focus();
      return;
    }
    const referenceRequired = isCompletion && amount > 0;
    const reference = manualReference.trim();
    if (referenceRequired && !reference) {
      setFieldError('Enter the external or manual transaction reference before recording completion.');
      referenceRef.current?.focus();
      return;
    }

    setAmountError('');
    setFieldError('');
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        status,
        adminNote: adminNote.trim(),
        ...(isCompletion
          ? {
              manualReference: reference,
              settledAmount: amount,
              ...(paymentMethod.trim() ? { paymentMethod: paymentMethod.trim() } : {})
            }
          : {})
      });
      onClose();
    } catch (error) {
      setSubmitError(errorMessage(error, 'Could not update this finance action.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-outcome-title"
        aria-describedby="finance-outcome-description finance-outcome-warning"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-md border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order #{target.orderNo}</p>
            <h2 id="finance-outcome-title" className="mt-1 text-lg font-bold text-slate-900">
              {config.title}
            </h2>
            <p id="finance-outcome-description" className="mt-1 text-sm leading-6 text-slate-600">
              {config.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close finance action dialog"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiX aria-hidden="true" size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-5">
          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-500">Suggested amount</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                {formatAmount(target.suggestedAmount, target.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Source payment</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {sentenceCase(context.paymentStatus)} ·{' '}
                {context.paymentMethod || target.paymentMethod || 'Method not recorded'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Verified paid amount</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                {formatAmount(context.verifiedPaymentAmount, target.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Wallet credit included</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                {formatAmount(context.walletCreditUsed, target.currency)}
              </p>
            </div>
          </div>

          {target.reason && (
            <div className="rounded-md border border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{target.reason}</p>
            </div>
          )}

          <div
            id="finance-outcome-warning"
            role="note"
            className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950"
          >
            <FiAlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold">This does not send or refund money.</p>
              <p className="mt-1 text-sm leading-6">
                It only records the review outcome in Sidrat. Complete the external transfer first, then record its
                reference here.
              </p>
            </div>
          </div>

          {isCompletion && (
            <>
              <div>
                <label htmlFor="finance-settled-amount" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Actual amount settled <span className="text-rose-700">*</span>
                </label>
                <input
                  ref={amountRef}
                  id="finance-settled-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settledAmount}
                  onChange={(event) => {
                    setSettledAmount(event.target.value);
                    if (amountError) setAmountError('');
                  }}
                  aria-invalid={Boolean(amountError)}
                  aria-describedby={amountError ? 'finance-amount-help finance-amount-error' : 'finance-amount-help'}
                  className={`input-ui !h-11 ${amountError ? '!border-rose-500 !ring-rose-200' : ''}`}
                />
                <p id="finance-amount-help" className="mt-1.5 text-xs leading-5 text-slate-500">
                  Suggested {formatAmount(target.suggestedAmount, target.currency)}. Enter 0 when no money moved.
                </p>
                {amountError && (
                  <p id="finance-amount-error" role="alert" className="mt-1 text-sm font-medium text-rose-700">
                    {amountError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="finance-manual-reference" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  External/manual transaction reference {Number(settledAmount) > 0 && <span className="text-rose-700">*</span>}
                </label>
                <input
                  ref={referenceRef}
                  id="finance-manual-reference"
                  type="text"
                  value={manualReference}
                  onChange={(event) => {
                    setManualReference(event.target.value);
                    if (fieldError) setFieldError('');
                  }}
                  maxLength={500}
                  autoComplete="off"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={
                    fieldError ? 'finance-reference-help finance-reference-error' : 'finance-reference-help'
                  }
                  className={`input-ui !h-11 ${fieldError ? '!border-rose-500 !ring-rose-200' : ''}`}
                />
                <p id="finance-reference-help" className="mt-1.5 text-xs leading-5 text-slate-500">
                  {Number(settledAmount) > 0
                    ? 'Required because the recorded settlement amount is positive.'
                    : 'Optional for a zero-value reconciliation.'}
                </p>
                {fieldError && (
                  <p id="finance-reference-error" role="alert" className="mt-1 text-sm font-medium text-rose-700">
                    {fieldError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="finance-payment-method" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Settlement method <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="finance-payment-method"
                  type="text"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  maxLength={120}
                  placeholder="For example: bank transfer or bKash"
                  className="input-ui !h-11"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="finance-admin-note" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Admin note <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              ref={noteRef}
              id="finance-admin-note"
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Record evidence, reasoning, or follow-up context for other admins."
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 transition placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            />
          </div>

          {submitError && (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
            >
              <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
              <span>{submitError} Check the record and try again.</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Keep open
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${config.submitClass}`}
            >
              {isSubmitting && <FiRefreshCw aria-hidden="true" className="animate-spin" size={17} />}
              {isSubmitting ? 'Saving…' : config.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FinanceReviewList() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can('refund', 'Order');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [rowBusyId, setRowBusyId] = useState('');
  const [dialog, setDialog] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [actionNotice, setActionNotice] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkSummary, setBulkSummary] = useState(null);

  const closeDialog = useCallback(() => setDialog(null), []);
  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(search ? { search } : {})
    }),
    [page, search, status]
  );

  const { data, error, isError, isLoading, isFetching, refetch } = useQuery(
    ['order-finance-actions', page, status, search],
    () => api.getOrderFinanceActionsByAdmin(queryParams),
    { keepPreviousData: true, staleTime: 15_000 }
  );

  const rows = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 0;
  const pendingSelectedCount = selectedRows.filter((row) => row.status === 'PENDING').length;

  const refreshList = useCallback(() => queryClient.invalidateQueries('order-finance-actions'), [queryClient]);

  const startReview = async (row) => {
    if (row.status !== 'PENDING' || rowBusyId || bulkProgress) return;
    setActionNotice(null);
    setRowBusyId(row._id);
    try {
      const response = await api.updateOrderFinanceActionByAdmin({ id: row._id, status: 'IN_REVIEW' });
      setActionNotice({
        tone: 'success',
        text: response?.message || `Order #${row.orderNo} is now in review.`
      });
      setSelectionRevision((value) => value + 1);
      await refreshList();
    } catch (updateError) {
      setActionNotice({ tone: 'error', text: errorMessage(updateError, 'Could not start this review.') });
    } finally {
      setRowBusyId('');
    }
  };

  const submitDialog = async (payload) => {
    const row = dialog?.row;
    if (!row) throw new Error('Finance action is no longer available.');
    const response = await api.updateOrderFinanceActionByAdmin({ id: row._id, ...payload });
    setActionNotice({
      tone: 'success',
      text: response?.message || `Order #${row.orderNo} was updated.`
    });
    setSelectionRevision((value) => value + 1);
    await refreshList();
  };

  const startSelectedReviews = async (selection) => {
    const pendingRows = selection.filter((row) => row.status === 'PENDING');
    const skipped = selection.length - pendingRows.length;
    if (!pendingRows.length) {
      setBulkSummary({ succeeded: 0, skipped, failures: [], message: 'Select at least one pending finance action.' });
      return false;
    }

    const confirmation = await Swal.fire({
      icon: 'question',
      title: `Start ${pendingRows.length} review${pendingRows.length === 1 ? '' : 's'}?`,
      text: `Pending actions will be updated one at a time. This changes workflow status only and does not send money.${skipped ? ` ${skipped} non-pending selection${skipped === 1 ? '' : 's'} will be skipped.` : ''}`,
      showCancelButton: true,
      confirmButtonText: `Start ${pendingRows.length} review${pendingRows.length === 1 ? '' : 's'}`,
      cancelButtonText: 'Keep selection'
    });
    if (!confirmation.isConfirmed) return false;

    setActionNotice(null);
    setBulkSummary(null);
    setBulkProgress({ processed: 0, total: pendingRows.length, currentOrderNo: null });
    const failures = [];
    let succeeded = 0;

    for (let index = 0; index < pendingRows.length; index += 1) {
      const row = pendingRows[index];
      setBulkProgress({ processed: index, total: pendingRows.length, currentOrderNo: row.orderNo });
      try {
        await api.updateOrderFinanceActionByAdmin({ id: row._id, status: 'IN_REVIEW' });
        succeeded += 1;
      } catch (updateError) {
        failures.push({ orderNo: row.orderNo, message: errorMessage(updateError, 'Update failed.') });
      }
      setBulkProgress({ processed: index + 1, total: pendingRows.length, currentOrderNo: row.orderNo });
    }

    await refreshList();
    setBulkProgress(null);
    setBulkSummary({ succeeded, skipped, failures });
    return true;
  };

  const columns = [
    {
      key: 'orderNo',
      label: 'Order / reason',
      exportValue: (row) => row.orderNo,
      render: (row) => (
        <div className="min-w-[220px] max-w-[320px]">
          <Link
            href={`/orders/${row.orderNo}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-[var(--brand-strong)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2"
          >
            #{row.orderNo}
            <FiExternalLink aria-hidden="true" size={13} />
          </Link>
          <p className="text-xs leading-5 text-slate-500">{row.reason || 'No reason recorded'}</p>
        </div>
      )
    },
    {
      key: 'actionType',
      label: 'Action',
      exportValue: (row) => sentenceCase(row.actionType),
      render: (row) => (
        <div className="min-w-[150px] space-y-1.5">
          <ActionBadge actionType={row.actionType} />
          <p className="text-xs text-slate-500">Triggered by {sentenceCase(row.trigger)}</p>
        </div>
      )
    },
    {
      key: 'suggestedAmount',
      label: 'Suggested',
      align: 'right',
      exportValue: (row) => `${row.currency || 'BDT'} ${Number(row.suggestedAmount) || 0}`,
      render: (row) => (
        <div className="min-w-[130px] text-right">
          <p className="whitespace-nowrap font-bold tabular-nums text-slate-900">
            {formatAmount(row.suggestedAmount, row.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{sentenceCase(row.paymentContext?.paymentStatus)}</p>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      key: 'createdAt',
      label: 'Requested',
      exportValue: (row) => `${personName(row.requestedBy)} - ${formatDateTime(row.createdAt)}`,
      render: (row) => (
        <div className="min-w-[155px]">
          <p className="text-sm font-medium text-slate-700">{personName(row.requestedBy)}</p>
          <p className="mt-1 whitespace-nowrap text-xs tabular-nums text-slate-500">{formatDateTime(row.createdAt)}</p>
        </div>
      )
    },
    {
      key: 'manualReference',
      label: 'Resolution',
      exportValue: (row) => [
        row.manualReference,
        row.settledAmount != null ? `Settled ${row.currency || 'BDT'} ${row.settledAmount}` : null,
        row.adminNote
      ].filter(Boolean).join(' - '),
      render: (row) => (
        <div className="min-w-[180px] max-w-[260px]">
          {CLOSED_STATUSES.has(row.status) ? (
            <>
              <p className="break-words font-mono text-xs font-semibold text-slate-700">
                {row.manualReference || 'No transaction reference'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {personName(row.reviewedBy)} · {formatDateTime(row.reviewedAt)}
              </p>
              {row.status === 'COMPLETED' && row.settledAmount != null && (
                <p className="mt-1 text-xs font-semibold tabular-nums text-slate-700">
                  Settled: {formatAmount(row.settledAmount, row.currency)}
                </p>
              )}
              {row.paymentMethod && <p className="mt-1 text-xs text-slate-500">Method: {row.paymentMethod}</p>}
            </>
          ) : (
            <span className="text-xs text-slate-400">Awaiting review outcome</span>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      exportable: false,
      render: (row) => {
        if (!canManage) return <span className="text-xs text-slate-400">View only</span>;
        const busy = Boolean(rowBusyId || bulkProgress);

        if (row.status === 'PENDING') {
          return (
            <div className="flex min-w-[190px] flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => startReview(row)}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-800 transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rowBusyId === row._id ? (
                  <FiRefreshCw aria-hidden="true" className="animate-spin" size={15} />
                ) : (
                  <FiPlayCircle aria-hidden="true" size={15} />
                )}
                {rowBusyId === row._id ? 'Starting…' : 'Start review'}
              </button>
              <button
                type="button"
                onClick={() => setDialog({ row, status: 'CANCELLED' })}
                disabled={busy}
                className="inline-flex min-h-11 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          );
        }

        if (row.status === 'IN_REVIEW') {
          return (
            <div className="flex min-w-[250px] flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog({ row, status: 'COMPLETED' })}
                disabled={busy}
                className="inline-flex min-h-11 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Complete
              </button>
              <button
                type="button"
                onClick={() => setDialog({ row, status: 'DECLINED' })}
                disabled={busy}
                className="inline-flex min-h-11 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => setDialog({ row, status: 'CANCELLED' })}
                disabled={busy}
                className="inline-flex min-h-11 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          );
        }

        return <span className="text-xs font-medium text-slate-400">Closed</span>;
      }
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance Review"
        subtitle={`${total} manual finance action${total === 1 ? '' : 's'} requiring an auditable outcome`}
        icon={MdOutlineAccountBalanceWallet}
      />

      <div
        role="note"
        aria-label="Manual settlement warning"
        className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm"
      >
        <FiAlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={22} />
        <div>
          <p className="font-bold">Recording completion does not send money.</p>
          <p className="mt-1 text-sm leading-6">
            This screen is an audit ledger for finance work completed outside Sidrat. Verify the external transfer or
            refund first, then record its reference.
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
        className="card-ui grid gap-3 p-3 md:grid-cols-[minmax(240px,1fr)_200px_auto] md:items-end"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Search</span>
          <span className="relative block">
            <FiSearch
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Order number or transaction reference"
              className="input-ui !h-11 pl-10"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="select-ui !h-11 w-full"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="btn-brand !h-11 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              setStatus('');
              setPage(1);
            }}
            className="btn-ghost !h-11 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-ghost !h-11 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2"
          >
            <FiRefreshCw aria-hidden="true" className={isFetching ? 'animate-spin' : ''} size={16} />
            Refresh
          </button>
        </div>
      </form>

      {!canManage && (
        <div role="status" className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          You can review these records, but finance workflow changes require the Order refund permission.
        </div>
      )}

      {actionNotice && (
        <div
          role={actionNotice.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${
            actionNotice.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span>{actionNotice.text}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            aria-label="Dismiss message"
          >
            <FiX aria-hidden="true" size={17} />
          </button>
        </div>
      )}

      {bulkProgress && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-violet-950"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
            <span>
              Starting reviews sequentially: {bulkProgress.processed} of {bulkProgress.total}
            </span>
            {bulkProgress.currentOrderNo && (
              <span className="font-mono text-xs">Order #{bulkProgress.currentOrderNo}</span>
            )}
          </div>
          <progress
            className="mt-2 h-2 w-full overflow-hidden rounded-md accent-violet-600"
            max={bulkProgress.total}
            value={bulkProgress.processed}
            aria-label="Bulk review progress"
          />
        </div>
      )}

      {bulkSummary && (
        <div
          role={bulkSummary.failures.length ? 'alert' : 'status'}
          className={`rounded-md border px-4 py-3 text-sm ${
            bulkSummary.failures.length
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{bulkSummary.message || 'Bulk review update finished.'}</p>
              <p className="mt-1">
                {bulkSummary.succeeded} started · {bulkSummary.failures.length} failed · {bulkSummary.skipped} skipped
              </p>
              {bulkSummary.failures.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {bulkSummary.failures.map((failure) => (
                    <li key={`${failure.orderNo}-${failure.message}`}>
                      Order #{failure.orderNo}: {failure.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setBulkSummary(null)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              aria-label="Dismiss bulk result"
            >
              <FiX aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <span>{errorMessage(error, 'Finance actions could not be loaded.')} Check your connection and retry.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-300 bg-white px-4 font-semibold text-rose-800 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            <FiRefreshCw aria-hidden="true" size={16} /> Retry
          </button>
        </div>
      )}

      <div
        aria-busy={isLoading || isFetching || Boolean(bulkProgress)}
        className="[&_button]:!min-h-11 [&_button]:!min-w-11 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-violet-500 [&_button]:focus-visible:ring-offset-2"
      >
        <DataTable
          key={`${status}:${search}:${selectionRevision}`}
          columns={columns}
          data={rows}
          selectable={canManage}
          selectionLabel="finance actions"
          exportFileName="finance-review-selection.csv"
          onSelectionChange={setSelectedRows}
          bulkActions={
            canManage
              ? [
                  {
                    label: `Start review (${pendingSelectedCount} pending)`,
                    icon: FiPlayCircle,
                    loading: Boolean(bulkProgress),
                    disabled: pendingSelectedCount === 0 || Boolean(rowBusyId),
                    onClick: startSelectedReviews
                  }
                ]
              : []
          }
          isLoading={isLoading || isFetching}
          empty={
            <EmptyState
              title="No finance actions found"
              hint={
                status || search
                  ? 'Try clearing the current search or status filter.'
                  : 'New cancellation and return reviews will appear here.'
              }
              icon={MdOutlineAccountBalanceWallet}
            />
          }
          className="min-w-[1180px]"
          footer={
            <Pagination
              page={data?.currentPage || page}
              totalPages={totalPages}
              onPage={setPage}
              total={total}
              unit="finance actions"
              pageSize={PAGE_SIZE}
            />
          }
        />
      </div>

      {dialog && (
        <OutcomeDialog target={dialog.row} status={dialog.status} onClose={closeDialog} onSubmit={submitDialog} />
      )}
    </div>
  );
}
