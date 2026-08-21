import PurchaseEditor from 'src/components/_admin/purchases/PurchaseEditor';

export default async function EditPurchasePage({ params }) {
  const { id } = await params;
  return <PurchaseEditor id={id} />;
}
