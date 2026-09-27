'use client';
import React, { use } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from 'react-query';
import * as api from 'src/services';
import EditCategory from 'src/components/_admin/categories/editCategory';
import { ErrorState } from 'src/components/_admin/ui/TableStates';

Page.propTypes = {
  params: PropTypes.shape({
    slug: PropTypes.string.isRequired
  }).isRequired
};

export default function Page({ params }) {
  const { slug } = use(params);
  const { data, isLoading, isError, error, refetch } = useQuery(['admin-category', slug], () => api.getCategoryBySlugAdmin(slug));

  // A failed load must not fall through to the form: without a record it is a
  // create form, and saving it would add a second category.
  if (isError) return <ErrorState error={error} title="This category could not be loaded" onRetry={refetch} />;
  return <EditCategory isLoading={isLoading} data={data?.data} />;
}
