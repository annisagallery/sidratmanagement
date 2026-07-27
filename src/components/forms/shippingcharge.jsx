'use client';
import React from 'react';
import { useMutation } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import PropTypes from 'prop-types';
import { FormikProvider, useFormik, Form } from 'formik';
import * as Yup from 'yup';
import * as api from 'src/services';
import Swal from 'sweetalert2';
import { districts, upazilasForDistrict } from 'src/utils/bangladeshAddress';

ShippingChargeForm.propTypes = {
  data: PropTypes.object,
  isLoading: PropTypes.bool
};

const STATUS_OPTIONS = ['active', 'inactive'];

export default function ShippingChargeForm({ data: currentCharge, isLoading: pageLoading }) {
  const router = useRouter();

  // Form Submission Mutation
  const { mutate, isLoading: isSubmitting } = useMutation(
    currentCharge ? 'update-shipping-charge' : 'new-shipping-charge',
    currentCharge ? api.updateShippingChargeByAdmin : api.addShippingChargeByAdmin, // Ensure these exist in your services
    {
      retry: false,
      onSuccess: (data) => {
        Swal.fire(data.message || 'Success!', '', 'success');
        router.push('/shippingcharge'); // Redirect to your listing page
      },
      onError: (error) => {
        Swal.fire(error?.response?.data?.message || 'Failed to save shipping charge', '', 'error');
      }
    }
  );

  // Validation Schema aligned with Mongoose requirements
  const ShippingChargeSchema = Yup.object().shape({
    district: Yup.string().required('District is required'),
    upazila: Yup.string().required('Upazila is required'),
    charge: Yup.number().required('Shipping charge is required').min(0, 'Charge must be 0 or higher'),
    status: Yup.string().oneOf(STATUS_OPTIONS).required('Status is required')
  });

  const formik = useFormik({
    initialValues: {
      district: currentCharge?.district || currentCharge?.city_name || '',
      upazila: currentCharge?.upazila || currentCharge?.zone_name || '',
      charge: currentCharge?.charge || '',
      status: currentCharge?.status === 'deactive' ? 'inactive' : currentCharge?.status || STATUS_OPTIONS[0]
    },
    enableReinitialize: true,
    validationSchema: ShippingChargeSchema,
    onSubmit: async (values) => {
      try {
        mutate({ ...values, ...(currentCharge && { id: currentCharge.id }) });
      } catch (error) {
        console.error(error);
      }
    }
  });

  const { errors, touched, handleSubmit, setFieldValue, values, getFieldProps } = formik;
  const upazilas = upazilasForDistrict(values.district);

  const handleDistrictChange = (e) => {
    const district = e.target.value;
    setFieldValue('district', district);
    setFieldValue('upazila', district === 'ALL' ? 'ALL' : '');
  };

  return (
    <div>
      <FormikProvider value={formik}>
        <Form onSubmit={handleSubmit}>
          <div className="bg-white p-6 border space-y-6">
            <h4 className="text-xl font-bold mb-4 border-b pb-2">
              {currentCharge ? 'Edit Shipping Charge' : 'Add New Shipping Charge'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* City Selection */}
              <div className="w-full">
                <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1">
                  District
                </label>
                <select
                  id="district"
                  name="district"
                  value={values.district}
                  onChange={handleDistrictChange}
                  className={`block w-full border border-gray-300 p-2 rounded-md focus:ring-[var(--brand-ring)] focus:border-[var(--brand)] ${
                    touched.district && errors.district ? 'border-red-500' : ''
                  }`}
                >
                  <option value="" disabled>
                    Select District
                  </option>
                  <option value="ALL">Any District (ALL)</option>
                  {districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
                {touched.district && errors.district && <p className="mt-1 text-sm text-red-600">{errors.district}</p>}
              </div>

              {/* Upazila Selection */}
              <div className="w-full">
                <label htmlFor="upazila" className="block text-sm font-medium text-gray-700 mb-1">
                  Upazila
                </label>
                <select
                  id="upazila"
                  name="upazila"
                  value={values.upazila}
                  onChange={(e) => setFieldValue('upazila', e.target.value)}
                  disabled={!values.district}
                  className={`block w-full border border-gray-300 p-2 rounded-md focus:ring-[var(--brand-ring)] focus:border-[var(--brand)] ${
                    touched.upazila && errors.upazila ? 'border-red-500' : ''
                  }`}
                >
                  <option value="" disabled>
                    Select Upazila
                  </option>
                  <option value="ALL">Any Upazila (ALL)</option>
                  {upazilas.map((upazila) => (
                    <option key={upazila} value={upazila}>
                      {upazila}
                    </option>
                  ))}
                </select>
                {touched.upazila && errors.upazila && <p className="mt-1 text-sm text-red-600">{errors.upazila}</p>}
              </div>

              {/* Charge Input */}
              <div className="w-full">
                <label htmlFor="charge" className="block text-sm font-medium text-gray-700 mb-1">
                  Shipping Charge Amount
                </label>
                <input
                  id="charge"
                  type="number"
                  placeholder="e.g. 150"
                  className={`block w-full border border-gray-300 p-2 rounded-md focus:ring-[var(--brand-ring)] focus:border-[var(--brand)] ${
                    touched.charge && errors.charge ? 'border-red-500' : ''
                  }`}
                  {...getFieldProps('charge')}
                />
                {touched.charge && errors.charge && <p className="mt-1 text-sm text-red-600">{errors.charge}</p>}
              </div>

              {/* Status Selection */}
              <div className="w-full">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  className="block w-full border border-gray-300 p-2 rounded-md focus:ring-[var(--brand-ring)] focus:border-[var(--brand)]"
                  {...getFieldProps('status')}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              className={`w-full rounded-md py-2 border border-transparent font-medium text-white transition-colors ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--brand)] hover:brightness-95'
              }`}
              disabled={isSubmitting || pageLoading}
            >
              {isSubmitting
                ? currentCharge
                  ? 'Updating...'
                  : 'Adding...'
                : currentCharge
                  ? 'Update Shipping Charge'
                  : 'Add Shipping Charge'}
            </button>
          </div>
        </Form>
      </FormikProvider>
    </div>
  );
}
