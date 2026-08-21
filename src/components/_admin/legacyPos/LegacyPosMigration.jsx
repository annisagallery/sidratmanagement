'use client';

/**
 * Old POS migration desk — TEMPORARY, removed when the old POS is switched off.
 *
 * Two jobs, and the whole page is built around the difference between them:
 *
 *   Catalog — run rarely. Brings branches, products and variations across and
 *             links each variation to its old barcode. Nothing can be synced
 *             until this has matched it.
 *   Stock   — run often. Moves only the difference between what the old POS
 *             holds now and what has already been pulled from it.
 *
 * Every job is previewed first and previewing writes nothing, so the operator
 * reads what will happen before agreeing to it. Both run on the server past any
 * browser timeout, so this page starts a run and then polls it.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDatabase,
  FiEye,
  FiLayers,
  FiPackage,
  FiPlay,
  FiRefreshCw,
  FiSearch
} from 'react-icons/fi';

import {
  getLegacyPosBranches,
  getLegacyPosProducts,
  getLegacyPosRun,
  getLegacyPosRuns,
  getLegacyPosStatus,
  getLegacyPosStock,
  startLegacyPosRun
} from 'src/services/legacyPos';
import {
  EmptyRow,
  Field,
  Notice,
  PageBar,
  Pill,
  Section,
  SectionBody,
  StatTile,
  Toolbar,
  errorAlert,
  errorText,
  fieldClass,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';

const JOBS = {
  catalog: {
    label: 'Branches & products',
    icon: FiLayers,
    blurb:
      'Reads the five live showrooms and the products they actually stock, then creates whatever is missing here — branches, categories, products and variations — linking each variation to its old barcode so stock can find it. Deprecated showrooms and anything only they held are ignored. Nothing already in this system is renamed or re-priced.',
    confirm:
      'Missing branches, categories, products and variations will be created from the old POS. Existing ones are left alone.',
    runLabel: 'Import catalog'
  },
  stock: {
    label: 'Branch stock',
    icon: FiPackage,
    blurb:
      'Compares what each live showroom holds right now against what has already been pulled from it, and moves only the difference. Branches outside the five are left exactly as they are. Stock this system produced or sold is never touched, and stock reserved for an order is never taken back.',
    confirm: 'Branch stock will be moved to match the old POS. Only the difference is applied.',
    runLabel: 'Sync stock'
  }
};

const RUN_TONE = { running: 'info', succeeded: 'good', failed: 'bad' };

const deltaTone = (delta) => (delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral');
const signed = (value) => `${value > 0 ? '+' : ''}${qty(value)}`;

function ActionPill({ action }) {
  const tone = { create: 'good', link: 'info', matched: 'neutral' }[action] || 'neutral';
  const label = { create: 'New', link: 'Link', matched: 'Already here' }[action] || action;
  return <Pill tone={tone}>{label}</Pill>;
}

function Messages({ title, tone, items }) {
  if (!items?.length) return null;
  return (
    <Notice tone={tone} icon={tone === 'bad' ? FiAlertTriangle : undefined} title={`${title} (${items.length})`}>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {items.slice(0, 25).map((item) => (
          <li key={item}>{item}</li>
        ))}
        {items.length > 25 ? <li className="opacity-70">…and {items.length - 25} more.</li> : null}
      </ul>
    </Notice>
  );
}

/* ── report rendering ─────────────────────────────────────────────────────── */

function SummaryTiles({ tiles }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile key={tile.label} label={tile.label} value={tile.value} note={tile.note} tone={tile.tone} />
      ))}
    </div>
  );
}

function CatalogReport({ report }) {
  const summary = report.summary || {};
  const applied = report.created;
  const tiles = applied
    ? [
        { label: 'Branches created', value: qty(applied.branches), tone: applied.branches ? 'good' : 'muted' },
        { label: 'Categories created', value: qty(applied.categories), tone: applied.categories ? 'good' : 'muted' },
        { label: 'Products created', value: qty(applied.products), tone: applied.products ? 'good' : 'muted' },
        { label: 'Variations created', value: qty(applied.variations), tone: applied.variations ? 'good' : 'muted' },
        {
          label: 'Variations linked',
          value: qty(applied.linkedVariations),
          note: 'Old barcode attached to a variation already here',
          tone: applied.linkedVariations ? 'info' : 'muted'
        }
      ]
    : [
        {
          label: 'Branches',
          value: qty(summary.branchesToCreate),
          note: `to create · ${qty(summary.branchesMatched)} already here`,
          tone: summary.branchesToCreate ? 'good' : 'muted'
        },
        {
          label: 'Products',
          value: qty(summary.productsToCreate),
          note: `to create · ${qty(summary.productsMatched)} already here`,
          tone: summary.productsToCreate ? 'good' : 'muted'
        },
        {
          label: 'Categories',
          value: qty(summary.categoriesToCreate),
          note: 'to create',
          tone: summary.categoriesToCreate ? 'good' : 'muted'
        },
        {
          label: 'Variations',
          value: qty(summary.variationsToCreate),
          note: `to create · ${qty(summary.variationsToLink)} to link`,
          tone: summary.variationsToCreate ? 'good' : 'muted'
        }
      ];

  return (
    <div className="space-y-4">
      <SummaryTiles tiles={tiles} />
      <Messages title="Must be resolved first" tone="bad" items={report.conflicts} />
      <Messages title="Worth knowing" tone="warn" items={report.warnings} />

      {report.branches?.length ? (
        <Section title="Showrooms" hint={`${report.branches.length} in scope`}>
          <div className="max-h-72 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold">Old warehouse</th>
                  <th className="px-3 py-2 font-semibold">Branch here</th>
                  <th className="px-3 py-2 text-right font-semibold">Stock there</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {report.branches.map((row) => (
                  <tr key={row.warehouse} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{row.warehouse}</td>
                    <td className="px-3 py-1.5 text-slate-500">{row.branch || <span className="ops-code">{row.code}</span>}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{qty(row.stockQuantity)}</td>
                    <td className="px-3 py-1.5">
                      <ActionPill action={row.action} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {report.products?.length ? (
        <Section title="Products" hint={`${report.products.length} after the name convention is applied`}>
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Slug</th>
                  <th className="px-3 py-2 text-right font-semibold">Variations</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {report.products.map((row) => (
                  <tr key={row.code} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-800">
                      {row.name} <span className="ops-code text-[11px] text-slate-400">#{row.code}</span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">
                      {row.category} {row.newCategory ? <Pill tone="good">new</Pill> : null}
                    </td>
                    <td className="ops-code px-3 py-1.5 text-[11px] text-slate-400">{row.slug}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                      {row.variationsToCreate ? <span className="font-semibold text-emerald-700">+{row.variationsToCreate}</span> : null}
                      {row.variationsToCreate && row.variationsMatched ? ' / ' : null}
                      {row.variationsMatched ? <span className="text-slate-400">{row.variationsMatched} here</span> : null}
                      {!row.variationsToCreate && !row.variationsMatched ? '—' : null}
                    </td>
                    <td className="px-3 py-1.5">
                      <ActionPill action={row.action} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function StockReport({ report }) {
  const summary = report.summary || {};
  const applied = report.applied;
  const tiles = applied
    ? [
        { label: 'Lines increased', value: qty(applied.linesIncreased), tone: applied.linesIncreased ? 'good' : 'muted' },
        { label: 'Added', value: signed(applied.quantityAdded), tone: applied.quantityAdded ? 'good' : 'muted' },
        { label: 'Lines decreased', value: qty(applied.linesDecreased), tone: applied.linesDecreased ? 'warn' : 'muted' },
        { label: 'Removed', value: signed(-applied.quantityRemoved), tone: applied.quantityRemoved ? 'bad' : 'muted' }
      ]
    : [
        {
          label: 'Lines to change',
          value: qty(summary.linesToIncrease + summary.linesToDecrease),
          note: `${qty(summary.unchangedLines)} already agree`,
          tone: summary.linesToIncrease + summary.linesToDecrease ? 'info' : 'good'
        },
        { label: 'To add', value: signed(summary.quantityToAdd), tone: summary.quantityToAdd ? 'good' : 'muted' },
        { label: 'To remove', value: signed(-summary.quantityToRemove), tone: summary.quantityToRemove ? 'bad' : 'muted' },
        {
          label: 'Not matched yet',
          value: qty(summary.unmappedLines),
          note: summary.unmappedLines ? `${qty(summary.unmappedQuantity)} pcs — import the catalog first` : 'every line is matched',
          tone: summary.unmappedLines ? 'warn' : 'good'
        }
      ];

  return (
    <div className="space-y-4">
      <SummaryTiles tiles={tiles} />
      <Messages title="Must be resolved first" tone="bad" items={report.conflicts} />
      <Messages title="Worth knowing" tone="warn" items={report.warnings} />

      {applied && report.shortfalls?.length ? (
        <Section title="Could not be reduced in full" hint="Retried on the next sync">
          <div className="max-h-60 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold">Branch</th>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Still to remove</th>
                </tr>
              </thead>
              <tbody>
                {report.shortfalls.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 text-slate-600">{row.branchName}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{row.productName}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-rose-600">{qty(row.shortfall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {applied ? null : report.changes?.length ? (
        <Section
          title="Differences"
          hint={report.changesTruncated ? `first 500 of ${report.changes.length + report.changesTruncated}` : `${report.changes.length} lines`}
        >
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold">Branch</th>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Old barcode</th>
                  <th className="px-3 py-2 text-right font-semibold">Old POS</th>
                  <th className="px-3 py-2 text-right font-semibold">Pulled so far</th>
                  <th className="px-3 py-2 text-right font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {report.changes.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 text-slate-600">{row.branch}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{row.product}</td>
                    <td className="ops-code px-3 py-1.5 text-[11px] text-slate-400">{row.legacyBarcode || '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{qty(row.legacyQuantity)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{qty(row.pulledSoFar)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Pill tone={deltaTone(row.delta)}>{signed(row.delta)}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Notice tone="good" icon={FiCheckCircle} title="Nothing to move">
          Every matched line already holds what the old POS says it should.
        </Notice>
      )}

      {report.unmappedLines?.length ? (
        <Section title="No variation here yet" hint={`${report.unmappedLines.length} old barcodes`}>
          <SectionBody className="p-4 text-xs text-slate-500">
            <p className="mb-2">Run the branches &amp; products import to create these, then sync again.</p>
            <div className="flex flex-wrap gap-1.5">
              {report.unmappedLines.map((row) => (
                <Pill key={row.id} tone="warn">
                  {row.legacyBarcode ? (
                    <span className="ops-code">{row.legacyBarcode}</span>
                  ) : (
                    <span className="italic opacity-70">no code</span>
                  )}{' '}
                  · {row.name}
                  {row.color ? ` · ${row.color}` : ''} · {qty(row.quantity)}
                </Pill>
              ))}
            </div>
          </SectionBody>
        </Section>
      ) : null}
    </div>
  );
}

function RunPanel({ run }) {
  if (!run) return null;
  const job = JOBS[run.job];
  const report = run.report;
  return (
    <Section
      title={`${job?.label || run.job} — ${run.mode === 'apply' ? 'run' : 'preview'}`}
      icon={job?.icon}
      hint={run.finishedAt ? new Date(run.finishedAt).toLocaleString() : 'working…'}
      actions={
        <>
          {/* Which shop this was, so a report read later is not ambiguous. */}
          {run.scopeLabel ? <Pill tone="brand">{run.scopeLabel}</Pill> : null}
          <Pill tone={RUN_TONE[run.status] || 'neutral'}>{run.status}</Pill>
        </>
      }
    >
      <SectionBody className="space-y-4 p-4">
        {run.status === 'running' ? (
          <Notice tone="info" icon={FiRefreshCw} title="Working">
            Reading {run.scopeLabel ? run.scopeLabel : 'the old POS'} and comparing it with this system. Leaving
            this page does not stop it.
          </Notice>
        ) : null}

        {run.status === 'failed' ? (
          <>
            <Notice tone="bad" icon={FiAlertTriangle} title="The job stopped and nothing was changed">
              {run.error?.message}
            </Notice>
            <Messages title="Conflicts" tone="bad" items={run.error?.conflicts} />
          </>
        ) : null}

        {report && run.job === 'catalog' ? <CatalogReport report={report} /> : null}
        {report && run.job === 'stock' ? <StockReport report={report} /> : null}
      </SectionBody>
    </Section>
  );
}

/* ── read-only browsing ───────────────────────────────────────────────────── */

function BranchesTab() {
  const { data, isLoading, error } = useQuery('legacy-pos-branches', getLegacyPosBranches, { retry: false });
  const rows = data?.data || [];
  return (
    <div className="max-h-[32rem] overflow-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-900 text-white">
          <tr>
            <th className="px-3 py-2 font-semibold">Old warehouse</th>
            <th className="px-3 py-2 font-semibold">Code</th>
            <th className="px-3 py-2 font-semibold">Branch here</th>
            <th className="px-3 py-2 text-right font-semibold">Stock lines</th>
            <th className="px-3 py-2 text-right font-semibold">Stock</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <EmptyRow colSpan={5} title="Reading the old POS…" /> : null}
          {error ? <EmptyRow colSpan={5} title="The old POS could not be read" hint={errorText(error)} /> : null}
          {!isLoading && !error && !rows.length ? <EmptyRow colSpan={5} title="No warehouses in the old POS" /> : null}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-1.5 font-semibold text-slate-800">{row.name}</td>
              <td className="ops-code px-3 py-1.5 text-[11px] text-slate-400">{row.code || '—'}</td>
              <td className="px-3 py-1.5">
                {row.branch ? (
                  <span className="text-slate-600">{row.branch.name}</span>
                ) : (
                  <Pill tone="warn">not here yet</Pill>
                )}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{qty(row.stockLines)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800">{qty(row.stockQuantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductsTab({ search }) {
  const { data, isLoading, error } = useQuery(
    ['legacy-pos-products', search],
    () => getLegacyPosProducts({ search, limit: 200 }),
    { retry: false, keepPreviousData: true }
  );
  const rows = data?.data || [];
  const meta = data?.meta || {};
  return (
    <>
      {meta.total ? (
        <p className="px-4 pt-3 text-[11px] text-slate-400">
          Showing {rows.length} of {qty(meta.total)} · {qty(meta.linked)} already linked
          {meta.needsReview ? ` · ${qty(meta.needsReview)} need a material added to the mapping` : ''}
        </p>
      ) : null}
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-900 text-white">
            <tr>
              <th className="px-3 py-2 font-semibold">Name in the old POS</th>
              <th className="px-3 py-2 font-semibold">Reads as</th>
              <th className="px-3 py-2 font-semibold">Material / size</th>
              <th className="px-3 py-2 text-right font-semibold">Colours</th>
              <th className="px-3 py-2 text-right font-semibold">Stock</th>
              <th className="px-3 py-2 font-semibold">Here</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <EmptyRow colSpan={6} title="Reading the old POS…" /> : null}
            {error ? <EmptyRow colSpan={6} title="The old POS could not be read" hint={errorText(error)} /> : null}
            {!isLoading && !error && !rows.length ? (
              <EmptyRow colSpan={6} title="No products match" hint="Try a different search." />
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-1.5 text-slate-500">{row.rawName}</td>
                <td className="px-3 py-1.5 font-semibold text-slate-800">{row.name}</td>
                <td className="px-3 py-1.5 text-slate-500">
                  {row.unresolvedTerminalMaterial ? (
                    <Pill tone="bad">material not in the mapping</Pill>
                  ) : (
                    [row.material, row.size].filter(Boolean).join(' · ') || '—'
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{qty(row.variantCount)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800">{qty(row.stockQuantity)}</td>
                <td className="px-3 py-1.5">
                  {row.product ? (
                    <span className="text-slate-600">{row.product.name}</span>
                  ) : (
                    <Pill tone="warn">not here yet</Pill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StockTab({ search }) {
  const { data, isLoading, error } = useQuery(
    ['legacy-pos-stock', search],
    () => getLegacyPosStock({ search, limit: 300 }),
    { retry: false, keepPreviousData: true }
  );
  const rows = data?.data || [];
  const meta = data?.meta || {};
  return (
    <>
      {meta.total ? (
        <p className="px-4 pt-3 text-[11px] text-slate-400">
          Showing {rows.length} of {qty(meta.total)} lines · {qty(meta.legacyQuantity)} pcs in the old POS
          {meta.unmapped ? ` · ${qty(meta.unmapped)} not matched here` : ''}
        </p>
      ) : null}
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-900 text-white">
            <tr>
              <th className="px-3 py-2 font-semibold">Warehouse</th>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 font-semibold">Old barcode</th>
              <th className="px-3 py-2 text-right font-semibold">Old POS</th>
              <th className="px-3 py-2 text-right font-semibold">Pulled</th>
              <th className="px-3 py-2 text-right font-semibold">On hand here</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <EmptyRow colSpan={6} title="Reading the old POS…" /> : null}
            {error ? <EmptyRow colSpan={6} title="The old POS could not be read" hint={errorText(error)} /> : null}
            {!isLoading && !error && !rows.length ? (
              <EmptyRow colSpan={6} title="No stock lines match" hint="Try a different search." />
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-1.5 text-slate-500">{row.branch?.name || row.warehouse}</td>
                <td className="px-3 py-1.5">
                  <span className="font-semibold text-slate-800">{row.product?.name || row.name}</span>
                  <span className="text-slate-400"> {[row.color, row.material, row.size].filter(Boolean).join(' · ')}</span>
                </td>
                <td className="ops-code px-3 py-1.5 text-[11px] text-slate-400">{row.legacyBarcode || '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800">{qty(row.legacyQuantity)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">
                  {row.pulledSoFar === null ? '—' : qty(row.pulledSoFar)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                  {row.variationId ? qty(row.onHand) : <Pill tone="warn">not matched</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function LegacyPosMigration() {
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState(null);
  const [tab, setTab] = useState('branches');
  // '' means all five. Stock is counted and signed off shop by shop, so the
  // picker is part of starting the run, not a filter on its result.
  const [warehouseId, setWarehouseId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const statusQuery = useQuery('legacy-pos-status', getLegacyPosStatus, { retry: false });
  const status = statusQuery.data?.data;

  // The showroom picker needs the warehouse ids, which only /branches carries.
  const showroomsQuery = useQuery('legacy-pos-branches', getLegacyPosBranches, {
    retry: false,
    enabled: Boolean(status?.connected)
  });
  const showrooms = showroomsQuery.data?.data || [];

  const runsQuery = useQuery('legacy-pos-runs', getLegacyPosRuns, { retry: false });
  const recentRuns = runsQuery.data?.data || [];

  // Follow the newest run automatically, so a run started before a page reload
  // is picked back up rather than looking as though it never happened.
  const followedId = activeRunId || recentRuns[0]?.id || null;
  const runQuery = useQuery(['legacy-pos-run', followedId], () => getLegacyPosRun(followedId), {
    enabled: Boolean(followedId),
    retry: false,
    refetchInterval: (data) => (data?.data?.status === 'running' ? 2000 : false),
    onSuccess: (data) => {
      if (data?.data?.status === 'succeeded' && data.data.mode === 'apply') {
        queryClient.invalidateQueries('legacy-pos-status');
        queryClient.invalidateQueries('legacy-pos-branches');
        queryClient.invalidateQueries('legacy-pos-products');
        queryClient.invalidateQueries('legacy-pos-stock');
      }
    }
  });
  const run = runQuery.data?.data;
  const busy = run?.status === 'running';

  const start = useMutation(startLegacyPosRun, {
    onSuccess: (response) => {
      setActiveRunId(response?.data?.id || null);
      queryClient.invalidateQueries('legacy-pos-runs');
    },
    onError: (error) => errorAlert('The job could not be started', error)
  });

  const trigger = async (job, mode) => {
    // Stock runs one showroom at a time; the catalog never does.
    const warehouse = job === 'stock' ? showrooms.find((row) => String(row.id) === warehouseId) : null;
    const scopeLabel = job === 'stock' ? warehouse?.name || 'all five showrooms' : null;

    if (mode === 'apply') {
      const confirmed = await Swal.fire({
        title: `${JOBS[job].runLabel}?`,
        // Naming the shop in the confirmation is the point of a branch-by-branch
        // sync: it is the last chance to notice you picked the wrong one.
        text: scopeLabel ? `${JOBS[job].confirm} This run covers ${scopeLabel}.` : JOBS[job].confirm,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: JOBS[job].runLabel,
        confirmButtonColor: '#0f172a'
      });
      if (!confirmed.isConfirmed) return;
    }
    start.mutate({
      job,
      mode,
      warehouseId: warehouse ? warehouse.id : null,
      warehouseName: warehouse ? warehouse.name : null
    });
    if (mode === 'preview') toast('Preview started');
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const connected = status?.connected;

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Migration"
        title="Old POS"
        subtitle="Bring branches, products and branch stock across from the old POS while both systems are running."
      >
        <button
          type="button"
          onClick={() => statusQuery.refetch()}
          className="btn-ghost h-9 !text-xs"
          disabled={statusQuery.isFetching}
        >
          <FiRefreshCw size={13} className={statusQuery.isFetching ? 'animate-spin' : ''} /> Check connection
        </button>
      </PageBar>

      <Section
        title="Old POS"
        icon={FiDatabase}
        hint={status?.connection ? `${status.connection.host} · ${status.connection.database}` : undefined}
        actions={
          <Pill tone={connected ? 'good' : status?.configured ? 'bad' : 'warn'}>
            {connected ? 'connected' : status?.configured ? 'unreachable' : 'not configured'}
          </Pill>
        }
      >
        <SectionBody className="space-y-3 p-4">
          {statusQuery.isLoading ? <p className="text-sm text-slate-400">Checking…</p> : null}
          {status && !connected ? (
            <Notice tone={status.configured ? 'bad' : 'warn'} icon={FiAlertTriangle} title="The old POS cannot be read">
              {status.message || 'The connection was refused.'}
            </Notice>
          ) : null}
          {connected ? (
            <>
              {/* Every figure below counts the live showrooms only. Saying so
                  next to them is the difference between "the old POS has 127
                  products" and "127 products still trade" — a reader who
                  assumes the first will think the import lost things. */}
              <Notice
                tone={status.source.missingWarehouses?.length ? 'bad' : 'neutral'}
                icon={status.source.missingWarehouses?.length ? FiAlertTriangle : FiLayers}
                title={`Scoped to ${qty(status.scope?.length || 0)} showrooms`}
              >
                {(status.scope || []).join(' · ')}
                {status.source.missingWarehouses?.length ? (
                  <p className="mt-1 font-semibold">
                    Not found in the old POS: {status.source.missingWarehouses.join(', ')}. Nothing can be
                    imported until the names match.
                  </p>
                ) : (
                  <p className="mt-1 opacity-80">
                    Deprecated showrooms are ignored — their products and stock are never read or synced.
                  </p>
                )}
              </Notice>
              <SummaryTiles
                tiles={[
                  { label: 'Showrooms', value: qty(status.source.warehouses) },
                  { label: 'Products trading', value: qty(status.source.products) },
                  { label: 'Variants trading', value: qty(status.source.variants) },
                  {
                    label: 'Stock there',
                    value: qty(status.source.stockQuantity),
                    note: `${qty(status.source.stockLines)} lines`
                  }
                ]}
              />
            </>
          ) : null}
          {status?.lastStockMovementAt ? (
            <p className="text-[11px] text-slate-400">
              Last stock movement pulled: {new Date(status.lastStockMovementAt).toLocaleString()}
            </p>
          ) : null}
        </SectionBody>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(JOBS).map(([job, definition]) => (
          <Section key={job} title={definition.label} icon={definition.icon}>
            {/* min-h, never h-full: `Section` is not a flex column, so h-full
                here resolves to the section's whole height — header included —
                and pushes the buttons out under `overflow-hidden`. A floor is
                all this needs: it lines the two cards' buttons up when their
                blurbs wrap to different heights. */}
            <SectionBody className="flex min-h-[7.5rem] flex-col gap-3 p-4">
              <p className="text-xs leading-relaxed text-slate-500">{definition.blurb}</p>

              {job === 'stock' ? (
                <Field
                  label="Showroom to sync"
                  hint="One shop at a time is how stock is counted and signed off. Pick all five only to settle everything at once."
                >
                  <select
                    value={warehouseId}
                    onChange={(event) => setWarehouseId(event.target.value)}
                    className={`${fieldClass} h-9 !py-1 !text-xs`}
                    disabled={!connected || busy || start.isLoading}
                  >
                    <option value="">All five showrooms</option>
                    {showrooms.map((row) => (
                      <option key={row.id} value={String(row.id)} disabled={!row.mapped}>
                        {row.name}
                        {row.mapped ? ` — ${qty(row.stockQuantity)} pcs` : ' — no branch here yet'}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => trigger(job, 'preview')}
                  className="btn-ghost h-9 !text-xs"
                  disabled={!connected || busy || start.isLoading}
                >
                  <FiEye size={13} /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => trigger(job, 'apply')}
                  className="btn-brand h-9 !text-xs"
                  disabled={!connected || busy || start.isLoading}
                >
                  <FiPlay size={13} /> {definition.runLabel}
                </button>
              </div>
            </SectionBody>
          </Section>
        ))}
      </div>

      {busy ? null : (
        <p className="text-[11px] text-slate-400">
          Preview writes nothing — it only reads both systems and reports what a run would do.
        </p>
      )}

      <RunPanel run={run} />

      {recentRuns.length > 1 ? (
        <Section title="Recent runs" hint="Kept until the API restarts">
          <SectionBody className="flex flex-wrap gap-2 p-4">
            {recentRuns.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActiveRunId(entry.id)}
                className={`rounded-md border px-3 py-1.5 text-left text-[11px] transition hover:bg-slate-50 ${
                  entry.id === followedId ? 'border-slate-900' : 'border-slate-200'
                }`}
              >
                <span className="font-semibold text-slate-700">
                  {JOBS[entry.job]?.label || entry.job} · {entry.mode}
                  {entry.scopeLabel ? <span className="font-normal text-slate-500"> · {entry.scopeLabel}</span> : null}
                </span>
                <span className="ml-2 text-slate-400">{new Date(entry.startedAt).toLocaleTimeString()}</span>
                <Pill tone={RUN_TONE[entry.status] || 'neutral'} className="ml-2">
                  {entry.status}
                </Pill>
              </button>
            ))}
          </SectionBody>
        </Section>
      ) : null}

      <Section
        title="What the live showrooms hold"
        icon={FiSearch}
        actions={
          <Toolbar>
            {[
              { key: 'branches', label: 'Branches' },
              { key: 'products', label: 'Products' },
              { key: 'stock', label: 'Stock' }
            ].map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setTab(entry.key)}
                className={`rounded-md border px-3 py-1 text-[11px] font-semibold transition ${
                  tab === entry.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {entry.label}
              </button>
            ))}
            {tab === 'branches' ? null : (
              <form onSubmit={submitSearch} className="flex items-center gap-1">
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name or barcode"
                  className={`${fieldClass} h-8 !w-52 !py-1 !text-xs`}
                />
                <button type="submit" className="btn-ghost h-8 !text-xs">
                  <FiSearch size={13} />
                </button>
              </form>
            )}
          </Toolbar>
        }
      >
        {!connected ? (
          <SectionBody className="p-6 text-center text-sm text-slate-400">
            Connect to the old POS to browse what it holds.
          </SectionBody>
        ) : (
          <>
            {tab === 'branches' ? <BranchesTab /> : null}
            {tab === 'products' ? <ProductsTab search={search} /> : null}
            {tab === 'stock' ? <StockTab search={search} /> : null}
          </>
        )}
      </Section>
    </div>
  );
}
