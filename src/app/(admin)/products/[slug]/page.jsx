import EditProduct from 'src/components/_admin/products/editProduct';
export default async function EditProductPage({ params }) {
  const { slug } = await params;
  return <EditProduct slug={slug} />;
}
