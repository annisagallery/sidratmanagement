'use client';
import { MdInfoOutline, MdWarningAmber, MdErrorOutline } from 'react-icons/md';

const TONES = {
  info: { box: 'border-slate-200 bg-white text-slate-600', icon: 'text-slate-400', Icon: MdInfoOutline },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'text-amber-600', Icon: MdWarningAmber },
  danger: { box: 'border-rose-200 bg-rose-50 text-rose-800', icon: 'text-rose-600', Icon: MdErrorOutline },
};

/** A short note that explains a rule or warns about a consequence. */
export default function Callout({ tone = 'info', title, children, className = '', role }) {
  const style = TONES[tone] || TONES.info;
  const Icon = style.Icon;
  return (
    <div
      role={role || (tone === 'danger' ? 'alert' : undefined)}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px] leading-relaxed ${style.box} ${className}`}
    >
      <Icon size={18} className={`mt-px shrink-0 ${style.icon}`} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
