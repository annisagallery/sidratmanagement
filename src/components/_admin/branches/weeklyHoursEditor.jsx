'use client';

// A branch's default week: for each weekday, whether it trades and between what
// hours. This is the baseline the branch calendar works against — a date only
// becomes an exception by disagreeing with what is set here.
//
// It replaces the old single "Off Day" dropdown, which could only name one
// closed day and had nowhere to put hours. The server keeps the old columns in
// sync from whatever is saved here, so nothing that still reads them breaks.

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
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold text-slate-700">Weekly schedule</p>
          <p className="text-[11px] text-slate-400">
            The default week. The branch calendar marks exceptions to it.
          </p>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          {openCount === 7 ? 'Open every day' : `${7 - openCount} day${openCount === 6 ? '' : 's'} closed`}
        </span>
      </div>

      <div className="divide-y divide-slate-50">
        {week.map((day, i) => (
          <div key={WEEKDAYS[i]} className="flex flex-wrap items-center gap-3 px-4 py-2">
            <span className="w-[84px] shrink-0 text-xs font-medium text-slate-600">{WEEKDAYS[i]}</span>

            <button
              type="button"
              onClick={() => update(i, { isOpen: !day.isOpen })}
              className={`w-[70px] shrink-0 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                day.isOpen
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                  : 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200'
              }`}
            >
              {day.isOpen ? 'Open' : 'Closed'}
            </button>

            {day.isOpen ? (
              <>
                <input
                  type="time"
                  aria-label={`${WEEKDAYS[i]} opening time`}
                  value={day.openTime}
                  onChange={(e) => update(i, { openTime: e.target.value })}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                />
                <span className="text-xs text-slate-300">–</span>
                <input
                  type="time"
                  aria-label={`${WEEKDAYS[i]} closing time`}
                  value={day.closeTime}
                  onChange={(e) => update(i, { closeTime: e.target.value })}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                />
                {(day.openTime || day.closeTime) && (
                  <button
                    type="button"
                    onClick={() => copyToAllOpen(i)}
                    className="text-[11px] font-medium text-slate-400 underline-offset-2 transition hover:text-[var(--brand-strong)] hover:underline"
                  >
                    Copy to all open days
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-300">No hours</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
