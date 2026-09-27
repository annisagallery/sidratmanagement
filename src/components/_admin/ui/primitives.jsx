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
 * globals.css; this module owns composition, not colour. The look matches the
 * shared Sidrat design system (see .claude/skills/sidrat-ui-redesign).
 */

import { useId, useRef, useState } from 'react';
import { FiCheck, FiCopy, FiX } from 'react-icons/fi';
import { alertError, toastSuccess } from 'src/utils/swal';
import { useOverlayKeys } from './Drawer';
import { PageActionsPortal, usePageHeaderSlot } from './PageHeaderSlot';

/**
 * Page titles, subtitles and help text are switched off for now: the navigation
 * already says where you are, and the screens read cleaner without a paragraph
 * of instructions above every form. Set this to true to bring every one of them
 * back — PageBar, PageHeader, field hints and empty-state hints all read it.
 * Titles still render as screen-reader headings while it is off.
 */
export const SHOW_PAGE_GUIDANCE = false;

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

/** Success confirmation — the app's standard toast. */
export function toast(title) {
  toastSuccess(title);
}

/** Failure — the app's standard error dialog. */
export function errorAlert(title, error, fallback) {
  alertError(error, { title, text: errorText(error, fallback) });
}

/* ── page furniture ──────────────────────────────────────────────────────── */

/**
 * The top of every screen: what this page is, and the acts available on it.
 * `back` renders a return arrow, so a sub-page never strands anyone.
 */
export function PageBar({ title, subtitle, eyebrow, back, children }) {
  const { slot } = usePageHeaderSlot();
  const backButton = back ? (
    <button type="button" onClick={back} className="btn-ghost btn-sm shrink-0" aria-label="Go back" title="Go back">
      <span aria-hidden>←</span> Back
    </button>
  ) : null;

  // The shell drew this page's header: put the actions (and a back link) in it.
  if (slot) {
    return (
      <PageActionsPortal slot={slot}>
        {backButton || children ? (
          <>
            {backButton}
            {children}
          </>
        ) : null}
      </PageActionsPortal>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backButton}
        <div className="min-w-0">
          {eyebrow ? <p className="section-label mb-1">{eyebrow}</p> : null}
          {title ? <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{title}</h1> : null}
          {subtitle && SHOW_PAGE_GUIDANCE ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
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
  bad: 'text-rose-700',
  info: 'text-sky-700',
  muted: 'text-slate-500'
};

/** A single number that means something, with the sentence that explains it. */
export function StatTile({ label, value, note, tone = 'default', onClick, active = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-pressed': active } : {})}
      className={`card-ui flex min-w-0 flex-col gap-1 px-5 py-4 text-left transition-colors ${
        onClick ? 'hover:border-slate-300 hover:bg-slate-50' : ''
      } ${active ? '!border-slate-900 ring-1 ring-slate-900' : ''}`}
    >
      <p className="truncate text-[13px] font-medium text-slate-500">{label}</p>
      <p className={`truncate text-[26px] font-semibold leading-9 tracking-tight tabular-nums ${TILE_TONE[tone] || TILE_TONE.default}`}>
        {value}
      </p>
      {note ? <p className="truncate text-xs text-slate-500">{note}</p> : null}
    </Tag>
  );
}

/** Filters and search, on one line, above the thing they filter. */
export function Toolbar({ children, className = '' }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

/* ── surfaces ────────────────────────────────────────────────────────────── */

export function Section({ title, icon: Icon, hint, actions, children }) {
  const id = useId();
  return (
    <section className="card-ui overflow-hidden" aria-labelledby={id}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? <Icon size={17} className="shrink-0 text-slate-400" aria-hidden /> : null}
          <h2 id={id} className="text-[15px] font-semibold text-slate-900">
            {title}
          </h2>
          {hint ? <span className="truncate text-[13px] text-slate-500">{hint}</span> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function SectionBody({ children, className = 'p-5' }) {
  return <div className={className}>{children}</div>;
}

/* ── rows ────────────────────────────────────────────────────────────────── */

export function Row({ label, value, mono = false, keepEmpty = false }) {
  const empty = value === null || value === undefined || value === '';
  if (empty && !keepEmpty) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="shrink-0 pt-px text-[13px] text-slate-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-[13px] font-medium text-slate-900 ${mono ? 'ops-code' : ''}`}>
        {empty ? <span className="font-normal text-slate-400">—</span> : value}
      </dd>
    </div>
  );
}

const MONEY_TONE = {
  default: 'text-slate-700',
  muted: 'text-slate-500',
  credit: 'text-emerald-700',
  due: 'text-amber-700',
  paid: 'text-emerald-700'
};

export function MoneyRow({ label, amount, tone = 'default', sign = '', strong = false, hint }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${strong ? 'mt-1 border-t border-slate-200 pt-2.5' : ''}`}>
      <span className={`text-[13px] ${strong ? 'font-semibold text-slate-900' : MONEY_TONE[tone] || MONEY_TONE.default}`}>
        {label}
        {hint ? <span className="ml-1.5 text-xs font-normal text-slate-500">{hint}</span> : null}
      </span>
      <span
        className={`tabular-nums ${strong ? 'text-base font-semibold text-slate-900' : `text-[13px] font-medium ${MONEY_TONE[tone] || MONEY_TONE.default}`}`}
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
      title={copied ? 'Copied' : label}
      aria-label={copied ? 'Copied' : label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      {copied ? <FiCheck size={13} className="text-emerald-600" /> : <FiCopy size={13} />}
    </button>
  );
}

export const PILL_TONE = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/10',
  brand: 'bg-[var(--brand-soft)] text-[var(--brand-strong)] ring-[var(--brand-ring)]',
  good: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  warn: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  bad: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-800 ring-violet-600/20'
};

export function Pill({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        PILL_TONE[tone] || PILL_TONE.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}

const NOTICE_TONE = {
  neutral: 'border-slate-200 bg-white text-slate-700',
  brand: 'border-[var(--brand-ring)] bg-[var(--brand-soft)] text-slate-900',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  bad: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  violet: 'border-violet-200 bg-violet-50 text-violet-900'
};

/** A stated reason, always visible — never a tooltip. */
export function Notice({ tone = 'warn', icon: Icon, title, children, action }) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : undefined}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${NOTICE_TONE[tone] || NOTICE_TONE.warn}`}
    >
      {Icon ? <Icon size={18} className="mt-px shrink-0 opacity-80" aria-hidden /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[13px] font-semibold">{title}</p> : null}
        {children ? <div className="text-[13px] leading-relaxed opacity-90">{children}</div> : null}
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
        {Icon ? (
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon size={20} aria-hidden />
          </span>
        ) : null}
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {hint && SHOW_PAGE_GUIDANCE ? <p className="mt-1 text-[13px] text-slate-500">{hint}</p> : null}
      </td>
    </tr>
  );
}

/** Skeleton rows while a table loads. */
export function LoadingRows({ colSpan = 1, rows = 6 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`loading-${index}`} aria-hidden>
      <td colSpan={colSpan}>
        <div className="skeleton h-4" style={{ width: `${90 - (index % 3) * 15}%` }} />
      </td>
    </tr>
  ));
}

/** A table whose data failed to load: the reason and a way to try again. */
export function ErrorRow({ colSpan = 1, error, onRetry, title = 'This list could not be loaded' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center" role="alert">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-[13px] text-slate-500">{errorText(error, 'Something went wrong. Please try again.')}</p>
        {onRetry ? (
          <button type="button" className="btn-ghost btn-sm mt-4" onClick={() => onRetry()}>
            Try again
          </button>
        ) : null}
      </td>
    </tr>
  );
}

/* ── modal + form field ──────────────────────────────────────────────────── */

/** Same look as the `input-ui` class, for callers that compose their own. */
export const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-strong)] focus:ring-[3px] focus:ring-[var(--brand-ring)] sm:text-sm';

/**
 * Label + control (+ hint or error). Wrapping in <label> ties the two together.
 * `error` always shows and replaces the hint; `hint` follows SHOW_PAGE_GUIDANCE
 * unless `showHint` says it is information rather than guidance.
 */
export function Field({ label, children, hint, error, optional = false, required = false, showHint = false, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-slate-800">
        {label}
        {required ? (
          <span className="text-rose-600" aria-hidden>
            *
          </span>
        ) : null}
        {optional ? <span className="font-normal text-slate-500">Optional</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[13px] font-medium text-rose-700" role="alert">
          {error}
        </span>
      ) : hint && (SHOW_PAGE_GUIDANCE || showHint) ? (
        <span className="mt-1.5 block text-[13px] text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

/** Same look as `select-ui`, full width — for selects inside Field. */
export const selectClass = 'select-ui w-full';

export function ModalShell({ title, subtitle, onClose, children, footer, size = 'md' }) {
  const width = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size] || 'max-w-lg';
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayKeys(panelRef, onClose);
  return (
    <div className="fixed inset-0 z-[80] !m-0 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        data-overlay=""
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-full w-full flex-col overflow-hidden rounded-lg bg-white shadow-2xl ${width}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {subtitle ? <p className="section-label mb-1">{subtitle}</p> : null}
            <h2 id={titleId} className="truncate text-lg font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-icon -mr-2 -mt-1">
            <FiX size={18} />
          </button>
        </div>
        <div className="admin-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/** A detail surface that slides in beside the list, so the list is never lost. */
export function Drawer({ title, subtitle, onClose, children, footer, width = 'max-w-xl' }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayKeys(panelRef, onClose);
  return (
    <div className="fixed inset-0 z-[70] !m-0 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        data-overlay=""
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex h-full w-full ${width} flex-col bg-white shadow-2xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            {subtitle ? <p className="section-label mb-1">{subtitle}</p> : null}
            <h2 id={titleId} className="truncate text-lg font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close panel" className="btn-icon -mr-2 -mt-1">
            <FiX size={18} />
          </button>
        </header>
        <div className="admin-sidebar-scroll min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <footer className="border-t border-slate-200 bg-slate-50 p-4">{footer}</footer> : null}
      </aside>
    </div>
  );
}
