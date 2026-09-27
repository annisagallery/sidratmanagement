'use client';
import { use } from 'react';
import { useQuery } from 'react-query';
import { getCampaignByAdmin } from 'src/services';
import CampaignForm from 'src/components/forms/campaign';
import { EmptyState, ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';

export default function EditCampaignPage({ params }) {
  const { slug } = use(params);
  const { data, isLoading, isError, error, refetch } = useQuery(['campaign-edit', slug], () => getCampaignByAdmin(slug));

  if (isLoading) return <LoadingBlock />;
  // Without a record the form is a create form — never show it for a failed load.
  if (isError) return <ErrorState error={error} title="This campaign could not be loaded" onRetry={refetch} />;
  if (!data?.data) {
    return (
      <div className="card-ui">
        <EmptyState title="Campaign not found" hint="It may have been deleted." />
      </div>
    );
  }
  return <CampaignForm data={data.data} />;
}
