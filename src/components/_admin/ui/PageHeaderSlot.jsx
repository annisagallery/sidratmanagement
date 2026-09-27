'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const PAGE_ACTIONS_ID = 'page-header-actions';

/**
 * Renders children into the shell's page header (beside the title) when the
 * shell drew one for this page; otherwise reports that it could not, so the
 * caller can draw its own header.
 */
export function usePageHeaderSlot() {
  const [slot, setSlot] = useState(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setSlot(document.getElementById(PAGE_ACTIONS_ID));
    setChecked(true);
  }, []);
  return { slot, checked };
}

export function PageActionsPortal({ slot, children }) {
  if (!slot || !children) return null;
  return createPortal(children, slot);
}
