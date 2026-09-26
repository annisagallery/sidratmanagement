'use client';

/**
 * Order-screen vocabulary.
 *
 * The generic reading primitives now live in `ui/primitives` so that stock,
 * production and transfers read identically to orders. This module re-exports
 * them under the names the order screen already uses, and owns only what is
 * specific to an order: couriers and tags.
 */

export {
  CopyButton,
  Drawer,
  Field,
  ModalShell,
  Notice,
  Pill,
  MoneyRow,
  Row,
  Section,
  SectionBody,
  errorAlert,
  errorText,
  fieldClass,
  money,
  normalizeList,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';

import { FiCheckCircle, FiClock, FiPieChart } from 'react-icons/fi';
import { Pill, oid } from 'src/components/_admin/ui/primitives';

/**
 * The order screen's surface: a white card with a plain title, the way store
 * admins lay out an order, rather than the grey banded ops section.
 */
export function Card({ title, icon: Icon, badge, actions, footer, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${className}`}
    >
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? <Icon size={16} className="shrink-0 text-slate-400" /> : null}
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {badge}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
      {footer ? (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

/** Paid / partly paid / unpaid, from verified money — the server's own rule. */
export function PaymentBadge({ paid = 0, due = 0 }) {
  if (due <= 0)
    return (
      <Pill tone="good">
        <FiCheckCircle size={11} aria-hidden="true" /> Paid
      </Pill>
    );
  if (paid > 0)
    return (
      <Pill tone="warn">
        <FiPieChart size={11} aria-hidden="true" /> Partially paid
      </Pill>
    );
  return (
    <Pill tone="warn">
      <FiClock size={11} aria-hidden="true" /> Unpaid
    </Pill>
  );
}

/** Courier providers, named the way the operator names them. */
export const PROVIDER_LABEL = { pathao: 'Pathao', steadfast: 'Steadfast', carrybee: 'CarryBee' };

export const tagId = (tag) => (typeof tag === 'object' && tag !== null ? oid(tag) : String(tag ?? ''));
export const tagName = (tag) =>
  typeof tag === 'object' && tag !== null ? tag.name || tag.title || tag.slug || oid(tag) : String(tag ?? '');
export const tagColor = (tag) => (typeof tag === 'object' && tag !== null ? tag.color : null);
