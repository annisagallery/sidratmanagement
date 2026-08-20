// ─────────────────────────────────────────────────────────────────────────────
// Page builder — style engine
// ─────────────────────────────────────────────────────────────────────────────
// Every block carries a `config.style` object describing how it looks. This
// module is the single place that knows how to turn that object into CSS, so
// the admin preview and the published storefront can never disagree about what
// a setting means.
//
// COUNTERPART: ecom/src/components/_main/blocks/styleEngine.js — the same logic
// verbatim. Keep the two in step; a divergence shows up as a preview that lies
// about the live page.
//
// Values are stored per device where it matters:
//     { desktop: <v>, tablet: <v>, mobile: <v> }
// A device left empty inherits the next larger one, which is what makes the
// responsive controls behave the way an Elementor user expects rather than
// being three unrelated forms.

export const DEVICES = ['desktop', 'tablet', 'mobile'];

// Max-widths, so the generated media queries line up with Tailwind's own
// breakpoints (lg: 1024, md: 768) and the two systems never fight.
export const BREAKPOINTS = { tablet: 1023, mobile: 767 };

export const UNITS = ['px', '%', 'em', 'rem', 'vw', 'vh'];

const has = (v) => v !== '' && v !== null && v !== undefined;
const num = (v) => (has(v) && !Number.isNaN(Number(v)) ? Number(v) : null);

const isResponsive = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && DEVICES.some((d) => d in v);

// ── Responsive value helpers ─────────────────────────────────────────────────

/** Reads one device's slot without inheriting from a larger one. */
export const deviceValue = (value, device) =>
  isResponsive(value) ? value[device] : device === 'desktop' ? value : undefined;

/** Reads a value the way the browser will see it, cascade included. */
export function resolveResponsive(value, device) {
  const order =
    device === 'mobile'
      ? ['mobile', 'tablet', 'desktop']
      : device === 'tablet'
        ? ['tablet', 'desktop']
        : ['desktop'];
  for (const d of order) {
    const v = deviceValue(value, d);
    if (has(v)) return v;
  }
  return undefined;
}

/** Writes one device's slot, leaving the others alone. */
export const setDeviceValue = (value, device, next) => {
  const base = isResponsive(value) ? value : { desktop: value };
  return { ...base, [device]: next };
};

// ── Primitive serialisers ────────────────────────────────────────────────────

/**
 * A four-sided box: padding, margin, border width, radius. Sides left blank are
 * omitted rather than zeroed, so a block can set only its top padding and
 * inherit the rest from the theme.
 */
export function boxToCss(box, prop) {
  if (!box || typeof box !== 'object') return {};
  const unit = box.unit || 'px';
  // padding/margin put the side after the property, border puts it in the
  // middle, and radius names corners. Spelling them out beats a rule of thumb
  // that produces `border-width-top` and silently does nothing.
  const sides =
    prop === 'border-radius'
      ? [
          ['top', 'border-top-left-radius'],
          ['right', 'border-top-right-radius'],
          ['bottom', 'border-bottom-right-radius'],
          ['left', 'border-bottom-left-radius']
        ]
      : prop === 'border-width'
        ? [
            ['top', 'border-top-width'],
            ['right', 'border-right-width'],
            ['bottom', 'border-bottom-width'],
            ['left', 'border-left-width']
          ]
        : [
            ['top', `${prop}-top`],
            ['right', `${prop}-right`],
            ['bottom', `${prop}-bottom`],
            ['left', `${prop}-left`]
          ];

  const out = {};
  for (const [side, cssProp] of sides) {
    const v = num(box[side]);
    if (v !== null) out[cssProp] = `${v}${unit}`;
  }
  return out;
}

/** A single number-and-unit control: min-height, max-width, gap, and friends. */
export function sizeToCss(size) {
  if (!has(size)) return null;
  if (typeof size === 'string') return size;
  if (typeof size === 'number') return `${size}px`;
  const v = num(size.value);
  if (v === null) return null;
  return `${v}${size.unit || 'px'}`;
}

const SHADOW_PRESETS = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.06)',
  md: '0 4px 12px rgba(0,0,0,0.08)',
  lg: '0 12px 28px rgba(0,0,0,0.12)',
  xl: '0 24px 48px rgba(0,0,0,0.16)'
};

export function shadowToCss(shadow) {
  if (!shadow || !shadow.preset || shadow.preset === 'none') return null;
  if (shadow.preset !== 'custom') return SHADOW_PRESETS[shadow.preset] || null;
  const x = num(shadow.x) ?? 0;
  const y = num(shadow.y) ?? 0;
  const blur = num(shadow.blur) ?? 0;
  const spread = num(shadow.spread) ?? 0;
  const color = shadow.color || 'rgba(0,0,0,0.2)';
  return `${shadow.inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

export function backgroundToCss(bg) {
  if (!bg || !bg.type || bg.type === 'none') return {};

  if (bg.type === 'color') return bg.color ? { 'background-color': bg.color } : {};

  if (bg.type === 'gradient') {
    const from = bg.gradientFrom || '#ffffff';
    const to = bg.gradientTo || '#000000';
    const angle = num(bg.gradientAngle) ?? 180;
    return {
      'background-image':
        bg.gradientType === 'radial'
          ? `radial-gradient(circle, ${from} 0%, ${to} 100%)`
          : `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`
    };
  }

  if (bg.type === 'image' && bg.image) {
    const out = {
      // Quotes in a filename would end the url() early; the escape keeps a
      // hostile-looking name from breaking out of the declaration.
      'background-image': `url("${String(bg.image).replace(/["\\\n]/g, '')}")`,
      'background-size': bg.size || 'cover',
      'background-position': bg.position || 'center center',
      'background-repeat': bg.repeat || 'no-repeat'
    };
    if (bg.attachment === 'fixed') out['background-attachment'] = 'fixed';
    if (bg.color) out['background-color'] = bg.color;
    return out;
  }

  return {};
}

/** Typography, shared by the heading and body groups. */
export function typographyToCss(typo, device) {
  if (!typo || typeof typo !== 'object') return {};
  const out = {};
  const size = sizeToCss(resolveResponsive(typo.size, device));
  const lineHeight = resolveResponsive(typo.lineHeight, device);
  const spacing = resolveResponsive(typo.letterSpacing, device);

  if (typo.family) out['font-family'] = typo.family;
  if (size) out['font-size'] = size;
  if (has(typo.weight)) out['font-weight'] = String(typo.weight);
  if (num(lineHeight) !== null) out['line-height'] = String(num(lineHeight));
  if (num(spacing) !== null) out['letter-spacing'] = `${num(spacing)}px`;
  if (typo.transform) out['text-transform'] = typo.transform;
  if (typo.style) out['font-style'] = typo.style;
  if (typo.decoration) out['text-decoration'] = typo.decoration;
  if (typo.color) out.color = typo.color;
  return out;
}

// ── Rule assembly ────────────────────────────────────────────────────────────

const declBlock = (props) =>
  Object.entries(props)
    .filter(([, v]) => has(v))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

const rule = (selector, props) => {
  const body = declBlock(props);
  return body ? `${selector}{${body}}` : '';
};

/** Everything that can differ between devices, for one device. */
function deviceRules(sel, style, device) {
  const out = [];
  const box = {};

  Object.assign(box, boxToCss(resolveResponsive(style.padding, device), 'padding'));
  Object.assign(box, boxToCss(resolveResponsive(style.margin, device), 'margin'));

  const minHeight = sizeToCss(resolveResponsive(style.minHeight, device));
  if (minHeight) box['min-height'] = minHeight;

  const maxWidth = sizeToCss(resolveResponsive(style.maxWidth, device));
  if (maxWidth) {
    box['max-width'] = maxWidth;
    // A max-width with no centring reads as a bug to whoever set it.
    if (!box['margin-left']) box['margin-left'] = 'auto';
    if (!box['margin-right']) box['margin-right'] = 'auto';
  }

  const align = resolveResponsive(style.align, device);
  if (align) box['text-align'] = align;

  out.push(rule(sel, box));

  const bodyTypo = typographyToCss(style.text, device);
  if (Object.keys(bodyTypo).length) {
    out.push(rule(sel, bodyTypo));
    // Descendants get the family and colour too, since utility classes on the
    // inner elements would otherwise win over the inherited value.
    out.push(
      rule(`${sel} p, ${sel} li, ${sel} span`, {
        'font-family': bodyTypo['font-family'],
        color: bodyTypo.color
      })
    );
  }

  const headingTypo = typographyToCss(style.heading, device);
  if (Object.keys(headingTypo).length) {
    out.push(rule(`${sel} h1, ${sel} h2, ${sel} h3, ${sel} h4, ${sel} .pb-heading`, headingTypo));
  }

  // Per-device hiding is a display rule, so it belongs with the media queries.
  //
  // Un-hiding needs saying out loud: a block hidden on tablet is still inside
  // the tablet media query at phone widths, so "visible on mobile" has to
  // actively override it rather than simply omit the rule.
  const hide = style.hide || {};
  if (hide[device]) {
    out.push(`${sel}{display:none !important}`);
  } else if ((device === 'mobile' && (hide.tablet || hide.desktop)) || (device === 'tablet' && hide.desktop)) {
    out.push(`${sel}{display:block !important}`);
  }

  return out.filter(Boolean).join('');
}

/** Rules that do not vary by device: background, borders, effects, hover. */
function staticRules(sel, style) {
  const after = [];
  const base = {};

  Object.assign(base, backgroundToCss(style.bg));

  if (style.border) {
    const width = boxToCss(style.border.width, 'border-width');
    if (Object.keys(width).length) {
      Object.assign(base, width);
      base['border-style'] = style.border.style || 'solid';
      if (style.border.color) base['border-color'] = style.border.color;
    }
    Object.assign(base, boxToCss(style.border.radius, 'border-radius'));
    if (Object.keys(boxToCss(style.border.radius, 'border-radius')).length) base.overflow = 'hidden';
  }

  const shadow = shadowToCss(style.shadow);
  if (shadow) base['box-shadow'] = shadow;

  if (num(style.opacity) !== null && num(style.opacity) !== 100) {
    base.opacity = String(num(style.opacity) / 100);
  }
  if (num(style.zIndex) !== null) {
    base['z-index'] = String(num(style.zIndex));
    base.position = base.position || 'relative';
  }

  const hover = style.hover || {};
  const hasHover = Boolean(
    hover.bg || hover.borderColor || hover.textColor || shadowToCss(hover.shadow) || (hover.transform && hover.transform !== 'none')
  );
  if (hasHover) base.transition = `all ${num(hover.duration) ?? 300}ms ease`;

  // A background image wants its overlay painted between image and content.
  if (style.bg?.type === 'image' && style.bg.overlay) {
    base.position = base.position || 'relative';
    base.isolation = 'isolate';
    after.push(
      rule(`${sel}::before`, {
        content: '""',
        position: 'absolute',
        inset: '0',
        'background-color': style.bg.overlay,
        opacity: String((num(style.bg.overlayOpacity) ?? 40) / 100),
        'pointer-events': 'none',
        'z-index': '0'
      })
    );
    after.push(rule(`${sel} > *`, { position: 'relative', 'z-index': '1' }));
  }

  if (hasHover) {
    const h = {};
    if (hover.bg) h['background-color'] = hover.bg;
    if (hover.borderColor) h['border-color'] = hover.borderColor;
    if (hover.textColor) h.color = hover.textColor;
    const hoverShadow = shadowToCss(hover.shadow);
    if (hoverShadow) h['box-shadow'] = hoverShadow;
    if (hover.transform === 'lift') h.transform = 'translateY(-4px)';
    if (hover.transform === 'sink') h.transform = 'translateY(4px)';
    if (hover.transform === 'zoom') h.transform = 'scale(1.02)';
    after.push(rule(`${sel}:hover`, h));
  }

  if (style.link?.color) after.push(rule(`${sel} a`, { color: style.link.color }));
  if (style.link?.hoverColor) after.push(rule(`${sel} a:hover`, { color: style.link.hoverColor }));

  return [rule(sel, base), ...after].filter(Boolean).join('');
}

/**
 * The complete stylesheet for one block.
 *
 * The selector is a data attribute rather than an id, so a customer-supplied
 * CSS id can never collide with ours and a block rendered twice still matches.
 */
export function blockCss(id, style) {
  if (!style || typeof style !== 'object' || !id) return '';
  const sel = `[data-sid="${id}"]`;
  const desktop = deviceRules(sel, style, 'desktop');
  const parts = [staticRules(sel, style), desktop];

  // Each device's rules already resolve the inheritance, so a breakpoint whose
  // output matches the one above it changes nothing and is left out. Without
  // this every block ships its typography three times over.
  const tablet = deviceRules(sel, style, 'tablet');
  if (tablet && tablet !== desktop) parts.push(`@media (max-width:${BREAKPOINTS.tablet}px){${tablet}}`);

  const mobile = deviceRules(sel, style, 'mobile');
  if (mobile && mobile !== tablet) parts.push(`@media (max-width:${BREAKPOINTS.mobile}px){${mobile}}`);

  // Custom CSS is authored against `selector`, the same token Elementor uses,
  // so snippets pasted from that world keep working. Braces are the only thing
  // checked — anything else is the author's own business.
  if (style.customCss) {
    parts.push(String(style.customCss).replace(/<\/?style/gi, '').replace(/selector/g, sel));
  }

  return parts.filter(Boolean).join('');
}

/** Attributes the block element must carry for the CSS above to bite. */
export function blockAttrs(id, style = {}) {
  const attrs = { 'data-sid': id };
  if (style.cssId) attrs.id = style.cssId;

  const classes = [style.cssClass, style.animation?.name ? `pb-anim pb-anim-${style.animation.name}` : '']
    .filter(Boolean)
    .join(' ');
  if (classes) attrs.className = classes;

  if (style.animation?.name) {
    attrs.style = {
      animationDuration: `${num(style.animation.duration) ?? 600}ms`,
      animationDelay: `${num(style.animation.delay) ?? 0}ms`
    };
  }
  return attrs;
}

// Entrance animations live here rather than in a stylesheet so the storefront
// and the admin preview cannot drift, and so an unused animation costs nothing.
export const ANIMATION_CSS =
  '.pb-anim{animation-fill-mode:both;animation-timing-function:cubic-bezier(.2,.7,.3,1)}' +
  '@keyframes pb-fade{from{opacity:0}to{opacity:1}}' +
  '@keyframes pb-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}' +
  '@keyframes pb-down{from{opacity:0;transform:translateY(-28px)}to{opacity:1;transform:none}}' +
  '@keyframes pb-left{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:none}}' +
  '@keyframes pb-right{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:none}}' +
  '@keyframes pb-zoom{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}' +
  '.pb-anim-fade{animation-name:pb-fade}' +
  '.pb-anim-up{animation-name:pb-up}' +
  '.pb-anim-down{animation-name:pb-down}' +
  '.pb-anim-left{animation-name:pb-left}' +
  '.pb-anim-right{animation-name:pb-right}' +
  '.pb-anim-zoom{animation-name:pb-zoom}' +
  '@media (prefers-reduced-motion:reduce){.pb-anim{animation:none !important}}';

export const ANIMATIONS = [
  { value: '', label: 'None' },
  { value: 'fade', label: 'Fade in' },
  { value: 'up', label: 'Slide up' },
  { value: 'down', label: 'Slide down' },
  { value: 'left', label: 'Slide from left' },
  { value: 'right', label: 'Slide from right' },
  { value: 'zoom', label: 'Zoom in' }
];

export const FONT_STACKS = [
  { value: '', label: 'Theme default' },
  { value: 'inherit', label: 'Inherit from parent' },
  { value: "'Poppins', system-ui, sans-serif", label: 'Poppins' },
  { value: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { value: "'Playfair Display', Georgia, serif", label: 'Playfair Display' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia' },
  { value: 'system-ui, -apple-system, sans-serif', label: 'System sans' },
  { value: 'ui-monospace, "SFMono-Regular", monospace', label: 'Monospace' }
];
