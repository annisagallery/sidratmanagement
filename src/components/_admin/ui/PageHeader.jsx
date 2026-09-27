'use client';

import { usePathname } from 'next/navigation';
import { navItemFor } from 'src/layout/_admin/navConfig';
import { PageActionsPortal, usePageHeaderSlot } from './PageHeaderSlot';

/**
 * Page title and page-level actions.
 *
 * On a navigation destination the shell already draws the header (group
 * eyebrow + title), so this only moves its actions into that header, on the
 * title's row. On a page the shell has no header for — a record, a form — it
 * draws the full header itself. Either way the title and the primary action
 * share one line. `icon` is accepted for backwards compatibility and not drawn.
 */
// eslint-disable-next-line no-unused-vars
export default function PageHeader({ title, subtitle, eyebrow, icon, children }) {
  const pathname = usePathname();
  const here = navItemFor(pathname || '/');
  const { slot, checked } = usePageHeaderSlot();

  if (slot) return <PageActionsPortal slot={slot}>{children}</PageActionsPortal>;
  if (!checked && here?.exact) return null;

  const group = eyebrow ?? here?.group;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {group && <p className="section-label mb-1">{group}</p>}
        {title && <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>}
        {subtitle && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
