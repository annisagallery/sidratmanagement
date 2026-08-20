'use client';
import { useRef, useState } from 'react';
import { useQuery } from 'react-query';
import Image from 'next/image';
import { FiPlus, FiTrash2, FiChevronDown, FiChevronUp, FiUpload } from 'react-icons/fi';
import * as api from 'src/services';
import { SETTINGS_TABS, fieldsForTab } from './blocks';

// Renders a block's settings form from its `fields` schema. Every input is
// controlled and reports upward through onChange(key, value) so the builder
// keeps a single source of truth for the block's config.

// ── Primitives ───────────────────────────────────────────────────────────────

function Label({ children, hint }) {
  return (
    <div className="mb-1">
      <label className="text-xs font-semibold text-gray-600">{children}</label>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none';

function ImagePicker({ value, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'HomepageSection');
      const res = await api.uploadImage(fd);
      // The storefront only ever needs the path, so config stores the URL
      // rather than an Image id — blocks are self-contained that way.
      onChange(res.path);
    } catch {
      /* surfaced by the disabled state returning to normal */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        {value ? (
          <Image src={value} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <FiUpload />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
    </div>
  );
}

function CategorySelect({ value, onChange }) {
  const { data } = useQuery('pb-categories', api.getAllCategoriesByAdmin, { staleTime: 300_000 });
  const categories = data?.data ?? [];
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">— Select category —</option>
      {categories.map((c) => (
        <option key={c.id || c.slug} value={c.slug}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function CampaignSelect({ value, onChange }) {
  const { data } = useQuery('pb-campaigns', () => api.getCampaignsByAdmin(1, ''), { staleTime: 300_000 });
  const campaigns = data?.data ?? [];
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">— Select campaign —</option>
      {campaigns.map((c) => (
        <option key={c.id} value={c.slug}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

// ── Repeater ─────────────────────────────────────────────────────────────────

function Repeater({ field, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const [openIdx, setOpenIdx] = useState(0);

  const setItem = (idx, key, v) =>
    onChange(items.map((item, i) => (i === idx ? { ...item, [key]: v } : item)));

  const add = () => {
    if (field.max && items.length >= field.max) return;
    const blank = Object.fromEntries(field.fields.map((f) => [f.key, f.type === 'boolean' ? false : '']));
    onChange([...items, blank]);
    setOpenIdx(items.length);
  };

  const remove = (idx) => {
    if (field.min && items.length <= field.min) return;
    onChange(items.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
    setOpenIdx(target);
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const open = openIdx === idx;
        return (
          <div key={idx} className="rounded-md border border-gray-200">
            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? -1 : idx)}
                className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-gray-700"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-[10px] text-gray-500">
                  {idx + 1}
                </span>
                <span className="truncate">
                  {typeof field.itemLabel === 'function' ? field.itemLabel(item) : `Item ${idx + 1}`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move up"
              >
                <FiChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === items.length - 1}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move down"
              >
                <FiChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={field.min && items.length <= field.min}
                className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                aria-label="Remove"
              >
                <FiTrash2 size={14} />
              </button>
            </div>

            {open && (
              <div className="space-y-3 p-3">
                {field.fields.map((sub) => (
                  <div key={sub.key}>
                    <Label>{sub.label}</Label>
                    <Field field={sub} value={item[sub.key]} onChange={(v) => setItem(idx, sub.key, v)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        disabled={field.max && items.length >= field.max}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-200 py-2 text-xs font-semibold text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40"
      >
        <FiPlus size={13} /> Add
      </button>
    </div>
  );
}

// ── Field switch ─────────────────────────────────────────────────────────────

function Field({ field, value, onChange }) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          rows={3}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={inputCls}
        />
      );

    case 'select':
      return (
        <select
          value={value ?? ''}
          onChange={(e) => {
            // Options may carry numbers (e.g. images per row); keep the type.
            const picked = field.options.find((o) => String(o.value) === e.target.value);
            onChange(picked ? picked.value : e.target.value);
          }}
          className={inputCls}
        >
          {field.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      );

    case 'boolean':
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative h-6 w-11 rounded-full transition-colors ${value ? 'bg-yellow-500' : 'bg-gray-200'}`}
          role="switch"
          aria-checked={!!value}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              value ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      );

    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value || '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-gray-200"
          />
          <input
            value={value || ''}
            placeholder="transparent"
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} font-mono`}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="whitespace-nowrap rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      );

    case 'image':
      return <ImagePicker value={value} onChange={onChange} />;

    case 'category':
      return <CategorySelect value={value} onChange={onChange} />;

    case 'campaign':
      return <CampaignSelect value={value} onChange={onChange} />;

    case 'repeater':
      return <Repeater field={field} value={value} onChange={onChange} />;

    case 'text':
    default:
      return (
        <input
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${field.mono ? 'font-mono text-xs' : ''}`}
        />
      );
  }
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function BlockSettings({ block, config, onChange }) {
  const [tab, setTab] = useState('content');
  if (!block) return null;

  // Tabs with nothing in them are not shown at all, so simple blocks stay a
  // single plain form rather than sprouting two empty tabs.
  const populated = SETTINGS_TABS.filter((t) => fieldsForTab(block, config, t.key).length > 0);
  const activeTab = populated.some((t) => t.key === tab) ? tab : populated[0]?.key;
  const fields = activeTab ? fieldsForTab(block, config, activeTab) : [];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-800">{block.label}</p>
        <p className="text-xs text-gray-500">{block.description}</p>
      </div>

      {block.note && <p className="rounded-md bg-blue-50 px-3 py-2 text-[11px] text-blue-700">{block.note}</p>}

      {populated.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200">
          {populated.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
                t.key === activeTab
                  ? 'border-[#93003f] text-[#93003f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <Label hint={field.hint}>
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </Label>
            <Field field={field} value={config?.[field.key]} onChange={(v) => onChange(field.key, v)} />
          </div>
        ))}

        {fields.length === 0 && <p className="text-xs text-gray-400">This block has no settings.</p>}
      </div>
    </div>
  );
}
