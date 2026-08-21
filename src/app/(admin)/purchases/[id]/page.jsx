import PurchaseDetail from 'src/components/_admin/purchases/PurchaseDetail';

export default async function PurchasePage({ params }) {
  const { id } = await params;
  return <PurchaseDetail id={id} />;
}
