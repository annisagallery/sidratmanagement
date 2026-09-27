'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import * as api from 'src/services';
import { toastSuccess, alertError } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { Field, SettingsCard, Toggle } from 'src/components/_admin/ui/fields';
import { ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';

// ── Shared UI ─────────────────────────────────────────────────────────────────

function SecretInput({ id, value, onChange, placeholder, name, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
        className="input-ui ops-code w-full pr-10"
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label={show ? 'Hide value' : 'Show value'}
        aria-pressed={show}
      >
        {show ? <MdVisibilityOff size={17} aria-hidden /> : <MdVisibility size={17} aria-hidden />}
      </button>
    </div>
  );
}

// ── Service sections ──────────────────────────────────────────────────────────

function ServiceCard({ service, title, description, fields }) {
  const { data, isLoading, isError, error, refetch } = useQuery(['api-setting', service], () => api.getApiSettingByAdmin(service), {
    staleTime: 30_000
  });

  const [config, setConfig] = useState({});
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (data?.data) {
      setConfig(data.data.config || {});
      setIsActive(data.data.isActive ?? true);
    }
  }, [data]);

  const { mutate: save, isLoading: saving } = useMutation(() => api.updateApiSettingByAdmin({ service, isActive, config }), {
    onSuccess: () => toastSuccess(`${title} saved`),
    onError: (e) => alertError(e, { title: `${title} was not saved` })
  });

  const handleConfig = (e) => setConfig((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  let body;
  if (isLoading) body = <LoadingBlock rows={3} bare />;
  // Never show the fields for a failed load: saving them empty would wipe the
  // credentials the storefront is using right now.
  else if (isError) body = <ErrorState error={error} title={`${title} settings could not be loaded`} onRetry={refetch} />;
  else
    body = (
      <>
        <Toggle label="Use this service" help="When off, nothing is sent through it." checked={isActive} onChange={setIsActive} />
        <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.name} label={f.label} help={f.hint}>
              {f.secret ? (
                <SecretInput name={f.name} value={config[f.name] || ''} onChange={handleConfig} placeholder={f.placeholder} />
              ) : (
                <input type="text" name={f.name} value={config[f.name] || ''} onChange={handleConfig} placeholder={f.placeholder} className="input-ui" />
              )}
            </Field>
          ))}
        </div>
        <div className="flex justify-end border-t border-slate-200 pt-5">
          <button type="button" onClick={() => save()} disabled={saving} className="btn-brand">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </>
    );

  return (
    <SettingsCard title={title} description={description}>
      {body}
    </SettingsCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Courier (pathao/steadfast) credentials moved to Shipping → Couriers
// (multi-account CourierAccount system) — fraud check reads from there too.
const SERVICES = [
  {
    service: 'sms',
    title: 'SMS gateway',
    description: 'The provider that sends one-time codes and order messages.',
    fields: [
      {
        name: 'sms_url',
        label: 'Gateway address',
        placeholder: 'sms.example.com',
        secret: false,
        hint: 'Host only — without http://'
      },
      { name: 'api_key', label: 'API key', placeholder: 'SMS API key', secret: true },
      { name: 'sender_id', label: 'Sender ID', placeholder: 'e.g. MYSTORE', secret: false },
      { name: 'masking_sender_id', label: 'Masking sender ID', placeholder: 'For 015 numbers', secret: false }
    ]
  }
];

export default function ApiSettingsPage({ scope = 'all' }) {
  const services = scope === 'message' ? SERVICES.filter((service) => service.service === 'sms') : SERVICES;
  return (
    <div className="space-y-6">
      <PageHeader title="API settings" />
      {services.map((s) => (
        <ServiceCard key={s.service} {...s} />
      ))}
    </div>
  );
}
