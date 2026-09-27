'use client';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { MdExpandMore, MdMoreVert } from 'react-icons/md';

/**
 * The secondary actions of a row, behind one "More" button — so a list shows
 * one obvious action per row instead of a strip of icons.
 *
 * items: [{ label, icon?, onClick, tone?: 'danger', disabled?, hidden?, separator? }]
 *
 * Pass `text` (and optionally `icon`) to show a labelled button such as
 * "Print" or "More" instead of the three-dot icon.
 *
 * The menu is positioned against the viewport, so a card or a scrolling table
 * that clips its contents never cuts it off; near the bottom of the screen it
 * opens upwards.
 *
 * Keyboard: Enter/Space/↓ opens and focuses the first item, ↑/↓ move, Escape
 * or Tab closes and returns focus to the button.
 */
const GAP = 4;

export default function ActionMenu({ items = [], label = 'More actions', align = 'right', text, icon: ButtonIcon }) {
  const [open, setOpen] = useState(false);
  const [fromKeyboard, setFromKeyboard] = useState(false);
  const [position, setPosition] = useState(null);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const visible = items.filter((item) => item && !item.hidden);

  const focusItem = (index) => {
    const nodes = menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])');
    if (!nodes?.length) return;
    nodes[(index + nodes.length) % nodes.length].focus();
  };

  const place = useCallback(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const height = menu.offsetHeight;
    const width = menu.offsetWidth;
    const below = window.innerHeight - rect.bottom;
    const up = below < height + GAP + 8 && rect.top > below;
    const top = up ? rect.top - height - GAP : rect.bottom + GAP;
    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPosition({ top, left });
  }, [align]);

  // Measured before paint, so the menu never flashes at a stale spot.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => !wrapRef.current?.contains(event.target) && setOpen(false);
    // The menu is pinned to where the button was; if the page moves, close it.
    const onScroll = (event) => !menuRef.current?.contains(event.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    if (fromKeyboard) requestAnimationFrame(() => focusItem(0));
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, fromKeyboard, place]);

  if (!visible.length) return null;

  const onMenuKey = (event) => {
    const nodes = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const index = nodes.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-block" onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        className={text ? 'btn-ghost' : 'btn-icon btn-icon-sm'}
        aria-label={text ? undefined : label}
        title={text ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          // A click that came from Enter/Space has no pointer position.
          setFromKeyboard(event.detail === 0);
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setFromKeyboard(true);
            setOpen(true);
          }
        }}
      >
        {text ? (
          <>
            {ButtonIcon ? <ButtonIcon size={16} aria-hidden /> : null}
            {text}
            <MdExpandMore size={17} className="-mr-1 text-slate-400" aria-hidden />
          </>
        ) : (
          <MdMoreVert size={18} aria-hidden />
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={text || label}
          onKeyDown={onMenuKey}
          style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
          className="fixed z-[90] min-w-[210px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl"
        >
          {visible.map((item) => {
            const Icon = item.icon;
            const danger = item.tone === 'danger';
            return (
              <div key={item.label}>
                {item.separator ? <div className="my-1 border-t border-slate-100" role="separator" /> : null}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                    danger ? 'text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50' : 'text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-100'
                  }`}
                >
                  {Icon ? <Icon size={17} aria-hidden className={danger ? 'text-rose-600' : 'text-slate-400'} /> : null}
                  {item.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
