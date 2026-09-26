'use client';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { confirmDelete } from 'src/utils/swal';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiCreditCard,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiRefreshCw,
  FiShoppingBag,
  FiSmartphone,
  FiTrash2,
  FiTruck,
  FiUser,
  FiX
} from 'react-icons/fi';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { CopyButton, toast } from 'src/components/_admin/ui/primitives';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
const WEBHOOK_URL = `${BASE_URL}/api/webhook/payment`;

// What the customer is told to do differs per wallet. A personal bKash number
// takes Send Money, a merchant till takes Payment, an agent takes Cash Out —
// telling everyone "Send Money" routes real money to the wrong place.
const ACCOUNT_TYPES = [
  { value: 'personal', label: 'Personal', action: 'Send Money', icon: FiUser, blurb: 'Your own wallet number' },
  { value: 'merchant', label: 'Merchant', action: 'Payment', icon: FiShoppingBag, blurb: 'A shop / merchant account' },
  { value: 'agent', label: 'Agent', action: 'Cash Out', icon: FiBriefcase, blurb: 'An agent point number' }
];

const actionFor = (accountType) => ACCOUNT_TYPES.find((a) => a.value === accountType)?.action || 'Send Money';

function Section({ title, description, actions, children, id }) {
  return (
    <section id={id} className="card-ui p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-400">{description}</p>}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function CopyField({ label, value, type = 'text', children }) {
  const copy = () => {
    navigator.clipboard?.writeText(value);
    Swal.fire({ title: 'Copied', icon: 'success', timer: 900, showConfirmButton: false });
  };
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          type={type}
          value={value}
          className="input-ui flex-1 bg-slate-50 font-mono text-xs text-slate-600"
        />
        {children}
        <button
          type="button"
          onClick={copy}
          className="btn-icon"
          title={`Copy ${label.toLowerCase()}`}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          <FiCopy size={14} />
        </button>
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center" title={label}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />
      <span className="block h-6 w-10 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
    </label>
  );
}

// ── Payment methods ───────────────────────────────────────────────────────────

// Every wallet the server can verify automatically — the UddoktaPay line-up,
// mirrored from postgressserver/src/services/walletProviders.js. One tap fills
// the name, code and colour. The colour is the ground of the customer's
// payment panel, which carries white text, so these are all dark enough to
// read on.
const PRESETS = [
  { name: 'bKash', slug: 'bkash', color: '#E2136E' },
  { name: 'Nagad', slug: 'nagad', color: '#EC1C24' },
  { name: 'Rocket', slug: 'rocket', color: '#8C3494' },
  { name: 'Upay', slug: 'upay', color: '#0A4DA2' },
  { name: 'Tap', slug: 'tap', color: '#6A1B9A' },
  { name: 'OK Wallet', slug: 'okwallet', color: '#D71920' },
  { name: 'mCash', slug: 'mcash', color: '#00703C' },
  { name: 'Pathao Pay', slug: 'pathaopay', color: '#C8102E' },
  { name: 'Cellfin', slug: 'cellfin', color: '#0B6B3A' }
];

const SWATCHES = [...new Set([...PRESETS.map((preset) => preset.color.toUpperCase()), '#1F2937', '#475569'])];

const KIND_ORDER = ['personal', 'merchant', 'agent'];

// The wallet behind a slug, the way the server reads it: "bkash-merchant" and
// "bkash_2" both verify against bKash SMS; "bkashmerchant" does not.
const walletOf = (slug) => {
  const value = String(slug || '').toLowerCase();
  const prefix = value.split(/[-_]/)[0];
  return PRESETS.find((preset) => preset.slug === value || preset.slug === prefix) || null;
};

const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value || '');

const emptyForm = {
  name: '',
  slug: '',
  color: '#475569',
  accounts: [''],
  accountType: 'personal',
  instructions: '',
  logoUrl: '',
  isActive: true
};

const toForm = (type) => ({
  name: type.name || '',
  slug: type.slug || '',
  color: type.color || '#6b7280',
  accounts: type.accounts?.length ? [...type.accounts] : [''],
  accountType: type.accountType || 'personal',
  instructions: type.instructions || '',
  logoUrl: type.logoUrl || '',
  isActive: type.isActive !== false
});

const toPayload = (form) => ({
  ...form,
  name: form.name.trim(),
  slug: form.slug.trim(),
  instructions: form.instructions.trim(),
  logoUrl: form.logoUrl.trim(),
  accounts: form.accounts.map((value) => value.trim()).filter(Boolean)
});

const cleanSlug = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');

// "bKash Merchant" → "bkash-merchant", "OK Wallet" → "okwallet": a name that
// starts with a known wallet keeps that wallet's code as the prefix, so its
// SMS still match.
function slugFromName(name) {
  const lower = name.trim().toLowerCase();
  const dashed = (value) => value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const wallet = PRESETS.find(
    (preset) => lower.startsWith(preset.name.toLowerCase()) && !/[a-z0-9]/.test(lower.charAt(preset.name.length))
  );
  if (!wallet) return dashed(lower);
  const rest = dashed(lower.slice(wallet.name.length));
  return rest ? `${wallet.slug}-${rest}` : wallet.slug;
}

const kindsTaken = (preset, types) =>
  new Set(
    types.filter((type) => walletOf(type.slug)?.slug === preset.slug).map((type) => type.accountType || 'personal')
  );

// A wallet already listed can be listed again as a different kind of number —
// "bKash Merchant" beside "bKash Personal", the way UddoktaPay offers them.
// The slug keeps the wallet's code as its prefix ("bkash-merchant"), which is
// how the server knows both are verified against bKash SMS.
function presetForm(preset, types) {
  const used = kindsTaken(preset, types);
  const base = { ...emptyForm, name: preset.name, slug: preset.slug, color: preset.color };
  if (!used.size) return base;
  const kind = KIND_ORDER.find((value) => !used.has(value)) || 'merchant';
  const label = ACCOUNT_TYPES.find((option) => option.value === kind)?.label || 'Merchant';
  return { ...base, name: `${preset.name} ${label}`, slug: `${preset.slug}-${kind}`, accountType: kind };
}

// Relative luminance (WCAG). Above ~0.4, white text on this colour stops
// being comfortable to read on the customer's phone.
function isTooLight(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return false;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(match[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

// Errors stop the save; warnings are said out loud but the admin may still
// know better (a Rocket number is 12 digits, a custom method may have none).
function checkForm(form, types, original) {
  const errors = {};
  const warnings = {};
  const others = types.filter((type) => type.id !== original?.id);
  const name = form.name.trim();
  const slug = form.slug.trim();

  if (!name) errors.name = 'Give the method the name customers know it by.';
  else if (others.some((type) => type.name.trim().toLowerCase() === name.toLowerCase())) {
    warnings.name = 'Another method already has this name — customers will not be able to tell them apart.';
  }

  if (!slug) errors.slug = 'A short code is needed.';
  else if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) errors.slug = 'Use lowercase letters, numbers and dashes only.';
  else if (others.some((type) => type.slug === slug)) errors.slug = `“${slug}” is already used by another method.`;
  else if (original && original.slug !== slug) {
    warnings.slug = `Payments already recorded under “${original.slug}” keep the old code and will no longer be grouped with this method.`;
  }

  const numbers = form.accounts.map((value) => value.trim());
  numbers.forEach((number, index) => {
    if (!number) return;
    if (numbers.indexOf(number) !== index) errors[`account-${index}`] = 'This number is already listed above.';
    else if (!/^(\+?88)?0\d{10,11}$/.test(number.replace(/[\s-]/g, ''))) {
      warnings[`account-${index}`] = 'Check this number — wallet numbers are 11 digits (Rocket 12).';
    }
  });
  if (!numbers.some(Boolean)) {
    warnings.accounts = form.isActive
      ? 'No number yet — a customer who picks this method has nowhere to send money.'
      : 'No number yet. Add one before showing this method at checkout.';
  }

  if (form.logoUrl.trim() && !/^https?:\/\//i.test(form.logoUrl.trim())) {
    errors.logoUrl = 'Paste a full address starting with https://';
  }
  if (!isHex(form.color)) errors.color = 'Use a six-digit colour code, like #E2136E.';
  else if (isTooLight(form.color)) {
    warnings.color = 'This colour is light — white text on the customer’s payment panel will be hard to read.';
  }

  return { errors, warnings, valid: Object.keys(errors).length === 0 };
}

function MethodMark({ name, color, logoUrl, size = 'md' }) {
  // Remembers which address failed, so a corrected one is tried again.
  const [brokenUrl, setBrokenUrl] = useState(null);
  const broken = brokenUrl === logoUrl;
  const box = { sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-base', lg: 'h-12 w-12 text-lg' }[size];
  if (logoUrl && !broken) {
    return (
      <span
        className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="h-full w-full object-contain" onError={() => setBrokenUrl(logoUrl)} />
      </span>
    );
  }
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-lg font-black text-white`}
      style={{ backgroundColor: color || '#6b7280' }}
      aria-hidden="true"
    >
      {String(name || '?')
        .trim()
        .charAt(0)
        .toUpperCase() || '?'}
    </span>
  );
}

function StepDot({ n, color }) {
  return (
    <span
      className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black"
      style={{ color }}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

function VerifyTag({ slug }) {
  const wallet = walletOf(slug);
  return wallet ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
      <FiCheckCircle size={12} /> Auto-verified from {wallet.name} SMS
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
      <FiAlertTriangle size={12} /> Checked by hand
    </span>
  );
}

// What the customer will see for this method, drawn from the form as it is
// typed — the colour, the action and the number, the way the checkout shows
// them. A wrong account kind or a missing number is obvious here before any
// money moves.
function CustomerPreview({ form }) {
  const number = form.accounts.map((account) => account.trim()).find(Boolean);
  const color = isHex(form.color) ? form.color : '#6b7280';
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customer sees</p>
        {!form.isActive && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            <FiEyeOff size={10} /> Hidden
          </span>
        )}
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="mx-auto mb-2 mt-0.5 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <div
          className={`overflow-hidden rounded-2xl text-white transition ${form.isActive ? '' : 'opacity-50 grayscale'}`}
          style={{ backgroundColor: color }}
        >
          <div className="flex items-center gap-2.5 px-3 py-3">
            <MethodMark name={form.name} color="rgba(255,255,255,0.2)" logoUrl={form.logoUrl.trim()} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-white/75">Pay with</p>
              <p className="truncate text-sm font-bold">{form.name.trim() || 'Method name'}</p>
            </div>
            <p className="text-sm font-bold tabular-nums">৳1,250</p>
          </div>
          <ol className="space-y-2 border-t border-white/20 px-3 py-3 text-xs">
            <li className="flex items-center">
              <StepDot n={1} color={color} />
              Choose &quot;{actionFor(form.accountType)}&quot;
            </li>
            <li className="flex flex-wrap items-center gap-y-1">
              <StepDot n={2} color={color} />
              <span className="mr-1">Enter</span>
              <span className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-slate-900">
                {number || 'no number'}
              </span>
            </li>
            <li className="flex items-center">
              <StepDot n={3} color={color} />
              Enter the Transaction ID
            </li>
          </ol>
          {form.instructions.trim() && (
            <p className="border-t border-white/20 px-3 py-2 text-[11px] leading-relaxed text-white/90">
              {form.instructions.trim()}
            </p>
          )}
          <div className="px-3 pb-3">
            <span
              className="block rounded-lg bg-white/95 py-2 text-center text-xs font-black tracking-wide"
              style={{ color }}
            >
              VERIFY
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <VerifyTag slug={form.slug} />
      </div>
    </div>
  );
}

/* ── form parts ─────────────────────────────────────────────────────────── */

function FieldNote({ error, warning, hint, id }) {
  if (error)
    return (
      <p id={id} className="mt-1.5 flex items-start gap-1 text-[11px] font-medium text-rose-600">
        <FiAlertTriangle className="mt-px shrink-0" size={11} /> {error}
      </p>
    );
  if (warning)
    return (
      <p id={id} className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700">
        <FiAlertTriangle className="mt-px shrink-0" size={11} /> {warning}
      </p>
    );
  return hint ? (
    <p id={id} className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
      {hint}
    </p>
  ) : null;
}

const inputTone = (error, warning) =>
  error ? '!border-rose-300 focus:!border-rose-400' : warning ? '!border-amber-300' : '';

function FormBlock({ n, title, aside, children }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 flex w-full items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
          {n}
        </span>
        <span className="text-sm font-bold text-slate-900">{title}</span>
        {aside ? <span className="ml-auto">{aside}</span> : null}
      </legend>
      <div className="space-y-4 sm:pl-7">{children}</div>
    </fieldset>
  );
}

function MethodForm({ form, setForm, check, showErrors, slugLocked, setSlugTouched, autoFocus }) {
  const uid = useId();
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const err = (key) => (showErrors ? check.errors[key] : undefined);
  const warn = (key) => check.warnings[key];

  const setAccount = (index, value) =>
    setForm((current) => ({ ...current, accounts: current.accounts.map((a, i) => (i === index ? value : a)) }));
  const addAccount = () => setForm((current) => ({ ...current, accounts: [...current.accounts, ''] }));
  const removeAccount = (index) =>
    setForm((current) => {
      const accounts = current.accounts.filter((_, i) => i !== index);
      return { ...current, accounts: accounts.length ? accounts : [''] };
    });

  const wallet = walletOf(form.slug);

  return (
    <div className="space-y-7">
      <FormBlock n={1} title="Method">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-name`} className="mb-1 block text-xs font-semibold text-slate-600">
              Name customers see
            </label>
            <input
              id={`${uid}-name`}
              value={form.name}
              autoFocus={autoFocus === 'name'}
              onChange={(event) => {
                const name = event.target.value;
                setForm((current) => ({ ...current, name, ...(slugLocked ? {} : { slug: slugFromName(name) }) }));
              }}
              placeholder="bKash"
              className={`input-ui ${inputTone(err('name'), warn('name'))}`}
              aria-invalid={Boolean(err('name'))}
            />
            <FieldNote error={err('name')} warning={warn('name')} />
          </div>
          <div>
            <label
              htmlFor={`${uid}-slug`}
              className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600"
            >
              Short code
              {form.slug && (
                <span className={`text-[10px] font-semibold ${wallet ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {wallet ? `Matches ${wallet.name} SMS` : 'No SMS match'}
                </span>
              )}
            </label>
            <input
              id={`${uid}-slug`}
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((current) => ({ ...current, slug: cleanSlug(event.target.value) }));
              }}
              placeholder="bkash-merchant"
              spellCheck={false}
              className={`input-ui font-mono ${inputTone(err('slug'), warn('slug'))}`}
              aria-invalid={Boolean(err('slug'))}
            />
            <FieldNote
              error={err('slug')}
              warning={warn('slug')}
              hint={
                wallet
                  ? undefined
                  : 'Start with a wallet’s code (bkash, nagad, rocket…) so its SMS can be matched — anything else is checked by hand.'
              }
            />
          </div>
        </div>
      </FormBlock>

      <FormBlock n={2} title="Where customers send money">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-600">What kind of number is it?</p>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Account kind">
            {ACCOUNT_TYPES.map((option) => {
              const active = form.accountType === option.value;
              const Icon = option.icon;
              return (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-ring)] ${
                    active
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] ring-1 ring-[var(--brand-ring)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${uid}-accountType`}
                    value={option.value}
                    checked={active}
                    onChange={set('accountType')}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      active ? 'bg-white text-[var(--brand-strong)]' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                    <span className="block text-[11px] leading-snug text-slate-500">
                      Customer taps <strong className="font-semibold text-slate-700">{option.action}</strong>
                    </span>
                  </span>
                  {active && (
                    <FiCheck
                      className="absolute right-2.5 top-2.5 text-[var(--brand-strong)]"
                      size={14}
                      aria-hidden="true"
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-600">Wallet number</p>
          <div className="space-y-2">
            {form.accounts.map((account, index) => {
              // A repeated number is said at once — there is nothing to wait for.
              const error = check.errors[`account-${index}`];
              const warning = warn(`account-${index}`);
              return (
                <div key={index}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide ${
                        index === 0 ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {index === 0 ? 'Pays to' : `Spare ${index}`}
                    </span>
                    <input
                      value={account}
                      autoFocus={autoFocus === 'account' && index === 0}
                      onChange={(event) => setAccount(index, event.target.value)}
                      placeholder="01700000000"
                      inputMode="tel"
                      spellCheck={false}
                      aria-label={index === 0 ? 'Number customers pay to' : `Spare number ${index}`}
                      className={`input-ui flex-1 font-mono ${inputTone(error, warning || (index === 0 && warn('accounts')))}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeAccount(index)}
                      disabled={form.accounts.length === 1}
                      className="btn-icon shrink-0 text-slate-400 hover:text-rose-600 disabled:invisible"
                      aria-label={`Remove ${account || 'this number'}`}
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                  <div className="pl-[5.5rem]">
                    <FieldNote error={error} warning={warning || (index === 0 ? warn('accounts') : undefined)} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-[5.5rem]">
            <button
              type="button"
              onClick={addAccount}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-strong)] hover:underline"
            >
              <FiPlus size={12} /> Add a spare number
            </button>
            <span className="text-[11px] text-slate-400">Only the first number is shown at checkout.</span>
          </div>
        </div>
      </FormBlock>

      <FormBlock n={3} title="Look">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-600">Panel colour</p>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((swatch) => {
              const selected = form.color.toUpperCase() === swatch;
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, color: swatch }))}
                  className={`flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition ${
                    selected ? 'ring-2 ring-slate-900' : 'ring-1 ring-black/10 hover:scale-110'
                  }`}
                  style={{ backgroundColor: swatch }}
                  aria-label={`Use colour ${swatch}`}
                  aria-pressed={selected}
                >
                  {selected && <FiCheck size={13} className="text-white" />}
                </button>
              );
            })}
            <label
              className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full ring-1 ring-black/10"
              style={{ background: 'conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)' }}
              title="Pick any colour"
            >
              <input
                type="color"
                value={isHex(form.color) ? form.color : '#475569'}
                onChange={set('color')}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Pick any colour"
              />
            </label>
            <input
              value={form.color}
              onChange={set('color')}
              maxLength={7}
              spellCheck={false}
              aria-label="Colour code"
              className={`input-ui h-8 w-24 font-mono text-xs uppercase ${inputTone(err('color'), warn('color'))}`}
            />
          </div>
          <FieldNote error={err('color')} warning={warn('color')} />
        </div>

        <div>
          <label htmlFor={`${uid}-logo`} className="mb-1 block text-xs font-semibold text-slate-600">
            Logo address <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id={`${uid}-logo`}
            value={form.logoUrl}
            onChange={set('logoUrl')}
            placeholder="https://…/bkash.svg"
            spellCheck={false}
            className={`input-ui ${inputTone(err('logoUrl'))}`}
          />
          <FieldNote error={err('logoUrl')} hint="Without one, the first letter of the name is shown on the colour." />
        </div>
      </FormBlock>

      <FormBlock n={4} title="Extra instruction">
        <div>
          <textarea
            value={form.instructions}
            onChange={set('instructions')}
            rows={2}
            placeholder="e.g. Do not write anything in the reference field"
            aria-label="Extra instruction"
            className="input-ui h-auto resize-y py-2"
          />
          <FieldNote hint="Optional. Shown under the steps on the customer’s payment panel." />
        </div>
      </FormBlock>
    </div>
  );
}

/* ── dialog ─────────────────────────────────────────────────────────────── */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A modal that behaves like one: Escape closes it, Tab stays inside, the page
// behind does not scroll, and focus returns to what opened it.
function Dialog({ labelledBy, onClose, children }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape' && !Swal.isVisible()) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-h-[90vh] sm:rounded-xl"
      >
        {children}
      </div>
    </div>
  );
}

function WalletPicker({ types, onPick }) {
  return (
    <div className="space-y-6 p-5 sm:p-6">
      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Verified automatically from SMS
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((preset) => {
            const used = kindsTaken(preset, types);
            const full = KIND_ORDER.every((kind) => used.has(kind));
            const next = presetForm(preset, types);
            const nextLabel = ACCOUNT_TYPES.find((option) => option.value === next.accountType)?.label;
            return (
              <button
                key={preset.slug}
                type="button"
                disabled={full}
                onClick={() => onPick(preset)}
                className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
              >
                <MethodMark name={preset.name} color={preset.color} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{preset.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {full
                      ? 'Personal, merchant and agent all added'
                      : used.size
                        ? `Add a ${nextLabel.toLowerCase()} number`
                        : 'Personal, merchant or agent'}
                  </span>
                </span>
                {used.size ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {used.size} added
                  </span>
                ) : (
                  <FiArrowRight
                    className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
                    size={15}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Something else</p>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="group flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-3 text-left transition hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
            <FiPlus size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-900">Custom method</span>
            <span className="block text-[11px] text-slate-500">
              Any other way to be paid. With no SMS to match, each payment is checked by hand.
            </span>
          </span>
          <FiArrowRight
            className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
            size={15}
          />
        </button>
      </div>
    </div>
  );
}

function MethodDialog({ original, types, saving, onSubmit, onDelete, onClose }) {
  const editing = Boolean(original);
  const titleId = useId();
  const [step, setStep] = useState(editing ? 'form' : 'pick');
  const [form, setForm] = useState(() => (editing ? toForm(original) : emptyForm));
  // A code picked from a preset or already saved stays put when the name is
  // edited: changing it later would orphan payments recorded against it.
  const [slugTouched, setSlugTouched] = useState(editing);
  const [showErrors, setShowErrors] = useState(false);
  const [autoFocus, setAutoFocus] = useState(editing ? null : 'name');
  const check = useMemo(() => checkForm(form, types, original), [form, types, original]);

  const pick = (preset) => {
    setForm(preset ? presetForm(preset, types) : emptyForm);
    setSlugTouched(Boolean(preset));
    setShowErrors(false);
    setAutoFocus(preset ? 'account' : 'name');
    setStep('form');
  };

  const submit = (event) => {
    event.preventDefault();
    if (saving) return;
    setShowErrors(true);
    if (check.valid) onSubmit(toPayload(form));
  };

  const errorCount = Object.keys(check.errors).length;

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        {step === 'form' && !editing && (
          <button
            type="button"
            onClick={() => setStep('pick')}
            className="btn-icon h-8 w-8 shrink-0"
            aria-label="Choose another wallet"
          >
            <FiArrowLeft size={15} />
          </button>
        )}
        {step === 'form' && (
          <MethodMark
            name={form.name}
            color={isHex(form.color) ? form.color : '#6b7280'}
            logoUrl={form.logoUrl.trim()}
            size="sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {editing ? 'Edit payment method' : step === 'pick' ? 'Step 1 of 2' : 'Step 2 of 2'}
          </p>
          <h2 id={titleId} className="truncate text-lg font-bold text-slate-900">
            {step === 'pick' ? 'Which wallet will customers pay with?' : form.name.trim() || 'New payment method'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <FiX size={18} />
        </button>
      </header>

      {step === 'pick' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WalletPicker types={types} onPick={pick} />
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_18.5rem]">
            <div className="p-5 sm:p-6">
              <MethodForm
                form={form}
                setForm={setForm}
                check={check}
                showErrors={showErrors}
                slugLocked={slugTouched}
                setSlugTouched={setSlugTouched}
                autoFocus={autoFocus}
              />
            </div>
            <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
              <div className="lg:sticky lg:top-5">
                <CustomerPreview form={form} />
              </div>
            </aside>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <Switch
                  checked={form.isActive}
                  label="Show at checkout"
                  onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
                <span className="text-xs font-semibold text-slate-700">
                  {form.isActive ? 'Shown at checkout' : 'Hidden from checkout'}
                </span>
              </div>
              {editing && (
                <button
                  type="button"
                  onClick={() => onDelete(original)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <FiTrash2 size={13} /> Remove
                </button>
              )}
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              {showErrors && errorCount > 0 && (
                <span className="mr-1 text-[11px] font-medium text-rose-600">
                  Fix {errorCount === 1 ? 'the highlighted field' : `${errorCount} highlighted fields`}
                </span>
              )}
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-brand min-w-[8.5rem]">
                {saving ? (
                  <>
                    <FiRefreshCw size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <FiCheck size={14} /> {editing ? 'Save changes' : 'Add method'}
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      )}
    </Dialog>
  );
}

/* ── list ───────────────────────────────────────────────────────────────── */

// A method card reads the setting back as what the customer will be told —
// that is what makes a wrong account kind obvious before money moves. The
// on/off switch sits on the card: hiding a method during an outage should not
// mean opening a form.
function MethodCard({ type, onToggle, onEdit, onDelete }) {
  const inactive = type.isActive === false;
  const accounts = type.accounts?.length ? type.accounts : null;
  const kind = ACCOUNT_TYPES.find((a) => a.value === type.accountType) || ACCOUNT_TYPES[0];

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition ${
        inactive ? 'bg-slate-50/60' : 'hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div
        className="h-1"
        style={{ backgroundColor: inactive ? '#cbd5e1' : type.color || '#6b7280' }}
        aria-hidden="true"
      />
      <div className={`flex items-start gap-3 p-4 ${inactive ? 'opacity-60' : ''}`}>
        <MethodMark name={type.name} color={type.color} logoUrl={type.logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900">{type.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
              {kind.label} · {kind.action}
            </span>
            <span className="font-mono text-slate-400">{type.slug}</span>
          </p>
        </div>
        <Switch
          checked={!inactive}
          label={inactive ? `Show ${type.name} at checkout` : `Hide ${type.name} from checkout`}
          onChange={(checked) => onToggle(type, checked)}
        />
      </div>

      <div className={`flex-1 space-y-1.5 px-4 pb-4 ${inactive ? 'opacity-60' : ''}`}>
        {accounts ? (
          accounts.map((account, index) => (
            <div key={account} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5">
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                  {index === 0 ? 'Customers pay to' : 'Spare'}
                </span>
                <span className="font-mono text-sm font-semibold text-slate-800">{account}</span>
              </span>
              <CopyButton value={account} label={`Copy ${account}`} className="h-7 w-7" />
            </div>
          ))
        ) : (
          <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <FiAlertTriangle size={12} className="shrink-0" /> No wallet number — customers have nowhere to send money.
          </p>
        )}
        {type.instructions && (
          <p className="border-l-2 border-slate-200 pl-2 text-xs italic text-slate-500">“{type.instructions}”</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2">
        <span className={inactive ? 'text-[11px] font-medium text-slate-400' : ''}>
          {inactive ? 'Hidden from customers' : <VerifyTag slug={type.slug} />}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onEdit(type)} className="btn-ghost h-8 px-3 text-xs">
            <FiEdit2 size={12} /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(type)}
            className="btn-icon h-8 w-8 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            aria-label={`Remove ${type.name}`}
          >
            <FiTrash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

const CHECKOUT_OPTIONS = [
  {
    key: 'cashOnDeliveryEnabled',
    label: 'Cash on Delivery',
    description: 'Customers pay the courier when the parcel arrives.',
    icon: FiTruck
  },
  {
    key: 'onlinePaymentEnabled',
    label: 'Online payment',
    description: 'Customers pay up front with one of the methods below.',
    icon: FiCreditCard
  }
];

function PaymentMethodsSection() {
  const qc = useQueryClient();
  // null, { mode: 'add' } or { mode: 'edit', type }
  const [dialog, setDialog] = useState(null);
  const invalidate = () => qc.invalidateQueries(['payment-types']);
  const onError = (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error');

  const { data, isLoading } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, { staleTime: 0 });
  const types = data?.data || [];
  const { data: checkoutSettingsData, isLoading: settingsLoading } = useQuery(
    ['checkout-payment-settings'],
    api.getCheckoutPaymentSettings,
    { staleTime: 0 }
  );
  const checkoutSettings = checkoutSettingsData?.data || {
    cashOnDeliveryEnabled: true,
    onlinePaymentEnabled: true
  };

  const { mutate: create, isLoading: creating } = useMutation(api.createPaymentTypeByAdmin, {
    onSuccess: invalidate,
    onError
  });
  const { mutate: update, isLoading: updating } = useMutation(api.updatePaymentTypeByAdmin, {
    onSuccess: invalidate,
    onError
  });
  const { mutate: remove } = useMutation(api.deletePaymentTypeByAdmin, { onSuccess: invalidate, onError });
  const { mutate: updateCheckoutSettings, isLoading: savingCheckoutSettings } = useMutation(
    api.updateCheckoutPaymentSettings,
    {
      onSuccess: (response) => qc.setQueryData(['checkout-payment-settings'], response),
      onError
    }
  );

  const setCheckoutOption = (key, checked) => {
    updateCheckoutSettings({ ...checkoutSettings, [key]: checked });
  };

  const handleDelete = async (type) => {
    const confirmed = await confirmDelete({
      subject: type.name,
      text: 'Staff stop seeing it when recording a payment, and customers stop being offered it. Payments already recorded against it keep the name.'
    });
    if (!confirmed) return;
    remove(type.id, { onSuccess: () => setDialog(null) });
  };

  const handleSubmit = (payload) => {
    if (dialog?.mode === 'edit') {
      update(
        { id: dialog.type.id, ...payload },
        {
          onSuccess: () => {
            setDialog(null);
            toast(`${payload.name} saved`);
          }
        }
      );
    } else {
      create(payload, {
        onSuccess: () => {
          setDialog(null);
          toast(`${payload.name} added`);
        }
      });
    }
  };

  const shown = types.filter((type) => type.isActive !== false).length;
  const onlineOff = checkoutSettings.onlinePaymentEnabled === false;

  return (
    <>
      <Section
        id="checkout"
        title="At checkout"
        description="The two ways a customer can pay on the shop. Switching one off hides it from checkout straight away."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {CHECKOUT_OPTIONS.map((option) => {
            const on = checkoutSettings[option.key] !== false;
            const Icon = option.icon;
            return (
              <div
                key={option.key}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 transition ${
                  on ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                  <span className="block text-[11px] leading-4 text-slate-500">{option.description}</span>
                </span>
                <Switch
                  checked={on}
                  disabled={settingsLoading || savingCheckoutSettings}
                  label={`${on ? 'Turn off' : 'Turn on'} ${option.label}`}
                  onChange={(checked) => setCheckoutOption(option.key, checked)}
                />
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        id="methods"
        title="Payment methods"
        description="What a customer is offered for online payment, and the exact instruction they are given. The account kind decides that instruction — a personal number takes Send Money, a merchant till takes Payment."
        actions={
          <>
            {types.length > 0 && (
              <span className="text-xs text-slate-500">
                <strong className="font-semibold text-slate-800">{shown}</strong> shown
                {types.length - shown > 0 && <> · {types.length - shown} hidden</>}
              </span>
            )}
            <button type="button" onClick={() => setDialog({ mode: 'add' })} className="btn-brand">
              <FiPlus size={15} /> Add method
            </button>
          </>
        }
      >
        {onlineOff && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={13} />
            <span>
              <strong className="font-semibold">Online payment is off.</strong> Customers are not offered these methods
              at checkout until it is switched back on above.
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-44 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : types.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <FiCreditCard size={20} />
            </span>
            <p className="text-sm font-bold text-slate-700">No payment methods yet</p>
            <p className="mt-0.5 max-w-sm text-xs text-slate-400">
              Add bKash, Nagad or another wallet so customers have somewhere to send money.
            </p>
            <button type="button" onClick={() => setDialog({ mode: 'add' })} className="btn-brand mt-4">
              <FiPlus size={15} /> Add your first method
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {types.map((type) => (
              <MethodCard
                key={type.id}
                type={type}
                onToggle={(target, checked) =>
                  update({ id: target.id, ...toPayload(toForm(target)), isActive: checked })
                }
                onEdit={(target) => setDialog({ mode: 'edit', type: target })}
                onDelete={handleDelete}
              />
            ))}
            <button
              type="button"
              onClick={() => setDialog({ mode: 'add' })}
              className="flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-slate-400 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <FiPlus size={20} />
              <span className="text-xs font-semibold">Add another method</span>
            </button>
          </div>
        )}
      </Section>

      {dialog && (
        <MethodDialog
          key={dialog.mode === 'edit' ? dialog.type.id : 'new'}
          original={dialog.mode === 'edit' ? dialog.type : null}
          types={types}
          saving={dialog.mode === 'edit' ? updating : creating}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

// ── Collector phones ──────────────────────────────────────────────────────────

// Settings that decide how money arrives are worth nothing if the phone that
// reads the confirmation SMS is off. The state belongs on this page, next to
// the methods it makes work.
function CollectorSection() {
  const { data } = useQuery(['sms-devices-status'], api.getSmsDevices, { staleTime: 30_000, retry: false });
  const devices = data?.data || [];
  const offline = devices.filter((device) => device.status === 'offline');
  const active = devices.filter((device) => device.isActive);

  return (
    <Section
      id="collector"
      title="Collector phones"
      description="The phones that read payment confirmation SMS and forward them here. Without one, every payment has to be checked by hand."
    >
      {offline.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
          <span>
            <strong>
              {offline.length} phone{offline.length > 1 ? 's are' : ' is'} offline.
            </strong>{' '}
            Payment SMS are not being collected right now.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4">
        <p className="flex items-center gap-3 text-sm text-slate-600">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              devices.length === 0
                ? 'bg-slate-100 text-slate-400'
                : offline.length
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            <FiSmartphone size={17} />
          </span>
          {devices.length === 0 ? (
            'No phone paired yet'
          ) : (
            <span>
              <strong className="font-semibold text-slate-800">{active.length}</strong> paired
              {offline.length > 0 && <span className="text-rose-600"> · {offline.length} offline</span>}
            </span>
          )}
        </p>
        <Link href="/payments/devices" className="btn-ghost">
          Manage phones <FiArrowRight size={14} />
        </Link>
      </div>
    </Section>
  );
}

// ── Webhook ───────────────────────────────────────────────────────────────────

function WebhookSection() {
  const [showSecret, setShowSecret] = useState(false);
  const [secret, setSecret] = useState(null);
  const seeded = useRef(false);

  const { isLoading } = useQuery(['webhook-config'], api.getWebhookConfig, {
    staleTime: 60_000,
    onSuccess: (response) => {
      if (!seeded.current) {
        seeded.current = true;
        setSecret(response?.data?.secret || '');
      }
    }
  });

  const { mutate: regenerate, isLoading: regenerating } = useMutation(api.regenerateWebhookSecret, {
    onSuccess: (response) => setSecret(response?.data?.secret || ''),
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const handleRegenerate = () =>
    Swal.fire({
      title: 'Regenerate the secret?',
      text: 'Anything posting payments with the old secret stops working immediately.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Regenerate',
      confirmButtonColor: '#ef4444'
    }).then((result) => result.isConfirmed && regenerate());

  return (
    <Section
      id="webhook"
      title="Payments from an outside system"
      description="An address another system can post a payment to. Collector phones are the everyday path — this stays for anything outside Sidrat that needs to record one."
    >
      <div className="space-y-3">
        <CopyField label="Address to post to" value={WEBHOOK_URL} />
        <CopyField label="Secret" value={isLoading ? 'Loading…' : secret || ''} type={showSecret ? 'text' : 'password'}>
          <button
            type="button"
            onClick={() => setShowSecret((value) => !value)}
            className="btn-icon"
            aria-label={showSecret ? 'Hide secret' : 'Show secret'}
          >
            {showSecret ? <FiEyeOff size={14} /> : <FiEye size={14} />}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="btn-icon text-rose-500 hover:border-rose-200 hover:bg-rose-50"
            title="Regenerate secret"
            aria-label="Regenerate secret"
          >
            <FiRefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
          </button>
        </CopyField>

        <details className="rounded-md border border-slate-200">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600">What to send</summary>
          <div className="space-y-2 border-t border-slate-100 p-3 text-xs text-slate-500">
            <p>
              Send the secret as the header{' '}
              <code className="rounded bg-slate-100 px-1 font-mono">X-Webhook-Secret</code>, with a JSON body:
            </p>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {JSON.stringify(
                {
                  trxId: 'TXN123',
                  amount: 500,
                  type: 'bkash',
                  account: '01700000000',
                  senderAccount: '01800000000',
                  note: 'Original SMS'
                },
                null,
                2
              )}
            </pre>
            <p>
              A repeated <code className="rounded bg-slate-100 px-1 font-mono">trxId</code> answers{' '}
              <code className="rounded bg-slate-100 px-1 font-mono">409</code> and records nothing, so retrying is safe.
            </p>
          </div>
        </details>
      </div>
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentSettings() {
  return (
    <div className="space-y-4">
      <PageHeader title="Payment settings" subtitle="How money comes in, and what customers are told to do" />
      <div className="space-y-4">
        <PaymentMethodsSection />
        <div className="grid gap-4 xl:grid-cols-2">
          <CollectorSection />
          <WebhookSection />
        </div>
      </div>
    </div>
  );
}
