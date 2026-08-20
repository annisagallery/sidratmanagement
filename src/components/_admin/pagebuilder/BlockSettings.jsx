'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { FiPlus, FiTrash2, FiChevronDown, FiChevronUp, FiCopy } from 'react-icons/fi';
import * as api from 'src/services';
import { fieldsForTab } from './blocks';
import {
  Label,
  inputCls,
  ImagePicker,
  ColorInput,
  BoxControl,
  SizeControl,
  ToggleGroup,
  LinkControl,
  ALIGN_OPTIONS,
  DeviceToggle
} from './controls';
import { StylePanel, AdvancedPanel } from './StylePanel';
import { ICON_OPTIONS } from './icons';

// Renders a block's settings from its `fields` schema, then bolts the universal
// Style and Advanced panels on top so every block — including ones whose schema
// declares nothing but a heading — gets the full set of layout, spacing,
// typography and effect controls.
//
// Every input is controlled and reports upward through onChange(key, value), so
// the builder keeps a single source of truth for the block's config.

// ── Reference selects ────────────────────────────────────────────────────────

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

function IconSelect({ value, onChange }) {
  return (
    <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto rounded-md border border-gray-200 p-1.5">
      {ICON_OPTIONS.map(({ value: key, Icon, label }) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onChange(key)}
          className={`flex aspect-square items-center justify-center rounded border text-base ${
            value === key ? 'border-[#93003f] bg-[#93003f]/10 text-[#93003f]' : 'border-transparent text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}

// ── Repeater ─────────────────────────────────────────────────────────────────

function Repeater({ field, value, onChange, device }) {
  const items = Array.isArray(value) ? value : [];
  const [openIdx, setOpenIdx] = useState(0);

  const setItem = (idx, key, v) => onChange(items.map((item, i) => (i === idx ? { ...item, [key]: v } : item)));

  const blankItem = () =>
    Object.fromEntries(
      field.fields.map((f) => [f.key, f.default !== undefined ? f.default : f.type === 'boolean' ? false : ''])
    );

  const add = () => {
    if (field.max && items.length >= field.max) return;
    onChange([...items, blankItem()]);
    setOpenIdx(items.length);
  };

  const duplicate = (idx) => {
    if (field.max && items.length >= field.max) return;
    const next = [...items];
    next.splice(idx + 1, 0, { ...items[idx] });
    onChange(next);
    setOpenIdx(idx + 1);
  };

  const remove = (idx) => {
    if (field.min && items.length <= field.min) return;
    onChange(items.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
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
            <div className="flex items-center gap-0.5 bg-gray-50 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? -1 : idx)}
                className="flex flex-1 items-center gap-2 text-left text-[11px] font-semibold text-gray-700"
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
                <FiChevronUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === items.length - 1}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move down"
              >
                <FiChevronDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => duplicate(idx)}
                disabled={field.max && items.length >= field.max}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Duplicate"
              >
                <FiCopy size={12} />
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={field.min && items.length <= field.min}
                className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                aria-label="Remove"
              >
                <FiTrash2 size={13} />
              </button>
            </div>

            {open && (
              <div className="space-y-3 p-2.5">
                {field.fields.map((sub) => (
                  <div key={sub.key}>
                    <Label hint={sub.hint}>{sub.label}</Label>
                    <Field
                      field={sub}
                      value={item[sub.key]}
                      onChange={(v) => setItem(idx, sub.key, v)}
                      device={device}
                    />
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
        className="flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-200 py-2 text-[11px] font-semibold text-gray-500 hover:border-[#93003f] hover:text-[#93003f] disabled:opacity-40"
      >
        <FiPlus size={12} /> {field.addLabel || 'Add'}
      </button>
    </div>
  );
}

// ── Field switch ─────────────────────────────────────────────────────────────

function Field({ field, value, onChange, device }) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          rows={field.rows || 3}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );

    case 'html':
      return (
        <textarea
          rows={field.rows || 8}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} font-mono leading-relaxed`}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={inputCls}
        />
      );

    case 'select':
      return (
        <select
          value={String(value ?? '')}
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

    case 'toggleGroup':
      return (
        <ToggleGroup
          value={value}
          options={field.options === 'align' ? ALIGN_OPTIONS : field.options}
          onChange={onChange}
          allowEmpty={field.allowEmpty}
        />
      );

    case 'boolean':
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative h-5 w-9 rounded-full transition-colors ${value ? 'bg-[#93003f]' : 'bg-gray-200'}`}
          role="switch"
          aria-checked={!!value}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              value ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      );

    case 'color':
      return <ColorInput value={value} onChange={onChange} />;

    case 'size':
      return (
        <SizeControl
          value={value}
          onChange={onChange}
          device={device}
          units={field.units}
          min={field.min}
          max={field.max}
          // A block's own sizes are rendered as one inline style, so they are a
          // single value; only the universal Style panel stores them per device.
          responsive={field.responsive === true}
        />
      );

    case 'box':
      return <BoxControl value={value} onChange={onChange} device={device} units={field.units} corners={field.corners} />;

    case 'link':
      return <LinkControl value={value} onChange={onChange} />;

    case 'icon':
      return <IconSelect value={value} onChange={onChange} />;

    case 'image':
      return <ImagePicker value={value} onChange={onChange} />;

    case 'category':
      return <CategorySelect value={value} onChange={onChange} />;

    case 'campaign':
      return <CampaignSelect value={value} onChange={onChange} />;

    case 'repeater':
      return <Repeater field={field} value={value} onChange={onChange} device={device} />;

    case 'text':
    default:
      return (
        <input
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${field.mono ? 'font-mono' : ''}`}
        />
      );
  }
}

// ── Panel ────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'content', label: 'Content' },
  { key: 'style', label: 'Style' },
  { key: 'advanced', label: 'Advanced' }
];

export default function BlockSettings({ block, config, onChange, onStyleChange, device, onDevice }) {
  const [tab, setTab] = useState('content');
  if (!block) return null;

  const style = config?.style || {};
  const ownFields = fieldsForTab(block, config, tab);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-800">{block.label}</p>
        <p className="text-[11px] leading-snug text-gray-500">{block.description}</p>
      </div>

      {block.note && <p className="rounded-md bg-blue-50 px-2.5 py-2 text-[11px] leading-snug text-blue-700">{block.note}</p>}

      <div className="sticky top-0 z-10 -mx-3 border-b border-gray-200 bg-white px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  t.key === tab ? 'border-[#93003f] text-[#93003f]' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Responsive editing is only meaningful once you can say which screen
              you are editing, so the switcher rides along with the tabs. */}
          <DeviceToggle device={device} onDevice={onDevice} />
        </div>
      </div>

      {device !== 'desktop' && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[10px] leading-snug text-amber-700">
          Editing <b>{device}</b>. Values left blank fall back to the larger screen.
        </p>
      )}

      <div className="space-y-4">
        {ownFields.map((field) => (
          <div key={field.key}>
            <Label hint={field.hint}>
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </Label>
            <Field field={field} value={config?.[field.key]} onChange={(v) => onChange(field.key, v)} device={device} />
          </div>
        ))}

        {tab === 'content' && ownFields.length === 0 && (
          <p className="text-[11px] text-gray-400">This block has no content settings — try the Style tab.</p>
        )}

        {tab === 'style' && <StylePanel style={style} onChange={onStyleChange} device={device} />}
        {tab === 'advanced' && <AdvancedPanel style={style} onChange={onStyleChange} />}
      </div>
    </div>
  );
}
