import { redirect } from 'next/navigation';
import SiteSettingsPage from 'src/components/_admin/siteSettings/SiteSettingsPage';
export default async function GlobalSettingsPage({ params }) {
  const { section } = await params;
  // Both moved under Settings › Homepage; 'homepage' here was a second,
  // unlinked copy of that editor.
  if (section === 'navigation') redirect('/homepage-settings/navigation');
  if (section === 'homepage') redirect('/homepage-settings');
  const view = {
    'product-showcase': 'product',
    'branch-page': 'branch',
    invoice: 'invoice'
  }[section] || section;
  return <SiteSettingsPage section={view} />;
}
