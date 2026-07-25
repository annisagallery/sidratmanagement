'use client';

import PropTypes from 'prop-types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiX } from 'react-icons/fi';
import { hrefMatches, navGroups } from 'src/layout/_admin/navConfig';
import { usePermissions } from 'src/context/PermissionsContext';
import useAdminUserStore from 'src/stores/userStore';

function activeItemKey(pathname) {
  let match = null;
  for (const group of navGroups) {
    for (const item of group.items) {
      const destinations = [item.href, ...(item.children || []).map((child) => child.href)];
      for (const destination of destinations) {
        const href = destination.split(/[?#]/)[0];
        if (hrefMatches(pathname, href) && (!match || href.length > match.href.length)) {
          match = { key: item.key, href };
        }
      }
    }
  }
  return match?.key;
}

function Navigation({ pathname, close }) {
  const currentKey = activeItemKey(pathname);
  const { can } = usePermissions();
  const { user } = useAdminUserStore();

  // Ability-filtered navigation: items tagged with a `subject` only render
  // when the user's role can at least read it; `superAdminOnly` items render
  // for super admins alone. UX only — the API enforces.
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.superAdminOnly || user?.role === 'super admin') &&
          (!item.subject || can(item.action || 'read', item.subject))
      )
    }))
    .filter((group) => group.items.length > 0);

  return (
    <nav className="admin-sidebar-scroll flex-1 overflow-y-auto px-3 pb-5 pt-3" aria-label="Admin navigation">
      <div className="space-y-5">
        {visibleGroups.map((group) => (
          <section key={group.key} aria-labelledby={`nav-${group.key}`}>
            <h2
              id={`nav-${group.key}`}
              className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"
            >
              {group.label}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = currentKey === item.key;
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <div className={`relative rounded-md ${active ? 'bg-[var(--brand-soft)]' : 'hover:bg-slate-50'}`}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className={`flex h-9 min-w-0 items-center gap-2.5 px-3 text-[13px] ${active ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}
                        aria-current={active ? 'page' : undefined}
                      >
                        {active && (
                          <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-md bg-[var(--brand)]" />
                        )}
                        <Icon
                          className="shrink-0 text-[17px]"
                          style={active ? { color: 'var(--brand-strong)' } : undefined}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

export default function Sidebar({ open, handleDrawerClose }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <Navigation pathname={pathname} close={() => {}} />
      </aside>

      <div className={`fixed inset-0 z-[80] md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button
          type="button"
          onClick={handleDrawerClose}
          className={`absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-opacity ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Close navigation"
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col bg-white shadow-2xl transition-transform duration-200 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
            <div>
              <p className="text-sm font-bold text-slate-900">Management menu</p>
              <p className="text-xs text-slate-400">Navigation</p>
            </div>
            <button
              type="button"
              onClick={handleDrawerClose}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Close navigation"
            >
              <FiX />
            </button>
          </div>
          <Navigation pathname={pathname} close={handleDrawerClose} />
        </aside>
      </div>
    </>
  );
}

Navigation.propTypes = {
  pathname: PropTypes.string.isRequired,
  close: PropTypes.func.isRequired
};

Sidebar.propTypes = {
  open: PropTypes.bool.isRequired,
  handleDrawerClose: PropTypes.func.isRequired
};
