import SiteSettingsPage from 'src/components/_admin/siteSettings/SiteSettingsPage';
export default async function GlobalSettingsPage({ params }) {
  const { section } = await params;
  const view = {
    'product-showcase': 'product',
    'branch-page': 'branch',
    invoice: 'invoice'
  }[section] || section;
  return <SiteSettingsPage section={view} />;
}
