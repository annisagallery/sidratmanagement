'use client';
import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/navigation';
import PropTypes from 'prop-types';
import { FormikProvider, useFormik, Form } from 'formik';
import * as Yup from 'yup';
import * as api from 'src/services';
import Swal from 'sweetalert2';
import UploadSingleFile from '../upload/UploadSingleFile';
import RichTextEditor from 'src/components/richTextEditor';

CategoryForm.propTypes = {
  data: PropTypes.object,
  isLoading: PropTypes.bool
};

const STATUS_OPTIONS = ['active', 'deactive'];

export default function CategoryForm({ data: currentCategory, isLoading: categoryLoading }) {
  const router = useRouter();
  const { mutate, isLoading } = useMutation(
    currentCategory ? 'update' : 'new',
    currentCategory ? api.updateCategoryByAdmin : api.addCategoryByAdmin,
    {
      retry: false,
      onSuccess: (data) => {
        Swal.fire(data.message, '', 'success');
        router.push('/categories');
      },
      onError: (error) => {
        Swal.fire(error.response.data.message, '', 'error');
      }
    }
  );

  const NewCategorySchema = Yup.object().shape({
    name: Yup.string().required('Name is required'),
    slug: Yup.string().required('Slug is required'),
    description: Yup.string().required('Description is required'),
    metaTitle: Yup.string().required('Meta title is required'),
    metaDescription: Yup.string().required('Meta description is required'),
    image: Yup.string().required('Image is required')
  });

  const formik = useFormik({
    initialValues: {
      name: currentCategory?.name || '',
      metaTitle: currentCategory?.metaTitle || '',
      image: currentCategory?.image?.id || null,
      description: currentCategory?.description || '',
      metaDescription: currentCategory?.metaDescription || '',
      file: currentCategory?.image?.path || '',
      slug: currentCategory?.slug || '',
      status: currentCategory?.status || STATUS_OPTIONS[0]
    },
    enableReinitialize: true,
    validationSchema: NewCategorySchema,
    onSubmit: async (values) => {
      try {
        mutate({ ...values, ...(currentCategory && { currentSlug: currentCategory.slug }) });
      } catch (error) {
        console.error(error);
      }
    }
  });

  const { errors, touched, handleSubmit, setFieldValue, getFieldProps } = formik;

  const handleTitleChange = (event) => {
    const title = event.target.value;
    const slug = title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]+/g, '')
      .replace(/\s+/g, '-');
    formik.setFieldValue('slug', slug);
    formik.handleChange(event);
  };

  return (
    <div>
      <FormikProvider value={formik}>
        <Form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 border space-y-6">
              <div>
                <label htmlFor="category-name" className="block text-sm font-medium text-gray-700">
                  Category Name
                </label>
                <input
                  id="category-name"
                  className="mt-2 block w-full border border-gray-300 p-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
                  {...getFieldProps('name')}
                  onChange={handleTitleChange}
                />
                {touched.name && errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                  Slug
                </label>
                <input
                  id="slug"
                  className="mt-2 block w-full border border-gray-300 p-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
                  {...getFieldProps('slug')}
                />
                {touched.slug && errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug}</p>}
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="status"
                  className="mt-2 block w-full border border-gray-300 p-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
                  {...getFieldProps('status')}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <div className="mt-2">
                  <RichTextEditor
                    value={formik.values.description}
                    onChange={(value) => setFieldValue('description', value)}
                    placeholder="Category description…"
                  />
                </div>
                {touched.description && errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 border space-y-6">
              <div>
                <label htmlFor="meta-title" className="block text-sm font-medium text-gray-700">
                  Meta Title
                </label>
                <input
                  id="meta-title"
                  className="mt-2 block w-full border border-gray-300 p-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
                  {...getFieldProps('metaTitle')}
                />
                {touched.metaTitle && errors.metaTitle && (
                  <p className="mt-1 text-sm text-red-600">{errors.metaTitle}</p>
                )}
              </div>

              <div>
                <label htmlFor="meta-description" className="block text-sm font-medium text-gray-700">
                  Meta Description
                </label>
                <textarea
                  id="meta-description"
                  rows={2}
                  className="mt-2 block w-full border border-gray-300 p-2 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
                  {...getFieldProps('metaDescription')}
                />
                {touched.metaDescription && errors.metaDescription && (
                  <p className="mt-1 text-sm text-red-600">{errors.metaDescription}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Image (1000 * 1000) </label>
                <UploadSingleFile
                  file={formik.values.file}
                  model={'Category'}
                  setFile={(file) => {
                    setFieldValue('image', file?.id || null);
                    setFieldValue('file', file?.path);
                  }}
                />
                {touched.image && errors.image && <p className="mt-2 text-sm text-red-600">{errors.image}</p>}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              className={`w-full rounded-md py-2 border border-transparent font-medium text-white ${
                isLoading ? 'bg-gray-400' : 'bg-[var(--brand)] hover:brightness-95'
              }`}
              disabled={isLoading}
            >
              {isLoading
                ? currentCategory
                  ? 'Updating...'
                  : 'Adding...'
                : currentCategory
                  ? 'Update Category'
                  : 'Add Category'}
            </button>
          </div>
        </Form>
      </FormikProvider>
    </div>
  );
}
