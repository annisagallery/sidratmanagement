// No 'use client' here on purpose: this is a plain module, not a component.
// Marking it client-only turns every export into a client reference, which
// breaks the server-rendered pages that import the axios instance downstream.
/**
 * The one place dialogs are defined for this app.
 *
 * SweetAlert's stock look (big animated icon, blue OK button, `Swal.fire(msg)`
 * positional args) had drifted into every list and form with a different tone
 * and wording each time. Everything here renders through one template so a
 * confirm, an error and a bulk summary read as the same product, and so the
 * copy can be reviewed in one file instead of two hundred call sites.
 *
 * Call sites should never reach for `Swal.fire` directly — add a helper here.
 */

import Swal from 'sweetalert2';

// Session scope for password re-confirmation, and the CSS variable this app
// paints its accents with. These two lines are what differ between apps.
export const AUTH_SCOPE = 'admin';
const BRAND_VAR = '--brand';

const STYLE_ID = 'sidrat-swal-styles';

const TONES = {
  success: { accent: '#059669', soft: '#ecfdf5', ring: 'rgba(5,150,105,.18)' },
  danger: { accent: '#e11d48', soft: '#fff1f2', ring: 'rgba(225,29,72,.18)' },
  warning: { accent: '#d97706', soft: '#fffbeb', ring: 'rgba(217,119,6,.18)' },
  info: { accent: '#0284c7', soft: '#f0f9ff', ring: 'rgba(2,132,199,.18)' },
  question: { accent: '#475569', soft: '#f8fafc', ring: 'rgba(71,85,105,.16)' }
};

const ICONS = {
  success: '<path d="M20 6 9 17l-5-5"/>',
  danger: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/>',
  warning: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  info: '<path d="M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"/>',
  question: '<path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"/>',
  lock: '<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"/>'
};

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

const brandColor = () => {
  if (typeof window === 'undefined') return '#c8a96e';
  const value = getComputedStyle(document.documentElement).getPropertyValue(BRAND_VAR).trim();
  return value || '#c8a96e';
};

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .sw-popup{width:min(430px,92vw);border-radius:18px;padding:26px 24px 20px;font-family:inherit;
      box-shadow:0 24px 60px -22px rgba(15,23,42,.4),0 0 0 1px rgba(15,23,42,.06)}
    .sw-html{margin:0!important;padding:0!important}
    .sw-icon{width:52px;height:52px;margin:0 auto 14px;border-radius:16px;display:flex;
      align-items:center;justify-content:center}
    .sw-title{margin:0;font-size:17px;font-weight:700;line-height:1.35;color:#0f172a;text-align:center;
      overflow-wrap:anywhere}
    .sw-text{margin:7px auto 0;max-width:34ch;font-size:13.5px;line-height:1.6;color:#64748b;text-align:center;
      overflow-wrap:anywhere}
    .sw-subject{margin:14px 0 0;padding:10px 12px;border-radius:10px;background:#f8fafc;
      border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#0f172a;text-align:center;
      overflow-wrap:anywhere}
    .sw-list{margin:14px 0 0;padding:0;list-style:none;text-align:left;max-height:190px;overflow-y:auto}
    .sw-list li{display:flex;gap:8px;padding:8px 11px;margin-bottom:6px;border-radius:9px;background:#f8fafc;
      border-left:3px solid var(--sw-accent);font-size:12.5px;line-height:1.55;color:#334155;
      overflow-wrap:anywhere}
    .sw-list li:last-child{margin-bottom:0}
    .sw-more{margin:8px 0 0;font-size:12px;color:#94a3b8;text-align:center}
    .sw-field{margin:16px 0 0;text-align:left}
    .sw-actions{margin:20px 0 0;gap:8px;flex-wrap:wrap-reverse}
    .sw-btn{min-height:40px;padding:0 18px;border:0;border-radius:10px;font-size:13.5px;font-weight:600;
      cursor:pointer;transition:filter .15s,background .15s;box-shadow:none}
    .sw-btn:focus-visible{outline:2px solid var(--sw-accent);outline-offset:2px}
    .sw-confirm{background:var(--sw-accent);color:#fff}
    .sw-confirm:hover{filter:brightness(.93)}
    .sw-cancel{background:#f1f5f9;color:#475569}
    .sw-cancel:hover{background:#e2e8f0}
    .sw-deny{background:#fff1f2;color:#be123c}
    .sw-deny:hover{background:#ffe4e6}
    .sw-input{width:100%!important;height:42px!important;margin:0!important;padding:0 13px!important;
      border:1px solid #cbd5e1!important;border-radius:10px!important;font-size:14px!important;
      background:#fff!important;box-shadow:none!important;color:#0f172a!important}
    .sw-input:focus{border-color:var(--sw-accent)!important;box-shadow:0 0 0 3px var(--sw-ring)!important}
    .sw-label{display:block;margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.02em;
      text-transform:uppercase;color:#64748b}
    .sw-validation{border-radius:10px!important;background:#fff1f2!important;color:#be123c!important;
      font-size:12.5px!important;font-weight:500!important;padding:9px 12px!important;margin:12px 0 0!important}
    .sw-toast{border-radius:12px!important;padding:12px 14px!important;
      box-shadow:0 12px 30px -12px rgba(15,23,42,.45),0 0 0 1px rgba(15,23,42,.06)!important}
    .sw-toast .sw-title{font-size:13.5px;text-align:left}
    .sw-toast .sw-text{margin:2px 0 0;max-width:none;text-align:left;font-size:12.5px}
    .sw-toast .sw-icon{width:30px;height:30px;border-radius:9px;margin:0 11px 0 0}
    .sw-toast-body{display:flex;align-items:center}

    /* SweetAlert's own defaults, restyled to match.
       Not every dialog in the app has been moved onto the helpers above yet, and
       a half-converted app looks worse than an unconverted one. These rules make
       a plain Swal.fire() land in the same visual language, so the migration can
       finish call site by call site without the UI ever looking mixed. */
    .swal2-popup{border-radius:18px!important;padding:26px 24px 20px!important;font-family:inherit!important;
      width:min(430px,92vw)!important;
      box-shadow:0 24px 60px -22px rgba(15,23,42,.4),0 0 0 1px rgba(15,23,42,.06)!important}
    .swal2-title{font-size:17px!important;font-weight:700!important;color:#0f172a!important;
      padding:0!important;line-height:1.35!important}
    .swal2-html-container{font-size:13.5px!important;line-height:1.6!important;color:#64748b!important;
      margin:7px 0 0!important;padding:0!important}
    .swal2-icon{width:52px!important;height:52px!important;margin:0 auto 14px!important;
      border-width:3px!important}
    .swal2-icon .swal2-icon-content{font-size:26px!important}
    .swal2-actions{margin:20px 0 0!important;gap:8px!important;flex-wrap:wrap-reverse!important}
    .swal2-styled{min-height:40px!important;padding:0 18px!important;border-radius:10px!important;
      font-size:13.5px!important;font-weight:600!important;box-shadow:none!important;margin:0!important}
    .swal2-styled.swal2-confirm{background:#0f172a!important;color:#fff!important}
    .swal2-styled.swal2-deny{background:#fff1f2!important;color:#be123c!important}
    .swal2-styled.swal2-cancel{background:#f1f5f9!important;color:#475569!important}
    .swal2-input,.swal2-textarea,.swal2-select,.swal2-file{border:1px solid #cbd5e1!important;
      border-radius:10px!important;font-size:14px!important;box-shadow:none!important;
      margin:14px 0 0!important;color:#0f172a!important}
    .swal2-input:focus,.swal2-textarea:focus,.swal2-select:focus{border-color:#0f172a!important;
      box-shadow:0 0 0 3px rgba(15,23,42,.12)!important}
    .swal2-validation-message{border-radius:10px!important;background:#fff1f2!important;
      color:#be123c!important;font-size:12.5px!important;font-weight:500!important;
      padding:9px 12px!important;margin:12px 0 0!important}
    .swal2-timer-progress-bar{background:rgba(15,23,42,.2)!important}
  `;
  document.head.appendChild(style);
}

// Injected on import rather than on first dialog: an un-migrated `Swal.fire()`
// elsewhere in the app must not be the one dialog that renders unstyled.
ensureStyles();

const iconMarkup = (tone, glyph) => {
  const { accent, soft } = TONES[tone] || TONES.question;
  const path = ICONS[glyph || tone] || ICONS.question;
  return `<div class="sw-icon" style="background:${soft};color:${accent}">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>
  </div>`;
};

const listMarkup = (items = [], limit = 6) => {
  if (!items.length) return '';
  const shown = items.slice(0, limit);
  const hidden = items.length - shown.length;
  return (
    `<ul class="sw-list">${shown.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` +
    (hidden > 0 ? `<p class="sw-more">and ${hidden} more</p>` : '')
  );
};

const bodyMarkup = ({ tone, glyph, title, text, subject, items, itemLimit }) =>
  [
    iconMarkup(tone, glyph),
    `<h2 class="sw-title">${escapeHtml(title)}</h2>`,
    text ? `<p class="sw-text">${escapeHtml(text)}</p>` : '',
    subject ? `<p class="sw-subject">${escapeHtml(subject)}</p>` : '',
    listMarkup(items, itemLimit)
  ].join('');

/** Every dialog in the app is one of these. */
function baseDialog({ tone = 'question', ...options }) {
  ensureStyles();
  const { accent, ring } = TONES[tone] || TONES.question;
  const themedAccent = tone === 'info' ? brandColor() : accent;
  return {
    buttonsStyling: false,
    reverseButtons: true,
    focusConfirm: false,
    heightAuto: false,
    customClass: {
      popup: 'sw-popup',
      htmlContainer: 'sw-html',
      actions: 'sw-actions',
      confirmButton: 'sw-btn sw-confirm',
      cancelButton: 'sw-btn sw-cancel',
      denyButton: 'sw-btn sw-deny',
      input: 'sw-input',
      validationMessage: 'sw-validation'
    },
    didOpen: (popup) => {
      popup.style.setProperty('--sw-accent', themedAccent);
      popup.style.setProperty('--sw-ring', ring);
    },
    ...options
  };
}

// ── Reading an API failure ────────────────────────────────────────────────────

const STATUS_FALLBACK = {
  400: "That request wasn't valid. Please check the details and try again.",
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: "That record no longer exists — it may have been deleted already.",
  409: 'That conflicts with existing data. Refresh and try again.',
  413: 'That upload is too large.',
  422: 'Some values were rejected. Please review the form.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server hit an unexpected error. Please try again.',
  502: 'The server is unreachable right now. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  504: 'The server took too long to respond. Please try again.'
};

export const CONFIRMATION_CANCELLED = 'PASSWORD_CONFIRMATION_CANCELLED';

/**
 * True when the request never left the browser because the operator dismissed
 * the password prompt. Deliberate backing-out is not a failure, so the alert
 * helpers below swallow it rather than shouting an error at someone who just
 * changed their mind.
 */
export const isConfirmationCancelled = (error) => error?.code === CONFIRMATION_CANCELLED;

/** Pulls the most specific human-readable message out of an axios/JS error. */
export function apiMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const data = error.response?.data;
  const candidate =
    data?.message ||
    (typeof data?.error === 'string' ? data.error : data?.error?.message) ||
    (Array.isArray(data?.errors) ? data.errors.filter(Boolean).join(' ') : '');
  if (candidate) return String(candidate);

  if (error.code === 'ECONNABORTED') return 'The request timed out. Please check your connection and try again.';
  if (error.code === 'ERR_NETWORK' || (!error.response && error.request)) {
    return "Can't reach the server. Check your connection and try again.";
  }

  const status = error.response?.status;
  return STATUS_FALLBACK[status] || error.message || fallback;
}

/** Per-item failures from a bulk run, as "<label> — <reason>" lines. */
export const failureLines = (failures = []) =>
  failures.map(({ label, error }) => `${label} — ${apiMessage(error)}`);

// ── Notices ───────────────────────────────────────────────────────────────────

export const alertSuccess = (title, text, options = {}) =>
  Swal.fire(
    baseDialog({
      tone: 'success',
      html: bodyMarkup({ tone: 'success', title, text, ...options }),
      confirmButtonText: options.confirmText || 'Done',
      ...options.swal
    })
  );

export const alertError = (error, { title = "That didn't work", text, ...options } = {}) =>
  isConfirmationCancelled(error)
    ? Promise.resolve({ isDismissed: true })
    : Swal.fire(
    baseDialog({
      tone: 'danger',
      glyph: 'warning',
      html: bodyMarkup({
        tone: 'danger',
        glyph: 'warning',
        title,
        text: text || apiMessage(error),
        ...options
      }),
      confirmButtonText: options.confirmText || 'Close',
      ...options.swal
    })
  );

export const alertWarning = (title, text, options = {}) =>
  Swal.fire(
    baseDialog({
      tone: 'warning',
      html: bodyMarkup({ tone: 'warning', title, text, ...options }),
      confirmButtonText: options.confirmText || 'Got it',
      ...options.swal
    })
  );

export const alertInfo = (title, text, options = {}) =>
  Swal.fire(
    baseDialog({
      tone: 'info',
      html: bodyMarkup({ tone: 'info', title, text, ...options }),
      confirmButtonText: options.confirmText || 'Got it',
      ...options.swal
    })
  );

// ── Confirmations ─────────────────────────────────────────────────────────────

/**
 * Generic "are you sure". Resolves true only when the operator confirms, so
 * call sites read `if (!(await confirmAction(...))) return;`.
 */
export async function confirmAction({
  title,
  text,
  subject,
  items,
  tone = 'question',
  glyph,
  confirmText = 'Continue',
  cancelText = 'Cancel'
} = {}) {
  const result = await Swal.fire(
    baseDialog({
      tone,
      html: bodyMarkup({ tone, glyph, title, text, subject, items }),
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText
    })
  );
  return result.isConfirmed;
}

/**
 * The confirm shown before anything is destroyed. The server independently
 * demands a password for the DELETE itself (see the 428 handling in http.js),
 * so this step is about making the operator read *what* is going away.
 */
export function confirmDelete({
  subject,
  count,
  unit = 'records',
  title,
  text,
  items,
  confirmText,
  cancelText = 'Keep it',
  // Translated apps override this; everything else inherits the English note.
  passwordNote = "You'll be asked for your password next.",
  recoverable = true
} = {}) {
  const many = typeof count === 'number' && count > 1;
  const resolvedTitle =
    title || (many ? `Delete ${count} ${unit}?` : subject ? 'Delete this record?' : 'Delete this?');
  const resolvedText =
    text ||
    (recoverable
      ? 'It will be moved to the recycle bin, where a super admin can restore it.'
      : 'This cannot be undone.');

  return confirmAction({
    tone: 'danger',
    glyph: 'danger',
    title: resolvedTitle,
    text: [resolvedText, passwordNote].filter(Boolean).join(' '),
    subject: many ? undefined : subject,
    items: many ? items : undefined,
    confirmText: confirmText || (many ? `Delete ${count}` : 'Delete'),
    cancelText
  });
}

/**
 * Password re-entry. `verify` is injected by the caller (http.js owns the API
 * call) so this module stays free of network dependencies.
 */
export async function promptPassword({
  title = 'Confirm it’s you',
  text = 'Enter your account password to authorise this deletion.',
  subject,
  confirmText = 'Confirm',
  verify
} = {}) {
  const result = await Swal.fire(
    baseDialog({
      tone: 'danger',
      glyph: 'lock',
      html: `${bodyMarkup({ tone: 'danger', glyph: 'lock', title, text, subject })}
        <div class="sw-field"><label class="sw-label" for="sw-password">Your password</label></div>`,
      input: 'password',
      inputAttributes: {
        id: 'sw-password',
        autocomplete: 'current-password',
        autocapitalize: 'off',
        spellcheck: 'false',
        placeholder: '••••••••'
      },
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancel',
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async (password) => {
        if (!password) return Swal.showValidationMessage('Enter your password to continue.');
        if (!verify) return password;
        const outcome = await verify(password);
        if (outcome?.ok) return outcome.token ?? password;
        return Swal.showValidationMessage(outcome?.message || 'That password did not match.');
      },
      showLoaderOnConfirm: true
    })
  );
  return result.isConfirmed ? result.value : null;
}

/**
 * Collects a short piece of writing a bulk action needs once — the reason
 * behind a rejection, a note attached to every row it touches. Resolves to the
 * trimmed text, or null if they backed out.
 */
export async function promptText({
  title,
  text,
  label = 'Note',
  placeholder = '',
  confirmText = 'Continue',
  tone = 'question',
  required = true,
  requiredMessage = 'Write something first.',
  multiline = true
} = {}) {
  const result = await Swal.fire(
    baseDialog({
      tone,
      html: `${bodyMarkup({ tone, title, text })}
        <div class="sw-field"><span class="sw-label">${escapeHtml(label)}</span></div>`,
      input: multiline ? 'textarea' : 'text',
      inputPlaceholder: placeholder,
      inputAttributes: { 'aria-label': label },
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancel',
      inputValidator: (value) => (required && !String(value || '').trim() ? requiredMessage : undefined)
    })
  );
  return result.isConfirmed ? String(result.value || '').trim() : null;
}

/**
 * Asks the operator to pick one option before a bulk action runs — which status
 * to move 12 orders to, which tag to apply. Resolves to the chosen value, or
 * null if they backed out.
 *
 * `options`: [{ value, label }]
 */
export async function promptSelect({
  title,
  text,
  options = [],
  placeholder = 'Choose one…',
  confirmText = 'Apply',
  tone = 'question',
  requiredMessage = 'Pick an option to continue.'
} = {}) {
  const result = await Swal.fire(
    baseDialog({
      tone,
      html: `${bodyMarkup({ tone, title, text })}<div class="sw-field"></div>`,
      input: 'select',
      inputOptions: options.reduce((map, option) => ({ ...map, [option.value]: option.label }), {}),
      inputPlaceholder: placeholder,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancel',
      inputValidator: (value) => (value ? undefined : requiredMessage)
    })
  );
  return result.isConfirmed ? result.value : null;
}

// ── Progress + results ────────────────────────────────────────────────────────

/** Blocking spinner for multi-request bulk work. Always pair with closeProgress. */
export function openProgress(title = 'Working…', text = 'Please keep this tab open.') {
  ensureStyles();
  return Swal.fire(
    baseDialog({
      tone: 'info',
      html: bodyMarkup({ tone: 'info', title, text }),
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: (popup) => {
        popup.style.setProperty('--sw-accent', brandColor());
        popup.style.setProperty('--sw-ring', TONES.info.ring);
        Swal.showLoading(null);
      }
    })
  );
}

export const closeProgress = () => Swal.close();

/**
 * Outcome of a bulk action. Partial success is the common case — a few rows
 * fail a business rule while the rest go through — and it deserves its own
 * shape rather than being flattened into "error".
 */
export function alertBulkResult({ action = 'Updated', unit = 'records', succeeded = 0, failures = [] } = {}) {
  // A dismissed password prompt aborts the whole run; reporting each remaining
  // row as its own failure would bury the one thing that actually happened.
  if (failures.some(({ error }) => isConfirmationCancelled(error))) {
    return succeeded
      ? alertWarning(
          `Stopped after ${succeeded} ${unit}`,
          'The rest were left untouched because the password prompt was dismissed.'
        )
      : Promise.resolve({ isDismissed: true });
  }
  if (!failures.length) {
    return alertSuccess(`${action} ${succeeded} ${unit}`, 'Everything went through.');
  }
  if (!succeeded) {
    return alertError(null, {
      title: `Couldn't ${action.toLowerCase()} ${failures.length === 1 ? `this ${unit.replace(/s$/, '')}` : `any of the ${failures.length} ${unit}`}`,
      text: 'Nothing was changed. See what blocked it below.',
      items: failureLines(failures)
    });
  }
  return Swal.fire(
    baseDialog({
      tone: 'warning',
      html: bodyMarkup({
        tone: 'warning',
        title: `${action} ${succeeded} of ${succeeded + failures.length} ${unit}`,
        text: `${failures.length} could not be processed and ${failures.length === 1 ? 'was' : 'were'} left unchanged.`,
        items: failureLines(failures)
      }),
      confirmButtonText: 'Got it'
    })
  );
}

// ── Toasts ────────────────────────────────────────────────────────────────────

const toast = (tone, title, text) => {
  ensureStyles();
  const { accent, ring } = TONES[tone] || TONES.info;
  return Swal.fire({
    toast: true,
    position: 'top-end',
    timer: tone === 'danger' ? 5000 : 2800,
    timerProgressBar: true,
    showConfirmButton: false,
    heightAuto: false,
    html: `<div class="sw-toast-body">${iconMarkup(tone)}<div>
        <p class="sw-title">${escapeHtml(title)}</p>
        ${text ? `<p class="sw-text">${escapeHtml(text)}</p>` : ''}
      </div></div>`,
    customClass: { popup: 'sw-popup sw-toast', htmlContainer: 'sw-html' },
    didOpen: (popup) => {
      popup.style.setProperty('--sw-accent', tone === 'info' ? brandColor() : accent);
      popup.style.setProperty('--sw-ring', ring);
    }
  });
};

export const toastSuccess = (title, text) => toast('success', title, text);
export const toastError = (error, title = "That didn't work") =>
  isConfirmationCancelled(error) ? Promise.resolve({ isDismissed: true }) : toast('danger', title, apiMessage(error));
export const toastInfo = (title, text) => toast('info', title, text);
