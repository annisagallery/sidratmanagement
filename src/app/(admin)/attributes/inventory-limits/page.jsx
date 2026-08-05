/**
 * Kept as a signpost rather than deleted.
 *
 * This screen used to set a presale ceiling by hand, per attribute
 * combination. Presale itself has not gone away — what changed is that the
 * ceiling is now derived from each product's bill of materials and the
 * material actually on the shelf, so it cannot promise units the workshop has
 * no fabric for. Anyone arriving from a bookmark should find out why the
 * numbers moved, not a 404.
 */

import Link from 'next/link';
import { MdArrowForward, MdInfoOutline } from 'react-icons/md';

export const metadata = { title: 'Presale limits have moved' };

export default function AttributeInventoryLimitsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="card-ui p-8">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <MdInfoOutline size={23} />
        </span>

        <h1 className="mt-4 text-xl font-bold text-slate-900">Presale limits are now calculated</h1>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Presale still works the same way for customers: a variation flagged for presale can be sold beyond the
          finished units in stock. What no longer exists is the number typed in on this page.
        </p>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          How many units can be promised is now worked out from the product&apos;s bill of materials — the amount of
          each material one finished unit consumes, against what is on the shelf. A material that can be repurchased
          does not reduce the ceiling, because the order simply waits for the next stock-in. A material that cannot be
          repurchased does.
        </p>

        <div className="mt-6 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Where to set it</p>
          <p className="mt-1 leading-6">
            Open a product, then <strong>Materials</strong>. A product with no bill of materials is treated as made to
            order and is not capped.
          </p>
        </div>

        <Link href="/products" className="btn-brand mt-6 inline-flex">
          Go to products <MdArrowForward size={17} />
        </Link>
      </div>
    </div>
  );
}
