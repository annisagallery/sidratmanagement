'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hrefMatches, navGroups } from 'src/layout/_admin/navConfig';
import { usePermissions } from 'src/context/PermissionsContext';

function findCurrentItem(pathname) {
  let winner = null;
  for (const group of navGroups) {
    for (const item of group.items) {
      const candidates = [item.href, ...(item.children || []).map((child) => child.href)];
      for (const href of candidates) {
        const path = href.split(/[?#]/)[0];
        if (hrefMatches(pathname, path) && (!winner || path.length > winner.length)) {
          winner = { item, length: path.length };
        }
      }
    }
  }
  return winner?.item;
}

export default function PageTabs() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const item = findCurrentItem(pathname);
  // A tab may carry its own `subject` when one parent groups pages behind
  // different gates; untagged tabs inherit the parent's visibility. UX only —
  // the API enforces.
  const tabs = (item?.children || []).filter(
    (tab) => !tab.subject || [].concat(tab.subject).some((subject) => can(tab.action || 'read', subject))
  );

  // A single destination adds no navigational value; go directly to its page.
  if (tabs.length < 2) return null;

  const activeHref = tabs
    .map((tab) => ({ href: tab.href, path: tab.href.split(/[?#]/)[0] }))
    .filter((tab) => hrefMatches(pathname, tab.path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.href;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label={`${item.label} pages`}>
      {tabs.map((tab) => {
        const tabPath = tab.href.split(/[?#]/)[0];
        const active = tab.href === activeHref;
        return (
          <Link key={`${tab.label}-${tab.href}`} href={tab.href} className={`tab-link ${active ? 'tab-link-active' : ''}`} aria-current={active ? 'page' : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
