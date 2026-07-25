'use client';
import SectionsManager from 'src/components/_admin/homepage/SectionsManager';
import PageHeader from 'src/components/_admin/ui/PageHeader';

export default function HomepageSettingsPage() {
  return (
    <div className="w-full space-y-4">
      <PageHeader title="Homepage" subtitle="Control which sections appear on the homepage. Banners are managed under Marketing.">
        {null}
      </PageHeader>
      <SectionsManager />
    </div>
  );
}
