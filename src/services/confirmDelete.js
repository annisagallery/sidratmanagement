// No 'use client' here on purpose: this is a plain module, not a component.
// Marking it client-only turns every export into a client reference, which
// breaks the server-rendered pages that import the axios instance downstream.
/**
 * Password re-confirmation for destructive requests, wired into axios once.
 *
 * The server answers every un-confirmed DELETE with 428 +
 * PASSWORD_CONFIRMATION_REQUIRED. Rather than teaching ~50 delete call sites to
 * collect a password, we intercept that response, prompt, and replay the exact
 * request with the token attached. Call sites stay `api.deleteX(id)`.
 *
 * The token is cached for the rest of its short life so clearing 30 rows costs
 * one prompt, not thirty, and concurrent 428s share a single prompt.
 */

import { AUTH_SCOPE, CONFIRMATION_CANCELLED, apiMessage, promptPassword } from 'src/utils/swal';

const CONFIRM_HEADER = 'x-confirm-token';
const CONFIRM_CODE = 'PASSWORD_CONFIRMATION_REQUIRED';
// Server mints a 5-minute token; expire ours early so a request never leaves
// with a token that dies in flight.
const CACHE_TTL_MS = 4 * 60 * 1000;

let cachedToken = null;
let cachedUntil = 0;
let pendingPrompt = null;

const cachedConfirmToken = () => (cachedToken && Date.now() < cachedUntil ? cachedToken : null);

export function clearConfirmToken() {
  cachedToken = null;
  cachedUntil = 0;
}

function cancelledError() {
  const error = new Error('Cancelled — your password was not confirmed, so nothing was deleted.');
  error.code = CONFIRMATION_CANCELLED;
  return error;
}

/** One prompt at a time, however many requests are waiting on it. */
function requestConfirmToken(http, message) {
  if (pendingPrompt) return pendingPrompt;

  pendingPrompt = promptPassword({
    text: message || 'Enter your account password to authorise this deletion.',
    verify: async (password) => {
      try {
        const { data } = await http.post('/account/confirm-password', { password, scope: AUTH_SCOPE });
        return { ok: true, token: data?.confirmToken };
      } catch (error) {
        return { ok: false, message: apiMessage(error, 'That password did not match your account.') };
      }
    }
  })
    .then((token) => {
      if (token) {
        cachedToken = token;
        cachedUntil = Date.now() + CACHE_TTL_MS;
      }
      return token;
    })
    .finally(() => {
      pendingPrompt = null;
    });

  return pendingPrompt;
}

const needsConfirmation = (error) =>
  error?.response?.status === 428 && error.response?.data?.code === CONFIRM_CODE;

/**
 * Installs the request/response pair on an axios instance. Register it after
 * the app's own 401 handler — a 428 falls straight through that one.
 */
export function attachPasswordConfirmation(http) {
  http.interceptors.request.use((config) => {
    if (String(config.method || '').toLowerCase() === 'delete') {
      const token = cachedConfirmToken();
      if (token) config.headers = { ...config.headers, [CONFIRM_HEADER]: token };
    }
    return config;
  });

  http.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (typeof window === 'undefined' || !needsConfirmation(error)) return Promise.reject(error);

      const config = error.config || {};
      // A rejected token (expired, or minted for another account) is worthless —
      // drop it so the retry prompts instead of replaying the same failure.
      clearConfirmToken();
      if ((config.__passwordConfirmAttempts || 0) >= 2) return Promise.reject(error);

      const token = await requestConfirmToken(http, error.response?.data?.message);
      if (!token) return Promise.reject(cancelledError());

      return http({
        ...config,
        __passwordConfirmAttempts: (config.__passwordConfirmAttempts || 0) + 1,
        headers: { ...config.headers, [CONFIRM_HEADER]: token }
      });
    }
  );

  return http;
}
