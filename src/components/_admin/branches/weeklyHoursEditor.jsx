'use client';

// A branch's default week: for each weekday, whether it trades and between what
// hours. This is the baseline the branch calendar works against — a date only
// becomes an exception by disagreeing with what is set here.
//
// It replaces the old single "Off Day" dropdown, which could only name one
// closed day and had nowhere to put hours. The server keeps the old columns in
// sync from whatever is saved here, so nothing that still reads them breaks.

import { Switch } from 'src/components/_admin/ui/fields';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Mirrors the server's fallback (utils/branchHours): a branch saved before this
// editor existed has only a single off day and one pair of times, so the week
// is reconstructed from those rather than shown as empty.
export function seedWeek(value, legacy = {}) {
  if (Array.isArray(value) && value.length === 7) {
    return value.map((day) => ({
      isOpen: day?.isOpen !== false,
      openTime: day?.openTime || '',
      closeTime: day?.closeTime || ''
    }));
  }
  return WEEKDAYS.map((name) => {
    const isOpen = !(legacy.offDay && legacy.offDay === name);
    return {
      isOpen,
      openTime: isOpen ? legacy.openTime || '' : '',
      closeTime: isOpen ? legacy.closeTime || '' : ''
    };
  });
}

export default function WeeklyHoursEditor({ value, legacy, onChange }) {
  const week = seedWeek(value, legacy);

  const update = (index, patch) => {
    const next = week.map((day, i) => (i === index ? { ...day, ...patch } : day));
    // Closing a day clears its hours rather than leaving stale times behind for
    // whoever opens it again months later.
    if (patch.isOpen === false) next[index] = { isOpen: false, openTime: '', closeTime: '' };
    onChange(next);
  };

  // Most branches keep one set of hours all week, so setting the first open day
  // and copying is the common path.
  const copyToAllOpen = (index) => {
    const source = week[index];
    onChange(week.map((day) => (day.isOpen ? { ...day, openTime: source.openTime, closeTime: source.closeTime } : day)));
  };

  const openCount = week.filter((d) => d.isOpen).length;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <p className="text-[13px] text-slate-600">The default week. The branch calendar marks exceptions to it.</p>
        <span className="shrink-0 text-xs font-medium text-slate-600">
          {openCount === 7 ? 'Open every day' : `${7 - openCount} day${openCount === 6 ? '' : 's'} closed`}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {week.map((day, i) => (
          <li key={WEEKDAYS[i]} className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
            <span className="w-24 shrink-0 text-[13px] font-medium text-slate-900">{WEEKDAYS[i]}</span>
            <Switch checked={day.isOpen} onChange={(on) => update(i, { isOpen: on })} label={`${WEEKDAYS[i]}: open`} />
            <span className={`w-14 shrink-0 text-[13px] ${day.isOpen ? 'text-slate-700' : 'text-slate-500'}`}>{day.isOpen ? 'Open' : 'Closed'}</span>

            {day.isOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  aria-label={`${WEEKDAYS[i]} opening time`}
                  value={day.openTime}
                  onChange={(e) => update(i, { openTime: e.target.value })}
                  className="input-ui w-32"
                />
                <span className="text-slate-400" aria-hidden>
                  –
                </span>
                <input
                  type="time"
                  aria-label={`${WEEKDAYS[i]} closing time`}
                  value={day.closeTime}
                  onChange={(e) => update(i, { closeTime: e.target.value })}
                  className="input-ui w-32"
                />
                {(day.openTime || day.closeTime) && (
                  <button type="button" onClick={() => copyToAllOpen(i)} className="btn-ghost btn-sm">
                    Copy to all open days
                  </button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
