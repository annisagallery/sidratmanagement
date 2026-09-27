'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Callout from 'src/components/_admin/ui/Callout';
import { Switch, Toggle } from 'src/components/_admin/ui/fields';
import { ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';
import { toastSuccess, alertError } from 'src/utils/swal';

function EventCard({ item, onChange, disabled }) {
  const insert = (token) => onChange({ ...item, template: `${item.template || ''}{${token}}` });
  const count = (item.template || '').length;
  const segments = Math.max(1, Math.ceil(count / 160));
  const off = disabled || !item.enabled;
  const fieldId = `template-${item.event}`;

  return (
    <div className={`rounded-lg border border-slate-200 p-4 ${off ? 'bg-slate-50' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={fieldId} className="block text-sm font-semibold text-slate-900">
            {item.label}
          </label>
          <p className="ops-code text-xs text-slate-500">{item.event}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-slate-600">{item.enabled ? 'On' : 'Off'}</span>
          <Switch checked={item.enabled} disabled={disabled} onChange={(v) => onChange({ ...item, enabled: v })} label={`Send “${item.label}”`} />
        </div>
      </div>

      <textarea
        id={fieldId}
        value={item.template}
        onChange={(e) => onChange({ ...item, template: e.target.value })}
        disabled={off}
        rows={3}
        placeholder="Message text…"
        className="input-ui mt-3 min-h-[76px] w-full resize-y py-2 disabled:cursor-not-allowed"
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(item.placeholders || []).length > 0 && <span className="text-xs text-slate-500">Insert:</span>}
        {(item.placeholders || []).map((p) => (
          <button
            key={p}
            type="button"
            disabled={off}
            onClick={() => insert(p)}
            className="ops-code rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
            title={`Insert {${p}} at the end`}
          >
            {'{' + p + '}'}
          </button>
        ))}
        <span className={`ml-auto text-xs tabular-nums ${segments > 1 ? 'font-medium text-amber-800' : 'text-slate-500'}`}>
          {count} characters · {segments} SMS
        </span>
      </div>
    </div>
  );
}

export default function MessageSettingsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery('admin-message-settings', api.getMessageSettings);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [events, setEvents] = useState([]);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (data?.data) {
      const enabled = data.data.smsEnabled !== false;
      const list = data.data.events || [];
      setSmsEnabled(enabled);
      setEvents(list);
      setSaved(JSON.stringify({ smsEnabled: enabled, events: list }));
    }
  }, [data]);

  const current = JSON.stringify({ smsEnabled, events });
  const dirty = saved !== null && saved !== current;

  const save = useMutation(() => api.updateMessageSettings({ smsEnabled, events }), {
    onSuccess: () => {
      setSaved(current);
      toastSuccess('Message settings saved');
    },
    onError: (e) => alertError(e, { title: 'Message settings were not saved' })
  });

  const discard = () => {
    if (!saved) return;
    const prev = JSON.parse(saved);
    setSmsEnabled(prev.smsEnabled);
    setEvents(prev.events);
  };

  const setEvent = (event, next) => setEvents((list) => list.map((e) => (e.event === event ? next : e)));

  const { general, statuses } = useMemo(() => {
    const general = events.filter((e) => !e.event.startsWith('order_status:'));
    const statuses = events.filter((e) => e.event.startsWith('order_status:'));
    return { general, statuses };
  }, [events]);

  const saveButton = (
    <button type="button" onClick={() => save.mutate()} disabled={save.isLoading || !dirty} className="btn-brand">
      {save.isLoading ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
    </button>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Messages" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  // Never show the editor for a failed load: saving an empty list would delete
  // every message template.
  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Messages" />
        <ErrorState error={error} title="Message settings could not be loaded" onRetry={refetch} />
      </div>
    );
  }

  const section = (title, description, items) =>
    items.length > 0 && (
      <Panel title={title} description={description}>
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <EventCard key={item.event} item={item} disabled={!smsEnabled} onChange={(next) => setEvent(item.event, next)} />
          ))}
        </div>
      </Panel>
    );

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title="Messages" subtitle="Which events send an SMS to the customer, and what it says.">
        {saveButton}
      </PageHeader>

      <Panel>
        <Toggle label="Send SMS" help="The master switch. When off, no SMS is sent for any event." checked={smsEnabled} onChange={setSmsEnabled} />
        {!smsEnabled && (
          <Callout tone="warning" className="mt-4">
            Customers get no SMS at all — not even one-time sign-in codes — until this is back on.
          </Callout>
        )}
      </Panel>

      {section('General', 'Sign-in codes, order confirmation and other one-off messages.', general)}
      {section('Order status updates', 'Sent when an order moves to that status.', statuses)}

      {dirty && (
        <div className="sticky bottom-3 z-20" role="region" aria-label="Unsaved changes">
          <div className="card-ui flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-lg">
            <p className="text-[13px] font-medium text-slate-900">You have unsaved changes</p>
            <div className="flex gap-2">
              <button type="button" onClick={discard} disabled={save.isLoading} className="btn-ghost">
                Discard
              </button>
              <button type="button" onClick={() => save.mutate()} disabled={save.isLoading} className="btn-brand">
                {save.isLoading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
