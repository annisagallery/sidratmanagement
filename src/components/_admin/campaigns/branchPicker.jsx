'use client';
import { useQuery } from 'react-query';
import { FiCheck, FiGlobe } from 'react-icons/fi';
import * as api from 'src/services';

// Where a campaign's price applies.
//
// The storefront is itself a branch — code ECOM, "Online Store" — so it appears
// in this list like any other. Leaving it unticked is what keeps a
// branch-only campaign off the website, both from the campaign pages and from
// the prices the storefront quotes.
//
// Ticking nothing means the campaign runs everywhere. That is not a shortcut:
// it is what every campaign created before branch targeting looks like, and
// they must keep discounting exactly as they did. The panel says so plainly
// rather than leaving an empty list looking like a mistake.

export default function CampaignBranchPicker({ selected, onChange }) {
  const { data, isLoading } = useQuery('admin-branches-campaign', api.adminGetBranches);

  const branches = (data?.data || []).filter((b) => !b.deletedAt && b.type !== 'HQ');
  const chosen = new Set(selected);
  const everywhere = chosen.size === 0;

  const toggle = (id) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div className="space-y-3 rounded-md border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Applies in</h2>
        {!everywhere && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-medium text-gray-400 transition hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {everywhere ? (
        <p className="flex items-start gap-2 rounded-md bg-[var(--brand-soft)] px-3 py-2 text-xs text-[var(--brand-strong)]">
          <FiGlobe className="mt-0.5 shrink-0" size={13} />
          Running everywhere — every branch and the website. Tick branches below to limit it.
        </p>
      ) : (
        <p className="text-xs text-gray-400">
          Only the ticked branches use this price. Everywhere else pays the normal price.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {branches.map((branch) => {
            const isOn = chosen.has(branch.id);
            const isWeb = branch.code === 'ECOM';
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => toggle(branch.id)}
                className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition ${
                  isOn
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                    isOn ? 'border-[var(--brand)] bg-[var(--brand)] text-white' : 'border-gray-300'
                  }`}
                >
                  {isOn && <FiCheck size={11} />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{branch.name}</span>
                {isWeb && (
                  <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Website
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
