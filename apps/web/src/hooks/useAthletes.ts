import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaginatedResponse, Athlete, Sport } from '@/types/api';

interface AthletesParams {
  sport?: string;
  country?: string;
  gender?: string;
  hand?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AthletePayload {
  sportId: string;
  firstName: string;
  lastName: string;
  country?: string;
  city?: string;
  dateOfBirth?: string;
  gender?: string;
  primaryHand?: string;
  weight?: number;
  height?: number;
  experienceLevel?: string;
  bioRu?: string;
  photoUrl?: string;
  socialLinks?: Record<string, string>;
}

export function useAthletes(
  params: AthletesParams = {},
  options?: { initialData?: PaginatedResponse<Athlete> },
) {
  return useQuery<PaginatedResponse<Athlete>>({
    queryKey: ['athletes', params],
    queryFn: () => api.get('/athletes', { params }).then((r: { data: any }) => r.data),
    initialData: options?.initialData,
  });
}

export function useAthlete(slug: string) {
  return useQuery<Athlete>({
    queryKey: ['athlete', slug],
    queryFn: () => api.get(`/athletes/${slug}`).then((r: { data: any }) => r.data),
    enabled: !!slug,
  });
}

export function useSports() {
  return useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then((r: { data: any }) => r.data?.data ?? r.data),
  });
}

export function useCreateAthlete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AthletePayload) =>
      api.post('/athletes', data).then((r: { data: any }) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['athletes'] }),
  });
}

export function useUpdateAthlete(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AthletePayload>) =>
      api.patch(`/athletes/${id}`, data).then((r: { data: any }) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['athletes'] });
      qc.invalidateQueries({ queryKey: ['athlete'] });
    },
  });
}

export function useVerifyAthlete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/athletes/${id}/verify`).then((r: { data: any }) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['athletes'] }),
  });
}
