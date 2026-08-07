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
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.css';
import {
  FiAlertTriangle,
  FiEdit2,
  FiMessageCircle,
  FiPackage,
  FiPlayCircle,
  FiShoppingBag
} from 'react-icons/fi';

import * as api from 'src/services';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import { printInvoices, printShippingLabels } from 'src/components/_admin/dispatch/openDocuments';
import ActionBar from 'src/components/_admin/orders/ActionBar';
import HistoryModal from 'src/components/_admin/shared/HistoryModal';
import { useStatuses } from 'src/components/_admin/shared/useStatuses';

import AdminNotes from 'src/components/_admin/orders/detail/AdminNotes';
import ItemsCard from 'src/components/_admin/orders/detail/ItemsCard';
import OrderHeader from 'src/components/_admin/orders/detail/OrderHeader';
import PackDrawer from 'src/components/_admin/orders/detail/PackDrawer';
import PaymentsCard from 'src/components/_admin/orders/detail/PaymentsCard';
import ShipmentsCard from 'src/components/_admin/orders/detail/ShipmentsCard';
import { AddressPanel, BillPanel, CustomerPanel, MetaPanel } from 'src/components/_admin/orders/detail/SidePanels';
import {
  AddPaymentModal,
  ComplaintModal,
  EditDetailsModal,
  ShipModal
} from 'src/components/_admin/orders/detail/modals';
import { Notice, Section, SectionBody, errorAlert, money, oid, toast } from 'src/components/_admin/orders/detail/parts';

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

  const { data, isLoading, refetch } = useQuery(['admin-order', orderNo], () => api.getOrderByAdmin(orderNo), {
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

  const { mutate: updateStatus, mutateAsync: updateStatusAsync, isLoading: updatingStatus } = useMutation(
    (status) => api.updateOrderStatusByAdmin({ orderNo, status }),
    {
      onSuccess: () => {
        refetch();
        refetchShipments();
        toast('Status updated');
      },
      onError: (error) => errorAlert('Could not update status', error)
    }
  );

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

  /* ── handlers ──────────────────────────────────────────────────────────── */

  /**
   * One handler for every act the server offers. SHIP opens the courier modal
   * instead of setting a status, because creating the consignment *is* the act
   * of shipping — the order advances off the back of it.
   */
  async function handleAction(action) {
    setBusyAction(action.action);
    try {
      if (action.action === 'PACK') return await packOrderAsync();
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
  function handleStatusChange(event) {
    const status = event.target.value;
    Swal.fire({
      title: 'Change status?',
      text: `This order will move to "${status}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, change it'
    }).then((result) => {
      if (result.isConfirmed) updateStatus(status);
    });
  }

  function handleRemovePayment(paymentId) {
    Swal.fire({
      title: 'Remove this payment?',
      text: 'The payment is unlinked from the order and the balance goes back up.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#e11d48'
    }).then((result) => {
      if (result.isConfirmed) removePayment(paymentId);
    });
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

  function afterShipmentSent() {
    setModal(null);
    refetchShipments();
    if (!CLOSED_STATUSES.includes(order.status)) {
      Swal.fire({
        title: 'Mark the order as shipped?',
        text: 'The parcel has been handed to the courier.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, mark shipped'
      }).then((result) => {
        if (result.isConfirmed) updateStatus('shipped');
      });
    }
  }

  /* ── render ────────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-md bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-md bg-slate-100 lg:col-span-2" />
          <div className="h-64 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="card-ui p-16 text-center">
        <p className="text-sm font-semibold text-rose-600">Order #{orderNo} was not found.</p>
        <button type="button" onClick={() => router.push('/orders')} className="btn-ghost mt-4">
          Back to orders
        </button>
      </div>
    );
  }

  const paid = (order.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const due = Math.max(0, Math.round((order.total || 0) - paid));
  const activeShipment = shipments.find((shipment) => shipment.isActive) || null;
  const packing = order.packingProgress || { total: 0, verified: 0, remaining: 0 };
  const packingLeft = Math.max(0, packing.total - packing.verified);
  const canPackHere = ['confirmed', 'ready-to-pack'].includes(order.status);
  const blockedActions = (order.availableActions || []).filter((action) => !action.enabled && action.blockedBy);

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
    if (order.status === 'delivered') values.add('returned');
    return active.filter((entry) => values.has(entry.value));
  })();

  return (
    <div className="space-y-4 pb-12">
      <OrderHeader
        order={order}
        orderStatuses={orderStatuses}
        activeShipment={activeShipment}
        paid={paid}
        due={due}
        packing={packing}
        onBack={() => router.push('/orders')}
        onPrev={() => order.previousOrder && router.push(`/orders/${order.previousOrder}`)}
        onNext={() => order.nextOrder && router.push(`/orders/${order.nextOrder}`)}
        onPrint={() =>
          printInvoices([{ orderNo }], settings).catch((error) => errorAlert('The invoice could not be built', error))
        }
        onPrintLabel={() =>
          printShippingLabels([{ orderNo }], settings).catch((error) =>
            errorAlert('The label could not be built', error)
          )
        }
        onHistory={() => setModal('history')}
      />

      {/* Things that need a decision, stated plainly and never hidden. */}
      {order.status === 'cancelled' || order.status === 'returned' ? (
        <Notice tone="bad" icon={FiAlertTriangle} title={`This order was ${order.status}.`}>
          Reserved stock has been released. Any refund is handled in Finance review.
        </Notice>
      ) : null}

      {canPackHere && packingLeft > 0 ? (
        <Notice
          tone="info"
          icon={FiPackage}
          title={`${packingLeft} of ${packing.total} pieces still to scan`}
          action={
            <button type="button" onClick={() => setModal('pack')} className="btn-brand h-9 !text-xs">
              <FiPlayCircle size={14} /> Scan pieces
            </button>
          }
        >
          The scan panel opens beside this order — you do not lose your place.
        </Notice>
      ) : null}

      {due > 0 && COMPLETED_STATUSES.includes(order.status) ? (
        <Notice tone="warn" icon={FiAlertTriangle} title={`${money(due)} is still unpaid on a delivered order.`}>
          Record the collected amount under Payments, or raise it in Finance review.
        </Notice>
      ) : null}

      {order.note ? (
        <Notice tone="warn" icon={FiMessageCircle} title="Customer note">
          {order.note}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Reference column. First in the DOM so it leads on a phone, where the
            next step matters more than the item list. */}
        <aside className="space-y-4 lg:order-2">
          <Section title="Next step" icon={FiPlayCircle}>
            <SectionBody className="space-y-2 p-4">
              {order.availableActions ? (
                <ActionBar actions={order.availableActions} onAction={handleAction} busyAction={busyAction} />
              ) : (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Order status</span>
                  <select
                    value={order.status}
                    onChange={handleStatusChange}
                    disabled={updatingStatus}
                    className="select-ui h-10 w-full font-semibold"
                  >
                    {visibleStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {canPackHere ? (
                <button
                  type="button"
                  onClick={() => setModal('pack')}
                  className="btn-ghost w-full !border-sky-200 !bg-sky-50 !text-sky-700 hover:!bg-sky-100"
                >
                  <FiPackage size={15} /> Scan &amp; pack
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => router.push(`/orders/${orderNo}/edit`)}
                className="btn-ghost w-full"
              >
                <FiShoppingBag size={15} /> Add / remove products
              </button>

              <button type="button" onClick={() => setModal('details')} className="btn-ghost w-full">
                <FiEdit2 size={15} /> Edit details &amp; address
              </button>

              {blockedActions.length ? (
                <ul className="space-y-1 pt-1">
                  {blockedActions.map((action) => (
                    <li key={action.action} className="text-[11px] leading-snug text-slate-500">
                      <span className="font-semibold text-slate-600">{action.label}:</span> {action.blockedBy}
                    </li>
                  ))}
                </ul>
              ) : null}
            </SectionBody>
          </Section>

          <CustomerPanel order={order} />
          <AddressPanel order={order} onEdit={() => setModal('details')} />
          <BillPanel order={order} paid={paid} due={due} />
          <MetaPanel order={order} />
        </aside>

        <div className="space-y-4 lg:order-1 lg:col-span-2">
          <ItemsCard
            order={order}
            onComplain={setComplaintItem}
            canComplain={COMPLETED_STATUSES.includes(order.status)}
          />

          <PaymentsCard
            payments={order.payments}
            total={order.total}
            paid={paid}
            due={due}
            onAdd={() => setModal('payment')}
            onRemove={handleRemovePayment}
          />

          <ShipmentsCard
            shipments={shipments}
            meta={shipMeta}
            onSend={() => setModal('ship')}
            onRefresh={refreshShipment}
            refreshingId={refreshingShipment}
            sendLabel={shipMeta.isResend ? 'Re-send parcel' : 'Send parcel'}
          />

          <AdminNotes orderNo={orderNo} comments={order.adminComments} onPosted={refetch} />
        </div>
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
