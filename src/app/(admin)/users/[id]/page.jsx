import UserDetails from 'src/components/_admin/users/userDetails';
export default async function UserActivityPage({ params }) {
  const { id } = await params;
  return <UserDetails userPhone={decodeURIComponent(id)} />;
}
