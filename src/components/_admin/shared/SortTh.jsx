import { MdArrowUpward, MdArrowDownward, MdUnfoldMore } from 'react-icons/md';

/**
 * Sortable <th> cell (compact). Active state uses the admin brand token.
 * Props: field, label, sortBy, sortOrder, onSort, align ('left'|'right'|'center')
 */
export default function SortTh({ field, label, sortBy, sortOrder, onSort, align = 'left' }) {
  const active = sortBy === field;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th className={`px-3 py-2 ${alignClass} select-none`} onClick={() => onSort(field)}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide transition ${
          active ? '' : 'text-slate-500 hover:text-slate-700'
        } ${align === 'right' ? 'flex-row-reverse' : ''} ${align === 'center' ? 'justify-center' : ''}`}
        style={active ? { color: 'var(--brand-strong)' } : undefined}
      >
        {label}
        {active ? (
          sortOrder === 'asc' ? (
            <MdArrowUpward size={13} style={{ color: 'var(--brand)' }} />
          ) : (
            <MdArrowDownward size={13} style={{ color: 'var(--brand)' }} />
          )
        ) : (
          <MdUnfoldMore size={13} className="text-slate-300" />
        )}
      </button>
    </th>
  );
}
