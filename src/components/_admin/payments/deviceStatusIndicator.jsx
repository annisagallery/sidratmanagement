'use client';
import { useQuery } from 'react-query';
import * as api from 'src/services';

// Live health of the collector phones, shown in the sidebar.
//
// A silent collector phone is the failure mode that hides itself: payments stop
// verifying and every other screen looks normal. Putting the state next to the
// nav entry means an operator sees it on every page instead of only when they
// think to go looking.

const DOT = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-500',
  offline: 'bg-rose-500 animate-pulse',
  none: 'bg-slate-300'
};

const TITLE = {
  online: 'Collector phone is online',
  idle: 'Collector phone has not reported recently',
  offline: 'Collector phone is OFFLINE — payment SMS are not being received',
  none: 'No collector phone paired'
};

export default function DeviceStatusIndicator() {
  const { data } = useQuery(['sms-devices-status'], api.getSmsDevices, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    // The nav must never surface an error toast or retry-storm; a missing dot
    // is a better failure than a broken sidebar.
    retry: false,
  });

  const status = data?.overall;
  if (!status) return null;

  return (
    <span
      className={`ml-auto h-2 w-2 shrink-0 rounded-full ${DOT[status] || DOT.none}`}
      title={TITLE[status] || TITLE.none}
      role="status"
      aria-label={TITLE[status] || TITLE.none}
    />
  );
}
