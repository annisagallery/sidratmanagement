'use client';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import {
  Accordion,
  Label,
  ColorInput,
  BoxControl,
  SizeControl,
  TypographyControl,
  BackgroundControl,
  BorderControl,
  ShadowControl,
  ToggleGroup,
  ALIGN_OPTIONS,
  inputCls
} from './controls';
import { DEVICES, ANIMATIONS, deviceValue, setDeviceValue } from './styleEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Page builder — universal Style and Advanced panels
// ─────────────────────────────────────────────────────────────────────────────
// Every block gets these, whatever it is. A block's own schema describes what it
// *says*; these describe how it *looks*, and because they write into the same
// `config.style` object for all blocks, one style engine can render them all.
//
// Adding a control here gives it to every block at once — which is the whole
// reason the styling lives outside the per-block field lists.

const countSet = (obj) => {
  if (!obj || typeof obj !== 'object') return 0;
  return Object.values(obj).filter((v) => {
    if (v === '' || v === null || v === undefined) return false;
    if (typeof v === 'object') return countSet(v) > 0;
    return true;
  }).length;
};

export function StylePanel({ style = {}, onChange, device }) {
  const patch = (key, value) => onChange({ ...style, [key]: value });

  return (
    <div className="space-y-2">
      <Accordion title="Layout" defaultOpen badge={countSet({ align: style.align, maxWidth: style.maxWidth, minHeight: style.minHeight }) || null}>
        <div>
          <Label>Content alignment</Label>
          <ToggleGroup
            value={deviceValue(style.align, device) ?? ''}
            options={ALIGN_OPTIONS}
            onChange={(v) => patch('align', setDeviceValue(style.align, device, v))}
            allowEmpty
          />
        </div>
        <div>
          <Label hint="Leave empty to fill the page container.">Maximum width</Label>
          <SizeControl
            value={style.maxWidth}
            onChange={(v) => patch('maxWidth', v)}
            device={device}
            units={['px', '%', 'vw']}
            max={1600}
          />
        </div>
        <div>
          <Label>Minimum height</Label>
          <SizeControl
            value={style.minHeight}
            onChange={(v) => patch('minHeight', v)}
            device={device}
            units={['px', 'vh', '%']}
            max={1000}
          />
        </div>
        <div>
          <Label hint="Breaks the block out of the page container, edge to edge.">Full-bleed width</Label>
          <ToggleGroup
            value={style.fullWidth ? 'yes' : 'no'}
            onChange={(v) => patch('fullWidth', v === 'yes')}
            options={[
              { value: 'no', label: 'Contained' },
              { value: 'yes', label: 'Full bleed' }
            ]}
          />
        </div>
      </Accordion>

      <Accordion title="Spacing" defaultOpen badge={countSet(style.padding) + countSet(style.margin) || null}>
        <div>
          <Label hint="Space inside the block, around its contents.">Padding</Label>
          <BoxControl value={style.padding} onChange={(v) => patch('padding', v)} device={device} />
        </div>
        <div>
          <Label hint="Space outside the block, between it and its neighbours.">Margin</Label>
          <BoxControl value={style.margin} onChange={(v) => patch('margin', v)} device={device} />
        </div>
      </Accordion>

      <Accordion title="Background" badge={style.bg?.type && style.bg.type !== 'none' ? style.bg.type : null}>
        <BackgroundControl value={style.bg} onChange={(v) => patch('bg', v)} />
      </Accordion>

      <Accordion title="Border & corners" badge={countSet(style.border) || null}>
        <BorderControl value={style.border} onChange={(v) => patch('border', v)} device={device} />
      </Accordion>

      <Accordion title="Shadow" badge={style.shadow?.preset && style.shadow.preset !== 'none' ? style.shadow.preset : null}>
        <ShadowControl value={style.shadow} onChange={(v) => patch('shadow', v)} />
      </Accordion>

      <Accordion title="Headings" badge={countSet(style.heading) || null}>
        <TypographyControl value={style.heading} onChange={(v) => patch('heading', v)} device={device} />
      </Accordion>

      <Accordion title="Body text" badge={countSet(style.text) || null}>
        <TypographyControl value={style.text} onChange={(v) => patch('text', v)} device={device} />
      </Accordion>

      <Accordion title="Links" badge={countSet(style.link) || null}>
        <div>
          <Label>Link colour</Label>
          <ColorInput value={style.link?.color} onChange={(v) => patch('link', { ...(style.link || {}), color: v })} />
        </div>
        <div>
          <Label>Link colour on hover</Label>
          <ColorInput
            value={style.link?.hoverColor}
            onChange={(v) => patch('link', { ...(style.link || {}), hoverColor: v })}
          />
        </div>
      </Accordion>

      <Accordion title="Hover" badge={countSet(style.hover) || null}>
        <div>
          <Label>Movement</Label>
          <select
            value={style.hover?.transform || 'none'}
            onChange={(e) => patch('hover', { ...(style.hover || {}), transform: e.target.value })}
            className={inputCls}
          >
            <option value="none">None</option>
            <option value="lift">Lift up</option>
            <option value="sink">Push down</option>
            <option value="zoom">Grow slightly</option>
          </select>
        </div>
        <div>
          <Label>Background on hover</Label>
          <ColorInput value={style.hover?.bg} onChange={(v) => patch('hover', { ...(style.hover || {}), bg: v })} />
        </div>
        <div>
          <Label>Text colour on hover</Label>
          <ColorInput
            value={style.hover?.textColor}
            onChange={(v) => patch('hover', { ...(style.hover || {}), textColor: v })}
          />
        </div>
        <div>
          <Label>Border colour on hover</Label>
          <ColorInput
            value={style.hover?.borderColor}
            onChange={(v) => patch('hover', { ...(style.hover || {}), borderColor: v })}
          />
        </div>
        <div>
          <Label>Shadow on hover</Label>
          <ShadowControl value={style.hover?.shadow} onChange={(v) => patch('hover', { ...(style.hover || {}), shadow: v })} />
        </div>
        <div>
          <Label>Transition speed (ms)</Label>
          <input
            type="number"
            min="0"
            max="2000"
            step="50"
            value={style.hover?.duration ?? ''}
            placeholder="300"
            onChange={(e) =>
              patch('hover', { ...(style.hover || {}), duration: e.target.value === '' ? '' : Number(e.target.value) })
            }
            className={inputCls}
          />
        </div>
      </Accordion>
    </div>
  );
}

export function AdvancedPanel({ style = {}, onChange }) {
  const patch = (key, value) => onChange({ ...style, [key]: value });
  const hide = style.hide || {};

  return (
    <div className="space-y-2">
      <Accordion title="Visibility" defaultOpen badge={DEVICES.filter((d) => hide[d]).length || null}>
        <Label hint="Hide the block on a screen size without deleting it.">Show on</Label>
        <div className="space-y-1">
          {DEVICES.map((d) => {
            const hidden = !!hide[d];
            return (
              <button
                key={d}
                type="button"
                onClick={() => patch('hide', { ...hide, [d]: !hidden })}
                className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-[11px] font-semibold capitalize ${
                  hidden ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-green-200 bg-green-50 text-green-700'
                }`}
              >
                {d}
                {hidden ? <FiEyeOff size={12} /> : <FiEye size={12} />}
              </button>
            );
          })}
        </div>
      </Accordion>

      <Accordion title="Entrance animation" badge={style.animation?.name || null}>
        <div>
          <Label>Animation</Label>
          <select
            value={style.animation?.name || ''}
            onChange={(e) => patch('animation', { ...(style.animation || {}), name: e.target.value })}
            className={inputCls}
          >
            {ANIMATIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        {style.animation?.name && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Duration (ms)</Label>
              <input
                type="number"
                value={style.animation?.duration ?? ''}
                placeholder="600"
                onChange={(e) =>
                  patch('animation', {
                    ...(style.animation || {}),
                    duration: e.target.value === '' ? '' : Number(e.target.value)
                  })
                }
                className={inputCls}
              />
            </div>
            <div>
              <Label>Delay (ms)</Label>
              <input
                type="number"
                value={style.animation?.delay ?? ''}
                placeholder="0"
                onChange={(e) =>
                  patch('animation', {
                    ...(style.animation || {}),
                    delay: e.target.value === '' ? '' : Number(e.target.value)
                  })
                }
                className={inputCls}
              />
            </div>
          </div>
        )}
      </Accordion>

      <Accordion title="Position & opacity" badge={countSet({ zIndex: style.zIndex, opacity: style.opacity }) || null}>
        <div>
          <Label hint="Higher numbers sit in front. Leave empty for the natural order.">Layer (z-index)</Label>
          <input
            type="number"
            value={style.zIndex ?? ''}
            placeholder="auto"
            onChange={(e) => patch('zIndex', e.target.value === '' ? '' : Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <Label>Opacity</Label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={style.opacity ?? 100}
              onChange={(e) => patch('opacity', Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer accent-[#93003f]"
            />
            <span className="w-9 text-right text-[10px] text-gray-500">{style.opacity ?? 100}%</span>
          </div>
        </div>
      </Accordion>

      <Accordion title="Custom CSS & identifiers">
        <div>
          <Label hint="Used for anchor links: /#my-id">CSS id</Label>
          <input
            value={style.cssId || ''}
            placeholder="my-section"
            onChange={(e) => patch('cssId', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <Label hint="Space-separated. Tailwind classes work here.">CSS classes</Label>
          <input
            value={style.cssClass || ''}
            placeholder="shadow-lg rounded-xl"
            onChange={(e) => patch('cssClass', e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <Label hint="Write `selector` where you mean this block. Example: selector h2 { color: red }">
            Custom CSS
          </Label>
          <textarea
            rows={6}
            value={style.customCss || ''}
            placeholder={'selector {\n  border-top: 2px solid #93003f;\n}'}
            onChange={(e) => patch('customCss', e.target.value)}
            className={`${inputCls} font-mono leading-relaxed`}
          />
        </div>
      </Accordion>
    </div>
  );
}
