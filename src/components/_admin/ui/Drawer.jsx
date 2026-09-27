'use client';
import { useEffect, useId, useRef } from 'react';
import { MdClose } from 'react-icons/md';

const WIDTHS = {
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-6xl'
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour every overlay shares: focus moves in on open, Tab stays
 * inside, Escape calls `onClose`, and focus returns to whatever opened it.
 * A SweetAlert confirm opened on top owns the keyboard while it is up.
 */
export function useOverlayKeys(panelRef, onClose, initialFocus) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    const first = initialFocus ? panel?.querySelector(initialFocus) : null;
    // Respect a child that already took focus (an autofocused scan field).
    if (first) first.focus();
    else if (!panel?.contains(document.activeElement)) panel?.focus();

    const onKey = (event) => {
      if (document.querySelector('.swal2-container')) return;
      // Only the top-most overlay reacts.
      const overlays = document.querySelectorAll('[data-overlay]');
      if (overlays.length && overlays[overlays.length - 1] !== panel) return;
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return;
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocus]);
}

/**
 * Side panel for editing or inspecting one record without leaving the list.
 *
 * The header and footer stay put while the body scrolls, so Save is always in
 * reach however long the form. Pass `onSubmit` and the panel becomes the
 * <form>, so a submit button in `footer` works and Enter submits.
 * `size` is md | lg | xl; `width` takes a max-width class instead.
 */
export default function Drawer({ title, subtitle, eyebrow, onClose, onSubmit, footer, size = 'md', width, children, initialFocus }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayKeys(panelRef, onClose, initialFocus);

  const Tag = onSubmit ? 'form' : 'div';

  return (
    <div className="fixed inset-0 z-[70] !m-0 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => onClose?.()} aria-hidden />
      <Tag
        ref={panelRef}
        data-overlay=""
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onSubmit={onSubmit}
        noValidate={onSubmit ? true : undefined}
        className={`relative flex h-full w-full flex-col bg-white shadow-2xl ${width || WIDTHS[size] || WIDTHS.md}`}
      >
        <header className="flex shrink-0 items-start gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="section-label mb-1">{eyebrow}</p>}
            <h2 id={titleId} className="truncate text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 truncate text-[13px] text-slate-500">{subtitle}</div>}
          </div>
          <button type="button" className="btn-icon -mr-2 -mt-1" onClick={() => onClose?.()} aria-label="Close">
            <MdClose size={20} />
          </button>
        </header>

        <div className="admin-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">{children}</div>

        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
            {footer}
          </footer>
        )}
      </Tag>
    </div>
  );
}

/**
 * The panel of a hand-built overlay: gives it dialog semantics and the shared
 * keyboard behaviour (focus in, Tab contained, Escape closes, focus restored).
 * Drop-in for the overlay's inner panel element; mounting it is opening it.
 */
export function OverlayPanel({ as: Tag = 'div', onClose, label, children, ...rest }) {
  const ref = useRef(null);
  useOverlayKeys(ref, onClose);
  return (
    <Tag ref={ref} data-overlay="" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} {...rest}>
      {children}
    </Tag>
  );
}
