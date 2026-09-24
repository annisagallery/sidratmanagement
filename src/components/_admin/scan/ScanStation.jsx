'use client';

/**
 * Shared scan surface for the receipt and packing stations.
 *
 * A USB barcode gun is a keyboard that types fast and presses Enter. Everything
 * here follows from that and from where these screens are used — standing up,
 * hands full, in a noisy room:
 *
 *   - focus is taken on mount and taken BACK whenever it is lost, because a
 *     blurred input silently drops scans and the operator cannot tell;
 *   - feedback is colour and sound together, so a bad scan registers even if
 *     nobody is looking at the screen;
 *   - the outcome of the last scan stays put until the next one, rather than
 *     auto-dismissing like a toast.
 *
 * It looks like the rest of the admin — same input, card and badge styling.
 *
 * The consumer owns what a scan means; this owns making the scan arrive.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { MdQrCodeScanner } from 'react-icons/md';

function useScanTone() {
  const contextRef = useRef(null);

  return useCallback((success) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = contextRef.current || new AudioContext();
      contextRef.current = context;
      // A rising single tone reads as "accepted"; a low two-tone buzz reads as
      // "stop" without anyone needing to hear which word was said.
      (success ? [880] : [220, 165]).forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + index * 0.13;
        oscillator.type = success ? 'sine' : 'square';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(success ? 0.12 : 0.16, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.12);
      });
    } catch {
      // Audio is an enhancement; a station with no sound device still works.
    }
  }, []);
}

export default function ScanStation({
  onScan,
  label = 'Scan barcode',
  placeholder = 'Scan or type a code, then press Enter',
  hint = null,
  disabled = false,
  disabledReason = null,
  autoFocus = true,
  historyLimit = 8,
  appearance = 'default'
}) {
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const tone = useScanTone();
  const isDesk = appearance === 'desk';

  const focus = useCallback(() => {
    if (!disabled) requestAnimationFrame(() => inputRef.current?.focus());
  }, [disabled]);

  useEffect(() => {
    if (autoFocus) focus();
  }, [autoFocus, focus]);

  // Focus retention. Clicking a button, dismissing a toast, or tabbing away all
  // leave the gun typing into nothing; take focus back unless the operator is
  // deliberately typing somewhere else.
  useEffect(() => {
    const reclaim = (event) => {
      const target = event.target;
      // SELECT matters as much as INPUT here: stealing focus back mid-click
      // would close a dropdown the operator just opened (the packing station's
      // manual-assignment picker), making it unusable.
      const interactingElsewhere =
        target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(target.tagName) ||
          target.isContentEditable ||
          Boolean(target.closest('select, [role="listbox"], .swal2-container'))) &&
        target !== inputRef.current;
      if (!interactingElsewhere) focus();
    };
    window.addEventListener('click', reclaim);
    window.addEventListener('focus', reclaim);
    return () => {
      window.removeEventListener('click', reclaim);
      window.removeEventListener('focus', reclaim);
    };
  }, [focus]);

  const submit = async (event) => {
    event?.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value || busy || disabled) return;

    setBusy(true);
    setCode('');
    try {
      const outcome = (await onScan(value)) || {};
      const ok = outcome.ok !== false;
      tone(ok);
      setFeedback({ ok, message: outcome.message || (ok ? 'Accepted.' : 'Rejected.'), detail: outcome.detail, code: value });
      setHistory((entries) =>
        [{ code: value, ok, message: outcome.message, at: new Date() }, ...entries].slice(0, historyLimit)
      );
    } catch (error) {
      tone(false);
      const message = error?.response?.data?.message || error?.message || 'That scan could not be processed.';
      setFeedback({ ok: false, message, code: value });
      setHistory((entries) => [{ code: value, ok: false, message, at: new Date() }, ...entries].slice(0, historyLimit));
    } finally {
      setBusy(false);
      focus();
    }
  };

  return (
    <div className={isDesk ? 'space-y-4' : 'space-y-3'}>
      <form onSubmit={submit}>
        <label
          className={
            isDesk
              ? 'mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-300'
              : 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500'
          }
        >
          {label}
        </label>
        <div className="relative">
          <MdQrCodeScanner
            className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${
              isDesk ? 'text-2xl text-slate-400' : 'text-lg text-slate-400'
            }`}
          />
          <input
            ref={inputRef}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={disabled || busy}
            placeholder={disabled ? disabledReason || 'Scanning unavailable' : placeholder}
            autoComplete="off"
            spellCheck={false}
            className={
              isDesk
                ? 'ops-code h-16 w-full rounded-xl border-2 border-slate-500 bg-white pl-14 pr-12 text-lg font-bold uppercase text-slate-950 shadow-[0_8px_24px_rgba(2,6,23,0.28)] outline-none transition placeholder:font-medium placeholder:normal-case placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-ring)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'
                : 'input-ui ops-code h-11 pl-10 text-base uppercase'
            }
          />
          {busy ? (
            <FiLoader className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
          ) : null}
        </div>
        {hint ? <p className={`mt-1.5 text-xs ${isDesk ? 'text-slate-400' : 'text-slate-500'}`}>{hint}</p> : null}
        {disabled && disabledReason ? (
          <p className={`mt-1.5 text-xs font-semibold ${isDesk ? 'text-amber-300' : 'text-amber-700'}`}>
            {disabledReason}
          </p>
        ) : null}
      </form>

      {feedback ? (
        <div
          role="status"
          aria-live="assertive"
          className={`flex items-start gap-3 border ${isDesk ? 'rounded-xl px-4 py-3' : 'rounded-md px-3 py-2'} ${
            feedback.ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
          }`}
        >
          {feedback.ok ? (
            <FiCheckCircle className={`${isDesk ? 'text-xl' : 'mt-0.5'} shrink-0 text-emerald-600`} />
          ) : (
            <FiAlertTriangle className={`${isDesk ? 'text-xl' : 'mt-0.5'} shrink-0 text-rose-600`} />
          )}
          <div className="min-w-0">
            <p
              className={`${isDesk ? 'text-sm font-bold' : 'text-[13px] font-semibold'} ${
                feedback.ok ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              {feedback.message}
            </p>
            <p className="ops-code text-xs text-slate-500">{feedback.code}</p>
            {feedback.detail ? <p className="mt-0.5 text-xs text-slate-600">{feedback.detail}</p> : null}
          </div>
        </div>
      ) : null}

      {history.length ? (
        <ul
          className={`${
            isDesk ? 'overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60 divide-slate-700' : 'card-ui divide-slate-100'
          } divide-y`}
        >
          {history.map((entry, index) => (
            <li key={`${entry.code}-${index}`} className={`flex items-center gap-2 px-3 ${isDesk ? 'py-2.5' : 'py-1.5'}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${entry.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className={`ops-code text-xs font-semibold ${isDesk ? 'text-slate-100' : 'text-slate-700'}`}>{entry.code}</span>
              <span className={`truncate text-xs ${isDesk ? 'text-slate-400' : 'text-slate-500'}`}>{entry.message}</span>
              <span className={`ml-auto shrink-0 text-[10px] font-semibold ${isDesk ? 'text-slate-500' : 'text-slate-400'}`}>
                {entry.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
