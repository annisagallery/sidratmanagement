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
  const { data, isLoading, isError, refetch } = useQuery('admin-branches-campaign', api.adminGetBranches);

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
    <section className="card-ui space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-slate-900">Where it applies</h2>
        {!everywhere && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="btn-ghost btn-sm"
          >
            Run everywhere
          </button>
        )}
      </div>

      {everywhere ? (
        <p className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
          <FiGlobe className="mt-0.5 shrink-0 text-slate-500" size={14} aria-hidden />
          Runs everywhere — every branch and the website. Choose branches below to limit it.
        </p>
      ) : (
        <p className="text-[13px] text-slate-500">
          Only the chosen branches use this price. Everywhere else pays the normal price.
        </p>
      )}

      {isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800" role="alert">
          Branches could not be loaded, so the list below is incomplete.
          <button type="button" onClick={() => refetch()} className="btn-ghost btn-sm">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10" />
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
                role="checkbox"
                aria-checked={isOn}
                onClick={() => toggle(branch.id)}
                className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition ${
                  isOn
                    ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                    isOn ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'
                  }`}
                >
                  {isOn && <FiCheck size={11} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{branch.name}</span>
                {isWeb && (
                  <span className="section-label shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5">
                    Website
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
