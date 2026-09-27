'use client';

/**
 * Catalog migration desk — TEMPORARY, removed when the old POS is switched off.
 *
 * The page is a line, because the order is the point:
 *
 *   1 Website   — the old website's products, text, images and prices. Runs
 *                 first so it owns every product customers see.
 *   2 Old POS   — showroom products merged onto those, adding old barcodes and
 *                 anything the website never sold.
 *   3 Stock     — run as often as needed; moves only the difference.
 *
 * Above the line sits "Start over", which deletes the whole catalog so the line
 * can be run again from nothing. It exists only until launch.
 *
 * Every job is previewed first and previewing writes nothing. All of them run on
 * the server past any browser timeout, so this page starts a run and polls it.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { confirmAction } from 'src/utils/swal';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiDatabase,
  FiEye,
  FiGlobe,
  FiLayers,
  FiMapPin,
  FiPackage,
  FiPlay,
  FiRefreshCw,
  FiSearch,
  FiTrash2
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
  reset: {
    label: 'Start over',
    icon: FiTrash2,
    runLabel: 'Delete the catalog'
  },
  website: {
    step: 1,
    label: 'Website products',
    icon: FiGlobe,
    source: 'website',
    blurb:
      'Brings every product from the old website with its description, images, SEO text, category and prices. Where a product is already here, the website’s values replace what is there; its barcodes and stock stay.',
    confirm: 'Website products will be created, or updated to match the website. Stock and barcodes are not touched.',
    runLabel: 'Import website'
  },
  catalog: {
    step: 2,
    label: 'Showroom products',
    icon: FiLayers,
    source: 'pos',
    usesScope: true,
    blurb:
      'Matches each old-POS product onto the website product of the same name and adds its old barcodes, so showroom stock can find it. Only what the website never had is created. Nothing is renamed or re-priced.',
    confirm: 'Old barcodes will be attached, and products the website never had will be created.',
    runLabel: 'Import showroom products'
  },
  stock: {
    step: 3,
    label: 'Showroom stock',
    icon: FiPackage,
    source: 'pos',
    usesScope: true,
    repeatable: true,
    blurb:
      'Moves only the difference between what the selected showrooms hold now and what has already been pulled. Stock made or sold here is never touched, and reserved stock is never taken back.',
    confirm: 'Branch stock will be moved to match the old POS. Only the difference is applied.',
    runLabel: 'Sync stock'
  }
};

const STEPS = ['website', 'catalog', 'stock'];
const RESET_PHRASE = 'DELETE ALL PRODUCTS';

const RUN_TONE = { running: 'info', succeeded: 'good', failed: 'bad' };

const deltaTone = (delta) => (delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral');
const signed = (value) => `${value > 0 ? '+' : ''}${qty(value)}`;

function ActionPill({ action }) {
  const tone = { create: 'good', link: 'info', update: 'info', matched: 'neutral' }[action] || 'neutral';
  const label = { create: 'New', link: 'Link', update: 'Update', matched: 'Already here' }[action] || action;
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

function ScopeSelector({ rows, selectedIds, onChange, isLoading, error, disabled, missingDefaults = [] }) {
  const [collapsed, setCollapsed] = useState(true);
  const selected = new Set(selectedIds.map(String));
  const selectedRows = rows.filter((row) => selected.has(String(row.id)));
  const defaultIds = rows.filter((row) => row.defaultSelected).map((row) => row.id);

  const toggle = (id) => {
    const key = String(id);
    onChange(selected.has(key) ? selectedIds.filter((value) => String(value) !== key) : [...selectedIds, id]);
  };

  return (
    <Section
      title="Showroom scope"
      icon={FiMapPin}
      hint={`${qty(selectedIds.length)} of ${qty(rows.length)} selected`}
      actions={
        <div className="flex flex-wrap gap-2">
          {!collapsed ? (
            <>
              <button
                type="button"
                onClick={() => onChange(defaultIds)}
                className="btn-ghost h-11"
                disabled={disabled || !defaultIds.length}
              >
                Use default
              </button>
              <button
                type="button"
                onClick={() => onChange(rows.map((row) => row.id))}
                className="btn-ghost h-11"
                disabled={disabled || !rows.length || selectedIds.length === rows.length}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="btn-ghost h-11"
                disabled={disabled || !selectedIds.length}
              >
                Clear
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="btn-ghost h-11"
            aria-expanded={!collapsed}
            aria-controls="legacy-pos-scope-panel"
          >
            {collapsed ? 'Expand' : 'Collapse'}
            <FiChevronDown
              size={14}
              aria-hidden="true"
              className={`transition-transform duration-200 motion-reduce:transition-none ${collapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>
      }
    >
      {collapsed ? (
        <SectionBody id="legacy-pos-scope-panel" className="p-4">
          {isLoading ? <p className="text-xs text-slate-500">Reading showrooms…</p> : null}
          {error ? <Notice tone="bad" title="Showrooms could not be loaded">{errorText(error)}</Notice> : null}
          {!isLoading && !error ? (
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">Active:</span>{' '}
              {selectedRows.length ? selectedRows.map((row) => row.name).join(' · ') : 'No showrooms selected'}
            </p>
          ) : null}
        </SectionBody>
      ) : (
      <SectionBody id="legacy-pos-scope-panel" className="space-y-3 p-4">
        <p id="legacy-pos-scope-help" className="text-xs leading-relaxed text-slate-500">
          This selection controls the showroom, product and stock views below, plus every preview and migration run.
          Unselected branches are never read or changed.
        </p>

        {isLoading ? <p className="text-sm text-slate-500">Reading showrooms…</p> : null}
        {error ? <Notice tone="bad" title="Showrooms could not be loaded">{errorText(error)}</Notice> : null}
        {missingDefaults.length ? (
          <Notice tone="warn" title="Some default showrooms were not found">
            {missingDefaults.join(', ')}
          </Notice>
        ) : null}

        {!isLoading && !error && rows.length ? (
          <fieldset
            aria-describedby="legacy-pos-scope-help"
            disabled={disabled}
            className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3"
          >
            <legend className="sr-only">Select showrooms in the migration scope</legend>
            {rows.map((row) => {
              const checked = selected.has(String(row.id));
              return (
                <label
                  key={row.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2 ${
                    checked ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(row.id)}
                    className="h-4 w-4 shrink-0 accent-slate-900"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-800">{row.name}</span>
                    <span className="block text-xs text-slate-500">
                      {row.code || 'No code'} · {qty(row.stockQuantity)} pcs
                      {row.branch ? ` · ${row.branch.name}` : ' · branch will be created by catalog import'}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : null}

        {!isLoading && !error && !rows.length ? (
          <Notice tone="warn" title="No showrooms found">The old POS did not return any warehouses.</Notice>
        ) : null}
        {!isLoading && !error && rows.length && !selectedIds.length ? (
          <Notice tone="warn" icon={FiAlertTriangle} title="Select at least one showroom">
            Browsing, previews and migration runs stay paused until a showroom is selected.
          </Notice>
        ) : null}
      </SectionBody>
      )}
    </Section>
  );
}

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
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Old warehouse</th>
                  <th className="px-3 py-2 font-medium">Branch here</th>
                  <th className="px-3 py-2 text-right font-medium">Stock there</th>
                  <th className="px-3 py-2 font-medium">Action</th>
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
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Slug</th>
                  <th className="px-3 py-2 text-right font-medium">Variations</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {report.products.map((row) => (
                  <tr key={row.code} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-800">
                      {row.name} <span className="ops-code text-xs text-slate-500">#{row.code}</span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">
                      {row.category} {row.newCategory ? <Pill tone="good">new</Pill> : null}
                    </td>
                    <td className="ops-code px-3 py-1.5 text-xs text-slate-500">{row.slug}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                      {row.variationsToCreate ? <span className="font-semibold text-emerald-700">+{row.variationsToCreate}</span> : null}
                      {row.variationsToCreate && row.variationsMatched ? ' / ' : null}
                      {row.variationsMatched ? <span className="text-slate-500">{row.variationsMatched} here</span> : null}
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
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Still to remove</th>
                </tr>
              </thead>
              <tbody>
                {report.shortfalls.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 text-slate-600">{row.branchName}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{row.productName}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-rose-700">{qty(row.shortfall)}</td>
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
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Old barcode</th>
                  <th className="px-3 py-2 text-right font-medium">Old POS</th>
                  <th className="px-3 py-2 text-right font-medium">Pulled so far</th>
                  <th className="px-3 py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {report.changes.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 text-slate-600">{row.branch}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{row.product}</td>
                    <td className="ops-code px-3 py-1.5 text-xs text-slate-500">{row.legacyBarcode || '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{qty(row.legacyQuantity)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{qty(row.pulledSoFar)}</td>
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

function WebsiteReport({ report }) {
  const summary = report.summary || {};
  const created = report.created;
  const tiles = created
    ? [
        { label: 'Products created', value: qty(created.products), tone: created.products ? 'good' : 'muted' },
        { label: 'Products updated', value: qty(report.updated?.products), tone: report.updated?.products ? 'info' : 'muted' },
        { label: 'Variations created', value: qty(created.variations), tone: created.variations ? 'good' : 'muted' },
        { label: 'Images added', value: qty(created.images), note: `${qty(created.categories)} categories created`, tone: created.images ? 'good' : 'muted' }
      ]
    : [
        {
          label: 'Products',
          value: qty(summary.productsToCreate),
          note: `to create · ${qty(summary.productsToUpdate)} to update · ${qty(summary.productsMatched)} already match`,
          tone: summary.productsToCreate ? 'good' : 'muted'
        },
        {
          label: 'Variations',
          value: qty(summary.variationsToCreate),
          note: `to create · ${qty(summary.variationsToUpdate)} to update`,
          tone: summary.variationsToCreate ? 'good' : 'muted'
        },
        { label: 'Categories', value: qty(summary.categoriesToCreate), note: 'to create', tone: summary.categoriesToCreate ? 'good' : 'muted' },
        { label: 'Images', value: qty(summary.imagesToCreate), note: 'to add', tone: summary.imagesToCreate ? 'good' : 'muted' }
      ];

  return (
    <div className="space-y-4">
      <SummaryTiles tiles={tiles} />
      <Messages title="Must be resolved first" tone="bad" items={report.conflicts} />
      <Messages title="Worth knowing" tone="warn" items={report.warnings} />
      {report.products?.length ? (
        <Section title="Products" hint={`${qty(report.products.length)} on the website`}>
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Slug</th>
                  <th className="px-3 py-2 text-right font-medium">Variations</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {report.products.map((row) => (
                  <tr key={`${row.slug}-${row.code}`} className="border-b border-slate-100">
                    <td className="px-3 py-1.5">
                      <span className="font-semibold text-slate-800">{row.name}</span>{' '}
                      <span className="ops-code text-xs text-slate-500">#{row.code}</span>
                      {row.replaces ? <span className="block text-xs text-slate-500">here as “{row.replaces}”</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">
                      {row.category} {row.newCategory ? <Pill tone="good">new</Pill> : null}
                    </td>
                    <td className="ops-code px-3 py-1.5 text-xs text-slate-500">{row.slug}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                      {row.variationsToCreate ? <span className="font-semibold text-emerald-700">+{row.variationsToCreate}</span> : null}
                      {row.variationsToCreate && (row.variationsMatched || row.variationsToLink) ? ' / ' : null}
                      {row.variationsMatched || row.variationsToLink ? (
                        <span className="text-slate-500">{row.variationsMatched + row.variationsToLink} here</span>
                      ) : null}
                      {!row.variationsToCreate && !row.variationsMatched && !row.variationsToLink ? '—' : null}
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

function ResetReport({ report }) {
  const applied = report.mode === 'apply';
  const total = (report.deleted || []).reduce((sum, row) => sum + row.rows, 0);
  const products = report.deleted?.find((row) => row.table === 'Product')?.rows || 0;
  const orders = report.deleted?.find((row) => row.table === 'Order')?.rows || 0;
  return (
    <div className="space-y-4">
      <SummaryTiles
        tiles={[
          { label: applied ? 'Products deleted' : 'Products', value: qty(products), tone: products ? 'bad' : 'muted' },
          { label: applied ? 'Orders deleted' : 'Orders', value: qty(orders), note: 'left with no items', tone: orders ? 'bad' : 'muted' },
          { label: applied ? 'Rows deleted' : 'Rows in all', value: qty(total), note: `across ${qty(report.deleted?.length)} tables`, tone: total ? 'bad' : 'muted' },
          {
            label: 'Kept, unlinked',
            value: qty((report.detached || []).reduce((sum, row) => sum + row.rows, 0)),
            note: 'e.g. payments of a deleted order',
            tone: report.detached?.length ? 'warn' : 'muted'
          }
        ]}
      />
      {report.deleted?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title={applied ? 'Deleted' : 'Will be deleted'} hint="table by table">
            <div className="max-h-80 overflow-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <tbody>
                  {report.deleted.map((row) => (
                    <tr key={row.table} className="border-b border-slate-100">
                      <td className="ops-code px-3 py-1.5 text-slate-700">{row.table}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-rose-700">{qty(row.rows)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title={applied ? 'Kept and unlinked' : 'Will be kept, unlinked'} hint="the link is cleared, the row stays">
            <div className="max-h-80 overflow-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <tbody>
                  {report.detached?.length ? (
                    report.detached.map((row) => (
                      <tr key={`${row.table}.${row.column}`} className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">
                          <span className="ops-code">{row.table}</span>
                          <span className="text-slate-500"> · {row.column} → {row.pointsAt}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-amber-700">{qty(row.rows)}</td>
                      </tr>
                    ))
                  ) : (
                    <EmptyRow colSpan={2} title="Nothing outside the catalog points at it" />
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      ) : (
        <Notice tone="good" icon={FiCheckCircle} title="The catalog is already empty">
          There is nothing to delete. Run the steps below.
        </Notice>
      )}
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
            {run.job === 'reset'
              ? 'Working out everything that belongs to the catalog.'
              : `Reading ${run.scopeLabel || (run.job === 'website' ? 'the old website' : 'the old POS')} and comparing it with this system.`}{' '}
            Leaving this page does not stop it.
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

        {report && run.job === 'reset' ? <ResetReport report={report} /> : null}
        {report && run.job === 'website' ? <WebsiteReport report={report} /> : null}
        {report && run.job === 'catalog' ? <CatalogReport report={report} /> : null}
        {report && run.job === 'stock' ? <StockReport report={report} /> : null}
      </SectionBody>
    </Section>
  );
}

/* ── read-only browsing ───────────────────────────────────────────────────── */

function BranchesTab({ rows, isLoading, error }) {
  return (
    <div className="max-h-[32rem] overflow-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Old warehouse</th>
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Branch here</th>
            <th className="px-3 py-2 text-right font-medium">Stock lines</th>
            <th className="px-3 py-2 text-right font-medium">Stock</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <EmptyRow colSpan={5} title="Reading the old POS…" /> : null}
          {error ? <EmptyRow colSpan={5} title="The old POS could not be read" hint={errorText(error)} /> : null}
          {!isLoading && !error && !rows.length ? <EmptyRow colSpan={5} title="No warehouses in the old POS" /> : null}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-1.5 font-semibold text-slate-800">{row.name}</td>
              <td className="ops-code px-3 py-1.5 text-xs text-slate-500">{row.code || '—'}</td>
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

function ProductsTab({ search, warehouseIds }) {
  const scopeKey = warehouseIds.join(',');
  const { data, isLoading, error } = useQuery(
    ['legacy-pos-products', scopeKey, search],
    () => getLegacyPosProducts({ search, limit: 200, warehouseIds }),
    { retry: false, enabled: Boolean(warehouseIds.length) }
  );
  const rows = data?.data || [];
  const meta = data?.meta || {};
  return (
    <>
      {meta.total ? (
        <p className="px-4 pt-3 text-xs text-slate-500">
          Showing {rows.length} of {qty(meta.total)} · {qty(meta.linked)} already linked
          {meta.needsReview ? ` · ${qty(meta.needsReview)} need a material added to the mapping` : ''}
        </p>
      ) : null}
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Name in the old POS</th>
              <th className="px-3 py-2 font-medium">Reads as</th>
              <th className="px-3 py-2 font-medium">Material / size</th>
              <th className="px-3 py-2 text-right font-medium">Colours</th>
              <th className="px-3 py-2 text-right font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Here</th>
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

function StockTab({ search, warehouseIds }) {
  const scopeKey = warehouseIds.join(',');
  const { data, isLoading, error } = useQuery(
    ['legacy-pos-stock', scopeKey, search],
    () => getLegacyPosStock({ search, limit: 300, warehouseIds }),
    { retry: false, enabled: Boolean(warehouseIds.length) }
  );
  const rows = data?.data || [];
  const meta = data?.meta || {};
  return (
    <>
      {meta.total ? (
        <p className="px-4 pt-3 text-xs text-slate-500">
          Showing {rows.length} of {qty(meta.total)} lines · {qty(meta.legacyQuantity)} pcs in the old POS
          {meta.unmapped ? ` · ${qty(meta.unmapped)} not matched here` : ''}
        </p>
      ) : null}
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Warehouse</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Old barcode</th>
              <th className="px-3 py-2 text-right font-medium">Old POS</th>
              <th className="px-3 py-2 text-right font-medium">Pulled</th>
              <th className="px-3 py-2 text-right font-medium">On hand here</th>
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
                  <span className="text-slate-500"> {[row.color, row.material, row.size].filter(Boolean).join(' · ')}</span>
                </td>
                <td className="ops-code px-3 py-1.5 text-xs text-slate-500">{row.legacyBarcode || '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800">{qty(row.legacyQuantity)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
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

const timeOf = (value) =>
  new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Where a job stands, read off the run log (newest first). The log lives in
 * the API's memory, so "not run" means "not since the API last started".
 */
function stepState(job, runs) {
  const latest = runs.find((entry) => entry.job === job);
  const applied = runs.find((entry) => entry.job === job && entry.mode === 'apply' && entry.status === 'succeeded');
  if (latest?.status === 'running') return { key: 'running', label: latest.mode === 'apply' ? 'Running' : 'Previewing', tone: 'info' };
  if (latest?.status === 'failed') return { key: 'failed', label: `Stopped ${timeOf(latest.startedAt)}`, tone: 'bad', applied };
  if (applied && applied === latest) return { key: 'applied', label: `Done ${timeOf(applied.finishedAt)}`, tone: 'good', applied };
  if (latest) return { key: 'previewed', label: `Previewed ${timeOf(latest.finishedAt)}`, tone: 'neutral', applied };
  return { key: 'idle', label: 'Not run yet', tone: 'neutral' };
}

function SourceCard({ icon: Icon, title, state, detail, children }) {
  const tone = state.connected ? 'good' : state.configured ? 'bad' : 'warn';
  return (
    <div className="card-ui flex min-w-0 flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-700">
          <Icon size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </p>
        <Pill tone={tone}>{state.connected ? 'connected' : state.configured ? 'unreachable' : 'not set up'}</Pill>
      </div>
      {state.connected ? (
        <p className="text-xs text-slate-500">{detail}</p>
      ) : (
        <p className="text-xs text-slate-500">{state.message || 'Checking…'}</p>
      )}
      {children}
    </div>
  );
}

/** One stop on the line: its number, what it does, where it stands, and its two actions. */
function Step({ job, state, sourceReady, blockedReason, orderHint, scopeNote, busy, onRun, last }) {
  const definition = JOBS[job];
  const node =
    state.key === 'applied'
      ? 'border-slate-900 bg-slate-900 text-white'
      : state.key === 'running'
        ? 'border-slate-900 bg-white text-[var(--brand-strong)] motion-safe:animate-pulse'
        : state.key === 'failed'
          ? 'border-rose-400 bg-rose-50 text-rose-700'
          : 'border-slate-300 bg-white text-slate-500';
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* The line itself: from this stop down to the next. */}
      {last ? null : <span aria-hidden="true" className="absolute left-[17px] top-9 bottom-0 w-px bg-slate-200" />}
      <span
        className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums ${node}`}
        aria-hidden="true"
      >
        {state.key === 'applied' ? <FiCheckCircle size={16} /> : definition.step}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
            <span className="sr-only">Step {definition.step}: </span>
            {definition.label}
          </h3>
          <Pill tone={state.tone}>{state.label}</Pill>
          {definition.repeatable ? <span className="text-xs text-slate-500">run as often as needed</span> : null}
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">{definition.blurb}</p>
        {scopeNote ? <p className="mt-1 text-xs text-slate-500">{scopeNote}</p> : null}
        {orderHint ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-700">
            <FiAlertTriangle size={12} className="mt-px shrink-0" aria-hidden="true" /> {orderHint}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onRun(job, 'preview')}
            className="btn-ghost btn-sm"
            disabled={!sourceReady || busy}
          >
            <FiEye size={13} aria-hidden="true" /> Preview
          </button>
          <button
            type="button"
            onClick={() => onRun(job, 'apply')}
            className="btn-brand btn-sm"
            disabled={!sourceReady || busy}
          >
            <FiPlay size={13} aria-hidden="true" /> {definition.runLabel}
          </button>
          {!sourceReady && blockedReason ? <span className="text-xs text-slate-500">{blockedReason}</span> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * The reset, kept apart from the line and coloured as what it is. Deleting
 * needs a preview of exactly what goes, then the phrase typed out.
 */
function StartOver({ runs, busy, onPreview, onApply }) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const latest = runs.find((entry) => entry.job === 'reset');
  const previewed = latest?.mode === 'preview' && latest.status === 'succeeded';
  const ready = previewed && phrase.trim() === RESET_PHRASE;
  return (
    <section className="card-ui overflow-hidden !border-rose-200">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 bg-rose-50/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FiTrash2 size={15} className="shrink-0 text-rose-700" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold text-rose-700">Start over</h2>
          <span className="truncate text-xs font-medium text-rose-700/80">before launch only</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="btn-ghost btn-sm"
          aria-expanded={open}
          aria-controls="start-over-panel"
        >
          {open ? 'Close' : 'Open'}
          <FiChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </header>
      {open ? (
        <div id="start-over-panel" className="space-y-3 p-4">
          <p className="max-w-3xl text-xs leading-relaxed text-slate-600">
            Deletes every product and variation, with everything that cannot exist without them: stock, stock lots and
            their ledger, order items, production records, reviews and purchase lines. Orders left with no items go too.
            Payments and cash entries of those orders are kept, with the order link cleared. Branches, users, colours,
            sizes, materials and images stay, and the steps below reuse them.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" onClick={onPreview} className="btn-ghost btn-sm" disabled={busy}>
              <FiEye size={13} aria-hidden="true" /> Preview what goes
            </button>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">
                Type <span className="ops-code text-rose-700">{RESET_PHRASE}</span> to confirm
              </span>
              <input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                className={`${fieldClass} h-9 !w-64 max-w-full !py-1 !text-xs`}
                autoComplete="off"
                spellCheck={false}
                disabled={!previewed || busy}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                onApply(phrase.trim());
                setPhrase('');
              }}
              className="btn-danger btn-sm inline-flex"
              disabled={!ready || busy}
            >
              <FiTrash2 size={13} aria-hidden="true" /> {JOBS.reset.runLabel}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {previewed
              ? `Previewed ${timeOf(latest.finishedAt)} — the table-by-table list is in the report below.`
              : 'Preview first: the delete unlocks once you have seen exactly what goes.'}{' '}
            Take a database backup before deleting; this cannot be undone from here.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default function LegacyPosMigration() {
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState(null);
  const [tab, setTab] = useState('branches');
  const [warehouseScope, setWarehouseScope] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const connectionQuery = useQuery('legacy-pos-status-connection', () => getLegacyPosStatus(), { retry: false });
  const connectionStatus = connectionQuery.data?.data;
  const connected = connectionStatus?.connected;
  const websiteState = connectionStatus?.website || { configured: false, connected: false };

  const showroomsQuery = useQuery('legacy-pos-branches', getLegacyPosBranches, {
    retry: false,
    enabled: Boolean(connected)
  });
  const showrooms = useMemo(() => showroomsQuery.data?.data || [], [showroomsQuery.data]);
  const defaultWarehouseIds = useMemo(
    () => showrooms.filter((row) => row.defaultSelected).map((row) => row.id),
    [showrooms]
  );
  const selectedWarehouseIds = warehouseScope ?? (defaultWarehouseIds.length ? defaultWarehouseIds : showrooms.map((row) => row.id));
  const scopeKey = useMemo(
    () => [...selectedWarehouseIds].map(Number).sort((a, b) => a - b).join(','),
    [selectedWarehouseIds]
  );
  const scopeReady = selectedWarehouseIds.length > 0;
  const scopedShowrooms = useMemo(() => {
    const selected = new Set(selectedWarehouseIds.map(String));
    return showrooms.filter((row) => selected.has(String(row.id)));
  }, [selectedWarehouseIds, showrooms]);
  const scopeLabel = scopedShowrooms.length === 1 ? scopedShowrooms[0].name : `${scopedShowrooms.length} showrooms`;

  const statusQuery = useQuery(
    ['legacy-pos-status', scopeKey],
    () => getLegacyPosStatus({ warehouseIds: selectedWarehouseIds }),
    { retry: false, enabled: Boolean(connected && scopeReady) }
  );
  const status = scopeReady ? statusQuery.data?.data : connectionStatus;

  const runsQuery = useQuery('legacy-pos-runs', getLegacyPosRuns, { retry: false });
  const recentRuns = useMemo(() => runsQuery.data?.data || [], [runsQuery.data]);

  // Follow the newest run automatically, so a run started before a page reload
  // is picked back up rather than looking as though it never happened.
  const followedId = activeRunId || recentRuns[0]?.id || null;
  const runQuery = useQuery(['legacy-pos-run', followedId], () => getLegacyPosRun(followedId), {
    enabled: Boolean(followedId),
    retry: false,
    refetchInterval: (data) => (data?.data?.status === 'running' ? 2000 : false),
    onSuccess: (data) => {
      if (data?.data?.status !== 'running') queryClient.invalidateQueries('legacy-pos-runs');
      if (data?.data?.status === 'succeeded' && data.data.mode === 'apply') {
        queryClient.invalidateQueries('legacy-pos-status');
        queryClient.invalidateQueries('legacy-pos-status-connection');
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
    const definition = JOBS[job];
    if (definition.usesScope && !scopeReady) return;
    const label = definition.usesScope ? scopeLabel : job === 'website' ? 'Old website' : 'Whole catalog';

    if (mode === 'apply') {
      const confirmed = await confirmAction({
        tone: 'warning',
        title: `${definition.runLabel}?`,
        text: `${definition.confirm}${definition.usesScope ? ` This run covers ${scopeLabel}.` : ''}`,
        confirmText: definition.runLabel
      });
      if (!confirmed) return;
    }
    start.mutate({ job, mode, warehouseIds: definition.usesScope ? selectedWarehouseIds : undefined, scopeLabel: label });
    if (mode === 'preview') toast('Preview started');
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const states = Object.fromEntries(STEPS.map((job) => [job, stepState(job, recentRuns)]));
  const working = busy || start.isLoading;
  const stepProps = {
    website: {
      sourceReady: Boolean(websiteState.connected),
      blockedReason: 'Connect the old website first.'
    },
    catalog: {
      sourceReady: Boolean(connected && scopeReady),
      blockedReason: connected ? 'Select at least one showroom below.' : 'Connect the old POS first.',
      orderHint: states.website.applied ? null : 'Import the website first, so these land on website products instead of beside them.',
      scopeNote: connected && scopeReady ? `Showrooms: ${scopedShowrooms.map((row) => row.name).join(' · ')}` : null
    },
    stock: {
      sourceReady: Boolean(connected && scopeReady),
      blockedReason: connected ? 'Select at least one showroom below.' : 'Connect the old POS first.',
      orderHint: states.catalog.applied ? null : 'Import showroom products first; stock can only land on a matched variation.',
      scopeNote: connected && scopeReady ? `Showrooms: ${scopedShowrooms.map((row) => row.name).join(' · ')}` : null
    }
  };

  return (
    <div className="space-y-6">
      <PageBar
        eyebrow="Migration"
        title="Catalog migration"
        subtitle="Website products first, then the showrooms, then their stock."
      >
        <button
          type="button"
          onClick={() => {
            connectionQuery.refetch();
            showroomsQuery.refetch();
            if (scopeReady) statusQuery.refetch();
          }}
          className="btn-ghost btn-sm"
          disabled={connectionQuery.isFetching || statusQuery.isFetching}
        >
          <FiRefreshCw size={13} className={connectionQuery.isFetching || statusQuery.isFetching ? 'animate-spin' : ''} /> Check connections
        </button>
      </PageBar>

      <div className="grid gap-3 md:grid-cols-2">
        <SourceCard
          icon={FiGlobe}
          title="Old website"
          state={connectionQuery.isLoading ? { message: 'Checking…' } : websiteState}
          detail={
            websiteState.source
              ? `${qty(websiteState.source.products)} products · ${qty(websiteState.source.variations)} variations · ${qty(websiteState.source.categories)} categories`
              : null
          }
        />
        <SourceCard
          icon={FiDatabase}
          title="Old POS"
          state={connectionQuery.isLoading ? { message: 'Checking…' } : connectionStatus || {}}
          detail={
            scopeReady && status?.source
              ? `${qty(status.source.products)} products · ${qty(status.source.stockQuantity)} pcs in ${qty(status.source.warehouses)} selected showrooms`
              : 'Select showrooms below to see their totals.'
          }
        >
          {status?.source?.missingWarehouses?.length ? (
            <p className="text-xs font-semibold text-rose-700">
              Not found in the old POS: {status.source.missingWarehouses.join(', ')}. Nothing can be imported until the
              names match.
            </p>
          ) : null}
          {status?.lastStockMovementAt ? (
            <p className="text-xs text-slate-500">Last stock pulled {timeOf(status.lastStockMovementAt)}</p>
          ) : null}
        </SourceCard>
      </div>

      <StartOver
        runs={recentRuns}
        busy={working}
        onPreview={() => trigger('reset', 'preview')}
        onApply={(confirmation) => start.mutate({ job: 'reset', mode: 'apply', confirmation, scopeLabel: 'Whole catalog' })}
      />

      <Section title="Migration" hint="in this order">
        <SectionBody className="p-4 sm:p-5">
          <ol aria-label="Migration steps, in order">
            {STEPS.map((job, index) => (
              <Step
                key={job}
                job={job}
                state={states[job]}
                busy={working}
                onRun={trigger}
                last={index === STEPS.length - 1}
                {...stepProps[job]}
              />
            ))}
          </ol>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Preview writes nothing — it reads both systems and reports what a run would do. Step history is kept until
            the API restarts.
          </p>
        </SectionBody>
      </Section>

      {connected ? (
        <ScopeSelector
          rows={showrooms}
          selectedIds={selectedWarehouseIds}
          onChange={setWarehouseScope}
          isLoading={showroomsQuery.isLoading}
          error={showroomsQuery.error}
          disabled={working}
          missingDefaults={showroomsQuery.data?.meta?.missingDefaultWarehouses || []}
        />
      ) : null}

      <RunPanel run={run} />

      {recentRuns.length > 1 ? (
        <Section title="Recent runs" hint="Kept until the API restarts">
          <SectionBody className="flex flex-wrap gap-2 p-4">
            {recentRuns.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActiveRunId(entry.id)}
                className={`rounded-md border px-3 py-1.5 text-left text-xs transition hover:bg-slate-50 ${
                  entry.id === followedId ? 'border-slate-900' : 'border-slate-200'
                }`}
              >
                <span className="font-semibold text-slate-700">
                  {JOBS[entry.job]?.label || entry.job} · {entry.mode}
                  {entry.scopeLabel ? <span className="font-normal text-slate-500"> · {entry.scopeLabel}</span> : null}
                </span>
                <span className="ml-2 text-slate-500">{new Date(entry.startedAt).toLocaleTimeString()}</span>
                <Pill tone={RUN_TONE[entry.status] || 'neutral'} className="ml-2">
                  {entry.status}
                </Pill>
              </button>
            ))}
          </SectionBody>
        </Section>
      ) : null}

      <Section
        title="What the selected showrooms hold"
        icon={FiSearch}
        actions={
          <Toolbar>
            {[
              { key: 'branches', label: 'Showrooms' },
              { key: 'products', label: 'Products' },
              { key: 'stock', label: 'Stock' }
            ].map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setTab(entry.key)}
                className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
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
                  aria-label="Search name or barcode"
                  className={`${fieldClass} h-8 !w-52 !py-1 !text-xs`}
                />
                <button type="submit" className="btn-ghost btn-sm" aria-label="Search">
                  <FiSearch size={13} />
                </button>
              </form>
            )}
          </Toolbar>
        }
      >
        {!connected ? (
          <SectionBody className="p-6 text-center text-sm text-slate-500">
            Connect to the old POS to browse what it holds.
          </SectionBody>
        ) : !scopeReady ? (
          <SectionBody className="p-6 text-center text-sm text-slate-500">
            Select at least one showroom above to browse its products and stock.
          </SectionBody>
        ) : (
          <>
            {tab === 'branches' ? (
              <BranchesTab rows={scopedShowrooms} isLoading={showroomsQuery.isLoading} error={showroomsQuery.error} />
            ) : null}
            {tab === 'products' ? <ProductsTab search={search} warehouseIds={selectedWarehouseIds} /> : null}
            {tab === 'stock' ? <StockTab search={search} warehouseIds={selectedWarehouseIds} /> : null}
          </>
        )}
      </Section>
    </div>
  );
}
