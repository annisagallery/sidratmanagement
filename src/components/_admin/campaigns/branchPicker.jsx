'use client';
import { useQuery } from 'react-query';
import { FiCheck, FiGlobe } from 'react-icons/fi';
import * as api from 'src/services';

// Campaign sales channels are independent of physical fulfilment locations.

export default function CampaignBranchPicker({ selected, onChange, salesChannels = [], onChannelsChange }) {
  const { data, isLoading, isError, refetch } = useQuery('admin-branches-campaign', api.adminGetBranches);

  const branches = (data?.data || []).filter((b) => !b.deletedAt && b.code !== 'ECOM' && b.type !== 'ECOM');
  const chosen = new Set(selected);
  const everywhere = chosen.size === 0 && salesChannels.length === 0;

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
            onClick={() => { onChange([]); onChannelsChange([]); }}
            className="btn-ghost btn-sm"
          >
            Run everywhere
          </button>
        )}
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Sales channel
        <select className="input-ui mt-1" value={salesChannels.length === 1 ? salesChannels[0] : 'all'} onChange={(e) => onChannelsChange(e.target.value === 'all' ? [] : [e.target.value])}>
          <option value="all">Online and POS</option>
          <option value="online">Online only</option>
          <option value="showroom">POS only</option>
        </select>
      </label>
      {everywhere ? (
        <p className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
          <FiGlobe className="mt-0.5 shrink-0 text-slate-500" size={14} aria-hidden />
          Runs everywhere — every branch and the website. Choose branches below to limit it.
        </p>
      ) : (
        <p className="text-[13px] text-slate-500">
          The selected channel uses this price. Branch choices below limit POS sales; online sales use the online channel setting.
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
            const suppliesOnline = branch.isOnlineFulfillment;
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
                {suppliesOnline && (
                  <span className="section-label shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5">
                    Supplies online
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
