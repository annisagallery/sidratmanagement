'use client';

import { MdAdd, MdDeleteOutline, MdRestartAlt } from 'react-icons/md';

let nextDraftId = 0;
const field = 'input-ui !h-10 min-h-10 w-full';
const dropdown = 'select-ui !h-10 min-h-10 w-full';
const categoryOf = (material) => material?.categoryId || material?.category?.id || null;
const unitOf = (material) =>
  !material ? '' : material.unitMode === 'roll_meter' ? 'm' : material.unit?.name || 'units';
const choices = (materials, slot) =>
  materials.filter(
    (material) => material.isActive !== false && (!slot.categoryId || categoryOf(material) === slot.categoryId)
  );

function MaterialSelect({ label, value, materials, onChange, emptyLabel }) {
  return (
    <select
      className={dropdown}
      aria-label={label}
      value={value || ''}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">{emptyLabel}</option>
      {materials.map((material) => (
        <option key={material.id} value={material.id}>
          {material.name} ({material.code})
        </option>
      ))}
    </select>
  );
}

export function MaterialSlots({ slots, materials, categories, onChange, footer }) {
  const update = (index, patch) =>
    onChange(slots.map((slot, position) => (position === index ? { ...slot, ...patch } : slot)));
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Material slots</h2>
          <p className="mt-1 text-xs text-slate-500">
            Choose a category, then the default accessory. Units follow the accessory.
          </p>
        </div>
        <button
          className="btn-ghost min-h-11"
          type="button"
          onClick={() =>
            onChange([
              ...slots,
              {
                draftId: `new-slot-${++nextDraftId}`,
                name: '',
                categoryId: null,
                quantity: 1,
                wastagePercent: 0,
                accessoryId: null,
                note: ''
              }
            ])
          }
        >
          <MdAdd size={17} /> Add slot
        </button>
      </div>
      <div
        className="hidden grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(170px,1.4fr)_100px_80px_44px] gap-3 border-y border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 lg:grid"
        aria-hidden="true"
      >
        <span>Slot</span>
        <span>Category</span>
        <span>Default accessory</span>
        <span>Per piece</span>
        <span>Waste %</span>
        <span />
      </div>
      <div className="divide-y divide-slate-100">
        {!slots.length && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Add a slot such as main fabric, lining or buttons.
          </p>
        )}
        {slots.map((slot, index) => {
          const material = materials.find((row) => row.id === slot.accessoryId);
          return (
            <div
              key={slot.id || slot.draftId}
              className="grid items-end gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(170px,1.4fr)_100px_80px_44px]"
            >
              <label className="min-w-0">
                <span className="mb-1 block text-xs text-slate-500 lg:sr-only">Slot name</span>
                <input
                  className={field}
                  aria-label="Slot name"
                  maxLength={100}
                  value={slot.name}
                  placeholder="Main fabric"
                  onChange={(event) => update(index, { name: event.target.value })}
                />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-xs text-slate-500 lg:sr-only">Category</span>
                <select
                  className={dropdown}
                  aria-label={`Category for ${slot.name || 'slot'}`}
                  value={slot.categoryId || ''}
                  onChange={(event) =>
                    update(index, { categoryId: event.target.value || null, accessoryId: null, unitMode: undefined })
                  }
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-xs text-slate-500 lg:sr-only">Default accessory</span>
                <MaterialSelect
                  label={`Default accessory for ${slot.name || 'slot'}`}
                  value={slot.accessoryId}
                  materials={choices(materials, slot)}
                  onChange={(accessoryId) => {
                    const selected = materials.find((row) => row.id === accessoryId);
                    update(index, {
                      accessoryId,
                      ...(selected && { categoryId: categoryOf(selected), unitMode: selected.unitMode })
                    });
                  }}
                  emptyLabel="Choose by variation"
                />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-xs text-slate-500 lg:sr-only">Per piece</span>
                <div className="relative">
                  <input
                    type="number"
                    className={`${field} !pr-9`}
                    aria-label={`Amount per piece for ${slot.name || 'slot'}`}
                    min="0"
                    max="1000000"
                    step="0.001"
                    value={slot.quantity}
                    onChange={(event) => update(index, { quantity: event.target.value })}
                  />
                  <span className="pointer-events-none absolute right-2 top-3 text-[11px] text-slate-400">
                    {unitOf(material)}
                  </span>
                </div>
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-500 lg:sr-only">Waste %</span>
                <input
                  type="number"
                  className={field}
                  aria-label={`Waste percent for ${slot.name || 'slot'}`}
                  min="0"
                  max="100"
                  step="0.01"
                  value={slot.wastagePercent}
                  onChange={(event) => update(index, { wastagePercent: event.target.value })}
                />
              </label>
              <button
                className="btn-icon min-h-11 min-w-11 justify-self-end text-slate-400 hover:text-rose-700"
                type="button"
                aria-label={`Remove ${slot.name || 'slot'}`}
                onClick={() => onChange(slots.filter((_, position) => position !== index))}
              >
                <MdDeleteOutline size={18} />
              </button>
            </div>
          );
        })}
      </div>
      {footer && <div className="border-t border-slate-100 px-4 py-3">{footer}</div>}
    </section>
  );
}

export function VariationMaterialsTable({
  slots,
  variations,
  assignments,
  materials,
  categories,
  onChange,
  toolbar,
  footer,
  dirtyFor
}) {
  const update = (variationId, slot, patch) => {
    const rows = assignments[variationId] || [];
    const current = rows.find((row) => row.defaultRequirementId === slot.id) || {
      defaultRequirementId: slot.id,
      accessoryId: null,
      inheritQuantity: true,
      quantity: slot.quantity,
      wastagePercent: slot.wastagePercent,
      note: ''
    };
    const next = { ...current, ...patch };
    const others = rows.filter((row) => row.defaultRequirementId !== slot.id);
    onChange(variationId, next.accessoryId || !next.inheritQuantity ? [...others, next] : others);
  };
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {toolbar}
      {!slots.length ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Save a material slot above to assign accessories here.
        </p>
      ) : !variations.length ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">Add a product variation to assign accessories.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-44 border-r border-slate-200 bg-slate-50 px-4 py-3 font-medium"
                >
                  Variation
                </th>
                <th scope="col" className="w-44 px-4 py-3 font-medium">
                  Material slot
                </th>
                <th scope="col" className="min-w-60 px-4 py-3 font-medium">
                  Accessory
                </th>
                <th scope="col" className="w-36 px-4 py-3 font-medium">
                  Per piece
                </th>
                <th scope="col" className="w-24 px-4 py-3 font-medium">
                  Waste %
                </th>
                <th scope="col" className="w-16 px-3 py-3 font-medium">
                  <span className="sr-only">Reset</span>
                </th>
              </tr>
            </thead>
            {variations.map((variation) => (
              <tbody key={variation.id}>
                {slots.map((slot, index) => {
                  const rows = assignments[variation.id] || [];
                  const row = rows.find((entry) => entry.defaultRequirementId === slot.id);
                  const inherited = row?.inheritQuantity !== false;
                  const amount = inherited ? slot.quantity : row.quantity;
                  const waste = inherited ? slot.wastagePercent : row.wastagePercent;
                  const material = materials.find((entry) => entry.id === (row?.accessoryId || slot.accessoryId));
                  const valid =
                    material &&
                    material.isActive !== false &&
                    (!slot.categoryId || categoryOf(material) === slot.categoryId);
                  const missing = Number(amount) > 0 && !valid;
                  const options = choices(materials, slot);
                  if (row?.accessoryId && !options.some((entry) => entry.id === row.accessoryId))
                    options.push({ id: row.accessoryId, name: 'Previous accessory (unavailable)', code: '' });
                  const defaultMaterial = materials.find((entry) => entry.id === slot.accessoryId);
                  const label = variation.label + ', ' + slot.name;
                  return (
                    <tr
                      key={variation.id + '-' + slot.id}
                      className={index === 0 ? 'border-t border-slate-200' : 'border-t border-slate-100'}
                    >
                      {index === 0 && (
                        <th
                          scope="rowgroup"
                          rowSpan={slots.length}
                          className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-4 align-top font-medium text-slate-800"
                        >
                          {variation.label}
                          {dirtyFor(variation.id) && (
                            <span className="mt-1 block text-[11px] font-normal text-amber-700">Unsaved</span>
                          )}
                        </th>
                      )}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{slot.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {categories.find((category) => category.id === slot.categoryId)?.name || 'Accessories'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <MaterialSelect
                          label={'Accessory for ' + label}
                          value={row?.accessoryId}
                          materials={options}
                          emptyLabel={defaultMaterial ? 'Default: ' + defaultMaterial.name : 'Choose accessory'}
                          onChange={(accessoryId) => update(variation.id, slot, { accessoryId })}
                        />
                        {missing && <p className="mt-1 text-[11px] text-amber-700">Choose an accessory</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            className={field}
                            aria-label={'Quantity for ' + label}
                            type="number"
                            min="0"
                            max="1000000"
                            step="0.001"
                            value={amount}
                            onChange={(event) =>
                              update(variation.id, slot, {
                                inheritQuantity: false,
                                quantity: event.target.value,
                                wastagePercent: waste
                              })
                            }
                          />
                          <span className="shrink-0 text-xs text-slate-500">{unitOf(material)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={field}
                          aria-label={'Waste percent for ' + label}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={waste}
                          onChange={(event) =>
                            update(variation.id, slot, {
                              inheritQuantity: false,
                              quantity: amount,
                              wastagePercent: event.target.value
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="btn-icon min-h-11 min-w-11 text-slate-400 hover:text-slate-800 disabled:opacity-30"
                          disabled={!row}
                          aria-label={'Reset ' + label + ' to slot default'}
                          title="Reset to slot default"
                          onClick={() =>
                            onChange(
                              variation.id,
                              rows.filter((entry) => entry.defaultRequirementId !== slot.id)
                            )
                          }
                        >
                          <MdRestartAlt size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {footer && <div className="border-t border-slate-100 px-4 py-3">{footer}</div>}
    </section>
  );
}
