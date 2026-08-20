'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import {
  FiUpload,
  FiLink,
  FiChevronDown,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight,
  FiMonitor,
  FiTablet,
  FiSmartphone
} from 'react-icons/fi';
import * as api from 'src/services';
import { DEVICES, UNITS, FONT_STACKS, deviceValue, setDeviceValue } from './styleEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Page builder — control primitives
// ─────────────────────────────────────────────────────────────────────────────
// The inputs the settings panel is assembled from. They are deliberately dumb:
// each takes a value and reports the next one, and knows nothing about which
// block it is editing. That is what lets the same four-sided box control serve
// padding, margin, border width and radius.
//
// Anything responsive takes the currently-selected `device` and edits only that
// device's slot, showing the inherited value as a placeholder so an empty field
// reads as "same as desktop" rather than "zero".

export const inputCls =
  'w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 focus:border-[#93003f] focus:outline-none';

export const DEVICE_ICONS = { desktop: FiMonitor, tablet: FiTablet, mobile: FiSmartphone };

export function Label({ children, hint, right }) {
  return (
    <div className="mb-1 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <label className="text-[11px] font-semibold text-gray-600">{children}</label>
        {hint && <p className="text-[10px] leading-tight text-gray-400">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/** Collapsible group — Elementor's section headers, and the reason the style
 *  tab does not arrive as one intimidating wall of inputs. */
export function Accordion({ title, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 bg-gray-50 px-2.5 py-2 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{title}</span>
        <span className="flex items-center gap-1.5">
          {badge && <span className="rounded bg-[#93003f]/10 px-1.5 py-px text-[9px] font-bold text-[#93003f]">{badge}</span>}
          <FiChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="space-y-3 p-2.5">{children}</div>}
    </div>
  );
}

/** The per-control device switcher that sits beside a responsive label. */
export function DeviceToggle({ device, onDevice }) {
  return (
    <span className="flex shrink-0 items-center gap-px rounded bg-gray-100 p-px">
      {DEVICES.map((d) => {
        const Icon = DEVICE_ICONS[d];
        return (
          <button
            key={d}
            type="button"
            title={`Edit for ${d}`}
            onClick={() => onDevice(d)}
            className={`rounded p-1 ${device === d ? 'bg-white text-[#93003f] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Icon size={11} />
          </button>
        );
      })}
    </span>
  );
}

// ── Colour ───────────────────────────────────────────────────────────────────

const SWATCHES = ['#93003f', '#111827', '#374151', '#6b7280', '#f3f4f6', '#ffffff', '#fef3c7', '#dcfce7', '#dbeafe'];

export function ColorInput({ value, onChange, allowClear = true }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border border-gray-200"
        />
        <input
          value={value || ''}
          placeholder="inherit"
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} font-mono`}
        />
        {allowClear && value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Clear"
            className="shrink-0 rounded border border-gray-200 px-1.5 py-1 text-[10px] text-gray-500 hover:bg-gray-50"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className="h-4 w-4 rounded border border-gray-300"
          />
        ))}
      </div>
    </div>
  );
}

// ── Image ────────────────────────────────────────────────────────────────────

export function ImagePicker({ value, onChange }) {
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
      // rather than an Image id — blocks stay self-contained that way.
      onChange(res.path);
    } catch {
      /* surfaced by the button returning from its disabled state */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        {value ? (
          <Image src={value} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <FiUpload size={14} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
    </div>
  );
}

// ── Icon button group ────────────────────────────────────────────────────────

export function ToggleGroup({ value, options, onChange, allowEmpty = false }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-gray-200">
      {options.map((o) => {
        const active = String(value ?? '') === String(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            title={o.label}
            onClick={() => onChange(active && allowEmpty ? '' : o.value)}
            className={`flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              active ? 'bg-[#93003f] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {o.icon ? <o.icon size={12} /> : o.label}
          </button>
        );
      })}
    </div>
  );
}

export const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left', icon: FiAlignLeft },
  { value: 'center', label: 'Center', icon: FiAlignCenter },
  { value: 'right', label: 'Right', icon: FiAlignRight }
];

// ── Size (number + unit), responsive ─────────────────────────────────────────

/**
 * A number with a unit, and a slider for the number.
 *
 * `responsive` decides whether the value is stored per device. It is off for a
 * block's own settings, which the storefront reads as a single inline style —
 * offering three device slots there would let someone set a mobile value that
 * silently never applies.
 */
export function SizeControl({
  value,
  onChange,
  device,
  units = UNITS,
  min = 0,
  max = 500,
  step = 1,
  placeholder,
  responsive = true
}) {
  const own = (responsive ? deviceValue(value, device) : value?.desktop ?? value) || {};
  const unit = own.unit || 'px';
  const raw = own.value;

  const patch = (next) => onChange(responsive ? setDeviceValue(value, device, next) : next);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="range"
        min={min}
        max={unit === '%' ? 100 : max}
        step={step}
        value={raw === '' || raw === undefined ? min : Number(raw)}
        onChange={(e) => patch({ value: Number(e.target.value), unit })}
        className="h-1 flex-1 cursor-pointer accent-[#93003f]"
      />
      <input
        type="number"
        value={raw ?? ''}
        placeholder={placeholder ?? 'auto'}
        onChange={(e) => patch({ value: e.target.value === '' ? '' : Number(e.target.value), unit })}
        className="w-14 shrink-0 rounded-md border border-gray-200 px-1.5 py-1 text-[11px] focus:border-[#93003f] focus:outline-none"
      />
      <select
        value={unit}
        onChange={(e) => patch({ value: raw ?? '', unit: e.target.value })}
        className="w-14 shrink-0 rounded-md border border-gray-200 px-1 py-1 text-[10px] focus:border-[#93003f] focus:outline-none"
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Four-sided box, responsive ───────────────────────────────────────────────

const SIDES = [
  ['top', 'Top'],
  ['right', 'Right'],
  ['bottom', 'Bottom'],
  ['left', 'Left']
];

export function BoxControl({ value, onChange, device, units = ['px', '%', 'em', 'rem'], corners = false }) {
  const own = deviceValue(value, device) || {};
  const linked = own.linked !== false;

  const write = (next) => onChange(setDeviceValue(value, device, next));

  const setSide = (side, raw) => {
    const v = raw === '' ? '' : Number(raw);
    if (linked) {
      write({ ...own, top: v, right: v, bottom: v, left: v });
    } else {
      write({ ...own, [side]: v });
    }
  };

  const labels = corners
    ? [
        ['top', 'TL'],
        ['right', 'TR'],
        ['bottom', 'BR'],
        ['left', 'BL']
      ]
    : SIDES;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {labels.map(([side, label]) => (
          <div key={side} className="min-w-0 flex-1">
            <input
              type="number"
              value={own[side] ?? ''}
              placeholder="–"
              onChange={(e) => setSide(side, e.target.value)}
              className="w-full rounded-md border border-gray-200 px-1 py-1 text-center text-[11px] focus:border-[#93003f] focus:outline-none"
            />
            <p className="mt-0.5 text-center text-[9px] uppercase text-gray-400">{label}</p>
          </div>
        ))}
        <div className="shrink-0">
          <select
            value={own.unit || 'px'}
            onChange={(e) => write({ ...own, unit: e.target.value })}
            className="w-12 rounded-md border border-gray-200 px-1 py-1 text-[10px] focus:border-[#93003f] focus:outline-none"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button
            type="button"
            title={linked ? 'Values are linked' : 'Values are independent'}
            onClick={() => write({ ...own, linked: !linked })}
            className={`mt-0.5 flex w-12 items-center justify-center rounded border py-0.5 ${
              linked ? 'border-[#93003f] bg-[#93003f]/10 text-[#93003f]' : 'border-gray-200 text-gray-400'
            }`}
          >
            <FiLink size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Typography group ─────────────────────────────────────────────────────────

const WEIGHTS = ['', '300', '400', '500', '600', '700', '800', '900'];

export function TypographyControl({ value = {}, onChange, device }) {
  const patch = (key, v) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-2.5">
      <div>
        <Label>Font</Label>
        <select value={value.family || ''} onChange={(e) => patch('family', e.target.value)} className={inputCls}>
          {FONT_STACKS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Size</Label>
        <SizeControl
          value={value.size}
          onChange={(v) => patch('size', v)}
          device={device}
          units={['px', 'rem', 'em', 'vw']}
          min={8}
          max={120}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Weight</Label>
          <select value={value.weight || ''} onChange={(e) => patch('weight', e.target.value)} className={inputCls}>
            {WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {w || 'Default'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Transform</Label>
          <select value={value.transform || ''} onChange={(e) => patch('transform', e.target.value)} className={inputCls}>
            <option value="">Default</option>
            <option value="none">Normal</option>
            <option value="uppercase">UPPERCASE</option>
            <option value="lowercase">lowercase</option>
            <option value="capitalize">Capitalize</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Line height</Label>
          <input
            type="number"
            step="0.05"
            value={deviceValue(value.lineHeight, device) ?? ''}
            placeholder="auto"
            onChange={(e) =>
              patch('lineHeight', setDeviceValue(value.lineHeight, device, e.target.value === '' ? '' : Number(e.target.value)))
            }
            className={inputCls}
          />
        </div>
        <div>
          <Label>Letter spacing</Label>
          <input
            type="number"
            step="0.1"
            value={deviceValue(value.letterSpacing, device) ?? ''}
            placeholder="0"
            onChange={(e) =>
              patch(
                'letterSpacing',
                setDeviceValue(value.letterSpacing, device, e.target.value === '' ? '' : Number(e.target.value))
              )
            }
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <Label>Colour</Label>
        <ColorInput value={value.color} onChange={(v) => patch('color', v)} />
      </div>
    </div>
  );
}

// ── Background group ─────────────────────────────────────────────────────────

export function BackgroundControl({ value = {}, onChange }) {
  const patch = (key, v) => onChange({ ...value, [key]: v });
  const type = value.type || 'none';

  return (
    <div className="space-y-2.5">
      <ToggleGroup
        value={type}
        onChange={(v) => patch('type', v)}
        options={[
          { value: 'none', label: 'None' },
          { value: 'color', label: 'Colour' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'image', label: 'Image' }
        ]}
      />

      {type === 'color' && (
        <div>
          <Label>Colour</Label>
          <ColorInput value={value.color} onChange={(v) => patch('color', v)} />
        </div>
      )}

      {type === 'gradient' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>From</Label>
              <ColorInput value={value.gradientFrom} onChange={(v) => patch('gradientFrom', v)} />
            </div>
            <div>
              <Label>To</Label>
              <ColorInput value={value.gradientTo} onChange={(v) => patch('gradientTo', v)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Shape</Label>
              <select
                value={value.gradientType || 'linear'}
                onChange={(e) => patch('gradientType', e.target.value)}
                className={inputCls}
              >
                <option value="linear">Linear</option>
                <option value="radial">Radial</option>
              </select>
            </div>
            <div>
              <Label>Angle</Label>
              <input
                type="number"
                value={value.gradientAngle ?? 180}
                onChange={(e) => patch('gradientAngle', Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>
        </>
      )}

      {type === 'image' && (
        <>
          <div>
            <Label>Image</Label>
            <ImagePicker value={value.image} onChange={(v) => patch('image', v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Size</Label>
              <select value={value.size || 'cover'} onChange={(e) => patch('size', e.target.value)} className={inputCls}>
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="auto">Original</option>
              </select>
            </div>
            <div>
              <Label>Position</Label>
              <select
                value={value.position || 'center center'}
                onChange={(e) => patch('position', e.target.value)}
                className={inputCls}
              >
                <option value="center center">Center</option>
                <option value="top center">Top</option>
                <option value="bottom center">Bottom</option>
                <option value="center left">Left</option>
                <option value="center right">Right</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Repeat</Label>
              <select value={value.repeat || 'no-repeat'} onChange={(e) => patch('repeat', e.target.value)} className={inputCls}>
                <option value="no-repeat">No repeat</option>
                <option value="repeat">Tile</option>
                <option value="repeat-x">Tile across</option>
                <option value="repeat-y">Tile down</option>
              </select>
            </div>
            <div>
              <Label>Scroll</Label>
              <select
                value={value.attachment || 'scroll'}
                onChange={(e) => patch('attachment', e.target.value)}
                className={inputCls}
              >
                <option value="scroll">Scrolls</option>
                <option value="fixed">Fixed (parallax)</option>
              </select>
            </div>
          </div>
          <div>
            <Label hint="Darkens or tints the image so text stays readable.">Overlay</Label>
            <ColorInput value={value.overlay} onChange={(v) => patch('overlay', v)} />
          </div>
          {value.overlay && (
            <div>
              <Label>Overlay strength</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={value.overlayOpacity ?? 40}
                  onChange={(e) => patch('overlayOpacity', Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer accent-[#93003f]"
                />
                <span className="w-9 text-right text-[10px] text-gray-500">{value.overlayOpacity ?? 40}%</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Border group ─────────────────────────────────────────────────────────────

export function BorderControl({ value = {}, onChange, device }) {
  const patch = (key, v) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-2.5">
      <div>
        <Label>Style</Label>
        <select value={value.style || 'solid'} onChange={(e) => patch('style', e.target.value)} className={inputCls}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="double">Double</option>
        </select>
      </div>
      <div>
        <Label>Width</Label>
        <BoxControl value={value.width} onChange={(v) => patch('width', v)} device={device} units={['px']} />
      </div>
      <div>
        <Label>Colour</Label>
        <ColorInput value={value.color} onChange={(v) => patch('color', v)} />
      </div>
      <div>
        <Label hint="Top-left, top-right, bottom-right, bottom-left.">Corner radius</Label>
        <BoxControl value={value.radius} onChange={(v) => patch('radius', v)} device={device} units={['px', '%']} corners />
      </div>
    </div>
  );
}

// ── Shadow group ─────────────────────────────────────────────────────────────

export function ShadowControl({ value = {}, onChange }) {
  const patch = (key, v) => onChange({ ...value, [key]: v });
  const preset = value.preset || 'none';

  return (
    <div className="space-y-2.5">
      <select value={preset} onChange={(e) => patch('preset', e.target.value)} className={inputCls}>
        <option value="none">None</option>
        <option value="sm">Subtle</option>
        <option value="md">Medium</option>
        <option value="lg">Large</option>
        <option value="xl">Dramatic</option>
        <option value="custom">Custom…</option>
      </select>

      {preset === 'custom' && (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              ['x', 'X'],
              ['y', 'Y'],
              ['blur', 'Blur'],
              ['spread', 'Spread']
            ].map(([key, label]) => (
              <div key={key}>
                <input
                  type="number"
                  value={value[key] ?? ''}
                  placeholder="0"
                  onChange={(e) => patch(key, e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-md border border-gray-200 px-1 py-1 text-center text-[11px] focus:border-[#93003f] focus:outline-none"
                />
                <p className="mt-0.5 text-center text-[9px] uppercase text-gray-400">{label}</p>
              </div>
            ))}
          </div>
          <div>
            <Label>Colour</Label>
            <ColorInput value={value.color} onChange={(v) => patch('color', v)} />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-gray-600">
            <input type="checkbox" checked={!!value.inset} onChange={(e) => patch('inset', e.target.checked)} />
            Inner shadow
          </label>
        </>
      )}
    </div>
  );
}

// ── Link ─────────────────────────────────────────────────────────────────────

export function LinkControl({ value, onChange }) {
  const v = typeof value === 'string' ? { url: value } : value || {};
  const patch = (key, next) => onChange({ ...v, [key]: next });
  return (
    <div className="space-y-1.5">
      <input
        value={v.url || ''}
        placeholder="/products?category=abaya"
        onChange={(e) => patch('url', e.target.value)}
        className={inputCls}
      />
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <input type="checkbox" checked={!!v.newTab} onChange={(e) => patch('newTab', e.target.checked)} />
          New tab
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <input type="checkbox" checked={!!v.nofollow} onChange={(e) => patch('nofollow', e.target.checked)} />
          Nofollow
        </label>
      </div>
    </div>
  );
}
