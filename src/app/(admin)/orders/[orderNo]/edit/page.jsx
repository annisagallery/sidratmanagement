import CreateOrder from 'src/components/_admin/orders/createOrder';

export default async function Page({ params }) {
  const { orderNo } = await params;
  return <CreateOrder orderNo={orderNo} />;
}
