'use client';
import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useQueryClient } from 'react-query';

import { checkServer, useServerStatus } from 'src/services/serverStatus';

// Covers the app while the API cannot be reached, and lifts as soon as it
// answers again. It sits over the app rather than replacing it, so a half-
// filled form or a POS cart is still there when the connection returns.
//
// Same file in every staff app. Copy can be overridden through `copy` (the
// staff app passes its Bengali strings).

const RETRY_SECONDS = 10;

const DEFAULT_COPY = {
  title: "Can't reach the server",
  message:
    "The server isn't responding, so nothing can load or save right now. Anything you've typed on this screen is still here — this page reconnects on its own.",
  offlineTitle: "You're offline",
  offlineMessage:
    "This device has lost its internet connection. Check the Wi-Fi or cable — this page reconnects on its own once you're back online.",
  retry: 'Try again now',
  checking: 'Checking…',
  nextTry: 'Trying again in {s}s',
  lastChecked: 'Last checked {time}',
  help: 'If this lasts more than a few minutes, let your manager or IT know.',
};

function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function CloudOffIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 2l20 20" />
      <path d="M5.8 5.8A7 7 0 0 0 7.2 19H17a5 5 0 0 0 1.9-.4" />
      <path d="M21.5 15.4A4.5 4.5 0 0 0 17.5 9h-1.3A7 7 0 0 0 9.6 5.1" />
    </svg>
  );
}

function WifiOffIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.4a5 5 0 0 1 7 0" />
      <path d="M5 12.9a10 10 0 0 1 5.2-2.8" />
      <path d="M19 12.9a10 10 0 0 0-2.3-1.6" />
      <path d="M2 8.8a15 15 0 0 1 4.2-2.6" />
      <path d="M22 8.8A15 15 0 0 0 10.7 5" />
      <path d="M12 20h.01" />
    </svg>
  );
}

export default function ServerStatusGate({ copy }) {
  const text = { ...DEFAULT_COPY, ...copy };
  const queryClient = useQueryClient();
  const { down, checking, checkedAt } = useServerStatus();
  const [secondsLeft, setSecondsLeft] = useState(RETRY_SECONDS);
  const [offline, setOffline] = useState(false);
  const wasDown = useRef(false);
  const buttonRef = useRef(null);

  // One check on load, so a dead API shows this screen straight away instead
  // of a spinner that waits out every request's timeout.
  useEffect(() => {
    checkServer();
  }, []);

  // Coming back: refetch what failed while the server was away.
  useEffect(() => {
    if (down) {
      wasDown.current = true;
      buttonRef.current?.focus();
    } else if (wasDown.current) {
      wasDown.current = false;
      queryClient.invalidateQueries();
    }
  }, [down, queryClient]);

  // Countdown to the next automatic check; every finished check restarts it.
  useEffect(() => setSecondsLeft(RETRY_SECONDS), [checkedAt]);
  useEffect(() => {
    if (!down || checking) return undefined;
    if (secondsLeft <= 0) {
      checkServer();
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [down, checking, secondsLeft]);

  // Check at once when the device reconnects or the tab comes back into view.
  useEffect(() => {
    const syncOnline = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    const onOnline = () => {
      syncOnline();
      checkServer();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wasDown.current) checkServer();
    };
    syncOnline();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', syncOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', syncOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!down) return null;

  const title = offline ? text.offlineTitle : text.title;
  const message = offline ? text.offlineMessage : text.message;
  const time = checkedAt ? new Date(checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="server-status-title"
      aria-describedby="server-status-message"
      className="fixed inset-0 z-[1000] m-0 flex items-center justify-center overflow-y-auto px-4 py-10 backdrop-blur-sm"
      style={{ background: 'color-mix(in srgb, var(--canvas, #f6f7f9) 94%, transparent)' }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)] sm:p-8">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-50/60">
          {offline ? <WifiOffIcon /> : <CloudOffIcon />}
        </span>

        <h1 id="server-status-title" className="text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p id="server-status-message" className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
          {message}
        </p>

        <div
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
          aria-live="polite"
        >
          {checking ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" aria-hidden />
          ) : (
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
          )}
          {checking ? text.checking : fill(text.nextTry, { s: secondsLeft })}
        </div>

        <div className="mt-6">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => checkServer()}
            disabled={checking}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
          >
            {checking ? text.checking : text.retry}
          </button>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          <p>{text.help}</p>
          {time && <p className="mt-1 text-slate-400">{fill(text.lastChecked, { time })}</p>}
        </div>
      </div>
    </div>
  );
}

ServerStatusGate.propTypes = { copy: PropTypes.object };
