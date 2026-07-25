import { notFound } from 'next/navigation';
import SiteSettingsPage from 'src/components/_admin/siteSettings/SiteSettingsPage';

// URL slug → form field key (matches the storefront page slugs)
const PAGE_KEYS = {
  about: 'aboutUs',
  'privacy-policy': 'privacyPolicy',
  'refund-return-policy': 'refundPolicy',
  'terms-and-conditions': 'termsConditions'
};
export default async function AdditionalPagePage({ params }) {
  const { page } = await params;
  const pageKey = PAGE_KEYS[page];
  if (!pageKey) notFound();
  return <SiteSettingsPage section="pages" page={pageKey} />;
}
