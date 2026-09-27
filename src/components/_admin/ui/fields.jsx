'use client';
import { Children, cloneElement, isValidElement, useId } from 'react';
import Panel from './Panel';

/** Form primitives shared by settings pages and editors (same as the marketing app). */

/**
 * Label, control, then help or error underneath. The label is tied to the
 * control (and the help text to its description) automatically when the
 * control is a single element.
 */
export function Field({ label, help, children, counter, optional = false, required = false, error, className = '' }) {
  const id = useId();
  const helpId = `${id}-help`;
  const only = Children.count(children) === 1 && isValidElement(children) ? children : null;
  const controlId = only?.props.id || id;
  const describedBy = [help ? helpId : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  const control = only
    ? cloneElement(only, {
        id: controlId,
        'aria-describedby': only.props['aria-describedby'] || describedBy,
        ...(error ? { 'aria-invalid': true } : {}),
      })
    : children;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={only ? controlId : undefined} className="block mb-1.5 text-[13px] font-medium text-slate-800">
          {label}
          {required && (
            <span className="ml-0.5 text-rose-600" aria-hidden>
              *
            </span>
          )}
          {optional && <span className="ml-1.5 font-normal text-slate-500">Optional</span>}
        </label>
        {counter}
      </div>
      {control}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] font-medium text-rose-700">
          {error}
        </p>
      ) : (
        help && (
          <p id={helpId} className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
            {help}
          </p>
        )
      )}
    </div>
  );
}

export function LengthCounter({ value, min = 0, max = 160 }) {
  const len = String(value || '').length;
  const bad = len > max;
  const warn = len > 0 && len < min;
  return (
    <span
      className={`text-xs tabular-nums ${bad ? 'font-semibold text-rose-700' : warn ? 'font-medium text-amber-700' : 'text-slate-500'}`}
    >
      {len} / {max}
      {bad ? ' — too long' : warn ? ' — a little short' : ''}
    </span>
  );
}

/**
 * On/off setting. Rendered as a switch with the label and explanation on the
 * left; the whole text is clickable. Name kept as `Toggle` for existing callers.
 */
export function Toggle({ label, help, checked, onChange, disabled = false }) {
  const id = useId();
  const on = Boolean(checked);
  return (
    <div className={`flex items-start justify-between gap-6 py-1 ${disabled ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <label htmlFor={id} className={`block text-sm font-medium text-slate-800 ${disabled ? '' : 'cursor-pointer'}`}>
          {label}
        </label>
        {help && (
          <p id={`${id}-help`} className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
            {help}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={help ? `${id}-help` : undefined}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
          on ? 'bg-slate-900' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
          aria-hidden
        />
      </button>
    </div>
  );
}

/** Compact switch for list rows, where the row itself is the label. */
export function Switch({ checked, onChange, label, disabled = false }) {
  const on = Boolean(checked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!on);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-60 ${
        on ? 'bg-emerald-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
        aria-hidden
      />
    </button>
  );
}

/** Group of related settings, with a heading. */
export function SettingsCard({ title, description, children, className = '', action }) {
  return (
    <Panel title={title} description={description} action={action} className={className} bodyClassName="space-y-5">
      {children}
    </Panel>
  );
}
