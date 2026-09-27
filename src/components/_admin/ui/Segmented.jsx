'use client';

/**
 * Pick one of a few mutually exclusive views or ranges. For navigation between
 * sections use Tabs; this is for changing what the current section shows.
 * `options` are [{ id, label, icon? }].
 */
export default function Segmented({ options, value, onChange, label, size = 'md', className = '' }) {
  const height = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]';
  return (
    <div role="group" aria-label={label} className={`inline-flex rounded-md bg-slate-100 p-0.5 ${className}`}>
      {options.map((option) => {
        const active = value === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition ${height} ${
              active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {Icon && <Icon size={15} aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
