import React from 'react';
// components
import CampaignForm from 'src/components/forms/campaign';

export default function editCampaign({ data, isLoading }) {
  return (
    <div>
      <CampaignForm data={data} isLoading={isLoading} />
    </div>
  );
}
