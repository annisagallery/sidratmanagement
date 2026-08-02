'use client';

/**
 * Order-screen vocabulary.
 *
 * The generic reading primitives now live in `ui/primitives` so that stock,
 * production and transfers read identically to orders. This module re-exports
 * them under the names the order screen already uses, and owns only what is
 * specific to an order: couriers and tags.
 */

export {
  CopyButton,
  Drawer,
  Field,
  ModalShell,
  Notice,
  Pill,
  MoneyRow,
  Row,
  Section,
  SectionBody,
  errorAlert,
  errorText,
  fieldClass,
  money,
  normalizeList,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';

import { oid } from 'src/components/_admin/ui/primitives';

/** Courier providers, named the way the operator names them. */
export const PROVIDER_LABEL = { pathao: 'Pathao', steadfast: 'Steadfast', carrybee: 'CarryBee' };

export const tagId = (tag) => (typeof tag === 'object' && tag !== null ? oid(tag) : String(tag ?? ''));
export const tagName = (tag) =>
  typeof tag === 'object' && tag !== null ? tag.name || tag.title || tag.slug || oid(tag) : String(tag ?? '');
export const tagColor = (tag) => (typeof tag === 'object' && tag !== null ? tag.color : null);
