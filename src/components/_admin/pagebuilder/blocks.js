// ─────────────────────────────────────────────────────────────────────────────
// Page builder — block registry
// ─────────────────────────────────────────────────────────────────────────────
// Canonical definition of every homepage block: what it is called, which
// settings it exposes, and what those settings default to. The admin renders
// its settings form straight from `fields` here, so adding a block is a matter
// of adding an entry plus the matching component in the storefront.
//
// COUNTERPART: ecom/src/components/_main/blocks/ — one component per `key`.
// The two are kept in step by hand, so every storefront block defaults its own
// config defensively; drift must never be able to blank out a live homepage.
//
// Field types understood by BlockSettings.jsx:
//   text · textarea · number · select · boolean · color · image · images
//   repeater (nested `fields`) · category · campaign
//
// `showIf: (config) => bool` hides a field unless another setting calls for it.

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'select',
  'boolean',
  'color',
  'image',
  'images',
  'repeater',
  'category',
  'campaign'
];

// Shared field fragments — repeated verbatim across blocks otherwise.
const headingFields = [
  { key: 'heading', type: 'text', label: 'Heading', placeholder: 'Section heading' },
  { key: 'subheading', type: 'text', label: 'Subheading' },
  {
    key: 'align',
    type: 'select',
    label: 'Alignment',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' }
    ]
  }
];

const spacingFields = [
  {
    key: 'padding',
    tab: 'style',
    type: 'select',
    label: 'Vertical spacing',
    options: [
      { value: 'none', label: 'None' },
      { value: 'sm', label: 'Small' },
      { value: 'md', label: 'Medium' },
      { value: 'lg', label: 'Large' }
    ]
  },
  { key: 'background', tab: 'style', type: 'color', label: 'Background' },
  { key: 'fullWidth', tab: 'advanced', type: 'boolean', label: 'Full-bleed width' }
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
      limit: 10,
      cardStyle: 'minimal',
      showViewAll: true,
      padding: 'md',
      align: 'left'
    },
    fields: [
      ...headingFields,
      {
        key: 'source',
        type: 'select',
        label: 'Products to show',
        options: [
          { value: 'new', label: 'New arrivals' },
          { value: 'best', label: 'Best sellers' },
          { value: 'featured', label: 'Featured' },
          { value: 'priceAsc', label: 'Lowest price' },
          { value: 'category', label: 'From a category' },
          { value: 'custom', label: 'Custom query' }
        ]
      },
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
      { key: 'columns', type: 'number', label: 'Columns (desktop)', min: 2, max: 6 },
      { key: 'limit', type: 'number', label: 'How many products', min: 2, max: 40 },
      {
        key: 'cardStyle',
        type: 'select',
        label: 'Card style',
        options: [
          { value: 'minimal', label: 'Minimal' },
          { value: 'bordered', label: 'Bordered' },
          { value: 'overlay', label: 'Overlay text' }
        ]
      },
      { key: 'showViewAll', type: 'boolean', label: 'Show "View All" link' },
      ...spacingFields
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
      limit: 8,
      cardStyle: 'minimal',
      padding: 'md',
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
        min: 1,
        max: 6,
        itemLabel: (item) => item.label || 'Tab',
        fields: [
          { key: 'label', type: 'text', label: 'Tab label' },
          {
            key: 'source',
            type: 'select',
            label: 'Products',
            options: [
              { value: 'new', label: 'New arrivals' },
              { value: 'best', label: 'Best sellers' },
              { value: 'featured', label: 'Featured' },
              { value: 'priceAsc', label: 'Lowest price' }
            ]
          }
        ]
      },
      { key: 'columns', type: 'number', label: 'Columns (desktop)', min: 2, max: 6 },
      { key: 'limit', type: 'number', label: 'Products per tab', min: 2, max: 40 },
      {
        key: 'cardStyle',
        type: 'select',
        label: 'Card style',
        options: [
          { value: 'minimal', label: 'Minimal' },
          { value: 'bordered', label: 'Bordered' },
          { value: 'overlay', label: 'Overlay text' }
        ]
      },
      ...spacingFields
    ]
  },

  categoryShowcase: {
    key: 'categoryShowcase',
    label: 'Categories',
    group: 'Catalog',
    description: 'Category tiles, circles or a scrolling strip.',
    color: 'bg-purple-100 text-purple-700',
    defaults: { heading: 'Shop by Category', variant: 'grid', columns: 6, limit: 12, padding: 'md', align: 'left' },
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
      { key: 'columns', type: 'number', label: 'Columns (desktop)', min: 2, max: 8 },
      { key: 'limit', type: 'number', label: 'How many categories', min: 2, max: 24 },
      ...spacingFields
    ]
  },

  // ── Promo ─────────────────────────────────────────────────────────────────
  countdown: {
    key: 'countdown',
    label: 'Campaign Countdown',
    group: 'Promo',
    description: 'A campaign with its products and a live countdown.',
    color: 'bg-red-100 text-red-700',
    defaults: { showProducts: true, padding: 'md' },
    fields: [
      { key: 'campaignSlug', type: 'campaign', label: 'Campaign', required: true },
      { key: 'showProducts', type: 'boolean', label: 'Show campaign products' },
      ...spacingFields
    ],
    note: 'Hidden automatically while the campaign is not running.'
  },

  banner: {
    key: 'banner',
    label: 'Promo Banner',
    group: 'Promo',
    description: 'One to three promotional images side by side.',
    color: 'bg-orange-100 text-orange-700',
    defaults: { perRow: 2, aspect: 'wide', rounded: true, padding: 'md', items: [] },
    fields: [
      {
        key: 'perRow',
        type: 'select',
        label: 'Images per row',
        options: [
          { value: 1, label: 'One (full width)' },
          { value: 2, label: 'Two' },
          { value: 3, label: 'Three' }
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
          { value: 'portrait', label: 'Portrait (3:4)' }
        ]
      },
      { key: 'rounded', type: 'boolean', label: 'Rounded corners' },
      {
        key: 'items',
        type: 'repeater',
        label: 'Images',
        min: 1,
        max: 6,
        itemLabel: (item) => item.caption || 'Image',
        fields: [
          { key: 'image', type: 'image', label: 'Image' },
          { key: 'link', type: 'text', label: 'Links to', placeholder: '/products?category=abaya' },
          { key: 'caption', type: 'text', label: 'Caption (optional)' }
        ]
      },
      ...spacingFields
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
      padding: 'lg'
    },
    fields: [
      { key: 'image', type: 'image', label: 'Image' },
      {
        key: 'imageSide',
        type: 'select',
        label: 'Image position',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' }
        ]
      },
      { key: 'heading', type: 'text', label: 'Heading' },
      { key: 'body', type: 'textarea', label: 'Body copy' },
      { key: 'ctaLabel', type: 'text', label: 'Button label' },
      { key: 'ctaLink', type: 'text', label: 'Button links to' },
      ...spacingFields
    ]
  },

  // ── Social proof ──────────────────────────────────────────────────────────
  reviews: {
    key: 'reviews',
    label: 'Reviews',
    group: 'Social proof',
    description: 'Square review images in a focus carousel.',
    color: 'bg-amber-100 text-amber-700',
    defaults: { heading: 'Customer Reviews', focusCenter: true, autoplay: true, padding: 'md', align: 'left' },
    fields: [
      ...headingFields,
      { key: 'focusCenter', type: 'boolean', label: 'Emphasise centre slide (desktop)' },
      { key: 'autoplay', type: 'boolean', label: 'Auto-advance' },
      ...spacingFields
    ],
    note: 'Images come from Marketing → Reviews.'
  },

  logoStrip: {
    key: 'logoStrip',
    label: 'Logo Strip',
    group: 'Social proof',
    description: 'A row of brand or partner logos.',
    color: 'bg-slate-100 text-slate-700',
    defaults: { heading: '', grayscale: true, perRow: 6, padding: 'md', items: [] },
    fields: [
      { key: 'heading', type: 'text', label: 'Heading (optional)' },
      { key: 'grayscale', type: 'boolean', label: 'Grey out until hovered' },
      { key: 'perRow', type: 'number', label: 'Logos per row (desktop)', min: 3, max: 8 },
      {
        key: 'items',
        type: 'repeater',
        label: 'Logos',
        max: 20,
        itemLabel: (item) => item.name || 'Logo',
        fields: [
          { key: 'image', type: 'image', label: 'Logo' },
          { key: 'name', type: 'text', label: 'Name' },
          { key: 'link', type: 'text', label: 'Links to (optional)' }
        ]
      },
      ...spacingFields
    ]
  },

  imageGrid: {
    key: 'imageGrid',
    label: 'Image Grid / Social',
    group: 'Social proof',
    description: 'A square image grid — doubles as an Instagram-style feed.',
    color: 'bg-pink-100 text-pink-700',
    defaults: { heading: 'Follow us', perRow: 6, gap: 'sm', padding: 'md', align: 'center', items: [] },
    fields: [
      ...headingFields,
      { key: 'perRow', type: 'number', label: 'Images per row (desktop)', min: 3, max: 8 },
      {
        key: 'gap',
        type: 'select',
        label: 'Gap',
        options: [
          { value: 'none', label: 'None' },
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' }
        ]
      },
      {
        key: 'items',
        type: 'repeater',
        label: 'Images',
        max: 24,
        itemLabel: (item) => item.link || 'Image',
        fields: [
          { key: 'image', type: 'image', label: 'Image' },
          { key: 'link', type: 'text', label: 'Links to (optional)' }
        ]
      },
      ...spacingFields
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
    defaults: { heading: 'Section', body: '', align: 'center', size: 'md', padding: 'md' },
    fields: [
      { key: 'heading', type: 'text', label: 'Heading' },
      { key: 'body', type: 'textarea', label: 'Body copy' },
      {
        key: 'align',
        type: 'select',
        label: 'Alignment',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' }
        ]
      },
      {
        key: 'size',
        type: 'select',
        label: 'Heading size',
        options: [
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' }
        ]
      },
      ...spacingFields
    ]
  },

  faq: {
    key: 'faq',
    label: 'FAQ',
    group: 'Content',
    description: 'Expandable question and answer list.',
    color: 'bg-gray-100 text-gray-600',
    defaults: { heading: 'Frequently Asked Questions', align: 'center', padding: 'lg', items: [] },
    fields: [
      ...headingFields,
      {
        key: 'items',
        type: 'repeater',
        label: 'Questions',
        max: 20,
        itemLabel: (item) => item.question || 'Question',
        fields: [
          { key: 'question', type: 'text', label: 'Question' },
          { key: 'answer', type: 'textarea', label: 'Answer' }
        ]
      },
      ...spacingFields
    ]
  },

  video: {
    key: 'video',
    label: 'Video',
    group: 'Content',
    description: 'An embedded or self-hosted video.',
    color: 'bg-indigo-100 text-indigo-700',
    defaults: { url: '', aspect: '16/9', autoplay: false, padding: 'md' },
    fields: [
      { key: 'heading', type: 'text', label: 'Heading (optional)' },
      { key: 'url', type: 'text', label: 'Video URL', placeholder: 'YouTube, Vimeo or an .mp4 link' },
      { key: 'poster', type: 'image', label: 'Poster image (optional)' },
      {
        key: 'aspect',
        type: 'select',
        label: 'Shape',
        options: [
          { value: '16/9', label: 'Widescreen 16:9' },
          { value: '4/3', label: 'Classic 4:3' },
          { value: '1/1', label: 'Square' },
          { value: '9/16', label: 'Vertical 9:16' }
        ]
      },
      { key: 'autoplay', type: 'boolean', label: 'Autoplay (muted)' },
      ...spacingFields
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
      align: 'center',
      padding: 'lg'
    },
    fields: [
      { key: 'heading', type: 'text', label: 'Heading' },
      { key: 'body', type: 'textarea', label: 'Supporting copy' },
      { key: 'buttonLabel', type: 'text', label: 'Button label' },
      {
        key: 'align',
        type: 'select',
        label: 'Alignment',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' }
        ]
      },
      ...spacingFields
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
      padding: 'md',
      items: [
        { icon: 'truck', title: 'Free delivery', text: 'On orders over 3000৳' },
        { icon: 'refresh', title: 'Easy returns', text: '7-day return policy' },
        { icon: 'shield', title: 'Secure payment', text: 'Protected checkout' },
        { icon: 'headphones', title: 'Support', text: 'Here to help every day' }
      ]
    },
    fields: [
      { key: 'perRow', type: 'number', label: 'Items per row (desktop)', min: 2, max: 6 },
      {
        key: 'items',
        type: 'repeater',
        label: 'Promises',
        max: 8,
        itemLabel: (item) => item.title || 'Item',
        fields: [
          {
            key: 'icon',
            type: 'select',
            label: 'Icon',
            options: [
              { value: 'truck', label: 'Delivery' },
              { value: 'refresh', label: 'Returns' },
              { value: 'shield', label: 'Secure' },
              { value: 'headphones', label: 'Support' },
              { value: 'tag', label: 'Price' },
              { value: 'gift', label: 'Gift' }
            ]
          },
          { key: 'title', type: 'text', label: 'Title' },
          { key: 'text', type: 'text', label: 'Supporting line' }
        ]
      },
      ...spacingFields
    ]
  },

  // ── Layout ────────────────────────────────────────────────────────────────
  spacer: {
    key: 'spacer',
    label: 'Spacer / Divider',
    group: 'Layout',
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
          { value: 'lg', label: 'Large' }
        ]
      },
      { key: 'showLine', type: 'boolean', label: 'Show divider line' },
      { key: 'background', type: 'color', label: 'Background' }
    ]
  }
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

// Config a freshly added block starts life with.
export const defaultConfigFor = (type) => ({ ...(getBlock(type)?.defaults || {}) });

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
