'use client';
import { useRef } from 'react';

/**
 * Tab strip. Controlled — the parent owns `value`.
 * `tabs` is [{ id, label, icon?, badge? }].
 *
 * Horizontal by default (scrolls on narrow screens); `orientation="vertical"`
 * is the settings-page side nav. Arrow keys move between tabs.
 */
export default function Tabs({ tabs = [], value, onChange, className = '', orientation = 'horizontal', label }) {
  const listRef = useRef(null);
  const vertical = orientation === 'vertical';

  const onKeyDown = (event) => {
    const keys = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === value);
    const step = event.key === keys[1] ? 1 : -1;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.id);
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-tab="${next.id}"]`)?.focus());
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={
        vertical
          ? `flex flex-col gap-0.5 ${className}`
          : `admin-sidebar-scroll flex gap-1 overflow-x-auto border-b border-slate-200 ${className}`
      }
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab={tab.id}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={
              vertical
                ? `relative flex h-9 items-center gap-2.5 rounded-md px-3 text-left text-sm transition-colors ${
                    active
                      ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'font-medium text-slate-600 hover:bg-white/70 hover:text-slate-900'
                  }`
                : `-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-sm transition-colors ${
                    active
                      ? 'border-slate-900 font-semibold text-slate-900'
                      : 'border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-slate-800'
                  }`
            }
          >
            {Icon && <Icon size={17} aria-hidden className={active ? 'text-[var(--brand-strong)]' : 'text-slate-400'} />}
            <span className="truncate">{tab.label}</span>
            {tab.badge != null && tab.badge !== 0 && (
              <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
