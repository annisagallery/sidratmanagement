'use client';

/**
 * The docket — the old POS's purchase/transfer form, as parts.
 *
 * That screen had one shape and everyone who worked here learned it: a strip of
 * header fields across the top (who, where, when), one wide search box under
 * it, one wide table of lines, and the totals stacked bottom-right above the
 * submit. You fill it top to bottom and never move sideways.
 *
 * It is reproduced here rather than reinvented because the shape is the part
 * people know. A buyer with a supplier's challan in one hand is copying a
 * document into a form; a three-column layout with a sidebar makes them hunt
 * for the next field, and hunting is what makes data entry wrong.
 *
 * Purchases and transfers both use these, so the two screens stay the same
 * screen with different columns — which is exactly what they were before.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch, FiTrash2, FiX } from 'react-icons/fi';

import { money, qty } from './primitives';

/* ── header ──────────────────────────────────────────────────────────────── */

/** The strip of header fields. Everything above the line items. */
export function DocketHeader({ children, columns = 5 }) {
  const grid = {
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
    5: 'md:grid-cols-3 lg:grid-cols-5'
  }[columns] || 'md:grid-cols-3 lg:grid-cols-5';

  return <div className={`grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50/70 p-4 ${grid}`}>{children}</div>;
}

export function DocketField({ label, required = false, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

/* ── the search bar ──────────────────────────────────────────────────────── */

/**
 * One wide box that adds a line, exactly where the old POS put it.
 *
 * `options` are already-resolved rows: whoever mounts this decides whether they
 * come from the product catalogue (a purchase can order anything) or from what
 * is physically standing at a branch (a transfer can only move what is there).
 * The box does not care which — it lists what it is given and calls onPick.
 */
export function DocketSearch({
  value,
  onChange,
  options,
  onPick,
  disabled = false,
  loading = false,
  placeholder = 'Add product by name or code…',
  emptyHint = 'No product matches that.',
  disabledHint = ''
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={boxRef} className="relative border-b border-slate-200 p-4">
      <div className="relative">
        <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={disabled && disabledHint ? disabledHint : placeholder}
          className="input-ui h-11 w-full pl-10 text-[13px] disabled:bg-slate-50 disabled:text-slate-400"
          aria-label="Add a product to this docket"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Clear search"
          >
            <FiX size={14} />
          </button>
        ) : null}
      </div>

      {open && !disabled ? (
        <div className="absolute inset-x-4 top-[60px] z-30 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Searching…</p>
          ) : options.length ? (
            <ul className="divide-y divide-slate-100">
              {options.map((option) => (
                <li key={option.key}>
                  <button
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onPick(option);
                      onChange('');
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-slate-800">{option.title}</span>
                      {option.subtitle ? (
                        <span className="block truncate text-[11px] text-slate-500">{option.subtitle}</span>
                      ) : null}
                    </span>
                    {option.meta ? (
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400">{option.meta}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-400">{emptyHint}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ── the line table ──────────────────────────────────────────────────────── */

export function DocketTable({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
            <th className="w-10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">#</th>
            {head.map((column) => (
              <th
                key={column.label}
                className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${column.className || ''}`}
              >
                {column.label}
              </th>
            ))}
            <th className="w-10 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function DocketRow({ index, onRemove, children }) {
  return (
    <tr className="align-top">
      <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums text-slate-400">{index + 1}</td>
      {children}
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          aria-label="Remove this line"
        >
          <FiTrash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

export function DocketEmpty({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}

/** A number cell, sized and aligned like the old POS's inline inputs. */
export function CellInput({ value, onChange, type = 'number', min = 0, step = '1', width = 'w-24', invalid = false }) {
  return (
    <input
      type={type}
      min={min}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`input-ui h-9 ${width} text-right tabular-nums ${invalid ? '!border-rose-300 !bg-rose-50' : ''}`}
    />
  );
}

/* ── the totals block ────────────────────────────────────────────────────── */

/**
 * The count strip that sat directly under the old POS's items table. It is the
 * line a buyer checks against the challan before they look at any money.
 */
export function DocketCount({ lines, units, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[12px] font-semibold text-slate-600">
      <span>
        {qty(lines)} line{lines === 1 ? '' : 's'} · {qty(units)} unit{units === 1 ? '' : 's'}
      </span>
      {children}
    </div>
  );
}

export function DocketTotalRow({ label, value, strong = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-6 ${strong ? 'border-t border-slate-200 pt-2' : ''}`}>
      <span className={strong ? 'text-[13px] font-bold text-slate-900' : 'text-[13px] text-slate-500'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-lg font-black text-slate-900' : 'text-[13px] font-semibold text-slate-700'}`}>
        {money(value)}
      </span>
    </div>
  );
}

/**
 * The foot of the docket: adjustments on the left where they are typed, the
 * running total on the right where it is read.
 */
export function DocketFoot({ adjustments, totals, children }) {
  return (
    <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">{adjustments}</div>
      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-4">
        {totals}
        {children}
      </div>
    </div>
  );
}

/** Small helper so both screens read totals the same way. */
export function useDocketTotals(lines, { orderDiscount = 0, orderTax = 0, shipping = 0 } = {}) {
  return useMemo(() => {
    const subTotal = lines.reduce((sum, line) => sum + Number(line.subTotal || 0), 0);
    const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const grandTotal = subTotal - Number(orderDiscount || 0) + Number(orderTax || 0) + Number(shipping || 0);
    return { subTotal, units, grandTotal };
  }, [lines, orderDiscount, orderTax, shipping]);
}
