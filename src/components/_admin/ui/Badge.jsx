'use client';

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/10',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-800 ring-violet-600/20',
};

const DOTS = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  violet: 'bg-violet-500',
};

/**
 * Status and category labels. The text always carries the meaning; colour
 * and the optional dot only reinforce it.
 */
export default function Badge({ tone = 'neutral', dot = false, children, className = '', title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        TONES[tone] || TONES.neutral
      } ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone] || DOTS.neutral}`} aria-hidden />}
      {children}
    </span>
  );
}

const RECORD_TONE = { active: 'success', published: 'success', inactive: 'neutral', draft: 'warning', blocked: 'danger', expired: 'neutral' };

/** The on/off state of a record — product, category, coupon, customer… */
export function RecordStatus({ status, label }) {
  const key = String(status || '').toLowerCase();
  const text = label || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '—');
  return (
    <Badge tone={RECORD_TONE[key] || 'neutral'} dot>
      {text}
    </Badge>
  );
}
