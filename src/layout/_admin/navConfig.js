import { LuLayoutDashboard, LuShield, LuUsers, LuFactory } from 'react-icons/lu';
import { TbAdjustments, TbCategory } from 'react-icons/tb';
import { BsCartCheck, BsCash, BsCreditCard2Front } from 'react-icons/bs';
import { IoSettingsOutline, IoImagesOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { FaShirt } from 'react-icons/fa6';
import {
  MdOutlineInventory2,
  MdOutlineLocalShipping,
  MdOutlineSecurity,
  MdSwapHoriz,
  MdPeople,
  MdOutlineAccountBalanceWallet,
  MdOutlineReceipt, MdOutlineQrCode2 } from 'react-icons/md';
import { HiOutlineSpeakerphone } from 'react-icons/hi';
import {
  FiBarChart2,
  FiBookmark,
  FiCalendar,
  FiCreditCard,
  FiHome,
  FiList,
  FiMapPin,
  FiMessageSquare,
  FiPackage,
  FiSettings,
  FiShare2,
  FiShield,
  FiShoppingBag,
  FiSliders,
  FiSmartphone,
  FiTag,
  FiTrash2
} from 'react-icons/fi';

/**
 * Single source of truth for admin navigation.
 * The sidebar renders PARENTS only. Each parent page renders <PageTabs /> which
 * reads `tabs` here (and optional second-tier `subTabs`) as its header menu.
 */
export const navParents = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    icon: LuLayoutDashboard,
    href: '/',
    tabs: []
  },
  {
    key: 'orders',
    title: 'Orders',
    icon: BsCartCheck,
    href: '/orders',
    tabs: [
      { label: 'Orders', href: '/orders', icon: FiList },
      { label: 'Items', href: '/orders/items', icon: FiPackage },
      // Printing a dispatch run is a job of its own, not something you do while
      // working the queue — so it gets its own desk, like Barcode Labels does.
      // Labels and invoices share one, because a run needs both for the same
      // orders and picking them twice is how the two end up disagreeing.
      { label: 'Labels & invoices', href: '/orders/print', icon: MdOutlineLocalShipping },
      {
        label: 'Settings',
        href: '/orders/settings',
        icon: FiSettings,
        subTabs: [
          { label: 'Tags', href: '/orders/settings/tags', icon: FiBookmark },
          { label: 'Delivery types', href: '/orders/settings/delivery-types', icon: MdOutlineLocalShipping },
          { label: 'Order statuses', href: '/orders/settings/order-statuses', icon: FiList },
          { label: 'Order item statuses', href: '/orders/settings/order-item-statuses', icon: FiPackage },
          { label: 'Branch terminal', href: '/orders/settings/pos', icon: FiSettings }
        ]
      }
    ]
  },
  {
    key: 'products',
    title: 'Products',
    icon: FaShirt,
    href: '/products',
    tabs: [
      { label: 'Products', href: '/products', icon: FaShirt },
      { label: 'Categories', href: '/categories', icon: TbCategory },
      { label: 'Attributes', href: '/attributes', icon: TbAdjustments },
      { label: 'Barcode labels', href: '/products/labels', icon: MdOutlineQrCode2 }
      // Inventory Limits removed: a presale ceiling is no longer typed in by
      // hand. It is derived from each product's bill of materials, which is
      // edited per product at /products/[slug]/bom.
    ]
  },
  {
    key: 'inventory',
    title: 'Inventory',
    icon: MdOutlineInventory2,
    href: '/inventory',
    tabs: [
      { label: 'Stock', href: '/inventory', icon: MdOutlineInventory2 },
      { label: 'Purchases', href: '/purchases', icon: FiShoppingBag },
      { label: 'Production', href: '/production', icon: LuFactory },
      { label: 'Transfers', href: '/inventory/transfers', icon: MdSwapHoriz }
    ]
  },
  {
    key: 'customers',
    title: 'Customers',
    icon: LuUsers,
    href: '/users',
    tabs: [{ label: 'Customers', href: '/users', icon: LuUsers }]
  },
  {
    key: 'marketing',
    title: 'Marketing',
    icon: HiOutlineSpeakerphone,
    href: '/campaigns',
    tabs: [
      { label: 'Campaigns', href: '/campaigns', icon: HiOutlineSpeakerphone },
      { label: 'Coupons', href: '/coupon-codes', icon: FiTag },
      {
        label: 'Cashback',
        href: '/cash-settings',
        icon: BsCash,
        subTabs: [
          { label: 'Settings', href: '/cash-settings', icon: FiSettings },
          { label: 'Transactions', href: '/cash-settings/transactions', icon: MdSwapHoriz },
          { label: 'User balances', href: '/cash-settings/list', icon: MdPeople }
        ]
      },
      { label: 'Banners', href: '/banners', icon: IoImagesOutline }
    ]
  },
  {
    key: 'payments',
    title: 'Payments',
    icon: BsCreditCard2Front,
    href: '/payments',
    tabs: [
      { label: 'Payments', href: '/payments', icon: FiList },
      { label: 'Verification', href: '/payments/verification', icon: FiShield },
      { label: 'SMS inbox', href: '/payments/sms', icon: FiMessageSquare },
      { label: 'Devices', href: '/payments/devices', icon: FiSmartphone },
      { label: 'Finance review', href: '/finance-review', icon: MdOutlineAccountBalanceWallet },
      { label: 'Settings', href: '/payments/settings', icon: FiSettings }
    ]
  },
  {
    key: 'shipping',
    title: 'Shipping',
    icon: MdOutlineLocalShipping,
    href: '/shippingcharge',
    tabs: [
      { label: 'Charges', href: '/shippingcharge', icon: MdOutlineLocalShipping },
      { label: 'Shipments', href: '/shipping/shipments', icon: FiShare2 },
      { label: 'COD payouts', href: '/shipping/cod-remittance', icon: BsCash },
      { label: 'Couriers', href: '/shipping/couriers', icon: MdOutlineLocalShipping },
      { label: 'Branches', href: '/branches', icon: FiMapPin },
      { label: 'Calendar', href: '/branch-calendar', icon: FiCalendar, subject: 'BranchOffDay' }
    ]
  },
  {
    key: 'settings',
    title: 'Settings',
    icon: IoSettingsOutline,
    href: '/site-settings',
    tabs: [
      { label: 'Site', href: '/site-settings', icon: IoSettingsOutline },
      { label: 'Homepage', href: '/homepage-settings', icon: FiHome },
      { label: 'Messages', href: '/message-settings', icon: FiMessageSquare },
      { label: 'Fraud check', href: '/fraud', icon: MdOutlineSecurity },
      { label: 'API', href: '/api-settings', icon: FiSliders }
    ]
  },
  {
    key: 'reports',
    title: 'Reports',
    icon: FiBarChart2,
    href: '/reports',
    tabs: []
  }
];

/**
 * Production planning stays inside management. The scan station is excluded:
 * like POS, it opens as a separate full-screen workstation from the top bar.
 */
const productionTabs = [
  { label: 'Batches', href: '/production' },
  { label: 'Queue', href: '/production/queue' },
  { label: 'New batch', href: '/production/create' }
];

/**
 * Sidebar information architecture.
 * Group -> primary navigation -> nested navigation.
 * `navParents` above remains the source for page-level tabs.
 */
export const navGroups = [
  {
    key: 'overview',
    label: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', href: '/', icon: LuLayoutDashboard }]
  },
  {
    key: 'sales',
    label: 'Sales',
    items: [
      {
        key: 'orders', label: 'Orders', href: '/orders', icon: BsCartCheck, subject: 'Order'
      },
      {
        key: 'order-items', label: 'Order items', href: '/orders/items', icon: FiPackage, subject: 'OrderItem'
      },
      {
        key: 'order-print', label: 'Labels & invoices', href: '/orders/print', icon: MdOutlineLocalShipping, subject: 'Order'
      },
      {
        key: 'sales-settings', label: 'Sales settings', href: '/orders/settings/delivery-types', icon: FiSettings, subject: 'OrderSettings',
        children: [
          { label: 'Tags', href: '/orders/settings/tags' },
          { label: 'Delivery types', href: '/orders/settings/delivery-types' },
          { label: 'Order statuses', href: '/orders/settings/order-statuses' },
          { label: 'Order item statuses', href: '/orders/settings/order-item-statuses' },
          { label: 'Branch terminal settings', href: '/orders/settings/pos' }
        ]
      }
    ]
  },
  {
    key: 'products',
    label: 'Products',
    items: [
      { key: 'products', label: 'Products', href: '/products', icon: FaShirt, subject: 'Product' },
      { key: 'categories', label: 'Categories', href: '/categories', icon: TbCategory, subject: 'Category' },
      { key: 'attributes', label: 'Attributes', href: '/attributes', icon: TbAdjustments, subject: 'Attribute' },
      { key: 'product-labels', label: 'Barcode labels', href: '/products/labels', icon: MdOutlineQrCode2, subject: 'Product' }
      // Presale Settings removed — see the note in the Products tab list above.
    ]
  },
  {
    key: 'inventory',
    label: 'Inventory',
    items: [
      // Each of these is a desk, and its `children` become the page's tab bar.
      // A tab is a real route, so the browser's back button and a pasted link
      // both land where the operator expects.
      {
        key: 'stock',
        label: 'Stock',
        href: '/inventory',
        icon: MdOutlineInventory2,
        subject: 'Inventory',
        children: [
          { label: 'On hand', href: '/inventory' },
          { label: 'Movements', href: '/inventory/movements' },
          { label: 'Barcode lookup', href: '/inventory/lookup' }
        ]
      },
      {
        key: 'production',
        label: 'Production',
        href: '/production',
        icon: LuFactory,
        subject: 'Production',
        children: productionTabs
      },
      {
        key: 'purchases',
        label: 'Purchases',
        href: '/purchases',
        icon: FiShoppingBag,
        subject: 'Purchase',
        children: [
          { label: 'All purchases', href: '/purchases' },
          { label: 'Add purchase', href: '/purchases/create' }
        ]
      },
      {
        key: 'transfers',
        label: 'Transfers',
        href: '/inventory/transfers',
        icon: MdSwapHoriz,
        subject: 'StockTransfer',
        children: [
          { label: 'All transfers', href: '/inventory/transfers' },
          { label: 'New transfer', href: '/inventory/transfers/create' }
        ]
      },
      { key: 'warehouses', label: 'Warehouses', href: '/inventory/warehouses', icon: FiMapPin, subject: 'Branch' }
    ]
  },
  {
    key: 'customers',
    label: 'Customers',
    items: [{ key: 'customers', label: 'Customers', href: '/users', icon: LuUsers, subject: 'Customer' }]
  },
  {
    key: 'marketing',
    label: 'Marketing',
    items: [
      { key: 'campaigns', label: 'Campaigns', href: '/campaigns', icon: HiOutlineSpeakerphone, subject: 'Campaign' },
      { key: 'coupons', label: 'Coupons', href: '/coupon-codes', icon: FiTag, subject: 'Coupon' },
      { key: 'cashback', label: 'Cashback', href: '/cash-settings/transactions', icon: BsCash, subject: 'Cashback', children: [{ label: 'Transactions', href: '/cash-settings/transactions' }, { label: 'User balances', href: '/cash-settings/list' }, { label: 'Cashback settings', href: '/cash-settings' }] },
    ]
  },
  {
    key: 'payment',
    label: 'Payment',
    items: [
      { key: 'transactions', label: 'Transactions', href: '/payments', icon: BsCreditCard2Front, subject: 'Payment' },
      { key: 'verification', label: 'Verification', href: '/payments/verification', icon: FiShield, subject: 'Payment' },
      { key: 'sms-inbox', label: 'SMS inbox', href: '/payments/sms', icon: FiMessageSquare, subject: 'Payment' },
      { key: 'collector-devices', label: 'Devices', href: '/payments/devices', icon: FiSmartphone, subject: 'Payment' },
      { key: 'finance-review', label: 'Finance review', href: '/finance-review', icon: MdOutlineAccountBalanceWallet, subject: 'Order' },
      { key: 'payment-settings', label: 'Payment settings', href: '/payments/settings', icon: FiSettings, subject: 'Payment' }
    ]
  },
  {
    key: 'shipping',
    label: 'Shipping',
    items: [
      { key: 'charges', label: 'Charges', href: '/shippingcharge', icon: MdOutlineLocalShipping, subject: 'Shipping' },
      { key: 'shipments', label: 'Shipments', href: '/shipping/shipments', icon: FiShare2, subject: 'Shipping', children: [{ label: 'All shipments', href: '/shipping/shipments' }] },
      { key: 'cod-remittance', label: 'COD payouts', href: '/shipping/cod-remittance', icon: BsCash, subject: 'Order' },
      { key: 'couriers', label: 'Couriers', href: '/shipping/couriers', icon: MdOutlineLocalShipping, subject: 'Shipping', children: [{ label: 'Courier accounts', href: '/shipping/couriers' }] }
    ]
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [
      {
        key: 'global-settings', label: 'Global settings', href: '/site-settings/global/brand', icon: IoSettingsOutline, subject: 'SiteSettings',
        children: [
          { label: 'Brand', href: '/site-settings/global/brand' },
          { label: 'Contact', href: '/site-settings/global/contact' },
          { label: 'SEO', href: '/site-settings/global/seo' },
          { label: 'Footer', href: '/site-settings/global/footer' },
          { label: 'Breadcrumbs', href: '/site-settings/global/breadcrumbs' },
          { label: 'Product showcase', href: '/site-settings/global/product-showcase' },
          { label: 'Branch page', href: '/site-settings/global/branch-page' },
          { label: 'Invoice', href: '/site-settings/global/invoice' }
        ]
      },
      {
        key: 'homepage-settings', label: 'Homepage', href: '/homepage-settings', icon: FiHome,
        subject: ['Banner', 'SiteSettings'],
        children: [
          { label: 'Banners', href: '/homepage-settings/banners', subject: 'Banner' },
          { label: 'Customer reviews', href: '/homepage-settings/reviews', subject: 'Banner' },
          { label: 'Notice bar', href: '/homepage-settings/notice-bar', subject: 'Banner' },
          { label: 'Navigation', href: '/homepage-settings/navigation', subject: 'SiteSettings' }
        ]
      },
      {
        key: 'additional-pages', label: 'Additional pages', href: '/site-settings/pages/about', icon: IoDocumentTextOutline, subject: 'SiteSettings',
        children: [
          { label: 'About us', href: '/site-settings/pages/about' },
          { label: 'Privacy policy', href: '/site-settings/pages/privacy-policy' },
          { label: 'Refund & return policy', href: '/site-settings/pages/refund-return-policy' },
          { label: 'Terms & conditions', href: '/site-settings/pages/terms-and-conditions' }
        ]
      },
      { key: 'maintenance', label: 'Maintenance', href: '/site-settings/maintenance', icon: FiSliders, subject: 'SiteSettings' },
      // TEMPORARY: the bridge to the old POS, gated on a subject only `manage
      // all` roles hold. Removed with the rest of it — see
      // postgressserver/src/legacy-pos/README.md.
      { key: 'legacy-pos', label: 'Catalog migration', href: '/legacy-pos', icon: MdSwapHoriz, subject: 'LegacyPos' },
      { key: 'message-settings', label: 'Message settings', href: '/message-settings/api', icon: FiMessageSquare, subject: 'MessageSettings', children: [{ label: 'API', href: '/message-settings/api' }, { label: 'Message formats', href: '/message-settings/formats' }] },
      { key: 'image-server', label: 'Image server', href: '/site-settings/image-server', icon: IoImagesOutline, subject: 'ApiSettings', children: [{ label: 'API settings', href: '/site-settings/image-server' }] }
    ]
  },
  {
    key: 'reports',
    label: 'Reports',
    items: [{ key: 'reports', label: 'Reports', href: '/reports', icon: FiBarChart2, subject: 'Report' }]
  }
];

/** True when `pathname` is under `href` (exact, or a nested sub-path). '/' matches only itself. */
export function hrefMatches(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Of a list of {href} items, return the one whose href is the longest match for pathname. */
export function bestMatch(pathname, items) {
  let winner = null;
  for (const item of items) {
    if (hrefMatches(pathname, item.href) && (!winner || item.href.length > winner.href.length)) {
      winner = item;
    }
  }
  return winner;
}

/** Find the active parent for a pathname (by its own href or any of its tab hrefs). */
export function activeParent(pathname) {
  const candidates = [];
  for (const parent of navParents) {
    const hrefs = [parent, ...parent.tabs, ...parent.tabs.flatMap((t) => t.subTabs || [])];
    const match = bestMatch(pathname, hrefs);
    if (match) candidates.push({ parent, len: match.href.length });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.len - a.len);
  return candidates[0].parent;
}

/**
 * The sidebar item (and its group label) for a pathname — the most specific
 * match across items and their tabs wins. Feeds page titles, the top bar
 * breadcrumb and the browser tab title.
 */
export function navItemFor(pathname = '/') {
  let winner = null;
  for (const group of navGroups) {
    for (const item of group.items) {
      const candidates = [item, ...(item.children || [])];
      for (const candidate of candidates) {
        const path = candidate.href.split(/[?#]/)[0];
        if (hrefMatches(pathname, path) && (!winner || path.length > winner.length)) {
          winner = {
            length: path.length,
            key: item.key,
            title: item.label,
            tab: candidate === item ? null : candidate.label,
            group: group.label,
            // A nav destination itself, rather than a record or form under it.
            exact: [item, ...(item.children || [])].some((entry) => entry.href.split(/[?#]/)[0] === pathname)
          };
        }
      }
    }
  }
  return winner;
}
