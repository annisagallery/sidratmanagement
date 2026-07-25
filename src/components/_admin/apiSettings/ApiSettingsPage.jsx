'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { MdOutlineSms } from 'react-icons/md';

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function SecretInput({ value, onChange, placeholder, name }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        className="border border-gray-200 rounded-md px-3 py-2 pr-9 w-full text-sm focus:outline-none focus:border-[var(--brand)] font-mono"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
      </button>
    </div>
  );
}

function PlainInput({ value, onChange, placeholder, name }) {
  return (
    <input
      type="text"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-[var(--brand)]"
    />
  );
}

function ActiveToggle({ value, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div className="relative">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <div className={`w-9 h-5 rounded-md transition ${value ? 'bg-[var(--brand)]' : 'bg-gray-200'}`} />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-md shadow transition-transform ${value ? 'translate-x-4' : ''}`}
        />
      </div>
      <span className="text-sm text-gray-600">{value ? 'Active' : 'Inactive'}</span>
    </label>
  );
}

// ── Service sections ──────────────────────────────────────────────────────────

function ServiceCard({ service, icon, title, description, fields }) {
  const { data, isLoading } = useQuery(['api-setting', service], () => api.getApiSettingByAdmin(service), {
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

  const { mutate: save, isLoading: saving } = useMutation(
    () => api.updateApiSettingByAdmin({ service, isActive, config }),
    {
      onSuccess: () => Swal.fire({ title: 'Saved', icon: 'success', timer: 1200, showConfirmButton: false }),
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
    }
  );

  const handleConfig = (e) => setConfig((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <section className="bg-white border border-gray-100 rounded-md p-6 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 text-xl">
            {icon}
          </div>
          <div>
            <h2 className="font-semibold text-base text-gray-800">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
        <ActiveToggle value={isActive} onChange={setIsActive} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((f) => (
            <Field key={f.name} label={f.label} hint={f.hint}>
              {f.secret ? (
                <SecretInput
                  name={f.name}
                  value={config[f.name] || ''}
                  onChange={handleConfig}
                  placeholder={f.placeholder}
                />
              ) : (
                <PlainInput
                  name={f.name}
                  value={config[f.name] || ''}
                  onChange={handleConfig}
                  placeholder={f.placeholder}
                />
              )}
            </Field>
          ))}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="px-5 py-2 bg-[var(--brand)] hover:brightness-95 text-white text-sm font-medium rounded-md transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Courier (pathao/steadfast) credentials moved to Shipping → Couriers
// (multi-account CourierAccount system) — fraud check reads from there too.
const SERVICES = [
  {
    service: 'sms',
    icon: <MdOutlineSms />,
    title: 'SMS Gateway',
    description: 'SMS provider for OTP and order notifications',
    fields: [
      {
        name: 'sms_url',
        label: 'SMS URL',
        placeholder: 'e.g. sms.example.com',
        secret: false,
        hint: 'Host only — without http://'
      },
      { name: 'api_key', label: 'API Key', placeholder: 'SMS API key', secret: true },
      { name: 'sender_id', label: 'Sender ID', placeholder: 'e.g. MYSTORE', secret: false },
      { name: 'masking_sender_id', label: 'Masking Sender ID', placeholder: 'For 015 numbers', secret: false }
    ]
  }
];

export default function ApiSettingsPage({ scope = 'all' }) {
  const services = scope === 'message' ? SERVICES.filter((service) => service.service === 'sms') : SERVICES;
  const title = scope === 'message' ? 'Message API' : 'API Settings';
  const subtitle =
    scope === 'message'
      ? 'Configure the SMS provider used for customer messages.'
      : 'Manage third-party service credentials. Changes apply within 5 minutes. Courier credentials live under Shipping → Couriers.';
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-5">
        {services.map((s) => (
          <ServiceCard key={s.service} {...s} />
        ))}
      </div>
    </div>
  );
}
