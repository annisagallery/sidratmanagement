'use client';
import { useQuery } from 'react-query';
import * as api from 'src/services';
import { FiClock, FiX, FiEdit, FiPlusCircle, FiMinusCircle, FiCreditCard, FiAlertCircle } from 'react-icons/fi';
import { fDate, fDateTime } from 'src/utils/formatTime';

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
  if (d.startsWith('added')) return <FiPlusCircle className="text-green-500" size={15} />;
  if (d.startsWith('removed') || d.startsWith('deleted')) return <FiMinusCircle className="text-red-500" size={15} />;
  if (d.startsWith('linked payment') || d.startsWith('payment'))
    return <FiCreditCard className="text-[var(--brand-strong)]" size={15} />;
  if (d.includes('status')) return <FiAlertCircle className="text-amber-500" size={15} />;
  return <FiEdit className="text-blue-400" size={15} />;
}

export default function HistoryModal({ title, model, docId, onClose }) {
  const { data, isLoading } = useQuery(['edit-history', model, docId], () => api.getEditHistory({ model, docId }), {
    staleTime: 10_000,
    enabled: !!docId
  });

  const entries = data?.data || [];

  return (
    <div className="fixed inset-0 z-50 !m-0 flex items-start justify-end bg-black/30" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-sm shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-800">
            <FiClock size={16} />
            <span className="font-semibold text-sm">{title || 'Edit History'}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <FiX size={18} />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-md animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiClock size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No history yet</p>
            </div>
          ) : (
            <div className="relative">
              {/* vertical line */}
              <div className="absolute left-[18px] top-2 bottom-2 w-px bg-gray-100" />
              <div className="space-y-4">
                {entries.map((e) => (
                  <div key={e.id} className="flex gap-3 relative">
                    <div className="w-9 h-9 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 z-10">
                      {actionIcon(e.description)}
                    </div>
                    <div className="pt-1.5 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{e.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-[var(--brand-strong)]">{e.performedByName}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span
                          className="text-xs text-gray-400"
                          title={fDateTime(e.createdAt)}
                        >
                          {timeAgo(e.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
