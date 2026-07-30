'use client';

/**
 * Renders the order's legal next moves, as sent by the server.
 *
 * This replaces a status <select>. An operator choosing a status from a list is
 * how orders got shipped without stock being consumed and delivered without
 * rewards firing — the correctness of the flow depended on someone picking the
 * right word. Here the operator performs an act and the status follows.
 *
 * Blocked actions stay visible with their reason. Hiding a button leaves people
 * guessing why the next step vanished; `blockedBy` is the most-read text in
 * this screen, so it is rendered plainly rather than hidden in a tooltip.
 */

import { useState } from 'react';
import Swal from 'sweetalert2';
import { FiCheckCircle, FiPackage, FiTruck, FiXCircle, FiCornerUpLeft, FiLoader } from 'react-icons/fi';

const ICONS = {
  CONFIRM: FiCheckCircle,
  PACK: FiPackage,
  SHIP: FiTruck,
  DELIVER: FiCheckCircle,
  CANCEL: FiXCircle,
  RETURN: FiCornerUpLeft,
};

const INTENT_CLASS = {
  primary: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  default: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
};

export default function ActionBar({ actions = [], onAction, busyAction = null }) {
  const [pending, setPending] = useState(null);

  if (!actions.length) {
    return <p className="text-xs text-slate-500">No actions are available for this order.</p>;
  }

  const run = async (action) => {
    // Destructiveness is the server's call, not the client's: if it sent
    // `confirm` text, we must ask using exactly that wording.
    if (action.confirm) {
      const result = await Swal.fire({
        title: action.label,
        text: action.confirm,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: action.label,
        confirmButtonColor: '#e11d48'
      });
      if (!result.isConfirmed) return;
    }
    setPending(action.action);
    try {
      await onAction(action);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-2">
      {actions.map((action) => {
        const Icon = ICONS[action.action] || FiCheckCircle;
        const busy = pending === action.action || busyAction === action.action;
        const tone = INTENT_CLASS[action.intent] || INTENT_CLASS.default;

        return (
          <div key={action.action}>
            <button
              type="button"
              onClick={() => run(action)}
              disabled={!action.enabled || busy}
              className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
            >
              {busy ? <FiLoader size={15} className="animate-spin" /> : <Icon size={15} />}
              {busy ? 'Working…' : action.label}
            </button>
            {!action.enabled && action.blockedBy ? (
              <p className="mt-1 px-1 text-[11px] font-medium leading-snug text-slate-500">{action.blockedBy}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
