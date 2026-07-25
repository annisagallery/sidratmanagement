import { useQuery } from 'react-query';
import * as api from 'src/services';

export function useStatuses(model) {
  const { data, isLoading } = useQuery(
    ['statuses', model],
    () => api.getStatusesByModel(model),
    { staleTime: 5 * 60 * 1000 }
  );
  return { statuses: data?.data || [], isLoading };
}
