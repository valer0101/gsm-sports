import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Sport } from '@/types/api';

export function useSports() {
  return useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then((r: { data: any }) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
