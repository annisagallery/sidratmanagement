'use client';

import PropTypes from 'prop-types';
import { useState } from 'react';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import DashboardAppbar from './topbar';
import DashboardSidebar from './sidebar';
import PageTabs from 'src/components/_admin/ui/PageTabs';

export default function AdminLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { primaryColor } = useSiteSettings();

  return (
    <div
      className="admin-root flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50"
      style={primaryColor ? { '--brand': primaryColor } : undefined}
    >
      <DashboardAppbar handleDrawerOpen={() => setIsSidebarOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <DashboardSidebar open={isSidebarOpen} handleDrawerClose={() => setIsSidebarOpen(false)} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1920px] space-y-5 p-3 sm:p-4 lg:p-5">
            <PageTabs />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

AdminLayout.propTypes = {
  children: PropTypes.node.isRequired
};
