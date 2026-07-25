'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import Swal from 'sweetalert2';
import { MdSms, MdSave } from 'react-icons/md';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        checked ? 'border-transparent shadow-sm' : 'border-slate-200 bg-slate-200'
      ].join(' ')}
      style={checked ? { backgroundColor: 'var(--brand)', '--tw-ring-color': 'var(--brand-ring)' } : undefined}
    >
      <span
        className={[
          'block h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        ].join(' ')}
      />
    </button>
  );
}

function EventCard({ item, onChange, disabled }) {
  const insert = (token) => onChange({ ...item, template: `${item.template || ''}{${token}}` });
  const count = (item.template || '').length;
  const segments = Math.max(1, Math.ceil(count / 160));

  return (
    <div className={`card-ui p-4 transition ${disabled || !item.enabled ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{item.label}</p>
          <p className="font-mono text-[11px] text-slate-400">{item.event}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${item.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
            {item.enabled ? 'On' : 'Off'}
          </span>
          <Toggle checked={item.enabled} disabled={disabled} onChange={(v) => onChange({ ...item, enabled: v })} />
        </div>
      </div>

      <textarea
        value={item.template}
        onChange={(e) => onChange({ ...item, template: e.target.value })}
        disabled={disabled || !item.enabled}
        rows={2}
        placeholder="Message text…"
        className="mt-3 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 disabled:bg-slate-50"
        style={{ '--tw-ring-color': 'var(--brand-ring)' }}
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(item.placeholders || []).map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled || !item.enabled}
            onClick={() => insert(p)}
            className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
            title={`Insert {${p}}`}
          >
            {'{' + p + '}'}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">
          {count} chars · {segments} SMS
        </span>
      </div>
    </div>
  );
}

export default function MessageSettingsPage() {
  const { data, isLoading } = useQuery('admin-message-settings', api.getMessageSettings);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (data?.data) {
      setSmsEnabled(data.data.smsEnabled !== false);
      setEvents(data.data.events || []);
    }
  }, [data]);

  const save = useMutation(() => api.updateMessageSettings({ smsEnabled, events }), {
    onSuccess: () =>
      Swal.fire({
        title: 'Saved',
        icon: 'success',
        timer: 1200,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      }),
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Could not save', 'error')
  });

  const setEvent = (event, next) => setEvents((list) => list.map((e) => (e.event === event ? next : e)));

  const { general, statuses } = useMemo(() => {
    const general = events.filter((e) => !e.event.startsWith('order_status:'));
    const statuses = events.filter((e) => e.event.startsWith('order_status:'));
    return { general, statuses };
  }, [events]);

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Messages" subtitle="Control the SMS sent to customers — turn events on/off and edit the text.">
        <button onClick={() => save.mutate()} disabled={save.isLoading} className="btn-brand">
          <MdSave size={16} /> {save.isLoading ? 'Saving…' : 'Save changes'}
        </button>
      </PageHeader>

      {/* Master switch */}
      <div className="card-ui flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-md"
            style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
          >
            <MdSms size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Send SMS</p>
            <p className="text-xs text-slate-400">Master switch. When off, no SMS is sent for any event.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${smsEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
            {smsEnabled ? 'Enabled' : 'Disabled'}
          </span>
          <Toggle checked={smsEnabled} onChange={setSmsEnabled} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">General</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {general.map((item) => (
            <EventCard
              key={item.event}
              item={item}
              disabled={!smsEnabled}
              onChange={(next) => setEvent(item.event, next)}
            />
          ))}
        </div>
      </section>

      {statuses.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Order status updates</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {statuses.map((item) => (
              <EventCard
                key={item.event}
                item={item}
                disabled={!smsEnabled}
                onChange={(next) => setEvent(item.event, next)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
