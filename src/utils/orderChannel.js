export function orderChannelLabel(order) {
  if (order.source === 'online') return 'Website';
  if (order.source === 'admin') return 'Contact center';
  return order.branch?.name || 'Branch order';
}
