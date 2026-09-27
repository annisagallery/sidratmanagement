'use client';

/**
 * Order detail — the order desk.
 *
 * This screen answers "what is going on with this order" and lets a CS agent or
 * manager act on the exceptions. It is deliberately *not* a station: scanning
 * pieces into a parcel happens at /orders/[orderNo]/pack, on a screen built for
 * someone holding a barcode gun.
 *
 * Layout is fixed so it can be learned once: vital signs across the top, the
 * order's contents down the middle, and an unchanging reference column on the
 * right — who, where, how much, on what terms.
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'react-query';
import { alertWarning, confirmAction } from 'src/utils/swal';
import { FiAlertTriangle, FiClock, FiCornerDownLeft, FiEdit2, FiFileText, FiShoppingBag, FiTag, FiXCircle } from 'react-icons/fi';

import * as api from 'src/services';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import { printInvoices, printShippingLabels } from 'src/components/_admin/dispatch/openDocuments';
import HistoryModal from 'src/components/_admin/shared/HistoryModal';
import { useStatuses } from 'src/components/_admin/shared/useStatuses';

import AdminNotes from 'src/components/_admin/orders/detail/AdminNotes';
import ItemsCard from 'src/components/_admin/orders/detail/ItemsCard';
import NextStep from 'src/components/_admin/orders/detail/NextStep';
import OrderHeader from 'src/components/_admin/orders/detail/OrderHeader';
import PackDrawer from 'src/components/_admin/orders/detail/PackDrawer';
import PaymentsCard from 'src/components/_admin/orders/detail/PaymentsCard';
import ReturnReceiptCard, { pendingReturnItems } from 'src/components/_admin/orders/detail/ReturnReceiptCard';
import ReturnItemsModal from 'src/components/_admin/orders/detail/ReturnItemsModal';
import ShipmentsCard from 'src/components/_admin/orders/detail/ShipmentsCard';
import { CustomerPanel, MetaPanel, NotePanel } from 'src/components/_admin/orders/detail/SidePanels';
import {
  AddPaymentModal,
  ComplaintModal,
  EditDetailsModal,
  ShipModal
} from 'src/components/_admin/orders/detail/modals';
import { Notice, errorAlert, money, oid, toast } from 'src/components/_admin/orders/detail/parts';
import { ErrorState } from 'src/components/_admin/ui/TableStates';

/** Only a finished order can carry a customer complaint about what arrived. */
const COMPLETED_STATUSES = ['delivered', 'completed'];
const CLOSED_STATUSES = ['shipped', 'delivered', 'returned', 'cancelled'];

/** What the server calls each act, and the status it lands on. */
const ACTION_STATUS = { CONFIRM: 'confirmed', DELIVER: 'delivered', CANCEL: 'cancelled', RETURN: 'returned' };

export default function OrderDetail({ params }) {
  const { orderNo } = use(params);
  const router = useRouter();
  const settings = useSiteSettings();

  const { statuses: orderStatuses } = useStatuses('order');

  const { data, isLoading, isError, error, refetch } = useQuery(['admin-order', orderNo], () => api.getOrderByAdmin(orderNo), {
    refetchOnWindowFocus: false
  });
  const order = data?.data;

  const { data: shipmentsData, refetch: refetchShipments } = useQuery(
    ['order-shipments', orderNo],
    () => api.getOrderShipments(orderNo),
    { refetchOnWindowFocus: false }
  );
  const shipments = shipmentsData?.data || [];
  const shipMeta = shipmentsData?.meta || { canSend: false, isResend: false, suggestedCod: 0 };

  const [busyAction, setBusyAction] = useState(null);
  const [refreshingShipment, setRefreshingShipment] = useState(null);
  const [modal, setModal] = useState(null); // 'payment' | 'details' | 'ship' | 'history' | 'pack'
  const [complaintItem, setComplaintItem] = useState(null);

  // Walking the queue with the arrow keys is how this screen is used all day.
  useEffect(() => {
    const onKey = (event) => {
      if (!order || event.target?.closest?.('input, textarea, select')) return;
      if (event.key === 'ArrowLeft' && order.previousOrder) router.push(`/orders/${order.previousOrder}`);
      if (event.key === 'ArrowRight' && order.nextOrder) router.push(`/orders/${order.nextOrder}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, router]);

  /* ── mutations ─────────────────────────────────────────────────────────── */

  const {
    mutate: updateStatus,
    mutateAsync: updateStatusAsync,
    isLoading: updatingStatus
  } = useMutation((status) => api.updateOrderStatusByAdmin({ orderNo, status }), {
    onSuccess: () => {
      refetch();
      refetchShipments();
      toast('Status updated');
    },
    onError: (error) => errorAlert('Could not update status', error)
  });

  const { mutateAsync: packOrderAsync } = useMutation(() => api.packOrderByAdmin(orderNo), {
    onSuccess: () => {
      refetch();
      refetchShipments();
      toast('Order packed');
    },
    onError: (error) => errorAlert('Cannot pack this order', error, 'Not every piece is ready.')
  });

  const { mutate: removePayment } = useMutation((paymentId) => api.removeOrderPayment({ orderNo, paymentId }), {
    onSuccess: () => {
      refetch();
      toast('Payment removed');
    },
    onError: (error) => errorAlert('Could not remove payment', error)
  });

  const { mutate: verifyPayment } = useMutation(
    ({ paymentId, status }) => api.verifyOrderPayment({ orderNo, paymentId, status }),
    {
      onSuccess: (_, { status }) => {
        refetch();
        toast(status === 'verified' ? 'Payment verified' : 'Payment rejected');
      },
      onError: (error) => errorAlert('Could not update the payment', error)
    }
  );

  /* ── handlers ──────────────────────────────────────────────────────────── */

  /**
   * One handler for every act the server offers. SHIP opens the courier modal
   * instead of setting a status, because creating the consignment *is* the act
   * of shipping — the order advances off the back of it.
   */
  async function handleAction(action) {
    // Destructiveness is the server's call: if it sent `confirm` text, ask
    // with exactly that wording before doing anything.
    if (action.confirm) {
      const confirmed = await confirmAction({
        tone: action.intent === 'danger' ? 'danger' : 'warning',
        title: `${action.label}?`,
        text: action.confirm,
        confirmText: action.label
      });
      if (!confirmed) return undefined;
    }
    setBusyAction(action.action);
    try {
      if (action.action === 'PACK') {
        // Pack is one button: with pieces still to scan it opens the packing
        // panel (which finishes with "Mark as packed"); once everything is
        // scanned it packs straight away.
        const progress = order?.packingProgress;
        if (progress?.total && (progress.verified || 0) < progress.total) return setModal('pack');
        return await packOrderAsync();
      }
      if (action.action === 'SHIP') return setModal('ship');
      return await updateStatusAsync(ACTION_STATUS[action.action]);
    } catch (error) {
      errorAlert(action.label, error);
      return undefined;
    } finally {
      setBusyAction(null);
    }
  }

  // The select stays bound to the order's real status, so declining the
  // confirmation leaves the control showing the truth with no reset to do.
  async function handleStatusChange(event) {
    const status = event.target.value;
    const label = orderStatuses.find((entry) => entry.value === status)?.label || status;
    const confirmed = await confirmAction({
      tone: 'warning',
      title: 'Change the order status?',
      text: `Order #${orderNo} will move to “${label}”. The customer may be notified.`,
      confirmText: 'Change status'
    });
    if (confirmed) updateStatus(status);
  }

  async function handleRemovePayment(paymentId) {
    const confirmed = await confirmAction({
      tone: 'danger',
      glyph: 'danger',
      title: 'Remove this payment?',
      text: 'The payment is unlinked from the order and the balance due goes back up.',
      confirmText: 'Remove payment'
    });
    if (confirmed) removePayment(paymentId);
  }

  async function refreshShipment(id) {
    setRefreshingShipment(id);
    try {
      await api.refreshShipmentStatus(id);
      await refetchShipments();
      toast('Status refreshed from the courier');
    } catch (error) {
      errorAlert('Could not reach the courier', error);
    } finally {
      setRefreshingShipment(null);
    }
  }

  // Creating the consignment ships the order on the server. If that step
  // failed the consignment still stands, so say why instead of asking again.
  function afterShipmentSent(response) {
    setModal(null);
    refetch();
    refetchShipments();
    const advanceError = response?.meta?.orderAdvanceError;
    if (advanceError) alertWarning('Parcel booked, but the order is not marked shipped', advanceError);
  }

  /* ── render ────────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="card-ui space-y-4 p-5">
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-4 w-80 max-w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="card-ui h-72 animate-pulse" />
          <div className="card-ui h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  // A failed request is not a missing order — say which it is.
  if (isError && !order) {
    return <ErrorState error={error} title={`Order #${orderNo} could not be loaded`} onRetry={refetch} />;
  }

  if (!order) {
    return (
      <div className="card-ui flex flex-col items-center px-6 py-16 text-center">
        <p className="text-sm font-semibold text-slate-900">Order #{orderNo} doesn’t exist</p>
        <p className="mt-1 text-[13px] text-slate-500">It may have been deleted, or the number is wrong.</p>
        <button type="button" onClick={() => router.push('/orders')} className="btn-ghost mt-5">
          Back to orders
        </button>
      </div>
    );
  }

  // Only verified money counts — the same rule the server uses for payment status.
  const paid = (order.payments || [])
    .filter((payment) => payment.status === 'verified')
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const returnPending = pendingReturnItems(order).length > 0;
  // Cash a courier collected on delivery, not yet paid out to us.
  const codAwaiting = (order.payments || [])
    .filter((payment) => payment.method === 'cod' && payment.status === 'pending')
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const canReturnItems = ['shipped', 'delivered'].includes(order.status);
  const due = Math.max(0, Math.round((order.total || 0) - paid));
  const activeShipment = shipments.find((shipment) => shipment.isActive) || null;
  const packing = order.packingProgress || { total: 0, verified: 0, remaining: 0 };
  const canPackHere = ['confirmed', 'ready-to-pack'].includes(order.status);

  /**
   * Fallback for API builds that predate `availableActions`: the statuses an
   * operator may legally pick from here, which is the current one, the next
   * one, and the ways out.
   */
  const visibleStatuses = (() => {
    const active = orderStatuses.filter(
      (entry) => entry.isActive !== false && (entry.value !== 'processing' || entry.value === order.status)
    );
    const values = new Set([order.status]);
    const next = active[active.findIndex((entry) => entry.value === order.status) + 1];
    if (next && next.value !== 'packed') values.add(next.value);
    if (!CLOSED_STATUSES.includes(order.status)) values.add('cancelled');
    if (['shipped', 'delivered'].includes(order.status)) values.add('returned');
    return active.filter((entry) => values.has(entry.value));
  })();

  const serverActions = order.availableActions || null;
  // The next steps go in the bar; the ways out (cancel, return) go in the menu.
  const piecesLeft = packing.total > 0 && (packing.verified || 0) < packing.total;
  const forwardActions = (serverActions || [])
    .filter((action) => action.intent !== 'danger')
    // The server holds Pack back until every piece is scanned; here Pack is
    // how scanning starts, so it stays pressable while pieces are left.
    .map((action) =>
      action.action === 'PACK' && canPackHere && piecesLeft ? { ...action, enabled: true, blockedBy: undefined } : action
    );
  // Older API builds send no actions: still offer Pack where it applies.
  if (!serverActions && canPackHere && packing.total > 0) {
    forwardActions.push({ action: 'PACK', label: 'Pack', enabled: true, intent: 'primary' });
  }
  const exitActions = (serverActions || []).filter((action) => action.intent === 'danger');

  const printItems = [
    {
      label: 'Invoice',
      icon: FiFileText,
      onClick: () => printInvoices([{ orderNo }], settings).catch((error) => errorAlert('The invoice could not be built', error))
    },
    {
      label: 'Shipping label',
      icon: FiTag,
      onClick: () =>
        printShippingLabels([{ orderNo }], settings).catch((error) => errorAlert('The label could not be built', error))
    }
  ];

  const moreItems = [
    { label: 'Edit products', icon: FiShoppingBag, onClick: () => router.push(`/orders/${orderNo}/edit`) },
    { label: 'Edit details and address', icon: FiEdit2, onClick: () => setModal('details') },
    canReturnItems && {
      label: order.status === 'shipped' ? 'Partial delivery or return…' : 'Return items…',
      icon: FiCornerDownLeft,
      onClick: () => setModal('return-items')
    },
    { label: 'History', icon: FiClock, onClick: () => setModal('history') },
    ...exitActions.map((action, index) => ({
      label: action.enabled ? `${action.label}…` : `${action.label} — ${action.blockedBy || 'not available'}`,
      icon: FiXCircle,
      tone: 'danger',
      disabled: !action.enabled || Boolean(busyAction),
      separator: index === 0,
      onClick: () => handleAction(action)
    }))
  ].filter(Boolean);

  // Older API builds have no `availableActions`: fall back to a status picker.
  const statusPicker = serverActions ? null : (
    <label className="flex items-center gap-2">
      <span className="text-[13px] text-slate-600">Status</span>
      <select value={order.status} onChange={handleStatusChange} disabled={updatingStatus} className="select-ui">
        {visibleStatuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6 pb-12">
      <OrderHeader
        order={order}
        orderStatuses={orderStatuses}
        activeShipment={activeShipment}
        paid={paid}
        due={due}
        onPrev={() => order.previousOrder && router.push(`/orders/${order.previousOrder}`)}
        onNext={() => order.nextOrder && router.push(`/orders/${order.nextOrder}`)}
        printItems={printItems}
        moreItems={moreItems}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <NextStep
            order={order}
            packing={packing}
            activeShipment={activeShipment}
            actions={forwardActions}
            busyAction={busyAction}
            onAction={handleAction}
            fallback={statusPicker}
          />

          {/* The one exception worth a banner: money missing on a finished order. */}
          {due > 0 && codAwaiting === 0 && COMPLETED_STATUSES.includes(order.status) ? (
            <Notice tone="warn" icon={FiAlertTriangle} title={`${money(due)} unpaid on a delivered order`} />
          ) : null}

          {order.status === 'returned' && returnPending ? (
            <ReturnReceiptCard key={order.updatedAt} order={order} orderNo={orderNo} onReceived={refetch} />
          ) : null}

          <ItemsCard
            order={order}
            packing={packing}
            onEdit={() => router.push(`/orders/${orderNo}/edit`)}
            onComplain={setComplaintItem}
            canComplain={COMPLETED_STATUSES.includes(order.status)}
          />

          <PaymentsCard
            order={order}
            payments={order.payments}
            total={order.total}
            paid={paid}
            due={due}
            onAdd={() => setModal('payment')}
            onRemove={handleRemovePayment}
            onVerify={(paymentId, status) => verifyPayment({ paymentId, status })}
          />

          <ShipmentsCard
            shipments={shipments}
            meta={shipMeta}
            onSend={() => setModal('ship')}
            onRefresh={refreshShipment}
            refreshingId={refreshingShipment}
            sendLabel={shipMeta.isResend ? 'Send again' : 'Send parcel'}
          />

          <AdminNotes orderNo={orderNo} comments={order.adminComments} onPosted={refetch} />
        </div>

        {/* Reference only: who, where, on what terms. */}
        <aside className="space-y-6" aria-label="Customer and order details">
          <NotePanel note={order.note} />
          <CustomerPanel order={order} onEdit={() => setModal('details')} />
          <MetaPanel order={order} />
        </aside>
      </div>

      {/* ── panels & modals ──────────────────────────────────────────────── */}
      {modal === 'pack' ? (
        <PackDrawer
          order={order}
          orderNo={orderNo}
          onClose={() => setModal(null)}
          onChanged={async () => {
            await refetch();
            refetchShipments();
          }}
        />
      ) : null}

      {modal === 'return-items' ? (
        <ReturnItemsModal
          order={order}
          orderNo={orderNo}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            refetch();
            refetchShipments();
          }}
        />
      ) : null}

      {modal === 'history' ? (
        <HistoryModal
          title={`Order #${order.orderNo} history`}
          model="Order"
          docId={oid(order)}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal === 'payment' ? (
        <AddPaymentModal
          orderNo={orderNo}
          due={due}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refetch();
          }}
        />
      ) : null}

      {modal === 'details' ? (
        <EditDetailsModal
          order={order}
          orderNo={orderNo}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refetch();
          }}
        />
      ) : null}

      {modal === 'ship' ? (
        <ShipModal
          orderNo={orderNo}
          order={order}
          meta={shipMeta}
          isResend={shipMeta.isResend}
          onClose={() => setModal(null)}
          onSent={afterShipmentSent}
        />
      ) : null}

      {complaintItem ? (
        <ComplaintModal
          item={complaintItem}
          order={order}
          onClose={() => setComplaintItem(null)}
          onSubmitted={() => {
            setComplaintItem(null);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}
