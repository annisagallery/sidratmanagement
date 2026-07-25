'use client';

/**
 * The only native table renderer used by the admin UI.
 * DataTable adds data behavior; GlobalTable guarantees consistent density,
 * typography, borders and responsive overflow for specialized/editable tables.
 */
export default function GlobalTable({ children, className = '' }) {
  return (
    <div className="admin-global-table overflow-x-auto">
      <table className={`w-full border-collapse text-left text-[13px] ${className}`}>{children}</table>
    </div>
  );
}
