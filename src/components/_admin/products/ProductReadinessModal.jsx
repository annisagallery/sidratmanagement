'use client';

import Link from 'next/link';
import Badge from 'src/components/_admin/ui/Badge';
import { ModalShell } from 'src/components/_admin/ui/primitives';

const quantity = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

export function readinessLabel(readiness) {
  if (!readiness) return 'Not checked';
  if (readiness.status === 'DISABLED') return 'Production off';
  if (readiness.status === 'NO_OPTIONS') return 'Add an option';
  if (readiness.status === 'READY') return 'Can make now';
  if (readiness.status === 'PARTIAL') return 'Some options can be made';
  if (readiness.options?.some((option) => option.status === 'MATERIAL_SHORTAGE')) return 'Materials short';
  return 'Material setup needed';
}

export function readinessTone(readiness) {
  if (readiness?.status === 'READY') return 'success';
  if (readiness?.status === 'DISABLED' || !readiness) return 'neutral';
  return 'warning';
}

export default function ProductReadinessModal({ product, onClose }) {
  const readiness = product.productionReadiness;
  return (
    <ModalShell title="Stock & production" subtitle={product.name} size="lg" onClose={onClose}
      footer={<>
        <Link href={`/products/${product.slug}`} className="btn-ghost">Edit product</Link>
        <button type="button" className="btn-brand" onClick={onClose}>Done</button>
      </>}
    >
      <div className="space-y-5">
        <section aria-label="Finished stock" className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Finished stock · all branches</p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            {[
              ['Total stock', product.totalStock],
              ['Reserved', product.reservedStock],
              ['Available', product.availableStock]
            ].map(([label, value]) => <div key={label}>
              <dt className="text-xs text-slate-600">{label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{quantity(value)}</dd>
            </div>)}
          </dl>
          <p className="mt-3 text-xs text-slate-600">Reserved units are committed to existing orders. Future production is counted separately.</p>
        </section>

        <section aria-label="Production readiness" className="space-y-3">
          <Badge tone={readinessTone(readiness)}>{readinessLabel(readiness)}</Badge>
          <p className="text-sm text-slate-800">{readiness?.message || 'Reload the product list to check production.'}</p>
          {readiness?.status === 'DISABLED' && <p className="text-sm text-slate-600">Enable production in the product settings when this product should be made in-house.</p>}
          {!!readiness?.options?.length && <p className="text-xs leading-relaxed text-slate-600">
            Each option is checked for one additional unit, including material wastage. Available materials exclude reserved stock.
            Options and products may share the same materials, so their production capacities cannot be added together.
          </p>}

          {readiness?.options?.map((option) => <div key={option.id} className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{option.label}</h3>
              <Badge tone={option.status === 'READY' ? 'success' : 'warning'}>
                {option.status === 'READY' ? `Can make ${quantity(option.capacity)}` : option.status === 'MATERIAL_SHORTAGE' ? 'Cannot make yet' : 'Setup needed'}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-slate-700">{option.message}</p>
            {!!option.shortages.length && <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
              {option.shortages.map((material) => <li key={material.id} className="py-3 last:pb-0">
                <p className="text-sm font-semibold text-slate-900">{material.name}</p>
                <p className="mt-1 text-sm font-medium text-amber-800">
                  Short {quantity(material.shortage)} {material.unit} to make one unit.
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Need {quantity(material.required)} {material.unit} · Available {quantity(material.available)} {material.unit}
                </p>
              </li>)}
            </ul>}
          </div>)}
        </section>
      </div>
    </ModalShell>
  );
}
