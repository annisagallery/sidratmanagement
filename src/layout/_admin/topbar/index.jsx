'use client';

import PropTypes from 'prop-types';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { RxHamburgerMenu } from 'react-icons/rx';
import { BsCartPlus } from 'react-icons/bs';
import { MdOutlinePayment, MdQrCodeScanner } from 'react-icons/md';
import { FiTool } from 'react-icons/fi';
import Logo from 'src/components/logo';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import { usePermissions } from 'src/context/PermissionsContext';
import AddPaymentModal from 'src/components/_admin/payments/addPaymentModal';
import NotificationInbox from 'src/components/_admin/notifications/NotificationInbox';
import * as api from 'src/services';

const UserSelect = dynamic(() => import('src/components/select/userSelect'), {
  ssr: false,
  loading: () => <div className="h-10 w-10 animate-pulse rounded-md bg-slate-100" />
});

export default function Topbar({ handleDrawerOpen }) {
  const { siteName } = useSiteSettings();
  // The scan desk moved off the sidebar and onto this bar, so it has to keep
  // the gate it had there — otherwise the move quietly hands it to roles that
  // could not see it before. UX only; the API enforces.
  const { can } = usePermissions();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { data: typesData } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, {
    staleTime: 5 * 60_000
  });

  return (
    <>
      {/* role="banner" is what the print stylesheet keys off to drop the admin
          chrome — without it the topbar prints at the head of every label
          sheet and pushes the whole grid off its die-cut alignment. */}
      <header
        role="banner"
        className="relative z-50 shrink-0 border-b border-slate-200 bg-white shadow-[0_1px_8px_rgba(15,23,42,0.04)]"
      >
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50 md:hidden"
              onClick={handleDrawerOpen}
              aria-label="Open navigation"
            >
              <RxHamburgerMenu />
            </button>
            <Logo />
            {siteName && (
              <>
                <span className="hidden h-6 w-px bg-slate-200 sm:block" />
                <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 sm:block">
                  Management
                </span>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <NotificationInbox />
            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:flex"
              title="Add payment"
            >
              <MdOutlinePayment size={16} />
              <span className="hidden lg:inline">Add Payment</span>
            </button>

            {/* The scan desk is not a page anyone browses to — it is picked up
                mid-task, at a bench, usually with a scanner already in hand. It
                sat in the sidebar next to planning screens nobody on the floor
                opens; here it is one reach away from wherever they are. */}
            {can('read', 'Production') && (
              <Link
                href="/production/scan"
                className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                title="Production scan desk"
              >
                <MdQrCodeScanner size={16} />
                <span className="hidden lg:inline">Scan</span>
              </Link>
            )}

            <Link
              href="/production/create"
              className="flex h-9 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
              title="Create production"
            >
              <FiTool size={15} />
              <span className="hidden lg:inline">Create Production</span>
            </Link>

            <Link
              href="/orders/create"
              className="flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold text-white transition hover:brightness-95"
              style={{ backgroundColor: 'var(--brand)' }}
              title="Create order"
            >
              <BsCartPlus size={16} />
              <span className="hidden sm:inline">Create Order</span>
            </Link>

            <div className="ml-1 border-l border-slate-200 pl-2">
              <UserSelect isAdmin />
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[2px]" style={{ backgroundColor: 'var(--brand)' }} />
      </header>

      {paymentOpen && (
        <AddPaymentModal types={typesData?.data || []} onClose={() => setPaymentOpen(false)} onDone={() => {}} />
      )}
    </>
  );
}

Topbar.propTypes = {
  handleDrawerOpen: PropTypes.func.isRequired
};
