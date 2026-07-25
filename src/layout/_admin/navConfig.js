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
  MdPointOfSale,
  MdOutlineAccountBalanceWallet,
  MdOutlineReceipt
} from 'react-icons/md';
import { HiOutlineSpeakerphone } from 'react-icons/hi';
import {
  FiBarChart2,
  FiBookmark,
  FiCreditCard,
  FiHome,
  FiList,
  FiMapPin,
  FiMessageSquare,
  FiPackage,
  FiSettings,
  FiShare2,
  FiShoppingBag,
  FiSliders,
  FiTag,
  FiAlertCircle,
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
      { label: 'Complaints', href: '/orders/complaints', icon: FiAlertCircle },
      {
        label: 'Settings',
        href: '/orders/settings',
        icon: FiSettings,
        subTabs: [
          { label: 'Tags', href: '/orders/settings/tags', icon: FiBookmark },
          { label: 'Delivery Types', href: '/orders/settings/delivery-types', icon: MdOutlineLocalShipping },
          { label: 'Order Statuses', href: '/orders/settings/order-statuses', icon: FiList },
          { label: 'Order Item Statuses', href: '/orders/settings/order-item-statuses', icon: FiPackage },
          { label: 'Branch Terminal', href: '/orders/settings/pos', icon: FiSettings }
        ]
      }
    ]
  },
  {
    key: 'pos-sales',
    title: 'Branch Sales',
    icon: MdPointOfSale,
    href: '/pos-sales',
    tabs: []
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
      { label: 'Inventory Limits', href: '/attributes/inventory-limits', icon: FiSliders }
    ]
  },
  {
    key: 'inventory',
    title: 'Inventory',
    icon: MdOutlineInventory2,
    href: '/inventory',
    tabs: [
      { label: 'Stock', href: '/inventory', icon: MdOutlineInventory2 },
      { label: 'Production', href: '/production', icon: LuFactory },
      { label: 'Production Scan', href: '/production/scan', icon: LuFactory }
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
          { label: 'User Balances', href: '/cash-settings/list', icon: MdPeople }
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
      { label: 'Finance Review', href: '/finance-review', icon: MdOutlineAccountBalanceWallet },
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
      { label: 'Couriers', href: '/shipping/couriers', icon: MdOutlineLocalShipping },
      { label: 'Branches', href: '/branches', icon: FiMapPin }
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
      { label: 'Fraud Check', href: '/fraud', icon: MdOutlineSecurity },
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
        key: 'pos-sales', label: 'Branch Sales', href: '/pos-sales', icon: MdPointOfSale, subject: 'Order'
      },
      {
        key: 'order-items', label: 'Order Items', href: '/orders/items', icon: FiPackage, subject: 'OrderItem'
      },
      {
        key: 'complaints', label: 'Complaints', href: '/orders/complaints', icon: FiAlertCircle, subject: 'Complaint'
      },
      {
        key: 'sales-settings', label: 'Sales Settings', href: '/orders/settings/delivery-types', icon: FiSettings, subject: 'OrderSettings',
        children: [
          { label: 'Tags', href: '/orders/settings/tags' },
          { label: 'Delivery Types', href: '/orders/settings/delivery-types' },
          { label: 'Order Statuses', href: '/orders/settings/order-statuses' },
          { label: 'Order Item Statuses', href: '/orders/settings/order-item-statuses' },
          { label: 'Branch Terminal Settings', href: '/orders/settings/pos' }
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
      { key: 'presale-settings', label: 'Presale Settings', href: '/attributes/inventory-limits', icon: FiSliders, subject: 'Attribute' }
    ]
  },
  {
    key: 'inventory',
    label: 'Inventory',
    items: [
      { key: 'stock', label: 'Stock', href: '/inventory', icon: MdOutlineInventory2, subject: 'Inventory' },
      { key: 'production', label: 'Production', href: '/production', icon: LuFactory, subject: 'Production' },
      { key: 'production-scan', label: 'Production Scan', href: '/production/scan', icon: LuFactory, subject: 'Production' },
      { key: 'transfers', label: 'Transfers', href: '/inventory/transfers', icon: MdSwapHoriz, subject: 'StockTransfer' },
      { key: 'warehouses', label: 'Warehouses', href: '/inventory/warehouses', icon: FiMapPin, subject: 'Branch' }
    ]
  },
  {
    key: 'customers',
    label: 'Customers',
    items: [{ key: 'customers', label: 'Customer List', href: '/users', icon: LuUsers, subject: 'Customer' }]
  },
  {
    key: 'marketing',
    label: 'Marketing',
    items: [
      { key: 'banners', label: 'Banners', href: '/banners', icon: IoImagesOutline, subject: 'Banner' },
      { key: 'campaigns', label: 'Campaigns', href: '/campaigns', icon: HiOutlineSpeakerphone, subject: 'Campaign' },
      { key: 'coupons', label: 'Coupons', href: '/coupon-codes', icon: FiTag, subject: 'Coupon' },
      { key: 'cashback', label: 'Cashback', href: '/cash-settings/transactions', icon: BsCash, subject: 'Cashback', children: [{ label: 'Transactions', href: '/cash-settings/transactions' }, { label: 'User Balance', href: '/cash-settings/list' }, { label: 'Cashback Settings', href: '/cash-settings' }] },
    ]
  },
  {
    key: 'payment',
    label: 'Payment',
    items: [
      { key: 'transactions', label: 'Transactions', href: '/payments', icon: BsCreditCard2Front, subject: 'Payment' },
      { key: 'finance-review', label: 'Finance Review', href: '/finance-review', icon: MdOutlineAccountBalanceWallet, subject: 'Order' },
      { key: 'payment-settings', label: 'Payment Settings', href: '/payments/settings', icon: FiSettings, subject: 'Payment' }
    ]
  },
  {
    key: 'shipping',
    label: 'Shipping',
    items: [
      { key: 'charges', label: 'Charges', href: '/shippingcharge', icon: MdOutlineLocalShipping, subject: 'Shipping' },
      { key: 'shipments', label: 'Shipments', href: '/shipping/shipments', icon: FiShare2, subject: 'Shipping', children: [{ label: 'All Shipments', href: '/shipping/shipments' }] },
      { key: 'couriers', label: 'Couriers', href: '/shipping/couriers', icon: MdOutlineLocalShipping, subject: 'Shipping', children: [{ label: 'Courier Accounts', href: '/shipping/couriers' }] }
    ]
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [
      {
        key: 'global-settings', label: 'Global Settings', href: '/site-settings/global/brand', icon: IoSettingsOutline, subject: 'SiteSettings',
        children: [
          { label: 'Brand Settings', href: '/site-settings/global/brand' },
          { label: 'Contact', href: '/site-settings/global/contact' },
          { label: 'SEO', href: '/site-settings/global/seo' },
          { label: 'Footer', href: '/site-settings/global/footer' },
          { label: 'Navigation', href: '/site-settings/global/navigation' },
          { label: 'Breadcrumb Settings', href: '/site-settings/global/breadcrumbs' },
          { label: 'Product Showcase', href: '/site-settings/global/product-showcase' },
          { label: 'Branch Page', href: '/site-settings/global/branch-page' },
          { label: 'Invoice', href: '/site-settings/global/invoice' }
        ]
      },
      {
        key: 'additional-pages', label: 'Additional Pages', href: '/site-settings/pages/about', icon: IoDocumentTextOutline, subject: 'SiteSettings',
        children: [
          { label: 'About Us', href: '/site-settings/pages/about' },
          { label: 'Privacy Policy', href: '/site-settings/pages/privacy-policy' },
          { label: 'Refund & Return Policy', href: '/site-settings/pages/refund-return-policy' },
          { label: 'Terms & Conditions', href: '/site-settings/pages/terms-and-conditions' }
        ]
      },
      { key: 'maintenance', label: 'Maintenance', href: '/site-settings/maintenance', icon: FiSliders, subject: 'SiteSettings' },
      { key: 'message-settings', label: 'Message Settings', href: '/message-settings/api', icon: FiMessageSquare, subject: 'MessageSettings', children: [{ label: 'API', href: '/message-settings/api' }, { label: 'Message Format Settings', href: '/message-settings/formats' }] },
      { key: 'image-server', label: 'Image Server', href: '/site-settings/image-server', icon: IoImagesOutline, subject: 'ApiSettings', children: [{ label: 'API Settings', href: '/site-settings/image-server' }] }
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
