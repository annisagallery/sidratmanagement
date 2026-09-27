import { MdArrowUpward, MdArrowDownward, MdUnfoldMore } from 'react-icons/md';

/**
 * Sortable <th>. The whole label is the button; aria-sort tells assistive
 * tech which column is ordering the table.
 * Props: field, label, sortBy, sortOrder, onSort, align ('left'|'right'|'center'), className
 */
export default function SortTh({ field, label, sortBy, sortOrder, onSort, align = 'left', className = '' }) {
  const active = sortBy === field;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const Icon = !active ? MdUnfoldMore : sortOrder === 'asc' ? MdArrowUpward : MdArrowDownward;

  return (
    <th
      className={`${alignClass} ${className}`}
      aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`-mx-1 inline-flex items-center gap-1 rounded px-1 text-xs font-semibold transition-colors ${
          active ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        {label}
        <Icon size={14} aria-hidden className={active ? 'text-slate-900' : 'text-slate-400'} />
      </button>
    </th>
  );
}
