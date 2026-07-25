import ViewProduct from 'src/components/_admin/products/viewProduct';
export default async function ViewProductPage({ params }) {
  const { slug } = await params;
  return <ViewProduct slug={slug} />;
}
