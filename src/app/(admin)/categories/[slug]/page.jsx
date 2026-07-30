'use client';
import React, { use } from 'react';
import PropTypes from 'prop-types';

// components
import EditCategory from 'src/components/_admin/categories/editCategory';

// api
import * as api from 'src/services';
import { useQuery } from 'react-query';
import Swal from 'sweetalert2';

Page.propTypes = {
  params: PropTypes.shape({
    slug: PropTypes.string.isRequired
  }).isRequired
};
export default function Page({ params }) {
  const { slug } = use(params);
  const { data, isLoading } = useQuery(['admin-category', slug], () => api.getCategoryBySlugAdmin(slug), {
    onError: (err) => {
      Swal.fire(err.response.data.message || 'Something went wrong!', '', 'error');
    }
  });
  return (
    <div>
      <EditCategory isLoading={isLoading} data={data?.data} />
    </div>
  );
}
