'use client';

import PropTypes from 'prop-types';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import { MdClose, MdLogout, MdMenu, MdOutlineDashboard, MdOutlinePayment, MdQrCodeScanner } from 'react-icons/md';
import { BsCartPlus } from 'react-icons/bs';
import { FiTool } from 'react-icons/fi';

import { navGroups, navItemFor } from './navConfig';
import * as api from 'src/services';
import useAdminUserStore from 'src/stores/userStore';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import { usePermissions } from 'src/context/PermissionsContext';
import { isSuperAdmin } from 'src/utils/adminRole';
import { confirmAction } from 'src/utils/swal';
import PageTabs from 'src/components/_admin/ui/PageTabs';
import AddPaymentModal from 'src/components/_admin/payments/addPaymentModal';
import NotificationInbox from 'src/components/_admin/notifications/NotificationInbox';
import DeviceStatusIndicator from 'src/components/_admin/payments/deviceStatusIndicator';

function BrandMark({ siteName, logo, logoType }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3 rounded-md">
      {logo ? (
        <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
          <img src={logo} alt="" className={`h-full w-full ${logoType === 'round' ? 'object-cover' : 'object-contain'}`} />
        </span>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
          <MdOutlineDashboard size={20} aria-hidden />
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-slate-900">{siteName || 'Sidrat'}</span>
        <span className="block text-xs text-slate-500">Management</span>
      </span>
    </Link>
  );
}

/** Sidebar groups, filtered by what the role can read. UX only — the API enforces. */
function useVisibleGroups() {
  const { can } = usePermissions();
  const { user } = useAdminUserStore();
  // `subject` may be an array when one entry groups pages with different
  // gates — the item shows if the role can read ANY of them, and PageTabs
  // then hides the individual tabs the role cannot reach.
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.superAdminOnly || isSuperAdmin(user)) &&
          (!item.subject || [].concat(item.subject).some((subject) => can(item.action || 'read', subject)))
      )
    }))
    .filter((group) => group.items.length > 0);
}

function NavList({ groups, activeKey, onNavigate }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`nav-${group.key}`}>
          <h2 id={`nav-${group.key}`} className="section-label mb-1 px-3">
            {group.label}
          </h2>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = activeKey === item.key;
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                      active
                        ? 'bg-[var(--brand-soft)] font-semibold text-slate-900'
                        : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[var(--brand)]" aria-hidden />}
                    <Icon size={18} aria-hidden className={`shrink-0 ${active ? 'text-[var(--brand-strong)]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                    {item.key === 'collector-devices' && <DeviceStatusIndicator />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AccountMenu() {
  const { user } = useAdminUserStore();
  const logout = useAdminUserStore((s) => s.logout);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => !ref.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials = String(user?.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const onLogout = async () => {
    setOpen(false);
    const confirmed = await confirmAction({
      title: 'Log out of Management?',
      text: 'You will need to sign in again to come back.',
      confirmText: 'Log out'
    });
    if (!confirmed) return;
    await api.logout().catch(() => null);
    logout();
    router.push('/auth/login');
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200" aria-hidden>
          {initials}
        </span>
        <span className="hidden min-w-0 text-left leading-tight xl:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium text-slate-900">{user?.name}</span>
          {user?.role && <span className="block text-xs capitalize text-slate-500">{String(user.role).replace(/_/g, ' ')}</span>}
        </span>
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-[90] w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            {user?.email && <p className="truncate text-[13px] text-slate-500">{user.email}</p>}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <MdLogout size={17} aria-hidden className="text-slate-400" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Topbar({ onMenu, brand }) {
  const pathname = usePathname();
  const { can } = usePermissions();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { data: typesData } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, { staleTime: 5 * 60_000 });
  return (
    <>
      {/* role="banner" is what the print stylesheet keys off to drop the admin
          chrome — without it the top bar prints at the head of every label
          sheet and pushes the whole grid off its die-cut alignment. */}
      <header role="banner" className="relative z-40 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
        <button type="button" className="btn-icon -ml-2 lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <MdMenu size={22} />
        </button>
        <div className="min-w-0 lg:hidden">{brand}</div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NotificationInbox />
          <button
            type="button"
            onClick={() => setPaymentOpen(true)}
            className="btn-ghost btn-sm hidden sm:inline-flex"
            title="Add payment"
          >
            <MdOutlinePayment size={16} aria-hidden />
            <span className="hidden xl:inline">Add payment</span>
            <span className="sr-only xl:hidden">Add payment</span>
          </button>

          {/* Like POS, the scan desk opens in its own tab and stays clear of
              admin navigation while an operator works at the bench. The gate
              matches what the sidebar entry had before it moved here. */}
          {can('read', 'Production') && (
            <button
              type="button"
              onClick={() => window.open('/production/scan', '_blank', 'noopener')}
              className="btn-ghost btn-sm"
              title="Open the production scan desk in a new tab"
            >
              <MdQrCodeScanner size={16} aria-hidden />
              <span className="hidden xl:inline">Scan</span>
              <span className="sr-only xl:hidden">Scan desk</span>
            </button>
          )}

          <Link href="/production/create" className="btn-ghost btn-sm" title="Create production">
            <FiTool size={15} aria-hidden />
            <span className="hidden xl:inline">Create production</span>
            <span className="sr-only xl:hidden">Create production</span>
          </Link>

          <Link href="/orders/create" target="_blank" rel="noopener" className="btn-brand btn-sm" title="Create order — opens the order desk in a new tab">
            <BsCartPlus size={15} aria-hidden />
            <span className="hidden sm:inline">Create order</span>
            <span className="sr-only sm:hidden">Create order</span>
          </Link>

          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
          <AccountMenu />
        </div>
      </header>

      {paymentOpen && (
        <AddPaymentModal types={typesData?.data || []} onClose={() => setPaymentOpen(false)} onDone={() => {}} />
      )}
    </>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const { siteName, logo, logoType, primaryColor } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);
  const groups = useVisibleGroups();
  const here = useMemo(() => navItemFor(pathname || '/'), [pathname]);
  const activeKey = here?.key;

  // Dialogs render outside .admin-root, so the brand colour also lives on
  // <html> where they can read it.
  useEffect(() => {
    if (primaryColor) document.documentElement.style.setProperty('--brand', primaryColor);
  }, [primaryColor]);

  // Close the phone drawer on navigation and on Escape; move focus into it.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    drawerRef.current?.querySelector('a,button')?.focus();
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  const brand = <BrandMark siteName={siteName} logo={logo} logoType={logoType} />;

  return (
    <div
      className="admin-root relative flex h-screen min-h-0 overflow-hidden bg-[var(--canvas)]"
      style={primaryColor ? { '--brand': primaryColor } : undefined}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-5">{brand}</div>
        <nav className="admin-sidebar-scroll flex-1 overflow-y-auto px-3 pb-6 pt-4" aria-label="Management">
          <NavList groups={groups} activeKey={activeKey} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setOpen(true)} brand={brand} />

        {/* relative: absolutely positioned descendants (sr-only labels, menus)
            must resolve against the scroller, or they stretch the window. */}
        <main id="main" tabIndex={-1} className="admin-sidebar-scroll relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1920px] space-y-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
            {/* Every navigation destination gets the same header: where it
                lives, what it is, and — on the same row — its actions, which
                the page's PageHeader sends here. Records and forms under a
                destination draw their own header instead. */}
            {here?.exact ? (
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  {here.group && here.group !== here.title ? <p className="section-label mb-1">{here.group}</p> : null}
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{here.title}</h1>
                </div>
                <div id="page-header-actions" className="flex shrink-0 flex-wrap items-center gap-2 empty:hidden" />
              </div>
            ) : null}
            <PageTabs />
            {children}
          </div>
        </main>
      </div>

      {/* Phone & tablet nav drawer */}
      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col bg-white shadow-2xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4">
              {brand}
              <button type="button" className="btn-icon -mr-2" onClick={() => setOpen(false)} aria-label="Close navigation">
                <MdClose size={20} />
              </button>
            </div>
            <nav className="admin-sidebar-scroll flex-1 overflow-y-auto px-3 py-4" aria-label="Management">
              <NavList groups={groups} activeKey={activeKey} onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

AdminLayout.propTypes = {
  children: PropTypes.node.isRequired
};
