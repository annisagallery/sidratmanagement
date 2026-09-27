'use client';
import { useQuery } from 'react-query';
import * as api from 'src/services';
import { FiClock, FiEdit, FiPlusCircle, FiMinusCircle, FiCreditCard, FiAlertCircle } from 'react-icons/fi';
import { fDate, fDateTime } from 'src/utils/formatTime';
import Drawer from 'src/components/_admin/ui/Drawer';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fDate(date);
}

function actionIcon(description) {
  const d = description?.toLowerCase() || '';
  if (d.startsWith('added')) return <FiPlusCircle className="text-emerald-700" size={15} aria-hidden />;
  if (d.startsWith('removed') || d.startsWith('deleted')) return <FiMinusCircle className="text-rose-700" size={15} aria-hidden />;
  if (d.startsWith('linked payment') || d.startsWith('payment')) return <FiCreditCard className="text-sky-700" size={15} aria-hidden />;
  if (d.includes('status')) return <FiAlertCircle className="text-amber-600" size={15} aria-hidden />;
  return <FiEdit className="text-slate-400" size={15} aria-hidden />;
}

export default function HistoryModal({ title, model, docId, onClose }) {
  const { data, isLoading, isError, error, refetch } = useQuery(
    ['edit-history', model, docId],
    () => api.getEditHistory({ model, docId }),
    { staleTime: 10_000, enabled: !!docId }
  );

  const entries = data?.data || [];

  return (
    <Drawer title={title || 'Change history'} eyebrow="History" size="md" onClose={onClose}>
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-12" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} title="History could not be loaded" onRetry={refetch} />
      ) : entries.length === 0 ? (
        <EmptyState compact icon={FiClock} title="No changes recorded yet" />
      ) : (
        <ol className="relative space-y-5">
          <span className="absolute bottom-2 left-[17px] top-2 w-px bg-slate-200" aria-hidden />
          {entries.map((e) => (
            <li key={e.id} className="relative flex gap-3">
              <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                {actionIcon(e.description)}
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-[13px] leading-snug text-slate-900">{e.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{e.performedByName || 'System'}</span>
                  {' · '}
                  <time dateTime={e.createdAt} title={fDateTime(e.createdAt)}>
                    {timeAgo(e.createdAt)}
                  </time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
