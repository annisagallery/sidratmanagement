'use client';

/**
 * Consistent page/section header: title, optional subtitle (or count), and a right-aligned
 * actions slot. Keep it compact — used at the top of every admin page.
 */
export default function PageHeader({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
          >
            <Icon size={20} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
