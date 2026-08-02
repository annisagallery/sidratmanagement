import ProductStockDetail from 'src/components/_admin/inventory/ProductStockDetail';

export default async function ProductStockPage({ params }) {
  const { id } = await params;
  return <ProductStockDetail productId={id} />;
}
