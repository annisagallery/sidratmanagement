// ─────────────────────────────────────────────────────────────────────────────
// Page builder — block registry
// ─────────────────────────────────────────────────────────────────────────────
// Canonical definition of every block: what it is called, which settings it
// exposes, and what those settings default to. The admin renders its settings
// form straight from `fields` here, so adding a block is a matter of adding an
// entry plus the matching component in the storefront.
//
// COUNTERPART: ecom/src/components/_main/blocks/ — one component per `key`.
// The two are kept in step by hand, so every storefront block defaults its own
// config defensively; drift must never be able to blank out a live homepage.
//
// Two kinds of entry live here:
//   • sections  — full-width pieces of page, saved as their own database row
//   • widgets   — small elements (`widget: true`) that can either stand alone
//                 or be nested inside a Container's columns
//
// Field types understood by BlockSettings.jsx:
//   text · textarea · html · number · select · toggleGroup · boolean · color
//   size · box · link · icon · image · repeater · category · campaign
//
// `showIf: (config) => bool` hides a field unless another setting calls for it.
// `tab: 'style' | 'advanced'` moves a field off the Content tab; everything
// else — padding, background, borders, typography, animation, custom CSS — is
// supplied to every block automatically by StylePanel.jsx.

export const FIELD_TYPES = [
  'text',
  'textarea',
  'html',
  'number',
  'select',
  'toggleGroup',
  'boolean',
  'color',
  'size',
  'box',
  'link',
  'icon',
  'image',
  'repeater',
  'category',
  'campaign'
];

// Shared field fragments — repeated verbatim across blocks otherwise.
const headingFields = [
  { key: 'heading', type: 'text', label: 'Heading', placeholder: 'Section heading' },
  { key: 'subheading', type: 'text', label: 'Subheading' },
  { key: 'align', type: 'toggleGroup', label: 'Alignment', options: 'align', allowEmpty: true }
];

const SOURCE_OPTIONS = [
  { value: 'new', label: 'New arrivals' },
  { value: 'best', label: 'Best sellers' },
  { value: 'featured', label: 'Featured' },
  { value: 'priceAsc', label: 'Lowest price' },
  { value: 'category', label: 'From a category' },
  { value: 'custom', label: 'Custom query' }
];

export const BLOCKS = {
  // ── Header ────────────────────────────────────────────────────────────────
  hero: {
    key: 'hero',
    label: 'Hero',
    group: 'Header',
    description: 'Top-of-page banner carousel, optionally with the category sidebar.',
    color: 'bg-blue-100 text-blue-700',
    singleton: true, // one hero per page; more than one is never intended
    defaults: { variant: 'slider', showSidebar: true, autoplay: true, height: 'md' },
    fields: [
      {
        key: 'variant',
        type: 'select',
        label: 'Style',
        options: [
          { value: 'slider', label: 'Slider (banners rotate)' },
          { value: 'split', label: 'Split (large + two small)' },
          { value: 'static', label: 'Static (first banner only)' }
        ]
      },
      { key: 'showSidebar', type: 'boolean', label: 'Show category sidebar', showIf: (c) => c.variant === 'slider' },
      { key: 'autoplay', type: 'boolean', label: 'Auto-advance', showIf: (c) => c.variant === 'slider' },
      {
        key: 'interval',
        type: 'number',
        label: 'Seconds per slide',
        min: 2,
        max: 20,
        placeholder: '5',
        showIf: (c) => c.variant === 'slider' && c.autoplay !== false
      },
      {
        key: 'height',
        type: 'select',
        label: 'Height',
        options: [
          { value: 'sm', label: 'Short' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Tall' }
        ]
      }
    ],
    note: 'Images come from Marketing → Banners.'
  },

  // ── Catalog ───────────────────────────────────────────────────────────────
  productGrid: {
    key: 'productGrid',
    label: 'Product Grid',
    group: 'Catalog',
    description: 'A row or grid of products from a saved query.',
    color: 'bg-green-100 text-green-700',
    defaults: {
      heading: 'New Arrivals',
      source: 'new',
      layout: 'carousel',
      columns: 4,
      mobileColumns: 2,
      limit: 10,
      cardStyle: 'minimal',
      showViewAll: true,
      align: 'left'
    },
    fields: [
      ...headingFields,
      { key: 'source', type: 'select', label: 'Products to show', options: SOURCE_OPTIONS },
      { key: 'category', type: 'category', label: 'Category', showIf: (c) => c.source === 'category' },
      {
        key: 'customQuery',
        type: 'text',
        label: 'Query string',
        placeholder: '?sort=top&featured=true&limit=10',
        mono: true,
        showIf: (c) => c.source === 'custom'
      },
      {
        key: 'layout',
        type: 'select',
        label: 'Layout',
        options: [
          { value: 'carousel', label: 'Carousel' },
          { value: 'grid', label: 'Grid' }
        ]
      },
      { key: 'limit', type: 'number', label: 'How many products', min: 2, max: 40 },
      { key: 'showViewAll', type: 'boolean', label: 'Show "View All" link' },
      { key: 'columns', tab: 'style', type: 'number', label: 'Columns (desktop)', min: 1, max: 8 },
      { key: 'tabletColumns', tab: 'style', type: 'number', label: 'Columns (tablet)', min: 1, max: 6, placeholder: '3' },
      { key: 'mobileColumns', tab: 'style', type: 'number', label: 'Columns (mobile)', min: 1, max: 4, placeholder: '2' },
      {
        key: 'cardStyle',
        tab: 'style',
        type: 'select',
        label: 'Card style',
        options: [
          { value: 'minimal', label: 'Minimal' },
          { value: 'bordered', label: 'Bordered' },
          { value: 'shadow', label: 'Raised' }
        ]
      },
      { key: 'cardGap', tab: 'style', type: 'size', label: 'Gap between cards', units: ['px', 'rem'], max: 64 }
    ]
  },

  productTabs: {
    key: 'productTabs',
    label: 'Product Tabs',
    group: 'Catalog',
    description: 'Several product queries behind switchable tabs.',
    color: 'bg-green-100 text-green-700',
    defaults: {
      heading: 'Shop',
      columns: 4,
      mobileColumns: 2,
      limit: 8,
      cardStyle: 'minimal',
      align: 'left',
      tabs: [
        { label: 'New In', source: 'new' },
        { label: 'Best Sellers', source: 'best' },
        { label: 'Featured', source: 'featured' }
      ]
    },
    fields: [
      ...headingFields,
      {
        key: 'tabs',
        type: 'repeater',
        label: 'Tabs',
        addLabel: 'Add tab',
        min: 1,
        max: 6,
        itemLabel: (item) => item.label || 'Tab',
        fields: [
          { key: 'label', type: 'text', label: 'Tab label' },
          { key: 'source', type: 'select', label: 'Products', options: SOURCE_OPTIONS, default: 'new' },
          { key: 'category', type: 'category', label: 'Category', showIf: (c) => c.source === 'category' },
          { key: 'customQuery', type: 'text', label: 'Query string', mono: true, showIf: (c) => c.source === 'custom' }
        ]
      },
      { key: 'limit', type: 'number', label: 'Products per tab', min: 2, max: 40 },
      {
        key: 'tabStyle',
        tab: 'style',
        type: 'select',
        label: 'Tab style',
        options: [
          { value: 'underline', label: 'Underline' },
          { value: 'pills', label: 'Pills' },
          { value: 'plain', label: 'Plain text' }
        ]
      },
      { key: 'columns', tab: 'style', type: 'number', label: 'Columns (desktop)', min: 1, max: 8 },
      { key: 'mobileColumns', tab: 'style', type: 'number', label: 'Columns (mobile)', min: 1, max: 4 },
      {
        key: 'cardStyle',
        tab: 'style',
        type: 'select',
        label: 'Card style',
        options: [
          { value: 'minimal', label: 'Minimal' },
          { value: 'bordered', label: 'Bordered' },
          { value: 'shadow', label: 'Raised' }
        ]
      }
    ]
  },

  categoryShowcase: {
    key: 'categoryShowcase',
    label: 'Categories',
    group: 'Catalog',
    description: 'Category tiles, circles or a scrolling strip.',
    color: 'bg-purple-100 text-purple-700',
    defaults: { heading: 'Shop by Category', variant: 'grid', columns: 6, mobileColumns: 3, limit: 12, align: 'left' },
    fields: [
      ...headingFields,
      {
        key: 'variant',
        type: 'select',
        label: 'Style',
        options: [
          { value: 'grid', label: 'Grid tiles' },
          { value: 'circles', label: 'Circles' },
          { value: 'carousel', label: 'Carousel' }
        ]
      },
      { key: 'limit', type: 'number', label: 'How many categories', min: 2, max: 24 },
      { key: 'columns', tab: 'style', type: 'number', label: 'Columns (desktop)', min: 2, max: 8 },
      { key: 'mobileColumns', tab: 'style', type: 'number', label: 'Columns (mobile)', min: 2, max: 4 }
    ]
  },

  // ── Promo ─────────────────────────────────────────────────────────────────
  countdown: {
    key: 'countdown',
    label: 'Campaign Countdown',
    group: 'Promo',
    description: 'A campaign with its products and a live countdown.',
    color: 'bg-red-100 text-red-700',
    defaults: { showProducts: true },
    fields: [
      { key: 'campaignSlug', type: 'campaign', label: 'Campaign', required: true },
      { key: 'showProducts', type: 'boolean', label: 'Show campaign products' }
    ],
    note: 'Hidden automatically while the campaign is not running.'
  },

  banner: {
    key: 'banner',
    label: 'Promo Banner',
    group: 'Promo',
    description: 'One to three promotional images side by side.',
    color: 'bg-orange-100 text-orange-700',
    defaults: { perRow: 2, aspect: 'wide', rounded: true, items: [] },
    fields: [
      {
        key: 'perRow',
        type: 'select',
        label: 'Images per row',
        options: [
          { value: 1, label: 'One (full width)' },
          { value: 2, label: 'Two' },
          { value: 3, label: 'Three' },
          { value: 4, label: 'Four' }
        ]
      },
      {
        key: 'aspect',
        type: 'select',
        label: 'Shape',
        options: [
          { value: 'wide', label: 'Wide (16:9)' },
          { value: 'banner', label: 'Banner (3:1)' },
          { value: 'square', label: 'Square' },
          { value: 'portrait', label: 'Portrait (3:4)' },
          { value: 'auto', label: 'Original proportions' }
        ]
      },
      {
        key: 'items',
        type: 'repeater',
        label: 'Images',
        addLabel: 'Add image',
        min: 1,
        max: 8,
        itemLabel: (item) => item.caption || 'Image',
        fields: [
          { key: 'image', type: 'image', label: 'Image' },
          { key: 'link', type: 'link', label: 'Links to' },
          { key: 'caption', type: 'text', label: 'Caption (optional)' },
          { key: 'alt', type: 'text', label: 'Alt text', hint: 'Describes the image for screen readers.' }
        ]
      },
      { key: 'rounded', tab: 'style', type: 'boolean', label: 'Rounded corners' },
      { key: 'zoomOnHover', tab: 'style', type: 'boolean', label: 'Zoom image on hover' },
      { key: 'gap', tab: 'style', type: 'size', label: 'Gap between images', units: ['px', 'rem'], max: 64 }
    ]
  },

  editorial: {
    key: 'editorial',
    label: 'Editorial / Lookbook',
    group: 'Promo',
    description: 'Large image beside a headline, copy and a button.',
    color: 'bg-orange-100 text-orange-700',
    defaults: {
      imageSide: 'left',
      heading: 'Our Story',
      body: '',
      ctaLabel: 'Shop now',
      ctaLink: '/products',
      ratio: 'half'
    },
    fields: [
      { key: 'image', type: 'image', label: 'Image' },
      { key: 'heading', type: 'text', label: 'Heading' },
      { key: 'eyebrow', type: 'text', label: 'Small label above the heading' },
      { key: 'body', type: 'textarea', label: 'Body copy', rows: 5 },
      { key: 'ctaLabel', type: 'text', label: 'Button label' },
      { key: 'ctaLink', type: 'link', label: 'Button links to' },
      {
        key: 'imageSide',
        tab: 'style',
        type: 'toggleGroup',
        label: 'Image position',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' }
        ]
      },
      {
        key: 'ratio',
        tab: 'style',
        type: 'select',
        label: 'Split',
        options: [
          { value: 'half', label: 'Half and half' },
          { value: 'wideImage', label: 'Wider image (2:1)' },
          { value: 'wideText', label: 'Wider text (1:2)' }
        ]
      },
      {
        key: 'verticalAlign',
        tab: 'style',
        type: 'select',
        label: 'Vertical alignment',
        options: [
          { value: 'center', label: 'Middle' },
          { value: 'start', label: 'Top' },
          { value: 'stretch', label: 'Stretch' }
        ]
      },
      {
        key: 'buttonStyle',
        tab: 'style',
        type: 'select',
        label: 'Button style',
        options: [
          { value: 'solid', label: 'Solid' },
          { value: 'outline', label: 'Outline' },
          { value: 'link', label: 'Text link' }
        ]
      }
    ]
  },

  // ── Social proof ──────────────────────────────────────────────────────────
  reviews: {
    key: 'reviews',
    label: 'Reviews',
    group: 'Social proof',
    description: 'Square review images in a focus carousel.',
    color: 'bg-amber-100 text-amber-700',
    defaults: { heading: 'Customer Reviews', focusCenter: true, autoplay: true, align: 'left' },
    fields: [
      ...headingFields,
      { key: 'focusCenter', type: 'boolean', label: 'Emphasise centre slide (desktop)' },
      { key: 'autoplay', type: 'boolean', label: 'Auto-advance' }
    ],
    note: 'Images come from Marketing → Reviews.'
  },

  logoStrip: {
    key: 'logoStrip',
    label: 'Logo Strip',
    group: 'Social proof',
    description: 'A row of brand or partner logos.',
    color: 'bg-slate-100 text-slate-700',
    defaults: { heading: '', grayscale: true, perRow: 6, items: [] },
    fields: [
      { key: 'heading', type: 'text', label: 'Heading (optional)' },
      {
        key: 'items',
        type: 'repeater',
        label: 'Logos',
        addLabel: 'Add logo',
        max: 20,
        itemLabel: (item) => item.name || 'Logo',
        fields: [
          { key: 'image', type: 'image', label: 'Logo' },
          { key: 'name', type: 'text', label: 'Name' },
          { key: 'link', type: 'link', label: 'Links to (optional)' }
        ]
      },
      { key: 'grayscale', tab: 'style', type: 'boolean', label: 'Grey out until hovered' },
      { key: 'perRow', tab: 'style', type: 'number', label: 'Logos per row (desktop)', min: 2, max: 8 },
      { key: 'mobilePerRow', tab: 'style', type: 'number', label: 'Logos per row (mobile)', min: 2, max: 4 },
      { key: 'logoHeight', tab: 'style', type: 'size', label: 'Logo height', units: ['px'], max: 160 }
    ]
  },

  imageGrid: {
    key: 'imageGrid',
    label: 'Image Grid / Social',
    group: 'Social proof',
    description: 'A square image grid — doubles as an Instagram-style feed.',
    color: 'bg-pink-100 text-pink-700',
    defaults: { heading: 'Follow us', perRow: 6, gap: 'sm', align: 'center', items: [] },
    fields: [
      ...headingFields,
      {
        key: 'items',
        type: 'repeater',
        label: 'Images',
        addLabel: 'Add image',
        max: 24,
        itemLabel: (item) => item.link?.url || item.link || 'Image',
        fields: [
          { key: 'image', type: 'image', label: 'Image' },
          { key: 'link', type: 'link', label: 'Links to (optional)' }
        ]
      },
      { key: 'perRow', tab: 'style', type: 'number', label: 'Images per row (desktop)', min: 2, max: 8 },
      { key: 'mobilePerRow', tab: 'style', type: 'number', label: 'Images per row (mobile)', min: 2, max: 4 },
      {
        key: 'gap',
        tab: 'style',
        type: 'select',
        label: 'Gap',
        options: [
          { value: 'none', label: 'None' },
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' }
        ]
      },
      { key: 'zoomOnHover', tab: 'style', type: 'boolean', label: 'Zoom on hover' }
    ],
    note: 'Images are uploaded here — there is no live Instagram integration.'
  },

  // ── Content ───────────────────────────────────────────────────────────────
  richText: {
    key: 'richText',
    label: 'Heading / Text',
    group: 'Content',
    description: 'A heading and paragraph, for dividing the page up.',
    color: 'bg-gray-100 text-gray-600',
    defaults: { heading: 'Section', body: '', align: 'center', size: 'md' },
    fields: [
      { key: 'heading', type: 'text', label: 'Heading' },
      { key: 'body', type: 'textarea', label: 'Body copy', rows: 5 },
      { key: 'align', type: 'toggleGroup', label: 'Alignment', options: 'align', allowEmpty: true },
      {
        key: 'size',
        tab: 'style',
        type: 'select',
        label: 'Heading size',
        options: [
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' }
        ]
      }
    ]
  },

  faq: {
    key: 'faq',
    label: 'FAQ',
    group: 'Content',
    description: 'Expandable question and answer list.',
    color: 'bg-gray-100 text-gray-600',
    defaults: { heading: 'Frequently Asked Questions', align: 'center', items: [] },
    fields: [
      ...headingFields,
      {
        key: 'items',
        type: 'repeater',
        label: 'Questions',
        addLabel: 'Add question',
        max: 30,
        itemLabel: (item) => item.question || 'Question',
        fields: [
          { key: 'question', type: 'text', label: 'Question' },
          { key: 'answer', type: 'textarea', label: 'Answer', rows: 4 }
        ]
      },
      { key: 'openFirst', tab: 'style', type: 'boolean', label: 'Open the first question' },
      { key: 'maxWidth', tab: 'style', type: 'size', label: 'List width', units: ['px', '%'], max: 1400 }
    ]
  },

  video: {
    key: 'video',
    label: 'Video',
    group: 'Content',
    description: 'An embedded or self-hosted video.',
    color: 'bg-indigo-100 text-indigo-700',
    defaults: { url: '', aspect: '16/9', autoplay: false },
    fields: [
      { key: 'heading', type: 'text', label: 'Heading (optional)' },
      { key: 'url', type: 'text', label: 'Video URL', placeholder: 'YouTube, Vimeo or an .mp4 link' },
      { key: 'poster', type: 'image', label: 'Poster image (optional)' },
      { key: 'autoplay', type: 'boolean', label: 'Autoplay (muted)' },
      { key: 'loop', type: 'boolean', label: 'Loop' },
      { key: 'controls', type: 'boolean', label: 'Show player controls' },
      {
        key: 'aspect',
        tab: 'style',
        type: 'select',
        label: 'Shape',
        options: [
          { value: '16/9', label: 'Widescreen 16:9' },
          { value: '4/3', label: 'Classic 4:3' },
          { value: '1/1', label: 'Square' },
          { value: '9/16', label: 'Vertical 9:16' }
        ]
      },
      { key: 'maxWidth', tab: 'style', type: 'size', label: 'Player width', units: ['px', '%'], max: 1600 }
    ]
  },

  // ── Engagement ────────────────────────────────────────────────────────────
  newsletter: {
    key: 'newsletter',
    label: 'Newsletter',
    group: 'Engagement',
    description: 'Email capture strip.',
    color: 'bg-teal-100 text-teal-700',
    defaults: {
      heading: 'Join our list',
      body: 'Offers and new arrivals, straight to your inbox.',
      buttonLabel: 'Subscribe',
      align: 'center'
    },
    fields: [
      { key: 'heading', type: 'text', label: 'Heading' },
      { key: 'body', type: 'textarea', label: 'Supporting copy' },
      { key: 'buttonLabel', type: 'text', label: 'Button label' },
      { key: 'placeholder', type: 'text', label: 'Field placeholder', placeholder: 'you@example.com' },
      { key: 'align', type: 'toggleGroup', label: 'Alignment', options: 'align', allowEmpty: true },
      {
        key: 'formLayout',
        tab: 'style',
        type: 'select',
        label: 'Form layout',
        options: [
          { value: 'inline', label: 'Field and button side by side' },
          { value: 'stacked', label: 'Button below the field' }
        ]
      },
      { key: 'buttonColor', tab: 'style', type: 'color', label: 'Button colour' }
    ]
  },

  usp: {
    key: 'usp',
    label: 'Trust Badges',
    group: 'Engagement',
    description: 'Delivery, returns and support promises.',
    color: 'bg-teal-100 text-teal-700',
    defaults: {
      perRow: 4,
      items: [
        { icon: 'truck', title: 'Free delivery', text: 'On orders over 3000৳' },
        { icon: 'refresh', title: 'Easy returns', text: '7-day return policy' },
        { icon: 'shield', title: 'Secure payment', text: 'Protected checkout' },
        { icon: 'headphones', title: 'Support', text: 'Here to help every day' }
      ]
    },
    fields: [
      {
        key: 'items',
        type: 'repeater',
        label: 'Promises',
        addLabel: 'Add promise',
        max: 8,
        itemLabel: (item) => item.title || 'Item',
        fields: [
          { key: 'icon', type: 'icon', label: 'Icon', default: 'truck' },
          { key: 'title', type: 'text', label: 'Title' },
          { key: 'text', type: 'text', label: 'Supporting line' }
        ]
      },
      { key: 'perRow', tab: 'style', type: 'number', label: 'Items per row (desktop)', min: 1, max: 6 },
      { key: 'mobilePerRow', tab: 'style', type: 'number', label: 'Items per row (mobile)', min: 1, max: 3 },
      {
        key: 'itemLayout',
        tab: 'style',
        type: 'select',
        label: 'Layout',
        options: [
          { value: 'row', label: 'Icon beside text' },
          { value: 'column', label: 'Icon above text' }
        ]
      },
      { key: 'iconColor', tab: 'style', type: 'color', label: 'Icon colour' },
      { key: 'iconSize', tab: 'style', type: 'size', label: 'Icon size', units: ['px'], max: 96 },
      { key: 'showCard', tab: 'style', type: 'boolean', label: 'Draw a card around each item' }
    ]
  },

  // ── Elements (widgets) ────────────────────────────────────────────────────
  // Small pieces. Each works on its own as a section and can also be dropped
  // into a Container column, which is what makes real layouts possible.
  heading: {
    key: 'heading',
    label: 'Heading',
    group: 'Elements',
    widget: true,
    description: 'A single headline with full typography control.',
    color: 'bg-gray-100 text-gray-700',
    defaults: { text: 'Your headline', tag: 'h2', align: 'left' },
    fields: [
      { key: 'text', type: 'textarea', label: 'Text', rows: 2 },
      {
        key: 'tag',
        type: 'select',
        label: 'HTML tag',
        hint: 'Affects SEO structure, not just size.',
        options: [
          { value: 'h1', label: 'H1' },
          { value: 'h2', label: 'H2' },
          { value: 'h3', label: 'H3' },
          { value: 'h4', label: 'H4' },
          { value: 'p', label: 'Paragraph' }
        ]
      },
      { key: 'link', type: 'link', label: 'Wrap in a link (optional)' },
      { key: 'align', type: 'toggleGroup', label: 'Alignment', options: 'align', allowEmpty: true },
      {
        key: 'size',
        tab: 'style',
        type: 'select',
        label: 'Preset size',
        hint: 'Overridden by the Headings typography settings.',
        options: [
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' },
          { value: 'xl', label: 'Display' }
        ]
      }
    ]
  },

  text: {
    key: 'text',
    label: 'Text',
    group: 'Elements',
    widget: true,
    description: 'A paragraph of copy.',
    color: 'bg-gray-100 text-gray-700',
    defaults: { body: 'Write something here.', align: 'left' },
    fields: [
      { key: 'body', type: 'textarea', label: 'Text', rows: 6 },
      { key: 'align', type: 'toggleGroup', label: 'Alignment', options: 'align', allowEmpty: true },
      { key: 'columns', tab: 'style', type: 'number', label: 'Text columns', min: 1, max: 3 },
      { key: 'maxWidth', tab: 'style', type: 'size', label: 'Text width', units: ['px', '%', 'ch'], max: 1200 }
    ]
  },

  image: {
    key: 'image',
    label: 'Image',
    group: 'Elements',
    widget: true,
    description: 'A single image, optionally linked.',
    color: 'bg-pink-100 text-pink-700',
    defaults: { align: 'center', aspect: 'auto' },
    fields: [
      { key: 'image', type: 'image', label: 'Image' },
      { key: 'alt', type: 'text', label: 'Alt text' },
      { key: 'caption', type: 'text', label: 'Caption' },
      { key: 'link', type: 'link', label: 'Links to (optional)' },
      { key: 'align', type: 'toggleGroup', label: 'Alignment', options: 'align' },
      { key: 'width', tab: 'style', type: 'size', label: 'Width', units: ['px', '%'], max: 1600 },
      {
        key: 'aspect',
        tab: 'style',
        type: 'select',
        label: 'Shape',
        options: [
          { value: 'auto', label: 'Original proportions' },
          { value: 'wide', label: 'Wide (16:9)' },
          { value: 'banner', label: 'Banner (3:1)' },
          { value: 'square', label: 'Square' },
          { value: 'portrait', label: 'Portrait (3:4)' }
        ]
      },
      { key: 'zoomOnHover', tab: 'style', type: 'boolean', label: 'Zoom on hover' }
    ]
  },

  button: {
    key: 'button',
    label: 'Button',
    group: 'Elements',
    widget: true,
    description: 'A call to action.',
    color: 'bg-[#93003f]/10 text-[#93003f]',
    defaults: { label: 'Shop now', link: { url: '/products' }, variant: 'solid', size: 'md', align: 'left' },
    fields: [
      { key: 'label', type: 'text', label: 'Label' },
      { key: 'link', type: 'link', label: 'Links to' },
      { key: 'icon', type: 'icon', label: 'Icon (optional)' },
      { key: 'align', type: 'toggleGroup', label: 'Alignment', options: 'align' },
      {
        key: 'variant',
        tab: 'style',
        type: 'select',
        label: 'Style',
        options: [
          { value: 'solid', label: 'Solid' },
          { value: 'outline', label: 'Outline' },
          { value: 'ghost', label: 'Ghost' },
          { value: 'link', label: 'Text link' }
        ]
      },
      {
        key: 'size',
        tab: 'style',
        type: 'select',
        label: 'Size',
        options: [
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' }
        ]
      },
      { key: 'fullWidth', tab: 'style', type: 'boolean', label: 'Stretch to full width' },
      { key: 'color', tab: 'style', type: 'color', label: 'Button colour' },
      { key: 'textColor', tab: 'style', type: 'color', label: 'Label colour' },
      { key: 'radius', tab: 'style', type: 'size', label: 'Corner radius', units: ['px'], max: 64 }
    ]
  },

  iconBox: {
    key: 'iconBox',
    label: 'Icon Box',
    group: 'Elements',
    widget: true,
    description: 'An icon with a title and a line of copy.',
    color: 'bg-teal-100 text-teal-700',
    defaults: { icon: 'star', title: 'A promise', text: '', layout: 'column', align: 'center' },
    fields: [
      { key: 'icon', type: 'icon', label: 'Icon' },
      { key: 'title', type: 'text', label: 'Title' },
      { key: 'text', type: 'textarea', label: 'Text', rows: 3 },
      { key: 'link', type: 'link', label: 'Links to (optional)' },
      {
        key: 'layout',
        tab: 'style',
        type: 'select',
        label: 'Layout',
        options: [
          { value: 'column', label: 'Icon above' },
          { value: 'row', label: 'Icon beside' }
        ]
      },
      { key: 'align', tab: 'style', type: 'toggleGroup', label: 'Alignment', options: 'align' },
      { key: 'iconSize', tab: 'style', type: 'size', label: 'Icon size', units: ['px'], max: 120 },
      { key: 'iconColor', tab: 'style', type: 'color', label: 'Icon colour' },
      {
        key: 'iconShape',
        tab: 'style',
        type: 'select',
        label: 'Icon frame',
        options: [
          { value: 'none', label: 'None' },
          { value: 'circle', label: 'Circle' },
          { value: 'square', label: 'Rounded square' }
        ]
      },
      { key: 'iconBg', tab: 'style', type: 'color', label: 'Frame colour', showIf: (c) => c.iconShape && c.iconShape !== 'none' }
    ]
  },

  divider: {
    key: 'divider',
    label: 'Divider',
    group: 'Elements',
    widget: true,
    description: 'A rule, optionally with a word in the middle.',
    color: 'bg-gray-100 text-gray-500',
    defaults: {
      style: 'solid',
      thickness: { value: 1, unit: 'px' },
      width: { value: 100, unit: '%' },
      align: 'center'
    },
    fields: [
      { key: 'text', type: 'text', label: 'Text in the middle (optional)' },
      {
        key: 'style',
        tab: 'style',
        type: 'select',
        label: 'Line style',
        options: [
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
          { value: 'dotted', label: 'Dotted' },
          { value: 'double', label: 'Double' }
        ]
      },
      { key: 'color', tab: 'style', type: 'color', label: 'Line colour' },
      { key: 'thickness', tab: 'style', type: 'size', label: 'Thickness', units: ['px'], max: 20 },
      { key: 'width', tab: 'style', type: 'size', label: 'Width', units: ['%', 'px'], max: 1200 },
      { key: 'align', tab: 'style', type: 'toggleGroup', label: 'Alignment', options: 'align' }
    ]
  },

  html: {
    key: 'html',
    label: 'Custom HTML',
    group: 'Elements',
    widget: true,
    description: 'Raw markup — embeds, third-party widgets, anything bespoke.',
    color: 'bg-slate-100 text-slate-700',
    defaults: { code: '' },
    fields: [
      {
        key: 'code',
        type: 'html',
        label: 'HTML',
        rows: 12,
        hint: 'Rendered as-is on the storefront. Scripts are stripped — use the tracking settings for those.'
      }
    ],
    note: 'Only paste markup you trust. It is rendered directly into the page.'
  },

  // ── Layout ────────────────────────────────────────────────────────────────
  container: {
    key: 'container',
    label: 'Container',
    group: 'Layout',
    description: 'Columns you can drop other elements into.',
    color: 'bg-blue-100 text-blue-700',
    defaults: {
      // `preset` and `columns` start in step so the picker shows what is
      // actually there; changing the preset rewrites the columns.
      preset: '50-50',
      columns: [
        { width: 50, children: [] },
        { width: 50, children: [] }
      ],
      stackAt: 'mobile',
      verticalAlign: 'stretch'
    },
    fields: [
      {
        key: 'preset',
        type: 'select',
        label: 'Column layout',
        hint: 'Changing this keeps whatever is already inside the first columns.',
        options: [
          { value: '100', label: 'One column' },
          { value: '50-50', label: 'Two equal' },
          { value: '33-67', label: 'Narrow + wide' },
          { value: '67-33', label: 'Wide + narrow' },
          { value: '33-33-33', label: 'Three equal' },
          { value: '25-25-25-25', label: 'Four equal' }
        ]
      },
      {
        key: 'stackAt',
        tab: 'style',
        type: 'select',
        label: 'Stack columns',
        options: [
          { value: 'mobile', label: 'On mobile' },
          { value: 'tablet', label: 'On tablet and below' },
          { value: 'never', label: 'Never' }
        ]
      },
      {
        key: 'verticalAlign',
        tab: 'style',
        type: 'select',
        label: 'Vertical alignment',
        options: [
          { value: 'stretch', label: 'Equal height' },
          { value: 'start', label: 'Top' },
          { value: 'center', label: 'Middle' },
          { value: 'end', label: 'Bottom' }
        ]
      },
      { key: 'gap', tab: 'style', type: 'size', label: 'Gap between columns', units: ['px', 'rem'], max: 96 }
    ],
    note: 'Select a column in the canvas to add elements to it.'
  },

  spacer: {
    key: 'spacer',
    label: 'Spacer / Divider',
    group: 'Layout',
    widget: true,
    description: 'Breathing room, with an optional rule.',
    color: 'bg-gray-100 text-gray-500',
    defaults: { height: 'md', showLine: false },
    fields: [
      {
        key: 'height',
        type: 'select',
        label: 'Height',
        options: [
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' },
          { value: 'custom', label: 'Custom…' }
        ]
      },
      {
        key: 'customHeight',
        type: 'size',
        label: 'Exact height',
        units: ['px', 'vh'],
        max: 600,
        showIf: (c) => c.height === 'custom'
      },
      { key: 'showLine', type: 'boolean', label: 'Show divider line' }
    ]
  }
};

// ── Column presets ───────────────────────────────────────────────────────────
// Kept beside the container block because they are only meaningful there, and
// the storefront needs the same numbers to render the grid.
export const COLUMN_PRESETS = {
  100: [100],
  '50-50': [50, 50],
  '33-67': [33, 67],
  '67-33': [67, 33],
  '33-33-33': [33, 34, 33],
  '25-25-25-25': [25, 25, 25, 25]
};

// ── Legacy type aliases ──────────────────────────────────────────────────────
// Rows created before the page builder use the old enum names. They are mapped
// rather than migrated so nothing breaks if an old row reappears from a backup.
export const LEGACY_TYPE_MAP = {
  banners: 'hero',
  categories: 'categoryShowcase',
  products: 'productGrid',
  campaign: 'countdown',
  label: 'richText'
};

export const resolveBlockKey = (type) => (BLOCKS[type] ? type : LEGACY_TYPE_MAP[type] || type);

export const getBlock = (type) => BLOCKS[resolveBlockKey(type)] || null;

export const BLOCK_GROUPS = [...new Set(Object.values(BLOCKS).map((b) => b.group))];

export const blocksInGroup = (group) => Object.values(BLOCKS).filter((b) => b.group === group);

/** Blocks that may live inside a Container column. */
export const WIDGET_BLOCKS = Object.values(BLOCKS).filter((b) => b.widget);

// Config a freshly added block starts life with. Deep-cloned, or two blocks
// added in a row would share the same `items` array.
export const defaultConfigFor = (type) => {
  const defaults = getBlock(type)?.defaults || {};
  return typeof structuredClone === 'function'
    ? structuredClone(defaults)
    : JSON.parse(JSON.stringify(defaults));
};

// Fields currently applicable, honouring each field's `showIf`.
export const visibleFields = (block, config) =>
  (block?.fields || []).filter((f) => (typeof f.showIf === 'function' ? f.showIf(config || {}) : true));

// Settings are split across Content / Style / Advanced tabs. A field without an
// explicit `tab` is content — that is the common case, so it stays implicit.
export const SETTINGS_TABS = [
  { key: 'content', label: 'Content' },
  { key: 'style', label: 'Style' },
  { key: 'advanced', label: 'Advanced' }
];

export const fieldsForTab = (block, config, tab) =>
  visibleFields(block, config).filter((f) => (f.tab || 'content') === tab);
