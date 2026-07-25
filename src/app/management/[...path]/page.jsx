import { redirect } from 'next/navigation';

export default function ManagementAliasPathPage({ params }) {
  const path = Array.isArray(params?.path) ? params.path.join('/') : '';
  redirect(path ? `/${path}` : '/');
}
