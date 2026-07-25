export function StatusBadge({ status, statuses = [] }) {
  const s = statuses.find((st) => st.value === status);
  const color = s?.color || '#6b7280';
  const label = s?.label || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '—');
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: color + '22', color, border: `1px solid ${color}55` }}
    >
      {label}
    </span>
  );
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
