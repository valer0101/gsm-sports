'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Tournament } from '@/types/api';

/* ─── Tournaments ─── */

export function useAdminTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ['admin', 'tournaments'],
    queryFn: () => api.get('/admin/tournaments').then((r: any) => r.data),
  });
}

export function useAdminTournament(id: string) {
  return useQuery<Tournament>({
    queryKey: ['admin', 'tournament', id],
    queryFn: () => api.get(`/admin/tournaments/${id}`).then((r: any) => r.data),
    enabled: !!id,
  });
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Tournament> & { sportId: string }) =>
      api.post('/admin/tournaments', data).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] }),
  });
}

export function useUpdateTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Tournament>) =>
      api.patch(`/admin/tournaments/${id}`, data).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', id] });
    },
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tournaments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] }),
  });
}

export function useToggleRegistration(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch(`/admin/tournaments/${id}/toggle-registration`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
  });
}

export function useGenerateBrackets(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post(`/admin/tournaments/${id}/generate-brackets`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tournament', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
  });
}

/* ─── Users ─── */

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export function useAdminUsers(page = 1, limit = 20) {
  return useQuery<{ users: AdminUser[]; total: number }>({
    queryKey: ['admin', 'users', page, limit],
    queryFn: () => api.get(`/admin/users?page=${page}&limit=${limit}`).then((r: any) => r.data),
  });
}

export function useUpdateUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      api.patch(`/admin/users/${id}/roles`, { roles }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

/* ─── Operators ─── */

export interface OperatorEntry {
  id: string;
  operatorId: string;
  tournamentId: string;
  assignedAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export function useAdminOperators(tournamentId: string) {
  return useQuery<OperatorEntry[]>({
    queryKey: ['admin', 'operators', tournamentId],
    queryFn: () => api.get(`/admin/tournaments/${tournamentId}/operators`).then((r: any) => r.data),
    enabled: !!tournamentId,
  });
}

export function useAssignOperator(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      api.post(`/admin/tournaments/${tournamentId}/operators`, { email }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'operators', tournamentId] }),
  });
}

export function useRemoveOperator(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (operatorId: string) =>
      api.delete(`/admin/tournaments/${tournamentId}/operators/${operatorId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'operators', tournamentId] }),
  });
}
