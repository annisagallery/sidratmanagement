'use client';

import PropTypes from 'prop-types';
import Link from 'next/link';
import { FiArrowLeft, FiX } from 'react-icons/fi';
import { MdQrCodeScanner } from 'react-icons/md';

import { useSiteSettings } from 'src/context/SiteSettingsContext';
import useAdminUserStore from 'src/stores/userStore';

/**
 * Dedicated production-station chrome. It follows the POS shell: one slim bar
 * and a full-height work area, with an explicit route back to management.
 */
export default function ScanDeskShell({ children }) {
  const { primaryColor } = useSiteSettings();
  const user = useAdminUserStore((state) => state.user);

  const closeDesk = () => {
    window.close();
    setTimeout(() => {
      if (!window.closed) window.location.href = '/production';
    }, 150);
  };

  return (
    <div
      className="admin-root flex h-screen min-h-0 flex-col overflow-hidden bg-slate-100"
      style={primaryColor ? { '--brand': primaryColor } : undefined}
    >
      <header
        role="banner"
        className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 shadow-[0_1px_8px_rgba(15,23,42,0.04)] sm:px-5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
          <MdQrCodeScanner size={19} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-950">Production</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Scan station</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user?.name ? (
            <span className="hidden max-w-40 truncate text-xs font-semibold text-slate-500 md:block">{user.name}</span>
          ) : null}
          <Link
            href="/production"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
          >
            <FiArrowLeft size={15} />
            <span className="hidden sm:inline">Back to production</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <button
            type="button"
            onClick={closeDesk}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
            title="Close the scan desk"
            aria-label="Close the scan desk"
          >
            <FiX size={17} />
          </button>
        </div>
        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--brand)]" />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3 lg:overflow-hidden">{children}</main>
    </div>
  );
}

ScanDeskShell.propTypes = {
  children: PropTypes.node.isRequired
};
