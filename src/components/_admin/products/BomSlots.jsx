'use client';

import { MdAdd, MdDeleteOutline } from 'react-icons/md';

let nextDraftId = 0;
const amountUnit = (slot) => slot.unitMode === 'roll_meter' ? 'm' : 'units';
const compatibleMaterials = (materials, slot) => materials.filter((material) => material.unitMode === slot.unitMode && material.isActive !== false);

function MaterialSelect({ label, value, materials, onChange, emptyLabel }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-800">{label}</span>
      <select className="select-ui min-h-11 w-full" value={value || ''} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{emptyLabel}</option>
        {materials.map((material) => <option key={material.id} value={material.id}>{material.name} · {material.code}</option>)}
      </select>
    </label>
  );
}

export function DefaultSlots({ slots, materials, onChange }) {
  const update = (index, patch) => onChange(slots.map((slot, position) => position === index ? { ...slot, ...patch } : slot));
  return (
    <section className="card-ui overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Material slots</h2>
        <p className="mt-1 text-xs text-slate-500">Define what each piece needs. Choose the actual fabric or accessory here, or assign it by variation.</p>
      </div>
      <div className="space-y-3 p-4">
        {!slots.length && <p className="text-sm text-slate-500">Add Main fabric, Collar fabric, Zipper or another named slot.</p>}
        {slots.map((slot, index) => (
          <div key={slot.id || slot.draftId} className="rounded-md border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_110px_110px_100px_1.4fr_44px] xl:items-end">
              <label className="min-w-0"><span className="mb-1.5 block text-[13px] font-medium text-slate-800">Slot name</span><input className="input-ui min-h-11 w-full" maxLength={100} value={slot.name} placeholder="Main fabric" onChange={(event) => update(index, { name: event.target.value })} /></label>
              <label><span className="mb-1.5 block text-[13px] font-medium text-slate-800">Unit</span><select className="select-ui min-h-11 w-full" value={slot.unitMode} onChange={(event) => update(index, { unitMode: event.target.value, accessoryId: null })}><option value="roll_meter">Metres</option><option value="single">Units</option></select></label>
              <label><span className="mb-1.5 block text-[13px] font-medium text-slate-800">Amount per piece</span><input type="number" className="input-ui min-h-11 w-full" min="0.001" max="1000000" step="0.001" value={slot.quantity} onChange={(event) => update(index, { quantity: event.target.value })} /></label>
              <label><span className="mb-1.5 block text-[13px] font-medium text-slate-800">Waste %</span><input type="number" className="input-ui min-h-11 w-full" min="0" max="100" step="0.1" value={slot.wastagePercent} onChange={(event) => update(index, { wastagePercent: event.target.value })} /></label>
              <MaterialSelect label="Default material (optional)" value={slot.accessoryId} materials={compatibleMaterials(materials, slot)} onChange={(accessoryId) => update(index, { accessoryId })} emptyLabel="Assign by variation" />
              <button className="btn-icon min-h-11 min-w-11 text-rose-700" type="button" aria-label={`Remove ${slot.name || 'material slot'}`} onClick={() => onChange(slots.filter((_, position) => position !== index))}><MdDeleteOutline size={18} /></button>
            </div>
          </div>
        ))}
        <button className="btn-ghost min-h-11" type="button" onClick={() => onChange([...slots, { draftId: `new-slot-${++nextDraftId}`, name: '', unitMode: 'roll_meter', quantity: 1, wastagePercent: 0, accessoryId: null, note: '' }])}><MdAdd size={18} /> Add material slot</button>
      </div>
    </section>
  );
}

export function VariationSlots({ slots, assignments, materials, onChange }) {
  const update = (slot, patch) => {
    const current = assignments.find((assignment) => assignment.defaultRequirementId === slot.id) || { defaultRequirementId: slot.id, accessoryId: null, inheritQuantity: true, quantity: slot.quantity, wastagePercent: slot.wastagePercent, note: '' };
    const next = { ...current, ...patch };
    const others = assignments.filter((assignment) => assignment.defaultRequirementId !== slot.id);
    onChange(next.accessoryId || !next.inheritQuantity ? [...others, next] : others);
  };
  return (
    <section className="card-ui overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Material assignments</h2><p className="mt-1 text-xs text-slate-500">Use Defaults, or choose another material and adjust the amount for this variation.</p></div>
      <div className="space-y-3 p-4">
        {!slots.length && <p className="text-sm text-slate-500">Add and save material slots in Defaults first.</p>}
        {slots.map((slot) => {
          const assignment = assignments.find((row) => row.defaultRequirementId === slot.id);
          const materialId = assignment?.accessoryId || slot.accessoryId;
          const material = materials.find((row) => row.id === materialId);
          const unassigned = !material || material.unitMode !== slot.unitMode || material.isActive === false;
          const inheritedAmount = assignment?.inheritQuantity !== false;
          const selectedMaterials = compatibleMaterials(materials, slot);
          if (assignment?.accessoryId && !selectedMaterials.some((row) => row.id === assignment.accessoryId)) selectedMaterials.push({ id: assignment.accessoryId, name: 'Previous assignment (unit changed)', code: '' });
          const defaultMaterial = materials.find((row) => row.id === slot.accessoryId);
          return (
            <div key={slot.id} className="rounded-md border border-slate-200 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{slot.name}</p><span className={unassigned ? 'text-xs font-medium text-amber-700' : 'text-xs text-slate-500'}>{unassigned ? 'Material required before taking production orders' : `Default amount: ${slot.quantity} ${amountUnit(slot)}`}</span></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_110px_100px] xl:items-end">
                <MaterialSelect label="Material" value={assignment?.accessoryId} materials={selectedMaterials} emptyLabel={defaultMaterial ? `Use Defaults · ${defaultMaterial.name}` : 'Choose material'} onChange={(accessoryId) => update(slot, { accessoryId })} />
                <label><span className="mb-1.5 block text-[13px] font-medium text-slate-800">Amount</span><select className="select-ui min-h-11 w-full" value={inheritedAmount ? 'default' : 'adjust'} onChange={(event) => update(slot, { inheritQuantity: event.target.value === 'default', quantity: slot.quantity, wastagePercent: slot.wastagePercent })}><option value="default">Use Defaults</option><option value="adjust">Adjust for this variation</option></select></label>
                <label><span className="mb-1.5 block text-[13px] font-medium text-slate-800">Per piece ({amountUnit(slot)})</span><input className="input-ui min-h-11 w-full" type="number" min="0.001" max="1000000" step="0.001" disabled={inheritedAmount} value={inheritedAmount ? slot.quantity : assignment.quantity} onChange={(event) => update(slot, { quantity: event.target.value })} /></label>
                <label><span className="mb-1.5 block text-[13px] font-medium text-slate-800">Waste %</span><input className="input-ui min-h-11 w-full" type="number" min="0" max="100" step="0.1" disabled={inheritedAmount} value={inheritedAmount ? slot.wastagePercent : assignment.wastagePercent} onChange={(event) => update(slot, { wastagePercent: event.target.value })} /></label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
