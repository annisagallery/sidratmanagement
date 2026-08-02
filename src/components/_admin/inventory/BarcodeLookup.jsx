'use client';

/**
 * Barcode lookup — "what is this, and can I sell it here?"
 *
 * Used at a counter with a gun in hand, so it reuses `<ScanStation>`: focus is
 * held, every scan makes a sound, and the last answer stays on screen until the
 * next one. The branch is chosen once and remembered for the session, because
 * whoever is scanning is standing in exactly one place.
 *
 * Pricing is global — the answer names the branch only to say how many are
 * free there.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { FiExternalLink, FiSearch } from 'react-icons/fi';

import { adminGetBranches, resolveInventoryBarcode } from 'src/services';
import ScanStation from 'src/components/_admin/scan/ScanStation';
import { Code, StateChip } from 'src/components/_admin/ops/primitives';
import {
  Field,
  Notice,
  PageBar,
  Pill,
  Row,
  Section,
  SectionBody,
  errorText,
  money,
  oid,
  qty
} from 'src/components/_admin/ui/primitives';
import { variationLabel } from './shared';

export default function BarcodeLookup() {
  const [branch, setBranch] = useState('');
  const [result, setResult] = useState(null);

  const branchesQuery = useQuery('inventory-branches', adminGetBranches);
  const branches = branchesQuery.data?.data || [];
  const branchName = branches.find((entry) => oid(entry) === branch)?.name;

  const lookup = async (code) => {
    if (!branch) return { ok: false, message: 'Choose the branch you are standing in first.' };
    try {
      const response = await resolveInventoryBarcode({ code, branch });
      setResult({ code, ...(response.data || {}) });
      const available = (response.data?.prices || []).reduce(
        (sum, price) => sum + Number(price.availableQuantity || 0),
        0
      );
      return available > 0
        ? { ok: true, message: `${response.data?.product?.name} — ${available} available here.` }
        : { ok: false, message: `${response.data?.product?.name} — none available at ${branchName}.` };
    } catch (error) {
      setResult(null);
      return { ok: false, message: errorText(error, 'No product matches this barcode.') };
    }
  };

  const product = result?.product;
  const prices = result?.prices || [];
  const unit = result?.productionUnit;

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Inventory"
        title="Barcode lookup"
        subtitle="Scan any product, variation or production barcode to see its price and free stock."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Scan" icon={FiSearch}>
          <SectionBody className="space-y-3 p-4">
            <Field label="Branch you are scanning at" hint="Pricing is global; the branch decides availability.">
              <select value={branch} onChange={(event) => setBranch(event.target.value)} className="select-ui h-10 w-full">
                <option value="">Choose a branch…</option>
                {branches.map((entry) => (
                  <option key={oid(entry)} value={oid(entry)}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>

            <ScanStation
              onScan={lookup}
              label="Barcode"
              placeholder="Scan or type a barcode, then press Enter"
              disabled={!branch}
              disabledReason="Choose a branch before scanning."
              hint={branch ? `Looking up availability at ${branchName}.` : null}
            />
          </SectionBody>
        </Section>

        <Section title="Result" icon={FiExternalLink} hint={result ? result.code : 'Nothing scanned yet'}>
          <SectionBody>
            {!product ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Scan a barcode and the product, its price and its free stock appear here.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900">{product.name}</p>
                    <p className="ops-code text-[11px] text-slate-400">#{product.code}</p>
                  </div>
                  {product.slug ? (
                    <Link href={`/products/${product.slug}/view`} className="btn-ghost h-8 !text-xs">
                      <FiExternalLink size={13} /> Open
                    </Link>
                  ) : null}
                </div>

                {prices.length ? (
                  prices.map((price) => (
                    <div
                      key={`${price.salePrice}-${price.availableQuantity}`}
                      className="rounded-md border border-slate-900 p-4"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current price</p>
                      <p className="mt-1 text-3xl font-black tabular-nums text-slate-950">{money(price.salePrice)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {qty(price.availableQuantity)} available at {branchName}
                      </p>
                    </div>
                  ))
                ) : (
                  <Notice tone="warn" title="Nothing free at this branch">
                    The product exists, but every piece here is either sold or already reserved.
                  </Notice>
                )}

                <dl>
                  <Row label="Variation" value={result.variation ? variationLabel(result.variation) : 'Base product'} />
                  {unit ? (
                    <>
                      <Row label="Unit code" value={<Code className="text-slate-700">{unit.barcode}</Code>} />
                      <Row label="Serial" value={unit.unitSerial} mono />
                      <Row
                        label="Piece state"
                        value={<StateChip state="ready" label={String(unit.status || '').replaceAll('_', ' ')} />}
                      />
                      <Row label="Batch" value={unit.productionBatch?.batchNo} mono />
                      <Row label="Made by" value={unit.producedBy?.name} />
                    </>
                  ) : (
                    <Row label="Piece" value={<Pill tone="neutral">Catalogue barcode — not an individual piece</Pill>} />
                  )}
                </dl>
              </div>
            )}
          </SectionBody>
        </Section>
      </div>
    </div>
  );
}
