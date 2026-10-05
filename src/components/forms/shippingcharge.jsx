'use client';

import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Form, FormikProvider, useFormik } from 'formik';
import { useMutation } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import * as Yup from 'yup';
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
import { areaLabel } from 'src/components/_admin/shippingcharge/areas';
import { toastSuccess, alertError } from 'src/utils/swal';

ShippingChargeForm.propTypes = {
  /** A shipping zone: { id, name, charge, status, areas: [{ district, upazila }] }. */
  data: PropTypes.object,
  isLoading: PropTypes.bool
};

const STATUS_OPTIONS = [
  {
    value: 'active',
    label: 'Active',
    help: 'Checkout charges this zone immediately.',
    tone: 'emerald'
  },
  {
    value: 'inactive',
    label: 'Inactive',
    help: 'Keep the zone and its areas without charging it at checkout.',
    tone: 'slate'
  }
];

const inputClass =
  'input-ui min-h-11 w-full sm:text-sm';

const invalidClass = 'border-rose-400 focus:border-rose-500 focus:ring-rose-200';

const locationKey = (district, upazila) => `${district}::${upazila}`;

const buildTargets = (values) =>
  values.districts.flatMap((district) => {
    const selectedUpazilas = district === 'ALL' ? ['ALL'] : values.upazilasByDistrict[district] || [];
    return selectedUpazilas.map((upazila) => ({ district, upazila }));
  });

function FieldError({ id, error, touched }) {
  if (!touched || !error) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-semibold text-rose-700" role="alert">
      {error}
    </p>
  );
}

FieldError.propTypes = {
  id: PropTypes.string.isRequired,
  error: PropTypes.string,
  touched: PropTypes.bool
};

function SectionCard({ title, description, children }) {
  return (
    <section className="card-ui">
      <div className="px-5 pt-5">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

SectionCard.propTypes = {
  icon: PropTypes.elementType,
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
          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 text-slate-950'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      } ${className}`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'
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
      <legend className="text-sm font-semibold text-slate-900">
        District coverage <span className="text-rose-700">*</span>
      </legend>
      <p id="districts-help" className="mt-1 text-xs leading-5 text-slate-500">
        Select one or more districts. "Any district" is the fallback: checkout uses it only where no other zone covers the address.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <SelectButton selected={selected.includes('ALL')} onClick={() => toggleDistrict('ALL')}>
          <span>
            <span className="block">Any district</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">Fallback for every other area</span>
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
        <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a district..."
          className={`${inputClass} pl-9`}
          aria-label="Find a district"
        />
      </div>

      <div className={`mt-3 max-h-64 overflow-y-auto rounded-md border p-2 ${invalid ? 'border-rose-400' : 'border-slate-200'}`}>
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
        <p className="mt-3 text-sm font-semibold text-slate-700">Choose a district first</p>
        <p className="mt-1 text-xs text-slate-500">Its available upazilas and thanas will appear here.</p>
      </div>
    );
  }

  if (selectedDistricts.includes('ALL')) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-slate-900 bg-slate-50 ring-1 ring-slate-900 p-4">
        <MdLocationOn size={22} className="mt-0.5 shrink-0 text-[var(--brand-strong)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Any district · Any upazila</p>
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
                      ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="block">{selectedDistrict}</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">
                    {districtAreas.includes('ALL') ? 'Any upazila' : `${districtAreas.length} selected`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <MdLocationOn size={18} className="text-[var(--brand-strong)]" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{district}</h3>
              <p className="text-xs text-slate-500">
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
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 text-[var(--brand-strong)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Any upazila
            </button>
            <button
              type="button"
              onClick={() => onChange(district, everyAreaSelected ? ['ALL'] : available)}
              className="btn-ghost btn-sm min-h-10"
            >
              {everyAreaSelected ? 'Use district-wide' : 'Select every area'}
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className="relative">
            <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
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
      <legend className="text-sm font-semibold text-slate-900">Zone status</legend>
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
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <MdCheckCircleOutline
                size={21}
                className={selected ? 'text-[var(--brand-strong)]' : 'text-slate-500'}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
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

function ZonePreview({ name, targets, charge, status }) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Shipping zone preview">
      <section className="card-ui overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-900 px-4 py-4 text-white">
          <p className="section-label">{name?.trim() || 'New zone'}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{targets.length}</p>
              <p className="mt-0.5 text-xs text-slate-400">area{targets.length === 1 ? '' : 's'} in this zone</p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status === 'active' ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-600 text-white'}`}>
              {status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-4 rounded-md bg-[var(--brand-soft)] px-3 py-3">
            <span className="text-xs font-semibold text-slate-600">Charge per matching order</span>
            <span className="text-lg font-semibold tabular-nums text-slate-950">
              BDT {charge === '' || Number.isNaN(Number(charge)) ? '—' : Number(charge).toLocaleString('en-BD')}
            </span>
          </div>

          <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {targets.map((target, index) => (
              <div key={locationKey(target.district, target.upazila)} className="flex items-start gap-2 rounded-md border border-slate-200 px-2.5 py-2">
                <span className="flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-500">
                  {index + 1}
                </span>
                <p className="min-w-0 text-xs leading-5 text-slate-700">{areaLabel(target)}</p>
              </div>
            ))}
            {!targets.length ? (
              <div className="rounded-md border border-dashed border-slate-300 px-3 py-8 text-center text-xs text-slate-500">
                Selected coverage will appear here.
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            One charge and status for every area here. Change them once and the whole zone follows.
          </p>
        </div>
      </section>

      <section className="card-ui p-4">
        <div className="flex items-start gap-2.5">
          <MdInfoOutline size={19} className="mt-0.5 shrink-0 text-[var(--brand-strong)]" aria-hidden="true" />
          <div>
            <h2 className="section-label">Checkout priority</h2>
            <ol className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
              <li><span className="font-semibold text-slate-700">1.</span> The zone holding the exact upazila</li>
              <li><span className="font-semibold text-slate-700">2.</span> The zone holding the whole district</li>
              <li><span className="font-semibold text-slate-700">3.</span> The any-district zone</li>
            </ol>
          </div>
        </div>
      </section>
    </aside>
  );
}

ZonePreview.propTypes = {
  name: PropTypes.string,
  targets: PropTypes.arrayOf(
    PropTypes.shape({ district: PropTypes.string.isRequired, upazila: PropTypes.string.isRequired })
  ).isRequired,
  charge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  status: PropTypes.string.isRequired
};

// The zone's areas as the coverage pickers hold them: districts in order, and
// per district either ['ALL'] or its chosen upazilas.
function coverageOf(areas = []) {
  const districtsInZone = [];
  const upazilasByDistrict = {};
  areas.forEach(({ district, upazila }) => {
    if (!upazilasByDistrict[district]) {
      districtsInZone.push(district);
      upazilasByDistrict[district] = [];
    }
    upazilasByDistrict[district].push(upazila);
  });
  return { districts: districtsInZone, upazilasByDistrict };
}

export default function ShippingChargeForm({ data: zone, isLoading: pageLoading = false }) {
  const router = useRouter();
  const editing = Boolean(zone);
  const initialCoverage = useMemo(() => coverageOf(zone?.areas), [zone]);

  const validationSchema = Yup.object().shape({
    name: Yup.string().trim().required('Give the zone a name.'),
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

  // One request for the whole zone. The server refuses areas another zone
  // holds and names that zone, so nothing is half-saved.
  const { mutate, isLoading: isSubmitting } = useMutation(
    editing ? 'update-shipping-zone' : 'new-shipping-zone',
    (values) => {
      const payload = {
        name: values.name.trim(),
        charge: Number(values.charge),
        status: values.status,
        areas: buildTargets(values)
      };
      return editing ? api.updateShippingZone({ id: zone.id, ...payload }) : api.addShippingZone(payload);
    },
    {
      retry: false,
      onSuccess: () => {
        toastSuccess(editing ? 'Shipping zone updated' : 'Shipping zone created');
        router.push('/shippingcharge');
      },
      onError: (error) => {
        const conflicts = error?.response?.data?.conflicts;
        alertError(error, {
          title: 'The shipping zone was not saved',
          ...(conflicts?.length && {
            text: 'These areas already belong to another zone. Remove them here, or take them out of that zone first.',
            items: conflicts.map((c) => `${areaLabel(c)} — in ${c.zone}`)
          })
        });
      }
    }
  );

  const formik = useFormik({
    initialValues: {
      name: zone?.name || '',
      districts: initialCoverage.districts,
      upazilasByDistrict: initialCoverage.upazilasByDistrict,
      charge: zone?.charge ?? '',
      status: zone?.status === 'active' || !zone ? 'active' : 'inactive'
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

  if (pageLoading && !zone) {
    return (
      <div className="space-y-4" aria-label="Loading shipping zone">
        <div className="h-12 animate-pulse rounded-md bg-slate-100" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[520px] animate-pulse rounded-md bg-slate-100" />
          <div className="h-80 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={editing ? 'Edit Shipping Zone' : 'Add Shipping Zone'}
        subtitle={
          editing
            ? 'Change the charge, status or areas once — every area in the zone follows.'
            : 'One charge and status for a set of districts and upazilas.'
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
                title="3. Name, charge and status"
                description="Every area in the zone uses this charge and status."
              >
                <div className="mb-5">
                  <label htmlFor="zone-name" className="mb-1.5 block text-[13px] font-medium text-slate-800">
                    Zone name <span className="text-rose-700">*</span>
                  </label>
                  <input
                    id="zone-name"
                    type="text"
                    placeholder="e.g. Inside Dhaka"
                    aria-invalid={Boolean(touched.name && errors.name)}
                    aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
                    className={`${inputClass} ${touched.name && errors.name ? invalidClass : ''}`}
                    {...getFieldProps('name')}
                  />
                  <FieldError id="name-error" error={errors.name} touched={touched.name} />
                </div>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div>
                    <label htmlFor="charge" className="block text-slate-900 mb-1.5 text-[13px] font-medium text-slate-800">
                      Shipping charge <span className="text-rose-700">*</span>
                    </label>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
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
                      Enter 0 to make delivery to this zone free.
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
                      <MdAutorenew className="animate-spin" size={18} aria-hidden="true" /> Saving zone...
                    </>
                  ) : (
                    <>
                      <MdTune size={18} aria-hidden="true" />
                      {editing ? 'Save zone' : 'Create zone'}
                    </>
                  )}
                </button>
              </div>
            </div>

            <ZonePreview name={values.name} targets={targets} charge={values.charge} status={values.status} />
          </div>
        </Form>
      </FormikProvider>
    </div>
  );
}
