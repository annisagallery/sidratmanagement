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
    <div className="admin-root flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-100" style={primaryColor ? { '--brand': primaryColor } : undefined}>
      <header role="banner" className="relative z-40 flex h-12 shrink-0 items-center gap-2.5 border-b border-slate-200 bg-white px-3 sm:px-4">
        <span className="shrink-0 text-slate-500" aria-hidden>
          <FiShoppingBag size={17} />
        </span>
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-sm font-semibold text-slate-900">{screen.title}</h1>
          <span className="hidden border-l border-slate-200 pl-3 text-xs text-slate-500 sm:inline">{screen.subtitle}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {user?.name ? <span className="hidden max-w-48 truncate text-xs text-slate-500 md:block">{user.name}</span> : null}
          <button type="button" onClick={closeDesk} className="btn-ghost btn-sm" title="Close the order desk">
            <FiX size={16} aria-hidden /> Close
          </button>
        </div>
      </header>

      <main id="desk-main" className="min-h-0 flex-1 overflow-y-auto xl:overflow-hidden">
        <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-3 xl:h-full">{children}</div>
      </main>
    </div>
  );
}

OrderDeskShell.propTypes = {
  children: PropTypes.node.isRequired
};
