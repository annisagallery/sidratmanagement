import { redirect } from 'next/navigation';

// The homepage is written in the storefront's source, so there is nothing to
// configure at this level any more. Banners and navigation still are, and the
// nav links here as their parent, so hand the request to the first of them.
export default function HomepageSettingsPage() {
  redirect('/homepage-settings/banners');
}
