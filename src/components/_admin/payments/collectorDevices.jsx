'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import * as api from 'src/services';
import { FiSmartphone, FiCopy, FiAlertTriangle } from 'react-icons/fi';
import { MdInbox } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDateTime } from 'src/utils/formatTime';

// The API the collector phone talks to. Same origin the management app uses.
const API_BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';

const dtStr = (d) => (d ? fDateTime(d) : '—');

// Relative time reads faster than a timestamp when the question is "is it
// alive right now" rather than "when exactly did this happen".
function ago(date) {
  if (!date) return 'never';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const STATUS_META = {
  online: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Online' },
  idle: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Idle' },
  offline: { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Offline' },
  never_seen: { dot: 'bg-slate-300', text: 'text-slate-500', label: 'Never connected' },
  revoked: { dot: 'bg-slate-300', text: 'text-slate-400', label: 'Revoked' }
};

export function StatusDot({ status, withLabel = true }) {
  const meta = STATUS_META[status] || STATUS_META.never_seen;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
      {withLabel && meta.label}
    </span>
  );
}

// The token is returned exactly once, by design — only its hash is stored, so
// there is no endpoint that can show it again. Say so plainly.
//
// Pairing offers a QR because typing a 64-character token on a phone keypad is
// where this goes wrong: one wrong character and the device silently fails to
// authenticate later. The manual fields stay for phones without a camera.
function PairedModal({ device, onClose }) {
  const [qr, setQr] = useState(null);
  const copy = (value) => navigator.clipboard?.writeText(value);

  // Short keys keep the QR low-density, so it scans on a cheap handset camera.
  const payload = JSON.stringify({
    v: 1,
    url: API_BASE,
    id: device.deviceId,
    token: device.token
  });

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => {
        // Falling back to the manual fields is a fine outcome; a broken image
        // would be worse than no image.
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-md space-y-4 rounded-md bg-white p-6 shadow-xl">
        <h3 className="font-semibold text-slate-800">Device paired</h3>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <FiAlertTriangle className="mr-1 inline" size={12} />
          Pair the phone now. The token is shown once and cannot be retrieved later — if you
          lose it, revoke the device and pair again.
        </div>

        <div className="rounded-md border border-slate-200 p-4 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Scan with the collector app
          </p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Pairing QR code" className="mx-auto h-56 w-56" />
          ) : (
            <div className="mx-auto flex h-56 w-56 items-center justify-center text-xs text-slate-400">
              QR unavailable — use the fields below
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Open SidratPay Collector, tap <strong>Scan QR</strong>, and point it here.
          </p>
        </div>

        <details className="rounded-md border border-slate-200">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
            Or enter it by hand
          </summary>
          <div className="space-y-3 border-t border-slate-100 p-3">
            {[
              { label: 'Server address', value: API_BASE },
              { label: 'Device ID', value: device.deviceId },
              { label: 'Token', value: device.token }
            ].map((field) => (
              <div key={field.label}>
                <label className="mb-1 block text-xs font-medium text-slate-500">{field.label}</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs text-slate-100">
                    {field.value}
                  </code>
                  <button
                    onClick={() => copy(field.value)}
                    className="btn-ghost"
                    aria-label={`Copy ${field.label}`}
                  >
                    <FiCopy size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-brand">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AddDeviceModal({ onClose, onPaired }) {
  const [name, setName] = useState('');
  const [msisdn, setMsisdn] = useState('');

  const { mutate, isLoading } = useMutation(() => api.createSmsDevice({ name, msisdn }), {
    onSuccess: (res) => {
      onPaired(res.data);
      onClose();
    },
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-md bg-white p-6 shadow-xl">
        <h3 className="font-semibold text-slate-800">Pair a collector phone</h3>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Device name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shop counter phone"
            className="input-ui"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            SIM number <span className="text-slate-400">(optional)</span>
          </label>
          <input
            value={msisdn}
            onChange={(e) => setMsisdn(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="input-ui"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={() => mutate()} disabled={!name.trim() || isLoading} className="btn-brand">
            {isLoading ? 'Pairing…' : 'Pair device'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CollectorDevices() {
  const [addOpen, setAddOpen] = useState(false);
  const [paired, setPaired] = useState(null);
  const qc = useQueryClient();

  // Poll: this page exists to answer "is it alive right now", so a stale view
  // would defeat its purpose.
  const { data, isLoading, isFetching, refetch } = useQuery(['sms-devices'], api.getSmsDevices, {
    refetchInterval: 30_000
  });

  const rows = data?.data || [];

  const { mutate: revoke } = useMutation(api.revokeSmsDevice, {
    onSuccess: () => qc.invalidateQueries(['sms-devices']),
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const confirmRevoke = (device) => {
    Swal.fire({
      title: `Revoke "${device.name}"?`,
      text: 'The phone will stop being able to send messages immediately.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Revoke'
    }).then((r) => r.isConfirmed && revoke(device._id));
  };

  const columns = [
    {
      key: 'name',
      label: 'Device',
      render: (d) => (
        <div>
          <p className="font-medium text-slate-800">{d.name}</p>
          {d.msisdn && <p className="font-mono text-xs text-slate-400">{d.msisdn}</p>}
        </div>
      )
    },
    { key: 'status', label: 'Status', render: (d) => <StatusDot status={d.status} /> },
    {
      key: 'lastSeenAt',
      label: 'Last seen',
      render: (d) => (
        <span className="whitespace-nowrap text-xs text-slate-500" title={dtStr(d.lastSeenAt)}>
          {ago(d.lastSeenAt)}
        </span>
      )
    },
    {
      key: 'lastSmsAt',
      label: 'Last SMS',
      render: (d) => (
        <span className="whitespace-nowrap text-xs text-slate-500" title={dtStr(d.lastSmsAt)}>
          {ago(d.lastSmsAt)}
        </span>
      )
    },
    {
      key: 'queueDepth',
      label: 'Queued',
      align: 'right',
      render: (d) => (
        <span
          className={`text-xs font-medium ${d.queueDepth > 0 ? 'text-amber-600' : 'text-slate-400'}`}
        >
          {d.queueDepth || 0}
        </span>
      )
    },
    {
      key: 'messagesTotal',
      label: 'Total',
      align: 'right',
      render: (d) => <span className="text-xs text-slate-500">{d.messagesTotal || 0}</span>
    },
    {
      key: 'battery',
      label: 'Battery',
      render: (d) => (
        <span className="text-xs text-slate-500">
          {d.batteryLevel != null ? `${d.batteryLevel}%` : '—'}
          {/* Android will kill a background app that is not exempt, which is
              the usual reason a collector goes quiet without anyone noticing. */}
          {d.batteryOptimised === true && (
            <span className="ml-1 text-amber-600" title="Not exempt from battery optimisation">
              <FiAlertTriangle size={11} className="inline" />
            </span>
          )}
        </span>
      )
    },
    {
      key: 'appVersion',
      label: 'App',
      render: (d) => <span className="text-xs text-slate-400">{d.appVersion || '—'}</span>
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (d) =>
        d.isActive && (
          <button
            onClick={() => confirmRevoke(d)}
            className="whitespace-nowrap rounded-md border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
          >
            Revoke
          </button>
        )
    }
  ];

  const offline = rows.filter((d) => d.status === 'offline');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Collector Devices"
        subtitle={`${rows.length} paired`}
        icon={FiSmartphone}
      >
        <button onClick={() => setAddOpen(true)} className="btn-brand">
          + Pair Device
        </button>
      </PageHeader>

      {/* A silent collector is the failure that makes payments stop verifying
          while everything else looks normal — say it loudly. */}
      {offline.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
          <span>
            <strong>
              {offline.length} device{offline.length > 1 ? 's are' : ' is'} offline.
            </strong>{' '}
            Payment SMS are not being collected — customers paying now will not be verified
            automatically. Check the phone is powered on, connected, and the app is running.
          </span>
        </div>
      )}

      <ListToolbar refreshing={isFetching} onRefresh={refetch} />

      <DataTable
        columns={columns}
        data={rows}
        selectionLabel="devices"
        isLoading={isLoading}
        empty={
          <EmptyState
            title="No collector phones paired"
            hint="Pair a phone to start capturing payment SMS."
            icon={MdInbox}
          />
        }
      />

      {addOpen && <AddDeviceModal onClose={() => setAddOpen(false)} onPaired={setPaired} />}
      {paired && <PairedModal device={paired} onClose={() => setPaired(null)} />}
    </div>
  );
}
