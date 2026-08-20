import { redirect } from 'next/navigation';

// Moved under Settings › Homepage. Kept so old links and bookmarks resolve.
export default function BannersPage() {
  redirect('/homepage-settings/banners');
}
