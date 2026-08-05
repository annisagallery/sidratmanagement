'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import PropTypes from 'prop-types';
import { useRouter } from 'next/navigation';
import { Form, FormikProvider, useFormik } from 'formik';
import { useMutation } from 'react-query';
import { useDropzone } from 'react-dropzone';
import * as Yup from 'yup';
import Swal from 'sweetalert2';
import {
  MdArrowBack,
  MdAutorenew,
  MdCategory,
  MdCheck,
  MdCheckCircleOutline,
  MdCloudUpload,
  MdDeleteOutline,
  MdDescription,
  MdImage,
  MdLink,
  MdPauseCircleOutline,
  MdSearch,
  MdStorefront,
  MdVisibility,
  MdVisibilityOff
} from 'react-icons/md';
import * as api from 'src/services';
import RichTextEditor from 'src/components/richTextEditor';
import PageHeader from 'src/components/_admin/ui/PageHeader';

CategoryForm.propTypes = {
  data: PropTypes.object,
  isLoading: PropTypes.bool
};

const STATUS_OPTIONS = [
  {
    value: 'active',
    label: 'Active',
    help: 'Available to staff and ready for use.',
    icon: MdCheckCircleOutline
  },
  {
    value: 'inactive',
    label: 'Inactive',
    help: 'Kept in the catalogue but not available for new use.',
    icon: MdPauseCircleOutline
  }
];

const fieldClass =
  'min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] sm:text-sm';

const errorFieldClass = 'border-red-400 focus:border-red-500 focus:ring-red-200';

const stripHtml = (value = '') =>
  String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function FieldError({ id, error, touched }) {
  if (!touched || !error) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-red-700" role="alert">
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
      <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand-strong)]">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

SectionCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
};

function CategoryImageUploader({ file, name, invalid, onChange, onTouched }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const image = acceptedFiles[0];
      if (!image) return;

      const formData = new FormData();
      formData.append('file', image);
      formData.append('model', 'Category');
      setUploading(true);
      setProgress(0);

      try {
        const uploaded = await api.uploadImage(formData, {
          onUploadProgress: (event) => {
            if (!event.total) return;
            setProgress(Math.round((event.loaded * 100) / event.total));
          }
        });
        onChange(uploaded);
        onTouched();
      } catch (error) {
        Swal.fire('Could not upload image', error?.message || 'Choose another image and try again.', 'error');
      } finally {
        setUploading(false);
      }
    },
    [onChange, onTouched]
  );

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    multiple: false,
    disabled: uploading,
    onDrop
  });

  if (file) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100">
        <Image
          fill
          src={file}
          alt={name ? `${name} category` : 'Category image preview'}
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 280px"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-slate-950/70 p-3 text-white">
          <span className="text-xs font-semibold">Category artwork</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onTouched();
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Remove category image"
          >
            <MdDeleteOutline size={21} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      aria-invalid={invalid}
      aria-describedby={invalid ? 'category-image-error' : undefined}
      className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 text-center transition focus-within:ring-2 focus-within:ring-[var(--brand-ring)] ${
        isDragActive
          ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
          : 'border-slate-300 bg-slate-50 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]'
      } ${uploading ? 'cursor-wait opacity-70' : ''}`}
    >
      <input {...getInputProps()} aria-label="Upload category image" />
      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-[var(--brand-strong)] shadow-sm">
        {uploading ? <MdAutorenew className="animate-spin" size={24} /> : <MdCloudUpload size={24} />}
      </span>
      <p className="mt-4 text-sm font-bold text-slate-700">
        {uploading ? `Uploading${progress ? ` ${progress}%` : '...'}` : isDragActive ? 'Drop the image here' : 'Upload category image'}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Square artwork works best. Recommended 1000 × 1000 px.</p>
    </div>
  );
}

CategoryImageUploader.propTypes = {
  file: PropTypes.string,
  name: PropTypes.string,
  invalid: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onTouched: PropTypes.func.isRequired
};

function StatusPicker({ value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-slate-700">Category status</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {STATUS_OPTIONS.map((option) => {
          const selected = value === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-h-[72px] items-start gap-3 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
                selected
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon size={21} className={selected ? 'text-[var(--brand-strong)]' : 'text-slate-400'} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{option.help}</span>
              </span>
              {selected && <MdCheck size={18} className="shrink-0 text-[var(--brand-strong)]" aria-hidden="true" />}
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

function CatalogPreview({ values }) {
  const description = stripHtml(values.description);
  const checks = [
    { label: 'Name added', complete: Boolean(values.name.trim()) },
    { label: 'Image uploaded', complete: Boolean(values.file) },
    { label: 'Description ready', complete: Boolean(description) },
    { label: 'Search details ready', complete: Boolean(values.metaTitle.trim() && values.metaDescription.trim()) }
  ];
  const completeCount = checks.filter((check) => check.complete).length;

  return (
    <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Category preview">
      <section className="card-ui overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Catalog preview</p>
        </div>
        <div className="p-4">
          <div className="relative aspect-square overflow-hidden rounded-md bg-slate-100">
            {values.file ? (
              <Image
                fill
                src={values.file}
                alt=""
                className="object-cover"
                sizes="320px"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-300">
                <MdImage size={48} aria-hidden="true" />
                <span className="mt-2 text-xs font-semibold">Image preview</span>
              </div>
            )}
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${values.status === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'}`}>
                {values.status === 'active' ? 'Active' : 'Inactive'}
              </span>
              <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${values.isVisibleInEcom ? 'bg-white text-slate-800' : 'bg-amber-100 text-amber-900'}`}>
                {values.isVisibleInEcom ? 'Storefront visible' : 'Storefront hidden'}
              </span>
            </div>
          </div>
          <div className="px-1 pb-1 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Product category</p>
            <h2 className="mt-1 break-words text-xl font-bold text-slate-950">{values.name.trim() || 'Category name'}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
              {description || 'Add a description to help customers understand what belongs in this category.'}
            </p>
          </div>
        </div>
      </section>

      <section className="card-ui overflow-hidden" aria-label="Search result preview">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <MdSearch size={17} className="text-[var(--brand-strong)]" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Search preview</p>
        </div>
        <div className="p-4">
          <p className="break-words text-base font-semibold text-blue-800">
            {values.metaTitle.trim() || values.name.trim() || 'Category search title'}
          </p>
          <p className="mt-1 break-all text-xs text-emerald-700">/products/{values.slug || 'category-slug'}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {values.metaDescription.trim() || 'Add a concise search description to preview how this category may appear.'}
          </p>
        </div>
      </section>

      <section className="card-ui p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Category readiness</p>
            <p className="mt-0.5 text-xs text-slate-500">{completeCount} of {checks.length} essentials complete</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold tabular-nums text-[var(--brand-strong)]">
            {Math.round((completeCount / checks.length) * 100)}%
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {checks.map((check) => (
            <div key={check.label} className="flex min-h-9 items-center gap-2 text-xs font-semibold text-slate-600">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${check.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {check.complete ? <MdCheck size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              {check.label}
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

CatalogPreview.propTypes = {
  values: PropTypes.shape({
    name: PropTypes.string.isRequired,
    file: PropTypes.string,
    description: PropTypes.string.isRequired,
    metaTitle: PropTypes.string.isRequired,
    metaDescription: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    isVisibleInEcom: PropTypes.bool.isRequired
  }).isRequired
};

function CategoryFormSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeader title="Edit category" subtitle="Loading category details..." icon={MdCategory} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {[300, 360, 280].map((height) => (
            <div key={height} className="card-ui animate-pulse bg-slate-100" style={{ height }} />
          ))}
        </div>
        <div className="card-ui h-[440px] animate-pulse bg-slate-100" />
      </div>
    </div>
  );
}

export default function CategoryForm({ data: currentCategory, isLoading: categoryLoading = false }) {
  const router = useRouter();
  const isEdit = Boolean(currentCategory);
  const { mutate, isLoading: isSaving } = useMutation(
    isEdit ? 'update' : 'new',
    isEdit ? api.updateCategoryByAdmin : api.addCategoryByAdmin,
    {
      retry: false,
      onSuccess: (response) => {
        Swal.fire(response.message, '', 'success');
        router.push('/categories');
      },
      onError: (error) => {
        Swal.fire(
          isEdit ? 'Could not update category' : 'Could not create category',
          error?.response?.data?.message || error.message,
          'error'
        );
      }
    }
  );

  const validationSchema = useMemo(
    () =>
      Yup.object().shape({
        name: Yup.string().trim().required('Enter a category name.'),
        slug: Yup.string().trim().required('Enter a URL slug.'),
        description: Yup.string().required('Add a category description.'),
        metaTitle: Yup.string().trim().required('Add a search title.'),
        metaDescription: Yup.string().trim().required('Add a search description.'),
        image: Yup.string().nullable().required('Upload a category image.')
      }),
    []
  );

  const formik = useFormik({
    initialValues: {
      name: currentCategory?.name || '',
      metaTitle: currentCategory?.metaTitle || '',
      image: currentCategory?.image?.id || null,
      description: currentCategory?.description || '',
      metaDescription: currentCategory?.metaDescription || '',
      file: currentCategory?.image?.path || '',
      slug: currentCategory?.slug || '',
      status:
        currentCategory?.status === 'deactive'
          ? 'inactive'
          : currentCategory?.status || STATUS_OPTIONS[0].value,
      isVisibleInEcom: currentCategory?.isVisibleInEcom !== false
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: (values) => {
      mutate({ ...values, ...(currentCategory && { currentSlug: currentCategory.slug }) });
    }
  });

  const { errors, getFieldProps, handleSubmit, setFieldTouched, setFieldValue, submitCount, touched, values } = formik;

  useEffect(() => {
    if (!submitCount || Object.keys(errors).length === 0) return;
    document.querySelector('[aria-invalid="true"]')?.focus();
  }, [errors, submitCount]);

  const handleTitleChange = (event) => {
    const title = event.target.value;
    const slug = title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]+/g, '')
      .replace(/\s+/g, '-');
    setFieldValue('slug', slug);
    formik.handleChange(event);
  };

  if (categoryLoading && !currentCategory) return <CategoryFormSkeleton />;

  const invalidCount = submitCount
    ? ['name', 'slug', 'description', 'metaTitle', 'metaDescription', 'image'].filter((field) => errors[field]).length
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isEdit ? 'Edit category' : 'Create category'}
        subtitle={isEdit ? `Update how ${currentCategory.name} appears across the catalogue.` : 'Create a clear storefront destination for a product collection.'}
        icon={MdCategory}
      >
        <button type="button" onClick={() => router.push('/categories')} className="btn-ghost min-h-11">
          <MdArrowBack size={18} /> Back to categories
        </button>
      </PageHeader>

      <FormikProvider value={formik}>
        <Form onSubmit={handleSubmit} noValidate>
          {invalidCount > 0 && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              <span className="font-bold">Check {invalidCount} required field{invalidCount === 1 ? '' : 's'}.</span>{' '}
              The first incomplete field has been focused.
            </div>
          )}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-5">
              <SectionCard
                icon={MdDescription}
                title="Category details"
                description="Name the collection, confirm its URL, and explain what customers will find."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="category-name" className="mb-2 block text-xs font-semibold text-slate-700">
                      Category name <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="category-name"
                      placeholder="e.g. Summer collection"
                      aria-invalid={Boolean(touched.name && errors.name)}
                      aria-describedby={touched.name && errors.name ? 'category-name-error' : 'category-name-help'}
                      className={`${fieldClass} ${touched.name && errors.name ? errorFieldClass : ''}`}
                      {...getFieldProps('name')}
                      onChange={handleTitleChange}
                    />
                    <p id="category-name-help" className="mt-1.5 text-xs leading-5 text-slate-500">
                      Keep it short and recognizable in menus and filters.
                    </p>
                    <FieldError id="category-name-error" error={errors.name} touched={touched.name} />
                  </div>

                  <div>
                    <label htmlFor="category-slug" className="mb-2 block text-xs font-semibold text-slate-700">
                      URL slug <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <MdLink
                        size={18}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="category-slug"
                        placeholder="summer-collection"
                        aria-invalid={Boolean(touched.slug && errors.slug)}
                        aria-describedby={touched.slug && errors.slug ? 'category-slug-error' : 'category-slug-help'}
                        className={`${fieldClass} pl-10 font-mono ${touched.slug && errors.slug ? errorFieldClass : ''}`}
                        {...getFieldProps('slug')}
                      />
                    </div>
                    <p id="category-slug-help" className="mt-1.5 text-xs leading-5 text-slate-500">
                      Generated from the name. Edit it only when a specific URL is required.
                    </p>
                    <FieldError id="category-slug-error" error={errors.slug} touched={touched.slug} />
                  </div>
                </div>

                <div className="mt-5">
                  <label htmlFor="category-description" className="mb-2 block text-xs font-semibold text-slate-700">
                    Description <span className="text-red-600">*</span>
                  </label>
                  <div
                    id="category-description"
                    tabIndex={-1}
                    aria-invalid={Boolean(touched.description && errors.description)}
                    aria-describedby={touched.description && errors.description ? 'category-description-error' : undefined}
                    className={`overflow-hidden rounded-md border bg-white ${touched.description && errors.description ? 'border-red-400' : 'border-slate-200'}`}
                    onBlur={() => setFieldTouched('description', true)}
                  >
                    <RichTextEditor
                      value={values.description}
                      onChange={(value) => setFieldValue('description', value)}
                      placeholder="Describe the products and style represented by this category..."
                      minHeight={220}
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    This copy helps customers understand the collection and improves search relevance.
                  </p>
                  <FieldError id="category-description-error" error={errors.description} touched={touched.description} />
                </div>
              </SectionCard>

              <SectionCard
                icon={MdStorefront}
                title="Storefront setup"
                description="Choose the category artwork and control where the category can be used."
              >
                <div className="grid gap-6 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
                  <div className="w-full max-w-sm">
                    <p className="mb-2 text-xs font-semibold text-slate-700">
                      Category image <span className="text-red-600">*</span>
                    </p>
                    <CategoryImageUploader
                      file={values.file}
                      name={values.name}
                      invalid={Boolean(touched.image && errors.image)}
                      onTouched={() => setFieldTouched('image', true)}
                      onChange={(image) => {
                        setFieldValue('image', image?.id || null);
                        setFieldValue('file', image?.path || '');
                      }}
                    />
                    <FieldError id="category-image-error" error={errors.image} touched={touched.image} />
                  </div>

                  <div className="space-y-5">
                    <StatusPicker value={values.status} onChange={(status) => setFieldValue('status', status)} />

                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-700">Ecommerce visibility</p>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={values.isVisibleInEcom}
                        onClick={() => setFieldValue('isVisibleInEcom', !values.isVisibleInEcom)}
                        className={`flex min-h-[76px] w-full items-start gap-3 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
                          values.isVisibleInEcom
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-slate-300 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${values.isVisibleInEcom ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500'}`}>
                          {values.isVisibleInEcom ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">
                            {values.isVisibleInEcom ? 'Visible on ecommerce' : 'Hidden from ecommerce'}
                          </span>
                          <span className="mt-1 block text-xs font-normal leading-5 opacity-80">
                            {values.isVisibleInEcom
                              ? 'Customers can find this category in menus, filters, and category pages.'
                              : 'Products remain in the catalogue, but this category is hidden from the storefront.'}
                          </span>
                        </span>
                        <span className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${values.isVisibleInEcom ? 'bg-emerald-600' : 'bg-slate-300'}`} aria-hidden="true">
                          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${values.isVisibleInEcom ? 'translate-x-6' : 'translate-x-1'}`} />
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={MdSearch}
                title="Search appearance"
                description="Write the title and summary shown to search engines and link previews."
              >
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="meta-title" className="text-xs font-semibold text-slate-700">
                        Search title <span className="text-red-600">*</span>
                      </label>
                      <span className={`text-xs tabular-nums ${values.metaTitle.length > 60 ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>
                        {values.metaTitle.length}/60
                      </span>
                    </div>
                    <input
                      id="meta-title"
                      placeholder={values.name || 'Category title for search results'}
                      aria-invalid={Boolean(touched.metaTitle && errors.metaTitle)}
                      aria-describedby={touched.metaTitle && errors.metaTitle ? 'meta-title-error' : undefined}
                      className={`${fieldClass} ${touched.metaTitle && errors.metaTitle ? errorFieldClass : ''}`}
                      {...getFieldProps('metaTitle')}
                    />
                    <FieldError id="meta-title-error" error={errors.metaTitle} touched={touched.metaTitle} />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="meta-description" className="text-xs font-semibold text-slate-700">
                        Search description <span className="text-red-600">*</span>
                      </label>
                      <span className={`text-xs tabular-nums ${values.metaDescription.length > 160 ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>
                        {values.metaDescription.length}/160
                      </span>
                    </div>
                    <textarea
                      id="meta-description"
                      rows={4}
                      placeholder="A concise summary of the category for search results."
                      aria-invalid={Boolean(touched.metaDescription && errors.metaDescription)}
                      aria-describedby={touched.metaDescription && errors.metaDescription ? 'meta-description-error' : undefined}
                      className={`${fieldClass} resize-y py-3 leading-6 ${touched.metaDescription && errors.metaDescription ? errorFieldClass : ''}`}
                      {...getFieldProps('metaDescription')}
                    />
                    <FieldError
                      id="meta-description-error"
                      error={errors.metaDescription}
                      touched={touched.metaDescription}
                    />
                  </div>

                </div>
              </SectionCard>

              <div className="card-ui flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <p className="mr-auto text-xs leading-5 text-slate-500">
                  Required fields must be complete before the category can be saved.
                </p>
                <button type="button" onClick={() => router.push('/categories')} className="btn-ghost min-h-11 sm:px-5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-brand min-h-11 min-w-40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <MdAutorenew className="animate-spin" size={18} />
                      {isEdit ? 'Saving changes...' : 'Creating category...'}
                    </>
                  ) : isEdit ? (
                    'Save changes'
                  ) : (
                    'Create category'
                  )}
                </button>
              </div>
            </div>

            <CatalogPreview values={values} />
          </div>
        </Form>
      </FormikProvider>
    </div>
  );
}
