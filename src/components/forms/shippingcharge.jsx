'use client';

import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Form, FormikProvider, useFormik } from 'formik';
import { useMutation } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import * as Yup from 'yup';
import Swal from 'sweetalert2';
import {
  MdArrowBack,
  MdAutorenew,
  MdCheck,
  MdCheckCircleOutline,
  MdInfoOutline,
  MdLocationOn,
  MdMap,
  MdOutlineLocalShipping,
  MdPayments,
  MdSearch,
  MdTune
} from 'react-icons/md';

import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { districts, upazilasForDistrict } from 'src/utils/bangladeshAddress';

ShippingChargeForm.propTypes = {
  data: PropTypes.object,
  isLoading: PropTypes.bool
};

const STATUS_OPTIONS = [
  {
    value: 'active',
    label: 'Active',
    help: 'Checkout can use these rates immediately.',
    tone: 'emerald'
  },
  {
    value: 'inactive',
    label: 'Inactive',
    help: 'Save the rules without using them at checkout.',
    tone: 'slate'
  }
];

const inputClass =
  'min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] sm:text-sm';

const invalidClass = 'border-red-400 focus:border-red-500 focus:ring-red-200';

const locationKey = (district, upazila) => `${district}::${upazila}`;

const buildTargets = (values) =>
  values.districts.flatMap((district) => {
    const selectedUpazilas = district === 'ALL' ? ['ALL'] : values.upazilasByDistrict[district] || [];
    return selectedUpazilas.map((upazila) => ({ district, upazila }));
  });

async function runInBatches(items, task, batchSize = 5) {
  const results = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(task))));
  }
  return results;
}

function FieldError({ id, error, touched }) {
  if (!touched || !error) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-semibold text-red-700" role="alert">
      {error}
    </p>
  );
}

FieldError.propTypes = {
  id: PropTypes.string.isRequired,
  error: PropTypes.string,
  touched: PropTypes.bool
};

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <section className="card-ui overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand-strong)]">
          <Icon size={21} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

SectionCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
};

function SelectButton({ selected, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
        selected
          ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-slate-950'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      } ${className}`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          selected ? 'border-[var(--brand)] bg-[var(--brand)] text-white' : 'border-slate-300 bg-white'
        }`}
        aria-hidden="true"
      >
        {selected ? <MdCheck size={13} /> : null}
      </span>
      {children}
    </button>
  );
}

SelectButton.propTypes = {
  selected: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

function DistrictSelector({ selected, onChange, invalid }) {
  const [search, setSearch] = useState('');
  const visibleDistricts = useMemo(
    () => districts.filter((district) => district.toLowerCase().includes(search.trim().toLowerCase())),
    [search]
  );

  const toggleDistrict = (district) => {
    if (district === 'ALL') {
      onChange(selected.includes('ALL') ? [] : ['ALL']);
      return;
    }

    const withoutGlobal = selected.filter((value) => value !== 'ALL');
    onChange(
      withoutGlobal.includes(district)
        ? withoutGlobal.filter((value) => value !== district)
        : [...withoutGlobal, district]
    );
  };

  const allSelected = selected.length === districts.length && !selected.includes('ALL');

  return (
    <fieldset aria-describedby={invalid ? 'districts-error' : 'districts-help'}>
      <legend className="text-sm font-bold text-slate-900">
        District coverage <span className="text-red-600">*</span>
      </legend>
      <p id="districts-help" className="mt-1 text-xs leading-5 text-slate-500">
        Select one or more districts. The global fallback is exclusive and applies only when no specific rule matches.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <SelectButton selected={selected.includes('ALL')} onClick={() => toggleDistrict('ALL')}>
          <span>
            <span className="block">Any district</span>
            <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Global fallback rule</span>
          </span>
        </SelectButton>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : [...districts])}
          className="min-h-11 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
        >
          {allSelected ? 'Clear all districts' : 'Select all districts'}
        </button>
      </div>

      <div className="relative mt-3">
        <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a district..."
          className={`${inputClass} pl-9`}
          aria-label="Find a district"
        />
      </div>

      <div className={`mt-3 max-h-64 overflow-y-auto rounded-md border p-2 ${invalid ? 'border-red-400' : 'border-slate-200'}`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDistricts.map((district) => (
            <SelectButton key={district} selected={selected.includes(district)} onClick={() => toggleDistrict(district)}>
              <span className="truncate">{district}</span>
            </SelectButton>
          ))}
        </div>
        {!visibleDistricts.length ? (
          <p className="px-3 py-8 text-center text-sm text-slate-500">No district matches “{search}”.</p>
        ) : null}
      </div>
    </fieldset>
  );
}

DistrictSelector.propTypes = {
  selected: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  invalid: PropTypes.bool
};

function CoverageBuilder({ selectedDistricts, selections, onChange }) {
  const [searches, setSearches] = useState({});
  const [activeDistrict, setActiveDistrict] = useState('');

  if (!selectedDistricts.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
        <MdMap size={34} className="mx-auto text-slate-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-bold text-slate-700">Choose a district first</p>
        <p className="mt-1 text-xs text-slate-500">Its available upazilas and thanas will appear here.</p>
      </div>
    );
  }

  if (selectedDistricts.includes('ALL')) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] p-4">
        <MdLocationOn size={22} className="mt-0.5 shrink-0 text-[var(--brand-strong)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-slate-900">Any district · Any upazila</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            This is the global fallback. Checkout uses it only when there is no exact or district-wide match.
          </p>
        </div>
      </div>
    );
  }

  const district = selectedDistricts.includes(activeDistrict) ? activeDistrict : selectedDistricts[0];
  const available = upazilasForDistrict(district);
  const selectedAreas = selections[district] || ['ALL'];
  const search = searches[district] || '';
  const visibleAreas = available.filter((area) => area.toLowerCase().includes(search.trim().toLowerCase()));
  const isDistrictWide = selectedAreas.includes('ALL');
  const everyAreaSelected = available.length > 0 && selectedAreas.length === available.length;

  const toggleArea = (area) => {
    if (area === 'ALL') {
      onChange(district, ['ALL']);
      return;
    }
    const specificAreas = selectedAreas.filter((value) => value !== 'ALL');
    const next = specificAreas.includes(area)
      ? specificAreas.filter((value) => value !== area)
      : [...specificAreas, area];
    onChange(district, next.length ? next : ['ALL']);
  };

  return (
    <div className="space-y-3">
      {selectedDistricts.length > 1 ? (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">Choose a district to configure its areas</p>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
            {selectedDistricts.map((selectedDistrict) => {
              const districtAreas = selections[selectedDistrict] || ['ALL'];
              const selected = selectedDistrict === district;
              return (
                <button
                  key={selectedDistrict}
                  type="button"
                  onClick={() => setActiveDistrict(selectedDistrict)}
                  aria-pressed={selected}
                  className={`min-h-10 rounded-md border px-2.5 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
                    selected
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="block">{selectedDistrict}</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                    {districtAreas.includes('ALL') ? 'Any upazila' : `${districtAreas.length} selected`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <MdLocationOn size={18} className="text-[var(--brand-strong)]" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">{district}</h3>
              <p className="text-[11px] text-slate-500">
                {isDistrictWide ? 'District-wide rate' : `${selectedAreas.length} specific area${selectedAreas.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange(district, ['ALL'])}
              className={`min-h-10 rounded-md border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
                isDistrictWide
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Any upazila
            </button>
            <button
              type="button"
              onClick={() => onChange(district, everyAreaSelected ? ['ALL'] : available)}
              className="min-h-10 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            >
              {everyAreaSelected ? 'Use district-wide' : 'Select every area'}
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className="relative">
            <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearches((current) => ({ ...current, [district]: event.target.value }))}
              placeholder={`Find an area in ${district}...`}
              className={`${inputClass} pl-9`}
              aria-label={`Find an upazila or thana in ${district}`}
            />
          </div>
          <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAreas.map((area) => (
              <SelectButton key={area} selected={!isDistrictWide && selectedAreas.includes(area)} onClick={() => toggleArea(area)}>
                <span className="truncate">{area}</span>
              </SelectButton>
            ))}
          </div>
          {!visibleAreas.length ? (
            <p className="py-6 text-center text-xs text-slate-500">No upazila or thana matches “{search}”.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

CoverageBuilder.propTypes = {
  selectedDistricts: PropTypes.arrayOf(PropTypes.string).isRequired,
  selections: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  onChange: PropTypes.func.isRequired
};

function StatusPicker({ value, onChange }) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-slate-900">Rule status</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {STATUS_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-h-[76px] items-start gap-3 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
                selected
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <MdCheckCircleOutline
                size={21}
                className={selected ? 'text-[var(--brand-strong)]' : 'text-slate-400'}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{option.help}</span>
              </span>
              {selected ? <MdCheck size={18} className="shrink-0 text-[var(--brand-strong)]" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

StatusPicker.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};

function RulePreview({ targets, charge, status, editing }) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Shipping rule preview">
      <section className="card-ui overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-900 px-4 py-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">Coverage manifest</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black tabular-nums">{targets.length}</p>
              <p className="mt-0.5 text-xs text-slate-300">rule{targets.length === 1 ? '' : 's'} ready</p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-bold ${status === 'active' ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-600 text-white'}`}>
              {status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-4 rounded-md bg-[var(--brand-soft)] px-3 py-3">
            <span className="text-xs font-semibold text-slate-600">Charge per matching order</span>
            <span className="text-lg font-black tabular-nums text-slate-950">
              BDT {charge === '' || Number.isNaN(Number(charge)) ? '—' : Number(charge).toLocaleString('en-BD')}
            </span>
          </div>

          <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {targets.map((target, index) => (
              <div key={locationKey(target.district, target.upazila)} className="flex items-start gap-2 rounded-md border border-slate-200 px-2.5 py-2">
                <span className="flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                  {index + 1}
                </span>
                <p className="min-w-0 text-xs leading-5 text-slate-700">
                  <span className="font-bold text-slate-900">{target.district === 'ALL' ? 'Any district' : target.district}</span>
                  <span className="mx-1.5 text-slate-300">→</span>
                  {target.upazila === 'ALL' ? 'Any upazila' : target.upazila}
                </p>
              </div>
            ))}
            {!targets.length ? (
              <div className="rounded-md border border-dashed border-slate-300 px-3 py-8 text-center text-xs text-slate-500">
                Selected coverage will appear here.
              </div>
            ) : null}
          </div>

          {editing && targets.length ? (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800">
              The current rule will be updated. {targets.length > 1 ? `${targets.length - 1} additional rule${targets.length === 2 ? '' : 's'} will be created.` : 'No additional rule will be created.'}
            </div>
          ) : null}
        </div>
      </section>

      <section className="card-ui p-4">
        <div className="flex items-start gap-2.5">
          <MdInfoOutline size={19} className="mt-0.5 shrink-0 text-[var(--brand-strong)]" aria-hidden="true" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Checkout priority</h2>
            <ol className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
              <li><span className="font-bold text-slate-700">1.</span> Exact district and upazila</li>
              <li><span className="font-bold text-slate-700">2.</span> District-wide rule</li>
              <li><span className="font-bold text-slate-700">3.</span> Global fallback</li>
            </ol>
          </div>
        </div>
      </section>
    </aside>
  );
}

RulePreview.propTypes = {
  targets: PropTypes.arrayOf(
    PropTypes.shape({ district: PropTypes.string.isRequired, upazila: PropTypes.string.isRequired })
  ).isRequired,
  charge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  status: PropTypes.string.isRequired,
  editing: PropTypes.bool.isRequired
};

export default function ShippingChargeForm({ data: currentCharge, isLoading: pageLoading = false }) {
  const router = useRouter();
  const editing = Boolean(currentCharge);
  const initialDistrict = currentCharge?.district || currentCharge?.city_name || '';
  const initialUpazila = currentCharge?.upazila || currentCharge?.zone_name || '';

  const validationSchema = Yup.object().shape({
    districts: Yup.array().of(Yup.string()).min(1, 'Select at least one district.'),
    upazilasByDistrict: Yup.object().test(
      'area-coverage',
      'Choose at least one upazila for every selected district.',
      (value, context) =>
        context.parent.districts.every(
          (district) => district === 'ALL' || (Array.isArray(value?.[district]) && value[district].length > 0)
        )
    ),
    charge: Yup.number()
      .typeError('Enter a valid shipping charge.')
      .required('Shipping charge is required.')
      .min(0, 'Charge must be 0 or higher.'),
    status: Yup.string().oneOf(STATUS_OPTIONS.map((option) => option.value)).required('Status is required.')
  });

  const { mutate, isLoading: isSubmitting } = useMutation(
    editing ? 'update-shipping-charge' : 'new-shipping-charge',
    async (values) => {
      const targets = buildTargets(values);
      const existingResponse = await api.getAllShippingCharges('page=1&limit=1000');
      const existingKeys = new Set(
        (existingResponse?.data || [])
          .filter((rule) => !editing || rule.id !== currentCharge.id)
          .map((rule) => locationKey(rule.district || rule.city_name, rule.upazila || rule.zone_name))
      );
      const conflicts = targets.filter((target) => existingKeys.has(locationKey(target.district, target.upazila)));

      if (conflicts.length) {
        const preview = conflicts
          .slice(0, 3)
          .map((target) => `${target.district} / ${target.upazila}`)
          .join(', ');
        throw new Error(
          `${conflicts.length} selected rule${conflicts.length === 1 ? '' : 's'} already exist${conflicts.length === 1 ? 's' : ''}: ${preview}${conflicts.length > 3 ? '…' : ''}. Remove those locations and try again.`
        );
      }

      const shared = { charge: Number(values.charge), status: values.status };

      if (editing) {
        const originalKey = locationKey(initialDistrict, initialUpazila);
        const originalIndex = targets.findIndex((target) => locationKey(target.district, target.upazila) === originalKey);
        const orderedTargets = [...targets];
        if (originalIndex > 0) {
          const [original] = orderedTargets.splice(originalIndex, 1);
          orderedTargets.unshift(original);
        }
        const [primary, ...additional] = orderedTargets;

        await api.updateShippingChargeByAdmin({ id: currentCharge.id, ...primary, ...shared });
        await runInBatches(additional, (target) => api.addShippingChargeByAdmin({ ...target, ...shared }));
        return {
          message:
            additional.length > 0
              ? `Shipping rule updated and ${additional.length} additional rule${additional.length === 1 ? '' : 's'} created.`
              : 'Shipping rule updated successfully.'
        };
      }

      await runInBatches(targets, (target) => api.addShippingChargeByAdmin({ ...target, ...shared }));
      return {
        message: `${targets.length} shipping rule${targets.length === 1 ? '' : 's'} created successfully.`
      };
    },
    {
      retry: false,
      onSuccess: (result) => {
        Swal.fire(result.message, '', 'success');
        router.push('/shippingcharge');
      },
      onError: (error) => {
        Swal.fire(
          error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to save shipping charge.',
          '',
          'error'
        );
      }
    }
  );

  const formik = useFormik({
    initialValues: {
      districts: initialDistrict ? [initialDistrict] : [],
      upazilasByDistrict: initialDistrict ? { [initialDistrict]: [initialUpazila || 'ALL'] } : {},
      charge: currentCharge?.charge ?? '',
      status: currentCharge?.status === 'deactive' ? 'inactive' : currentCharge?.status || STATUS_OPTIONS[0].value
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: (values) => mutate(values)
  });

  const { errors, touched, handleSubmit, setFieldTouched, setFieldValue, values, getFieldProps } = formik;
  const targets = useMemo(() => buildTargets(values), [values]);

  const handleDistrictsChange = (nextDistricts) => {
    const nextSelections = {};
    nextDistricts.forEach((district) => {
      nextSelections[district] = values.upazilasByDistrict[district] || ['ALL'];
    });
    setFieldValue('districts', nextDistricts);
    setFieldValue('upazilasByDistrict', nextSelections);
    setFieldTouched('districts', true, false);
  };

  if (pageLoading && !currentCharge) {
    return (
      <div className="space-y-4" aria-label="Loading shipping charge">
        <div className="h-12 animate-pulse rounded-md bg-slate-100" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[520px] animate-pulse rounded-md bg-slate-100" />
          <div className="h-80 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={editing ? 'Edit Shipping Charge' : 'Add Shipping Charges'}
        subtitle={
          editing
            ? 'Update this rule or extend the same rate to more delivery areas.'
            : 'Build one or many district and upazila rules with a shared rate.'
        }
        icon={MdOutlineLocalShipping}
      >
        <button type="button" onClick={() => router.push('/shippingcharge')} className="btn-ghost">
          <MdArrowBack size={18} aria-hidden="true" /> Back to charges
        </button>
      </PageHeader>

      <FormikProvider value={formik}>
        <Form onSubmit={handleSubmit} noValidate>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <SectionCard
                icon={MdMap}
                title="1. Choose districts"
                description="Select a single district, several districts, or the global fallback."
              >
                <DistrictSelector
                  selected={values.districts}
                  onChange={handleDistrictsChange}
                  invalid={Boolean(touched.districts && errors.districts)}
                />
                <FieldError id="districts-error" error={errors.districts} touched={touched.districts} />
              </SectionCard>

              <SectionCard
                icon={MdLocationOn}
                title="2. Choose upazilas"
                description="Use one district-wide rate or select several specific upazilas and thanas per district."
              >
                <CoverageBuilder
                  selectedDistricts={values.districts}
                  selections={values.upazilasByDistrict}
                  onChange={(district, areas) => {
                    setFieldValue(`upazilasByDistrict.${district}`, areas);
                    setFieldTouched('upazilasByDistrict', true, false);
                  }}
                />
                <FieldError
                  id="coverage-error"
                  error={typeof errors.upazilasByDistrict === 'string' ? errors.upazilasByDistrict : undefined}
                  touched={touched.upazilasByDistrict}
                />
              </SectionCard>

              <SectionCard
                icon={MdPayments}
                title="3. Set rate and status"
                description="The same charge and status will be applied to every rule in this batch."
              >
                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div>
                    <label htmlFor="charge" className="text-sm font-bold text-slate-900">
                      Shipping charge <span className="text-red-600">*</span>
                    </label>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                        BDT
                      </span>
                      <input
                        id="charge"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="decimal"
                        placeholder="150"
                        aria-invalid={Boolean(touched.charge && errors.charge)}
                        aria-describedby={touched.charge && errors.charge ? 'charge-error' : 'charge-help'}
                        className={`${inputClass} pl-14 ${touched.charge && errors.charge ? invalidClass : ''}`}
                        {...getFieldProps('charge')}
                      />
                    </div>
                    <p id="charge-help" className="mt-1.5 text-xs leading-5 text-slate-500">
                      Enter 0 to make these matching locations free.
                    </p>
                    <FieldError id="charge-error" error={errors.charge} touched={touched.charge} />
                  </div>

                  <StatusPicker value={values.status} onChange={(status) => setFieldValue('status', status)} />
                </div>
              </SectionCard>

              <div className="card-ui flex flex-col-reverse gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => router.push('/shippingcharge')} className="btn-ghost min-h-11">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || pageLoading || targets.length === 0}
                  className="btn-brand min-h-11 min-w-[190px]"
                >
                  {isSubmitting ? (
                    <>
                      <MdAutorenew className="animate-spin" size={18} aria-hidden="true" /> Saving rules...
                    </>
                  ) : (
                    <>
                      <MdTune size={18} aria-hidden="true" />
                      {editing ? 'Update coverage' : `Create ${targets.length || ''} rule${targets.length === 1 ? '' : 's'}`}
                    </>
                  )}
                </button>
              </div>
            </div>

            <RulePreview targets={targets} charge={values.charge} status={values.status} editing={editing} />
          </div>
        </Form>
      </FormikProvider>
    </div>
  );
}
