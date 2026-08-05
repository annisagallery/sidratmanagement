import ProductBom from 'src/components/_admin/products/productBom';

export default async function ProductBomPage({ params }) {
  const { slug } = await params;
  return <ProductBom slug={slug} />;
}
