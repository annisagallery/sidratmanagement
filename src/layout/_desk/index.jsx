'use client';

import PropTypes from 'prop-types';
import { usePathname } from 'next/navigation';
import { FiShoppingBag, FiX } from 'react-icons/fi';

import { useSiteSettings } from 'src/context/SiteSettingsContext';
import useAdminUserStore from 'src/stores/userStore';

/** What each desk screen is called. */
function screenFor(pathname) {
  if (pathname === '/orders/create') return { title: 'New order', subtitle: 'Order desk' };
  return { title: 'Order desk', subtitle: 'Sidrat' };
}

/**
 * Full-screen workstation chrome for order entry. Like the scan desk: one slim
 * bar and the whole screen for the task, no sidebar or page tabs competing
 * with the form. It opens in its own tab, so "Close" closes the tab.
 */
export default function OrderDeskShell({ children }) {
  const pathname = usePathname() || '';
  const { primaryColor } = useSiteSettings();
  const user = useAdminUserStore((state) => state.user);
  const screen = screenFor(pathname);

  const closeDesk = () => {
    window.close();
    // A tab the script did not open cannot close itself; go to the orders list instead.
    setTimeout(() => {
      if (!window.closed) window.location.href = '/orders';
    }, 150);
  };

  return (
    <div className="admin-root flex h-screen min-h-0 flex-col overflow-hidden bg-slate-100" style={primaryColor ? { '--brand': primaryColor } : undefined}>
      <header role="banner" className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white" aria-hidden>
          <FiShoppingBag size={17} />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight text-slate-900">{screen.title}</h1>
          <p className="truncate text-xs text-slate-500">{screen.subtitle}</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {user?.name ? <span className="hidden max-w-48 truncate text-[13px] text-slate-500 md:block">{user.name}</span> : null}
          <button type="button" onClick={closeDesk} className="btn-ghost" title="Close the order desk">
            <FiX size={16} aria-hidden /> Close
          </button>
        </div>
      </header>

      <main id="desk-main" className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="h-full w-full p-3">{children}</div>
      </main>
    </div>
  );
}

OrderDeskShell.propTypes = {
  children: PropTypes.node.isRequired
};
