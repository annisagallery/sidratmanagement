import {
  FiTruck,
  FiRefreshCw,
  FiShield,
  FiHeadphones,
  FiTag,
  FiGift,
  FiStar,
  FiHeart,
  FiAward,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiPackage,
  FiPhone,
  FiMail,
  FiMapPin,
  FiScissors,
  FiSmile,
  FiThumbsUp,
  FiZap,
  FiUsers,
  FiGlobe,
  FiLock,
  FiPercent
} from 'react-icons/fi';

// ─────────────────────────────────────────────────────────────────────────────
// Page builder — icon set
// ─────────────────────────────────────────────────────────────────────────────
// The icons a block can name in its config. Stored as a short key rather than a
// component, so a saved block is just data and the storefront can pick the
// matching component from its own copy of this list.
//
// COUNTERPART: ecom/src/components/_main/blocks/icons.jsx — keep the keys the
// same in both. A key missing from the storefront falls back to the first icon
// rather than crashing the page.

export const ICONS = {
  truck: FiTruck,
  refresh: FiRefreshCw,
  shield: FiShield,
  headphones: FiHeadphones,
  tag: FiTag,
  gift: FiGift,
  star: FiStar,
  heart: FiHeart,
  award: FiAward,
  check: FiCheckCircle,
  clock: FiClock,
  card: FiCreditCard,
  package: FiPackage,
  phone: FiPhone,
  mail: FiMail,
  pin: FiMapPin,
  scissors: FiScissors,
  smile: FiSmile,
  thumbsUp: FiThumbsUp,
  zap: FiZap,
  users: FiUsers,
  globe: FiGlobe,
  lock: FiLock,
  percent: FiPercent
};

const LABELS = {
  truck: 'Delivery',
  refresh: 'Returns',
  shield: 'Secure',
  headphones: 'Support',
  tag: 'Price',
  gift: 'Gift',
  star: 'Star',
  heart: 'Favourite',
  award: 'Award',
  check: 'Verified',
  clock: 'Fast',
  card: 'Payment',
  package: 'Packaging',
  phone: 'Call',
  mail: 'Email',
  pin: 'Location',
  scissors: 'Tailoring',
  smile: 'Happy',
  thumbsUp: 'Recommended',
  zap: 'Quick',
  users: 'Community',
  globe: 'Worldwide',
  lock: 'Private',
  percent: 'Discount'
};

export const ICON_OPTIONS = Object.entries(ICONS).map(([value, Icon]) => ({
  value,
  Icon,
  label: LABELS[value] || value
}));

export const getIcon = (key) => ICONS[key] || FiTruck;
