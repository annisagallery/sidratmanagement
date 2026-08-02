'use client';

/**
 * The admin's shared reading primitives.
 *
 * Every operational screen — orders, stock, production, transfers — is read at a
 * glance by someone already doing something else. These parts exist so that a
 * fact looks the same wherever it appears: one idea per row, label left / value
 * right, money and quantities in a fixed shape so two figures can be compared
 * without being read.
 *
 * Layout classes (`card-ui`, `btn-*`, `input-ui`, `select-ui`) live in
 * globals.css; this module owns composition, not colour.
 */

import { useState } from 'react';
import Swal from 'sweetalert2';
import { FiCheck, FiCopy, FiX } from 'react-icons/fi';

/* ── data helpers ────────────────────────────────────────────────────────── */

/**
 * Mongo documents reach this app as `_id`; a few payloads are already mapped to
 * `id`. Every identifier is read through here rather than assuming one shape
 * and silently putting `undefined` into a request URL.
 */
export const oid = (doc) => String(doc?._id ?? doc?.id ?? '');

const amountFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** One money shape everywhere. */
export const money = (amount) => `৳${amountFormat.format(Math.round((Number(amount) || 0) * 100) / 100)}`;

/** Counts of physical things: grouped, never decimal. */
export const qty = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);

/** Endpoints differ on whether a list is wrapped in `data`. */
export const normalizeList = (response) =>
  Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];

export const errorText = (error, fallback = 'The action could not be completed.') =>
  error?.response?.data?.message || error?.message || fallback;

export function toast(title) {
  Swal.fire({ title, icon: 'success', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
}

export function errorAlert(title, error, fallback) {
  Swal.fire(title, errorText(error, fallback), 'error');
}

/* ── page furniture ──────────────────────────────────────────────────────── */

/**
 * The top of every screen: what this page is, and the acts available on it.
 * `back` renders a return arrow, so a sub-page never strands anyone.
 */
export function PageBar({ title, subtitle, eyebrow, back, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {back ? (
          <button type="button" onClick={back} className="btn-icon mt-0.5 shrink-0" aria-label="Go back" title="Go back">
            <span aria-hidden>←</span>
          </button>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{eyebrow}</p> : null}
          <h1 className="truncate text-xl font-black tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

const TILE_TONE = {
  default: 'text-slate-900',
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  bad: 'text-rose-600',
  info: 'text-sky-700',
  muted: 'text-slate-400'
};

/** A single number that means something, with the sentence that explains it. */
export function StatTile({ label, value, note, tone = 'default', onClick, active = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`card-ui px-4 py-3 text-left transition ${onClick ? 'hover:border-slate-300 hover:bg-slate-50' : ''} ${
        active ? '!border-[var(--brand)] ring-1 ring-[var(--brand-ring)]' : ''
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${TILE_TONE[tone] || TILE_TONE.default}`}>{value}</p>
      {note ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{note}</p> : null}
    </Tag>
  );
}

/** Filters and search, on one line, above the thing they filter. */
export function Toolbar({ children, className = '' }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

/* ── surfaces ────────────────────────────────────────────────────────────── */

export function Section({ title, icon: Icon, hint, actions, children }) {
  return (
    <section className="card-ui overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon size={15} className="shrink-0 text-slate-400" /> : null}
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-600">{title}</h2>
          {hint ? <span className="truncate text-xs font-medium text-slate-400">{hint}</span> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function SectionBody({ children, className = 'p-4' }) {
  return <div className={className}>{children}</div>;
}

/* ── rows ────────────────────────────────────────────────────────────────── */

export function Row({ label, value, mono = false, keepEmpty = false }) {
  const empty = value === null || value === undefined || value === '';
  if (empty && !keepEmpty) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="shrink-0 pt-px text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-[13px] font-semibold text-slate-800 ${mono ? 'ops-code' : ''}`}>
        {empty ? <span className="font-normal text-slate-300">—</span> : value}
      </dd>
    </div>
  );
}

const MONEY_TONE = {
  default: 'text-slate-600',
  muted: 'text-slate-400',
  credit: 'text-emerald-600',
  due: 'text-amber-600',
  paid: 'text-emerald-700'
};

export function MoneyRow({ label, amount, tone = 'default', sign = '', strong = false, hint }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? 'mt-1 border-t border-slate-200 pt-2' : ''}`}>
      <span className={`text-[13px] ${strong ? 'font-bold text-slate-900' : MONEY_TONE[tone] || MONEY_TONE.default}`}>
        {label}
        {hint ? <span className="ml-1 text-[11px] font-normal text-slate-400">{hint}</span> : null}
      </span>
      <span
        className={`tabular-nums ${strong ? 'text-base font-black text-slate-900' : `text-[13px] font-semibold ${MONEY_TONE[tone] || MONEY_TONE.default}`}`}
      >
        {sign}
        {money(amount)}
      </span>
    </div>
  );
}

/* ── small controls ──────────────────────────────────────────────────────── */

export function CopyButton({ value, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the value is on screen anyway */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={label}
      aria-label={label}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${className}`}
    >
      {copied ? <FiCheck size={12} className="text-emerald-600" /> : <FiCopy size={12} />}
    </button>
  );
}

export const PILL_TONE = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  brand: 'border-[var(--brand-ring)] bg-[var(--brand-soft)] text-[var(--brand-strong)]',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
  bad: 'border-rose-200 bg-rose-50 text-rose-600',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700'
};

export function Pill({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${PILL_TONE[tone] || PILL_TONE.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

/** A stated reason, always visible — never a tooltip. */
export function Notice({ tone = 'warn', icon: Icon, title, children, action }) {
  return (
    <div className={`flex items-start gap-3 rounded-md border px-4 py-3 ${PILL_TONE[tone] || PILL_TONE.warn}`}>
      {Icon ? <Icon size={16} className="mt-0.5 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[13px] font-bold">{title}</p> : null}
        {children ? <div className="text-xs leading-relaxed opacity-90">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Empty states are an instruction, not a mood. */
export function EmptyRow({ colSpan = 1, title, hint, icon: Icon }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        {Icon ? <Icon className="mx-auto mb-2 text-2xl text-slate-300" /> : null}
        <p className="text-sm font-semibold text-slate-600">{title}</p>
        {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      </td>
    </tr>
  );
}

/* ── modal + form field ──────────────────────────────────────────────────── */

export const fieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]';

export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function ModalShell({ title, subtitle, onClose, children, footer, size = 'md' }) {
  const width = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size] || 'max-w-lg';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className={`flex max-h-full w-full flex-col overflow-hidden rounded-md bg-white shadow-2xl ${width}`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            {subtitle ? <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{subtitle}</p> : null}
            <h2 className="truncate text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FiX size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/** A detail surface that slides in beside the list, so the list is never lost. */
export function Drawer({ title, subtitle, onClose, children, footer, width = 'max-w-xl' }) {
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`flex h-full w-full ${width} flex-col bg-white shadow-2xl`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            {subtitle ? <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{subtitle}</p> : null}
            <h2 className="truncate text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FiX size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="border-t border-slate-200 bg-slate-50/70 p-4">{footer}</footer> : null}
      </aside>
    </div>
  );
}
