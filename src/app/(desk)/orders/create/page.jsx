import CreateOrder from 'src/components/_admin/orders/createOrder';

export const metadata = { title: 'New order' };

export default function Page() {
  // The desk's top bar already names the screen, so the form skips its heading.
  return <CreateOrder desk />;
}
