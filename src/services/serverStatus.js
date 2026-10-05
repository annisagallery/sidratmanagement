import { useSyncExternalStore } from 'react';

// Whether the API is reachable right now. Nothing here decides that from a
// single failed request — a slow report or one 503 from an integration is not
// an outage. A failed request only asks for a health check, and the health
// check alone flips the state. ServerStatusGate reads it and covers the app
// with the "server unavailable" screen while it is down.
//
// Same file in every staff app; only HEALTH_URL differs.

const HEALTH_URL = '/backend-api/health';
const HEALTH_TIMEOUT_MS = 8000;

let state = { down: false, checking: false, checkedAt: null };
let inflight = null;
const listeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot = { down: false, checking: false, checkedAt: null };

export function useServerStatus() {
  return useSyncExternalStore(subscribe, () => state, () => serverSnapshot);
}

export function isServerDown() {
  return state.down;
}

/** Any answer from the API proves it is up — called on every successful request. */
export function markServerUp() {
  if (state.down) set({ down: false, checkedAt: Date.now() });
}

/**
 * True when an axios error means the request never got an answer from the API:
 * no response at all, a gateway error, or the Next proxy's own non-JSON 500
 * when it cannot connect. The API itself always answers JSON.
 */
export function isUnreachable(error) {
  if (!error || error.code === 'ERR_CANCELED') return false;
  const response = error.response;
  if (!response) return true;
  if ([502, 503, 504].includes(response.status)) return true;
  const type = String(response.headers?.['content-type'] || '');
  return response.status >= 500 && !type.includes('json');
}

/** Pings the API once (deduplicated) and records the result. Browser only. */
export function checkServer() {
  if (typeof window === 'undefined') return Promise.resolve(true);
  if (inflight) return inflight;

  set({ checking: true });
  inflight = fetch(`${HEALTH_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  })
    .then((response) => {
      if ([502, 503, 504].includes(response.status)) return false;
      const type = response.headers.get('content-type') || '';
      return !(response.status >= 500 && !type.includes('json'));
    })
    .catch(() => false)
    .then((up) => {
      inflight = null;
      set({ down: !up, checking: false, checkedAt: Date.now() });
      return up;
    });

  return inflight;
}
