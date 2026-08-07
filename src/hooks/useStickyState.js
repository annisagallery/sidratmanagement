'use client';

import { useEffect, useState } from 'react';

/**
 * State that survives navigating away and coming back.
 *
 * Built for the print baskets. Picking forty orders for a dispatch run, or a
 * dozen variations for a label sheet, is several minutes of work, and it was
 * being thrown away by anything that unmounted the page — opening an order to
 * check it, following a link, a stray back button. Losing it is worse than
 * annoying: you cannot tell from looking which of the forty you had already
 * ticked, so you start again.
 *
 * ── Why the value is not seeded from storage on first render ────────────────
 * These pages are server-rendered before they hydrate, and there is no
 * localStorage on the server. Reading it inside `useState(() => …)` would make
 * the client's first render disagree with the server's markup, which React
 * treats as a hydration error. So the first render is always the initial value
 * and storage is read immediately afterwards, on mount.
 *
 * That ordering needs care: both effects run in the same commit, and the write
 * would otherwise fire while the state is still the empty initial value —
 * erasing the basket it was about to restore. `ready` gates the write until
 * after the read has landed.
 */
export default function useStickyState(storageKey, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        /* The one extra render is the point — see the note above. The rule's
           alternative is reading storage during render, which is exactly the
           hydration mismatch this hook exists to avoid. */
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed && typeof parsed === 'object') setValue(parsed);
      }
    } catch {
      // Corrupt JSON, private mode, or storage disabled. Starting empty is the
      // behaviour we had before this existed, so it is a safe floor.
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Over quota, or storage unavailable. Remembering the basket is a
      // convenience; failing to remember it must never break the page.
    }
  }, [ready, storageKey, value]);

  return [value, setValue, ready];
}
