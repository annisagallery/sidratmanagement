import BatchDetail from 'src/components/_admin/production/BatchDetail';

export default async function BatchDetailPage({ params }) {
  const { batchNo } = await params;
  return <BatchDetail batchNo={decodeURIComponent(batchNo)} />;
}
