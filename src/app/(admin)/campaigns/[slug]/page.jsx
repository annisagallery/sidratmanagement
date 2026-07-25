'use client';
import { use } from 'react';
import { useQuery } from 'react-query';
import { getCampaignByAdmin } from 'src/services';
import CampaignForm from 'src/components/forms/campaign';

export default function EditCampaignPage({ params }) {
  const { slug } = use(params);
  const { data, isLoading } = useQuery(['campaign-edit', slug], () => getCampaignByAdmin(slug));

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;
  return <CampaignForm data={data?.data} />;
}