/**
 * A label in a user-chosen colour (status, tag, state). The colour marks it —
 * a dot and a light tint — while the text stays in ink, so a pale colour can
 * never make the label unreadable.
 */
export function ColorChip({ color = '#94a3b8', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium text-slate-800 ring-1 ring-inset ${className}`}
      style={{ backgroundColor: `${color}14`, '--tw-ring-color': `${color}40` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {children}
    </span>
  );
}

/** An order's tags, in a wrapping row. */
export function TagChips({ tags = [], className = 'mt-1' }) {
  if (!tags?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag) => (
        <ColorChip key={tag.id || tag.slug || tag.name} color={tag.color || '#94a3b8'}>
          {tag.name}
        </ColorChip>
      ))}
    </div>
  );
}

export function StatusBadge({ status, statuses = [] }) {
  const s = statuses.find((st) => st.value === status);
  const color = s?.color || '#6b7280';
  const label = s?.label || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '—');
  return <ColorChip color={color}>{label}</ColorChip>;
}

export function StatusSelect({ value, onChange, statuses = [], placeholder = 'All Status', className = '' }) {
  return (
    <select value={value} onChange={onChange} className={className}>
      <option value="">{placeholder}</option>
      {statuses.filter((s) => s.isActive).map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}
